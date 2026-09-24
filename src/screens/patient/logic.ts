/**
 * What the patients' pages work out for themselves, as plain functions: how
 * much of a name "Found you" may show, how many calendar days the booking
 * window covers, where morning ends, the nearest free times to one that has
 * just gone, whether a visit is inside the cancellation window, the practice's
 * opening hours in a few lines, the questions with the practice's numbers
 * filled in, the calendar file, and which words a refusal gets.
 *
 * None of it decides whether a time is free or a visit may move — the server
 * does. These only shape what the server said for a person to read.
 */
import type { SlotTime } from "../../data/ports.ts";
import type { Closure, Day, Hhmm, Instant, OpeningHours, Settings, Weekday } from "../../data/types.ts";
import { addDays, weekday as weekdayIndex } from "../../data/venueTime.ts";

const WEEK: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const weekdayOf = (day: Day): Weekday => WEEK[weekdayIndex(day)]!;

const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

// ── names ───────────────────────────────────────────────────────────────────

/** "Cormac E.": the first name and the last name's initial — all "Found you" shows. */
export function firstAndInitial(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p !== "");
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]!} ${parts[parts.length - 1]!.charAt(0)}.`;
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

// ── the booking window ──────────────────────────────────────────────────────

/** Whether the whole practice works that day: it has open hours and no whole-practice closure. */
export function practiceWorks(hours: readonly OpeningHours[], closures: readonly Closure[], day: Day): boolean {
  const row = hours.find((h) => h.weekday === weekdayOf(day));
  if (row === undefined || !row.open) return false;
  return !closures.some((c) => c.active && c.clinician_id === null && c.from_date <= day && day <= c.to_date);
}

/**
 * How many calendar days, from today, hold `workingDays` days the practice
 * works — the strip the patient picks from. The server answers at most 31
 * days in one strip, so it never asks for more.
 */
export function windowSpan(hours: readonly OpeningHours[], closures: readonly Closure[], today: Day, workingDays: number): number {
  const want = Math.max(1, workingDays);
  let worked = 0;
  for (let i = 0; i < 31; i += 1) {
    if (practiceWorks(hours, closures, addDays(today, i))) worked += 1;
    if (worked >= want) return i + 1;
  }
  return 31;
}

/** Where morning ends on a day: the lunch close's start, or noon when the day has none. */
export function morningEnds(hours: readonly OpeningHours[], day: Day): number {
  const row = hours.find((h) => h.weekday === weekdayOf(day));
  return row?.break_start ? minutesOf(row.break_start) : 12 * 60;
}

export interface SlotView {
  time: Hhmm;
  free: boolean;
  /** Before now on the practice's clock ("has passed"), rather than taken. */
  passed: boolean;
  /** Inside the practice's notice for online bookings: not taken, just too soon to book online. */
  soon: boolean;
}

/**
 * A day's times as the page draws them, split into morning and afternoon.
 * `now` and `notice` are `YYYY-MM-DDTHH:MM` on the practice's clock: a time
 * before `now` has passed; a time the server calls full before `notice` is
 * too soon to book online, not taken.
 */
export function groupTimes(times: readonly SlotTime[], split: number, day: Day, now: string, notice: string): { morning: SlotView[]; afternoon: SlotView[] } {
  const view = times.map((t): SlotView => {
    const at = `${day}T${t.time}`;
    const passed = at < now;
    const soon = !passed && t.state === "full" && at < notice;
    return { time: t.time, free: t.state === "free" && !passed, passed, soon };
  });
  return { morning: view.filter((s) => minutesOf(s.time) < split), afternoon: view.filter((s) => minutesOf(s.time) >= split) };
}

/** The (up to) three free times nearest to one that has just gone, earliest first. */
export function nearestFree(times: readonly SlotTime[], gone: Hhmm, count = 3): Hhmm[] {
  const at = minutesOf(gone);
  return times
    .filter((t) => t.state === "free" && t.time !== gone)
    .map((t) => t.time)
    .sort((a, b) => Math.abs(minutesOf(a) - at) - Math.abs(minutesOf(b) - at) || minutesOf(a) - minutesOf(b))
    .slice(0, count)
    .sort((a, b) => minutesOf(a) - minutesOf(b));
}

/** Whether a visit starts within the cancellation window (moving is then for the desk, cancelling is late). */
export function insideWindow(startsAt: Instant, nowMs: number, cancelHours: number): boolean {
  return Date.parse(startsAt) - nowMs < cancelHours * 3_600_000;
}

/** How far away a visit is, for "next visit 2 days away": the unit and the amount. */
export function howFar(startsAt: Instant, nowMs: number): { unit: "min" | "hours" | "days"; n: number } {
  const mins = Math.max(0, Math.round((Date.parse(startsAt) - nowMs) / 60_000));
  if (mins < 60) return { unit: "min", n: mins };
  if (mins < 1440) return { unit: "hours", n: Math.round(mins / 60) };
  return { unit: "days", n: Math.round(mins / 1440) };
}

// ── opening hours, in a few lines ───────────────────────────────────────────

export type HoursRow =
  | { kind: "weekdays"; opens: Hhmm; closes: Hhmm }
  | { kind: "deskClosed"; from: Hhmm; to: Hhmm }
  | { kind: "day"; weekday: Weekday; opens: Hhmm; closes: Hhmm; breakFrom: Hhmm | null; breakTo: Hhmm | null }
  | { kind: "dayClosed"; weekday: Weekday }
  | { kind: "weekendClosed" };

const same = (a: OpeningHours | undefined, b: OpeningHours | undefined): boolean =>
  a !== undefined && b !== undefined && a.open === b.open && a.opens === b.opens && a.closes === b.closes && a.break_start === b.break_start && a.break_end === b.break_end;

/**
 * The practice's week as the design writes it: "Monday to Friday 08:30 – 17:30"
 * and "Desk closed 12:30 – 13:15" when the five weekdays match, else a line a
 * day; then the weekend, as one "closed" line when both are shut.
 */
export function hoursRows(hours: readonly OpeningHours[]): HoursRow[] {
  const of = (d: Weekday) => hours.find((h) => h.weekday === d);
  const rows: HoursRow[] = [];
  const mon = of("mon");
  const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
  if (mon?.open === true && weekdays.every((d) => same(of(d), mon))) {
    rows.push({ kind: "weekdays", opens: mon.opens, closes: mon.closes });
    if (mon.break_start !== null && mon.break_end !== null) rows.push({ kind: "deskClosed", from: mon.break_start, to: mon.break_end });
  } else {
    for (const d of weekdays) {
      const h = of(d);
      rows.push(h?.open === true ? { kind: "day", weekday: d, opens: h.opens, closes: h.closes, breakFrom: h.break_start, breakTo: h.break_end } : { kind: "dayClosed", weekday: d });
    }
  }
  const sat = of("sat");
  const sun = of("sun");
  if (sat?.open !== true && sun?.open !== true) rows.push({ kind: "weekendClosed" });
  else
    for (const [d, h] of [["sat", sat], ["sun", sun]] as const) {
      rows.push(h?.open === true ? { kind: "day", weekday: d, opens: h.opens, closes: h.closes, breakFrom: null, breakTo: null } : { kind: "dayClosed", weekday: d });
    }
  return rows;
}

// ── questions ───────────────────────────────────────────────────────────────

/** A question's answer with the practice's own numbers where it says `{phone}`, `{no_show_minutes}`, `{cancel_hours}`. */
export function fillPractice(text: string, settings: Pick<Settings, "phone" | "no_show_minutes" | "cancel_hours"> | null): string {
  if (settings === null) return text;
  return text
    .replaceAll("{phone}", settings.phone)
    .replaceAll("{no_show_minutes}", String(settings.no_show_minutes))
    .replaceAll("{cancel_hours}", String(settings.cancel_hours));
}

// ── the calendar file ───────────────────────────────────────────────────────

/** Text in an iCalendar value: backslash, semicolon, comma and line breaks escaped. */
export const icsText = (value: string): string => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** An instant as iCalendar's UTC form, `20260730T080000Z`. */
export const icsInstant = (ms: number): string => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** A name as a file or host fragment: `Rowan Health` → `rowan-health`. */
export const slugOf = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "visit";

/**
 * The booked visit as a calendar file. The start and end are UTC instants, so
 * a phone in any zone puts the visit at the practice's own 09:00; the
 * practice's name marks the file as theirs.
 */
export function buildIcs(visit: { ref: string; startsAt: Instant; minutes: number; summary: string; location: string; description: string; practice: string; stampedAt: number }): string {
  const start = Date.parse(visit.startsAt);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${icsText(visit.practice)}//Booking//EN`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${visit.ref}@${slugOf(visit.practice)}`,
    `DTSTAMP:${icsInstant(visit.stampedAt)}`,
    `DTSTART:${icsInstant(start)}`,
    `DTEND:${icsInstant(start + visit.minutes * 60_000)}`,
    `SUMMARY:${icsText(visit.summary)}`,
    `LOCATION:${icsText(visit.location)}`,
    `DESCRIPTION:${icsText(visit.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

// ── refusals, in the page's words ───────────────────────────────────────────

/**
 * What a failed lookup says. Every miss — nobody, two people sharing the
 * details, the lookup unavailable — reads the same, so the page never tells
 * which of the two details was wrong.
 */
export type LookupProblem = "notFound" | "tooMany" | "proof" | "offline" | "closed";
export function lookupProblem(code: string): LookupProblem {
  switch (code) {
    // Only a volume refusal differs: it says nothing about the details typed.
    // A locked record reads as "not found" too, so a lock never confirms a match.
    case "PUBLIC_RATE_LIMITED":
      return "tooMany";
    case "PUBLIC_PROOF_REQUIRED":
      return "proof";
    case "PUBLIC_SWITCHED_OFF":
    case "PUBLIC_API_DISABLED":
    case "SURFACE_OFF":
    case "APP_DISABLED":
    case "PUBLIC_KEY_OFF":
      return "closed";
    case "PUBLIC_NETWORK_UNAVAILABLE":
    case "PUBLIC_UPSTREAM_UNAVAILABLE":
      return "offline";
    default:
      return "notFound";
  }
}

/** What a code step says after the server answered. */
export type CodeProblem = "wrong" | "locked" | "dayLocked" | "expired" | "tooSoon" | "limit" | "noEmail" | "stepUp" | "changeLimit" | "sessionEnded" | "offline";
export function codeProblem(code: string): CodeProblem {
  switch (code) {
    case "PUBLIC_CODE_WRONG":
    case "PUBLIC_CODE_LOCKED":
      return "locked";
    case "PUBLIC_CLAIM_LOCKED":
      return "dayLocked";
    case "PUBLIC_CODE_EXPIRED":
      return "expired";
    case "PUBLIC_CODE_TOO_SOON":
    case "PUBLIC_RATE_LIMITED":
      return "tooSoon";
    case "PUBLIC_CODE_LIMIT":
    case "PUBLIC_CODE_UNAVAILABLE":
      return "limit";
    case "PUBLIC_CLAIM_NO_EMAIL":
      return "noEmail";
    case "PUBLIC_CODE_STEP_UP":
      return "stepUp";
    case "PUBLIC_EMAIL_CHANGE_LIMIT":
      return "changeLimit";
    case "PUBLIC_CLAIM_LEVEL":
    case "PUBLIC_CLAIM_REQUIRED":
    case "PUBLIC_CLAIM_NO_MATCH":
      return "sessionEnded";
    default:
      return "offline";
  }
}

/** Whether a refusal means the patient's session has ended (they find themselves again). */
export const sessionEnded = (code: string): boolean => code === "PUBLIC_CLAIM_LEVEL" || code === "PUBLIC_CLAIM_REQUIRED";

/** What a booking or a move says when the server refuses it. */
export type BookProblem = "gone" | "tooLate" | "limit" | "switchedOff" | "sessionEnded" | "proof" | "invalid" | "offline";
export function bookProblem(code: string, params: Record<string, unknown> = {}): BookProblem {
  switch (code) {
    case "PUBLIC_SLOT_FULL":
    case "PUBLIC_SLOT_BUSY":
      return "gone";
    case "PUBLIC_TOO_LATE":
      return "tooLate";
    case "PUBLIC_LIMIT_REACHED":
      return "limit";
    case "PUBLIC_SWITCHED_OFF":
      return "switchedOff";
    case "PUBLIC_CLAIM_LEVEL":
    case "PUBLIC_CLAIM_REQUIRED":
      return "sessionEnded";
    case "PUBLIC_PROOF_REQUIRED":
      return "proof";
    case "PUBLIC_WRITE_REFUSED": {
      const reason = String(params["reason"] ?? "");
      return reason === "out-of-range" || reason === "closed" || reason === "out-of-hours" ? "gone" : "invalid";
    }
    case "PUBLIC_WRITE_REJECTED":
    case "PUBLIC_QUERY_REFUSED":
      return "invalid";
    default:
      return "offline";
  }
}

// ── form checks ─────────────────────────────────────────────────────────────

/** A date of birth as the fields take it: `YYYY-MM-DD`, a real day, not in the future. */
export function isBirthDay(value: string, today: Day): boolean {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d && v <= today && y >= 1900;
}

/** A mobile with enough digits to be one. */
export const isMobile = (value: string): boolean => value.replace(/\D/g, "").length >= 9;

/** An email address, loosely: something@something.tld. */
export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** The design's rule for a new person's details: a name, a date of birth and a mobile. */
export const personReady = (p: { name: string; bornOn: string; mobile: string }, today: Day): boolean =>
  p.name.trim().length > 2 && isBirthDay(p.bornOn, today) && isMobile(p.mobile);
