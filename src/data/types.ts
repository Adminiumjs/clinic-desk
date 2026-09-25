/**
 * The practice's data, as the desk and the patients' pages hold it.
 *
 * Each row is a row of one of the app's tables, in the table's own column
 * names, so the store, the data sources and the server all say the same
 * thing: `starts_at`, not a translation of it. Three conventions hold
 * everywhere:
 *
 *   - keys are numbers (the tables number their own rows);
 *   - an INSTANT is an ISO string in UTC (`2026-07-28T08:15:00.000Z`) and a
 *     person reads it on the practice's clock (`lib/clock.ts`);
 *   - a CALENDAR DAY is `YYYY-MM-DD` on the practice's calendar, never an
 *     instant: a closure "on Friday" is Friday wherever the reader is.
 *
 * Money is a number in the practice's currency. There is no clinical record
 * here on purpose: a visit carries one line saying what it is for and a note
 * for the desk, and allergies are the one clinical-adjacent fact a front desk
 * keeps.
 */

export type Id = number;
/** An instant, as an ISO string in UTC. */
export type Instant = string;
/** A calendar day on the practice's calendar, `YYYY-MM-DD`. */
export type Day = string;
/** A wall time on the practice's clock, `HH:MM`. */
export type Hhmm = string;

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// ── reference data ──────────────────────────────────────────────────────────

export interface Settings {
  id: Id;
  practice_name: string;
  mark: string;
  address: string;
  phone: string;
  email: string | null;
  intro: string | null;
  directions: string | null;
  map_link: string | null;
  entrance_photo: string | null;
  pay_note: string | null;
  insurer_note: string | null;
  privacy_link: string | null;
  currency: string;
  language: string;
  slot_minutes: number;
  booking_days: number;
  min_notice_minutes: number;
  new_patients_online: boolean;
  online_booking_on: boolean;
  no_show_minutes: number;
  cancel_hours: number;
  reminders_on: boolean;
  default_lead_hours: number;
  kiosk_on: boolean;
}

export interface OpeningHours {
  id: Id;
  weekday: Weekday;
  open: boolean;
  opens: Hhmm;
  closes: Hhmm;
  break_start: Hhmm | null;
  break_end: Hhmm | null;
}

export interface Clinician {
  id: Id;
  name: string;
  short_name: string;
  role_label: string;
  color: string;
  photo: string | null;
  bio: string | null;
  bookable_online: boolean;
  active: boolean;
  position: number;
  staff_email: string | null;
}

export interface VisitType {
  id: Id;
  name: string;
  short_name: string;
  minutes: number;
  fee: number;
  color: string;
  icon: string;
  bookable_online: boolean;
  new_patients_only: boolean;
  active: boolean;
  position: number;
}

export interface ClinicianVisitType {
  id: Id;
  clinician_id: Id;
  visit_type_id: Id;
}

export interface ClinicianHours {
  id: Id;
  clinician_id: Id;
  weekday: Weekday;
  opens: Hhmm;
  closes: Hhmm;
  break_start: Hhmm | null;
  break_end: Hhmm | null;
}

export interface Closure {
  id: Id;
  client_key: string | null;
  /** Null: the whole practice is shut. */
  clinician_id: Id | null;
  from_date: Day;
  to_date: Day;
  label: string;
  /** What the patients read ("The practice is closed for staff training that day."). */
  note: string | null;
  active: boolean;
  created_at: Instant | null;
}

export interface Faq {
  id: Id;
  question: string;
  answer: string;
  position: number;
  active: boolean;
}

// ── people and work ─────────────────────────────────────────────────────────

export interface Patient {
  id: Id;
  client_key: string | null;
  name: string;
  born_on: Day;
  mobile: string;
  email: string | null;
  address: string | null;
  emergency_contact: string | null;
  allergies_note: string | null;
  insurer: string | null;
  policy_ref: string | null;
  language: string | null;
  remind_email: boolean;
  remind_lead_hours: number;
  status: "active" | "archived";
  created_at: Instant | null;
}

export type RegistrationStatus = "new" | "rang" | "accepted" | "declined" | "duplicate";

export interface Registration {
  id: Id;
  ref: string;
  name: string;
  born_on: Day;
  mobile: string;
  email: string | null;
  address: string | null;
  emergency_contact: string | null;
  language: string | null;
  status: RegistrationStatus;
  patient_id: Id | null;
  outcome: string | null;
  note: string | null;
  handled_by: string | null;
  handled_at: Instant | null;
  created_at: Instant | null;
}

export type AppointmentStatus =
  | "booked"
  | "checked_in"
  | "roomed"
  | "with_clinician"
  | "ready"
  | "seen"
  | "no_show"
  | "cancelled";

/** The four statuses of someone in the building, in the order they move. */
export const IN_THE_BUILDING: readonly AppointmentStatus[] = ["checked_in", "roomed", "with_clinician", "ready"];
/** The statuses that hold a clinician's time (the server's booking rule counts the same). */
export const COUNTED: readonly AppointmentStatus[] = ["booked", "checked_in", "roomed", "with_clinician", "ready", "seen"];

export type Channel = "online" | "phone" | "desk" | "walk_in" | "waiting_list" | "recall";
export type CheckStatus = "to_check" | "rang" | "accepted" | "linked" | "declined";

export interface Appointment {
  id: Id;
  ref: string;
  patient_id: Id | null;
  /** A first visit's details, until the desk accepts it or links it to a patient. */
  new_name: string | null;
  new_born_on: Day | null;
  new_mobile: string | null;
  new_email: string | null;
  clinician_id: Id | null;
  visit_type_id: Id;
  starts_at: Instant;
  minutes: number;
  fee: number | null;
  waived: number;
  paid: number;
  balance: number;
  reason: string | null;
  desk_note: string | null;
  status: AppointmentStatus;
  channel: Channel;
  checked_in_at: Instant | null;
  roomed_at: Instant | null;
  seen_at: Instant | null;
  cancelled_at: Instant | null;
  late_cancel: boolean;
  cancelled_by: "patient" | "desk" | null;
  recall_weeks: number | null;
  language: string | null;
  booked_by: string | null;
  /** Null: not a first visit booked online. */
  check_status: CheckStatus | null;
  client_key: string | null;
  created_at: Instant | null;
}

export type PayMethod = "card" | "cash" | "transfer";

export interface Payment {
  id: Id;
  appointment_id: Id;
  /** Copied from the visit by the server whenever the payment is written; null on a payment older than the copy. */
  patient_id: Id | null;
  /** Copied from the visit, like `patient_id`. */
  visit_type_id: Id | null;
  /** Copied from the visit, like `patient_id`. */
  clinician_id: Id | null;
  amount: number;
  method: PayMethod;
  taken_by: string | null;
  paid_at: Instant;
  voided: boolean;
  void_reason: string | null;
  voided_by: string | null;
  client_key: string | null;
}

export interface WriteOff {
  id: Id;
  appointment_id: Id;
  amount: number;
  reason: string;
  written_by: string | null;
  written_at: Instant;
  client_key: string | null;
}

export interface CheckNote {
  id: Id;
  registration_id: Id | null;
  appointment_id: Id | null;
  note: string;
  written_by: string | null;
  client_key: string | null;
  created_at: Instant | null;
}

export type RecallStatus = "due" | "noted" | "booked" | "not_needed";

export interface Recall {
  id: Id;
  patient_id: Id;
  from_appointment_id: Id | null;
  visit_type_id: Id | null;
  clinician_id: Id;
  client_key: string | null;
  weeks: number;
  due_on: Day;
  status: RecallStatus;
  reason: string | null;
  dismiss_reason: string | null;
  booked_appointment_id: Id | null;
  created_at: Instant | null;
}

export type PartOfDay = "any" | "mornings" | "afternoons";

export interface WaitingEntry {
  id: Id;
  patient_id: Id;
  visit_type_id: Id;
  clinician_id: Id | null;
  part_of_day: PartOfDay;
  status: "waiting" | "booked" | "removed";
  channel: "online" | "desk";
  booked_appointment_id: Id | null;
  note: string | null;
  created_at: Instant | null;
}

export type MessageKind = "confirmation" | "reminder" | "missed" | "recall" | "cancelled" | "receipt";
export type MessageStatus = "queued" | "sent" | "failed" | "skipped";

export interface Message {
  id: Id;
  kind: MessageKind;
  patient_id: Id | null;
  appointment_id: Id | null;
  recall_id: Id | null;
  closure_id: Id | null;
  /** The payment a receipt is for. */
  payment_id: Id | null;
  to_address: string | null;
  language: string | null;
  status: MessageStatus;
  error: string | null;
  due_at: Instant | null;
  sent_at: Instant | null;
  created_by: string | null;
  client_key: string | null;
  created_at: Instant | null;
}

export interface DayClose {
  id: Id;
  day: Day;
  no_shows_marked: number;
  cash_expected: number;
  cash_counted: number | null;
  note: string | null;
  closed_by: string | null;
  closed_at: Instant;
}

/** Every table, by its short name, with the row it holds. */
export interface Tables {
  settings: Settings;
  opening_hours: OpeningHours;
  clinicians: Clinician;
  visit_types: VisitType;
  clinician_visit_types: ClinicianVisitType;
  clinician_hours: ClinicianHours;
  closures: Closure;
  faqs: Faq;
  patients: Patient;
  registrations: Registration;
  appointments: Appointment;
  payments: Payment;
  write_offs: WriteOff;
  check_notes: CheckNote;
  recalls: Recall;
  waiting_list: WaitingEntry;
  messages: Message;
  day_closes: DayClose;
}
export type TableRef = keyof Tables;

// ── screens ─────────────────────────────────────────────────────────────────

/**
 * Every screen, by the id the URL, the sidebar and the demo card use.
 *
 * `app/App.tsx` maps each to its component, so a view added here is a compile
 * error until a screen exists for it — that is what keeps every link, nav row
 * and card chip landing somewhere real.
 */
export type PatientView = "find" | "details" | "confirm" | "visits" | "team" | "findus" | "prices" | "sooner" | "prefs" | "register" | "faq" | "notfound";
export type DeskView =
  | "daysheet"
  | "waiting"
  | "patients"
  | "registrations"
  | "week"
  | "waitlist"
  | "accounts"
  | "recalls"
  | "hours"
  | "outbox"
  | "endofday"
  | "settings"
  | "kiosk"
  | "notfound";
export type View = PatientView | DeskView;

export type Persona = "patient" | "clinic";

/** The desk's roles, by the manifest's keys; `null` when the person holds none of them (an administrator). */
export type DeskRole = "reception" | "clinician" | "manager" | "kiosk";
