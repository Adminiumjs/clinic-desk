/**
 * What the day sheet, the waiting room and the week diary work out from the
 * desk's rows — the time rail, a column's shut stretches, who is waiting and
 * how long, who has not come, which way a visit may move next, and a week's
 * cells — as pure functions, so each can be tested without a screen.
 *
 * Every number here is read on the practice's clock and from the practice's
 * own hours: the rail runs from the earliest opening to the latest closing of
 * that day (the practice's and every clinician's own), the lunch band is that
 * clinician's own break, and a clinician with no hours that day is "not in".
 * Nothing here decides whether a time is free — the server's booking rule does,
 * and the screens only ask it.
 */
import type { Appointment, AppointmentStatus, Closure, Day, DeskRole, Id, Instant } from "../../data/types.ts";
import { COUNTED, IN_THE_BUILDING } from "../../data/types.ts";
import { addDays, weekday } from "../../data/venueTime.ts";
import { activeClinicians, closureOn, hoursOf, practiceHours, weekdayOf, type Span } from "../../lib/desk.ts";
import { minutesOf } from "../../lib/format.ts";
import type { DeskState } from "../../state/desk.ts";

/** Height of a quarter of an hour on the day sheet, as the design draws it. */
export const QUARTER_PX = 64;
export const PX_PER_MINUTE = QUARTER_PX / 15;

// ── the rail ────────────────────────────────────────────────────────────────

export interface Rail {
  /** Minutes since midnight where the rail starts and ends. */
  opens: number;
  closes: number;
}

type HoursState = Pick<DeskState, "hours" | "clinicianHours" | "clinicians">;

/**
 * The day sheet's rail: from the earliest opening to the latest closing of
 * anyone that day, on the quarter hour. A day nobody works still draws the
 * practice's usual span for that weekday, so the page keeps its shape.
 */
export function railOf(s: HoursState, day: Day): Rail {
  const spans: Span[] = [];
  const practice = practiceHours(s as DeskState, day);
  if (practice !== null) spans.push(practice);
  for (const c of activeClinicians(s as DeskState)) {
    const own = hoursOf(s as DeskState, c.id, day);
    if (own !== null) spans.push(own);
  }
  if (spans.length === 0) {
    const row = s.hours.find((h) => h.weekday === weekdayOf(day));
    spans.push(row === undefined ? { opens: 540, closes: 1020, breakStart: null, breakEnd: null } : { opens: minutesOf(row.opens), closes: minutesOf(row.closes), breakStart: null, breakEnd: null });
  }
  const opens = Math.min(...spans.map((x) => x.opens));
  const closes = Math.max(...spans.map((x) => x.closes));
  return { opens: Math.floor(opens / 15) * 15, closes: Math.max(Math.ceil(closes / 15) * 15, Math.floor(opens / 15) * 15 + 60) };
}

/** Pixels from the top of the rail to a minute of the day. */
export const topOf = (minute: number, rail: Rail): number => (minute - rail.opens) * PX_PER_MINUTE;

/** The rail's quarter-hour marks: every quarter a row, the hours and half hours labelled. */
export function railMarks(rail: Rail): { minute: number; labelled: boolean; hour: boolean }[] {
  const out: { minute: number; labelled: boolean; hour: boolean }[] = [];
  for (let m = rail.opens; m < rail.closes; m += 15) out.push({ minute: m, labelled: m % 30 === 0, hour: m % 60 === 0 });
  return out;
}

// ── a clinician's column ────────────────────────────────────────────────────

export type ColumnState =
  | { kind: "open"; hours: Span }
  /** The whole practice is shut that day. */
  | { kind: "closed"; closure: Closure }
  /** This clinician is away (a closure of their own). */
  | { kind: "away"; closure: Closure }
  /** No hours that weekday. */
  | { kind: "notIn" };

export function columnState(s: Pick<DeskState, "hours" | "clinicianHours" | "closures" | "clinicians">, clinician: Id, day: Day): ColumnState {
  const closure = closureOn(s as DeskState, day, clinician);
  if (closure !== undefined) return closure.clinician_id === null ? { kind: "closed", closure } : { kind: "away", closure };
  const hours = hoursOf(s as DeskState, clinician, day);
  return hours === null ? { kind: "notIn" } : { kind: "open", hours };
}

/** The stretches of a column nobody can be booked into: before opening, the break, after closing — or all of it. */
export function shutBands(state: ColumnState, rail: Rail): { from: number; to: number; lunch: boolean }[] {
  if (state.kind !== "open") return [{ from: rail.opens, to: rail.closes, lunch: false }];
  const { opens, closes, breakStart, breakEnd } = state.hours;
  const out: { from: number; to: number; lunch: boolean }[] = [];
  if (opens > rail.opens) out.push({ from: rail.opens, to: opens, lunch: false });
  if (breakStart !== null && breakEnd !== null && breakEnd > breakStart) out.push({ from: breakStart, to: breakEnd, lunch: true });
  if (closes < rail.closes) out.push({ from: closes, to: rail.closes, lunch: false });
  return out;
}

/** The minutes someone can be booked in a span: opening to closing, less the break. */
export function openMinutes(span: Span): number {
  const lunch = span.breakStart !== null && span.breakEnd !== null ? Math.max(0, span.breakEnd - span.breakStart) : 0;
  return Math.max(0, span.closes - span.opens - lunch);
}

// ── the day's visits ────────────────────────────────────────────────────────

/** The visits that stand on a day: every status but cancelled. */
export const standing = (visits: readonly Appointment[]): Appointment[] => visits.filter((v) => v.status !== "cancelled");

export const inBuilding = (v: Appointment): boolean => IN_THE_BUILDING.includes(v.status);

/**
 * Who has not come: still booked, and more than the no-show window past
 * their start. Earliest first.
 */
export function notArrived(visits: readonly Appointment[], now: number, noShowMinutes: number): Appointment[] {
  return visits
    .filter((v) => v.status === "booked" && now - Date.parse(v.starts_at) > noShowMinutes * 60_000)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Whole minutes past a visit's start. */
export const minutesLate = (v: Appointment, now: number): number => Math.max(0, Math.floor((now - Date.parse(v.starts_at)) / 60_000));

/** How long someone has waited since they checked in, in whole minutes. */
export function waitMinutes(v: Pick<Appointment, "checked_in_at">, now: number): number {
  if (v.checked_in_at === null) return 0;
  return Math.max(0, Math.floor((now - Date.parse(v.checked_in_at)) / 60_000));
}

/** A wait's colour: amber from 20 minutes, red from 40. */
export const waitTone = (minutes: number): "fg" | "warn" | "danger" => (minutes >= 40 ? "danger" : minutes >= 20 ? "warn" : "fg");

/** Everyone in the building, longest here first. */
export function board(visits: readonly Appointment[]): Appointment[] {
  const at = (v: Appointment) => (v.checked_in_at === null ? Number.POSITIVE_INFINITY : Date.parse(v.checked_in_at));
  return visits.filter(inBuilding).sort((a, b) => at(a) - at(b) || a.starts_at.localeCompare(b.starts_at));
}

/** The longest and the average wait of the people in the building. */
export function waits(people: readonly Appointment[], now: number): { longest: number; average: number } {
  const all = people.map((v) => waitMinutes(v, now));
  if (all.length === 0) return { longest: 0, average: 0 };
  return { longest: Math.max(...all), average: Math.round(all.reduce((a, b) => a + b, 0) / all.length) };
}

// ── the next step ───────────────────────────────────────────────────────────

/** Where a visit goes next: booked → checked in → roomed → with the clinician → ready → seen. */
export const NEXT: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  booked: "checked_in",
  checked_in: "roomed",
  roomed: "with_clinician",
  with_clinician: "ready",
  ready: "seen",
};

/**
 * A clinician moves a visit only into a room, in with them, and ready to go.
 * The server lets their role update a visit at all; which way it may move is
 * the desk's to hold, so their screens offer these three steps and no others.
 */
const CLINICIAN_STEPS: readonly AppointmentStatus[] = ["roomed", "with_clinician", "ready"];

/** Whether this person may take a visit from `from` to its next step. */
export function mayAdvance(role: DeskRole | null, from: AppointmentStatus): boolean {
  const to = NEXT[from];
  if (to === undefined) return false;
  return role !== "clinician" || CLINICIAN_STEPS.includes(to);
}

export type PanelAction = "checkIn" | "advance" | "sendOff" | "move" | "noShow" | "cancel" | "patient" | "payment";

/**
 * The visit panel's buttons, in the design's order, for a visit and the
 * person looking at it. `update` / `pay` are what the server lets them do to
 * visits and payments; with no word from the server both are true and it
 * refuses what it refuses.
 */
export function panelActions(
  visit: Pick<Appointment, "status" | "patient_id" | "balance">,
  who: { role: DeskRole | null; update: boolean; pay: boolean; seePatients: boolean },
): PanelAction[] {
  const out: PanelAction[] = [];
  const st = visit.status;
  const clinician = who.role === "clinician";
  if (who.update) {
    if (st === "booked" && !clinician) out.push("checkIn");
    else if (st === "ready" && !clinician) out.push("sendOff");
    else if (st !== "booked" && st !== "ready" && mayAdvance(who.role, st)) out.push("advance");
    if (st === "booked" && !clinician) out.push("move", "noShow", "cancel");
  }
  if (visit.patient_id !== null && who.seePatients) out.push("patient");
  if (st === "seen" && visit.balance > 0 && who.pay && !clinician) out.push("payment");
  return out;
}

// ── cancelling ──────────────────────────────────────────────────────────────

/** Whether cancelling now falls inside the practice's cancellation window. */
export function insideWindow(startsAt: Instant, now: number, cancelHours: number): boolean {
  return Date.parse(startsAt) - now < cancelHours * 3_600_000;
}

// ── the week diary ──────────────────────────────────────────────────────────

/** The Monday of a day's week. */
export function mondayOf(day: Day): Day {
  const dow = weekday(day);
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

/** The days of a week the practice opens (a weekday with no hours is left out). */
export function weekDays(s: Pick<DeskState, "hours">, monday: Day): Day[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => practiceHours(s as DeskState, d) !== null);
}

export type WeekCell =
  | { kind: "closed" }
  | { kind: "away" }
  | { kind: "notIn" }
  /** Working: how many visits, and how much of their own hours those take (0–100). */
  | { kind: "working"; visits: number; percent: number };

/**
 * One clinician's day in the week diary: the practice or they are shut, they
 * do not work that day, or how many visits they have and how much of their
 * own open minutes those fill. No-shows and cancellations take no time.
 */
export function weekCell(s: Pick<DeskState, "hours" | "clinicianHours" | "closures" | "clinicians">, visits: readonly Appointment[], clinician: Id, day: Day): WeekCell {
  const state = columnState(s, clinician, day);
  if (state.kind === "closed") return { kind: "closed" };
  if (state.kind === "away") return { kind: "away" };
  if (state.kind === "notIn") return { kind: "notIn" };
  const own = openMinutes(state.hours);
  if (own <= 0) return { kind: "notIn" };
  const mine = visits.filter((v) => v.clinician_id === clinician && COUNTED.includes(v.status));
  const used = mine.reduce((sum, v) => sum + v.minutes, 0);
  return { kind: "working", visits: mine.length, percent: Math.min(100, Math.round((used / own) * 100)) };
}
