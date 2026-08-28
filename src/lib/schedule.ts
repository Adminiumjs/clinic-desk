/**
 * The scheduling engine.
 *
 * Everything the desk and the booking site show about time, waiting, money owed
 * and who is due back is derived here from the appointment list and the pinned
 * clock. Nothing is stored pre-computed on a record, because a stored waiting
 * time is wrong fifteen minutes later — and fifteen minutes later is exactly
 * what the dock's "+15 min" chip does.
 *
 * The module is pure and React-free: data in, data out. Anything that needs a
 * "now" takes it as an argument, so the vitest suite exercises the real thing
 * against the shipped seed rather than a copy of it.
 *
 * Times are minutes since midnight. That is what makes the slot arithmetic
 * plain integer maths: a 45-minute visit at 11:45 is 705 + 45 = 750, and 750 is
 * the minute lunch starts, so it fits by exactly nothing.
 */

import type {
  Appointment,
  Charge,
  Clinician,
  Closure,
  Now,
  Patient,
  Payment,
  QueueStatus,
  VisitStatus,
  VisitType,
  VisitTypeId,
} from "../data/types.ts";

/* ------------------------------------------------------------- opening hours */

/** The practice opens at 08:30. */
export const OPEN = 8 * 60 + 30;
/** The last minute of the day is 17:30 — a visit may end on it, never after. */
export const CLOSE = 17 * 60 + 30;
/** Lunch runs 12:30–13:15 and nothing may overlap it. */
export const BREAK_START = 12 * 60 + 30;
export const BREAK_END = 13 * 60 + 15;
/** The grid is quarter-hours, so every start is a multiple of this. */
export const SLOT = 15;

/** Waiting-time thresholds, in minutes: amber past 20, danger past 40. */
export const WAIT_WARN = 20;
export const WAIT_DANGER = 40;

/** Past this many minutes beyond their start, someone who never arrived
 *  appears on the "hasn't arrived" strip. */
export const NO_SHOW_AFTER = 15;

/** Cancelling inside this many minutes of the start counts as late. */
export const LATE_CANCEL_WINDOW = 24 * 60;

/** The board columns, in the order a visit moves through them. */
export const QUEUE_ORDER: QueueStatus[] = [
  "checked_in",
  "roomed",
  "with_clinician",
  "ready",
];

/* --------------------------------------------------------------- date helpers */

/** Parse `YYYY-MM-DD` as a LOCAL calendar day, never a UTC instant. */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Whole days from `b` to `a`. Positive when `a` is later. */
export function dayDiff(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86_400_000);
}

/* ------------------------------------------------------------------ closures */

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE CLOSURE LIST IS AN ARGUMENT AND NOT A MODULE-LEVEL SET
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `isWorkingDay` was a pure weekday predicate reading `getDay()` and nothing
 * else. Making it answer for a day the practice has shut needed the list of
 * closures, and there were two ways to give it one: thread it through every
 * consumer, or hold it in module state and have a setter.
 *
 * THREADING WON, AND THE ARGUMENT IS REQUIRED RATHER THAN DEFAULTED.
 *
 *   · This module's own header is the first reason: it is pure and React-free,
 *     data in and data out, and anything needing a "now" takes it as an
 *     argument so the suite exercises the real thing against the shipped seed.
 *     A module-level closure set would be state this module has to be put into
 *     before it answers correctly, which is the property the header exists to
 *     deny — and the failure would be a test file that passed alone and failed
 *     in a suite that ran a different file first.
 *
 *   · A DEFAULT OF `[]` WOULD HAVE COMPILED EVERY EXISTING CALL SITE
 *     UNCHANGED, and that is exactly what makes it wrong. `db/seed.sql` names
 *     the failure this table exists to prevent: "a closure the app does not
 *     know about would be a day the dashboard says is shut while the booking
 *     screen carries on offering times on it." A defaulted parameter is a
 *     machine for producing that state — one screen passes the list, the next
 *     screen added forgets, and nothing anywhere disagrees out loud. Required,
 *     a forgotten call site is a compile error, which is the only place this
 *     particular bug can be caught before a patient meets it.
 *
 * The cost is real and was paid once: six call sites, four of them in this
 * file. It does not grow — a seventh consumer pays one argument.
 */

/** Every closure that falls on one day, the practice's OWN entries first.
 *
 * The order is the display guarantee, not a convenience. An imported day and a
 * day somebody here typed can land on the same date — that is the ordinary case
 * on a bank holiday the practice was already closing for — and whichever comes
 * first is the reason a reader sees on the day sheet. It is theirs.
 * Within each group the order is by reason, so two imported sets naming one
 * date do not swap places depending on which was imported first. */
export function closuresOn(closures: readonly Closure[], iso: string): Closure[] {
  return closures
    .filter((c) => c.date === iso)
    .sort((a, b) => {
      if ((a.from === null) !== (b.from === null)) return a.from === null ? -1 : 1;
      return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
    });
}

/**
 * The practice-wide closure on a day, or null.
 *
 * `clinician === null` is the schema's own spelling of "the whole practice is
 * shut". A row naming a clinician is somebody away while the door is open, and
 * reading it as a closure would empty a day sheet that has two other columns
 * still seeing patients.
 */
export function practiceClosure(closures: readonly Closure[], iso: string): Closure | null {
  return closuresOn(closures, iso).find((c) => c.clinician === null) ?? null;
}

/** Is this clinician away on this day — practice shut, or only them? */
export function isAway(
  closures: readonly Closure[],
  clinicianId: string,
  iso: string,
): boolean {
  return closuresOn(closures, iso).some(
    (c) => c.clinician === null || c.clinician === clinicianId,
  );
}

/**
 * Monday to Friday, and not a day the practice has closed.
 *
 * The weekend half is a rule and the closure half is data, and they are one
 * predicate because every caller wants the same answer: may anything happen
 * here at all. A clinician-specific row deliberately does NOT make the day
 * non-working — `isAway` is the question about one person.
 */
export function isWorkingDay(iso: string, closures: readonly Closure[]): boolean {
  const wd = parseDay(iso).getDay();
  if (wd < 1 || wd > 5) return false;
  return practiceClosure(closures, iso) === null;
}

/** The next working day strictly after `iso`. */
export function nextWorkingDay(iso: string, closures: readonly Closure[]): string {
  let cursor = addDays(iso, 1);
  while (!isWorkingDay(cursor, closures)) cursor = addDays(cursor, 1);
  return cursor;
}

export interface StripDay {
  iso: string;
  /** False at the weekend and on a closed day, which is why those are dimmed. */
  working: boolean;
  /**
   * Why it is not offered, when there is something to say — the closure's own
   * reason. Null at the weekend, which the panel's subtitle already explains
   * and which needs no per-day wording.
   */
  closedFor: string | null;
  /** The key of the add-on that supplied the reason, or null. */
  closedBy: string | null;
}

/**
 * The day strip on the booking screen: `count` consecutive calendar days from
 * `from`. Weekends are INCLUDED rather than skipped, so a reader can see why
 * Saturday is not offered instead of wondering where it went. A closed weekday
 * is included for exactly the same reason, and carries its reason so the strip
 * can say which it is rather than looking like a weekend in the wrong place.
 */
export function dayStrip(
  from: string,
  count: number,
  closures: readonly Closure[],
): StripDay[] {
  const out: StripDay[] = [];
  for (let i = 0; i < count; i += 1) {
    const iso = addDays(from, i);
    const closure = practiceClosure(closures, iso);
    out.push({
      iso,
      working: isWorkingDay(iso, closures),
      closedFor: closure?.reason ?? null,
      closedBy: closure?.from ?? null,
    });
  }
  return out;
}

/* --------------------------------------------------------------- time helpers */

/** `545` → `"09:05"`. Deliberately not locale-aware: this is a mono run. */
export function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(m / 60))}:${p(m % 60)}`;
}

export function visitTypeById(types: VisitType[], id: VisitTypeId): VisitType {
  return types.find((v) => v.id === id) ?? types[0];
}

/** When a visit ends: its start plus whatever its reason makes it run to. */
export function endOf(appt: Appointment, types: VisitType[]): number {
  return appt.start + visitTypeById(types, appt.type).minutes;
}

/**
 * A visit's start as an absolute minute count relative to `now`. Negative once
 * the start is in the past, which is what both the no-show window and the
 * late-cancellation rule read.
 */
export function minutesUntil(appt: Appointment, now: Now): number {
  return dayDiff(appt.date, now.date) * 1440 + appt.start - now.minutes;
}

/* ------------------------------------------------------------------ occupancy */

/** A cancelled visit releases its slot; everything else — including a no-show
 *  — still holds it, because nobody rebooked the room. */
export function holdsSlot(status: VisitStatus): boolean {
  return status !== "cancelled";
}

export function apptsFor(
  appts: Appointment[],
  clinicianId: string,
  date: string,
): Appointment[] {
  return appts
    .filter((a) => a.clinician === clinicianId && a.date === date && holdsSlot(a.status))
    .sort((a, b) => a.start - b.start);
}

/**
 * Does `[start, start + minutes)` collide with anything already in the diary?
 * Half-open on purpose: a visit ending at 09:15 and one starting at 09:15 do
 * not overlap, which is the whole point of a quarter-hour grid.
 */
export function collides(
  booked: Appointment[],
  types: VisitType[],
  start: number,
  minutes: number,
): boolean {
  const end = start + minutes;
  return booked.some((a) => start < endOf(a, types) && end > a.start);
}

/**
 * Does a visit of this length physically fit at this start, ignoring who is
 * already booked? False when it would run past 17:30 or touch lunch at all.
 * This is the rule that makes the physiotherapy grid visibly sparser than the
 * routine one, because 45 minutes has three times as many ways to not fit.
 */
export function fitsHours(start: number, minutes: number): boolean {
  const end = start + minutes;
  if (start < OPEN || end > CLOSE) return false;
  return !(start < BREAK_END && end > BREAK_START);
}

export type SlotBlock = "past" | "taken";

export interface Slot {
  start: number;
  end: number;
  available: boolean;
  /** Why it cannot be taken, or null when it can. */
  blocked: SlotBlock | null;
}

/**
 * Every start the grid should DRAW for one clinician on one day.
 *
 * Starts that could never work — they would overrun lunch or the close — are
 * absent rather than disabled, because drawing a 16:45 physiotherapy slot with
 * a line through it would suggest the practice might stay late. Starts that are
 * merely gone for today — already taken, or already past — are drawn and
 * disabled, because a reader needs to see that the day is filling up.
 */
export function slotsFor(
  appts: Appointment[],
  types: VisitType[],
  clinicianId: string,
  date: string,
  typeId: VisitTypeId,
  now: Now,
): Slot[] {
  const minutes = visitTypeById(types, typeId).minutes;
  const booked = apptsFor(appts, clinicianId, date);
  const today = date === now.date;
  const out: Slot[] = [];

  for (let start = OPEN; start + minutes <= CLOSE; start += SLOT) {
    if (!fitsHours(start, minutes)) continue;

    let blocked: SlotBlock | null = null;
    if (today && start < now.minutes) blocked = "past";
    else if (collides(booked, types, start, minutes)) blocked = "taken";

    out.push({ start, end: start + minutes, available: blocked === null, blocked });
  }

  return out;
}

/** The clinicians who take this kind of visit, in seed order. */
export function cliniciansFor(
  clinicians: Clinician[],
  typeId: VisitTypeId,
): Clinician[] {
  return clinicians.filter((c) => c.offers.includes(typeId));
}

/**
 * Open starts for a day across one clinician or all of them. `clinicianId` of
 * `"any"` means the patient does not mind who they see, which is the case that
 * finds room on a day where every individual diary looks busy.
 */
export function openStarts(
  appts: Appointment[],
  clinicians: Clinician[],
  types: VisitType[],
  clinicianId: string,
  date: string,
  typeId: VisitTypeId,
  now: Now,
  closures: readonly Closure[],
): { clinician: string; start: number }[] {
  if (!isWorkingDay(date, closures)) return [];

  /*
   * An away clinician is dropped from the pool rather than having their slots
   * drawn and disabled. That is the same rule `slotsFor` already applies to a
   * start that could never work — absent rather than struck through — and it is
   * the right one here for a stronger reason: a struck-through row invites
   * "can they not fit me in", and the answer for somebody who is not in the
   * building is no. The whole-practice case never reaches this line; it is the
   * `isWorkingDay` above.
   */
  const available = clinicians.filter((c) => !isAway(closures, c.id, date));
  const pool =
    clinicianId === "any"
      ? cliniciansFor(available, typeId)
      : available.filter((c) => c.id === clinicianId && c.offers.includes(typeId));

  const out: { clinician: string; start: number }[] = [];
  for (const c of pool) {
    for (const slot of slotsFor(appts, types, c.id, date, typeId, now)) {
      if (slot.available) out.push({ clinician: c.id, start: slot.start });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * The honest empty state: when the chosen day has nothing left, name the next
 * day that does. Returns null only when the search window runs out, which is
 * the one case where the screen should say so rather than invent a date.
 */
export function nextDayWithRoom(
  appts: Appointment[],
  clinicians: Clinician[],
  types: VisitType[],
  clinicianId: string,
  from: string,
  typeId: VisitTypeId,
  now: Now,
  closures: readonly Closure[],
  withinDays = 30,
): string | null {
  for (let i = 1; i <= withinDays; i += 1) {
    const iso = addDays(from, i);
    if (!isWorkingDay(iso, closures)) continue;
    if (openStarts(appts, clinicians, types, clinicianId, iso, typeId, now, closures).length > 0) {
      return iso;
    }
  }
  return null;
}

/* --------------------------------------------------------------- waiting room */

export type WaitTone = "ok" | "warn" | "danger";

/** How long someone has been in the building, counted from the desk stamp. */
export function waitingMinutes(appt: Appointment, now: Now): number {
  if (appt.checkedInAt === null) return 0;
  return Math.max(0, dayDiff(now.date, appt.date) * 1440 + now.minutes - appt.checkedInAt);
}

export function waitTone(minutes: number): WaitTone {
  if (minutes > WAIT_DANGER) return "danger";
  if (minutes > WAIT_WARN) return "warn";
  return "ok";
}

export function isQueueStatus(status: VisitStatus): status is QueueStatus {
  return (
    status === "checked_in" ||
    status === "roomed" ||
    status === "with_clinician" ||
    status === "ready"
  );
}

/**
 * The board: who is in the building right now, in the four columns they move
 * through. Each column is sorted by longest wait first, because that is the
 * person the desk should look at.
 */
export function waitingBoard(
  appts: Appointment[],
  now: Now,
): Record<QueueStatus, Appointment[]> {
  const board: Record<QueueStatus, Appointment[]> = {
    checked_in: [],
    roomed: [],
    with_clinician: [],
    ready: [],
  };

  for (const a of appts) {
    if (a.date !== now.date) continue;
    if (!isQueueStatus(a.status)) continue;
    board[a.status].push(a);
  }

  for (const key of QUEUE_ORDER) {
    board[key].sort((x, y) => waitingMinutes(y, now) - waitingMinutes(x, now));
  }
  return board;
}

/** The next status the one big button on a waiting card moves someone to. */
export function nextStatus(status: VisitStatus): VisitStatus {
  switch (status) {
    case "booked":
      return "checked_in";
    case "checked_in":
      return "roomed";
    case "roomed":
      return "with_clinician";
    case "with_clinician":
      return "ready";
    case "ready":
      return "done";
    default:
      return status;
  }
}

/**
 * The "hasn't arrived" strip: anyone more than fifteen minutes past their start
 * who never checked in. Sorted by how late they are, worst first — each tap of
 * the demo clock adds whoever has just crossed the line.
 */
export function awaitingArrival(appts: Appointment[], now: Now): Appointment[] {
  return appts
    .filter(
      (a) =>
        a.date === now.date &&
        a.status === "booked" &&
        now.minutes - a.start > NO_SHOW_AFTER,
    )
    .sort((a, b) => a.start - b.start);
}

/** How many minutes past their start someone is. */
export function minutesLate(appt: Appointment, now: Now): number {
  return Math.max(0, now.minutes - appt.start);
}

/* --------------------------------------------------------------------- people */

/** Age on a given day, derived from date of birth. Never stored. */
export function ageOn(dob: string, on: string): number {
  const b = parseDay(dob);
  const d = parseDay(on);
  let age = d.getFullYear() - b.getFullYear();
  const beforeBirthday =
    d.getMonth() < b.getMonth() ||
    (d.getMonth() === b.getMonth() && d.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function patientById(patients: Patient[], id: string): Patient | null {
  return patients.find((p) => p.id === id) ?? null;
}

/**
 * The returning-patient lookup. Mobile and date of birth together, because
 * either one alone would match the wrong person eventually. Digits are compared
 * without spacing so "07700 900411" and "07700900411" are the same number.
 */
export function findPatient(
  patients: Patient[],
  mobile: string,
  dob: string,
): Patient | null {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 0 || dob.length === 0) return null;
  return (
    patients.find((p) => p.mobile.replace(/\D/g, "") === digits && p.dob === dob) ?? null
  );
}

export interface PatientVisits {
  upcoming: Appointment[];
  past: Appointment[];
}

/**
 * Split one patient's visits around the pinned clock. Cancelled visits stay in
 * the past list rather than vanishing, so a reader can see what happened.
 */
export function visitsForPatient(
  appts: Appointment[],
  patientId: string,
  now: Now,
): PatientVisits {
  const mine = appts.filter((a) => a.patient === patientId);
  const upcoming = mine
    .filter((a) => (a.status === "booked" || isQueueStatus(a.status)) && minutesUntil(a, now) > 0)
    .sort((a, b) => minutesUntil(a, now) - minutesUntil(b, now));
  const past = mine
    .filter((a) => !upcoming.includes(a))
    .sort((a, b) => minutesUntil(b, now) - minutesUntil(a, now));
  return { upcoming, past };
}

/** The most recent visit that actually happened, or null. */
export function lastVisit(appts: Appointment[], patientId: string, now: Now): Appointment | null {
  const seen = appts
    .filter((a) => a.patient === patientId && (a.status === "done" || a.status === "ready"))
    .filter((a) => minutesUntil(a, now) <= 0)
    .sort((a, b) => minutesUntil(b, now) - minutesUntil(a, now));
  return seen[0] ?? null;
}

/**
 * Cancelling inside 24 hours of the start counts as a late cancellation. Also
 * true once the start is in the past, which is the honest reading — nobody
 * cancels a visit that has already begun early.
 */
export function isLateCancel(appt: Appointment, now: Now): boolean {
  return minutesUntil(appt, now) < LATE_CANCEL_WINDOW;
}

/* ------------------------------------------------------------------- accounts */

export function paidOn(charge: Charge, payments: Payment[]): number {
  return payments
    .filter((p) => p.charge === charge.id)
    .reduce((sum, p) => sum + p.amount, 0);
}

export function balanceOf(charge: Charge, payments: Payment[]): number {
  return charge.amount - paidOn(charge, payments);
}

export interface OutstandingRow {
  charge: Charge;
  balance: number;
  /** How many days since the charge was raised — what the age chip shows. */
  ageDays: number;
}

/**
 * What is owed, oldest first. Oldest first rather than largest first on
 * purpose: a small amount that has sat for six weeks is the one worth a phone
 * call, and sorting by size would bury it.
 */
export function outstanding(
  charges: Charge[],
  payments: Payment[],
  now: Now,
): OutstandingRow[] {
  return charges
    .map((charge) => ({
      charge,
      balance: balanceOf(charge, payments),
      ageDays: dayDiff(now.date, charge.raised),
    }))
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.ageDays - a.ageDays || a.charge.id.localeCompare(b.charge.id));
}

export function totalOutstanding(charges: Charge[], payments: Payment[]): number {
  return charges.reduce((sum, c) => sum + Math.max(0, balanceOf(c, payments)), 0);
}

/** What the desk has taken on one day, across every method. */
export function takenOn(payments: Payment[], date: string): number {
  return payments.filter((p) => p.date === date).reduce((sum, p) => sum + p.amount, 0);
}

/** Monday of the week `iso` falls in — the week the no-show count covers. */
export function weekStart(iso: string): string {
  const d = parseDay(iso);
  const back = (d.getDay() + 6) % 7;
  return addDays(iso, -back);
}

export function noShowsThisWeek(appts: Appointment[], now: Now): Appointment[] {
  const from = weekStart(now.date);
  return appts.filter(
    (a) => a.status === "no_show" && dayDiff(a.date, from) >= 0 && dayDiff(now.date, a.date) >= 0,
  );
}

export type PaymentRefusal = "nonpositive" | "overpay";

export type PaymentCheck =
  | { ok: true; amount: number; remaining: number }
  | { ok: false; reason: PaymentRefusal; max: number };

/**
 * Can this amount be taken against this charge?
 *
 * Partial amounts are fine — people pay what they have on them. Overpayment is
 * REFUSED rather than clamped: silently taking £60 against a £45 balance and
 * recording £45 is how a desk ends up owing someone money it has no record of.
 * The refusal carries the maximum so the popover can offer it as one tap.
 */
export function checkPayment(
  charge: Charge,
  payments: Payment[],
  amount: number,
): PaymentCheck {
  const max = balanceOf(charge, payments);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "nonpositive", max };
  if (amount > max) return { ok: false, reason: "overpay", max };
  return { ok: true, amount, remaining: max - amount };
}

/* -------------------------------------------------------------------- recalls */

export interface Recall {
  patient: string;
  /** The visit the recall came from. */
  appt: string;
  reason: string;
  weeks: number;
  /** `YYYY-MM-DD` they should be seen again by. */
  due: string;
  /** Days past due; negative when still ahead. */
  overdueDays: number;
  overdue: boolean;
}

/**
 * Who is due back, derived from each visit's "see them again in N weeks"
 * against the pinned date. Overdue first and worst-first inside that, then
 * whatever falls in the rest of this month — anything later is not the desk's
 * problem today and would only make the list longer than it is useful.
 */
export function recalls(appts: Appointment[], now: Now): Recall[] {
  const monthEnd = (() => {
    const d = parseDay(now.date);
    return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  })();

  const rows: Recall[] = [];
  for (const a of appts) {
    if (a.recallWeeks === null) continue;
    if (a.status !== "done" && a.status !== "ready") continue;
    const due = addDays(a.date, a.recallWeeks * 7);
    const overdueDays = dayDiff(now.date, due);
    if (overdueDays < 0 && dayDiff(due, monthEnd) > 0) continue;
    rows.push({
      patient: a.patient,
      appt: a.id,
      reason: a.reason,
      weeks: a.recallWeeks,
      due,
      overdueDays,
      overdue: overdueDays > 0,
    });
  }

  return rows.sort((x, y) => y.overdueDays - x.overdueDays || x.patient.localeCompare(y.patient));
}

/* ------------------------------------------------------------------ day sheet */

export interface DaySheetColumn {
  clinician: Clinician;
  appts: Appointment[];
  /**
   * Why this clinician is not here today, or null.
   *
   * The column is still DRAWN when somebody is away, with its reason across it.
   * Removing it would reflow the grid and make the day look like a practice
   * with two clinicians, which is the reading a receptionist must not get: a
   * missing column is indistinguishable from a clinician who never existed,
   * and the question at the desk is always "where is she today".
   *
   * Whole-practice closures never reach here — the screen swaps the entire grid
   * for a closed-day state before it asks for columns.
   */
  awayFor: string | null;
}

export function daySheet(
  appts: Appointment[],
  clinicians: Clinician[],
  date: string,
  closures: readonly Closure[],
): DaySheetColumn[] {
  return clinicians.map((clinician) => ({
    clinician,
    appts: apptsFor(appts, clinician.id, date),
    awayFor:
      closuresOn(closures, date).find((c) => c.clinician === clinician.id)?.reason ?? null,
  }));
}

/** Every quarter-hour row the day sheet draws, 08:30 through 17:15. */
export function gridRows(): number[] {
  const rows: number[] = [];
  for (let m = OPEN; m < CLOSE; m += SLOT) rows.push(m);
  return rows;
}

/** True when this row is inside lunch, which is drawn hatched and unbookable. */
export function isBreakRow(minute: number): boolean {
  return minute >= BREAK_START && minute < BREAK_END;
}

/**
 * How far down the grid the "now" line sits, as a fraction of the whole day.
 * Returns null outside opening hours so the line is simply absent rather than
 * pinned to an edge and lying about the time.
 */
export function nowOffset(now: Now, date: string): number | null {
  if (date !== now.date) return null;
  if (now.minutes < OPEN || now.minutes > CLOSE) return null;
  return (now.minutes - OPEN) / (CLOSE - OPEN);
}

/** How many of today's visits have already been seen — the day-sheet subtitle. */
export function seenCount(appts: Appointment[], now: Now): number {
  return appts.filter(
    (a) => a.date === now.date && (a.status === "done" || a.status === "ready"),
  ).length;
}
