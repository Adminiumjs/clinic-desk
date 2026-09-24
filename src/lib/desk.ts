/**
 * What the desk's screens ask of what the desk holds, answered once: a
 * visit's patient (or a first visit's own name), its clinician and type, a
 * day's visits, the hours someone works on a day, and the money of a visit.
 *
 * Pure functions over `DeskState`, so they can be tested without a screen and
 * used inside a selector.
 */
import type { Appointment, Clinician, ClinicianHours, Closure, Day, Id, OpeningHours, Patient, VisitType, Weekday } from "../data/types.ts";
import type { DeskState } from "../state/desk.ts";
import { dayOf, minutesOf } from "./format.ts";

const WEEK: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const weekdayOf = (day: Day): Weekday => WEEK[new Date(`${day}T00:00:00Z`).getUTCDay()]!;

export const clinicianOf = (s: DeskState, id: Id | null): Clinician | undefined => (id === null ? undefined : s.clinicians.find((c) => c.id === id));
export const typeOf = (s: DeskState, id: Id | null): VisitType | undefined => (id === null ? undefined : s.visitTypes.find((t) => t.id === id));
export const patientOf = (s: DeskState, id: Id | null): Patient | undefined => (id === null ? undefined : s.patients[id]);

/** Who a visit is for: the patient on file, or the name a first visit gave. */
export function visitName(s: DeskState, visit: Appointment): string {
  return patientOf(s, visit.patient_id)?.name ?? visit.new_name ?? "";
}

/** Active clinicians in their order (the day sheet's columns). */
export const activeClinicians = (s: DeskState): Clinician[] => s.clinicians.filter((c) => c.active).sort((a, b) => a.position - b.position || a.id - b.id);

/** The visit types a clinician does. */
export const typesOf = (s: DeskState, clinician: Id): VisitType[] => {
  const ids = new Set(s.links.filter((l) => l.clinician_id === clinician).map((l) => l.visit_type_id));
  return s.visitTypes.filter((t) => ids.has(t.id));
};
/** The clinicians who do a visit type, in order. */
export const cliniciansFor = (s: DeskState, type: Id): Clinician[] => {
  const ids = new Set(s.links.filter((l) => l.visit_type_id === type).map((l) => l.clinician_id));
  return activeClinicians(s).filter((c) => ids.has(c.id));
};

/** A day's visits (every status), earliest first. */
export function visitsOn(s: DeskState, day: Day): Appointment[] {
  return Object.values(s.visits)
    .filter((v) => dayOf(v.starts_at) === day)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id);
}

export interface Span {
  opens: number;
  closes: number;
  breakStart: number | null;
  breakEnd: number | null;
}
const spanOf = (row: Pick<OpeningHours | ClinicianHours, "opens" | "closes" | "break_start" | "break_end"> | undefined): Span | null =>
  row === undefined
    ? null
    : {
        opens: minutesOf(row.opens),
        closes: minutesOf(row.closes),
        breakStart: row.break_start === null ? null : minutesOf(row.break_start),
        breakEnd: row.break_end === null ? null : minutesOf(row.break_end),
      };

/** The practice's hours on a day; null when it is shut (no row, or not open). */
export function practiceHours(s: DeskState, day: Day): Span | null {
  const row = s.hours.find((h) => h.weekday === weekdayOf(day));
  return row === undefined || !row.open ? null : spanOf(row);
}

/** A clinician's hours on a day: their own when they keep any, else the practice's; null when they are not in. */
export function hoursOf(s: DeskState, clinician: Id, day: Day): Span | null {
  const own = s.clinicianHours.filter((h) => h.clinician_id === clinician);
  if (own.length === 0) return practiceHours(s, day);
  return spanOf(own.find((h) => h.weekday === weekdayOf(day)));
}

/** The active closure covering a day for a clinician (theirs, or the whole practice's), if any. */
export function closureOn(s: DeskState, day: Day, clinician: Id | null): Closure | undefined {
  return s.closures.find((c) => c.active && c.from_date <= day && day <= c.to_date && (c.clinician_id === null || c.clinician_id === clinician));
}

/** Whether a visit's balance still has money owing. */
export const owes = (visit: Appointment): boolean => visit.status === "seen" && visit.balance > 0;
