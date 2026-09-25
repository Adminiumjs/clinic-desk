/**
 * The demo's practice: every table in memory, and the rules Adminium keeps
 * applied to every write, so the demo behaves as a real install does.
 *
 * A real practice's rules live on the server — a visit's reference, length
 * and fee, who booked it and when it was checked in, the balance that no
 * payment may overshoot, the booking rule. The website's demo has no server,
 * so this file keeps the same rules over the sample practice, answering the
 * same refusals with the same codes (`BOOKING_TAKEN`, `BALANCE_EXCEEDED`, a
 * unique `client_key` or day). Only the demo build contains it.
 */
import { COUNTED, type Appointment, type Id, type TableRef, type Tables } from "../data/types.ts";
import { venueDay } from "../data/venueTime.ts";
import { checkBooking, type Practice } from "./booking.ts";

export type Rows = { [R in TableRef]: Tables[R][] };
type Row = Record<string, unknown>;

/** Who is writing: the desk (a person) or a patient's page. */
export interface Writer {
  origin: "desk" | "patient";
  /** The signed-in person's name, for the stamps. */
  name: string | null;
}

/** A refusal in the server's words. */
export class DemoRefusal extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** What a column starts as when a create leaves it out (the manifest's defaults). */
const DEFAULTS: Partial<Record<TableRef, Row>> = {
  appointments: { status: "booked", channel: "desk", late_cancel: false, waived: 0, paid: 0, check_status: null },
  payments: { method: "card", voided: false },
  registrations: { status: "new" },
  recalls: { status: "due" },
  waiting_list: { status: "waiting", channel: "desk", part_of_day: "any" },
  messages: { status: "queued" },
  closures: { active: true },
  patients: { remind_email: true, remind_lead_hours: 24, status: "active" },
  day_closes: { no_shows_marked: 0, cash_expected: 0 },
};

/** Columns stamped with the moment a status becomes a value. */
const STAMP_TIME: Record<string, string> = { checked_in: "checked_in_at", roomed: "roomed_at", seen: "seen_at", cancelled: "cancelled_at" };
/** Columns stamped with who wrote the row. */
const STAMP_WHO: Partial<Record<TableRef, string>> = {
  appointments: "booked_by",
  payments: "taken_by",
  write_offs: "written_by",
  check_notes: "written_by",
  messages: "created_by",
  day_closes: "closed_by",
};
/** Moments set when the row is made. */
const MADE_AT: Partial<Record<TableRef, string[]>> = {
  appointments: ["created_at"],
  patients: ["created_at"],
  registrations: ["created_at"],
  closures: ["created_at"],
  check_notes: ["created_at"],
  recalls: ["created_at"],
  waiting_list: ["created_at"],
  messages: ["created_at"],
  payments: ["paid_at"],
  write_offs: ["written_at"],
  day_closes: ["closed_at"],
};

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** One change, as the live stream would announce it. */
export interface DemoChange {
  kind: "record.create" | "record.update" | "record.delete";
  id: Id;
}

export interface DemoDb {
  rows: Rows;
  now(): number;
  zone: string;
  insert<R extends TableRef>(ref: R, values: Row, writer: Writer): Tables[R];
  update<R extends TableRef>(ref: R, id: Id, patch: Row, writer: Writer): Tables[R];
  remove(ref: TableRef, id: Id): void;
  /** Recount a visit's paid / waived / balance from its payments and write-offs. */
  settle(appointmentId: Id): void;
  practice(): Practice;
  /** Listeners told of every change, with the row it touched (the demo's live updates). */
  subscribe(listener: (ref: TableRef, change: DemoChange) => void): () => void;
}

export function createDemoDb(start: Rows, now: () => number, zone: string, random: () => number = Math.random): DemoDb {
  const rows = structuredClone(start) as Rows;
  const listeners = new Set<(ref: TableRef, change: DemoChange) => void>();
  const tell = (ref: TableRef, kind: DemoChange["kind"], id: Id) => listeners.forEach((l) => l(ref, { kind, id }));
  const table = <R extends TableRef>(ref: R) => rows[ref] as unknown as Row[];
  const nextId = (ref: TableRef) => table(ref).reduce((max, r) => Math.max(max, Number(r["id"]) || 0), 0) + 1;
  const find = <R extends TableRef>(ref: R, id: Id) => table(ref).find((r) => r["id"] === id) as Row | undefined;
  const isoNow = () => new Date(now()).toISOString();

  const code = (ref: TableRef, prefix: string) => {
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      let out = prefix;
      for (let i = 0; i < 4; i += 1) out += CROCKFORD[Math.floor(random() * CROCKFORD.length)];
      if (!table(ref).some((r) => r["ref"] === out)) return out;
    }
    throw new DemoRefusal(409, "UNIQUE_VIOLATION", "No free reference left.", { column: "ref" });
  };

  const practice = (): Practice => ({
    settings: rows.settings[0] ?? null,
    hours: rows.opening_hours,
    clinicians: rows.clinicians,
    links: rows.clinician_visit_types,
    clinicianHours: rows.clinician_hours,
    closures: rows.closures,
    appointments: rows.appointments,
  });

  const unique = (ref: TableRef, column: string, value: unknown, own: Id | null) => {
    if (value === null || value === undefined || value === "") return;
    if (table(ref).some((r) => r[column] === value && r["id"] !== own)) {
      throw new DemoRefusal(409, "UNIQUE_VIOLATION", "A record with this value already exists.", { column });
    }
  };

  function guard(visit: Row, writer: Writer, exclude: Id | null, walkIn: boolean) {
    const verdict = checkBooking(
      practice(),
      { kind: visit["visit_type_id"] as Id, clinician: (visit["clinician_id"] as Id | null) ?? null, startsAt: String(visit["starts_at"]), minutes: Number(visit["minutes"]) },
      { zone, now: now(), isPublic: writer.origin === "patient", exclude, walkIn },
    );
    if (!verdict.ok) {
      const conflict = verdict.refusal === "BOOKING_TAKEN" || verdict.refusal === "BOOKING_CLOSED";
      throw new DemoRefusal(conflict ? 409 : 422, conflict ? verdict.refusal : "VALIDATION_FAILED", "That time cannot be booked.", {
        reason: verdict.refusal,
        column: verdict.refusal === "BOOKING_NOT_OFFERED" ? "clinician_id" : "starts_at",
      });
    }
    visit["clinician_id"] = verdict.clinician;
  }

  function settle(appointmentId: Id) {
    const visit = find("appointments", appointmentId);
    if (visit === undefined) return;
    const paid = rows.payments.filter((p) => p.appointment_id === appointmentId && !p.voided).reduce((s, p) => s + p.amount, 0);
    const waived = rows.write_offs.filter((w) => w.appointment_id === appointmentId).reduce((s, w) => s + w.amount, 0);
    const round = (n: number) => Math.round(n * 100) / 100;
    visit["paid"] = round(paid);
    visit["waived"] = round(waived);
    visit["balance"] = round(Number(visit["fee"] ?? 0) - waived - paid);
  }

  /** Refuse a money write that would take a visit's balance below zero (or further below). */
  function capped(appointmentId: Id, change: () => void, undo: () => void) {
    const visit = find("appointments", appointmentId);
    const before = Number(visit?.["balance"] ?? 0);
    change();
    settle(appointmentId);
    const after = Number(find("appointments", appointmentId)?.["balance"] ?? 0);
    if (after < 0 && after < before) {
      undo();
      settle(appointmentId);
      throw new DemoRefusal(409, "BALANCE_EXCEEDED", "That is more than the balance.", { column: "balance", balance: Math.max(0, before) });
    }
  }

  /** A payment's patient, kind of visit and clinician, copied from its visit whenever the link is written (`copy`, `always`). */
  function copyFromVisit(row: Row) {
    const visit = find("appointments", row["appointment_id"] as Id);
    row["patient_id"] = visit?.["patient_id"] ?? null;
    row["visit_type_id"] = visit?.["visit_type_id"] ?? null;
    row["clinician_id"] = visit?.["clinician_id"] ?? null;
  }

  function stampStatus(ref: TableRef, row: Row, next: Row, before: Row | null, writer: Writer) {
    if (ref === "appointments" && "status" in next && next["status"] !== before?.["status"]) {
      const at = STAMP_TIME[String(next["status"])];
      if (at !== undefined) row[at] = isoNow();
      if (next["status"] === "cancelled") {
        row["cancelled_by"] = writer.origin === "patient" ? "patient" : "desk";
        // A cancellation inside the window is flagged, never refused.
        const hours = rows.settings[0]?.cancel_hours ?? 24;
        const startsAt = Date.parse(String(before?.["starts_at"] ?? row["starts_at"]));
        if (startsAt - now() < hours * 3_600_000) row["late_cancel"] = true;
      }
    }
    if (ref === "registrations" && "status" in next && ["rang", "accepted", "declined", "duplicate"].includes(String(next["status"])) && next["status"] !== before?.["status"]) {
      row["handled_by"] = writer.name;
      row["handled_at"] = isoNow();
    }
    if (ref === "payments" && next["voided"] === true && before?.["voided"] !== true) row["voided_by"] = writer.name;
  }

  return {
    rows,
    now,
    zone,
    practice,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    settle,

    insert(ref, values, writer) {
      const row: Row = { ...DEFAULTS[ref], ...values, id: nextId(ref) };
      for (const column of MADE_AT[ref] ?? []) if (row[column] === undefined || row[column] === null) row[column] = isoNow();
      unique(ref, "client_key", row["client_key"], null);
      if (ref === "day_closes") unique(ref, "day", row["day"], null);
      if (ref === "appointments") {
        const type = rows.visit_types.find((t) => t.id === row["visit_type_id"]);
        row["minutes"] = type?.minutes ?? row["minutes"] ?? 15;
        if (row["fee"] === undefined || row["fee"] === null) row["fee"] = type?.fee ?? 0;
        row["ref"] = code(ref, "RH-");
        if (COUNTED.includes(String(row["status"]) as Appointment["status"])) guard(row, writer, null, row["status"] !== "booked");
        row["balance"] = Number(row["fee"] ?? 0);
      }
      if (ref === "registrations") row["ref"] = code(ref, "RG-");
      if (ref === "payments") copyFromVisit(row);
      const who = STAMP_WHO[ref];
      if (who !== undefined && writer.origin === "desk") row[who] = writer.name;
      stampStatus(ref, row, row, null, writer);
      if (ref === "payments" || ref === "write_offs") {
        const appointment = row["appointment_id"] as Id;
        capped(
          appointment,
          () => table(ref).push(row),
          () => table(ref).splice(table(ref).indexOf(row), 1),
        );
        // Like Adminium, no change is announced for the visit its balance moved:
        // a listener reads the visit again from the payment (`state/live.ts`).
      } else {
        table(ref).push(row);
      }
      tell(ref, "record.create", row["id"] as Id);
      return { ...row } as unknown as Tables[typeof ref];
    },

    update(ref, id, patch, writer) {
      const row = find(ref, id);
      if (row === undefined) throw new DemoRefusal(404, "NOT_FOUND", "That record is not there.");
      const before = { ...row };
      const next: Row = { ...patch };
      // What only Adminium writes on a message: when it went, and why it did not.
      if (ref === "messages") {
        for (const column of ["error", "sent_at"]) {
          if (column in next && next[column] !== before[column]) throw new DemoRefusal(409, "STATE_MOVE_REFUSED", `"${column}" is written by Adminium, not by hand.`, { column });
        }
      }
      if ("client_key" in next) unique(ref, "client_key", next["client_key"], id);
      if (ref === "appointments") {
        const moved = ["starts_at", "clinician_id", "visit_type_id"].some((c) => c in next && next[c] !== before[c]);
        const recounted = "status" in next && !COUNTED.includes(before["status"] as Appointment["status"]) && COUNTED.includes(next["status"] as Appointment["status"]);
        if (moved || recounted) {
          const trial: Row = { ...before, ...next };
          if ("visit_type_id" in next) trial["minutes"] = rows.visit_types.find((t) => t.id === trial["visit_type_id"])?.minutes ?? trial["minutes"];
          // A patient may not move a visit inside the cancellation window: they ring the desk.
          if (moved && writer.origin === "patient") {
            const hours = rows.settings[0]?.cancel_hours ?? 24;
            if (Date.parse(String(before["starts_at"])) - now() < hours * 3_600_000) throw new DemoRefusal(409, "PUBLIC_TOO_LATE", "Too late to change online.");
          }
          guard(trial, writer, id, false);
          next["clinician_id"] = trial["clinician_id"];
          if ("visit_type_id" in next) next["minutes"] = trial["minutes"];
        }
      }
      stampStatus(ref, row, next, before, writer);
      Object.assign(row, next);
      if (ref === "payments" && "appointment_id" in next) copyFromVisit(row);
      if (ref === "payments" && "voided" in next) settle(row["appointment_id"] as Id);
      if (ref === "appointments" && ("fee" in next || "visit_type_id" in next)) settle(id);
      tell(ref, "record.update", id);
      return { ...row } as unknown as Tables[typeof ref];
    },

    remove(ref, id) {
      const list = table(ref);
      const at = list.findIndex((r) => r["id"] === id);
      if (at !== -1) {
        const [gone] = list.splice(at, 1);
        if ((ref === "payments" || ref === "write_offs") && gone !== undefined) settle(gone["appointment_id"] as Id);
      }
      tell(ref, "record.delete", id);
    },
  };
}

/** The practice's today, on its clock. */
export const todayIn = (db: DemoDb) => venueDay(db.now(), db.zone);

/** The longest lead a patient may choose: the scan looks no further ahead. */
const LONGEST_LEAD_HOURS = 48;

/**
 * What Adminium's once-a-minute reminder scan does, for the demo's clock: each
 * booked visit whose patient asked for reminders gets one at their own lead
 * before it (the practice's default when they chose none), once per start
 * time — a reminder already logged for that start is the reminder. In the demo
 * nothing leaves the browser, so it is logged as gone at once.
 */
export function scanReminders(db: DemoDb): number {
  const settings = db.rows.settings[0];
  if (settings === undefined || !settings.reminders_on) return 0;
  const now = db.now();
  let queued = 0;
  for (const visit of db.rows.appointments) {
    if (visit.status !== "booked") continue;
    const start = Date.parse(visit.starts_at);
    if (start <= now) continue;
    const patient = visit.patient_id === null ? undefined : db.rows.patients.find((p) => p.id === visit.patient_id);
    if (patient === undefined || !patient.remind_email || patient.email === null) continue;
    const lead = Math.min(patient.remind_lead_hours ?? settings.default_lead_hours, LONGEST_LEAD_HOURS);
    if (start - lead * 3_600_000 > now) continue;
    const done = db.rows.messages.some((m) => m.kind === "reminder" && m.appointment_id === visit.id && m.due_at !== null && Math.abs(Date.parse(m.due_at) - start) < 1000);
    if (done) continue;
    const at = new Date(now).toISOString();
    db.insert(
      "messages",
      { kind: "reminder", patient_id: patient.id, appointment_id: visit.id, to_address: patient.email, language: patient.language, status: "sent", due_at: visit.starts_at, sent_at: at },
      { origin: "desk", name: null },
    );
    queued += 1;
  }
  return queued;
}
