/**
 * The DataSource seam.
 *
 * This app ships in demo mode: every read below returns the seeded fiction in
 * `demo.ts`, synchronously, with no network involved. The seam exists so that
 * pointing the app at a real Adminium deployment is a change to ONE file rather
 * than a rewrite — the screens and the store already talk to this interface and
 * never import `demo.ts` for data they render.
 *
 * When `@adminium/manifest` lands (Phase B), a second implementation backed by
 * `AdminiumDataSource` slots in here and `demoSource` becomes the fallback used
 * when no `adm_pub_` key is configured.
 */

import {
  APPOINTMENTS,
  CHARGES,
  CLINICIANS,
  NOW,
  PATIENTS,
  PAYMENTS,
  VISIT_TYPES,
} from "./demo.ts";
import type {
  Appointment,
  Charge,
  Clinician,
  Now,
  Patient,
  Payment,
  VisitType,
} from "./types.ts";

export interface DataSource {
  /** The pinned clock. A live deployment would return the real one here. */
  now(): Now;
  visitTypes(): VisitType[];
  clinicians(): Clinician[];
  patients(): Patient[];
  appointments(): Appointment[];
  charges(): Charge[];
  payments(): Payment[];
}

/**
 * Records are copied on the way out. A caller that mutates what it is given
 * cannot reach back into the seed, which is what lets the demo reset cleanly.
 */
export const demoSource: DataSource = {
  now: () => ({ ...NOW }),
  visitTypes: () => VISIT_TYPES.map((v) => ({ ...v })),
  clinicians: () => CLINICIANS.map((c) => ({ ...c, offers: [...c.offers] })),
  patients: () => PATIENTS.map((p) => ({ ...p })),
  appointments: () => APPOINTMENTS.map((a) => ({ ...a })),
  charges: () => CHARGES.map((c) => ({ ...c })),
  payments: () => PAYMENTS.map((p) => ({ ...p })),
};

/** The source the app is currently wired to. */
export const source: DataSource = demoSource;
