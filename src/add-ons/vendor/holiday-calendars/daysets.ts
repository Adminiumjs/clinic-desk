/*
 * VENDORED from add-ons/packages/holiday-calendars/src/daysets.ts — synced by scripts/sync-add-ons.sh.
 * Never hand-edit this copy: edit the monorepo and re-run `sync-add-ons.sh sync`.
 * The add-on key is `holiday-calendars`; its manifest, tests and README live in the monorepo.
 */
/**
 * THE DAY-SETS — the whole product, as data, in the bundle.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ACCURACY IS THE PRODUCT. A DAY-SET NOBODY CAN VOUCH FOR IS WORSE THAN NONE.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Everything else about this add-on — the picker, the refusal, the read surface
 * — is scaffolding around a list of dates that a business will close its doors
 * on and pay people for. A wrong date here does not throw, does not colour a
 * cell red and does not appear in any suite: it silently books somebody in on a
 * day the practice is shut, or silently charges a day of leave for a day nobody
 * worked. There is no failure mode further from a stack trace.
 *
 * So this file admits ONE KIND OF DAY:
 *
 *   FIXED IN THE CALENDAR — the twenty-fifth of December, the fourteenth of
 *   July. Nothing to derive; the statute names the date.
 *
 *   COMPUTABLE FROM A PUBLISHED RULE — the third Monday in January, the last
 *   Monday in May, thirty-nine days after Easter. The rule is the statute's own
 *   wording and `civil.ts` carries out the arithmetic.
 *
 * And it refuses, out loud and by name, every day that is neither — see
 * `ANNOUNCED_ANNUALLY` below, which is the most interesting thing in the file.
 *
 * ── WHY THE SETS ARE DECLARED AS RULES AND EXPANDED, NOT TYPED OUT ──────────
 *
 * A hand-typed list of dates for two years is 130-odd numbers, and every one of
 * them is an opportunity to transcribe a digit wrong in a way no reader would
 * ever catch. A rule is short enough to check by eye against the statute it
 * came from, it is the same shape for every year, and it makes "and 2028" a
 * one-line change rather than another 65 numbers.
 *
 * The cost is that the expansion could be self-consistently wrong, and
 * `daysets.test.ts` is built around exactly that: it pins ANCHOR DATES known
 * from outside this repository — Easter, Thanksgiving, the American federal
 * weekday holidays — so a transcription error in `easterSunday` fails against a
 * fact rather than against itself.
 *
 * ── WHICH COUNTRIES, AND WHY THAT LIST AND NOT A LONGER ONE ─────────────────
 *
 * The eight locales this repository ships name eight places. Five of them have
 * a set here; three of them cannot have one, and the picker says so by name.
 * That is the whole selection rule, and it is a rule rather than a list on
 * purpose: "the countries whose languages we already speak" is defensible in a
 * sentence, and "the twelve countries somebody had an afternoon for" is not.
 *
 * Adding a country is therefore a decision with a shape: either its holidays
 * are fixed or computable, in which case it can have a set the day somebody
 * checks it against the statute and takes on reviewing it every year — or they
 * are announced, in which case it goes in the refusal list beside China.
 *
 * ── REGIONS ARE IN THE TYPE EVEN THOUGH FIVE OF THE SIX SETS ARE NATIONAL ───
 *
 * Not decoration, and not speculation. Germany's public holidays are set by
 * each of sixteen federal states and only nine are common to all of them;
 * France keeps two extra days in Bas-Rhin, Haut-Rhin and Moselle. A type that
 * could not say "this set is for part of a country" would have to be changed
 * the first time either fact was honoured, and changing a published shape is
 * more expensive than carrying an optional field.
 *
 * One regional set ships — France · Alsace-Moselle — because the type earns its
 * place by being used rather than by being explained, and because those two
 * days are small, statutory and easy to be sure of. Germany's states do NOT
 * ship, and that is the same judgement this file makes everywhere else: several
 * of the state-level days depend on which MUNICIPALITY a business sits in
 * (Bavaria's Mariä Himmelfahrt is observed in some and not others), and a set
 * that got that wrong would be wrong in exactly the silent way described above.
 * The German set says in the picker that it is the national nine and that
 * states add their own.
 *
 * ── WHAT A SET DELIBERATELY DOES NOT CARRY: SUBSTITUTE DAYS ─────────────────
 *
 * Where a holiday falls at the weekend, some countries move the day off to the
 * nearest weekday. American federal practice is the clearest case — 5 U.S.C.
 * 6103(b) observes a Saturday holiday on the Friday before — and 4 July 2026 is
 * a Saturday, so this set names 4 July and no other day.
 *
 * That is deliberate. A day-set says WHICH DAYS THE STATE NAMES. Whether a
 * particular business shifts its own closure is a decision that business makes,
 * it differs between employers inside one country, and both hosts already have
 * a weekend predicate sitting next to where they merge these days in. Emitting
 * a substitute would be this package inventing a day the statute does not name
 * and no reader asked for.
 *
 * What would change it: a host that genuinely needs the observed day. The
 * answer then is a per-country substitution rule read off each country's own
 * statute — never one global rule, because there is no global rule — and it
 * would arrive as a new field on `DaySet`, with the same anchor-date suite
 * behind it. It is not "a small addition to the expander".
 */

import { civilFromDays, daysFromCivil, easterSunday, isoOf, nthWeekdayOf, type Weekday } from "./civil.ts";
import type { StringKey } from "./i18n/strings.ts";

/**
 * How one day is worked out.
 *
 * THREE VARIANTS, AND THE FOURTH ONE IS ABSENT ON PURPOSE. An earlier shape had
 * a `weekday-before` case — "the Wednesday before 23 November", which is how
 * Saxony's Buß- und Bettag is defined — and nothing in this package uses it,
 * because no German state set ships. A variant with no set behind it is a guess
 * about a future country dressed up as a type, and the expander below would
 * have carried a branch nothing had ever executed. It goes in when a set needs
 * it, with a set behind it.
 */
export type DayRule =
  /** The same date every year. `month` is 1–12. */
  | { readonly on: "fixed"; readonly month: number; readonly day: number }
  /** Whole days from Easter Sunday: `-2` is Good Friday, `+50` is Whit Monday. */
  | { readonly on: "easter"; readonly offset: number }
  /** The `nth` `weekday` of `month`; `nth: -1` is the last one in the month. */
  | { readonly on: "weekday"; readonly month: number; readonly weekday: Weekday; readonly nth: number };

/**
 * One day in a set: what it is called, and how its date is found.
 *
 * ── `name` IS DATA IN ITS OWN LANGUAGE, NOT COPY, AND NOT AN I18N KEY ───────
 *
 * This is the decision in this package a reader is most likely to want to undo,
 * so here is the whole of it.
 *
 * A holiday's name is a proper noun belonging to the country whose holiday it
 * is. `Tag der Deutschen Einheit` is what a German office calls the third of
 * October whatever language its leave screen happens to be in, and a Czech
 * manager of a German office reading a Czech rendering of it would be looking
 * at a day nobody in that office calls that. Translating it does not localise
 * it; it renames it.
 *
 * The mechanical half matters too, and it is what makes this work TODAY with no
 * change in either host. `people-ops` declares `Holiday.name` as "an i18n key"
 * and resolves it through `label()`, which is `tOr(key, key)` — it falls back
 * to the string itself when the bundle has no such key. So a literal name
 * arrives on that app's calendar, its request form and its skipped-days list
 * exactly as written here, with nothing added to any bundle. An i18n key would
 * need the HOST to carry sixty-odd keys in eight languages for days it does not
 * own, and a key the host has not got renders as `holiday.us.thanksgiving` on
 * somebody's screen.
 *
 * `clinic-desk`'s `closures.reason` is a plain text column and takes the name
 * as-is for the same reason.
 *
 * WHAT IS TRANSLATED is everything this add-on says ABOUT the days — the
 * picker, the areas' names, the refusals, the counts, the maintenance line.
 * That is the same line `@adminium/add-on-host` draws in `AddOn.name`: a
 * product's name is a proper noun and does not translate; everything about it
 * does.
 *
 * What would change this: a host that needs the day's name in the READER's
 * language rather than the country's — a multinational rota, say. The answer
 * then is a second, OPTIONAL field carrying translations beside the native
 * name, never a replacement of it, because the native name is the one a person
 * in that country will recognise on a calendar.
 */
export interface NamedDay {
  /** In the country's own language, as the state names it. */
  readonly name: string;
  readonly rule: DayRule;
}

/**
 * WHERE A SET CAME FROM AND WHEN SOMEBODY LAST LOOKED AT IT.
 *
 * A data pack without this rots invisibly. Every set carries it, the panel
 * shows it beside the preview, and `daysets.test.ts` fails a set that has
 * neither — because "which statute is this?" is the first question anybody
 * checking a date will ask, and an answer that lives in a commit message is an
 * answer nobody will find.
 *
 * `statedIn` is an i18n key rather than a literal because it is a SENTENCE
 * about the set, shown to an operator, and the operator may be reading in any
 * of eight languages. The names of the days inside the set are not, for the
 * reason `NamedDay` gives at length.
 */
export interface Derivation {
  /** i18n key: the statute or published rule these days are taken from. */
  readonly statedIn: StringKey;
  /** ISO date somebody last checked this set against that source. */
  readonly reviewedOn: string;
}

export interface DaySet {
  /** ISO 3166-1 alpha-2, upper case. */
  readonly country: string;
  /**
   * The area within the country, or absent for a national set.
   *
   * NOT ISO 3166-2, and the one set that uses it is why. Alsace-Moselle is
   * three départements (Bas-Rhin, Haut-Rhin and Moselle) that share two extra
   * holidays; there is no single subdivision code for it, so a field typed as
   * "an ISO 3166-2 code" could not have expressed the only regional set this
   * package ships. It is therefore the SET'S OWN stable key for the area —
   * lower case, hyphenated — and an ISO 3166-2 code is a perfectly good value
   * for it where the area happens to be one subdivision.
   *
   * It is part of a set's identity: `{ country, region, year }` is what an
   * import is stamped with and what a re-import replaces.
   */
  readonly region?: string;
  /** i18n key for the area's name, as the picker lists it. */
  readonly labelKey: StringKey;
  /** i18n key for the sentence under the preview — what this set is and is not. */
  readonly noteKey: StringKey;
  readonly days: readonly NamedDay[];
  readonly derivation: Derivation;
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * THE REFUSAL THIS PRODUCT SHIPS FOR FREE OF ITS OWN ACCORD
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Several states do not have a public-holiday calendar that can be computed at
 * all. They ANNOUNCE one, each year, by decree:
 *
 *   · China's State Council publishes the following year's arrangement in the
 *     autumn, including which weekends are worked to bridge the breaks. The
 *     lunar dates behind Spring Festival can be computed; the arrangement
 *     cannot, and the arrangement is what a business closes on.
 *   · Taiwan's calendar is published annually with its make-up days and its
 *     adjusted weekends, on the same pattern.
 *   · Egypt's Islamic holidays follow the lunar month and are confirmed by
 *     sighting, and the cabinet moves several fixed national days to the
 *     nearest Thursday by decree each year.
 *
 * A pack that guessed them would be worse than a pack that has no data for
 * them, because a guess is indistinguishable from a fact once it is on a
 * calendar. So this list exists and the picker RENDERS IT — the countries are
 * named, with the reason, where a reader is choosing. Silently omitting them
 * would leave an operator in Cairo assuming the product simply has not got
 * round to Egypt, which is a different and false statement.
 *
 * It is also the honest answer to "why only five countries": the constraint is
 * not effort, it is what can be known in advance, and saying which countries
 * fall on the other side of that line is more useful than five more sets.
 *
 * ── WHAT WOULD CHANGE THIS ──────────────────────────────────────────────────
 *
 * A set for one of these could ship as a set of ANNOUNCED YEARS — a literal
 * list of dates for the years a decree has actually been published for, with no
 * rule and no expansion, and a hard stop at the last announced year rather than
 * a silent empty result. That is a different data shape from `DaySet` and would
 * need the picker to say "2027 has not been announced yet". It is a real
 * product and it is not this one.
 */
export interface AnnouncedAnnually {
  /** ISO 3166-1 alpha-2, upper case. */
  readonly country: string;
  readonly labelKey: StringKey;
  /** i18n key: why this add-on has no set for it, in plain words. */
  readonly whyKey: StringKey;
}

export const ANNOUNCED_ANNUALLY: readonly AnnouncedAnnually[] = [
  {
    country: "CN",
    labelKey: "addon.holiday-calendars.area.cn",
    whyKey: "addon.holiday-calendars.announced.cn",
  },
  {
    country: "TW",
    labelKey: "addon.holiday-calendars.area.tw",
    whyKey: "addon.holiday-calendars.announced.tw",
  },
  {
    country: "EG",
    labelKey: "addon.holiday-calendars.area.eg",
    whyKey: "addon.holiday-calendars.announced.eg",
  },
];

// ── the sets ────────────────────────────────────────────────────────────────

const MON: Weekday = 1;
const THU: Weekday = 4;

/**
 * The eleven American federal holidays.
 *
 * Six are fixed dates and five are weekday rules, all as 5 U.S.C. 6103(a)
 * states them. Memorial Day is `nth: -1` and not `nth: 4`: it is the LAST
 * Monday in May, which is the fourth Monday in 2026 and the fifth in 2027.
 *
 * `Washington's Birthday` is the statutory name of the February holiday. Many
 * calendars print `Presidents' Day`; the statute does not, and a data pack's
 * job is to say what the statute says.
 *
 * FEDERAL, WHICH IS NOT THE SAME AS NATIONAL. These are the days federal
 * offices close; individual states add their own and private employers vary.
 * The picker's note says so rather than letting the word "United States" imply
 * more than the set contains.
 */
const UNITED_STATES: DaySet = {
  country: "US",
  labelKey: "addon.holiday-calendars.area.us",
  noteKey: "addon.holiday-calendars.note.us",
  derivation: {
    statedIn: "addon.holiday-calendars.from.us",
    reviewedOn: "2026-08-28",
  },
  days: [
    { name: "New Year's Day", rule: { on: "fixed", month: 1, day: 1 } },
    { name: "Birthday of Martin Luther King, Jr.", rule: { on: "weekday", month: 1, weekday: MON, nth: 3 } },
    { name: "Washington's Birthday", rule: { on: "weekday", month: 2, weekday: MON, nth: 3 } },
    { name: "Memorial Day", rule: { on: "weekday", month: 5, weekday: MON, nth: -1 } },
    { name: "Juneteenth National Independence Day", rule: { on: "fixed", month: 6, day: 19 } },
    { name: "Independence Day", rule: { on: "fixed", month: 7, day: 4 } },
    { name: "Labor Day", rule: { on: "weekday", month: 9, weekday: MON, nth: 1 } },
    { name: "Columbus Day", rule: { on: "weekday", month: 10, weekday: MON, nth: 2 } },
    { name: "Veterans Day", rule: { on: "fixed", month: 11, day: 11 } },
    { name: "Thanksgiving Day", rule: { on: "weekday", month: 11, weekday: THU, nth: 4 } },
    { name: "Christmas Day", rule: { on: "fixed", month: 12, day: 25 } },
  ],
};

/**
 * The nine days that are public holidays in EVERY German federal state.
 *
 * Public holidays in Germany are set by the states, not federally — only the
 * third of October is fixed in national law — and the nine below are the
 * intersection, which is the only set that is true everywhere the word
 * "Germany" is on a picker. Ten of the sixteen states add days on top, several
 * of them varying by municipality, and the note under the preview says so.
 */
const GERMANY: DaySet = {
  country: "DE",
  labelKey: "addon.holiday-calendars.area.de",
  noteKey: "addon.holiday-calendars.note.de",
  derivation: {
    statedIn: "addon.holiday-calendars.from.de",
    reviewedOn: "2026-08-28",
  },
  days: [
    { name: "Neujahr", rule: { on: "fixed", month: 1, day: 1 } },
    { name: "Karfreitag", rule: { on: "easter", offset: -2 } },
    { name: "Ostermontag", rule: { on: "easter", offset: 1 } },
    { name: "Tag der Arbeit", rule: { on: "fixed", month: 5, day: 1 } },
    { name: "Christi Himmelfahrt", rule: { on: "easter", offset: 39 } },
    { name: "Pfingstmontag", rule: { on: "easter", offset: 50 } },
    { name: "Tag der Deutschen Einheit", rule: { on: "fixed", month: 10, day: 3 } },
    { name: "Erster Weihnachtstag", rule: { on: "fixed", month: 12, day: 25 } },
    { name: "Zweiter Weihnachtstag", rule: { on: "fixed", month: 12, day: 26 } },
  ],
};

/** The eleven French jours fériés of article L3133-1 of the Code du travail. */
const FRANCE_DAYS: readonly NamedDay[] = [
  { name: "Jour de l'An", rule: { on: "fixed", month: 1, day: 1 } },
  { name: "Lundi de Pâques", rule: { on: "easter", offset: 1 } },
  { name: "Fête du Travail", rule: { on: "fixed", month: 5, day: 1 } },
  { name: "Victoire 1945", rule: { on: "fixed", month: 5, day: 8 } },
  { name: "Ascension", rule: { on: "easter", offset: 39 } },
  { name: "Lundi de Pentecôte", rule: { on: "easter", offset: 50 } },
  { name: "Fête nationale", rule: { on: "fixed", month: 7, day: 14 } },
  { name: "Assomption", rule: { on: "fixed", month: 8, day: 15 } },
  { name: "Toussaint", rule: { on: "fixed", month: 11, day: 1 } },
  { name: "Armistice 1918", rule: { on: "fixed", month: 11, day: 11 } },
  { name: "Noël", rule: { on: "fixed", month: 12, day: 25 } },
];

const FRANCE: DaySet = {
  country: "FR",
  labelKey: "addon.holiday-calendars.area.fr",
  noteKey: "addon.holiday-calendars.note.fr",
  derivation: {
    statedIn: "addon.holiday-calendars.from.fr",
    reviewedOn: "2026-08-28",
  },
  days: FRANCE_DAYS,
};

/**
 * The same eleven, plus the two kept in Bas-Rhin, Haut-Rhin and Moselle.
 *
 * BUILT FROM `FRANCE_DAYS` RATHER THAN RETYPED, which is the whole reason that
 * array is hoisted. Two lists of eleven identical days would agree on the day
 * somebody wrote them and would be the first thing to drift when a French
 * holiday changed — and the difference between the two sets, which is the only
 * interesting thing about this one, would be buried in a diff of twenty-six
 * lines instead of being the two lines below.
 */
const FRANCE_ALSACE_MOSELLE: DaySet = {
  country: "FR",
  region: "alsace-moselle",
  labelKey: "addon.holiday-calendars.area.fr-alsace-moselle",
  noteKey: "addon.holiday-calendars.note.fr-alsace-moselle",
  derivation: {
    statedIn: "addon.holiday-calendars.from.fr-alsace-moselle",
    reviewedOn: "2026-08-28",
  },
  days: [
    ...FRANCE_DAYS,
    { name: "Vendredi saint", rule: { on: "easter", offset: -2 } },
    { name: "Saint Étienne", rule: { on: "fixed", month: 12, day: 26 } },
  ],
};

/**
 * The Czech state holidays and other holidays, thirteen of them.
 *
 * The first of January carries both of its names, because the day is both: it
 * is the state holiday marking the restoration of the independent Czech state
 * and it is New Year's Day, and a Czech calendar prints both.
 */
const CZECHIA: DaySet = {
  country: "CZ",
  labelKey: "addon.holiday-calendars.area.cz",
  noteKey: "addon.holiday-calendars.note.cz",
  derivation: {
    statedIn: "addon.holiday-calendars.from.cz",
    reviewedOn: "2026-08-28",
  },
  days: [
    { name: "Nový rok a Den obnovy samostatného českého státu", rule: { on: "fixed", month: 1, day: 1 } },
    { name: "Velký pátek", rule: { on: "easter", offset: -2 } },
    { name: "Velikonoční pondělí", rule: { on: "easter", offset: 1 } },
    { name: "Svátek práce", rule: { on: "fixed", month: 5, day: 1 } },
    { name: "Den vítězství", rule: { on: "fixed", month: 5, day: 8 } },
    { name: "Den slovanských věrozvěstů Cyrila a Metoděje", rule: { on: "fixed", month: 7, day: 5 } },
    { name: "Den upálení mistra Jana Husa", rule: { on: "fixed", month: 7, day: 6 } },
    { name: "Den české státnosti", rule: { on: "fixed", month: 9, day: 28 } },
    { name: "Den vzniku samostatného československého státu", rule: { on: "fixed", month: 10, day: 28 } },
    { name: "Den boje za svobodu a demokracii", rule: { on: "fixed", month: 11, day: 17 } },
    { name: "Štědrý den", rule: { on: "fixed", month: 12, day: 24 } },
    { name: "První svátek vánoční", rule: { on: "fixed", month: 12, day: 25 } },
    { name: "Druhý svátek vánoční", rule: { on: "fixed", month: 12, day: 26 } },
  ],
};

/**
 * The ten Danish helligdage — AND STORE BEDEDAG IS DELIBERATELY NOT ONE.
 *
 * Great Prayer Day, the fourth Friday after Easter, was a Danish public holiday
 * for three and a half centuries and was abolished as one with effect from
 * 2024. It is the single most likely thing for a reader to think is missing
 * from this set, and it is the single clearest illustration of why a data pack
 * needs a review date: a set built from a source published before 2023 carries
 * a day that no longer exists, and nothing about it would look wrong.
 *
 * Easter Sunday and Whit Sunday are in the set although both are Sundays. They
 * are helligdage in their own right; a host that also treats Sundays as
 * non-working simply sees the same day twice from two directions, which is the
 * ordinary case and not a duplicate (see `calendar.ts` on what a duplicate is).
 *
 * The 24th and 31st of December are NOT here. Both are ordinary working days in
 * Danish law that very many workplaces close for by agreement; a set that
 * quietly promoted a custom to a statute would be doing the thing this file's
 * header forbids.
 */
const DENMARK: DaySet = {
  country: "DK",
  labelKey: "addon.holiday-calendars.area.dk",
  noteKey: "addon.holiday-calendars.note.dk",
  derivation: {
    statedIn: "addon.holiday-calendars.from.dk",
    reviewedOn: "2026-08-28",
  },
  days: [
    { name: "Nytårsdag", rule: { on: "fixed", month: 1, day: 1 } },
    { name: "Skærtorsdag", rule: { on: "easter", offset: -3 } },
    { name: "Langfredag", rule: { on: "easter", offset: -2 } },
    { name: "Påskedag", rule: { on: "easter", offset: 0 } },
    { name: "Anden påskedag", rule: { on: "easter", offset: 1 } },
    { name: "Kristi himmelfartsdag", rule: { on: "easter", offset: 39 } },
    { name: "Pinsedag", rule: { on: "easter", offset: 49 } },
    { name: "Anden pinsedag", rule: { on: "easter", offset: 50 } },
    { name: "Juledag", rule: { on: "fixed", month: 12, day: 25 } },
    { name: "Anden juledag", rule: { on: "fixed", month: 12, day: 26 } },
  ],
};

/** Every set this add-on ships, in the order the picker lists them. */
export const DAY_SETS: readonly DaySet[] = [
  UNITED_STATES,
  GERMANY,
  FRANCE,
  FRANCE_ALSACE_MOSELLE,
  CZECHIA,
  DENMARK,
];

/**
 * The years a set can be asked for.
 *
 * TWO, AND THE SHORTNESS IS THE POINT. Every year in this list is a year
 * somebody has to have checked, and the honest number is the number that has
 * been checked rather than the number the expander could produce — it would
 * happily emit 2085. The picker offers exactly these and the read surface
 * refuses anything else, so "we have not reviewed that year yet" is a state the
 * product can be in and can say, instead of a plausible answer nobody stands
 * behind.
 */
export const YEARS: readonly number[] = [2026, 2027];

/**
 * WHO KEEPS THIS UP TO DATE, AND WHEN THE NEXT LOOK IS DUE.
 *
 * A day-set pack with no owner and no cadence is a pack that is correct on the
 * day it ships and unfalsifiable afterwards. Statutes change — Denmark deleted
 * a holiday in 2023 — and the failure is silent, so the only defence is
 * somebody looking on a schedule.
 *
 * A ROLE AND NOT A PERSON. People move on; the maintainers of this repository
 * are whoever holds it. What the panel prints is the role, the date of the last
 * review, the date the next one is due, and where to send a correction — which
 * is the fourth thing a reader needs and the one most often left out.
 *
 * THE CADENCE IS ANNUAL, IN LATE SUMMER, and that is chosen rather than
 * arbitrary: it is far enough ahead of the new year for a business to have next
 * year's calendar before it schedules against it, and late enough that most
 * states have published any change for that year.
 */
export const MAINTENANCE: {
  readonly ownerKey: StringKey;
  readonly lastReviewed: string;
  readonly nextReview: string;
} = {
  /** i18n key: who owns this data, as a role. */
  ownerKey: "addon.holiday-calendars.maint.owner",
  /** ISO date the whole pack was last reviewed. */
  lastReviewed: "2026-08-28",
  /** ISO date the next annual review is due. */
  nextReview: "2027-08-31",
};

// ── expansion ───────────────────────────────────────────────────────────────

/** One day of a set, resolved onto a calendar. */
export interface ResolvedDay {
  /** ISO `YYYY-MM-DD`. */
  readonly date: string;
  /** In the country's own language — see `NamedDay`. */
  readonly name: string;
}

function dateOf(rule: DayRule, year: number): string {
  switch (rule.on) {
    case "fixed":
      return isoOf({ y: year, m: rule.month, d: rule.day });
    case "easter": {
      const easter = easterSunday(year);
      return isoOf(civilFromDays(daysFromCivil(easter.y, easter.m, easter.d) + rule.offset));
    }
    case "weekday":
      return isoOf(nthWeekdayOf(year, rule.month, rule.weekday, rule.nth));
  }
}

/**
 * A set, resolved onto one year's calendar, sorted by date.
 *
 * PURE AND TOTAL — no clock, no locale, no `Date`. Sorted here rather than at
 * every call site because a set's declaration order follows the statute (which
 * groups by kind, not by date) and every consumer wants the year in order:
 * the preview lists it, the import stores it, and the read surface hands it to
 * a host that will merge it with days from elsewhere.
 *
 * The sort is by ISO string, which for `YYYY-MM-DD` is the same as by date —
 * that is the property the format was designed for, and it is why the read
 * surface trades in ISO strings rather than in epoch days.
 */
export function expandSet(set: DaySet, year: number): readonly ResolvedDay[] {
  return set.days
    .map((day) => ({ date: dateOf(day.rule, year), name: day.name }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The set a `{ country, region }` pair names, or `undefined`.
 *
 * `region` is compared including its absence: `{ country: "FR" }` is the
 * national set and `{ country: "FR", region: "alsace-moselle" }` is a different
 * one, and a lookup that treated an absent region as a wildcard would quietly
 * hand back whichever French set happened to be declared first.
 */
export function daySetFor(country: string, region?: string): DaySet | undefined {
  return DAY_SETS.find((set) => set.country === country && (set.region ?? "") === (region ?? ""));
}
