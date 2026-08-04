/**
 * Presentation helpers.
 *
 * Everything here reads the ambient locale (`i18n/ambient.ts`) rather than a
 * hook, so the store and the pure engine can format without being inside the
 * React tree. Callers that ARE in the tree get the same output, because the
 * provider pushes its own `t` / `money` / `number` into the ambient module on
 * every render.
 *
 * Nothing in this file reads the real clock — `now` is always passed in.
 */

import type { VisitStatus } from "../data/types.ts";
import { locale, money as ambientMoney, number as ambientNumber, t, tOr } from "../i18n/ambient.ts";
import type { MessageKey } from "../i18n/messages/index.ts";
import { dayDiff, hhmm, parseDay } from "./schedule.ts";

/**
 * Status → message key, written out rather than assembled from a template so
 * the compiler still checks every key. A missing status here is a build error;
 * `` t(`chrome.status.${s}`) `` would have been a runtime shrug.
 */
export const STATUS_KEY = {
  booked: "chrome.status.booked",
  checked_in: "chrome.status.checked_in",
  roomed: "chrome.status.roomed",
  with_clinician: "chrome.status.with_clinician",
  ready: "chrome.status.ready",
  done: "chrome.status.done",
  no_show: "chrome.status.no_show",
  cancelled: "chrome.status.cancelled",
} as const satisfies Record<VisitStatus, MessageKey>;

export function statusLabel(status: VisitStatus): string {
  return t(STATUS_KEY[status]);
}

/** Resolve a seed field that stores an i18n key. */
export function label(key: string): string {
  return tOr(key, key);
}

/**
 * Fees and balances are whole pounds at this practice — pence would be noise on
 * a price list where everything ends in a five. The currency is a property of
 * the money and not of the reader's language, so it is fixed here rather than
 * following the locale.
 */
export function money(value: number): string {
  return ambientMoney(Math.round(value), "GBP");
}

export function number(value: number, opts?: Intl.NumberFormatOptions): string {
  return ambientNumber(value, opts);
}

/* --------------------------------------------------------------------- times */

/**
 * A clock reading. Deliberately NOT `Intl.DateTimeFormat`: every time in this
 * app is a minute count on a 24-hour grid, and rendering 09:20 as "9:20 AM" in
 * one locale would break the column alignment the day sheet depends on.
 */
export function clock(minutes: number): string {
  return hhmm(minutes);
}

/** "09:45 – 10:30" — a start and an end, as one mono run. */
export function span(start: number, end: number): string {
  return `${hhmm(start)} – ${hhmm(end)}`;
}

/** "45 min" / "1 hr 15 min" — how long a visit runs. */
export function duration(minutes: number): string {
  if (minutes < 60) return t("chrome.mins", { count: minutes }, minutes);
  const hrs = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return t("chrome.hrs", { count: hrs }, hrs);
  return `${t("chrome.hrs", { count: hrs }, hrs)} ${t("chrome.mins", { count: rest }, rest)}`;
}

/* --------------------------------------------------------------------- dates */

function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale(), opts).format(parseDay(iso));
}

/** "28 Jul" — chips, day strips and table cells. */
export function dateShort(iso: string): string {
  return fmt(iso, { day: "numeric", month: "short" });
}

/** "28 July 2026" — headers and summary rails. */
export function dateLong(iso: string): string {
  return fmt(iso, { day: "numeric", month: "long", year: "numeric" });
}

/** "Tuesday 28 July 2026" — the day sheet's own heading. */
export function dateFull(iso: string): string {
  return fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** "Tue" — the day strip's top line. */
export function weekdayShort(iso: string): string {
  return fmt(iso, { weekday: "short" });
}

/** "28" — the day strip's big number. */
export function dayNumber(iso: string): string {
  return fmt(iso, { day: "numeric" });
}

/**
 * A relative day for visit lists and recall rows: today and yesterday get their
 * own words, the rest of the fortnight counts, and anything older falls back to
 * a plain date. Future days count forward.
 */
export function relativeDay(iso: string, today: string): string {
  const diff = dayDiff(today, iso);
  if (diff === 0) return t("chrome.rel.today");
  if (diff === 1) return t("chrome.rel.yesterday");
  if (diff === -1) return t("chrome.rel.tomorrow");
  if (diff > 1 && diff <= 14) return t("chrome.rel.daysAgo", { count: diff }, diff);
  if (diff < -1 && diff >= -14) return t("chrome.rel.inDays", { count: -diff }, -diff);
  return dateShort(iso);
}

/** "40 days" — the age chip on an outstanding amount. */
export function ageLabel(days: number): string {
  return t("chrome.days", { count: days }, days);
}

/** "waiting 34 min" — the waiting card's chip. */
export function waitLabel(minutes: number): string {
  return t("waiting.chip", { count: minutes }, minutes);
}

/** "42 years old", derived — never stored on the patient. */
export function ageLine(years: number): string {
  return t("chrome.years", { count: years }, years);
}

/** Two-letter initials from a display name, for a tinted tile. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* --------------------------------------------------------------------- tints */

function toRgb(hex: string): [number, number, number] {
  let h = (hex || "#0369a1").replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Pull a hex toward white — how a seed tint stays legible on a dark surface. */
export function lighten(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/**
 * The layered gradient every avatar and clinician tile uses in place of
 * photography: a highlight sweep, a corner glow, and the seed tint underneath.
 */
export function tileBackground(hex: string, dark: boolean, angle = "150deg"): string {
  const highlight = dark
    ? "radial-gradient(120% 84% at 50% 0%, rgba(255,255,255,.07), transparent 56%)"
    : "radial-gradient(120% 84% at 50% 0%, rgba(255,255,255,.6), transparent 58%)";
  const glow = `radial-gradient(58% 46% at 72% 88%, ${rgba(hex, dark ? 0.3 : 0.2)}, transparent 72%)`;
  const base = `linear-gradient(${angle}, ${rgba(hex, dark ? 0.34 : 0.22)}, ${rgba(hex, dark ? 0.12 : 0.07)})`;
  return `${highlight}, ${glow}, ${base}`;
}

/** Re-export so screens can pull one translation helper from one place. */
export { t };
export type { MessageKey };
