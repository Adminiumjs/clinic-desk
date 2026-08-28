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
  CLOSURES,
  NOW,
  PATIENTS,
  PAYMENTS,
  VISIT_TYPES,
} from "./demo.ts";
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

export interface DataSource {
  /** The pinned clock. A live deployment would return the real one here. */
  now(): Now;
  visitTypes(): VisitType[];
  clinicians(): Clinician[];
  patients(): Patient[];
  appointments(): Appointment[];
  charges(): Charge[];
  payments(): Payment[];
  /**
   * The days the practice does not work.
   *
   * A NEW MEMBER ON AN INTERFACE EVERY IMPLEMENTATION MUST SATISFY, which is
   * the point of adding it here rather than reading `closures` off a store
   * field somewhere. `db/schema.sql` has declared this table since the app was
   * written and nothing read it; a seam that names it is what makes "does this
   * deployment expose its closures?" a question with one answer per transport
   * instead of a silence per screen.
   *
   * The demo answers `[]`, which is what `db/seed.sql` inserts, deliberately.
   */
  closures(): Closure[];
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
  closures: () => CLOSURES.map((c) => ({ ...c })),
};

/*
 * The source the app is currently wired to.
 *
 * The header above says swapping this is "a change to ONE file". It is not, and
 * this is where that breaks: `state/store.ts` calls `source.visitTypes()` at
 * MODULE SCOPE (its reference data is module-level `const`s so a demo reset
 * does not have to restore it). Anything assigning a real source must therefore
 * run before `store.ts` is EVALUATED, which is why `main.tsx` imports `App`
 * dynamically, after the fetch.
 *
 * A mutable binding plus a setter is the smallest change that makes that
 * possible. `setDataSource` throws once the store has read, so the failure mode
 * is loud rather than a half-demo half-live screen.
 */
let current: DataSource = demoSource;
let read = false;

export const source: DataSource = {
  now: () => ((read = true), current.now()),
  visitTypes: () => ((read = true), current.visitTypes()),
  clinicians: () => ((read = true), current.clinicians()),
  patients: () => ((read = true), current.patients()),
  appointments: () => ((read = true), current.appointments()),
  charges: () => ((read = true), current.charges()),
  payments: () => ((read = true), current.payments()),
  closures: () => ((read = true), current.closures()),
};

/** Swap the backing source. Must happen before any module-scope read. */
export function setDataSource(next: DataSource): void {
  if (read) {
    throw new Error(
      "setDataSource() called after the store already read — import App dynamically, after the snapshot resolves.",
    );
  }
  current = next;
}

/**
 * True once a real backend is behind the seam.
 *
 * Read by the demo dock, which resets and advances seeded fiction: against real
 * rows those controls either lie or do damage, so it does not render.
 */
export function isConnected(): boolean {
  return current !== demoSource;
}
