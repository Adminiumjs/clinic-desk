/**
 * A row as the server sent it → a row as the app holds it (`types.ts`).
 *
 * The three databases answer the same column three ways: money is `45` or
 * `"45.00"`, a yes/no is `true` or `1` or `"t"`, a time is an ISO instant or a
 * bare wall time on the server's clock (SQLite and MySQL keep no zone), a date
 * is `2026-07-28` or the instant of its midnight. Everything the screens do
 * with a row assumes one spelling, so every row that arrives — from the desk's
 * session, the patients' key or the demo — goes through `normalise` first.
 *
 * The column kinds are written out here rather than read from the manifest:
 * the manifest's modules carry every label in eight languages, and none of
 * that belongs in the page. `rows.test.ts` holds this list to `manifest.json`.
 */
import { dateOf, instant } from "./venueTime.ts";
import type { TableRef, Tables } from "./types.ts";

type Kind = "money" | "bool" | "int" | "day" | "instant";

/** Every column that is not plain text, per table. */
export const COLUMN_KINDS: Readonly<Record<TableRef, Readonly<Record<string, Kind>>>> = {
  settings: {
    id: "int",
    slot_minutes: "int",
    booking_days: "int",
    min_notice_minutes: "int",
    new_patients_online: "bool",
    online_booking_on: "bool",
    no_show_minutes: "int",
    cancel_hours: "int",
    reminders_on: "bool",
    default_lead_hours: "int",
    kiosk_on: "bool",
  },
  opening_hours: { id: "int", open: "bool" },
  clinicians: { id: "int", bookable_online: "bool", active: "bool", position: "int" },
  visit_types: { id: "int", minutes: "int", fee: "money", bookable_online: "bool", new_patients_only: "bool", active: "bool", position: "int" },
  clinician_visit_types: { id: "int", clinician_id: "int", visit_type_id: "int" },
  clinician_hours: { id: "int", clinician_id: "int" },
  closures: { id: "int", clinician_id: "int", from_date: "day", to_date: "day", active: "bool", created_at: "instant" },
  faqs: { id: "int", position: "int", active: "bool" },
  patients: { id: "int", born_on: "day", remind_email: "bool", remind_lead_hours: "int", created_at: "instant" },
  registrations: { id: "int", born_on: "day", patient_id: "int", handled_at: "instant", created_at: "instant" },
  appointments: {
    id: "int",
    patient_id: "int",
    new_born_on: "day",
    clinician_id: "int",
    visit_type_id: "int",
    starts_at: "instant",
    minutes: "int",
    fee: "money",
    waived: "money",
    paid: "money",
    balance: "money",
    checked_in_at: "instant",
    roomed_at: "instant",
    seen_at: "instant",
    cancelled_at: "instant",
    late_cancel: "bool",
    recall_weeks: "int",
    created_at: "instant",
  },
  payments: { id: "int", appointment_id: "int", patient_id: "int", visit_type_id: "int", clinician_id: "int", amount: "money", paid_at: "instant", voided: "bool" },
  write_offs: { id: "int", appointment_id: "int", amount: "money", written_at: "instant" },
  check_notes: { id: "int", registration_id: "int", appointment_id: "int", created_at: "instant" },
  recalls: {
    id: "int",
    patient_id: "int",
    from_appointment_id: "int",
    visit_type_id: "int",
    clinician_id: "int",
    weeks: "int",
    due_on: "day",
    booked_appointment_id: "int",
    created_at: "instant",
  },
  waiting_list: { id: "int", patient_id: "int", visit_type_id: "int", clinician_id: "int", booked_appointment_id: "int", created_at: "instant" },
  messages: {
    id: "int",
    patient_id: "int",
    appointment_id: "int",
    recall_id: "int",
    closure_id: "int",
    payment_id: "int",
    due_at: "instant",
    sent_at: "instant",
    created_at: "instant",
  },
  day_closes: { id: "int", day: "day", no_shows_marked: "int", cash_expected: "money", cash_counted: "money", closed_at: "instant" },
};

/** Totals a row always has, even before the server has settled them. */
const ZERO_WHEN_EMPTY: Partial<Record<TableRef, readonly string[]>> = {
  appointments: ["waived", "paid", "balance"],
};

const TRUE = new Set<unknown>([true, 1, "1", "t", "true"]);

function value(kind: Kind, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === "") return null;
  switch (kind) {
    case "money":
    case "int": {
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "bool":
      return TRUE.has(raw);
    case "day":
      return dateOf(raw instanceof Date ? raw.toISOString() : String(raw));
    case "instant": {
      const ms = raw instanceof Date ? raw.getTime() : instant(String(raw));
      return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    }
  }
}

/** One row of `ref`, in the app's spelling. Unknown columns pass through untouched. */
export function normalise<R extends TableRef>(ref: R, raw: Record<string, unknown>): Tables[R] {
  const kinds = COLUMN_KINDS[ref];
  const out: Record<string, unknown> = { ...raw };
  /*
   * Adminium blanks the personal columns a reader may not see (`_masked`
   * names them). An address stays empty, so nothing is mailed to it by the
   * desk and the outbox finds the patient's own; any other masked text reads
   * as nothing rather than the word "null" on a screen, or a crash where the
   * desk expects a string.
   */
  const masked = Array.isArray(raw["_masked"]) ? (raw["_masked"] as unknown[]).filter((c): c is string => typeof c === "string") : [];
  for (const column of masked) {
    if (kinds[column] !== undefined) continue;
    const mailbox = column.endsWith("email") || column === "to_address";
    out[column] = mailbox ? null : "";
  }
  delete out["_masked"];
  for (const [column, kind] of Object.entries(kinds)) {
    if (column in raw) out[column] = value(kind, raw[column]);
  }
  for (const column of ZERO_WHEN_EMPTY[ref] ?? []) {
    if (out[column] === null || out[column] === undefined) out[column] = 0;
  }
  return out as unknown as Tables[R];
}

export function normaliseAll<R extends TableRef>(ref: R, rows: readonly Record<string, unknown>[]): Tables[R][] {
  return rows.map((row) => normalise(ref, row));
}
