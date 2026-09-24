/**
 * The patients' pages, through the practice's browser key.
 *
 * Every door is a public endpoint the install made from the manifest's
 * `publicAccess`, and the server keeps each one narrow: the catalogue reads,
 * free-or-taken times, finding a patient by mobile and date of birth, their
 * own visits and details once an emailed code is confirmed, booking,
 * moving and cancelling within the rules, registering, joining the
 * earlier-time list.
 *
 * The refs are found by what each endpoint does (the claim's identity, the
 * availability ref, which one writes), not by guessing the names the install
 * gave them, so a renamed table or an extra endpoint does not misroute a
 * patient's booking.
 */
import { PublicApiError, fromTenantLocal, type PublicClient, type PublicConfig } from "@adminiumjs/public-client";

import { normalise, normaliseAll } from "./rows.ts";
import {
  PortError,
  type Booked,
  type Catalogue,
  type CodeResult,
  type DayState,
  type OwnDetails,
  type OwnVisit,
  type PatientsPort,
  type SlotTime,
} from "./ports.ts";
import type { TableRef } from "./types.ts";

interface Refs {
  settings: string;
  hours: string;
  clinicians: string;
  names: string;
  visitTypes: string;
  links: string;
  faqs: string;
  closures: string;
  availability: string;
  identity: string;
  details: string;
  book: string;
  visits: string;
  register: string;
  /** The earlier-time list; null on a key that has none (the page then says it cannot join). */
  waitlist: string | null;
}

/** Which ref is which, by what each one does. Throws naming what is missing. */
export function refsOf(config: PublicConfig, tables: Record<string, string>): Refs {
  const entries = Object.entries(config.refs);
  const of = (table: TableRef) => entries.filter(([ref]) => ref === tables[table] || ref.startsWith(`${tables[table] ?? table}_`));
  const pick = (label: string, found: [string, unknown][]): string => {
    const ref = found[0]?.[0];
    if (ref === undefined) throw new PortError("PUBLIC_SETUP", `this page's key has no ${label} endpoint`);
    return ref;
  };
  const reads = (table: TableRef) => of(table).filter(([, r]) => r.actions.includes("read") && r.kind !== "availability");
  const clinicians = reads("clinicians");
  const identity = config.claim?.ref ?? "";
  return {
    settings: pick("settings", reads("settings")),
    hours: pick("opening hours", reads("opening_hours")),
    clinicians: pick("clinicians", clinicians.filter(([, r]) => r.expose.includes("bio"))),
    names: pick("clinicians' names", clinicians.filter(([, r]) => !r.expose.includes("bio"))),
    visitTypes: pick("visit types", reads("visit_types")),
    links: pick("clinicians' visit types", reads("clinician_visit_types")),
    faqs: pick("questions", reads("faqs")),
    closures: pick("closures", reads("closures")),
    availability: pick("availability", of("appointments").filter(([, r]) => r.kind === "availability")),
    identity: pick("patient lookup", identity === "" ? [] : [[identity, null]]),
    details: pick("patient details", of("patients").filter(([ref, r]) => ref !== identity && r.actions.includes("update"))),
    book: pick("booking", of("appointments").filter(([, r]) => r.actions.includes("create"))),
    visits: pick("own visits", of("appointments").filter(([, r]) => r.actions.includes("update"))),
    register: pick("registration", of("registrations").filter(([, r]) => r.actions.includes("create"))),
    waitlist: of("waiting_list").find(([, r]) => r.actions.includes("create"))?.[0] ?? null,
  };
}

/** A refusal in the page's terms: the server's code and what it named. */
function portError(error: unknown): PortError {
  if (error instanceof PortError) return error;
  if (error instanceof PublicApiError) return new PortError(error.code, error.message, (error.params ?? {}) as Record<string, unknown>);
  return new PortError("PUBLIC_NETWORK_UNAVAILABLE", error instanceof Error ? error.message : String(error));
}
const guard = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw portError(error);
  }
};

const VISIT_COLUMNS = ["id", "ref", "clinician_id", "visit_type_id", "starts_at", "minutes", "status", "late_cancel", "reason", "balance"] as const;
const ownVisit = (raw: Record<string, unknown>): OwnVisit => {
  const row = normalise("appointments", raw) as unknown as Record<string, unknown>;
  return Object.fromEntries(VISIT_COLUMNS.map((c) => [c, row[c] ?? null])) as unknown as OwnVisit;
};
const ownDetails = (raw: Record<string, unknown>): OwnDetails => {
  const row = normalise("patients", raw);
  return { name: row.name, email: row.email ?? null, mobile: row.mobile, remind_email: row.remind_email, remind_lead_hours: row.remind_lead_hours };
};

export async function publicPatientsPort(client: PublicClient, tables: Record<string, string>): Promise<PatientsPort> {
  const config = await guard(() => client.config());
  const refs = refsOf(config, tables);
  const zone = config.timezone;
  /** The catalogue is read once a visit to the page. */
  let catalogue: Promise<Catalogue> | null = null;

  const listAll = async <R extends TableRef>(table: R, ref: string) =>
    normaliseAll(table, (await client.list<Record<string, unknown>>(ref, { limit: 200 })).data);

  return {
    timeZone: () => zone,

    catalogue() {
      catalogue ??= guard(async () => {
        const [settings, hours, clinicians, names, visitTypes, links, faqs, closures] = await Promise.all([
          listAll("settings", refs.settings),
          listAll("opening_hours", refs.hours),
          listAll("clinicians", refs.clinicians),
          listAll("clinicians", refs.names),
          listAll("visit_types", refs.visitTypes),
          listAll("clinician_visit_types", refs.links),
          listAll("faqs", refs.faqs),
          listAll("closures", refs.closures),
        ]);
        // These entries serve only active (and bookable) rows and leave those
        // columns out of the reply: what they return is, by that filter, active.
        const served = <T,>(rows: T[], flags: Record<string, true>): T[] =>
          rows.map((row) => {
            const out = { ...row } as Record<string, unknown>;
            for (const [column, value] of Object.entries(flags)) if (out[column] === undefined) out[column] = value;
            return out as T;
          });
        return {
          settings: settings[0] ?? null,
          hours,
          clinicians: served(clinicians, { active: true, bookable_online: true }),
          names,
          visitTypes: served(visitTypes, { active: true, bookable_online: true }),
          links,
          faqs: served(faqs, { active: true }),
          closures: served(closures, { active: true }),
        };
      });
      catalogue.catch(() => {
        catalogue = null;
      });
      return catalogue;
    },

    times: (query) =>
      guard(async (): Promise<SlotTime[]> =>
        client.bookingTimes(refs.availability, {
          kind: String(query.kind),
          ...(query.resource === undefined ? {} : { resource: String(query.resource) }),
          ...(query.exclude === undefined ? {} : { exclude: String(query.exclude) }),
          date: query.date,
        }),
      ),

    days: (query) =>
      guard(async (): Promise<DayState[]> =>
        client.bookingDays(refs.availability, {
          kind: String(query.kind),
          ...(query.resource === undefined ? {} : { resource: String(query.resource) }),
          ...(query.exclude === undefined ? {} : { exclude: String(query.exclude) }),
          from: query.from,
          days: query.days,
        }),
      ),

    find: (mobile, bornOn) =>
      guard(async () => {
        const matched = await client.claim({ mobile, born_on: bornOn });
        if (!matched) return null;
        const found = await client.list<{ name?: string }>(refs.identity, { limit: 1 });
        return { name: found.data[0]?.name ?? "" };
      }),

    level: () => client.session()?.level ?? null,

    requestCode: (request) => guard(() => client.requestCode(request)),

    verifyCode: (code, purpose = "verify") =>
      guard(async (): Promise<CodeResult> => {
        const result = await client.verifyCode({ purpose, code });
        return result.ok ? { ok: true, level: result.level, ended: result.ended } : { ok: false, triesLeft: result.triesLeft };
      }),

    myDetails: () =>
      guard(async () => {
        const found = await client.list<Record<string, unknown>>(refs.details, { limit: 1 });
        const row = found.data[0];
        if (row === undefined) throw new PortError("PUBLIC_CLAIM_LEVEL", "no details for this session");
        return ownDetails(row);
      }),

    savePrefs: (prefs) =>
      guard(async () => {
        const found = await client.list<Record<string, unknown>>(refs.details, { limit: 1 });
        const id = found.data[0]?.["id"];
        const saved = await client.update<Record<string, unknown>>(refs.details, String(id ?? ""), prefs);
        return ownDetails({ ...found.data[0], ...saved });
      }),

    // Newest first, sorted here: the entry declares no order a caller may ask for.
    myVisits: () =>
      guard(async () =>
        (await client.list<Record<string, unknown>>(refs.visits, { limit: 200 })).data.map(ownVisit).sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
      ),

    book: (visit) =>
      guard(async (): Promise<Booked> => {
        const values: Record<string, unknown> = {
          visit_type_id: visit.visit_type_id,
          clinician_id: visit.clinician_id,
          starts_at: visit.starts_at,
          reason: visit.reason,
          desk_note: visit.desk_note,
          language: visit.language,
        };
        if (visit.newPatient !== undefined) {
          values["new_name"] = visit.newPatient.name;
          values["new_born_on"] = visit.newPatient.born_on;
          values["new_mobile"] = visit.newPatient.mobile;
          values["new_email"] = visit.newPatient.email;
        }
        const row = normalise("appointments", await client.create<Record<string, unknown>>(refs.book, values));
        return { ref: row.ref, starts_at: row.starts_at, minutes: row.minutes, clinician_id: row.clinician_id, status: row.status };
      }),

    reschedule: (id, startsAt) => guard(async () => ownVisit(await client.update<Record<string, unknown>>(refs.visits, String(id), { starts_at: startsAt }))),

    cancel: (id) => guard(async () => ownVisit(await client.update<Record<string, unknown>>(refs.visits, String(id), { status: "cancelled" }))),

    register: (person) =>
      guard(async () => {
        const row = await client.create<{ ref?: string }>(refs.register, { ...person });
        return { ref: row.ref ?? "" };
      }),

    joinWaitlist: (wish) =>
      guard(async () => {
        if (refs.waitlist === null) throw new PortError("PUBLIC_SETUP", "this page's key has no earlier-time list");
        const made = await client.createWithRank(refs.waitlist, { ...wish });
        return { rank: made.rank ?? null };
      }),

    signOut: () => guard(() => client.signOut()),
  };
}

/** The instant a patient's chosen day and time are, on the practice's clock. */
export function instantOf(day: string, hhmm: string, zone: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return fromTenantLocal(day, h * 60 + m, zone);
}
