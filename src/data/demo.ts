/**
 * The demo's own fiction — only the demo build contains this file.
 *
 * The website's demo runs the real app over the sample practice (the same
 * bundle an operator adds from Adminium, `seeds/clinic.sample.json`), on a
 * pinned Tuesday morning. What the sample cannot say lives here: who is
 * signed in at the demo desk, and what the demo card's shortcuts type into
 * the patients' pages. `DEMO` folds every import of this file away from a
 * real build, and `testing/surfaceBuild.test.ts` proves none of these words
 * reach one.
 */

/** Who sits at the demo desk: a manager, so every screen and button shows. */
export const DEMO_DESK = {
  name: "Ivy Ferreira",
  email: "ivy.ferreira@example.com",
  roleName: "Clinic manager",
} as const;

/** What the card's shortcuts fill in (the sample's own patients). */
export const DEMO_FILLS = {
  /** A patient on file, for "Returning patient". */
  returning: { mobile: "07700 900164", bornOn: "1968-10-02", name: "Cormac Ellery" },
  /** A patient with visits and an email, for My visits and Reminders. */
  withVisits: { mobile: "07700 900171", bornOn: "2001-09-27", name: "Leila Farsi" },
  /** Two people who share a number, for "Fill a shared number". */
  sharedNumber: { mobile: "07700 900126", bornOn: "1990-01-01" },
  /** Someone not yet on file, for "First visit". */
  firstVisit: { name: "Anouk Brenner", bornOn: "1994-06-12", mobile: "07700 900216", email: "anouk.brenner@example.com" },
  /** Someone registering with the practice. */
  register: { name: "Ottilie Marsh", bornOn: "1987-11-03", mobile: "07700 900233", email: "ottilie.marsh@example.com", address: "4 Elm Parade, Ashgrove BS7 2QT", contact: "Rafe Marsh · 07700 900234" },
} as const;
