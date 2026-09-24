/**
 * How the desk and the patients' pages write a time, a day, an amount.
 *
 * Every instant is read on the PRACTICE's clock (`lib/clock.ts`), never the
 * reader's device: a 09:00 visit is 09:00 on every screen. Times are 24-hour
 * (a clinic's diary), days read as the design writes them — "Tue 28 Jul",
 * "Tuesday 28 July 2026" — in the page's language, and money is in the
 * practice's currency with no ".00" on a whole amount.
 */
import { locale, money as ambientMoney } from "../i18n/ambient.ts";
import type { Day, Instant } from "../data/types.ts";
import { venueDay, venueTime } from "../data/venueTime.ts";
import { practiceZone } from "./clock.ts";

/**
 * The formatting language for dates: the page's, except English, which the
 * design writes day-before-month ("Tue 28 Jul") as the practice does.
 */
const dateLocale = (): string => (locale() === "en-US" ? "en-GB" : locale());

const cache = new Map<string, Intl.DateTimeFormat>();
function dtf(opts: Intl.DateTimeFormatOptions, zone: string): Intl.DateTimeFormat {
  const key = `${dateLocale()}|${zone}|${JSON.stringify(opts)}`;
  let found = cache.get(key);
  if (found === undefined) {
    found = new Intl.DateTimeFormat(dateLocale(), { ...opts, timeZone: zone });
    cache.set(key, found);
  }
  return found;
}
/** Noon of a calendar day, which no zone can move to another day. */
const noon = (day: Day): Date => new Date(`${day}T12:00:00Z`);

/** `09:05` — an instant's time on the practice's clock. */
export function time(at: Instant | number): string {
  const ms = typeof at === "number" ? at : Date.parse(at);
  return dtf({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, practiceZone()).format(ms);
}

/** `09:00–09:45` — a visit's span. */
export function timeRange(at: Instant, minutes: number): string {
  const start = Date.parse(at);
  return `${time(start)}–${time(start + minutes * 60_000)}`;
}

/** `Tue 28 Jul` */
export function dayShort(day: Day): string {
  return dtf({ weekday: "short", day: "numeric", month: "short" }, "UTC").format(noon(day));
}
/** `Tuesday 28 July 2026` */
export function dayLong(day: Day): string {
  const parts = dtf({ weekday: "long", day: "numeric", month: "long", year: "numeric" }, "UTC").formatToParts(noon(day));
  // English writes "Tuesday 28 July 2026" on the desk; other languages keep
  // their own punctuation ("Dienstag, 28. Juli 2026" is right in German).
  const english = locale().startsWith("en");
  return parts.map((p, i) => (english && p.type === "literal" && parts[i - 1]?.type === "weekday" ? " " : p.value)).join("");
}
/** `28 Jul` */
export function dayMonth(day: Day): string {
  return dtf({ day: "numeric", month: "short" }, "UTC").format(noon(day));
}
/** `Tue` */
export function weekdayShort(day: Day): string {
  return dtf({ weekday: "short" }, "UTC").format(noon(day));
}
/** `Tuesday` */
export function weekdayLong(day: Day): string {
  return dtf({ weekday: "long" }, "UTC").format(noon(day));
}
/** `28` */
export function dayOfMonth(day: Day): string {
  return dtf({ day: "numeric" }, "UTC").format(noon(day));
}

/** The practice's calendar day of an instant. */
export const dayOf = (at: Instant | number): Day => venueDay(typeof at === "number" ? at : Date.parse(at), practiceZone());
/** The practice's `HH:MM` of an instant (for arithmetic, not display). */
export const hhmmOf = (at: Instant | number): string => venueTime(typeof at === "number" ? at : Date.parse(at), practiceZone());
/** Minutes since midnight of an `HH:MM`. */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}
/** `HH:MM` of minutes since midnight. */
export const clockOf = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Whole days from `a` to `b` (calendar days). */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Age in whole years on `today`. */
export function ageOn(bornOn: Day, today: Day): number {
  const [by, bm, bd] = bornOn.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/** An amount in the practice's currency, with no ".00" on a whole amount. */
export function money(value: number, currency?: string): string {
  const whole = Math.round(value * 100) % 100 === 0;
  const text = ambientMoney(value, currency);
  return whole ? text.replace(/([.,]00)(?!\d)/, "") : text;
}

/** A plain number in the page's language. */
export function num(value: number): string {
  return new Intl.NumberFormat(locale()).format(value);
}
