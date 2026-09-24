/**
 * The sample data an operator can add from Adminium — `seeds/clinic.sample.json`,
 * in the `adminium.sample/1` format the manifest's `sampleData` names.
 *
 * It is Rowan Health, the practice the design draws: the same four
 * clinicians, the same thirty-one patients, the same busy Tuesday. The
 * website's demo resolves this very bundle in the browser (`sampleRows.ts`),
 * so a screenshot of the demo and a real install with sample data show the
 * same practice.
 *
 * `buildSample()` is PURE and deterministic — the references come from a
 * seeded generator — so the committed bundle can be compared with a fresh
 * build byte for byte (sample-drift.test.ts), and `db/seed.sql` is generated
 * from it (sample-sql.ts). Nothing here is written by hand twice.
 *
 * ── TIME ───────────────────────────────────────────────────────────────────
 * Nothing is dated. The visits are written as the design dates them around
 * Tuesday 28 July 2026, and each date is turned into WORKING days from that
 * Tuesday (`{"@day": -3, "@workdays": true}`), so a bundle added on any day
 * lands on weekdays: "today" is always a working day (added on a Saturday, it
 * is the Monday after), yesterday is the working day before, history keeps
 * off weekends. Because a working-day offset can fall on any weekday, every
 * visit fits the hours of EVERY weekday — Tom finishes at 12:30 on a Friday,
 * so all of Tom's visits end by then.
 *
 * Today's visits carry `@byClock`: where each falls against the adding moment
 * decides its status. Well over — seen, with its stamps and its payment; at
 * about now — in the building (checked in, roomed, with the clinician, ready
 * to go); later — booked. A visit is judged by its last quarter hour, so a
 * 45-minute physio session is "in the building" for its whole length and
 * "seen" only once it is really over. A payment for today's visit exists only
 * when its visit resolved as over (`"@skip": true` otherwise).
 *
 * Adminium writes sample rows as history: no stamps are applied and no email
 * is produced, so every `checked_in_at`, `booked_by` and `taken_by` a status
 * implies is written here. `minutes` and `fee` are copied from the visit type
 * on the way in, and `paid`, `waived` and `balance` are settled from the
 * payments and write-offs once every row is in — so neither is written here.
 *
 * Every text a person reads goes out in all eight languages (`@t`, from
 * sample-names.ts); names of people and places are never translated. Every
 * address is on `example.com`, which Adminium never sends to, and the outbox
 * holds only what was already sent (and one reminder that failed): a queued
 * sample message would go out.
 */
import {
  ALLERGIES,
  CLINICIAN_TEXT,
  CLOSURE_TEXT,
  DESK_NOTES,
  DESK_TEXT,
  FAQS,
  PRACTICE_TEXT,
  REASONS,
  TYPE_NAMES,
  type Allergy,
  type Names,
  type Reason,
} from "./sample-names.ts";

export const SAMPLE_FORMAT = "adminium.sample/1";

type Value = string | number | boolean | null | Record<string, unknown> | unknown[];
export type SampleRow = Record<string, Value>;
export interface SampleTable {
  ref: string;
  rows: SampleRow[];
}
export interface SampleBundle {
  format: typeof SAMPLE_FORMAT;
  app: "clinic";
  assets: Record<string, { file: string; sha256: string }>;
  tables: SampleTable[];
}

/** The moment the design is drawn at, and the demo is pinned to: Tuesday 28 July 2026, 09:20 in London. */
export const SAMPLE_MOMENT = Date.UTC(2026, 6, 28, 8, 20);
export const SAMPLE_ZONE = "Europe/London";
/** The design's "today". Dates below are the design's; they are written as offsets from this day. */
const TODAY = "2026-07-28";

/** The person signed in at the desk in the design, and the one who covers her. */
export const DESK = "Ivy Ferreira";
const COVER = "Callum Reid";

// ── time helpers ────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const dayNumber = (date: string): number => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
const weekdayOf = (date: string): number => new Date(dayNumber(date) * DAY_MS).getUTCDay();
const isWeekend = (date: string): boolean => weekdayOf(date) === 0 || weekdayOf(date) === 6;
const addDays = (date: string, days: number): string => new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);

/** Working days from the design's today to `date`, a weekday: +1 is tomorrow, -1 the working day before. */
export function workdaysFromToday(date: string): number {
  if (isWeekend(date)) throw new Error(`${date} is a weekend: the sample only dates things on working days`);
  let count = 0;
  const step = dayNumber(date) >= dayNumber(TODAY) ? 1 : -1;
  for (let at = TODAY; at !== date; ) {
    at = addDays(at, step);
    if (!isWeekend(at)) count += step;
  }
  return count;
}

/**
 * The most calendar days `k` working days back can span, whatever day the
 * sample is added on: every five working days cross one weekend, and a start
 * on a weekend adds one more. Something written `n` calendar days ago is
 * safely before a working-day moment when `n` is more than this.
 */
export const calendarSpan = (k: number): number => k + 2 * Math.ceil(k / 5) + 2;

const minutesOf = (time: string): number => {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
};
const hhmm = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const shift = (time: string, minutes: number): string => hhmm(minutesOf(time) + minutes);

/** A wall time on the practice's clock, on a working day. */
const wall = (date: string, time: string) => ({ "@day": workdaysFromToday(date), "@time": time, "@workdays": true });
/** A working day, as a date. */
const workday = (date: string) => ({ "@day": workdaysFromToday(date), "@workdays": true });
const ago = (duration: string) => ({ "@ago": duration });
const ref = (label: string) => ({ "@ref": label });
const t = (names: Names) => ({ "@t": { ...names } });

/** mulberry32: small, seeded, the same sequence on every machine. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Crockford's base 32 — no I, L, O or U to misread — as the practice's references use. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// ── the practice ────────────────────────────────────────────────────────────

type ClinicianId = "amara" | "piotr" | "nadia" | "tom";
type TypeId = "routine" | "new" | "physio" | "nurse";

const CLINICIANS: { id: ClinicianId; name: string; short: string; color: string; email: string; does: TypeId[] }[] = [
  { id: "amara", name: "Dr Amara Osei", short: "Dr Osei", color: "#2f6ad9", email: "amara.osei@example.com", does: ["routine", "new"] },
  { id: "piotr", name: "Dr Piotr Nowak", short: "Dr Nowak", color: "#7c5cd0", email: "piotr.nowak@example.com", does: ["routine", "new"] },
  { id: "nadia", name: "Nadia Haddad", short: "Nadia", color: "#0f8a6a", email: "nadia.haddad@example.com", does: ["physio"] },
  { id: "tom", name: "Tom Villaseñor", short: "Tom", color: "#b25e09", email: "tom.villasenor@example.com", does: ["nurse"] },
];

export const VISIT_TYPES: { id: TypeId; minutes: number; fee: number; color: string; icon: string; newOnly: boolean }[] = [
  { id: "routine", minutes: 15, fee: 45, color: "#3b6fbd", icon: "stethoscope", newOnly: false },
  { id: "new", minutes: 30, fee: 70, color: "#6d5bd0", icon: "user-plus", newOnly: true },
  { id: "physio", minutes: 45, fee: 60, color: "#0f8a6a", icon: "person-standing", newOnly: false },
  { id: "nurse", minutes: 15, fee: 28, color: "#b25e09", icon: "syringe", newOnly: false },
];
const typeOf = (id: TypeId) => VISIT_TYPES.find((type) => type.id === id)!;

/** The practice's week: Monday to Friday, the desk closed over lunch. */
export const PRACTICE_HOURS = { opens: "08:30", closes: "17:30", breakStart: "12:30", breakEnd: "13:15" };
/** Tom's own week: Monday to Thursday until three, Friday mornings only. */
export const TOM_HOURS: Record<"mon" | "tue" | "wed" | "thu" | "fri", { opens: string; closes: string; breakStart: string | null; breakEnd: string | null }> = {
  mon: { opens: "08:30", closes: "15:00", breakStart: "12:30", breakEnd: "13:15" },
  tue: { opens: "08:30", closes: "15:00", breakStart: "12:30", breakEnd: "13:15" },
  wed: { opens: "08:30", closes: "15:00", breakStart: "12:30", breakEnd: "13:15" },
  thu: { opens: "08:30", closes: "15:00", breakStart: "12:30", breakEnd: "13:15" },
  fri: { opens: "08:30", closes: "12:30", breakStart: null, breakEnd: null },
};

// ── the patients ────────────────────────────────────────────────────────────

interface PatientSpec {
  id: string;
  name: string;
  born: string;
  mobile: string;
  /** False: the design has no email for them (the desk rings instead). */
  email?: false;
  allergy?: Allergy;
  language: string;
  lead: 12 | 24 | 48;
  remind: boolean;
  /** How long they have been on the practice's books, in days. */
  since: number;
  address?: string;
  contact?: string;
  insurer?: [name: string, policy: string];
}

const PATIENTS: PatientSpec[] = [
  { id: "harriet", name: "Harriet Blythe", born: "1948-03-11", mobile: "07700 900118", email: false, language: "en-US", lead: 24, remind: false, since: 1460, address: "8 Linden Row, Ashgrove BS7 4RF", contact: "Ruth Blythe · 07700 900119" },
  { id: "ewan", name: "Ewan Pryce", born: "1991-06-02", mobile: "07700 900142", allergy: "latex", language: "en-US", lead: 24, remind: true, since: 420 },
  { id: "delphine", name: "Delphine Auclair", born: "1979-11-23", mobile: "07700 900133", language: "fr-FR", lead: 48, remind: true, since: 610 },
  { id: "ines", name: "Inés Varela", born: "1996-01-30", mobile: "07700 900107", language: "en-US", lead: 24, remind: true, since: 4 },
  { id: "solveig", name: "Solveig Rasmussen", born: "1962-09-14", mobile: "07700 900155", language: "da-DK", lead: 24, remind: true, since: 730, address: "21 Orchard Way, Ashgrove BS7 4UB" },
  { id: "kofi", name: "Kofi Mensah", born: "1988-04-05", mobile: "07700 900121", language: "en-US", lead: 12, remind: true, since: 6 },
  { id: "nour", name: "Nour Khalil", born: "2004-12-19", mobile: "07700 900190", language: "ar-EG", lead: 24, remind: true, since: 330 },
  { id: "beatriz", name: "Beatriz Salgado", born: "1955-07-08", mobile: "07700 900176", language: "en-US", lead: 48, remind: true, since: 880, address: "5 Quarry Lane, Ashgrove BS7 4TT" },
  { id: "malachy", name: "Malachy Doyle", born: "1972-02-27", mobile: "07700 900168", language: "en-US", lead: 24, remind: false, since: 540 },
  { id: "zofia", name: "Zofia Lange", born: "1999-08-16", mobile: "07700 900112", language: "cs-CZ", lead: 24, remind: true, since: 3 },
  { id: "priya", name: "Priya Raman", born: "1983-05-21", mobile: "07700 900149", language: "en-US", lead: 48, remind: true, since: 390, insurer: ["Harbour Mutual", "HM-40371102"] },
  { id: "cormac", name: "Cormac Ellery", born: "1968-10-02", mobile: "07700 900164", language: "en-US", lead: 24, remind: true, since: 260, insurer: ["Harbour Mutual", "HM-40218871"] },
  { id: "saoirse", name: "Saoirse Whelan", born: "2018-05-30", mobile: "07700 900103", allergy: "peanuts", language: "en-US", lead: 24, remind: true, since: 1500, contact: "Siobhan Whelan · 07700 900104" },
  { id: "tobias", name: "Tobias Lindqvist", born: "1942-01-17", mobile: "07700 900187", email: false, allergy: "dressings", language: "en-US", lead: 24, remind: false, since: 2100, address: "2 Mill Yard, Ashgrove BS7 4NA", contact: "Ingrid Lindqvist · 07700 900188" },
  { id: "amaia", name: "Amaia Etxeberria", born: "1990-03-08", mobile: "07700 900129", language: "en-US", lead: 12, remind: true, since: 450 },
  { id: "rufus", name: "Rufus Adeyemi", born: "2020-02-11", mobile: "07700 900158", language: "en-US", lead: 24, remind: true, since: 1600, contact: "Grace Adeyemi · 07700 900159" },
  { id: "remi", name: "Remi Adeyemi", born: "2020-02-11", mobile: "07700 900158", language: "en-US", lead: 24, remind: true, since: 1600, contact: "Grace Adeyemi · 07700 900159" },
  { id: "martha", name: "Martha Okonjo", born: "1951-12-04", mobile: "07700 900194", language: "en-US", lead: 48, remind: true, since: 1900, address: "14 Rowan Walk, Ashgrove BS7 4QN" },
  { id: "dev", name: "Dev Chatterjee", born: "1977-07-19", mobile: "07700 900137", language: "en-US", lead: 12, remind: true, since: 300 },
  { id: "leila", name: "Leila Farsi", born: "2001-09-27", mobile: "07700 900171", allergy: "shellfish", language: "en-US", lead: 24, remind: true, since: 200 },
  { id: "gustav", name: "Gustav Holm", born: "1959-04-23", mobile: "07700 900182", language: "da-DK", lead: 48, remind: true, since: 700, insurer: ["Northgate Health", "NG-7721-0934"] },
  { id: "wren", name: "Wren Calloway", born: "1994-11-06", mobile: "07700 900115", language: "en-US", lead: 24, remind: true, since: 480, address: "19 Elm Parade, Ashgrove BS7 4PL" },
  { id: "hamid", name: "Hamid Sarraf", born: "1966-06-15", mobile: "07700 900161", language: "ar-EG", lead: 24, remind: true, since: 250 },
  { id: "juno", name: "Juno Ferreira", born: "2011-08-09", mobile: "07700 900109", allergy: "stings", language: "en-US", lead: 24, remind: true, since: 1200, contact: "Marta Ferreira · 07700 900110" },
  { id: "eleni", name: "Eleni Vasilakis", born: "1945-10-21", mobile: "07700 900198", email: false, language: "en-US", lead: 24, remind: false, since: 2000, address: "6 Church Steps, Ashgrove BS7 4QA" },
  { id: "bram", name: "Bram de Vries", born: "1985-02-14", mobile: "07700 900144", language: "en-US", lead: 24, remind: true, since: 150 },
  { id: "odette", name: "Odette Baptiste", born: "1973-01-09", mobile: "07700 900153", language: "fr-FR", lead: 24, remind: true, since: 12 },
  { id: "yusuf", name: "Yusuf Demir", born: "2009-03-25", mobile: "07700 900126", language: "de-DE", lead: 24, remind: true, since: 900, contact: "Elif Demir · 07700 900127" },
  { id: "clara", name: "Clara Nwosu", born: "1998-06-11", mobile: "07700 900131", language: "en-US", lead: 24, remind: true, since: 350 },
  { id: "hector", name: "Héctor Salazar", born: "1969-09-03", mobile: "07700 900147", language: "en-US", lead: 24, remind: false, since: 220 },
  { id: "maeve", name: "Maeve Corrigan", born: "2015-04-18", mobile: "07700 900105", allergy: "peanuts", language: "en-US", lead: 24, remind: true, since: 1300, contact: "Niamh Corrigan · 07700 900106" },
];
const patientOf = (id: string) => PATIENTS.find((p) => p.id === id)!;
/** The design mails a patient at their first name on example.com; three have no email at all. */
const emailOf = (p: PatientSpec): string | null => (p.email === false ? null : `${p.id}@example.com`);

// ── the visits ──────────────────────────────────────────────────────────────

type Channel = "online" | "phone" | "desk" | "walk_in" | "waiting_list" | "recall";
type Method = "card" | "cash" | "transfer";
interface Pay {
  amount: number;
  method: Method;
  /** A voided payment, and why. */
  voided?: Names;
}
/** Where a visit of today stands at about the adding moment, and how long ago they arrived and were roomed. */
interface Around {
  status: "booked" | "checked_in" | "roomed" | "with_clinician" | "ready";
  arrived?: number;
  roomed?: number;
}
type Outcome =
  | { kind: "booked" }
  | { kind: "seen" }
  | { kind: "no_show" }
  | { kind: "cancelled"; by: "patient" | "desk"; late: boolean; at: Value }
  /** Today's: the status follows the clock. `before` is what the visit became once over. */
  | { kind: "clock"; around: Around; before: "seen" | "no_show"; judgedAt?: string };

interface VisitSpec {
  key: string;
  patient: string;
  clinician: ClinicianId;
  type: TypeId;
  /** The design's date for it (at Tuesday 28 July 2026) and its start on the practice's clock. */
  date: string;
  time: string;
  reason: Reason;
  channel: Channel;
  outcome: Outcome;
  pays?: Pay[];
  deskNote?: keyof typeof DESK_NOTES;
  recallWeeks?: number;
}

const seen: Outcome = { kind: "seen" };
const booked: Outcome = { kind: "booked" };
const noShow: Outcome = { kind: "no_show" };
const clock = (around: Around, before: "seen" | "no_show" = "seen", judgedAt?: string): Outcome => ({
  kind: "clock",
  around,
  before,
  ...(judgedAt === undefined ? {} : { judgedAt }),
});
const card = (amount: number): Pay => ({ amount, method: "card" });
const cash = (amount: number): Pay => ({ amount, method: "cash" });
const transfer = (amount: number): Pay => ({ amount, method: "transfer" });

const V = (
  key: string,
  patient: string,
  clinician: ClinicianId,
  type: TypeId,
  date: string,
  time: string,
  reason: Reason,
  channel: Channel,
  outcome: Outcome,
  more: Partial<Pick<VisitSpec, "pays" | "deskNote" | "recallWeeks">> = {},
): VisitSpec => ({ key, patient, clinician, type, date, time, reason, channel, outcome, ...more });

/*
 * Today: the design's nineteen, as it draws them at 09:20 — four seen, Tobias
 * ready to go, Cormac roomed, Beatriz with Dr Nowak, Inés checked in, and
 * Delphine's 09:00 not arrived — and everything after booked. Tobias is judged
 * by his end rather than his last quarter hour, so he is still at the desk at
 * 09:20, as the design shows him.
 */
const TODAY_VISITS: VisitSpec[] = [
  V("t0830-harriet", "harriet", "amara", "routine", TODAY, "08:30", "annual", "phone", clock({ status: "checked_in" }), { pays: [card(45)] }),
  V("t0845-ewan", "ewan", "piotr", "routine", TODAY, "08:45", "sickNote", "online", clock({ status: "checked_in" }), { pays: [card(45)] }),
  V("t0830-martha", "martha", "tom", "nurse", TODAY, "08:30", "dressing", "recall", clock({ status: "checked_in" }), { pays: [cash(28)] }),
  V("t0845-tobias", "tobias", "tom", "nurse", TODAY, "08:45", "flu", "phone", clock({ status: "ready", arrived: 42, roomed: 34 }, "seen", "09:00"), {
    pays: [card(28)],
    deskNote: "wheelchair",
  }),
  V("t0900-cormac", "cormac", "nadia", "physio", TODAY, "09:00", "knee", "phone", clock({ status: "roomed", arrived: 34, roomed: 18 }), { pays: [card(60)] }),
  V("t0900-delphine", "delphine", "amara", "routine", TODAY, "09:00", "followUp", "online", clock({ status: "booked" }, "no_show")),
  V("t0915-beatriz", "beatriz", "piotr", "routine", TODAY, "09:15", "annual", "phone", clock({ status: "with_clinician", arrived: 15, roomed: 6 }), { pays: [cash(25)] }),
  V("t0930-ines", "ines", "amara", "new", TODAY, "09:30", "register", "online", clock({ status: "checked_in", arrived: 8 }), { pays: [card(70)] }),
  V("t0945-malachy", "malachy", "piotr", "routine", TODAY, "09:45", "followUp", "desk", clock({ status: "booked" }), { pays: [card(45)] }),
  V("t1000-saoirse", "saoirse", "tom", "nurse", TODAY, "10:00", "stitches", "phone", clock({ status: "checked_in" }), { pays: [card(28)], deskNote: "parent" }),
  V("t1000-dev", "dev", "nadia", "physio", TODAY, "10:00", "shoulderRehab", "recall", clock({ status: "roomed" }), { pays: [transfer(60)] }),
  V("t1015-solveig", "solveig", "amara", "routine", TODAY, "10:15", "review", "recall", clock({ status: "checked_in" }), { pays: [card(45)] }),
  V("t1030-zofia", "zofia", "piotr", "new", TODAY, "10:30", "register", "online", clock({ status: "checked_in" }), { pays: [card(70)] }),
  V("t1100-kofi", "kofi", "amara", "new", TODAY, "11:00", "register", "online", clock({ status: "with_clinician" }), { pays: [card(70)], deskNote: "early" }),
  V("t1115-gustav", "gustav", "nadia", "physio", TODAY, "11:15", "back", "phone", clock({ status: "roomed" }), { pays: [card(60)] }),
  V("t1130-juno", "juno", "tom", "nurse", TODAY, "11:30", "travel", "waiting_list", clock({ status: "checked_in" }), { pays: [cash(28)] }),
  // Paid by the insurer, later: the afternoon's one visit still owing.
  V("t1330-priya", "priya", "piotr", "routine", TODAY, "13:30", "review", "online", clock({ status: "with_clinician" })),
  V("t1400-nour", "nour", "amara", "routine", TODAY, "14:00", "form", "phone", clock({ status: "checked_in" }), { pays: [card(45)] }),
  V("t1415-amaia", "amaia", "nadia", "physio", TODAY, "14:15", "ankleRehab", "online", clock({ status: "roomed" }), { pays: [card(60)] }),
];

/** Cancellations this week: one late (inside the 24 hours), two in good time. */
const CANCELLED: VisitSpec[] = [
  V("c-clara", "clara", "nadia", "physio", "2026-07-27", "15:30", "shoulderRehab", "online", {
    kind: "cancelled",
    by: "patient",
    late: true,
    at: wall("2026-07-27", "08:10"),
  }),
  V("c-wren", "wren", "amara", "routine", TODAY, "16:00", "annual", "phone", { kind: "cancelled", by: "patient", late: false, at: wall("2026-07-23", "12:40") }),
  V("c-hector", "hector", "nadia", "physio", TODAY, "15:15", "back", "phone", { kind: "cancelled", by: "patient", late: true, at: ago("PT1H45M") }),
  V("c-bram", "bram", "amara", "routine", "2026-07-30", "10:30", "followUp", "online", { kind: "cancelled", by: "desk", late: false, at: ago("PT40M") }),
];

/** Yesterday: the design's three, and the afternoon it leaves out. */
const YESTERDAY: VisitSpec[] = [
  V("y-amaia", "amaia", "amara", "routine", "2026-07-27", "09:00", "followUp", "online", seen, { pays: [card(45)] }),
  V("y-yusuf", "yusuf", "piotr", "routine", "2026-07-27", "10:00", "sickNote", "online", noShow),
  V("y-maeve", "maeve", "tom", "nurse", "2026-07-27", "11:00", "flu", "phone", noShow),
  V("y-eleni", "eleni", "amara", "routine", "2026-07-27", "11:30", "bp", "walk_in", seen, { pays: [cash(45)] }),
  V("y-rufus", "rufus", "piotr", "routine", "2026-07-27", "14:00", "child", "phone", seen, { pays: [card(45)] }),
  V("y-remi", "remi", "piotr", "routine", "2026-07-27", "14:15", "child", "phone", seen, { pays: [card(45)] }),
];

/** The next four working days. Wednesday is Nadia's full day. */
const AHEAD: VisitSpec[] = [
  V("a1-leila", "leila", "tom", "nurse", "2026-07-29", "09:15", "travel", "online", booked),
  V("a1-clara", "clara", "amara", "routine", "2026-07-29", "09:30", "annual", "recall", booked),
  // The design books Hamid a new-patient visit here; he has been on the books since winter.
  V("a1-hamid", "hamid", "piotr", "routine", "2026-07-29", "10:30", "review", "phone", booked),
  V("a1-wren", "wren", "nadia", "physio", "2026-07-29", "08:30", "shoulderRehab", "online", booked),
  V("a1-hamid-physio", "hamid", "nadia", "physio", "2026-07-29", "09:15", "back", "phone", booked),
  V("a1-bram", "bram", "nadia", "physio", "2026-07-29", "10:00", "knee", "online", booked),
  V("a1-odette", "odette", "nadia", "physio", "2026-07-29", "10:45", "ankleRehab", "online", booked),
  V("a1-hector", "hector", "nadia", "physio", "2026-07-29", "11:30", "back", "desk", booked),
  V("a1-clara-physio", "clara", "nadia", "physio", "2026-07-29", "13:15", "shoulderRehab", "online", booked),
  V("a1-eleni", "eleni", "nadia", "physio", "2026-07-29", "14:00", "knee", "phone", booked),
  V("a1-yusuf", "yusuf", "nadia", "physio", "2026-07-29", "14:45", "ankleRehab", "online", booked),
  V("a1-maeve", "maeve", "nadia", "physio", "2026-07-29", "15:30", "gait", "phone", booked, { deskNote: "parent" }),
  V("a1-dev", "dev", "nadia", "physio", "2026-07-29", "16:15", "shoulderRehab", "online", booked),
  V("a2-wren", "wren", "amara", "routine", "2026-07-30", "09:00", "annual", "phone", booked),
  V("a2-leila", "leila", "nadia", "physio", "2026-07-30", "10:00", "kneeRehab", "online", booked),
  V("a2-gustav", "gustav", "tom", "nurse", "2026-07-30", "10:15", "dressing", "desk", booked),
  V("a3-odette", "odette", "piotr", "routine", "2026-07-31", "09:15", "review", "online", booked),
  V("a3-hector", "hector", "amara", "routine", "2026-07-31", "10:00", "followUp", "recall", booked),
  V("a4-harriet", "harriet", "piotr", "routine", "2026-08-03", "09:30", "bp", "phone", booked),
  V("a4-kofi", "kofi", "tom", "nurse", "2026-08-03", "10:00", "travel", "online", booked),
  V("a4-priya", "priya", "amara", "routine", "2026-08-03", "11:15", "followUp", "online", booked),
  V("a4-beatriz", "beatriz", "nadia", "physio", "2026-08-03", "14:00", "shoulder", "phone", booked),
];

/*
 * Six months back: the design's twenty, with their payments as it draws them
 * — Héctor's six weeks unpaid, Cormac and Odette part-paid, Bram and Leila
 * owing — plus the no-shows and cancellations a real half-year has.
 */
const HISTORY: VisitSpec[] = [
  V("h-tobias", "tobias", "amara", "routine", "2026-01-13", "10:00", "annual", "phone", seen, { pays: [card(45)], recallWeeks: 24 }),
  V("h-clara", "clara", "piotr", "routine", "2026-01-27", "10:30", "review", "online", seen, { pays: [card(45)], recallWeeks: 28 }),
  V("h-hamid", "hamid", "amara", "routine", "2026-02-03", "09:15", "annual", "phone", seen, { pays: [cash(45)], recallWeeks: 25 }),
  V("h-eleni", "eleni", "piotr", "routine", "2026-02-24", "14:00", "followUp", "phone", seen, { pays: [cash(45)], recallWeeks: 20 }),
  V("h-juno-cancel", "juno", "tom", "nurse", "2026-04-14", "09:30", "travel", "phone", {
    kind: "cancelled",
    by: "patient",
    late: true,
    at: wall("2026-04-14", "08:05"),
  }),
  V("h-harriet", "harriet", "amara", "routine", "2026-04-28", "09:30", "annual", "phone", seen, { pays: [card(45)], recallWeeks: 52 }),
  V("h-martha", "martha", "tom", "nurse", "2026-05-05", "11:00", "dressing", "desk", seen, { pays: [cash(28)], recallWeeks: 12 }),
  V("h-malachy", "malachy", "piotr", "routine", "2026-05-19", "10:00", "followUp", "phone", noShow),
  V("h-priya-cancel", "priya", "amara", "routine", "2026-06-02", "11:00", "review", "online", {
    kind: "cancelled",
    by: "desk",
    late: false,
    at: wall("2026-05-27", "15:20"),
  }),
  V("h-dev-noshow", "dev", "nadia", "physio", "2026-06-10", "14:00", "shoulderRehab", "online", noShow),
  V("h-hector", "hector", "amara", "routine", "2026-06-18", "15:15", "annual", "phone", seen, { recallWeeks: 6 }),
  V("h-leila", "leila", "piotr", "routine", "2026-06-30", "10:00", "sickNote", "online", seen, { pays: [card(45)] }),
  V("h-cormac", "cormac", "nadia", "physio", "2026-07-06", "10:45", "knee", "phone", seen, { pays: [card(60)] }),
  V("h-dev", "dev", "nadia", "physio", "2026-07-08", "14:00", "shoulderRehab", "online", seen, { pays: [card(60)], recallWeeks: 2 }),
  V("h-juno", "juno", "tom", "nurse", "2026-07-09", "09:15", "travel", "phone", seen, { pays: [card(28)] }),
  V("h-gustav", "gustav", "nadia", "physio", "2026-07-13", "15:30", "back", "phone", seen, { pays: [card(60)], recallWeeks: 2 }),
  V("h-martha-2", "martha", "tom", "nurse", "2026-07-14", "10:00", "dressing", "desk", seen),
  V("h-cormac-2", "cormac", "nadia", "physio", "2026-07-15", "11:30", "knee", "phone", seen, { pays: [card(38)], recallWeeks: 4 }),
  V("h-bram", "bram", "piotr", "routine", "2026-07-16", "14:30", "followUp", "online", seen, { recallWeeks: 1 }),
  V("h-saoirse", "saoirse", "tom", "nurse", "2026-07-17", "09:45", "wound", "phone", seen, { pays: [card(28)] }),
  V("h-leila-2", "leila", "nadia", "physio", "2026-07-20", "16:15", "firstPhysio", "online", seen),
  V("h-solveig", "solveig", "amara", "routine", "2026-07-21", "15:00", "review", "phone", seen, {
    pays: [{ amount: 45, method: "card", voided: DESK_TEXT.voidTwice }, card(45)],
  }),
  V("h-odette", "odette", "amara", "new", "2026-07-22", "09:15", "register", "online", seen, { pays: [card(35)], recallWeeks: 6 }),
  V("h-wren", "wren", "tom", "nurse", "2026-07-23", "11:30", "flu", "phone", seen, { pays: [card(28)] }),
];

/** Everything above, in the order it is written: history first, then the days around today. */
export const VISITS: VisitSpec[] = [...HISTORY, ...YESTERDAY, ...TODAY_VISITS, ...CANCELLED, ...AHEAD];

/** The first visit someone booked online without being on file — the desk has still to check it. */
const FIRST_VISIT = {
  name: "Léa Moreau",
  born: "2002-03-14",
  mobile: "07700 900203",
  language: "fr-FR",
  clinician: "amara" as ClinicianId,
  // The design puts it at 09:45, across Dr Osei's 10:00 with Héctor; 09:15 is free.
  date: "2026-07-31",
  time: "09:15",
};

// ── the build ───────────────────────────────────────────────────────────────

const visitLabel = (key: string) => `visit:${key}`;
const endOf = (v: { type: TypeId; time: string }) => shift(v.time, typeOf(v.type).minutes);
/** The moment a visit of today is judged by: the start of its last quarter hour (or its own override). */
const judgedAt = (v: VisitSpec) => (v.outcome.kind === "clock" && v.outcome.judgedAt !== undefined ? v.outcome.judgedAt : shift(endOf(v), -15));

export function buildSample(): SampleBundle {
  const rand = random(56);
  const taken = new Set<string>();
  /** A reference the practice's code rule accepts, in a series of its own (`S…`) that marks it as sample. */
  const code = (prefix: string): string => {
    for (;;) {
      let out = `${prefix}S`;
      for (let i = 0; i < 3; i += 1) out += CROCKFORD[Math.floor(rand() * CROCKFORD.length)];
      if (!taken.has(out)) {
        taken.add(out);
        return out;
      }
    }
  };
  const bookedBy = (date: string, channel: Channel) => (channel === "online" ? null : date < "2026-06-01" ? COVER : DESK);

  // ── the practice ──
  const settings: SampleRow[] = [
    {
      practice_name: "Rowan Health",
      mark: "RH",
      address: "12 Rowan Walk, Ashgrove BS7 4QN",
      phone: "0117 496 0142",
      email: "rowan.desk@example.com",
      intro: t(PRACTICE_TEXT.intro),
      directions: t(PRACTICE_TEXT.directions),
      pay_note: t(PRACTICE_TEXT.payNote),
      insurer_note: t(PRACTICE_TEXT.insurerNote),
      currency: "GBP",
      language: "en-US",
      slot_minutes: 15,
      booking_days: 10,
      min_notice_minutes: 60,
      new_patients_online: true,
      online_booking_on: true,
      no_show_minutes: 15,
      cancel_hours: 24,
      reminders_on: true,
      default_lead_hours: 24,
      kiosk_on: true,
    },
  ];
  const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const openingHours: SampleRow[] = WEEK.map((weekday) => {
    const open = weekday !== "sat" && weekday !== "sun";
    return {
      weekday,
      open,
      opens: PRACTICE_HOURS.opens,
      closes: PRACTICE_HOURS.closes,
      break_start: open ? PRACTICE_HOURS.breakStart : null,
      break_end: open ? PRACTICE_HOURS.breakEnd : null,
    };
  });
  const clinicians: SampleRow[] = CLINICIANS.map((c, position) => ({
    "@label": `clinician:${c.id}`,
    name: c.name,
    short_name: c.short,
    role_label: t(CLINICIAN_TEXT[c.id].role),
    color: c.color,
    bio: t(CLINICIAN_TEXT[c.id].bio),
    bookable_online: true,
    active: true,
    position,
    staff_email: c.email,
  }));
  const visitTypes: SampleRow[] = VISIT_TYPES.map((type, position) => ({
    "@label": `type:${type.id}`,
    name: t(TYPE_NAMES[type.id].name),
    short_name: t(TYPE_NAMES[type.id].short),
    minutes: type.minutes,
    fee: type.fee,
    color: type.color,
    icon: type.icon,
    bookable_online: true,
    new_patients_only: type.newOnly,
    active: true,
    position,
  }));
  const does: SampleRow[] = CLINICIANS.flatMap((c) =>
    c.does.map((type) => ({ clinician_id: ref(`clinician:${c.id}`), visit_type_id: ref(`type:${type}`) })),
  );
  const clinicianHours: SampleRow[] = Object.entries(TOM_HOURS).map(([weekday, hours]) => ({
    clinician_id: ref("clinician:tom"),
    weekday,
    opens: hours.opens,
    closes: hours.closes,
    break_start: hours.breakStart,
    break_end: hours.breakEnd,
  }));
  /*
   * The design's three closures, a few weeks out and clear of every sample
   * visit. The design's whole-practice day is the August bank holiday; a
   * sample added in November would name a holiday on a Wednesday, so it is a
   * training day instead.
   */
  const closures: SampleRow[] = [
    { "@label": "closure:nadia", clinician_id: ref("clinician:nadia"), from: "2026-08-07", to: "2026-08-07", text: CLOSURE_TEXT.nadia, made: "PT20H" },
    { "@label": "closure:amara", clinician_id: ref("clinician:amara"), from: "2026-08-10", to: "2026-08-14", text: CLOSURE_TEXT.amara, made: "P12D" },
    { "@label": "closure:training", clinician_id: null, from: "2026-08-31", to: "2026-08-31", text: CLOSURE_TEXT.training, made: "P21D" },
  ].map(({ from, to, text, made, ...rest }) => ({
    ...rest,
    from_date: workday(from),
    to_date: workday(to),
    label: t(text.label),
    note: t(text.note),
    active: true,
    created_at: ago(made),
  }));
  const faqs: SampleRow[] = FAQS.map((faq, position) => ({ question: t(faq.question), answer: t(faq.answer), position, active: true }));

  // ── the patients ──
  const firstVisit = new Map<string, VisitSpec>();
  for (const v of VISITS) {
    const earlier = firstVisit.get(v.patient);
    if (earlier === undefined || `${v.date} ${v.time}` < `${earlier.date} ${earlier.time}`) firstVisit.set(v.patient, v);
  }
  const patients: SampleRow[] = PATIENTS.map((p) => ({
    "@label": `patient:${p.id}`,
    name: p.name,
    born_on: p.born,
    mobile: p.mobile,
    email: emailOf(p),
    address: p.address ?? null,
    emergency_contact: p.contact ?? null,
    allergies_note: p.allergy === undefined ? null : t(ALLERGIES[p.allergy]),
    insurer: p.insurer?.[0] ?? null,
    policy_ref: p.insurer?.[1] ?? null,
    language: p.language,
    remind_email: p.remind,
    remind_lead_hours: p.lead,
    status: "active",
    created_at: ago(`P${String(p.since)}D`),
  }));

  // ── registrations waiting for the desk ──
  const registrations: SampleRow[] = [
    {
      "@label": "registration:ruth",
      ref: code("RG-"),
      name: "Ruth Okafor",
      born_on: "1958-05-30",
      mobile: "07700 900214",
      email: "ruth.okafor@example.com",
      address: "3 Mill Yard, Ashgrove BS7 4NA",
      emergency_contact: "Daniel Okafor · 07700 900215",
      language: "en-US",
      status: "rang",
      handled_by: DESK,
      handled_at: wall("2026-07-27", "16:05"),
      created_at: ago("P4DT2H"),
    },
    {
      "@label": "registration:anouk",
      ref: code("RG-"),
      name: "Anouk Brenner",
      born_on: "1990-04-21",
      // The design gives her Yusuf's number; a registration is checked against the mobiles on file.
      mobile: "07700 900216",
      email: "anouk.b@example.com",
      address: "4 Linden Row, Ashgrove BS7 4RF",
      emergency_contact: "Pieter Brenner · 07700 900211",
      language: "de-DE",
      status: "new",
      created_at: ago("P2DT3H"),
    },
    {
      "@label": "registration:tariq",
      ref: code("RG-"),
      name: "Tariq Mahmood",
      born_on: "1985-08-30",
      mobile: "07700 900199",
      email: "tariq.m@example.com",
      address: "7 Quarry Lane, Ashgrove BS7 4TT",
      emergency_contact: "Sana Mahmood · 07700 900212",
      language: "en-US",
      status: "new",
      created_at: ago("PT1H10M"),
    },
  ];

  // ── the visits ──
  const appointments: SampleRow[] = [];
  const payments: SampleRow[] = [];
  /*
   * When the visit was booked: a new patient's first visit the day they
   * joined; a walk-in minutes before it; the rest a few working days before,
   * always before today and always after the patient joined, whatever day
   * the sample is added on (`calendarSpan`).
   */
  const createdAt = (v: VisitSpec): Value => {
    const p = patientOf(v.patient);
    if (firstVisit.get(v.patient) === v && p.since <= 30) return ago(`P${String(p.since)}D`);
    if (v.channel === "walk_in") return wall(v.date, shift(v.time, -20));
    let earliest = Math.max(1, 1 - workdaysFromToday(v.date));
    // A cancelled visit was booked before it was cancelled.
    const cancelled = v.outcome.kind === "cancelled" ? (v.outcome.at as Record<string, unknown>)["@day"] : undefined;
    if (typeof cancelled === "number") earliest = Math.max(earliest, 1 - cancelled);
    let back = earliest + Math.floor(rand() * 8);
    while (back > earliest && calendarSpan(back) >= p.since) back -= 1;
    if (calendarSpan(back) >= p.since) throw new Error(`${v.key} would be booked before ${p.name} joined the practice`);
    const onDay = addWorkdays(TODAY, -back);
    const time = v.channel === "online" ? hhmm(7 * 60 + Math.floor(rand() * 60) * 15) : hhmm(8 * 60 + 40 + Math.floor(rand() * 32) * 15);
    return wall(onDay, time);
  };
  const stampsOfSeen = (v: VisitSpec) => ({
    checked_in_at: wall(v.date, hhmm(Math.max(minutesOf(PRACTICE_HOURS.opens), minutesOf(v.time) - 6))),
    roomed_at: wall(v.date, shift(v.time, 2)),
    seen_at: wall(v.date, endOf(v)),
  });
  const payRow = (v: VisitSpec, pay: Pay, i: number): SampleRow => ({
    appointment_id: ref(visitLabel(v.key)),
    amount: pay.amount,
    method: pay.method,
    taken_by: bookedBy(v.date, "desk"),
    paid_at: wall(v.date, shift(endOf(v), 2 + i * 3)),
    voided: pay.voided !== undefined,
    ...(pay.voided === undefined ? {} : { void_reason: t(pay.voided), voided_by: DESK }),
  });
  for (const v of VISITS) {
    const p = patientOf(v.patient);
    const row: SampleRow = {
      "@label": visitLabel(v.key),
      ref: code("RH-"),
      patient_id: ref(`patient:${p.id}`),
      clinician_id: ref(`clinician:${v.clinician}`),
      visit_type_id: ref(`type:${v.type}`),
      starts_at: wall(v.date, v.time),
      reason: t(REASONS[v.reason]),
      desk_note: v.deskNote === undefined ? null : t(DESK_NOTES[v.deskNote]),
      channel: v.channel,
      booked_by: bookedBy(v.date, v.channel),
      recall_weeks: v.recallWeeks ?? null,
      created_at: createdAt(v),
    };
    const o = v.outcome;
    if (o.kind === "booked") row["status"] = "booked";
    else if (o.kind === "no_show") row["status"] = "no_show";
    else if (o.kind === "seen") Object.assign(row, { status: "seen", ...stampsOfSeen(v) });
    else if (o.kind === "cancelled") Object.assign(row, { status: "cancelled", cancelled_at: o.at, cancelled_by: o.by, late_cancel: o.late });
    else {
      const minutesAgo = (m: number | undefined, fallback: number) => ago(`PT${String(m ?? fallback)}M`);
      const around: SampleRow = { status: o.around.status };
      // What each status implies was written as it happened: arrived, then into a room.
      const fallbackArrived = { booked: 0, checked_in: 6, roomed: 14, with_clinician: 18, ready: 30 }[o.around.status];
      if (o.around.status !== "booked") around["checked_in_at"] = minutesAgo(o.around.arrived, fallbackArrived);
      if (o.around.status === "roomed" || o.around.status === "with_clinician" || o.around.status === "ready") {
        around["roomed_at"] = minutesAgo(o.around.roomed, fallbackArrived - 9);
      }
      const before: SampleRow = o.before === "seen" ? { status: "seen", ...stampsOfSeen(v) } : { status: "no_show" };
      row["@byClock"] = { at: wall(v.date, judgedAt(v)), before, around, after: { status: "booked" } };
    }
    appointments.push(row);

    (v.pays ?? []).forEach((pay, i) => {
      const payment = payRow(v, pay, i);
      // Today's money exists only once its visit is over.
      if (o.kind === "clock") payment["@byClock"] = { at: wall(v.date, judgedAt(v)), before: {}, around: { "@skip": true }, after: { "@skip": true } };
      payments.push(payment);
    });
  }
  appointments.push({
    "@label": "visit:first-lea",
    ref: code("RH-"),
    patient_id: null,
    new_name: FIRST_VISIT.name,
    new_born_on: FIRST_VISIT.born,
    new_mobile: FIRST_VISIT.mobile,
    new_email: null,
    clinician_id: ref(`clinician:${FIRST_VISIT.clinician}`),
    visit_type_id: ref("type:new"),
    starts_at: wall(FIRST_VISIT.date, FIRST_VISIT.time),
    reason: t(REASONS.register),
    status: "booked",
    channel: "online",
    language: FIRST_VISIT.language,
    booked_by: null,
    check_status: "to_check",
    created_at: ago("PT1H40M"),
  });

  // ── write-offs: this month's two ──
  const writeOffs: SampleRow[] = [
    { visit: "h-martha-2", amount: 28, reason: DESK_TEXT.writeOffSameWound },
    { visit: "h-leila-2", amount: 15, reason: DESK_TEXT.writeOffStudent },
  ].map((w) => {
    const v = VISITS.find((candidate) => candidate.key === w.visit)!;
    return {
      appointment_id: ref(visitLabel(v.key)),
      amount: w.amount,
      reason: t(w.reason),
      written_by: DESK,
      written_at: wall(v.date, shift(endOf(v), 5)),
    };
  });

  const checkNotes: SampleRow[] = [
    { registration_id: ref("registration:ruth"), note: t(DESK_TEXT.leftMessage), written_by: DESK, created_at: wall("2026-07-27", "16:05") },
  ];

  // ── recalls: who is due back, and where each stands ──
  const recallSpecs: { from: string; status: "due" | "noted" | "booked" | "not_needed"; reason: Reason; bookedAs?: string; type?: TypeId }[] = [
    { from: "h-tobias", status: "due", reason: "annual" },
    { from: "h-clara", status: "booked", reason: "review", bookedAs: "a1-clara" },
    { from: "h-hamid", status: "due", reason: "annual" },
    { from: "h-eleni", status: "due", reason: "followUp" },
    { from: "h-harriet", status: "due", reason: "annual" },
    { from: "h-martha", status: "booked", reason: "dressing", bookedAs: "t0830-martha" },
    { from: "h-hector", status: "booked", reason: "followUp", bookedAs: "a3-hector" },
    { from: "h-dev", status: "booked", reason: "shoulderRehab", bookedAs: "t1000-dev" },
    { from: "h-gustav", status: "booked", reason: "back", bookedAs: "t1115-gustav" },
    { from: "h-bram", status: "noted", reason: "followUp" },
    { from: "h-odette", status: "due", reason: "review", type: "routine" },
    { from: "h-cormac-2", status: "not_needed", reason: "knee" },
  ];
  const recalls: SampleRow[] = recallSpecs.map((r) => {
    const v = VISITS.find((candidate) => candidate.key === r.from)!;
    const weeks = v.recallWeeks!;
    return {
      "@label": `recall:${v.patient}`,
      patient_id: ref(`patient:${v.patient}`),
      from_appointment_id: ref(visitLabel(v.key)),
      visit_type_id: ref(`type:${r.type ?? v.type}`),
      clinician_id: ref(`clinician:${v.clinician}`),
      weeks,
      due_on: workday(addDays(v.date, weeks * 7)),
      status: r.status,
      reason: t(REASONS[r.reason]),
      dismiss_reason: r.status === "not_needed" ? t(DESK_TEXT.recallNotNeeded) : null,
      booked_appointment_id: r.bookedAs === undefined ? null : ref(visitLabel(r.bookedAs)),
      created_at: wall(v.date, shift(endOf(v), 1)),
    };
  });

  const waitingList: SampleRow[] = [
    { patient: "martha", type: "nurse", clinician: "tom", part: "mornings", since: "P7D", channel: "desk", note: DESK_TEXT.waitMornings },
    { patient: "bram", type: "routine", clinician: null, part: "any", since: "P5D", channel: "online", note: DESK_TEXT.waitShortNotice },
    { patient: "juno", type: "physio", clinician: "nadia", part: "afternoons", since: "P4D", channel: "desk", note: null },
    { patient: "hector", type: "routine", clinician: "amara", part: "any", since: "P2D", channel: "desk", note: null },
    { patient: "zofia", type: "new", clinician: null, part: "mornings", since: "P1D", channel: "online", note: null },
  ].map((w) => ({
    patient_id: ref(`patient:${w.patient}`),
    visit_type_id: ref(`type:${w.type}`),
    clinician_id: w.clinician === null ? null : ref(`clinician:${w.clinician}`),
    part_of_day: w.part,
    status: "waiting",
    channel: w.channel,
    note: w.note === null ? null : t(w.note),
    created_at: ago(w.since),
  }));

  /*
   * The outbox: what already went. Confirmations as each visit was booked,
   * yesterday's reminders for today, the missed-visit note to yesterday's
   * no-show, the recall note, and one reminder the patient's mailbox bounced.
   * Nothing is queued: a queued sample row would be sent.
   */
  const byKey = (key: string) => {
    const v = VISITS.find((candidate) => candidate.key === key);
    if (v === undefined) throw new Error(`no visit "${key}"`);
    return { v, p: patientOf(v.patient), row: appointments.find((row) => row["@label"] === visitLabel(key))! };
  };
  const message = (kind: string, key: string, at: Value, more: SampleRow = {}): SampleRow => {
    const { v, p } = byKey(key);
    const to = emailOf(p);
    if (to === null || !p.remind) throw new Error(`${p.name} has no email to send a ${kind} to`);
    return {
      kind,
      patient_id: ref(`patient:${p.id}`),
      appointment_id: ref(visitLabel(v.key)),
      to_address: to,
      language: p.language,
      status: "sent",
      due_at: at,
      sent_at: at,
      created_at: at,
      ...more,
    };
  };
  const confirmation = (key: string) => message("confirmation", key, byKey(key).row["created_at"]!);
  // Sent the working day before; its due moment is the visit's own start, as
  // Adminium's reminder scan records it (so the desk knows it has gone).
  const reminder = (key: string) => {
    const { v } = byKey(key);
    return message("reminder", key, wall(addWorkdays(v.date, -1), v.time), { due_at: wall(v.date, v.time) });
  };
  const bram = byKey("h-bram");
  const messages: SampleRow[] = [
    confirmation("a1-leila"),
    confirmation("a1-clara"),
    confirmation("a1-hamid"),
    confirmation("a3-odette"),
    confirmation("a4-priya"),
    reminder("t0845-ewan"),
    reminder("t1000-saoirse"),
    reminder("t1015-solveig"),
    reminder("t1400-nour"),
    { ...reminder("t1030-zofia"), status: "failed", sent_at: null, error: t(DESK_TEXT.mailboxFull) },
    message("missed", "y-yusuf", wall("2026-07-27", "10:20")),
    {
      kind: "recall",
      patient_id: ref("patient:bram"),
      recall_id: ref("recall:bram"),
      to_address: emailOf(bram.p),
      language: bram.p.language,
      status: "sent",
      due_at: wall("2026-07-24", "11:05"),
      sent_at: wall("2026-07-24", "11:05"),
      created_by: DESK,
      created_at: wall("2026-07-24", "11:05"),
    },
    message("confirmation", "t1100-kofi", ago(`P${String(patientOf("kofi").since)}D`)),
  ];

  // ── yesterday's close: the cash taken, counted ──
  const yesterday = "2026-07-27";
  const cashTaken = VISITS.filter((v) => v.date === yesterday).reduce(
    (sum, v) => sum + (v.pays ?? []).filter((p) => p.method === "cash" && p.voided === undefined).reduce((s, p) => s + p.amount, 0),
    0,
  );
  const dayCloses: SampleRow[] = [
    {
      day: workday(yesterday),
      no_shows_marked: VISITS.filter((v) => v.date === yesterday && v.outcome.kind === "no_show").length,
      cash_expected: cashTaken,
      cash_counted: cashTaken,
      note: t(DESK_TEXT.dayClosed),
      closed_by: DESK,
      closed_at: wall(yesterday, "17:40"),
    },
  ];

  return {
    format: SAMPLE_FORMAT,
    app: "clinic",
    assets: {},
    tables: [
      { ref: "settings", rows: settings },
      { ref: "opening_hours", rows: openingHours },
      { ref: "clinicians", rows: clinicians },
      { ref: "visit_types", rows: visitTypes },
      { ref: "clinician_visit_types", rows: does },
      { ref: "clinician_hours", rows: clinicianHours },
      { ref: "closures", rows: closures },
      { ref: "faqs", rows: faqs },
      { ref: "patients", rows: patients },
      { ref: "registrations", rows: registrations },
      { ref: "appointments", rows: appointments },
      { ref: "payments", rows: payments },
      { ref: "write_offs", rows: writeOffs },
      { ref: "check_notes", rows: checkNotes },
      { ref: "recalls", rows: recalls },
      { ref: "waiting_list", rows: waitingList },
      { ref: "messages", rows: messages },
      { ref: "day_closes", rows: dayCloses },
    ],
  };
}

/** `days` working days on from `date` (back, when negative). */
function addWorkdays(date: string, days: number): string {
  let at = date;
  for (let left = Math.abs(days); left > 0; ) {
    at = addDays(at, Math.sign(days));
    if (!isWeekend(at)) left -= 1;
  }
  return at;
}
