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
  type BookedToPay,
  type Catalogue,
  type CodeResult,
  type DayState,
  type OwnDetails,
  type OwnVisit,
  type PatientsPort,
  type SlotTime,
  type TextStanding,
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
  /** Booking a visit to pay for as it is booked; null on a key that has none. */
  payBook: string | null;
  /** The visit being paid for as it was booked, while it waits; null on a key that has none. */
  held: string | null;
  visits: string;
  register: string;
  /** The earlier-time list; null on a key that has none (the page then says it cannot join). */
  waitlist: string | null;
  /** "Remind me by text" switched off: the box that means no; null on a key that has none (an older install). */
  textStop: string | null;
}

/** "Remind me by text" switched off: a change of the patient's own row that shows nothing of it but its key. */
const isTextStop = (r: { expose: readonly string[]; writable?: readonly string[] }): boolean => !r.expose.includes("email") && (r.writable ?? []).includes("texts_off");

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
    // Two doors change the patient's own row: their details (they read the email) and "Remind me by text" switched off.
    details: pick("patient details", of("patients").filter(([ref, r]) => ref !== identity && r.actions.includes("update") && !isTextStop(r))),
    // Two doors book a visit: as ever (its reply names no fee), and paying as it is booked (its reply names the fee).
    book: pick("booking", of("appointments").filter(([, r]) => r.actions.includes("create") && !r.expose.includes("fee"))),
    payBook: of("appointments").find(([, r]) => r.actions.includes("create") && r.expose.includes("fee"))?.[0] ?? null,
    // Two doors read and change a patient's visits: all of them once verified (they show a late cancel), and the one
    // they are paying for as they book, while it waits.
    held: of("appointments").find(([, r]) => r.actions.includes("update") && !r.expose.includes("late_cancel"))?.[0] ?? null,
    visits: pick("own visits", of("appointments").filter(([, r]) => r.actions.includes("update") && r.expose.includes("late_cancel"))),
    register: pick("registration", of("registrations").filter(([, r]) => r.actions.includes("create"))),
    waitlist: of("waiting_list").find(([, r]) => r.actions.includes("create"))?.[0] ?? null,
    textStop: of("patients").find(([ref, r]) => ref !== identity && r.actions.includes("update") && isTextStop(r))?.[0] ?? null,
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

const VISIT_COLUMNS = ["id", "ref", "clinician_id", "visit_type_id", "starts_at", "minutes", "status", "late_cancel", "reason", "balance", "paid", "refunded"] as const;
const ownVisit = (raw: Record<string, unknown>): OwnVisit => {
  const row = normalise("appointments", raw) as unknown as Record<string, unknown>;
  return Object.fromEntries(VISIT_COLUMNS.map((c) => [c, row[c] ?? null])) as unknown as OwnVisit;
};
const ownDetails = (raw: Record<string, unknown>): OwnDetails => {
  const row = normalise("patients", raw);
  return { name: row.name, email: row.email ?? null, mobile: row.mobile, remind_email: row.remind_email, remind_lead_hours: row.remind_lead_hours };
};

/**
 * Adminium's texts reads for the patients' pages (`client.texts`, from the
 * public client that ships with Adminium 0.3.76). An older client in hand
 * lacks them, so the same two routes are asked directly, with the page's key
 * and its session, as the client would.
 */
interface TextsReads {
  ready(): Promise<boolean>;
  standing(): Promise<TextStanding>;
}

export interface DirectTexts {
  baseUrl: string;
  publishableKey: string;
  fetch?: typeof fetch;
}

function textsReads(client: PublicClient, direct: DirectTexts | undefined): TextsReads | null {
  const own = (client as unknown as { texts?: { ready(): Promise<boolean>; standing(): Promise<TextStanding & { marketing?: unknown }> } }).texts;
  if (own !== undefined) return { ready: () => own.ready(), standing: async () => standingOf(await own.standing()) };
  if (direct === undefined) return null;
  const ask = async <T,>(path: string): Promise<T> => {
    const token = client.session()?.token;
    const res = await (direct.fetch ?? fetch)(`${direct.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${direct.publishableKey}`, ...(token === undefined ? {} : { "x-adminium-public-session": token }) },
    });
    const body = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string; message?: string } } | null;
    if (!res.ok || body?.data === undefined) throw new PortError(body?.error?.code ?? "PUBLIC_NETWORK_UNAVAILABLE", body?.error?.message ?? `HTTP ${String(res.status)}`);
    return body.data;
  };
  return {
    ready: async () => (await ask<{ ready: boolean }>("/api/v1/public/texts")).ready === true,
    standing: async () => standingOf(await ask<TextStanding>("/api/v1/public/texts/standing")),
  };
}

/** The service purpose and the stop, as the page reads them: the practice sends no offers. */
const standingOf = (raw: TextStanding): TextStanding => ({ ready: raw.ready === true, masked: raw.masked ?? null, service: raw.service, stopped: raw.stopped ?? null });

export async function publicPatientsPort(client: PublicClient, tables: Record<string, string>, direct?: DirectTexts): Promise<PatientsPort> {
  const config = await guard(() => client.config());
  const refs = refsOf(config, tables);
  const texts = textsReads(client, direct);
  const zone = config.timezone;
  /** The catalogue is read once a visit to the page. */
  let catalogue: Promise<Catalogue> | null = null;

  const listAll = async <R extends TableRef>(table: R, ref: string) =>
    normaliseAll(table, (await client.list<Record<string, unknown>>(ref, { limit: 200 })).data);

  /*
   * A write answers only the columns its endpoint shows, and the page holds
   * the visit this returns in place of the one it had. So the reply is laid
   * over the visit as the read gives it: a column the write's answer does not
   * carry keeps its value instead of reading as nothing. (`savePrefs` below
   * does the same for the patient's details.)
   */
  const changeVisit = async (id: number | string, values: Record<string, unknown>): Promise<OwnVisit> => {
    const reply = await client.update<Record<string, unknown>>(refs.visits, String(id), values);
    const held = (await client.list<Record<string, unknown>>(refs.visits, { limit: 200 })).data.find((row) => String(row["id"]) === String(id));
    return ownVisit({ ...held, ...reply });
  };

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
        // Whether a text can go at all: asked only of a practice that sends them, and a failed ask draws no box.
        const textsReady = settings[0]?.texts_on === true && texts !== null ? await texts.ready().catch(() => false) : false;
        return {
          textsReady,
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
        // A time the server holds back for now ("paused") is not one to book: the page shows it taken.
        (
          await client.bookingTimes(refs.availability, {
            kind: String(query.kind),
            ...(query.resource === undefined ? {} : { resource: String(query.resource) }),
            ...(query.exclude === undefined ? {} : { exclude: String(query.exclude) }),
            date: query.date,
          })
        ).map((slot) => ({ ...slot, state: slot.state === "free" ? "free" : "full" })),
      ),

    // What the page reads of a day, and only that: a newer server says more of each day (its last bookable one).
    days: (query) =>
      guard(async (): Promise<DayState[]> =>
        (
          await client.bookingDays(refs.availability, {
            kind: String(query.kind),
            ...(query.resource === undefined ? {} : { resource: String(query.resource) }),
            ...(query.exclude === undefined ? {} : { exclude: String(query.exclude) }),
            from: query.from,
            days: query.days,
          })
        ).map((day) => ({ date: day.date, open: day.open, state: day.state })),
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
          // The box for texts goes only when ticked: an unticked box writes nothing.
          if (visit.newPatient.textsOk === true) values["texts_ok"] = true;
        }
        const row = normalise("appointments", await client.create<Record<string, unknown>>(refs.book, values));
        return { ref: row.ref, starts_at: row.starts_at, minutes: row.minutes, clinician_id: row.clinician_id, status: row.status };
      }),

    reschedule: (id, startsAt) => guard(() => changeVisit(id, { starts_at: startsAt })),

    cancel: (id) => guard(() => changeVisit(id, { status: "cancelled" })),

    register: (person) =>
      guard(async () => {
        const { texts_ok, ...rest } = person;
        const row = await client.create<{ ref?: string }>(refs.register, texts_ok === true ? { ...rest, texts_ok: true } : rest);
        return { ref: row.ref ?? "" };
      }),

    joinWaitlist: (wish) =>
      guard(async () => {
        if (refs.waitlist === null) throw new PortError("PUBLIC_SETUP", "this page's key has no earlier-time list");
        const made = await client.createWithRank(refs.waitlist, { ...wish });
        return { rank: made.rank ?? null };
      }),

    signOut: () => guard(() => client.signOut()),

    // ── visit texts ──
    myTextStanding: () =>
      guard(async () => {
        if (texts === null) throw new PortError("PUBLIC_SETUP", "this page cannot ask where a patient stands on texts");
        return texts.standing();
      }),

    setTexts: (on) =>
      guard(async () => {
        const found = await client.list<Record<string, unknown>>(refs.details, { limit: 1 });
        const id = String(found.data[0]?.["id"] ?? "");
        if (on) {
          // Their box, ticked afresh: unticked first when a past yes left it ticked, so the tick is a new answer.
          await client.update(refs.details, id, { remind_text: false, texts_off: false });
          await client.update(refs.details, id, { remind_text: true });
          return;
        }
        if (refs.textStop === null) throw new PortError("PUBLIC_SETUP", "this page's key takes no stop for texts");
        // Their no: the box that means no, ticked afresh.
        await client.update(refs.textStop, id, { remind_text: false, texts_off: false });
        await client.update(refs.textStop, id, { texts_off: true });
      }),

    // ── paying online ──
    // Only ever asked, never decided here: "Pay now" shows while the server says the practice takes payments online.
    payments: () =>
      guard(async () => {
        if (refs.payBook === null && refs.held === null) return { online: false, test: false };
        const answer = await client.payments.available();
        return { online: answer.online, test: answer.test === true };
      }),

    bookToPay: (visit) =>
      guard(async (): Promise<BookedToPay> => {
        if (refs.payBook === null) throw new PortError("PUBLIC_SETUP", "this page's key has no booking to pay for");
        const row = normalise(
          "appointments",
          await client.create<Record<string, unknown>>(refs.payBook, {
            visit_type_id: visit.visit_type_id,
            clinician_id: visit.clinician_id,
            starts_at: visit.starts_at,
            reason: visit.reason,
            desk_note: visit.desk_note,
            language: visit.language,
          }),
        );
        // The link to pay it, for the visit this page has just made and can read; none while the practice cannot take it.
        let payUrl: string | null = null;
        if (refs.held !== null) {
          try {
            payUrl = (await client.payments.start(refs.held, String(row.id))).payUrl;
          } catch (error) {
            if (!(error instanceof PublicApiError) || error.code !== "PUBLIC_PAY_REFUSED") throw error;
          }
        }
        return { id: row.id, ref: row.ref, starts_at: row.starts_at, minutes: row.minutes, clinician_id: row.clinician_id, status: row.status, fee: row.fee ?? 0, payUrl };
      }),

    held: (id) =>
      guard(async () => {
        if (refs.held === null) throw new PortError("PUBLIC_SETUP", "this page's key has no booking to pay for");
        const found = (await client.list<Record<string, unknown>>(refs.held, { limit: 50 })).data.find((row) => String(row["id"]) === String(id));
        // A visit the payment (or the desk) booked has left this read, which serves only one still waiting or gone.
        if (found === undefined) return "booked";
        return found["status"] === "lapsed" ? "lapsed" : "paying";
      }),

    settleHeld: (id, to) =>
      guard(async () => {
        if (refs.held === null) throw new PortError("PUBLIC_SETUP", "this page's key has no booking to pay for");
        await client.update(refs.held, String(id), { status: to });
      }),

    payLink: (id, of) =>
      guard(async () => {
        const ref = of === "held" ? refs.held : refs.visits;
        if (ref === null) throw new PortError("PUBLIC_SETUP", "this page's key has no booking to pay for");
        return (await client.payments.start(ref, String(id))).payUrl;
      }),

    payState: (id, of) =>
      guard(async () => {
        const ref = of === "held" ? refs.held : refs.visits;
        if (ref === null) throw new PortError("PUBLIC_SETUP", "this page's key has no booking to pay for");
        return (await client.payments.state(ref, String(id))).state;
      }),

    carrySession: () => client.session(),

    resumeSession: (carried) => {
      const held = carried as { token?: unknown; level?: unknown; expiresAt?: unknown } | null;
      if (held === null || typeof held !== "object" || typeof held.token !== "string" || typeof held.expiresAt !== "number") return;
      if (held.expiresAt <= Date.now()) return;
      client.adoptSession({ token: held.token, expiresAt: held.expiresAt, ...(held.level === "lookup" || held.level === "verified" ? { level: held.level } : {}) });
    },
  };
}

/** The instant a patient's chosen day and time are, on the practice's clock. */
export function instantOf(day: string, hhmm: string, zone: string): string {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return fromTenantLocal(day, h * 60 + m, zone);
}
