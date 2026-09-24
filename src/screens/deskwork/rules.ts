/**
 * The small rules the desk-work screens are built on, kept pure so they can
 * be tested without a screen: which group a recall is in, how the week's
 * opening hours read in a few lines, and how many booked visits a closure
 * still sits on.
 */
import type { Appointment, Closure, Day, OpeningHours, Weekday } from "../../data/types.ts";
import { dayOf, daysBetween } from "../../lib/format.ts";

export type RecallGroup = "over" | "due" | "later";

/** Past its due day, due within four weeks, or later. */
export function recallGroup(dueOn: Day, today: Day): RecallGroup {
  const diff = daysBetween(today, dueOn);
  return diff < 0 ? "over" : diff <= 28 ? "due" : "later";
}

export type HoursLine =
  | { id: "weekdays"; kind: "weekdays"; opens: string; closes: string }
  | { id: "break"; kind: "break"; from: string; to: string }
  | { id: Weekday; kind: "day"; weekday: Weekday; open: boolean; opens: string; closes: string; breakFrom: string | null; breakTo: string | null }
  | { id: "weekend"; kind: "weekendClosed" };

const WORKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

const same = (a: OpeningHours | undefined, b: OpeningHours | undefined): boolean =>
  a !== undefined && b !== undefined && a.open === b.open && a.opens === b.opens && a.closes === b.closes && a.break_start === b.break_start && a.break_end === b.break_end;

const hasBreak = (h: OpeningHours): boolean => h.break_start !== null && h.break_end !== null && h.break_end > h.break_start;

/**
 * The week in a few lines, as the design reads it: "Monday to Friday" and its
 * desk-closed time when the five days agree, else a line per weekday; then
 * the weekend, as one "closed" line when both days are shut.
 */
export function hoursLines(hours: readonly OpeningHours[]): HoursLine[] {
  const of = (d: Weekday) => hours.find((h) => h.weekday === d);
  const lines: HoursLine[] = [];
  const monday = of("mon");
  const dayLine = (d: Weekday): HoursLine => {
    const h = of(d);
    const open = h !== undefined && h.open;
    return {
      id: d,
      kind: "day",
      weekday: d,
      open,
      opens: h?.opens ?? "",
      closes: h?.closes ?? "",
      breakFrom: open && h !== undefined && hasBreak(h) ? h.break_start : null,
      breakTo: open && h !== undefined && hasBreak(h) ? h.break_end : null,
    };
  };
  if (monday !== undefined && monday.open && WORKDAYS.every((d) => same(of(d), monday))) {
    lines.push({ id: "weekdays", kind: "weekdays", opens: monday.opens, closes: monday.closes });
    if (hasBreak(monday)) lines.push({ id: "break", kind: "break", from: monday.break_start!, to: monday.break_end! });
  } else {
    for (const d of WORKDAYS) lines.push(dayLine(d));
  }
  const sat = of("sat");
  const sun = of("sun");
  if (!(sat?.open ?? false) && !(sun?.open ?? false)) lines.push({ id: "weekend", kind: "weekendClosed" });
  else for (const d of ["sat", "sun"] as const) lines.push(dayLine(d));
  return lines;
}

/**
 * The visits a closure still sits on: booked (not seen, not a no-show, not
 * cancelled — a closure over a visit that already happened clashes with
 * nothing), inside its days, with its clinician or anyone's for a closure of
 * the whole practice. Each stays listed until it is moved or cancelled.
 */
export function closureClashes(closure: Pick<Closure, "from_date" | "to_date" | "clinician_id">, visits: readonly Appointment[]): Appointment[] {
  return visits.filter((v) => {
    if (v.status !== "booked") return false;
    const day = dayOf(v.starts_at);
    if (day < closure.from_date || day > closure.to_date) return false;
    return closure.clinician_id === null || v.clinician_id === closure.clinician_id;
  });
}
