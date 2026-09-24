/**
 * The booking rule, for the demo only.
 *
 * A real install asks Adminium, whose booking rule judges every booking when
 * it is saved and answers every "which times are free?". The demo on the
 * website has no server, so this file answers the same questions the same
 * way, over the demo's in-memory practice: a clinician is never booked twice
 * at once, only inside their hours (their own, else the practice's), off the
 * break, on the grid, not on a closed day, not in the past (bar a walk-in's
 * current slot), within the booking window of working days, and — for a
 * patient — far enough ahead. "Anyone" is the first eligible clinician, in
 * their order, who is free.
 *
 * It is only ever bundled into the demo build (`DEMO` folds it away
 * everywhere else), so nothing a real practice runs depends on it.
 */
import type { Appointment, Clinician, ClinicianHours, ClinicianVisitType, Closure, Day, Id, OpeningHours, Settings, Weekday } from "../data/types.ts";
import { COUNTED } from "../data/types.ts";
import { addDays, venueDay, venueStamp, venueTime } from "../data/venueTime.ts";
import type { DayState, SlotTime } from "../data/ports.ts";

export type Refusal = "BOOKING_TAKEN" | "BOOKING_CLOSED" | "BOOKING_OUT_OF_HOURS" | "BOOKING_OUT_OF_RANGE" | "BOOKING_NOT_OFFERED";
const NEARNESS: Record<Refusal, number> = { BOOKING_NOT_OFFERED: 0, BOOKING_OUT_OF_RANGE: 1, BOOKING_OUT_OF_HOURS: 2, BOOKING_CLOSED: 3, BOOKING_TAKEN: 4 };

export interface Practice {
  settings: Settings | null;
  hours: OpeningHours[];
  clinicians: Clinician[];
  links: ClinicianVisitType[];
  clinicianHours: ClinicianHours[];
  closures: Closure[];
  appointments: Appointment[];
}

interface Span {
  opens: number;
  closes: number;
  breakStart: number | null;
  breakEnd: number | null;
}

const WEEK: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const weekdayOf = (day: Day): Weekday => WEEK[new Date(`${day}T00:00:00Z`).getUTCDay()]!;
const minuteOf = (hhmm: string | null): number | null => {
  if (hhmm === null || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const clockOf = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

function span(row: { opens: string; closes: string; break_start: string | null; break_end: string | null } | undefined, open = true): Span | null {
  if (row === undefined || !open) return null;
  const opens = minuteOf(row.opens);
  const closes = minuteOf(row.closes);
  if (opens === null || closes === null || closes <= opens) return null;
  return { opens, closes, breakStart: minuteOf(row.break_start), breakEnd: minuteOf(row.break_end) };
}

/** The practice's hours on a weekday; null when it is shut. */
export function practiceHours(practice: Practice, day: Day): Span | null {
  const row = practice.hours.find((h) => h.weekday === weekdayOf(day));
  return span(row, row?.open ?? false);
}

/** A clinician's hours that day: their own when they keep any, else the practice's. */
export function hoursOf(practice: Practice, clinician: Id, day: Day): Span | null {
  const own = practice.clinicianHours.filter((h) => h.clinician_id === clinician);
  if (own.length === 0) return practiceHours(practice, day);
  return span(own.find((h) => h.weekday === weekdayOf(day)));
}

/** Who is closed on a day: `null` in the set means the whole practice. */
function closedOn(practice: Practice, day: Day): Set<Id | null> {
  const out = new Set<Id | null>();
  for (const c of practice.closures) if (c.active && c.from_date <= day && day <= c.to_date) out.add(c.clinician_id);
  return out;
}

/** Working days from `today` to `day`, both counted: days with hours the practice has not closed. */
function workingDaysTo(practice: Practice, today: Day, day: Day): number {
  let n = 0;
  for (let d = today; d <= day && n <= 400; d = addDays(d, 1)) {
    if (practiceHours(practice, d) !== null && !closedOn(practice, d).has(null)) n += 1;
  }
  return n;
}

export interface Ask {
  zone: string;
  now: number;
  /** A patient's write: bookable-online clinicians only, and the notice applies. */
  isPublic: boolean;
  /** The visit being moved, whose own time does not count against it. */
  exclude?: Id | null;
  /** A desk create already in the building (a walk-in): may take the slot holding now. */
  walkIn?: boolean;
}

function eligible(practice: Practice, kind: Id): Clinician[] {
  const who = new Set(practice.links.filter((l) => l.visit_type_id === kind).map((l) => l.clinician_id));
  return practice.clinicians.filter((c) => who.has(c.id)).sort((a, b) => a.position - b.position || a.id - b.id);
}

function judge(practice: Practice, clinician: Clinician, day: Day, start: number, minutes: number, ask: Ask): Refusal | null {
  const hours = hoursOf(practice, clinician.id, day);
  const minute = minuteOf(venueTime(start, ask.zone))!;
  const grid = Math.max(1, practice.settings?.slot_minutes ?? 15);
  if (
    hours === null ||
    minute < hours.opens ||
    minute + minutes > hours.closes ||
    (minute - hours.opens) % grid !== 0 ||
    (hours.breakStart !== null && hours.breakEnd !== null && minute < hours.breakEnd && minute + minutes > hours.breakStart)
  ) {
    return "BOOKING_OUT_OF_HOURS";
  }
  const closed = closedOn(practice, day);
  if (closed.has(null) || closed.has(clinician.id)) return "BOOKING_CLOSED";
  const end = start + minutes * 60_000;
  for (const other of practice.appointments) {
    if (other.clinician_id !== clinician.id || other.id === ask.exclude || !COUNTED.includes(other.status)) continue;
    const from = Date.parse(other.starts_at);
    if (from < end && from + other.minutes * 60_000 > start) return "BOOKING_TAKEN";
  }
  return null;
}

function judgeDay(practice: Practice, day: Day, start: number, ask: Ask): Refusal | null {
  const settings = practice.settings;
  const grid = Math.max(1, settings?.slot_minutes ?? 15);
  if (start < ask.now && !(ask.walkIn === true && !ask.isPublic && ask.now < start + grid * 60_000)) return "BOOKING_OUT_OF_RANGE";
  const today = venueDay(ask.now, ask.zone);
  if (settings !== null && workingDaysTo(practice, today, day) > settings.booking_days) return "BOOKING_OUT_OF_RANGE";
  if (ask.isPublic && settings !== null && start - ask.now < settings.min_notice_minutes * 60_000) return "BOOKING_OUT_OF_RANGE";
  return null;
}

/**
 * Whether a visit can be booked: null, or the refusal; and for "anyone", who
 * it goes to.
 */
export function checkBooking(
  practice: Practice,
  visit: { kind: Id; clinician: Id | null; startsAt: string; minutes: number },
  ask: Ask,
): { ok: true; clinician: Id } | { ok: false; refusal: Refusal } {
  const start = Date.parse(visit.startsAt);
  const day = venueDay(start, ask.zone);
  const dayIssue = judgeDay(practice, day, start, ask);
  if (dayIssue !== null) return { ok: false, refusal: dayIssue };
  const people = eligible(practice, visit.kind);
  if (visit.clinician !== null) {
    const person = people.find((c) => c.id === visit.clinician);
    if (person === undefined || !person.active || (ask.isPublic && !person.bookable_online)) return { ok: false, refusal: "BOOKING_NOT_OFFERED" };
    const issue = judge(practice, person, day, start, visit.minutes, ask);
    return issue === null ? { ok: true, clinician: person.id } : { ok: false, refusal: issue };
  }
  let nearest: Refusal = "BOOKING_NOT_OFFERED";
  for (const person of people) {
    if (!person.active || (ask.isPublic && !person.bookable_online)) continue;
    const issue = judge(practice, person, day, start, visit.minutes, ask);
    if (issue === null) return { ok: true, clinician: person.id };
    if (NEARNESS[issue] > NEARNESS[nearest]) nearest = issue;
  }
  return { ok: false, refusal: nearest };
}

/** A day's times for a visit type: offered when someone works then, free when one of them could be booked. */
export function slots(practice: Practice, kind: Id, minutes: number, day: Day, resource: Id | "any", ask: Ask): SlotTime[] {
  const people = eligible(practice, kind).filter(
    (c) => (resource === "any" || c.id === resource) && c.active && (!ask.isPublic || c.bookable_online),
  );
  const offered = new Map<number, Id | null>();
  for (const person of people) {
    const hours = hoursOf(practice, person.id, day);
    if (hours === null) continue;
    const grid = Math.max(1, practice.settings?.slot_minutes ?? 15);
    for (let minute = hours.opens; minute + minutes <= hours.closes; minute += grid) {
      const start = venueStamp(day, clockOf(minute), ask.zone);
      const issue = judge(practice, person, day, start, minutes, ask);
      if (issue === "BOOKING_OUT_OF_HOURS" || issue === "BOOKING_CLOSED" || issue === "BOOKING_NOT_OFFERED") continue;
      const free = issue === null && judgeDay(practice, day, start, ask) === null;
      if (!offered.has(minute)) offered.set(minute, free ? person.id : null);
      else if (offered.get(minute) === null && free) offered.set(minute, person.id);
    }
  }
  return [...offered.entries()]
    .sort(([a], [b]) => a - b)
    .map(([minute, free]) => ({
      time: clockOf(minute),
      state: free === null ? ("full" as const) : ("free" as const),
      ...(!ask.isPublic && resource === "any" && free !== null ? { resource: free } : {}),
    }));
}

/** A strip of days, each open (with how many free times), full or closed. */
export function days(practice: Practice, kind: Id, minutes: number, from: Day, count: number, resource: Id | "any", ask: Ask): DayState[] {
  const today = venueDay(ask.now, ask.zone);
  const out: DayState[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = addDays(from, i);
    const times = slots(practice, kind, minutes, date, resource, ask);
    const open = times.filter((t) => t.state === "free").length;
    const window = practice.settings?.booking_days ?? null;
    const bookable = date >= today && (window === null || workingDaysTo(practice, today, date) <= window);
    out.push({ date, open, state: open > 0 ? "open" : times.length > 0 && bookable ? "full" : "closed" });
  }
  return out;
}
