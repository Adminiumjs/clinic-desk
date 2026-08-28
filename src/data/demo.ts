/**
 * Seeded demo data — Rowan Health, a fictional four-clinician neighbourhood
 * practice.
 *
 * Everything here is invention. The clinicians, the patients, the reasons for
 * visiting and the amounts owed are written to look like a real Tuesday morning
 * at a small practice: three people already seen, four in the building at
 * deliberately different waiting times, one who has not turned up, six accounts
 * still open, and five people due to be seen again.
 *
 * SCOPE, stated once and enforced everywhere below: this is the appointment
 * desk. A visit carries a reason as ONE short plain line and nothing more.
 * There are no diagnoses here, no codes, no medicines, no results and no notes
 * from a clinician, because none of that belongs at a front desk. The allergies
 * chip is the single exception, because a real desk carries one.
 *
 * Translatable prose (reasons, roles, desk notes, allergy words) is stored as
 * an i18n KEY, not as English; `lib/format.ts`'s `label()` resolves it. Proper
 * nouns — people's names, phone numbers, the practice address — are never
 * translated and are stored literally.
 *
 * The DataSource seam (`data/source.ts`) is what a real deployment replaces;
 * this module is what it replaces it *with* in demo mode.
 */

import type {
  Appointment,
  Charge,
  Clinician,
  Closure,
  Now,
  Patient,
  Payment,
  VisitType,
} from "./types.ts";

/**
 * The pinned clock: Tuesday, 28 July 2026, 09:20.
 *
 * Nothing user-visible reads `Date.now()`. The dock's "+15 min" chip is the
 * only thing that moves time, and it moves this.
 */
export const NOW: Now = { date: "2026-07-28", minutes: 9 * 60 + 20 };

/** Where the practice is. A proper noun, not translated. */
export const ADDRESS = "12 Rowan Lane, Ashbourne Green";

/**
 * The demo hint chip on both lookups fills these in. Real details for a real
 * seeded patient, so the lookup succeeds instead of teaching a reader that the
 * demo is broken.
 */
export const DEMO_LOOKUP = { mobile: "07700 900405", dob: "1968-07-30" };

/** What the visit is, how long it runs, and what it costs. */
export const VISIT_TYPES: VisitType[] = [
  {
    id: "routine",
    label: "data.type.routine",
    blurb: "data.type.routine.blurb",
    minutes: 15,
    fee: 45,
    tint: "#0369a1",
  },
  {
    id: "newpatient",
    label: "data.type.newpatient",
    blurb: "data.type.newpatient.blurb",
    minutes: 30,
    fee: 80,
    tint: "#7c3aed",
  },
  {
    id: "physio",
    label: "data.type.physio",
    blurb: "data.type.physio.blurb",
    minutes: 45,
    fee: 60,
    tint: "#0d9488",
  },
  {
    id: "nurse",
    label: "data.type.nurse",
    blurb: "data.type.nurse.blurb",
    minutes: 15,
    fee: 25,
    tint: "#b25e09",
  },
];

/**
 * Four clinicians, one tint each. The tint follows a clinician everywhere they
 * appear — the day-sheet column, the waiting card, the booking chooser — so a
 * reader learns the colour once.
 *
 * `offers` is why a GP never appears in the physiotherapy chooser.
 */
export const CLINICIANS: Clinician[] = [
  {
    id: "amara",
    name: "Dr Amara Osei",
    ini: "AO",
    role: "data.role.gp",
    tint: "#0369a1",
    offers: ["routine", "newpatient"],
  },
  {
    id: "piotr",
    name: "Dr Piotr Nowak",
    ini: "PN",
    role: "data.role.gp",
    tint: "#7c3aed",
    offers: ["routine", "newpatient"],
  },
  {
    id: "nadia",
    name: "Nadia Haddad",
    ini: "NH",
    role: "data.role.physio",
    tint: "#0d9488",
    offers: ["physio"],
  },
  {
    id: "tom",
    name: "Tom Villasenor",
    ini: "TV",
    role: "data.role.nurse",
    tint: "#b25e09",
    offers: ["nurse"],
  },
];

/** Whoever is on the desk this morning. */
export const STAFF = { name: "Marisol Enriquez", ini: "ME", role: "data.role.desk", tint: "#0369a1" };

/**
 * Thirty patients, aged 6 to 84 against the pinned date. Ages are never stored
 * — `ageOn()` derives them — so nobody in this seed has a birthday that fails
 * to happen.
 */
export const PATIENTS: Patient[] = [
  { id: "mira", name: "Mira Ashworth", ini: "MA", dob: "1987-03-14", mobile: "07700 900401", allergies: "data.allergy.latex" },
  { id: "dev", name: "Dev Ramchandani", ini: "DR", dob: "1992-11-02", mobile: "07700 900402", allergies: null },
  { id: "hazel", name: "Hazel Boone", ini: "HB", dob: "1942-01-19", mobile: "07700 900403", allergies: null },
  { id: "otis", name: "Otis Delacroix", ini: "OD", dob: "2020-05-08", mobile: "07700 900404", allergies: "data.allergy.peanuts" },
  { id: "june", name: "June Kowalczyk", ini: "JK", dob: "1968-07-30", mobile: "07700 900405", allergies: null },
  { id: "felix", name: "Felix Nwachukwu", ini: "FN", dob: "1979-09-22", mobile: "07700 900406", allergies: null },
  { id: "sana", name: "Sana Rehman", ini: "SR", dob: "2001-02-11", mobile: "07700 900407", allergies: null },
  { id: "bram", name: "Bram Vandenberg", ini: "BV", dob: "1955-12-05", mobile: "07700 900408", allergies: "data.allergy.dressings" },
  { id: "ines", name: "Ines Moreau", ini: "IM", dob: "1996-06-17", mobile: "07700 900409", allergies: null },
  { id: "teo", name: "Teo Marchetti", ini: "TM", dob: "2013-08-25", mobile: "07700 900410", allergies: null },
  { id: "willa", name: "Willa Okafor", ini: "WO", dob: "1983-04-03", mobile: "07700 900411", allergies: null },
  { id: "arjun", name: "Arjun Bhatt", ini: "AB", dob: "1974-10-29", mobile: "07700 900412", allergies: null },
  { id: "nell", name: "Nell Fitzgerald", ini: "NF", dob: "1949-02-27", mobile: "07700 900413", allergies: "data.allergy.shellfish" },
  { id: "kofi", name: "Kofi Mensah", ini: "KM", dob: "1990-12-13", mobile: "07700 900414", allergies: null },
  { id: "lyra", name: "Lyra Petrov", ini: "LP", dob: "2016-03-30", mobile: "07700 900415", allergies: "data.allergy.peanuts" },
  { id: "hana", name: "Hana Sorensen", ini: "HS", dob: "1965-05-21", mobile: "07700 900416", allergies: null },
  { id: "milo", name: "Milo Ferreira", ini: "MF", dob: "2008-11-07", mobile: "07700 900417", allergies: null },
  { id: "rosa", name: "Rosa Iglesias", ini: "RI", dob: "1971-01-08", mobile: "07700 900418", allergies: null },
  { id: "yusuf", name: "Yusuf Demir", ini: "YD", dob: "1986-08-16", mobile: "07700 900419", allergies: null },
  { id: "edith", name: "Edith Blackwood", ini: "EB", dob: "1946-06-04", mobile: "07700 900420", allergies: "data.allergy.latex" },
  { id: "noor", name: "Noor Al-Sayed", ini: "NA", dob: "1998-09-09", mobile: "07700 900421", allergies: null },
  { id: "gus", name: "Gus Lindqvist", ini: "GL", dob: "1961-04-15", mobile: "07700 900422", allergies: null },
  { id: "priya", name: "Priya Anand", ini: "PA", dob: "1994-02-23", mobile: "07700 900423", allergies: null },
  { id: "tam", name: "Tam Nguyen", ini: "TN", dob: "1977-07-12", mobile: "07700 900424", allergies: null },
  { id: "iris", name: "Iris Vaughan", ini: "IV", dob: "2011-10-01", mobile: "07700 900425", allergies: "data.allergy.stings" },
  { id: "omar", name: "Omar Haddadi", ini: "OH", dob: "1959-03-06", mobile: "07700 900426", allergies: null },
  { id: "betty", name: "Betty Ochoa", ini: "BO", dob: "1952-08-19", mobile: "07700 900427", allergies: null },
  { id: "jonah", name: "Jonah Kessler", ini: "JK", dob: "2004-05-27", mobile: "07700 900428", allergies: null },
  { id: "clem", name: "Clem Aubrey", ini: "CA", dob: "1981-12-30", mobile: "07700 900429", allergies: null },
  { id: "saoirse", name: "Saoirse Byrne", ini: "SB", dob: "1969-11-11", mobile: "07700 900430", allergies: null },
];

/**
 * The appointment book.
 *
 * References run in booking order, not visit order: `RH-3981`…`RH-4000` are the
 * visits that have already happened, `RH-4001`…`RH-4019` are today, and
 * `RH-4020` is the one future booking in the seed. The next reference the desk
 * mints is therefore `RH-4021`, which is what the confirmation screen shows.
 *
 * Today, at the pinned 09:20, is arranged to make the desk's whole morning
 * legible at a glance:
 *   - RH-4001, RH-4002 and RH-4007 have been seen and have left;
 *   - RH-4003, RH-4009, RH-4012 and RH-4016 are in the building at 47, 6, 22
 *     and 34 minutes since check-in, so the board shows one calm card, two
 *     amber and one danger without anybody having to touch the clock;
 *   - RH-4008 was due at 09:00 and has not arrived, which is what populates the
 *     "hasn't arrived" strip twenty minutes in.
 */
export const APPOINTMENTS: Appointment[] = [
  /* ---------------------------------------------------- already happened */
  { id: "RH-3981", patient: "hazel", clinician: "amara", type: "routine", date: "2026-06-02", start: 540, status: "done", checkedInAt: 532, reason: "data.reason.bp", deskNote: null, recallWeeks: 6 },
  { id: "RH-3982", patient: "teo", clinician: "tom", type: "nurse", date: "2026-06-09", start: 630, status: "done", checkedInAt: 624, reason: "data.reason.travel", deskNote: null, recallWeeks: null },
  { id: "RH-3983", patient: "milo", clinician: "nadia", type: "physio", date: "2026-06-11", start: 840, status: "done", checkedInAt: 833, reason: "data.reason.wrist", deskNote: null, recallWeeks: null },
  { id: "RH-3984", patient: "yusuf", clinician: "piotr", type: "routine", date: "2026-06-16", start: 675, status: "done", checkedInAt: 668, reason: "data.reason.annual", deskNote: null, recallWeeks: 6 },
  { id: "RH-3985", patient: "edith", clinician: "amara", type: "routine", date: "2026-06-18", start: 585, status: "done", checkedInAt: 575, reason: "data.reason.review", deskNote: null, recallWeeks: null },
  { id: "RH-3986", patient: "saoirse", clinician: "tom", type: "nurse", date: "2026-06-23", start: 900, status: "done", checkedInAt: 894, reason: "data.reason.dressing", deskNote: null, recallWeeks: null },
  { id: "RH-3987", patient: "bram", clinician: "piotr", type: "routine", date: "2026-06-25", start: 600, status: "done", checkedInAt: 590, reason: "data.reason.bp", deskNote: null, recallWeeks: 5 },
  { id: "RH-3988", patient: "hana", clinician: "nadia", type: "physio", date: "2026-06-30", start: 555, status: "done", checkedInAt: 548, reason: "data.reason.shoulder", deskNote: null, recallWeeks: 3 },
  { id: "RH-3989", patient: "june", clinician: "amara", type: "routine", date: "2026-07-01", start: 855, status: "done", checkedInAt: 847, reason: "data.reason.annual", deskNote: null, recallWeeks: 4 },
  { id: "RH-3990", patient: "ines", clinician: "piotr", type: "newpatient", date: "2026-07-02", start: 540, status: "done", checkedInAt: 528, reason: "data.reason.register", deskNote: null, recallWeeks: null },
  { id: "RH-3991", patient: "otis", clinician: "tom", type: "nurse", date: "2026-07-07", start: 660, status: "done", checkedInAt: 651, reason: "data.reason.child", deskNote: null, recallWeeks: null },
  { id: "RH-3992", patient: "arjun", clinician: "nadia", type: "physio", date: "2026-07-10", start: 795, status: "done", checkedInAt: 788, reason: "data.reason.knee", deskNote: null, recallWeeks: null },
  { id: "RH-3993", patient: "felix", clinician: "amara", type: "routine", date: "2026-07-14", start: 960, status: "done", checkedInAt: 951, reason: "data.reason.review", deskNote: null, recallWeeks: null },
  { id: "RH-3994", patient: "betty", clinician: "tom", type: "nurse", date: "2026-07-15", start: 570, status: "done", checkedInAt: 561, reason: "data.reason.dressing", deskNote: null, recallWeeks: null },
  { id: "RH-3995", patient: "nell", clinician: "piotr", type: "routine", date: "2026-07-16", start: 645, status: "done", checkedInAt: 634, reason: "data.reason.bp", deskNote: null, recallWeeks: null },
  { id: "RH-3996", patient: "willa", clinician: "amara", type: "routine", date: "2026-07-17", start: 555, status: "done", checkedInAt: 549, reason: "data.reason.ear", deskNote: null, recallWeeks: null },
  { id: "RH-3997", patient: "kofi", clinician: "nadia", type: "physio", date: "2026-07-20", start: 675, status: "done", checkedInAt: 667, reason: "data.reason.back", deskNote: null, recallWeeks: null },
  { id: "RH-3998", patient: "priya", clinician: "piotr", type: "routine", date: "2026-07-22", start: 915, status: "cancelled", checkedInAt: null, reason: "data.reason.review", deskNote: null, recallWeeks: null },
  { id: "RH-3999", patient: "gus", clinician: "amara", type: "routine", date: "2026-07-27", start: 570, status: "no_show", checkedInAt: null, reason: "data.reason.bp", deskNote: null, recallWeeks: null },
  { id: "RH-4000", patient: "iris", clinician: "tom", type: "nurse", date: "2026-07-27", start: 870, status: "no_show", checkedInAt: null, reason: "data.reason.stitches", deskNote: null, recallWeeks: null },

  /* ------------------------------------------------------------ today */
  /* Dr Amara Osei */
  { id: "RH-4001", patient: "mira", clinician: "amara", type: "routine", date: "2026-07-28", start: 510, status: "done", checkedInAt: 505, reason: "data.reason.bp", deskNote: null, recallWeeks: null },
  { id: "RH-4002", patient: "dev", clinician: "amara", type: "routine", date: "2026-07-28", start: 525, status: "done", checkedInAt: 520, reason: "data.reason.review", deskNote: null, recallWeeks: null },
  { id: "RH-4003", patient: "sana", clinician: "amara", type: "newpatient", date: "2026-07-28", start: 540, status: "with_clinician", checkedInAt: 513, reason: "data.reason.register", deskNote: "data.desknote.early", recallWeeks: null },
  { id: "RH-4004", patient: "june", clinician: "amara", type: "routine", date: "2026-07-28", start: 585, status: "booked", checkedInAt: null, reason: "data.reason.annual", deskNote: null, recallWeeks: null },
  { id: "RH-4005", patient: "jonah", clinician: "amara", type: "newpatient", date: "2026-07-28", start: 630, status: "booked", checkedInAt: null, reason: "data.reason.register", deskNote: null, recallWeeks: null },
  { id: "RH-4006", patient: "omar", clinician: "amara", type: "routine", date: "2026-07-28", start: 840, status: "booked", checkedInAt: null, reason: "data.reason.bp", deskNote: "data.desknote.wheelchair", recallWeeks: null },

  /* Dr Piotr Nowak */
  { id: "RH-4007", patient: "kofi", clinician: "piotr", type: "routine", date: "2026-07-28", start: 525, status: "done", checkedInAt: 518, reason: "data.reason.review", deskNote: null, recallWeeks: null },
  { id: "RH-4008", patient: "felix", clinician: "piotr", type: "routine", date: "2026-07-28", start: 540, status: "booked", checkedInAt: null, reason: "data.reason.annual", deskNote: null, recallWeeks: null },
  { id: "RH-4009", patient: "noor", clinician: "piotr", type: "newpatient", date: "2026-07-28", start: 570, status: "checked_in", checkedInAt: 554, reason: "data.reason.register", deskNote: null, recallWeeks: null },
  { id: "RH-4010", patient: "nell", clinician: "piotr", type: "routine", date: "2026-07-28", start: 660, status: "booked", checkedInAt: null, reason: "data.reason.annual", deskNote: null, recallWeeks: null },
  { id: "RH-4011", patient: "rosa", clinician: "piotr", type: "routine", date: "2026-07-28", start: 960, status: "booked", checkedInAt: null, reason: "data.reason.review", deskNote: null, recallWeeks: null },

  /* Nadia Haddad */
  { id: "RH-4012", patient: "arjun", clinician: "nadia", type: "physio", date: "2026-07-28", start: 555, status: "checked_in", checkedInAt: 538, reason: "data.reason.knee", deskNote: null, recallWeeks: null },
  { id: "RH-4013", patient: "hana", clinician: "nadia", type: "physio", date: "2026-07-28", start: 615, status: "booked", checkedInAt: null, reason: "data.reason.shoulder", deskNote: null, recallWeeks: null },
  { id: "RH-4014", patient: "gus", clinician: "nadia", type: "physio", date: "2026-07-28", start: 675, status: "booked", checkedInAt: null, reason: "data.reason.back", deskNote: null, recallWeeks: null },
  { id: "RH-4015", patient: "tam", clinician: "nadia", type: "physio", date: "2026-07-28", start: 795, status: "booked", checkedInAt: null, reason: "data.reason.ankle", deskNote: null, recallWeeks: null },

  /* Tom Villasenor */
  { id: "RH-4016", patient: "betty", clinician: "tom", type: "nurse", date: "2026-07-28", start: 525, status: "roomed", checkedInAt: 526, reason: "data.reason.dressing", deskNote: null, recallWeeks: null },
  { id: "RH-4017", patient: "teo", clinician: "tom", type: "nurse", date: "2026-07-28", start: 555, status: "booked", checkedInAt: null, reason: "data.reason.flu", deskNote: null, recallWeeks: null },
  { id: "RH-4018", patient: "lyra", clinician: "tom", type: "nurse", date: "2026-07-28", start: 600, status: "booked", checkedInAt: null, reason: "data.reason.child", deskNote: "data.desknote.parent", recallWeeks: null },
  { id: "RH-4019", patient: "iris", clinician: "tom", type: "nurse", date: "2026-07-28", start: 690, status: "booked", checkedInAt: null, reason: "data.reason.stitches", deskNote: null, recallWeeks: null },

  /* ---------------------------------------------------------- upcoming */
  { id: "RH-4020", patient: "june", clinician: "amara", type: "routine", date: "2026-08-11", start: 600, status: "booked", checkedInAt: null, reason: "data.reason.review", deskNote: null, recallWeeks: null },
];

/** The reference the next booking is given. The seed stops at RH-4020. */
export const NEXT_REF = 4021;

/**
 * What each completed visit cost. Six of them are still open — one of those is
 * forty days old, which is exactly the row the age chip exists to make
 * impossible to scroll past.
 */
export const CHARGES: Charge[] = [
  { id: "c-3981", appt: "RH-3981", patient: "hazel", amount: 45, raised: "2026-06-02" },
  { id: "c-3982", appt: "RH-3982", patient: "teo", amount: 25, raised: "2026-06-09" },
  { id: "c-3983", appt: "RH-3983", patient: "milo", amount: 60, raised: "2026-06-11" },
  { id: "c-3984", appt: "RH-3984", patient: "yusuf", amount: 45, raised: "2026-06-16" },
  { id: "c-3985", appt: "RH-3985", patient: "edith", amount: 45, raised: "2026-06-18" },
  { id: "c-3986", appt: "RH-3986", patient: "saoirse", amount: 25, raised: "2026-06-23" },
  { id: "c-3987", appt: "RH-3987", patient: "bram", amount: 45, raised: "2026-06-25" },
  { id: "c-3988", appt: "RH-3988", patient: "hana", amount: 60, raised: "2026-06-30" },
  { id: "c-3989", appt: "RH-3989", patient: "june", amount: 45, raised: "2026-07-01" },
  { id: "c-3990", appt: "RH-3990", patient: "ines", amount: 80, raised: "2026-07-02" },
  { id: "c-3991", appt: "RH-3991", patient: "otis", amount: 25, raised: "2026-07-07" },
  { id: "c-3992", appt: "RH-3992", patient: "arjun", amount: 60, raised: "2026-07-10" },
  { id: "c-3993", appt: "RH-3993", patient: "felix", amount: 45, raised: "2026-07-14" },
  { id: "c-3994", appt: "RH-3994", patient: "betty", amount: 25, raised: "2026-07-15" },
  { id: "c-3995", appt: "RH-3995", patient: "nell", amount: 45, raised: "2026-07-16" },
  { id: "c-3996", appt: "RH-3996", patient: "willa", amount: 45, raised: "2026-07-17" },
  { id: "c-3997", appt: "RH-3997", patient: "kofi", amount: 60, raised: "2026-07-20" },
  { id: "c-4001", appt: "RH-4001", patient: "mira", amount: 45, raised: "2026-07-28" },
  { id: "c-4002", appt: "RH-4002", patient: "dev", amount: 45, raised: "2026-07-28" },
  { id: "c-4007", appt: "RH-4007", patient: "kofi", amount: 45, raised: "2026-07-28" },
];

/**
 * What has actually been taken. `c-3996` carries a part payment on purpose, so
 * the outstanding list has one row that is neither open nor settled — the case
 * a clamping payment check would quietly get wrong.
 */
export const PAYMENTS: Payment[] = [
  { id: "p-01", charge: "c-3981", amount: 45, method: "card", date: "2026-06-02" },
  { id: "p-02", charge: "c-3982", amount: 25, method: "cash", date: "2026-06-09" },
  { id: "p-03", charge: "c-3983", amount: 60, method: "card", date: "2026-06-11" },
  { id: "p-04", charge: "c-3984", amount: 45, method: "card", date: "2026-06-16" },
  { id: "p-05", charge: "c-3986", amount: 25, method: "cash", date: "2026-06-23" },
  { id: "p-06", charge: "c-3987", amount: 45, method: "transfer", date: "2026-06-25" },
  { id: "p-07", charge: "c-3988", amount: 60, method: "card", date: "2026-06-30" },
  { id: "p-08", charge: "c-3990", amount: 80, method: "card", date: "2026-07-02" },
  { id: "p-09", charge: "c-3991", amount: 25, method: "cash", date: "2026-07-07" },
  { id: "p-10", charge: "c-3992", amount: 60, method: "card", date: "2026-07-10" },
  { id: "p-11", charge: "c-3993", amount: 45, method: "card", date: "2026-07-14" },
  { id: "p-12", charge: "c-3996", amount: 20, method: "cash", date: "2026-07-21" },
  { id: "p-13", charge: "c-4001", amount: 45, method: "card", date: "2026-07-28" },
  { id: "p-14", charge: "c-4002", amount: 45, method: "cash", date: "2026-07-28" },
  { id: "p-15", charge: "c-4007", amount: 45, method: "card", date: "2026-07-28" },
];

/**
 * DAYS OFF — DELIBERATELY EMPTY, exactly as `db/seed.sql` leaves the table.
 *
 * Nobody is away in the fortnight this seed covers, and the seed's own comment
 * says why an invented row would be worse than none: "a closure the app does
 * not know about would be a day the dashboard says is shut while the booking
 * screen carries on offering times on it." The two halves of this demo — this
 * app and the generated dashboard over the same schema — have to agree, and
 * they agree here by both holding nothing.
 *
 * IT IS A DECLARED EMPTY LIST RATHER THAN AN ABSENT ONE, and the difference is
 * the whole reason this constant exists at all instead of `closures: () => []`
 * in `source.ts`. An absent seed is indistinguishable from a forgotten one; a
 * named export with this comment on it is a statement that the emptiness was
 * chosen, and `db/seed-drift.test.ts` compares the two files' rows so the day
 * somebody adds a closure to one and not the other is a red suite.
 *
 * It is also what makes 24 D6 checkable rather than asserted: with nothing
 * connected the practice's closure list is empty, `isWorkingDay` reduces to the
 * weekday predicate it was before this retrofit, and every screen renders
 * exactly what it rendered before.
 */
export const CLOSURES: Closure[] = [];
