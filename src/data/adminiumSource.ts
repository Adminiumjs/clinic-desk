// SPDX-License-Identifier: AGPL-3.0-only
/**
 * A `DataSource` backed by a real Adminium instance (28-T16).
 *
 * ── READS DO NOT BECOME ASYNC ──────────────────────────────────────────────
 * `loadSnapshot` fetches the whole read-set once, before React mounts, and
 * hands back the same SYNCHRONOUS shapes `demoSource` returns — so the store,
 * every selector and every screen are untouched. Making `DataSource` return
 * promises would touch all of them, and that is the cost the seam's own header
 * hides.
 *
 * ── TIME COMES FROM THE SCOPE, NOT FROM THE BROWSER ────────────────────────
 * Every timestamp is converted with `toTenantDay`/`toTenantMinutes` against the
 * timezone the scope publishes. The obvious alternative —
 * `new Date(value).getHours()` — reads the VISITOR's clock: during Phase 0 a
 * 15:00 London appointment rendered at 16:00 in a Berlin browser with nothing
 * erroring. That is the single most important line in this file.
 *
 * ── WHAT IS STILL A GAP, AND IS NOT THIS FILE'S TO FIX ─────────────────────
 * The app addresses visit types and clinicians by SLUG (`"routine"`, a
 * compile-time union member) and the database keys them by `serial`. Nothing in
 * the schema carries the slug, so the maps below key off display text an
 * operator can edit. That is WS-I's `slug` column, not something a client can
 * paper over — it is marked, not hidden.
 */

import {
  createPublicClient,
  toTenantDay,
  toTenantMinutes,
  type PublicClient,
} from "@adminiumjs/public-client";

import { resolveSurfaceConfig } from "../publicConfig.ts";

import type { Appointment, Clinician, Now, VisitType, VisitTypeId, VisitStatus } from "./types.ts";
import type { SnapshotPort } from "./snapshotPort.ts";
import type { DataSource } from "./source.ts";
import { demoSource } from "./source.ts";

interface WireVisitType {
  id: number;
  name: string;
  minutes: number;
  /** `numeric` serializes as a STRING, not a number. */
  fee: string;
  color: string;
}

interface WireClinician {
  id: number;
  name: string;
  initials: string;
  role: "gp" | "physiotherapist" | "nurse";
  color: string;
}

interface WireAppointment {
  clinician_id: number;
  visit_type_id: number;
  /** `timestamptz`, serialized as a UTC instant. */
  starts_at: string;
  minutes: number;
}

/* WS-I GAP — no slug column. Keyed off operator-editable display text. */
const VISIT_TYPE_BY_NAME: Record<string, VisitTypeId> = {
  "Routine check": "routine",
  "New patient": "newpatient",
  Physiotherapy: "physio",
  Nurse: "nurse",
};

/* The role enum maps cleanly to an i18n key; the visit-type NAME does not. */
const ROLE_KEY: Record<WireClinician["role"], string> = {
  gp: "data.role.gp",
  physiotherapist: "data.role.physio",
  nurse: "data.role.nurse",
};

/*
 * WS-I GAP — `offers` has no table. "A GP never appears in the physiotherapy
 * chooser" is the rule that makes the booking grid correct, and the schema
 * cannot express it, so it is a convention invented here from `role`.
 */
const OFFERS_BY_ROLE: Record<WireClinician["role"], VisitTypeId[]> = {
  gp: ["routine", "newpatient"],
  physiotherapist: ["physio"],
  nurse: ["nurse"],
};

/**
 * Why the last {@link loadSnapshot} returned null, or null if it did not.
 *
 * Module-scope because the failure has to reach a caller that only sees a
 * `null` return, and adding a second return shape would touch every screen.
 */
let lastSnapshotError: Error | null = null;

/** The reason the last snapshot attempt failed. */
export function snapshotFailure(): Error | null {
  return lastSnapshotError;
}

export interface Snapshot {
  /** The tenant\'s ISO-4217 code, or null (28-T34). Drives every formatter. */
  currency: string | null;
  /** The zone the serials below were computed in. */
  timezone: string;
  /**
   * Who chose {@link timezone}. Carried so the UI can SAY which zone these
   * dates are in when nobody confirmed it — the field exists precisely because
   * both an unconfirmed zone and a UTC substitute are silent otherwise (a
   * console line is not an operator surface).
   */
  timezoneSource: 'operator' | 'host' | 'fallback' | null;
  visitTypes: VisitType[];
  clinicians: Clinician[];
  appointments: Appointment[];
  now: Now;
}

/** What `Find` needs, and the columns the scope must expose for it. */
export const REQUIRED = {
  visitTypes: ["id", "name", "minutes", "fee", "color"],
  clinicians: ["id", "name", "initials", "role", "color"],
  appointments: ["clinician_id", "visit_type_id", "starts_at", "minutes"],
};

/**
 * Read a whole ref, a page at a time.
 *
 * The page size is the SCOPE's — `refs[ref].limit` is the operator's ceiling
 * and asking for more than it allows is refused. This file used to read each
 * ref in ONE request with a generous `limit`, which works only while the set is
 * small: past the operator's ceiling the server answers page one with a 200 and
 * nothing anywhere says so. `max` is this app's own guard against a runaway
 * read; hitting it is reported rather than silently dropping the tail.
 */
async function listAll<T>(
  client: SnapshotPort,
  ref: string,
  size: number,
  max: number,
): Promise<T[]> {
  const out: T[] = [];
  const page = Math.max(1, Math.min(size, 500));
  for (let offset = 0; offset < max; offset += page) {
    const res = await client.list<T>(ref, { limit: page, offset });
    out.push(...res.data);
    if (res.data.length < page) return out;
  }
  console.warn(`[adminium] ${ref}: stopped at ${String(max)} rows — the rest were not read.`);
  return out;
}

/**
 * Fetch the read-set and map it into the app's shapes.
 *
 * Returns `null` on ANY failure so the caller falls back to demo mode
 * structurally rather than in a catch — the marketplace demos are static clones
 * with no server and must keep working byte-identically.
 */
export async function loadSnapshot(client: SnapshotPort): Promise<Snapshot | null> {
  try {
    /*
     * Fail at BOOT with a legible message rather than at render with a 403 on
     * a screen nobody was looking at. An operator can narrow a scope at any
     * time; this turns that into a startup error naming the missing column.
     */
    await client.assertRefs(REQUIRED);

    const config = await client.config();
    const timezone = config.timezone;
    /* The operator's per-ref page ceiling. `?? 100` is the server's own
     * conservative default for a ref the scope does not size. */
    const cap = (ref: string): number => config.refs[ref]?.limit ?? 100;
    const [types, clinicians, appts] = await Promise.all([
      listAll<WireVisitType>(client, "visitTypes", cap("visitTypes"), 50_000),
      listAll<WireClinician>(client, "clinicians", cap("clinicians"), 50_000),
      listAll<WireAppointment>(client, "appointments", cap("appointments"), 50_000),
    ]);

    const typeById = new Map<number, VisitTypeId>();
    const visitTypes: VisitType[] = [];
    for (const row of types) {
      const slug = VISIT_TYPE_BY_NAME[row.name];
      // A row with no slug cannot be booked — it has no tint, no i18n key and
      // no place in `offers`. Dropping it is the honest outcome, and is itself
      // the argument for the slug column.
      if (slug === undefined) continue;
      typeById.set(row.id, slug);
      visitTypes.push({
        id: slug,
        label: row.name,
        blurb: `data.type.${slug}.blurb`,
        minutes: row.minutes,
        fee: Number(row.fee),
        tint: row.color,
      });
    }

    const clinicianById = new Map<number, string>();
    const staff: Clinician[] = clinicians.map((row) => {
      const slug = row.initials.toLowerCase();
      clinicianById.set(row.id, slug);
      return {
        id: slug,
        name: row.name,
        ini: row.initials,
        role: ROLE_KEY[row.role],
        tint: row.color,
        offers: OFFERS_BY_ROLE[row.role],
      };
    });

    const appointments: Appointment[] = [];
    for (const row of appts) {
      const clinician = clinicianById.get(row.clinician_id);
      const type = typeById.get(row.visit_type_id);
      if (clinician === undefined || type === undefined) continue;
      appointments.push({
        // The patient-facing ref is deliberately NOT exposed to this scope —
        // a visitor must not be able to enumerate other people's references —
        // so slot occupancy carries a synthetic id.
        id: `db-${String(appointments.length)}`,
        patient: "",
        clinician,
        type,
        date: toTenantDay(row.starts_at, timezone),
        start: toTenantMinutes(row.starts_at, timezone),
        status: "booked" as VisitStatus,
        checkedInAt: null,
        reason: "",
        deskNote: null,
        recallWeeks: null,
      });
    }

    // "Now" in the PRACTICE's zone, for the same reason every other time is.
    const nowIso = new Date().toISOString();
    return {
      currency: config.currency,
      timezone,
      // Absent on the public path (the API always carries a real zone on its
      // scope), and absent means no claim — never a guess.
      timezoneSource: config.timezoneSource ?? null,
      visitTypes,
      clinicians: staff,
      appointments,
      now: { date: toTenantDay(nowIso, timezone), minutes: toTenantMinutes(nowIso, timezone) },
    };
  } catch (error) {
    /*
     * The reason is REPORTED, not swallowed. It used to say "using demo data",
     * which stopped being true when a non-demo build started hard-stopping
     * instead — and the caller was left showing a generic failure while the
     * actual cause ("this connection has no timezone") sat in the console.
     *
     * `lastSnapshotError` is how the entry point recovers it. A thrown error
     * would be cleaner and is not available: this function returning `null` is
     * the contract every caller is written against.
     */
    lastSnapshotError = error instanceof Error ? error : new Error(String(error));
    console.warn("[adminium] could not load a snapshot:", error);
    return null;
  }
}

/** A synchronous `DataSource` over an already-fetched snapshot. */
export function snapshotSource(snap: Snapshot): DataSource {
  return {
    now: () => ({ ...snap.now }),
    visitTypes: () => snap.visitTypes.map((v) => ({ ...v })),
    clinicians: () => snap.clinicians.map((c) => ({ ...c, offers: [...c.offers] })),
    appointments: () => snap.appointments.map((a) => ({ ...a })),
    /*
     * The staff side's read-set. `DataSource` is ONE interface for both sides of
     * the app, so a customer-only connected build still has to satisfy these.
     * They fall back to demo data; the real fix is `frontends[]`-shaped — one
     * source per side, each with its own scope and key.
     */
    patients: () => demoSource.patients(),
    charges: () => demoSource.charges(),
    payments: () => demoSource.payments(),
  };
}

/** Build a client from the build-time env, or `null` in a demo build. */
export function clientFromEnv(): PublicClient | null {
  return createPublicClient({
    /* Dot access, matching `vite.config.ts`'s `define` — see src/vite-env.d.ts.
       An empty string is what `define` emits for an unset flag, and
       `createPublicClient` already treats empty as "no server". */
    baseUrl: import.meta.env.VITE_ADMINIUM_API_BASE_URL,
    publishableKey: import.meta.env.VITE_ADMINIUM_PUBLISHABLE_KEY,
  });
}

/**
 * The client, resolved the 29-T16 way: baked vars first (that is
 * `clientFromEnv`, kept as the priority so a pinned key stays pinned), then —
 * hosted customer only — the served `surface-config.json`, which is what makes
 * key rotation Studio + reload instead of a rebuild (29 D10).
 */
export async function clientFromConfig(): Promise<PublicClient | null> {
  const config = await resolveSurfaceConfig();
  if (config === null) return null;
  return createPublicClient({ baseUrl: config.baseUrl, publishableKey: config.publishableKey });
}
