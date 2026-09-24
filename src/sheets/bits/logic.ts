/**
 * The small decisions the desk's sheets make before they save anything: an
 * amount as typed, the walk-in's "now", the day a moved visit should land
 * on, what a closure would clash with, whether a day's hours make sense, and
 * which Registrations tab an item belongs to.
 *
 * Pure functions over what the desk holds, so each can be tested without a
 * screen. None of them decides whether a time can be booked: the server's
 * booking rule does, and a sheet only uses these to ask a better question.
 */
import type { Appointment, CheckNote, Closure, Day, Id, Registration } from "../../data/types.ts";
import { COUNTED } from "../../data/types.ts";
import { addDays, venueStamp } from "../../data/venueTime.ts";
import { practiceZone } from "../../lib/clock.ts";
import { clinicianOf, closureOn, cliniciansFor, hoursOf, practiceHours, typeOf, type Span } from "../../lib/desk.ts";
import { clockOf, daysBetween, dayOf, hhmmOf, minutesOf } from "../../lib/format.ts";
import type { DeskState } from "../../state/desk.ts";

// ── money as typed ──────────────────────────────────────────────────────────

/**
 * An amount as someone typed it, in any of the desk's languages: "12.50",
 * "12,50", "£ 12.50", "1 234,5". Null when there is no number in it.
 *
 * A comma is the decimal mark when it is the last separator and two or fewer
 * digits follow it; otherwise separators are grouping and are dropped.
 */
export function parseAmount(text: string): number | null {
  const kept = text.replace(/[^\d.,]/g, "");
  if (!/\d/.test(kept)) return null;
  const lastSep = Math.max(kept.lastIndexOf("."), kept.lastIndexOf(","));
  let whole = kept;
  let fraction = "";
  if (lastSep !== -1) {
    const after = kept.slice(lastSep + 1);
    if (after.length <= 2) {
      whole = kept.slice(0, lastSep);
      fraction = after;
    }
  }
  const value = Number(`${whole.replace(/[.,]/g, "") || "0"}.${fraction || "0"}`);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

/** Half a balance, to the cent. */
export const halfOf = (balance: number): number => Math.round((balance / 2) * 100) / 100;

// ── the walk-in's "now" ─────────────────────────────────────────────────────

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/** Whether `[start, start + minutes)` fits in a day's span, off its break and on its grid. */
function fitsSpan(span: Span | null, start: number, minutes: number, grid: number): boolean {
  if (span === null) return false;
  if (start < span.opens || start + minutes > span.closes) return false;
  if ((start - span.opens) % grid !== 0) return false;
  if (span.breakStart !== null && span.breakEnd !== null && overlaps(start, start + minutes, span.breakStart, span.breakEnd)) return false;
  return true;
}

/**
 * Someone standing at the desk: the slot holding now (the grid start at or
 * before now), with the first clinician — the one chosen, or the first in
 * order who does the visit — who is in, not closed, and has nothing booked
 * over it. Null when nobody is.
 *
 * The server's free-times read never offers this slot (it has already
 * begun), so the desk judges it from what it holds; the booking rule still
 * has the last word when the visit is saved.
 */
export function walkInNow(s: DeskState, typeId: Id, clinicianId: Id | null, nowMs: number): { startsAt: string; clinicianId: Id } | null {
  const type = typeOf(s, typeId);
  if (type === undefined) return null;
  const day = dayOf(nowMs);
  const grid = Math.max(1, s.settings?.slot_minutes ?? 15);
  const minute = minutesOf(hhmmOf(nowMs));
  const people = cliniciansFor(s, typeId).filter((c) => clinicianId === null || c.id === clinicianId);
  for (const person of people) {
    const span = hoursOf(s, person.id, day);
    if (span === null || closureOn(s, day, person.id) !== undefined) continue;
    const start = span.opens + Math.floor((minute - span.opens) / grid) * grid;
    if (minute < span.opens || !fitsSpan(span, start, type.minutes, grid)) continue;
    const startsAt = new Date(venueStamp(day, clockOf(start), practiceZone())).toISOString();
    const from = Date.parse(startsAt);
    const to = from + type.minutes * 60_000;
    const busy = Object.values(s.visits).some(
      (v) => v.clinician_id === person.id && COUNTED.includes(v.status) && overlaps(from, to, Date.parse(v.starts_at), Date.parse(v.starts_at) + v.minutes * 60_000),
    );
    if (!busy) return { startsAt, clinicianId: person.id };
  }
  return null;
}

// ── days ────────────────────────────────────────────────────────────────────

/** Whether the practice (and the clinician, when given) is in on a day, with no closure. */
export function isOpenDay(s: DeskState, day: Day, clinicianId: Id | null): boolean {
  const span = clinicianId === null ? practiceHours(s, day) : hoursOf(s, clinicianId, day);
  return span !== null && closureOn(s, day, clinicianId) === undefined;
}

/**
 * Where to put a visit moved out of a closure: the first day after it that
 * the clinician is in and nothing is closed, looked for up to two weeks; the
 * day after the closure when none is found.
 */
export function nextOpenDay(s: DeskState, after: Day, clinicianId: Id | null, withinDays = 14): Day {
  for (let i = 1; i <= withinDays; i += 1) {
    const day = addDays(after, i);
    if (isOpenDay(s, day, clinicianId)) return day;
  }
  return addDays(after, 1);
}

/**
 * The last day the booking rule will take: `booking_days` days the practice
 * opens, counted from today (today counts when it opens). Null when the
 * practice sets no window or never opens in the next year.
 */
export function lastBookableDay(s: DeskState, today: Day): Day | null {
  const window = s.settings?.booking_days;
  if (window === undefined || window === null) return null;
  let counted = 0;
  let last: Day | null = null;
  for (let i = 0; i < 366 && counted < window; i += 1) {
    const day = addDays(today, i);
    if (practiceHours(s, day) !== null) {
      counted += 1;
      last = day;
    }
  }
  return last;
}

// ── closures ────────────────────────────────────────────────────────────────

/** The longest closure the sheet reads the diary for, in days. */
export const LONGEST_CLOSURE = 92;

export interface ClosureRange {
  clinicianId: Id | null;
  from: Day;
  to: Day;
}

/** The booked visits a closure would sit on, earliest first. Only booked ones: a visit already seen or cancelled is history. */
export function closureClashes(visits: Iterable<Appointment>, range: ClosureRange): Appointment[] {
  return [...visits]
    .filter((v) => v.status === "booked")
    .filter((v) => {
      const day = dayOf(v.starts_at);
      return day >= range.from && day <= range.to && (range.clinicianId === null || v.clinician_id === range.clinicianId);
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id);
}

export type DateProblem = "missing" | "backwards" | "tooLong" | null;

/** What is wrong with a closure's dates, if anything. */
export function closureDates(from: string, to: string): DateProblem {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to)) return "missing";
  if (to < from) return "backwards";
  if (daysBetween(from, to) + 1 > LONGEST_CLOSURE) return "tooLong";
  return null;
}

/** Whether two id lists hold the same ids. */
export function sameIds(a: readonly Id[], b: readonly Id[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/** The closure an earlier try of this action saved, if any. */
export const savedByKey = <T extends { client_key: string | null }>(rows: Iterable<T>, key: string): T | undefined => [...rows].find((r) => r.client_key === key);

export const closureSaved = (s: DeskState, key: string): Closure | undefined => savedByKey(s.closures, key);

// ── hours ───────────────────────────────────────────────────────────────────

export interface HoursRow {
  open: boolean;
  opens: string;
  closes: string;
  /** Empty: no desk close that day. */
  breakStart: string;
  breakEnd: string;
}

export type HoursProblem = "closesFirst" | "breakBackwards" | "breakOutside" | "breakHalf" | null;

/** What is wrong with a day's hours, as the design words it. */
export function hoursProblem(row: HoursRow): HoursProblem {
  if (!row.open) return null;
  const opens = minutesOf(row.opens);
  const closes = minutesOf(row.closes);
  if (closes <= opens) return "closesFirst";
  if ((row.breakStart === "") !== (row.breakEnd === "")) return "breakHalf";
  if (row.breakStart === "") return null;
  const bf = minutesOf(row.breakStart);
  const bt = minutesOf(row.breakEnd);
  if (bt <= bf) return "breakBackwards";
  if (bf < opens || bt > closes) return "breakOutside";
  return null;
}

/** The times a day's hours may be set to: 06:00 to 22:00 on the practice's grid. */
export function hourOptions(grid: number): string[] {
  const step = grid > 0 && grid <= 60 ? grid : 15;
  const out: string[] = [];
  for (let m = 6 * 60; m <= 22 * 60; m += step) out.push(clockOf(m));
  return out;
}

// ── registrations ───────────────────────────────────────────────────────────

export type RegTab = "check" | "rang" | "done";

/** One thing on the Registrations screen: a registration, or a first visit booked online. */
export type RegItem =
  | { kind: "registration"; id: Id; row: Registration; tab: RegTab; since: string | null }
  | { kind: "visit"; id: Id; row: Appointment; tab: RegTab; since: string | null };

/** How far back the Done tab reaches, in days. */
export const DONE_DAYS = 14;

/**
 * Everything Registrations lists, each in its tab, oldest first: new and
 * rang registrations and first visits, and the last two weeks' handled ones.
 * A first visit the patient cancelled before anyone checked it is gone.
 */
export function registrationItems(s: DeskState, today: Day): RegItem[] {
  const since = addDays(today, -DONE_DAYS);
  const items: RegItem[] = [];
  for (const row of Object.values(s.registrations)) {
    const tab: RegTab = row.status === "new" ? "check" : row.status === "rang" ? "rang" : "done";
    if (tab === "done" && row.handled_at !== null && dayOf(row.handled_at) < since) continue;
    items.push({ kind: "registration", id: row.id, row, tab, since: row.created_at });
  }
  for (const row of Object.values(s.visits)) {
    if (row.check_status === null) continue;
    const tab: RegTab = row.check_status === "to_check" ? "check" : row.check_status === "rang" ? "rang" : "done";
    if (tab !== "done" && row.status === "cancelled") continue;
    items.push({ kind: "visit", id: row.id, row, tab, since: row.created_at });
  }
  return items.sort((a, b) => (a.since ?? "").localeCompare(b.since ?? "") || a.id - b.id);
}

/** The notes written on an item, oldest first. */
export function notesOf(s: DeskState, item: { kind: "registration" | "visit"; id: Id }): CheckNote[] {
  return Object.values(s.notes)
    .filter((n) => (item.kind === "registration" ? n.registration_id === item.id : n.appointment_id === item.id))
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id - b.id);
}

/** The person an item is about, whichever table it came from. */
export function personOf(item: RegItem): { name: string; bornOn: Day | null; mobile: string; email: string | null } {
  if (item.kind === "registration") return { name: item.row.name, bornOn: item.row.born_on, mobile: item.row.mobile, email: item.row.email };
  return { name: item.row.new_name ?? "", bornOn: item.row.new_born_on, mobile: item.row.new_mobile ?? "", email: item.row.new_email };
}

/**
 * The key an Accept on this item writes its patient with — the same on every
 * try, from every desk: a retry, a sheet opened again or a second desk
 * accepting at the same moment all find the one patient instead of making a
 * second (a patient reception cannot delete). 36 characters, as the column
 * holds; the step letter replaces the first.
 */
export function acceptKey(item: { kind: "registration" | "visit"; id: Id }): string {
  return `0accept-${item.kind}-${String(item.id)}-`.padEnd(36, "0").slice(0, 36);
}

/** A clinician's short name, or nothing. */
export const shortOf = (s: DeskState, id: Id | null): string => clinicianOf(s, id)?.short_name ?? "";
