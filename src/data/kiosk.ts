/**
 * The arrivals kiosk's door: the tablet in the waiting room where a patient
 * types their date of birth and mobile and checks in for today's visit.
 *
 * The tablet is signed in to Adminium as someone holding the kiosk role, a
 * role that may read no table at all. Everything it does goes through the
 * kiosk's own browser key instead, which opens only beside that sign-in and
 * only these few doors: find a person (their first name, nothing more), see
 * whether today's visit is booked or already begun, check it in from an hour
 * before its time, and — once they are in — say when and with whom.
 *
 * The port speaks in plain outcomes, never in the server's codes: a screen
 * reads "too early, your visit is at 11:15", "switched off", "signed out" and
 * shows the sentence for it. The same port runs over the demo's database
 * (`demo/kiosk.ts`), raising the server's own codes, so both builds are told
 * apart only by where the rows live.
 */
import type { PublicClient, PublicConfig } from "@adminiumjs/public-client";

import type { AppointmentStatus, Day, Instant } from "./types.ts";

// ── the port ───────────────────────────────────────────────────────────────

/** Today's visit of the person found, as the kiosk may see it: which one, and whether it has begun. */
export interface KioskVisit {
  id: string;
  status: AppointmentStatus;
}

/** A visit already begun today: its time and who it is with (read only once the person is in). */
export interface KioskBegun {
  id: string;
  starts_at: Instant;
  clinician_id: string | null;
}

export interface KioskClinician {
  id: string;
  short_name: string;
}

/** The practice's name and letters, for the brand at the top. */
export interface KioskPractice {
  name: string;
  mark: string;
}

/**
 * What the kiosk can ask. Each call throws a {@link KioskError} when it is
 * refused, never a transport's own error.
 */
export interface KioskPort {
  /** The practice's name and letters, or null when the kiosk's key cannot read them. */
  practice(): Promise<KioskPractice | null>;
  /** Resolves when the kiosk is on and signed in; throws with why it is not. */
  probe(): Promise<void>;
  /** Find the person by mobile and date of birth: their name, or null when nobody (or more than one) matches. */
  claim(mobile: string, bornOn: Day): Promise<{ name: string } | null>;
  /** When the person found stops being found (epoch ms), or null when nobody is. */
  expiresAt(): number | null;
  /** Today's visits of the person found that are booked or already begun. */
  visits(): Promise<KioskVisit[]>;
  /** Check one visit in. */
  checkIn(id: string): Promise<void>;
  /** Today's visits of the person found that have begun, with their time and clinician. */
  begun(): Promise<KioskBegun[]>;
  clinicians(): Promise<KioskClinician[]>;
  /** Forget the person found, here and on the server. */
  forget(): void;
  /** "Staff": leave the kiosk (signed out, to the sign-in page). */
  leave(): Promise<void>;
}

/**
 * Why a call was refused, in the kiosk's terms.
 *
 *   off        — the practice switched the kiosk off
 *   signedOut  — the tablet's sign-in has ended (or never had the kiosk role)
 *   gone       — the kiosk's key or its doors are not there (removed, the app off)
 *   busy       — too many tries in a minute
 *   offline    — the server could not be reached
 *   tooEarly   — more than an hour before the visit: `at` and `from` say when
 *   missed     — the visit was not there to check in (another tablet, the desk)
 */
export type KioskStop = "off" | "signedOut" | "gone" | "busy" | "offline" | "tooEarly" | "missed";

export class KioskError extends Error {
  readonly stop: KioskStop;
  readonly at: Instant | null;
  readonly from: Instant | null;
  constructor(stop: KioskStop, message: string, times: { at: Instant; from: Instant } | null = null) {
    super(message);
    this.name = "KioskError";
    this.stop = stop;
    this.at = times?.at ?? null;
    this.from = times?.from ?? null;
  }
}

/** The server's refusal codes, as the kiosk hears them. Anything else is "not working right now". */
const STOPS: Record<string, KioskStop> = {
  PUBLIC_KEY_OFF: "off",
  PUBLIC_STAFF_REQUIRED: "signedOut",
  PUBLIC_RATE_LIMITED: "busy",
  PUBLIC_NETWORK_UNAVAILABLE: "offline",
  PUBLIC_UPSTREAM_UNAVAILABLE: "offline",
  PUBLIC_TOO_EARLY: "tooEarly",
  PUBLIC_REF_NOT_FOUND: "missed",
};

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * Any refusal as a {@link KioskError}. Reads the code by shape rather than by
 * class, so the demo (which raises the same codes) and the public client land
 * in the same place — and so this file never pulls the client into a bundle
 * that has no use for it.
 */
export function kioskErrorOf(error: unknown): KioskError {
  if (error instanceof KioskError) return error;
  const e = (error ?? {}) as { code?: unknown; message?: unknown; params?: unknown; tooEarly?: unknown };
  const code = text(e.code) ?? "";
  const message = text(e.message) ?? code;
  const stop = STOPS[code] ?? "gone";
  if (stop === "tooEarly") {
    // The client reads the refusal's two times as `tooEarly`; a plain `params` carries the same.
    const times = (e.tooEarly ?? e.params ?? {}) as { at?: unknown; from?: unknown };
    const at = text(times.at);
    const from = text(times.from);
    // A refusal that names no time cannot say when to come back: it is a miss, as the 404 is.
    return at === null || from === null ? new KioskError("missed", message) : new KioskError("tooEarly", message, { at, from });
  }
  return new KioskError(stop, message);
}

// ── the port in use: where the port lives, and the whole check-in ──────────

let port: KioskPort | null = null;

/** Set once at boot: the public client's port on a real tablet, the demo's in the demo. */
export function setKioskPort(next: KioskPort | null): void {
  port = next;
}
export const kioskPort = (): KioskPort | null => port;

/** What the screen shows after "Check in". */
export type KioskOutcome =
  | { kind: "done"; firstName: string; at: Instant | null; clinician: string | null }
  | { kind: "notfound" }
  | { kind: "already" }
  | { kind: "early"; at: Instant; from: Instant }
  | { kind: "off" }
  | { kind: "signedOut" }
  | { kind: "gone" }
  | { kind: "busy" }
  | { kind: "offline" };

/** A stop that ends the check-in, as its outcome (a miss is the visit not being there). */
export function outcomeOfStop(error: KioskError): KioskOutcome {
  switch (error.stop) {
    case "tooEarly":
      return error.at !== null && error.from !== null ? { kind: "early", at: error.at, from: error.from } : { kind: "notfound" };
    case "missed":
      return { kind: "notfound" };
    default:
      return { kind: error.stop };
  }
}

/**
 * How long before its end a found person is found again before the check-in.
 * The server keeps a kiosk's claim for three minutes; someone who took their
 * time between the claim and the check-in would otherwise present an ended
 * session, which reads exactly like "no visit for you".
 */
export const REFIND_MARGIN_MS = 30_000;

/** The greeting's name: the first word of the person's name. */
export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

/**
 * The whole check-in: find the person, pick today's booked visit, check it in,
 * then read when and with whom. Every refusal becomes an outcome; the person
 * found is forgotten at the end whatever happened, so the next person at the
 * tablet starts from nobody.
 */
export async function runCheckIn(p: KioskPort, person: { mobile: string; bornOn: Day }, now: () => number): Promise<KioskOutcome> {
  try {
    // A fresh find for every press: the details may have changed since the last one.
    p.forget();
    const found = await p.claim(person.mobile, person.bornOn);
    if (found === null) return { kind: "notfound" };

    const visits = await p.visits();
    if (visits.length === 0) return { kind: "notfound" };
    const booked = visits.filter((v) => v.status === "booked");
    if (booked.length === 0) return { kind: "already" };

    let early: { at: Instant; from: Instant } | null = null;
    for (const visit of booked) {
      const ends = p.expiresAt();
      if (ends === null || ends - now() < REFIND_MARGIN_MS) {
        const again = await p.claim(person.mobile, person.bornOn);
        if (again === null) return { kind: "notfound" };
      }
      try {
        await p.checkIn(visit.id);
      } catch (error) {
        const stop = kioskErrorOf(error);
        // Too early for this one — a later booked visit today may still be in its hour.
        if (stop.stop === "tooEarly" && stop.at !== null && stop.from !== null) {
          if (early === null || Date.parse(stop.at) < Date.parse(early.at)) early = { at: stop.at, from: stop.from };
          continue;
        }
        if (stop.stop === "missed") continue;
        throw stop;
      }
      return await thanks(p, visit.id, firstNameOf(found.name));
    }
    if (early !== null) return { kind: "early", ...early };

    // Every check-in missed: another tablet or the desk was a second ahead. Read once more to say which.
    const again = await p.visits();
    if (again.length > 0 && !again.some((v) => v.status === "booked")) return { kind: "already" };
    return { kind: "notfound" };
  } catch (error) {
    return outcomeOfStop(kioskErrorOf(error));
  } finally {
    p.forget();
  }
}

/** The thank-you: the time and clinician when they can be read. The check-in stands even when they cannot. */
async function thanks(p: KioskPort, id: string, firstName: string): Promise<KioskOutcome> {
  try {
    const [begun, clinicians] = await Promise.all([p.begun(), p.clinicians()]);
    const visit = begun.find((b) => b.id === id);
    const who = visit?.clinician_id == null ? undefined : clinicians.find((c) => c.id === visit.clinician_id);
    return { kind: "done", firstName, at: visit?.starts_at ?? null, clinician: who?.short_name ?? null };
  } catch {
    return { kind: "done", firstName, at: null, clinician: null };
  }
}

// ── over the public client ─────────────────────────────────────────────────

interface Refs {
  identity: string;
  visits: string;
  begun: string;
  clinicians: string;
  settings: string | null;
}

/**
 * Which of the kiosk key's doors is which, by what each one does (the claim's
 * identity, the one that writes, the read that shows a time), not by the
 * names the install gave them.
 */
export function kioskRefsOf(config: PublicConfig, tables: Record<string, string>): Refs {
  const entries = Object.entries(config.refs);
  const of = (table: string) => {
    const real = tables[table] ?? table;
    return entries.filter(([ref]) => ref === real || ref.startsWith(`${real}_`));
  };
  const pick = (label: string, found: [string, unknown][]): string => {
    const ref = found[0]?.[0];
    if (ref === undefined) throw new KioskError("gone", `the kiosk's key has no ${label} endpoint`);
    return ref;
  };
  const appointments = of("appointments");
  const identity = config.claim?.ref ?? "";
  return {
    identity: pick("patient lookup", identity === "" ? [] : [[identity, null]]),
    visits: pick("check-in", appointments.filter(([, r]) => r.actions.includes("update"))),
    begun: pick("visit time", appointments.filter(([, r]) => !r.actions.includes("update") && r.expose.includes("starts_at"))),
    clinicians: pick("clinicians", of("clinicians").filter(([, r]) => r.actions.includes("read"))),
    settings: of("settings").find(([, r]) => r.actions.includes("read") && r.expose.includes("practice_name"))?.[0] ?? null,
  };
}

const id = (value: unknown): string | null => (typeof value === "number" || (typeof value === "string" && value !== "") ? String(value) : null);

/**
 * The kiosk over the public client.
 *
 * `client` makes a client: the client keeps its first answer to "what may this
 * key do" for good, even a refusal, so a tablet that started while the kiosk
 * was switched off makes a new one once it is back on.
 */
export function publicKioskPort(client: () => PublicClient, tables: Record<string, string>, leave: () => Promise<void>): KioskPort {
  let current = client();
  let refs: Promise<Refs> | null = null;
  let stale = false;
  const refsNow = (): Promise<Refs> => {
    if (refs === null) {
      // Made when it is next needed, not when the last one failed: by then the kiosk may be back on.
      if (stale) current = client();
      stale = false;
      const asked = current.config().then((config) => kioskRefsOf(config, tables));
      refs = asked;
      asked.catch(() => {
        // Ask again next time, on a new client: this one would repeat the refusal forever.
        if (refs === asked) {
          refs = null;
          stale = true;
        }
      });
    }
    return refs;
  };
  const guard = async <T>(run: (r: Refs) => Promise<T>): Promise<T> => {
    try {
      return await run(await refsNow());
    } catch (error) {
      throw kioskErrorOf(error);
    }
  };
  const all = async (ref: string) => (await current.list<Record<string, unknown>>(ref, { limit: 50 })).data;

  return {
    practice: () =>
      guard(async (r) => {
        if (r.settings === null) return null;
        const row = (await all(r.settings))[0];
        const name = text(row?.["practice_name"]);
        return name === null ? null : { name, mark: text(row?.["mark"]) ?? "" };
      }),
    // A read on the door every tablet has: it passes the key's switch and the sign-in, or says which stopped it.
    probe: () =>
      guard(async (r) => {
        await current.list(r.clinicians, { limit: 1 });
      }),
    claim: (mobile, bornOn) =>
      guard(async (r) => {
        if (!(await current.claim({ mobile, born_on: bornOn }))) return null;
        const row = (await current.list<{ name?: unknown }>(r.identity, { limit: 1 })).data[0];
        return { name: text(row?.name) ?? "" };
      }),
    expiresAt: () => current.session()?.expiresAt ?? null,
    visits: () =>
      guard(async (r) =>
        (await all(r.visits)).flatMap((row) => {
          const key = id(row["id"]);
          const status = text(row["status"]);
          return key === null || status === null ? [] : [{ id: key, status: status as AppointmentStatus }];
        }),
      ),
    checkIn: (visit) =>
      guard(async (r) => {
        await current.update(r.visits, visit, { status: "checked_in" });
      }),
    begun: () =>
      guard(async (r) =>
        (await all(r.begun)).flatMap((row) => {
          const key = id(row["id"]);
          const at = text(row["starts_at"]);
          return key === null || at === null ? [] : [{ id: key, starts_at: at, clinician_id: id(row["clinician_id"]) }];
        }),
      ),
    clinicians: () =>
      guard(async (r) =>
        (await all(r.clinicians)).flatMap((row) => {
          const key = id(row["id"]);
          return key === null ? [] : [{ id: key, short_name: text(row["short_name"]) ?? "" }];
        }),
      ),
    forget: () => {
      if (current.isClaimed()) void current.signOut().catch(() => undefined);
    },
    leave,
  };
}

/**
 * The kiosk on a tablet whose sign-in carries no kiosk key (the key was
 * withdrawn, or the app's install made none): every door says it is not
 * there, and "Staff" still leaves.
 */
export function unavailableKioskPort(leave: () => Promise<void>): KioskPort {
  const gone = () => Promise.reject(new KioskError("gone", "this sign-in carries no kiosk key"));
  return {
    practice: async () => null,
    probe: gone,
    claim: gone,
    expiresAt: () => null,
    visits: gone,
    checkIn: gone,
    begun: gone,
    clinicians: gone,
    forget: () => undefined,
    leave,
  };
}

/**
 * "Staff" on a real tablet: sign the kiosk out of Adminium and open Adminium's
 * own sign-in, which brings whoever signs in next back to this app — a
 * member of staff lands on the desk, the kiosk's own sign-in on the kiosk.
 * A sign-out the server refused (the sign-in had already ended) still goes to
 * the sign-in page: that is where the tablet needs to be either way.
 */
export async function staffSignOut(opts: { csrfToken: string | null; next: string; fetchImpl?: typeof fetch; go?: (url: string) => void }): Promise<void> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    await doFetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: opts.csrfToken === null ? {} : { "x-adminium-csrf": opts.csrfToken },
    });
  } catch {
    // Offline: the sign-in page will say so, and the sign-in is still this tablet's to end there.
  }
  const url = `/login?next=${encodeURIComponent(opts.next)}`;
  if (opts.go !== undefined) {
    opts.go(url);
    return;
  }
  // The whole window, when the desk is framed inside Adminium: signing out ends that page's sign-in too.
  (window.top ?? window).location.assign(url);
}
