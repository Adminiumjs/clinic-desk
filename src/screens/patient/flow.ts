/**
 * What the patient has typed on the patients' pages, kept while they move
 * between them: the booking form, the "find me" fields of My visits and of
 * Reminders, the registration form.
 *
 * In memory only, on purpose. Nothing here is written to the browser's
 * storage, the address bar or the demo card: a mobile number and a date of
 * birth typed on a shared computer are gone when the tab is. The shared
 * patients' store (`state/patients.ts`) holds what the SERVER said — the
 * session's level, the name it found, the visits it returned; this holds only
 * what the person typed, so a page can put it back where they left it.
 */
import { create } from "zustand";

import type { CodeSent } from "../../data/ports.ts";
import type { Hhmm } from "../../data/types.ts";
import type { CodeProblem, LookupProblem } from "./logic.ts";

/** Why step one is showing again, when it is not the first time. */
export type Ended = "timeout" | "emailChanged" | null;

/** What step one says: a failed lookup, a code that could not be sent, or a field left empty. */
export type FindProblem = LookupProblem | CodeProblem | "needBoth";

export interface Lookup {
  mobile: string;
  bornOn: string;
  step: "find" | "code" | "in";
  problem: FindProblem | null;
  /** The code on its way: where to (masked), when it may be asked for again. */
  sent: CodeSent | null;
  /** `performance.now()` when it was sent, for the resend countdown. */
  sentAt: number;
  ended: Ended;
}

export interface Booking {
  returning: boolean;
  lkMobile: string;
  lkBornOn: string;
  lkProblem: FindProblem | null;
  /** The name the lookup found (shown as "Cormac E."). */
  foundName: string | null;
  name: string;
  bornOn: string;
  mobile: string;
  email: string;
  reason: string;
  deskNote: string;
  /** "That time has just gone": the nearest free times instead. */
  gone: Hhmm[] | null;
}

export interface Registering {
  name: string;
  bornOn: string;
  mobile: string;
  email: string;
  address: string;
  contact: string;
  /** The reference once the desk has it. */
  done: string | null;
}

const emptyLookup = (): Lookup => ({ mobile: "", bornOn: "", step: "find", problem: null, sent: null, sentAt: 0, ended: null });
const emptyBooking = (): Booking => ({
  returning: true,
  lkMobile: "",
  lkBornOn: "",
  lkProblem: null,
  foundName: null,
  name: "",
  bornOn: "",
  mobile: "",
  email: "",
  reason: "",
  deskNote: "",
  gone: null,
});
const emptyRegistering = (): Registering => ({ name: "", bornOn: "", mobile: "", email: "", address: "", contact: "", done: null });

export interface Flow {
  booking: Booking;
  visits: Lookup;
  prefs: Lookup;
  registering: Registering;
}

export const useFlow = create<Flow>(() => ({
  booking: emptyBooking(),
  visits: emptyLookup(),
  prefs: emptyLookup(),
  registering: emptyRegistering(),
}));

export type LookupSide = "visits" | "prefs";

export const setBooking = (patch: Partial<Booking>): void => useFlow.setState((s) => ({ booking: { ...s.booking, ...patch } }));
export const setLookup = (side: LookupSide, patch: Partial<Lookup>): void =>
  useFlow.setState((s) => (side === "visits" ? { visits: { ...s.visits, ...patch } } : { prefs: { ...s.prefs, ...patch } }));
export const setRegistering = (patch: Partial<Registering>): void => useFlow.setState((s) => ({ registering: { ...s.registering, ...patch } }));

/**
 * The session has gone (signed out, timed out, or ended by an address
 * change): both code-protected pages go back to step one. `keep` keeps what
 * was typed, so a patient whose half hour ran out finds themselves again in
 * one tap; a sign-out clears it, as the design does.
 */
export function forgetSession(keep: boolean, ended: Ended = null): void {
  useFlow.setState((s) => {
    const back = (l: Lookup): Lookup => (keep ? { ...l, step: "find", sent: null, problem: null, ended } : { ...emptyLookup(), ended });
    return { visits: back(s.visits), prefs: back(s.prefs), booking: { ...s.booking, foundName: null } };
  });
}

/** A fresh booking form (after a booking is made). */
export const resetBooking = (): void => useFlow.setState({ booking: emptyBooking() });
export const resetRegistering = (): void => useFlow.setState({ registering: emptyRegistering() });
