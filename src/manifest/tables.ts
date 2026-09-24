/**
 * The practice's tables, as the manifest asks Adminium to make them.
 *
 * Everything the desk and the patients' pages read or write is here, and so
 * is every rule the server keeps on their behalf, because a rule the browser
 * keeps is a rule another browser can skip:
 *
 *   - a visit's length and fee are copied from its visit type, and its
 *     reference is a random `RH-` code (it cannot be guessed or counted);
 *   - who booked, took a payment or handled a registration, and when a visit
 *     was checked in, roomed, seen or cancelled, are stamped by the server;
 *   - `paid` and `waived` are totals of the visit's payments and write-offs,
 *     and `balance` is worked out from them — a payment or a write-off that
 *     would take it below zero is refused, whichever desk sends it;
 *   - the booking rule: a clinician is never booked twice at once, only
 *     inside their hours, off their break, on the grid, not on a closed day.
 *
 * Money is `money`; times a person reads are `timestamptz` on the venue's
 * clock; the weekly hours are `HH:MM` text, because a weekly rule is not an
 * instant.
 */
import { l, type Labels } from "./labels.ts";

type Tone = "pos" | "warn" | "danger" | "info" | "neutral" | "accent";

export interface Column {
  ref: string;
  type: "int" | "text" | "money" | "bool" | "enum" | "date" | "timestamptz" | "fk";
  role?: "pk" | "created_at";
  semantic?: "name" | "email" | "image" | "money";
  nullable?: true;
  enum?: string[];
  references?: string;
  default?: string | number | boolean;
  maxLength?: number;
  unique?: true;
  rules?: Record<string, unknown>;
  label?: Labels;
}

export interface Table {
  ref: string;
  label: Labels;
  labelPlural: Labels;
  keyField?: string;
  booking?: Record<string, unknown>;
  columns: Column[];
}

// ── column makers ───────────────────────────────────────────────────────────

const id: Column = { ref: "id", type: "int", role: "pk" };
const createdAt: Column = { ref: "created_at", type: "timestamptz", role: "created_at", default: "now", label: l("Created") };

/** The desk's per-action key: a retried create finds the row the first try saved. */
const clientKey: Column = { ref: "client_key", type: "text", maxLength: 36, nullable: true, unique: true, label: l("Action key") };

function text(ref: string, maxLength: number, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "text", maxLength, label: l(label), ...more };
}
const opt = { nullable: true } as const;

function int(ref: string, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "int", label: l(label), ...more };
}
function bool(ref: string, label: string, value: boolean): Column {
  return { ref, type: "bool", default: value, label: l(label) };
}
function money(ref: string, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "money", label: l(label), ...more };
}
function fk(ref: string, references: string, label: string, nullable = false): Column {
  return { ref, type: "fk", references, label: l(label), ...(nullable ? opt : {}) };
}
function date(ref: string, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "date", label: l(label), ...more };
}
function at(ref: string, label: string, more: Partial<Column> = {}): Column {
  return { ref, type: "timestamptz", label: l(label), ...more };
}
/** An enum whose values read as words, with the tone each shows in. */
function choice(
  ref: string,
  label: string,
  values: Record<string, string>,
  more: Partial<Column> & { tones?: Record<string, Tone> } = {},
): Column {
  const { tones, rules, ...rest } = more;
  return {
    ref,
    type: "enum",
    enum: Object.keys(values),
    label: l(label),
    ...rest,
    rules: {
      ...rules,
      enumLabels: {
        labels: Object.fromEntries(Object.entries(values).map(([value, word]) => [value, l(word)])),
        ...(tones === undefined ? {} : { tones }),
      },
    },
  };
}
/** A number chosen from a short list (the desk offers exactly these). */
function picked(ref: string, label: string, values: number[], fallback: number): Column {
  return { ref, type: "int", default: fallback, label: l(label), rules: { options: { values: values.map((v) => ({ value: String(v) })) } } };
}
/** `HH:MM` on the practice's clock. */
function hhmm(ref: string, label: string, nullable = false, fallback?: string): Column {
  return {
    ref,
    type: "text",
    maxLength: 5,
    label: l(label),
    ...(nullable ? opt : {}),
    ...(fallback === undefined ? {} : { default: fallback }),
    rules: { validation: { minLength: 5, maxLength: 5 } },
  };
}

const WEEKDAYS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const weekday = (): Column => choice("weekday", "Weekday", WEEKDAYS);

/** Stamped with the moment `status` becomes one of these. */
const stampNow = (column: string, values: (string | boolean)[]) => ({ stamp: { set: "now", on: { column, values } } });
/** Stamped with who is signed in, on create. */
const stampWho = { stamp: { set: "user-name", on: "create" } };

const APPOINTMENT_STATUSES = {
  booked: "Booked",
  checked_in: "Checked in",
  roomed: "Roomed",
  with_clinician: "With clinician",
  ready: "Ready to go",
  seen: "Seen",
  no_show: "No-show",
  cancelled: "Cancelled",
};
/** The statuses that hold a clinician's time. A no-show or a cancellation frees it. */
export const COUNTED = ["booked", "checked_in", "roomed", "with_clinician", "ready", "seen"];

const setting = (column: string) => ({ table: "settings", column });

// ── the tables ──────────────────────────────────────────────────────────────

export const TABLES: Table[] = [
  {
    ref: "settings",
    label: l("Practice settings"),
    labelPlural: l("Practice settings"),
    keyField: "practice_name",
    columns: [
      id,
      text("practice_name", 80, "Practice name", { semantic: "name" }),
      text("mark", 2, "Letters on the tile"),
      text("address", 200, "Address", { rules: { personal: false } }),
      text("phone", 32, "Desk phone", { rules: { personal: false, validation: { format: "phone" } } }),
      text("email", 254, "Desk email", { ...opt, semantic: "email", rules: { personal: false, validation: { format: "email" } } }),
      text("intro", 300, "A line about the practice", opt),
      text("directions", 500, "Directions", opt),
      text("map_link", 500, "Map link", { ...opt, rules: { validation: { format: "url" } } }),
      text("entrance_photo", 500, "Photo of the entrance", { ...opt, semantic: "image" }),
      text("pay_note", 300, "How to pay", opt),
      text("insurer_note", 300, "Paying through an insurer", opt),
      text("privacy_link", 500, "Privacy notice link", { ...opt, rules: { validation: { format: "url" } } }),
      text("currency", 3, "Currency", { default: "USD" }),
      text("language", 16, "Language", { default: "en-US" }),
      picked("slot_minutes", "Booking grid (minutes)", [5, 10, 15, 20, 30], 15),
      int("booking_days", "Days open for booking", { default: 10, rules: { validation: { min: 1, max: 60 } } }),
      int("min_notice_minutes", "Shortest notice online (minutes)", { default: 60, rules: { validation: { min: 0, max: 2880 } } }),
      bool("new_patients_online", "New patients may book online", true),
      bool("online_booking_on", "Online booking", true),
      picked("no_show_minutes", "No-show after (minutes)", [10, 15, 20, 30], 15),
      picked("cancel_hours", "Cancellation window (hours before)", [12, 24, 48], 24),
      bool("reminders_on", "Send reminders", true),
      picked("default_lead_hours", "Remind (hours before)", [12, 24, 48], 24),
      bool("kiosk_on", "Arrivals kiosk", false),
    ],
  },
  {
    ref: "opening_hours",
    label: l("Opening hours"),
    labelPlural: l("Opening hours"),
    keyField: "weekday",
    columns: [
      id,
      { ...weekday(), unique: true },
      bool("open", "Open", true),
      hhmm("opens", "Opens", false, "08:30"),
      hhmm("closes", "Closes", false, "17:30"),
      hhmm("break_start", "Desk closed from", true),
      hhmm("break_end", "Desk closed until", true),
    ],
  },
  {
    ref: "clinicians",
    label: l("Clinician"),
    labelPlural: l("Clinicians"),
    keyField: "name",
    columns: [
      id,
      text("name", 80, "Name", { semantic: "name" }),
      text("short_name", 40, "Short name"),
      text("role_label", 60, "Role"),
      text("color", 7, "Colour", { default: "#0369a1" }),
      text("photo", 500, "Photo", { ...opt, semantic: "image" }),
      text("bio", 400, "About them", opt),
      bool("bookable_online", "Bookable online", true),
      bool("active", "Working here", true),
      int("position", "Position", { default: 0 }),
      text("staff_email", 254, "Their sign-in email", { ...opt, semantic: "email", rules: { validation: { format: "email" } } }),
    ],
  },
  {
    ref: "visit_types",
    label: l("Visit type"),
    labelPlural: l("Visit types"),
    keyField: "name",
    columns: [
      id,
      text("name", 80, "Visit name", { semantic: "name" }),
      text("short_name", 30, "Short name"),
      picked("minutes", "Length (minutes)", [15, 30, 45, 60], 15),
      money("fee", "Fee", { default: 0 }),
      text("color", 7, "Colour", { default: "#3b6fbd" }),
      text("icon", 40, "Icon", { default: "stethoscope" }),
      bool("bookable_online", "Bookable online", true),
      bool("new_patients_only", "New patients only", false),
      bool("active", "Offered", true),
      int("position", "Position", { default: 0 }),
    ],
  },
  {
    ref: "clinician_visit_types",
    label: l("Visit a clinician does"),
    labelPlural: l("Visits clinicians do"),
    columns: [id, fk("clinician_id", "clinicians", "Clinician"), fk("visit_type_id", "visit_types", "Visit type")],
  },
  {
    ref: "clinician_hours",
    label: l("Clinician's hours"),
    labelPlural: l("Clinicians' hours"),
    columns: [
      id,
      fk("clinician_id", "clinicians", "Clinician"),
      weekday(),
      hhmm("opens", "Starts", false, "08:30"),
      hhmm("closes", "Finishes", false, "17:30"),
      hhmm("break_start", "Break from", true),
      hhmm("break_end", "Break until", true),
    ],
  },
  {
    ref: "closures",
    label: l("Closure"),
    labelPlural: l("Closures"),
    keyField: "label",
    columns: [
      id,
      clientKey,
      fk("clinician_id", "clinicians", "Who is away (empty: the whole practice)", true),
      date("from_date", "From"),
      date("to_date", "To"),
      text("label", 80, "Label"),
      text("note", 280, "A note for patients", opt),
      bool("active", "Closed", true),
      createdAt,
    ],
  },
  {
    ref: "faqs",
    label: l("Question"),
    labelPlural: l("Questions"),
    keyField: "question",
    columns: [
      id,
      text("question", 200, "Question"),
      text("answer", 1000, "Answer"),
      int("position", "Position", { default: 0 }),
      bool("active", "Shown", true),
    ],
  },
  {
    ref: "patients",
    label: l("Patient"),
    labelPlural: l("Patients"),
    keyField: "name",
    columns: [
      id,
      clientKey,
      text("name", 120, "Name", { semantic: "name" }),
      date("born_on", "Date of birth"),
      text("mobile", 32, "Mobile", { rules: { validation: { format: "phone" } } }),
      text("email", 254, "Email", { ...opt, semantic: "email", rules: { validation: { format: "email" } } }),
      text("address", 300, "Address", opt),
      text("emergency_contact", 200, "Someone to ring", opt),
      text("allergies_note", 200, "Allergies", { ...opt, rules: { personal: true } }),
      text("insurer", 80, "Insurer", opt),
      text("policy_ref", 60, "Policy number", opt),
      text("language", 16, "Language", opt),
      bool("remind_email", "Remind me by email", true),
      picked("remind_lead_hours", "Remind (hours before)", [12, 24, 48], 24),
      choice("status", "Status", { active: "Active", archived: "Archived" }, { default: "active", tones: { active: "pos", archived: "neutral" } }),
      createdAt,
    ],
  },
  {
    ref: "registrations",
    label: l("Registration"),
    labelPlural: l("Registrations"),
    keyField: "name",
    columns: [
      id,
      text("ref", 12, "Reference", { rules: { code: { prefix: "RG-", length: 4 } } }),
      text("name", 120, "Name", { semantic: "name" }),
      date("born_on", "Date of birth"),
      text("mobile", 32, "Mobile", { rules: { validation: { format: "phone" } } }),
      text("email", 254, "Email", { ...opt, semantic: "email", rules: { validation: { format: "email" } } }),
      text("address", 300, "Address", opt),
      text("emergency_contact", 200, "Someone to ring", opt),
      text("language", 16, "Language", opt),
      choice(
        "status",
        "Status",
        { new: "To check", rang: "Rang", accepted: "Accepted", declined: "Declined", duplicate: "Already a patient" },
        { default: "new", tones: { new: "accent", rang: "warn", accepted: "pos", declined: "neutral", duplicate: "neutral" } },
      ),
      fk("patient_id", "patients", "Patient", true),
      text("outcome", 200, "Outcome", opt),
      text("note", 280, "Note", opt),
      text("handled_by", 120, "Handled by", { ...opt, rules: { stamp: { set: "user-name", on: { column: "status", values: ["rang", "accepted", "declined", "duplicate"] } } } }),
      at("handled_at", "Handled at", { ...opt, rules: stampNow("status", ["rang", "accepted", "declined", "duplicate"]) }),
      createdAt,
    ],
  },
  {
    ref: "appointments",
    label: l("Appointment"),
    labelPlural: l("Appointments"),
    keyField: "ref",
    booking: {
      start: "starts_at",
      minutes: "minutes",
      resource: "clinician_id",
      kind: "visit_type_id",
      countWhere: { column: "status", values: COUNTED },
      eligible: {
        table: "clinician_visit_types",
        resource: "clinician_id",
        kind: "visit_type_id",
        order: { table: "clinicians", column: "position", active: "active", public: "bookable_online" },
      },
      hours: {
        practice: { table: "opening_hours", weekday: "weekday", open: "open", opens: "opens", closes: "closes", breakStart: "break_start", breakEnd: "break_end" },
        own: { table: "clinician_hours", resource: "clinician_id", weekday: "weekday", opens: "opens", closes: "closes", breakStart: "break_start", breakEnd: "break_end" },
      },
      closures: { table: "closures", from: "from_date", to: "to_date", resource: "clinician_id", active: "active" },
      grid: setting("slot_minutes"),
      windowDays: setting("booking_days"),
      noticeMinutes: setting("min_notice_minutes"),
      cancel: { hours: setting("cancel_hours"), mode: "flag", flag: "late_cancel", when: { column: "status", to: "cancelled" } },
    },
    columns: [
      id,
      text("ref", 12, "Reference", { rules: { code: { prefix: "RH-", length: 4 } } }),
      fk("patient_id", "patients", "Patient", true),
      text("new_name", 120, "First visit: name", opt),
      date("new_born_on", "First visit: date of birth", opt),
      text("new_mobile", 32, "First visit: mobile", { ...opt, rules: { validation: { format: "phone" } } }),
      text("new_email", 254, "First visit: email", { ...opt, rules: { validation: { format: "email" } } }),
      fk("clinician_id", "clinicians", "Clinician", true),
      fk("visit_type_id", "visit_types", "Visit type"),
      at("starts_at", "Starts", { rules: { venueLocal: true } }),
      int("minutes", "Minutes", { default: 15, rules: { copy: { via: "visit_type_id", from: "minutes", mode: "always" } } }),
      money("fee", "Fee", { ...opt, rules: { copy: { via: "visit_type_id", from: "fee" } } }),
      money("waived", "Written off", {
        ...opt,
        rules: { rollup: { from: "write_offs", via: "appointment_id", sum: "amount", cap: true } },
      }),
      money("paid", "Paid", {
        ...opt,
        rules: {
          rollup: {
            from: "payments",
            via: "appointment_id",
            sum: "amount",
            where: { column: "voided", eq: false },
            balance: { column: "balance", of: "fee", minus: ["waived"] },
            cap: true,
          },
        },
      }),
      money("balance", "Still owing", opt),
      text("reason", 240, "What it is for", opt),
      text("desk_note", 280, "Note for the desk", opt),
      choice("status", "Status", APPOINTMENT_STATUSES, {
        default: "booked",
        tones: { booked: "neutral", checked_in: "info", roomed: "info", with_clinician: "pos", ready: "pos", seen: "neutral", no_show: "danger", cancelled: "neutral" },
      }),
      choice(
        "channel",
        "How it was booked",
        { online: "Online", phone: "Phone", desk: "At the desk", walk_in: "Walk-in", waiting_list: "Waiting list", recall: "Recall" },
        { default: "desk" },
      ),
      at("checked_in_at", "Checked in at", { ...opt, rules: stampNow("status", ["checked_in"]) }),
      at("roomed_at", "Roomed at", { ...opt, rules: stampNow("status", ["roomed"]) }),
      at("seen_at", "Seen at", { ...opt, rules: stampNow("status", ["seen"]) }),
      at("cancelled_at", "Cancelled at", { ...opt, rules: stampNow("status", ["cancelled"]) }),
      bool("late_cancel", "Late cancellation", false),
      choice("cancelled_by", "Cancelled by", { patient: "The patient", desk: "The desk" }, {
        ...opt,
        rules: { stamp: { set: { byOrigin: { public: "patient", staff: "desk" } }, on: { column: "status", values: ["cancelled"] } } },
      }),
      int("recall_weeks", "See again in (weeks)", opt),
      text("language", 16, "Language", opt),
      text("booked_by", 120, "Booked by", { ...opt, rules: stampWho }),
      choice(
        "check_status",
        "First visit check",
        { to_check: "To check", rang: "Rang", accepted: "Accepted", linked: "Same person", declined: "Declined" },
        { ...opt, tones: { to_check: "accent", rang: "warn", accepted: "pos", linked: "pos", declined: "neutral" } },
      ),
      clientKey,
      createdAt,
    ],
  },
  {
    ref: "payments",
    label: l("Payment"),
    labelPlural: l("Payments"),
    columns: [
      id,
      fk("appointment_id", "appointments", "Appointment"),
      money("amount", "Amount", { rules: { validation: { min: 0.01 } } }),
      choice("method", "Method", { card: "Card", cash: "Cash", transfer: "Transfer" }, { default: "card" }),
      text("taken_by", 120, "Taken by", { ...opt, rules: stampWho }),
      at("paid_at", "Paid at", { default: "now" }),
      bool("voided", "Voided", false),
      text("void_reason", 200, "Why it was voided", opt),
      text("voided_by", 120, "Voided by", { ...opt, rules: { stamp: { set: "user-name", on: { column: "voided", values: [true] } } } }),
      clientKey,
    ],
  },
  {
    ref: "write_offs",
    label: l("Write-off"),
    labelPlural: l("Write-offs"),
    columns: [
      id,
      fk("appointment_id", "appointments", "Appointment"),
      money("amount", "Amount", { rules: { validation: { min: 0.01 } } }),
      text("reason", 200, "Reason"),
      text("written_by", 120, "Written off by", { ...opt, rules: stampWho }),
      at("written_at", "Written off at", { default: "now" }),
      clientKey,
    ],
  },
  {
    ref: "check_notes",
    label: l("Note"),
    labelPlural: l("Notes"),
    columns: [
      id,
      fk("registration_id", "registrations", "Registration", true),
      fk("appointment_id", "appointments", "Appointment", true),
      text("note", 280, "Note"),
      text("written_by", 120, "Written by", { ...opt, rules: stampWho }),
      clientKey,
      createdAt,
    ],
  },
  {
    ref: "recalls",
    label: l("Recall"),
    labelPlural: l("Recalls"),
    columns: [
      id,
      fk("patient_id", "patients", "Patient"),
      fk("from_appointment_id", "appointments", "From the visit", true),
      fk("visit_type_id", "visit_types", "Visit type", true),
      // Required: the recall email names who asked to see them again.
      fk("clinician_id", "clinicians", "Clinician"),
      clientKey,
      int("weeks", "See again in (weeks)"),
      date("due_on", "Due on"),
      choice(
        "status",
        "Status",
        { due: "Due", noted: "Note queued", booked: "Booked", not_needed: "Not needed" },
        { default: "due", tones: { due: "warn", noted: "info", booked: "pos", not_needed: "neutral" } },
      ),
      text("reason", 120, "What for", opt),
      text("dismiss_reason", 120, "Why it is not needed", opt),
      fk("booked_appointment_id", "appointments", "Booked visit", true),
      createdAt,
    ],
  },
  {
    ref: "waiting_list",
    label: l("Waiting-list entry"),
    labelPlural: l("Waiting list"),
    columns: [
      id,
      fk("patient_id", "patients", "Patient"),
      fk("visit_type_id", "visit_types", "Visit type"),
      fk("clinician_id", "clinicians", "Clinician (empty: anyone)", true),
      choice("part_of_day", "Part of the day", { any: "Any time", mornings: "Mornings", afternoons: "Afternoons" }, { default: "any" }),
      choice("status", "Status", { waiting: "Waiting", booked: "Booked", removed: "Taken off" }, { default: "waiting", tones: { waiting: "warn", booked: "pos", removed: "neutral" } }),
      choice("channel", "Joined", { online: "Online", desk: "At the desk" }, { default: "desk" }),
      fk("booked_appointment_id", "appointments", "Booked visit", true),
      text("note", 280, "Note", opt),
      createdAt,
    ],
  },
  {
    ref: "messages",
    label: l("Message"),
    labelPlural: l("Messages"),
    columns: [
      id,
      choice("kind", "Kind", { confirmation: "Confirmation", reminder: "Reminder", missed: "Missed visit", recall: "Recall", cancelled: "Closure" }),
      fk("patient_id", "patients", "Patient", true),
      fk("appointment_id", "appointments", "Appointment", true),
      fk("recall_id", "recalls", "Recall", true),
      fk("closure_id", "closures", "Closure", true),
      text("to_address", 254, "Sent to", opt),
      text("language", 16, "Language", opt),
      choice(
        "status",
        "Status",
        { queued: "Waiting to go", sent: "Sent", failed: "Couldn't send", skipped: "Not sent" },
        { default: "queued", tones: { queued: "info", sent: "pos", failed: "danger", skipped: "neutral" } },
      ),
      text("error", 300, "Why", opt),
      at("due_at", "Due at", opt),
      at("sent_at", "Sent at", opt),
      text("created_by", 120, "Queued by", { ...opt, rules: stampWho }),
      clientKey,
      createdAt,
    ],
  },
  {
    ref: "day_closes",
    label: l("Day close"),
    labelPlural: l("Day closes"),
    keyField: "day",
    columns: [
      id,
      date("day", "Day", { unique: true }),
      int("no_shows_marked", "No-shows marked", { default: 0 }),
      money("cash_expected", "Cash taken", { default: 0 }),
      money("cash_counted", "Cash counted", opt),
      text("note", 500, "A note for tomorrow", opt),
      text("closed_by", 120, "Closed by", { ...opt, rules: stampWho }),
      at("closed_at", "Closed at", { default: "now" }),
    ],
  },
];
