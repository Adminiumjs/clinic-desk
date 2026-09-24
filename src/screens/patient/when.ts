/**
 * A day and a wall time on the practice's clock, as the patients' pages need
 * them: the instant to book, and the time and day as a person reads them in
 * the page's language (Arabic digits in Arabic, and so on).
 */
import type { Day, Hhmm, Instant } from "../../data/types.ts";
import { venueStamp } from "../../data/venueTime.ts";
import { locale } from "../../i18n/ambient.ts";
import { practiceZone } from "../../lib/clock.ts";
import { time, timeRange } from "../../lib/format.ts";

/** The instant `day` at `hhmm` is at the practice — what the server is sent. */
export const atInstant = (day: Day, hhmm: Hhmm): Instant => new Date(venueStamp(day, hhmm, practiceZone())).toISOString();

/** `09:15` in the page's digits. */
export const clockLabel = (day: Day, hhmm: Hhmm): string => time(venueStamp(day, hhmm, practiceZone()));

/** `09:15–09:30` in the page's digits. */
export const rangeLabel = (day: Day, hhmm: Hhmm, minutes: number): string => timeRange(atInstant(day, hhmm), minutes);

/** `28`, two digits, in the page's digits (the day strip). */
export function dayNumber(day: Day): string {
  const tag = locale() === "en-US" ? "en-GB" : locale();
  return new Intl.DateTimeFormat(tag, { day: "2-digit", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}
