/**
 * The sample practice, resolved in the browser.
 *
 * The website's demo runs with no server: it reads the very bundle an operator
 * adds from Adminium (`seeds/clinic.sample.json`) and needs the rows Adminium
 * would have written from it. `resolveSample()` is that loader, done here —
 * and done the SAME way, because a demo that resolved "today" or a status
 * differently from a real install would show a practice nobody can get:
 *
 *   - each table's rows get `id`s 1, 2, 3 … in bundle order, as a fresh
 *     table's counter hands them out; a row left out by `@byClock` takes none;
 *   - `@ref` is the id of the earlier row with that `@label`;
 *   - `@ago` is an instant that long before `now`;
 *   - `@day`/`@time` is a wall time on the VENUE's clock, `@day` alone a date
 *     there; with `@workdays` the days count Monday to Friday, and day 0 on a
 *     weekend is the Monday after;
 *   - `@byClock` merges its `before`, `around` or `after` set by where the
 *     row's time falls against `now` — more than half an hour before, within
 *     half an hour, or later — and `"@skip": true` leaves the row out;
 *   - `@t` is the reader's language: the exact tag, then the same language,
 *     then US English;
 *   - what the database fills in is filled in: each column's default ("now"
 *     is the adding moment), null for the rest;
 *   - a visit's `minutes` always come from its visit type, its `fee` when the
 *     row has none; then `paid` (payments not voided), `waived` (write-offs)
 *     and `balance` (fee − waived − paid) are settled from the rows that feed
 *     them, once every row is in.
 *
 * Instants come out as ISO strings in UTC (`…Z`), dates as `YYYY-MM-DD` on the
 * venue's clock, money as numbers.
 *
 * Pure, and browser-safe: it imports nothing but types, and nothing that runs
 * only in Node — it ships in the demo bundle. The server's own resolver is in
 * Adminium (`apps/server/src/apps/sample-data.ts`); sampleRows.test.ts holds
 * this one to the same answers, and sample-drift.test.ts holds the column
 * list below to manifest.json.
 */
import type { SampleBundle } from "./sample.ts";

export type ResolvedRow = Record<string, unknown>;
export type ResolvedSample = Record<string, ResolvedRow[]>;

export interface ResolveOptions {
  /** The adding moment, in epoch milliseconds. */
  now: number;
  /** The venue's IANA zone, e.g. "Europe/London". */
  zone: string;
  /** The reader's BCP 47 tag, e.g. "de-DE". */
  locale: string;
}

/** A column the database fills with the adding moment. */
const NOW = Symbol("now");
/** A column every row must name: it has no default and may not be empty. */
const REQUIRED = Symbol("required");
type Fill = string | number | boolean | null | typeof NOW | typeof REQUIRED;

/**
 * Every column after `id`, in the manifest's order, with what the database
 * puts there when a row does not say (manifest.json `requiredSchema`). The
 * manifest is too big to ship to the browser for this, so `npm run sample`
 * writes the list here from it, between the two marker lines.
 */
// ── written by `npm run sample` from manifest.json; do not edit by hand ──
export const COLUMNS: Record<string, Record<string, Fill>> = {
  settings: { practice_name: REQUIRED, mark: REQUIRED, address: REQUIRED, phone: REQUIRED, email: null, intro: null, directions: null, map_link: null, entrance_photo: null, pay_note: null, insurer_note: null, privacy_link: null, currency: "USD", language: "en-US", slot_minutes: 15, booking_days: 10, min_notice_minutes: 60, new_patients_online: true, online_booking_on: true, no_show_minutes: 15, cancel_hours: 24, reminders_on: true, default_lead_hours: 24, kiosk_on: false },
  opening_hours: { weekday: REQUIRED, open: true, opens: "08:30", closes: "17:30", break_start: null, break_end: null },
  clinicians: { name: REQUIRED, short_name: REQUIRED, role_label: REQUIRED, color: "#0369a1", photo: null, bio: null, bookable_online: true, active: true, position: 0, staff_email: null },
  visit_types: { name: REQUIRED, short_name: REQUIRED, minutes: 15, fee: 0, color: "#3b6fbd", icon: "stethoscope", bookable_online: true, new_patients_only: false, active: true, position: 0 },
  clinician_visit_types: { clinician_id: REQUIRED, visit_type_id: REQUIRED },
  clinician_hours: { clinician_id: REQUIRED, weekday: REQUIRED, opens: "08:30", closes: "17:30", break_start: null, break_end: null },
  closures: { client_key: null, clinician_id: null, from_date: REQUIRED, to_date: REQUIRED, label: REQUIRED, note: null, active: true, created_at: NOW },
  faqs: { question: REQUIRED, answer: REQUIRED, position: 0, active: true },
  patients: { client_key: null, name: REQUIRED, born_on: REQUIRED, mobile: REQUIRED, email: null, address: null, emergency_contact: null, allergies_note: null, insurer: null, policy_ref: null, language: null, remind_email: true, remind_lead_hours: 24, status: "active", created_at: NOW },
  registrations: { ref: REQUIRED, name: REQUIRED, born_on: REQUIRED, mobile: REQUIRED, email: null, address: null, emergency_contact: null, language: null, status: "new", patient_id: null, outcome: null, note: null, handled_by: null, handled_at: null, created_at: NOW },
  appointments: { ref: REQUIRED, patient_id: null, new_name: null, new_born_on: null, new_mobile: null, new_email: null, clinician_id: null, visit_type_id: REQUIRED, starts_at: REQUIRED, minutes: 15, fee: null, waived: null, paid: null, balance: null, reason: null, desk_note: null, status: "booked", channel: "desk", checked_in_at: null, roomed_at: null, seen_at: null, cancelled_at: null, late_cancel: false, cancelled_by: null, recall_weeks: null, language: null, booked_by: null, check_status: null, client_key: null, created_at: NOW },
  payments: { appointment_id: REQUIRED, amount: REQUIRED, method: "card", taken_by: null, paid_at: NOW, voided: false, void_reason: null, voided_by: null, client_key: null },
  write_offs: { appointment_id: REQUIRED, amount: REQUIRED, reason: REQUIRED, written_by: null, written_at: NOW, client_key: null },
  check_notes: { registration_id: null, appointment_id: null, note: REQUIRED, written_by: null, client_key: null, created_at: NOW },
  recalls: { patient_id: REQUIRED, from_appointment_id: null, visit_type_id: null, clinician_id: REQUIRED, client_key: null, weeks: REQUIRED, due_on: REQUIRED, status: "due", reason: null, dismiss_reason: null, booked_appointment_id: null, created_at: NOW },
  waiting_list: { patient_id: REQUIRED, visit_type_id: REQUIRED, clinician_id: null, part_of_day: "any", status: "waiting", channel: "desk", booked_appointment_id: null, note: null, created_at: NOW },
  messages: { kind: REQUIRED, patient_id: null, appointment_id: null, recall_id: null, closure_id: null, to_address: null, language: null, status: "queued", error: null, due_at: null, sent_at: null, created_by: null, client_key: null, created_at: NOW },
  day_closes: { day: REQUIRED, no_shows_marked: 0, cash_expected: 0, cash_counted: null, note: null, closed_by: null, closed_at: NOW },
};
// ── end of the written part ──

/** The manifest's `copy` rules: a visit's length always from its type, its fee unless the row names one. */
export const COPIES = [
  { table: "appointments", column: "minutes", via: "visit_type_id", from: "minutes", always: true },
  { table: "appointments", column: "fee", via: "visit_type_id", from: "fee", always: false },
] as const;

/** The manifest's `rollup` rules on a visit, and the balance they leave. */
export const ROLLUPS = {
  table: "appointments",
  paid: { from: "payments", via: "appointment_id", sum: "amount", unless: "voided" },
  waived: { from: "write_offs", via: "appointment_id", sum: "amount" },
  balance: { of: "fee", minus: ["waived", "paid"] },
} as const;

// ── the clock ───────────────────────────────────────────────────────────────

interface Ymd {
  y: number;
  m: number;
  d: number;
}

/** How far `zone` is ahead of UTC at `instant`, in ms. */
function zoneOffsetMs(zone: string, instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((local - instant) / 60_000) * 60_000;
}

/** The instant of a wall-clock time in `zone`; across a clock change a second pass settles it. */
function zonedWallTime(date: Ymd, time: string, zone: string): number {
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(date.y, date.m - 1, date.d, hh, mm);
  const offset = zoneOffsetMs(zone, guess);
  const again = zoneOffsetMs(zone, guess - offset);
  return again === offset ? guess - offset : guess - again;
}

/** Today's date in `zone`, moved by `days`. */
function zonedDay(now: number, zone: string, days: number): Ymd {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const shifted = new Date(Date.UTC(get("year"), get("month") - 1, get("day") + days));
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

/** `n` working days from today in `zone`; day 0 on a weekend is the Monday after. */
function zonedWorkday(now: number, zone: string, n: number): Ymd {
  const today = zonedDay(now, zone, 0);
  const at = new Date(Date.UTC(today.y, today.m - 1, today.d));
  const weekend = (date: Date) => date.getUTCDay() === 0 || date.getUTCDay() === 6;
  while (weekend(at)) at.setUTCDate(at.getUTCDate() + 1);
  for (let left = Math.abs(n); left > 0; ) {
    at.setUTCDate(at.getUTCDate() + Math.sign(n));
    if (!weekend(at)) left -= 1;
  }
  return { y: at.getUTCFullYear(), m: at.getUTCMonth() + 1, d: at.getUTCDate() };
}

/** `P[nW][nD][T[nH][nM][nS]]` in ms. */
function durationMs(duration: string): number {
  const match = /^P(?!$)(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/.exec(duration);
  if (match === null) throw new Error(`"${duration}" is not an ISO-8601 duration`);
  const n = (part: string | undefined) => (part === undefined ? 0 : Number.parseFloat(part));
  return ((((n(match[1]) * 7 + n(match[2])) * 24 + n(match[4])) * 60 + n(match[5])) * 60 + n(match[6])) * 1000;
}

/** Half an hour either side of the adding moment is "around" it. */
const AROUND_MS = 30 * 60_000;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The text for the reader's language: theirs, their language, US English, any. */
export function pickText(texts: Readonly<Record<string, string>>, locale: string): string {
  const tag = locale.replace("_", "-");
  if (texts[tag] !== undefined) return texts[tag]!;
  const language = tag.split("-")[0];
  const near = Object.entries(texts).find(([key]) => key.split("-")[0] === language);
  if (near !== undefined) return near[1];
  return texts["en-US"] ?? Object.values(texts)[0] ?? "";
}

// ── one value, one row ──────────────────────────────────────────────────────

/** An instant, kept as a Date until the row is spelled out, so `@byClock` can compare it. */
type Resolved = unknown;

interface Context extends ResolveOptions {
  labels: Map<string, number>;
}

function resolveValue(value: unknown, ctx: Context): Resolved {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (typeof record["@ref"] === "string") {
    const id = ctx.labels.get(record["@ref"]);
    if (id === undefined) throw new Error(`The sample row "${record["@ref"]}" was not written.`);
    return id;
  }
  if (typeof record["@ago"] === "string") return new Date(ctx.now - durationMs(record["@ago"]));
  if (typeof record["@day"] === "number") {
    const day = record["@workdays"] === true ? zonedWorkday(ctx.now, ctx.zone, record["@day"]) : zonedDay(ctx.now, ctx.zone, record["@day"]);
    if (typeof record["@time"] === "string") return new Date(zonedWallTime(day, record["@time"], ctx.zone));
    return `${String(day.y).padStart(4, "0")}-${pad2(day.m)}-${pad2(day.d)}`;
  }
  if (typeof record["@t"] === "object" && record["@t"] !== null) return pickText(record["@t"] as Record<string, string>, ctx.locale);
  if (typeof record["@asset"] === "string") throw new Error(`The sample asset "${record["@asset"]}" cannot be shown without a server.`);
  return value;
}

/** One row with its directives resolved, or null when its `@byClock` set leaves it out. */
function resolveRow(row: Readonly<Record<string, unknown>>, ctx: Context): Record<string, Resolved> | null {
  let values: Readonly<Record<string, unknown>> = row;
  const clock = row["@byClock"] as { at: unknown; before?: Record<string, unknown>; around?: Record<string, unknown>; after?: Record<string, unknown> } | undefined;
  if (clock !== undefined) {
    const when = resolveValue(typeof clock.at === "string" ? row[clock.at] : clock.at, ctx);
    const instant = when instanceof Date ? when.getTime() : Number.NaN;
    const branch = Number.isNaN(instant)
      ? undefined
      : instant < ctx.now - AROUND_MS
        ? clock.before
        : instant <= ctx.now + AROUND_MS
          ? clock.around
          : clock.after;
    if (branch?.["@skip"] === true) return null;
    const { ["@skip"]: _skip, ...columns } = branch ?? {};
    values = { ...row, ...columns };
  }
  const out: Record<string, Resolved> = {};
  for (const [column, value] of Object.entries(values)) {
    if (column === "@label" || column === "@byClock") continue;
    out[column] = resolveValue(value, ctx);
  }
  return out;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const spell = (value: Resolved): unknown => (value instanceof Date ? value.toISOString() : value);

// ── the whole bundle ────────────────────────────────────────────────────────

/** Every table of the bundle, as Adminium would have written it at `now`. */
export function resolveSample(bundle: SampleBundle, options: ResolveOptions): ResolvedSample {
  const ctx: Context = { ...options, labels: new Map() };
  const out: ResolvedSample = {};
  for (const table of bundle.tables) {
    const shape = COLUMNS[table.ref];
    if (shape === undefined) throw new Error(`"${table.ref}" is not a table of this app.`);
    const rows = (out[table.ref] ??= []);
    for (const row of table.rows) {
      const values = resolveRow(row, ctx);
      if (values === null) continue;
      for (const column of Object.keys(values)) {
        if (!(column in shape)) throw new Error(`"${table.ref}" has no column "${column}".`);
      }
      // The copied columns, read from the row they are copied through (written earlier).
      for (const copy of COPIES) {
        if (copy.table !== table.ref || (!copy.always && values[copy.column] !== undefined)) continue;
        const link = values[copy.via];
        const source = out["visit_types"]?.find((candidate) => candidate["id"] === link);
        if (source !== undefined) values[copy.column] = source[copy.from];
      }
      const id = rows.length + 1;
      const record: ResolvedRow = { id };
      for (const [column, fill] of Object.entries(shape)) {
        const value = values[column];
        if (value !== undefined) record[column] = spell(value);
        else if (fill === REQUIRED) throw new Error(`A sample row for "${table.ref}" has no "${column}".`);
        else record[column] = fill === NOW ? new Date(options.now).toISOString() : fill;
      }
      rows.push(record);
      const label = row["@label"];
      if (typeof label === "string") ctx.labels.set(label, id);
    }
  }
  settle(out);
  return out;
}

/** The totals a visit keeps, from every row that feeds them — last, as the loader does. */
function settle(out: ResolvedSample): void {
  const sums = (table: string, only: (row: ResolvedRow) => boolean) => {
    const by = new Map<unknown, number>();
    for (const row of out[table] ?? []) {
      if (!only(row)) continue;
      by.set(row["appointment_id"], (by.get(row["appointment_id"]) ?? 0) + Number(row["amount"]));
    }
    return by;
  };
  const paid = sums(ROLLUPS.paid.from, (row) => row[ROLLUPS.paid.unless] !== true);
  const waived = sums(ROLLUPS.waived.from, () => true);
  for (const visit of out[ROLLUPS.table] ?? []) {
    visit["paid"] = round2(paid.get(visit["id"]) ?? 0);
    visit["waived"] = round2(waived.get(visit["id"]) ?? 0);
    visit["balance"] = visit["fee"] === null ? null : round2(Number(visit["fee"]) - Number(visit["waived"]) - Number(visit["paid"]));
  }
}
