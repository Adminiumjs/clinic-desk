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

import type { Appointment, Clinician, Now, VisitType, VisitTypeId, VisitStatus } from "./types.ts";
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

export interface Snapshot {
  visitTypes: VisitType[];
  clinicians: Clinician[];
  appointments: Appointment[];
  now: Now;
}

/** What `Find` needs, and the columns the scope must expose for it. */
const REQUIRED = {
  visitTypes: ["id", "name", "minutes", "fee", "color"],
  clinicians: ["id", "name", "initials", "role", "color"],
  appointments: ["clinician_id", "visit_type_id", "starts_at", "minutes"],
};

/**
 * Fetch the read-set and map it into the app's shapes.
 *
 * Returns `null` on ANY failure so the caller falls back to demo mode
 * structurally rather than in a catch — the marketplace demos are static clones
 * with no server and must keep working byte-identically.
 */
export async function loadSnapshot(client: PublicClient): Promise<Snapshot | null> {
  try {
    /*
     * Fail at BOOT with a legible message rather than at render with a 403 on
     * a screen nobody was looking at. An operator can narrow a scope at any
     * time; this turns that into a startup error naming the missing column.
     */
    await client.assertRefs(REQUIRED);

    const { timezone } = await client.config();
    const [types, clinicians, appts] = await Promise.all([
      client.list<WireVisitType>("visitTypes", { limit: 50 }),
      client.list<WireClinician>("clinicians", { limit: 50 }),
      client.list<WireAppointment>("appointments", { limit: 200 }),
    ]);

    const typeById = new Map<number, VisitTypeId>();
    const visitTypes: VisitType[] = [];
    for (const row of types.data) {
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
    const staff: Clinician[] = clinicians.data.map((row) => {
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
    for (const row of appts.data) {
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
      visitTypes,
      clinicians: staff,
      appointments,
      now: { date: toTenantDay(nowIso, timezone), minutes: toTenantMinutes(nowIso, timezone) },
    };
  } catch (error) {
    console.warn("[adminium] connected mode unavailable, using demo data:", error);
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
    baseUrl: import.meta.env["VITE_ADMINIUM_API_BASE_URL"] as string | undefined,
    publishableKey: import.meta.env["VITE_ADMINIUM_PUBLISHABLE_KEY"] as string | undefined,
  });
}
