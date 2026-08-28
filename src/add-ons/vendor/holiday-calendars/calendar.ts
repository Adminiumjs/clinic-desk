/*
 * VENDORED from add-ons/packages/holiday-calendars/src/calendar.ts — synced by scripts/sync-add-ons.sh.
 * Never hand-edit this copy: edit the monorepo and re-run `sync-add-ons.sh sync`.
 * The add-on key is `holiday-calendars`; its manifest, tests and README live in the monorepo.
 */
/**
 * WHAT THIS ADD-ON STORES, AND THE ONE SURFACE A HOST READS IT THROUGH.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * THE MECHANISM, BECAUSE AN EARLIER DRAFT HAD IT BACKWARDS
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * `SettingsPanelPayload.patch` writes THE ADD-ON'S OWN VALUES. It does not
 * write host tables, it cannot write host tables, and there is no slot in the
 * closed registry that would let it — an add-on that "imports holidays into the
 * HR app" in the sense of inserting rows does not exist and could not be built
 * against this seam.
 *
 * So an import lands HERE, in this add-on's own settings document, and the HOST
 * merges what it finds into whatever it passes its own engine, at the mount
 * site. That is the host-maps-at-the-seam rule `@adminium/add-on-host`'s
 * `payloads.ts` codifies, applied to data instead of to a payload: the add-on
 * says what it knows in its own shape, the host says what that means in its.
 *
 * ── THE READ SURFACE IS THE DELIVERABLE, NOT THE STORAGE ────────────────────
 *
 * `nonWorkingDays(values)` below is the whole of what a host is given. It is a
 * pure function of the values the host already holds — no React, no hooks, no
 * module state, nothing to initialise and nothing to keep in step. A host calls
 * it where it builds the array it was going to build anyway.
 *
 * NOTHING ELSE IS PUBLIC. `STORAGE_KEY`, `StoredDay` and `readStored` exist so
 * this package's own panel and its own suites can work; they are not exported
 * from `index.ts`, and the reason is the same one that keeps a carrier's
 * credentials out of a client bundle: a host that reached into the storage
 * shape would be coupled to it, and the first change to that shape would break
 * two apps this repository does not build. The seam is a function returning
 * plain data.
 *
 * ── WHY THE FUNCTION IS CALLED `nonWorkingDays` ─────────────────────────────
 *
 * Because that is the question both consuming hosts already ask, in their own
 * source, in almost those words:
 *
 *   `people-ops`  — `isWorkday(serial, holidays)` in `src/lib/leave.ts`
 *   `clinic-desk` — `isWorkingDay(iso)` in `src/lib/schedule.ts`
 *
 * It is deliberately not `holidays()`: half of what this returns is days the
 * operator typed in, and a clinic that shuts for a training afternoon has not
 * declared a public holiday. It is not `closures()` either, which is
 * `clinic-desk`'s own word for its own table and would be one host's vocabulary
 * pushed onto the other — the exact defect `payloads.ts` was written about.
 *
 * ── AND WHY IT HANDS OUT ISO STRINGS ────────────────────────────────────────
 *
 * The two hosts store a day two different ways. `people-ops` uses a DAY SERIAL
 * — whole days since the Unix epoch, UTC — and every leave balance in that app
 * is arithmetic on it. `clinic-desk` uses `YYYY-MM-DD` text, in a `date`
 * column. Neither is more correct and this package must not pick a winner, so
 * it hands over the form that is exactly convertible to both, sorts correctly
 * as text, and is what a person would type: the ISO calendar day.
 *
 * `civil.ts` exports `epochDayOf` for a host that wants the serial. It is a
 * pure conversion over the string, NOT a second field on the record — a record
 * carrying both would be two statements of one fact, and the day they disagreed
 * nothing would say which was right.
 */

import type { AddOnSettingValues } from "../host/index.ts";

import { epochDayOf } from "./civil.ts";
import { daySetFor, expandSet, YEARS, type DaySet } from "./daysets.ts";

/**
 * The one key this add-on stores anything under.
 *
 * `manifest.json` declares it as a `json` setting and lists it in
 * `publicSettings`, which is the manifest's way of saying "the client bundle
 * may read this". It may: there is no secret in this package to keep out of a
 * browser, and the panel that writes it is the only thing that reads it.
 */
export const STORAGE_KEY = "days";

/** Which curated set a day came from. Absent means the operator typed it. */
export interface DayOrigin {
  /** ISO 3166-1 alpha-2, upper case. */
  readonly country: string;
  /** The set's own key for an area within the country, or absent for national. */
  readonly region?: string;
  readonly year: number;
}

/**
 * ONE DAY, AS THIS ADD-ON HOLDS IT.
 *
 * `from` carries two facts at once and that is why there is no `local: boolean`
 * beside it. A boolean would be a second statement of `from === undefined`, and
 * a record that says the same thing twice is a record that will one day say it
 * two different ways — the shape `payloads.ts` rejects a redundant field for.
 * A reader asking "did somebody type this?" asks whether `from` is there.
 */
export interface StoredDay {
  /** ISO `YYYY-MM-DD`. */
  readonly date: string;
  /**
   * What the day is called. For an imported day this is the country's own
   * name for it; for a typed one it is whatever the operator wrote, which is
   * the whole point — "stocktake" is not a public holiday and must survive.
   */
  readonly name: string;
  /** The set this came from, or absent for a day the operator typed. */
  readonly from?: DayOrigin;
}

/** Two origins name the same set. */
function sameOrigin(a: DayOrigin, b: DayOrigin): boolean {
  return a.country === b.country && (a.region ?? "") === (b.region ?? "") && a.year === b.year;
}

/**
 * Sorted the one way every consumer wants it: by day, then by name.
 *
 * The second term is not decoration. Two countries' sets can legitimately land
 * on the same date — 25 December is in five of the six sets here — and a sort
 * that stopped at the date would leave their order depending on which was
 * imported first. A stable, content-determined order is what lets a suite
 * assert that re-importing changed nothing at all, rather than that it changed
 * nothing important.
 */
function ordered(days: readonly StoredDay[]): readonly StoredDay[] {
  return [...days].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
}

/**
 * READ WHAT IS THERE, BELIEVING NONE OF IT.
 *
 * The host holds an add-on's values as an opaque `Record<string, unknown>` and
 * is right to: it has no business knowing their types. That makes this the
 * boundary where they become typed, and a boundary that assumed its input would
 * be well-formed would be a boundary in name only. A document written by an
 * older version of this add-on, hand-edited, or truncated has to come back as
 * the days that ARE readable rather than as a throw in the middle of somebody's
 * settings screen.
 *
 * A date that is not a real calendar day is dropped rather than kept, because
 * `epochDayOf` is the only thing standing between `2026-02-30` and a row on a
 * calendar that no host can ever match. A day with no name is dropped for the
 * same reason: a nameless closure on a leave form tells a reader nothing and
 * `people-ops` would render an empty string where the holiday's name goes.
 */
export function readStored(values: AddOnSettingValues | undefined): readonly StoredDay[] {
  const raw = (values ?? {})[STORAGE_KEY];
  if (!Array.isArray(raw)) return [];

  const out: StoredDay[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const date = record["date"];
    const name = record["name"];
    if (typeof date !== "string" || epochDayOf(date) === null) continue;
    if (typeof name !== "string" || name.trim() === "") continue;

    const from = record["from"];
    if (typeof from !== "object" || from === null) {
      out.push({ date, name });
      continue;
    }
    const origin = from as Record<string, unknown>;
    const country = origin["country"];
    const region = origin["region"];
    const year = origin["year"];
    if (typeof country !== "string" || typeof year !== "number") {
      // A day stamped with an unreadable origin is still a real day somebody
      // meant to keep. It survives as a typed one rather than being dropped —
      // losing a closure is the worst thing this package can do (see D16 and
      // `applyImport` below), and "we could not read where it came from" is not
      // a reason to lose it.
      out.push({ date, name });
      continue;
    }
    out.push({
      date,
      name,
      from: typeof region === "string" && region !== "" ? { country, region, year } : { country, year },
    });
  }
  return ordered(out);
}

/** Hand back to the host in the shape `patch` takes. */
export function writeStored(days: readonly StoredDay[]): Record<string, unknown> {
  return { [STORAGE_KEY]: ordered(days) };
}

// ── importing a year ────────────────────────────────────────────────────────

/**
 * ONE COLLISION: a day the operator typed, on a date the set also names.
 *
 * Both sides are carried because the refusal has to be readable. "Christmas Day
 * is already taken" is not actionable; "you have `Closed — family` on 25
 * December and this set calls it `Juledag`" tells an operator exactly which row
 * to delete.
 */
export interface Collision {
  readonly date: string;
  /** What the operator called it. */
  readonly yours: string;
  /** What the set calls it. */
  readonly theirs: string;
}

export type ImportOutcome =
  | {
      readonly ok: true;
      /** The whole day list as it would be after the import. */
      readonly days: readonly StoredDay[];
      /** Days this import added that were not there before. */
      readonly added: number;
      /** Days from a previous import of THIS set that it replaced. */
      readonly replaced: number;
    }
  | {
      readonly ok: false;
      readonly collisions: readonly Collision[];
    };

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * THE REFUSAL (25 D10), AND THE RULE IT REFUSES BY
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Importing a year REFUSES when one of its days falls on a date the operator
 * has already entered by hand. It names every collision, and the fix is to
 * remove the day they typed — after which the same import succeeds.
 *
 * ── WHY THAT IS A REAL RULE AND NOT AN INVENTED OBSTACLE ────────────────────
 *
 * Two rows on one date is not a crash; it is an AMBIGUITY, and the damage is
 * that the add-on would resolve it silently and differently in each host. Both
 * consuming hosts look a day up by taking the first match — `people-ops`'
 * `holidayOn` is a `.find()` — so which name a person reads on the calendar
 * would depend on the order two lists happened to be concatenated in. The
 * operator wrote "Closed — family" on 25 December on purpose; the set says
 * "Juledag"; one of those is about to win, and nothing in this package is
 * entitled to pick.
 *
 * So it does not pick. It stops, says which dates are in question and what each
 * side calls them, and lets the person who wrote one of the two decide. That is
 * a refusal by a real rule with a real fix, and the fix is one click on the row
 * they already recognise.
 *
 * ── WHAT IS *NOT* A COLLISION, WHICH IS THE HALF THAT KEEPS IT HONEST ───────
 *
 * TWO CURATED SETS SHARING A DATE. Import Germany and France for 2026 and both
 * name 25 December; a business that operates in both countries genuinely has
 * two names for that day, neither of them an operator's decision, and refusing
 * would make the second country unimportable for no reason. Both are kept.
 *
 * RE-IMPORTING THE SAME SET. The days it is about to lay down are the days it
 * laid down last time — they are stamped with this exact origin — so they are
 * replaced, not collided with. Without that clause the second import of any
 * year would refuse against its own output, which is the shape a naive
 * duplicate check takes and the reason the check is written against ORIGIN
 * rather than against DATE.
 *
 * The rule is therefore precise: a collision is a date this set names that
 * carries a day WITH NO ORIGIN — a day only a person could have put there.
 */
export function applyImport(
  current: readonly StoredDay[],
  set: DaySet,
  year: number,
): ImportOutcome {
  const origin: DayOrigin =
    set.region === undefined
      ? { country: set.country, year }
      : { country: set.country, region: set.region, year };

  const incoming = expandSet(set, year);
  const dates = new Map(incoming.map((day) => [day.date, day.name]));

  const collisions: Collision[] = [];
  for (const day of current) {
    if (day.from !== undefined) continue;
    const theirs = dates.get(day.date);
    if (theirs !== undefined) collisions.push({ date: day.date, yours: day.name, theirs });
  }
  if (collisions.length > 0) {
    return { ok: false, collisions: [...collisions].sort((a, b) => (a.date < b.date ? -1 : 1)) };
  }

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * IDEMPOTENCY, AND THE ONE LINE THAT CARRIES IT
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Everything stamped with THIS origin goes; everything else stays untouched.
   * Then this year's days are laid down once each.
   *
   * That single filter is what makes a second import of the same year produce a
   * byte-identical list — nothing is appended to, so nothing can accumulate —
   * and it is also what makes the operator's own days safe, because a day with
   * no origin can never match an origin. THE FILTER IS ON `from`, NOT ON
   * `date`, and the difference is the worst bug this add-on could have: a
   * date-based replace would delete a clinic's own closure on any date a public
   * holiday happened to share, silently, on a re-import nobody thought was
   * destructive. A clinic shuts for reasons that are not public holidays, and
   * losing those loses a real appointment.
   *
   * D16 is the same promise one level up: disconnecting this add-on takes its
   * surfaces and leaves the days behind. A re-import is the smaller version of
   * that promise and is kept the same way.
   */
  const kept = current.filter((day) => day.from === undefined || !sameOrigin(day.from, origin));
  const replaced = current.length - kept.length;
  const days = ordered([...kept, ...incoming.map((day) => ({ ...day, from: origin }))]);
  return { ok: true, days, added: days.length - kept.length, replaced };
}

/** Drop every day a previous import of this set left behind. */
export function forgetSet(
  current: readonly StoredDay[],
  country: string,
  region: string | undefined,
  year: number,
): readonly StoredDay[] {
  const origin: DayOrigin =
    region === undefined ? { country, year } : { country, region, year };
  return current.filter((day) => day.from === undefined || !sameOrigin(day.from, origin));
}

/**
 * Add a day of the business's own.
 *
 * Refuses a date that is not a real calendar day, an empty name, and a date the
 * operator has ALREADY typed — the same ambiguity `applyImport` refuses, met
 * from the other direction. It does not refuse a date an imported day already
 * covers: adding "Stocktake" to a day that is also Boxing Day is a coherent
 * thing to record, and refusing it would make the imported set an obstacle
 * rather than a starting point.
 */
export type AddOutcome =
  | { readonly ok: true; readonly days: readonly StoredDay[] }
  | { readonly ok: false; readonly why: "date" | "name" | "duplicate" };

export function addOwnDay(
  current: readonly StoredDay[],
  date: string,
  name: string,
): AddOutcome {
  if (epochDayOf(date) === null) return { ok: false, why: "date" };
  const trimmed = name.trim();
  if (trimmed === "") return { ok: false, why: "name" };
  if (current.some((day) => day.from === undefined && day.date === date)) {
    return { ok: false, why: "duplicate" };
  }
  return { ok: true, days: ordered([...current, { date, name: trimmed }]) };
}

/** Drop one day the operator typed. */
export function forgetOwnDay(
  current: readonly StoredDay[],
  date: string,
): readonly StoredDay[] {
  return current.filter((day) => !(day.from === undefined && day.date === date));
}

// ── the read surface ────────────────────────────────────────────────────────

/**
 * ONE DAY THE BUSINESS DOES NOT WORK, AS A HOST RECEIVES IT.
 *
 * Deliberately not `StoredDay` re-exported. The stored shape is this package's
 * private document and will change — a translations field, an origin that
 * carries a revision — and a host that had been handed it would change with it.
 * This is the promise: three fields, all of them things every host of this data
 * can use, and `from` optional because whether a day is somebody's own is the
 * one distinction both hosts draw differently (a clinic labels its own closures
 * with a reason; a leave calendar shows public holidays and personal absence in
 * different colours) and neither can draw without being told.
 */
export interface NonWorkingDay {
  /** ISO `YYYY-MM-DD`. Convert with `epochDayOf` if you keep day serials. */
  readonly date: string;
  /** In the country's own language for an imported day; the operator's words otherwise. */
  readonly name: string;
  /** Which curated set it came from, or absent for a day somebody typed. */
  readonly from?: DayOrigin;
}

/**
 * EVERY DAY THIS ADD-ON HOLDS, sorted by date then by name.
 *
 * The one function a host calls. Pure, total, and defined for values it has
 * never seen: an add-on that has just been connected and has imported nothing
 * returns `[]`, and a host merging `[]` is a host that behaves exactly as it
 * did before the add-on existed. That is 24 D6 — the app is designed with the
 * hole already in it — expressed as a return value.
 *
 * ── HOW EACH HOST MERGES IT, WHICH IS THE HOST'S JOB AND NOT THIS FILE'S ────
 *
 * `people-ops` builds a `Holiday[]` — `{ serial, name }` — and hands it to
 * `holidayOn` / `isWorkday` / `workingDays`, all of which already take the
 * array as an argument. So the mount site maps `epochDayOf(day.date)` into
 * `serial` and `day.name` into `name`, concatenates with its own seeded
 * holidays, and every leave balance in the app comes off the result with no
 * change to the engine at all.
 *
 * `clinic-desk` reads `closures` rows — `{ on_date, reason, clinician_id }` —
 * so the same day maps to `on_date: day.date`, `reason: day.name` and a null
 * clinician, which its schema already documents as "the whole practice is
 * shut". Its `isWorkingDay` is a weekday predicate today and gains the lookup.
 *
 * TWO HOSTS, TWO RECORD SHAPES, ONE ARRAY, AND NEITHER HOST REACHES INTO THIS
 * ADD-ON'S STORAGE. That is the whole design.
 */
export function nonWorkingDays(values: AddOnSettingValues | undefined): readonly NonWorkingDay[] {
  return readStored(values);
}

/**
 * The years this pack will answer for.
 *
 * Re-exported here because a host or a panel asking "what can I import?" is
 * asking a question about this module's subject, and reaching into `daysets.ts`
 * for it would make the data file part of the public surface.
 */
export function reviewedYears(): readonly number[] {
  return YEARS;
}

/** The set a country and area name, if this pack has one. */
export { daySetFor };
