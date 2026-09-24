/**
 * The day words the desk-work screens use beyond `lib/format.ts`: a date of
 * birth with its year, a day and month that adds the year only when it is not
 * this one, and "today" / "tomorrow" / "in 3 days" in the page's language.
 */
import type { Day } from "../../data/types.ts";
import { locale, t } from "../../i18n/ambient.ts";
import { dayMonth, daysBetween, num } from "../../lib/format.ts";

const dateLocale = (): string => (locale() === "en-US" ? "en-GB" : locale());
const noon = (day: Day): Date => new Date(`${day}T12:00:00Z`);

/**
 * `2 Oct 1968` — a date of birth.
 *
 * INTEGRATOR: move to lib/format.ts beside `dayMonth` (it has no year form).
 */
export function dayYear(day: Day): string {
  return new Intl.DateTimeFormat(dateLocale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(noon(day));
}

/** `28 Jul`, or `28 Jul 2027` when the year is not today's. */
export function dayMonthNear(day: Day, today: Day): string {
  return day.slice(0, 4) === today.slice(0, 4) ? dayMonth(day) : dayYear(day);
}

/** `today`, `tomorrow`, `yesterday`, `in 3 days`, `3 days ago`. */
export function relativeDay(day: Day, today: Day): string {
  const n = daysBetween(today, day);
  if (n === 0) return t("when.today");
  if (n === 1) return t("when.tomorrow");
  if (n === -1) return t("when.yesterday");
  return n > 1 ? t("when.inDays", counted(n), n) : t("when.daysAgo", counted(-n), -n);
}

/** `08:30` — a wall time (opening hours), written as `time()` writes an instant, in the page's language. */
export function wallTime(hhmm: string): string {
  return new Intl.DateTimeFormat(dateLocale(), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(new Date(`2026-01-05T${hhmm}:00Z`));
}

/** A plural's count, written in the page's digits (Arabic-Indic on an Arabic page). */
export const counted = (n: number): { count: string } => ({ count: num(n) });
