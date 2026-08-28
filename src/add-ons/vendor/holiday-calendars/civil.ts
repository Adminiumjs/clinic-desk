/*
 * VENDORED from add-ons/packages/holiday-calendars/src/civil.ts — synced by scripts/sync-add-ons.sh.
 * Never hand-edit this copy: edit the monorepo and re-run `sync-add-ons.sh sync`.
 * The add-on key is `holiday-calendars`; its manifest, tests and README live in the monorepo.
 */
/**
 * CIVIL DATES, WITHOUT EVER ASKING WHAT TIME IT IS.
 *
 * ── WHY THIS FILE EXISTS RATHER THAN A `Date` ───────────────────────────────
 *
 * Every rule in `daysets.ts` is a statement about a CALENDAR — the third Monday
 * in January, thirty-nine days after Easter, the twenty-sixth of December.
 * `Date` is an instant, and the two are not the same thing: `new Date("2026-12-26")`
 * is UTC midnight, `new Date(2026, 11, 26)` is local midnight, and the moment a
 * shop's laptop is west of Greenwich one of them prints the twenty-fifth. A
 * day-set that slid a day depending on where it was read would be worse than no
 * day-set, because it would be wrong quietly.
 *
 * So the arithmetic here is integers. `daysFromCivil` / `civilFromDays` are the
 * days-from-civil pair — the same conversion `@adminium/add-on-host`'s
 * `resolveActivity` uses, and for the same reason — and nothing below reads a
 * clock, a locale or a timezone.
 *
 * ── THE UNIT IS THE ONE BOTH HOSTS ALREADY SPEAK ────────────────────────────
 *
 * An EPOCH DAY is whole days since 1970-01-01 UTC. `people-ops` calls the same
 * number a "day serial" and every leave balance in that app is computed from
 * one; `clinic-desk` works in `YYYY-MM-DD` strings. Both are here, and the
 * conversion between them is exact and total, which is what lets the read
 * surface in `calendar.ts` hand out ISO strings and leave each host to convert
 * to whatever it stores (see that file's header for why the ISO string is the
 * one that crosses the seam).
 *
 * ── DATES ARE PROLEPTIC GREGORIAN, AND THE RANGE IS SMALL ───────────────────
 *
 * Every set this add-on ships is for a year in the 2020s. The Gregorian Easter
 * computation below is valid for 1583 onwards and the integer conversions for
 * any year at all, so the range is not a limit anybody will meet — it is worth
 * saying only because it is the reason no calendar-reform special case appears
 * here and none is missing.
 */

/** 0 = Sunday, through 6 = Saturday — the numbering `Date.prototype.getDay` uses. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A calendar day, in the three numbers a rule is written with. */
export interface Civil {
  y: number;
  /** 1–12. Months are one-based here, because that is how a rule is written. */
  m: number;
  d: number;
}

/**
 * Howard Hinnant's `days_from_civil`. Exact for any Gregorian date, no `Date`,
 * no branch on leap years beyond the era arithmetic that already handles them.
 */
export function daysFromCivil(y: number, m: number, d: number): number {
  const shifted = y - (m <= 2 ? 1 : 0);
  const era = Math.floor(shifted / 400);
  const yearOfEra = shifted - era * 400;
  const dayOfYear = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** The inverse. `daysFromCivil(civilFromDays(n))` is `n`, for every `n`. */
export function civilFromDays(days: number): Civil {
  const shifted = days + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const mp = Math.floor((5 * dayOfYear + 2) / 153);
  const d = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: year + (m <= 2 ? 1 : 0), m, d };
}

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

/** `{ y: 2026, m: 4, d: 5 }` → `"2026-04-05"`. */
export function isoOf({ y, m, d }: Civil): string {
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/**
 * `"2026-04-05"` → an epoch day, or `null` for anything that is not one.
 *
 * IT REJECTS RATHER THAN COERCES, and that is the whole reason it returns a
 * union. The one place a date arrives from outside this package is a day the
 * operator typed into the settings panel, and `new Date("2026-02-30")` happily
 * answers "2 March" while `new Date("last tuesday")` answers `NaN` and a `NaN`
 * propagates silently through every comparison it touches. A day that does not
 * exist has to be refused where it is read, not stored and discovered later.
 *
 * The round trip is what makes it total: `2026-02-30` parses to numbers, those
 * numbers convert to an epoch day, and that day converts back to `2026-03-02`,
 * which is not the string that came in. So there is no month-length table here
 * and no leap-year rule — the conversion already knows both.
 */
export function epochDayOf(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return null;
  const y = Number.parseInt(match[1]!, 10);
  const m = Number.parseInt(match[2]!, 10);
  const d = Number.parseInt(match[3]!, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const days = daysFromCivil(y, m, d);
  return isoOf(civilFromDays(days)) === iso ? days : null;
}

/** Which day of the week an epoch day falls on. */
export function weekdayOf(epochDay: number): Weekday {
  // 1970-01-01 was a Thursday, which is 4 in this numbering. The `+ 7` before
  // the modulo is what keeps dates before the epoch from answering negatively —
  // no set needs one, and a helper that quietly broke for them would be a trap.
  return (((epochDay + 4) % 7) + 7) % 7 as Weekday;
}

/**
 * EASTER SUNDAY IN THE GREGORIAN CALENDAR — Meeus/Jones/Butcher.
 *
 * ── WHY A COMPUTATION AND NOT A TABLE ───────────────────────────────────────
 *
 * Four of the five day-sets this add-on ships hang most of their days off
 * Easter, and Easter is the one movable feast in Western Europe that is fully
 * DETERMINED: it is the Sunday after the first ecclesiastical full moon on or
 * after 21 March, and the arithmetic below is that definition, not an
 * approximation of it. A table of two years would have to be re-typed for a
 * third and would be exactly as trustworthy as whoever typed it.
 *
 * That is the same test every set in this package has to pass — see
 * `daysets.ts`: a day ships if it is fixed in the calendar or computable from a
 * published rule, and it does not ship otherwise. Easter passes it; the lunar
 * dates a state ANNOUNCES each year do not, whatever an almanac says.
 *
 * ── AND WHY THE SUITE STILL PINS DATES ──────────────────────────────────────
 *
 * `civil.test.ts` checks this against five independently-known Easters
 * (2024–2028) rather than against itself. An algorithm transcribed with one
 * digit wrong is self-consistent and produces a plausible Sunday in March or
 * April every time, so the only check worth having is against a fact from
 * somewhere else.
 *
 * WESTERN EASTER ONLY, said out loud because it is a limit rather than an
 * oversight: the Orthodox reckoning uses the Julian calendar and falls on a
 * different day most years. No set here needs it. A country whose public
 * holidays follow the Orthodox date needs its own rule, not a parameter on this
 * one — see the `announced annually` list for how this package handles a day it
 * cannot compute.
 */
export function easterSunday(year: number): Civil {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { y: year, m: month, d: day };
}

/**
 * The `nth` `weekday` of a month — and `nth: -1` for the LAST one.
 *
 * The negative case is not a convenience: American Memorial Day is the last
 * Monday in May, which is the fourth Monday in some years and the fifth in
 * others (2026 → 25 May, the fourth; 2027 → 31 May, the fifth). A rule written
 * as "the fourth Monday" would be right once and wrong the next year, which is
 * the class of error this whole package exists to not make.
 */
export function nthWeekdayOf(year: number, month: number, weekday: Weekday, nth: number): Civil {
  if (nth < 0) {
    // The last day of the month is the day before the first of the next.
    const lastDay = daysFromCivil(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) - 1;
    const back = (weekdayOf(lastDay) - weekday + 7) % 7;
    return civilFromDays(lastDay - back - 7 * (-nth - 1));
  }
  const firstDay = daysFromCivil(year, month, 1);
  const forward = (weekday - weekdayOf(firstDay) + 7) % 7;
  return civilFromDays(firstDay + forward + 7 * (nth - 1));
}
