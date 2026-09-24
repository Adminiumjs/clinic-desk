/**
 * The arrivals kiosk over the demo's in-memory practice.
 *
 * It keeps the rules the server keeps for the kiosk's key, read from the same
 * manifest entries the install makes its doors from: a person is found by
 * mobile and date of birth (exactly one match) for three minutes; they see
 * only today's visits that are booked or already begun; a visit checks in
 * only while it is still booked and no more than the entry's window ahead —
 * earlier, the refusal names the visit's time and when the window opens; the
 * practice's "Arrivals kiosk" switch stops every door. It raises the server's
 * own codes, so the screen reads them through the same mapping as on a real
 * tablet.
 */
import type { AppointmentStatus, Id } from "../data/types.ts";
import { kioskErrorOf, type KioskPort } from "../data/kiosk.ts";
import { venueDay } from "../data/venueTime.ts";
import { PUBLIC_ACCESS } from "../manifest/public.ts";
import type { DemoDb } from "./db.ts";

type Entry = Record<string, unknown> & { table: string; key?: string; methods: string[] };
const ENTRIES = PUBLIC_ACCESS as unknown as readonly Entry[];

const statusFilter = (entry: Entry | undefined): AppointmentStatus[] => {
  const filters = (entry?.["filters"] ?? []) as { column: string; op: string; value?: unknown }[];
  const found = filters.find((f) => f.column === "status" && f.op === "in");
  return (Array.isArray(found?.value) ? found.value : []) as AppointmentStatus[];
};

const CHECK_IN = ENTRIES.find((e) => e.key === "kiosk" && e.table === "appointments" && e.methods.includes("PATCH"));
const BEGUN = ENTRIES.find((e) => e.key === "kiosk" && e.table === "appointments" && !e.methods.includes("PATCH"));

/** The statuses the kiosk's visit read shows (booked … ready), as its entry filters them. */
export const KIOSK_VISIBLE = statusFilter(CHECK_IN);
/** The statuses of a visit already begun, as the after-check-in read filters them. */
export const KIOSK_BEGUN = statusFilter(BEGUN);
/** How many minutes before its time a visit may check in, as the entry's window says. */
export const KIOSK_WINDOW_MINUTES = Number(((CHECK_IN?.["writableWhen"] as { starts_at?: { within?: unknown } } | undefined)?.starts_at?.within) ?? 0);
/** How long a kiosk's found person stays found. */
export const KIOSK_SESSION_MS = 3 * 60_000;

/** A refusal shaped as the public client raises it. */
class Refused extends Error {
  readonly code: string;
  readonly params: Record<string, unknown>;
  constructor(code: string, params: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

export function demoKioskPort(db: DemoDb, leave: () => Promise<void>): KioskPort {
  let session: { patientId: Id; expiresAt: number } | null = null;

  /** The key's switch, read on every call as the server's gate reads it. */
  const gate = () => {
    if (db.rows.settings[0]?.kiosk_on !== true) throw new Refused("PUBLIC_KEY_OFF");
  };
  /** The person found, while their three minutes last. */
  const who = (): Id | null => {
    if (session === null || session.expiresAt <= db.now()) return null;
    return session.patientId;
  };
  /** Today's visits of the person found, in the statuses a read shows. */
  const todays = (statuses: readonly AppointmentStatus[]) => {
    const patient = who();
    if (patient === null) return [];
    const day = venueDay(db.now(), db.zone);
    return db.rows.appointments
      .filter((a) => a.patient_id === patient && statuses.includes(a.status) && venueDay(Date.parse(a.starts_at), db.zone) === day)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  };

  /** Every refusal leaves as the kiosk's own error, as the public client's do through the same mapping. */
  const guard =
    <A extends unknown[], T>(run: (...args: A) => Promise<T>) =>
    async (...args: A): Promise<T> => {
      try {
        return await run(...args);
      } catch (error) {
        throw kioskErrorOf(error);
      }
    };

  return {
    async practice() {
      const s = db.rows.settings[0];
      return s === undefined ? null : { name: s.practice_name, mark: s.mark };
    },
    probe: guard(async () => {
      gate();
    }),
    claim: guard(async (mobile: string, bornOn: string) => {
      gate();
      const digits = (s: string) => s.replace(/\D/g, "");
      const found = db.rows.patients.filter((p) => digits(p.mobile) === digits(mobile) && p.born_on === bornOn);
      if (found.length !== 1) {
        session = null;
        return null;
      }
      session = { patientId: found[0]!.id, expiresAt: db.now() + KIOSK_SESSION_MS };
      return { name: found[0]!.name };
    }),
    expiresAt: () => (who() === null ? null : session!.expiresAt),
    visits: guard(async () => {
      gate();
      return todays(KIOSK_VISIBLE).map((a) => ({ id: String(a.id), status: a.status }));
    }),
    checkIn: guard(async (id: string) => {
      gate();
      // Only a row the read reaches, and only while it is booked; any other miss is the one "no such record".
      const visit = todays(KIOSK_VISIBLE).find((a) => String(a.id) === id);
      if (visit === undefined || visit.status !== "booked") throw new Refused("PUBLIC_REF_NOT_FOUND");
      const at = Date.parse(visit.starts_at);
      const window = KIOSK_WINDOW_MINUTES * 60_000;
      if (at - db.now() > window) {
        throw new Refused("PUBLIC_TOO_EARLY", { at: visit.starts_at, from: new Date(at - window).toISOString() });
      }
      db.update("appointments", visit.id, { status: "checked_in" }, { origin: "patient", name: null });
    }),
    begun: guard(async () => {
      gate();
      return todays(KIOSK_BEGUN).map((a) => ({ id: String(a.id), starts_at: a.starts_at, clinician_id: a.clinician_id === null ? null : String(a.clinician_id) }));
    }),
    clinicians: guard(async () => {
      gate();
      return db.rows.clinicians.map((c) => ({ id: String(c.id), short_name: c.short_name }));
    }),
    forget() {
      session = null;
    },
    leave,
  };
}
