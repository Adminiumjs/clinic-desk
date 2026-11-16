/**
 * Paying online from the patients' pages: whether "Pay now" shows, the walk
 * to the secure payment page, and the way back.
 *
 * Nothing here moves money or decides an amount. The server says whether the
 * practice takes payments online right now (`payments()`); while it does not,
 * every page reads exactly as it always has. A payment is started for a visit
 * the patient can already read, and the amount is the visit's own.
 *
 * THE WAY BACK. The pay page is another address: the page this patient was on
 * is gone when they come back, and so is its memory. So, and only for that
 * trip, what the page needs to pick up where it left — which visit, what the
 * booking form showed, and the session that reads the visit — is kept in this
 * tab's `sessionStorage` as they leave, and read once (and removed) as they
 * come back. Signing out removes it too. Nothing they typed is kept: no
 * mobile, no date of birth. A session that has ended by then is no session:
 * the page says they were signed out while they were away, and claims
 * nothing about the payment it can no longer read.
 */
import { create } from "zustand";

import { PortError, type BookedToPay, type HeldState, type PayFor } from "../../data/ports.ts";
import type { Day, Hhmm, Id, Instant } from "../../data/types.ts";
import { loadMyVisits, patientsPort, usePatients } from "../../state/patients.ts";
import { go } from "../../state/ui.ts";
import { setBooking, setLookup } from "./flow.ts";
import { sessionEnded } from "./logic.ts";
import { nearestFor } from "./nearest.ts";

/** Where a payment the page started stands, as the page shows it. */
export type PayStep =
  /** "Taking you to the secure payment page…" */
  | { kind: "taking"; for: PayFor; id: Id }
  /** Back from the pay page: "Checking your payment…" */
  | { kind: "checking"; for: PayFor; id: Id }
  /** Back, and the visit still waits for its payment: try again, or pay at the desk. */
  | { kind: "failed"; for: "held"; id: Id }
  /** Back, and the visit's time went while they were away. */
  | { kind: "gone"; for: "held"; id: Id };

export interface PayingState {
  /** Whether the practice takes payments online right now (null until asked). */
  online: boolean | null;
  /** A staff member rehearsing the pages in test mode: the band says so. */
  test: boolean;
  step: PayStep | null;
  /** Back from paying with no session left to read the visit with. */
  away: boolean;
  /** The booking being paid for as it was made, to draw it again and to pay it again. */
  shown: BookingShown | null;
  /** A visit paid from My visits just now: its row says "Paid". */
  paidNow: Id | null;
}

export const usePaying = create<PayingState>(() => ({ online: null, test: false, step: null, away: false, shown: null, paidNow: null }));

/** Whether "Pay now" may be offered. */
export const payingOnline = (): boolean => usePaying.getState().online === true;

/** Ask the server once a visit to the pages; a failed answer reads as "not online", and the pages as ever. */
export async function loadPayments(): Promise<void> {
  try {
    const answer = await patientsPort().payments();
    usePaying.setState({ online: answer.online, test: answer.test });
  } catch {
    usePaying.setState({ online: false, test: false });
  }
}

// ── what is carried across the pay page ─────────────────────────────────────

const AWAY_KEY = "clinic.paying";
/** A trip longer than this is not one to pick up from: the visit is read again from scratch. */
const AWAY_FOR_MS = 2 * 60 * 60_000;

/** The booking form as it was, to draw it again on the way back. */
export interface BookingShown {
  typeId: Id;
  clinicianId: Id | "any";
  day: Day;
  time: Hhmm;
  foundName: string;
  firstName: string;
  reason: string | null;
  booked: { ref: string; starts_at: Instant; minutes: number; clinician_id: Id | null; status: string; fee: number };
}

interface Carried {
  v: 1;
  for: PayFor;
  id: Id;
  leftAt: number;
  session: unknown;
  /** The name the server found them by (never what they typed). */
  name: string | null;
  booking: BookingShown | null;
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Forget what was carried: on the way back, and on signing out. */
export function forgetCarried(): void {
  try {
    storage()?.removeItem(AWAY_KEY);
  } catch {
    // Storage that cannot be written holds nothing to forget.
  }
}

function readCarried(): Carried | null {
  try {
    const raw = storage()?.getItem(AWAY_KEY) ?? null;
    forgetCarried();
    if (raw === null) return null;
    const doc = JSON.parse(raw) as Partial<Carried>;
    if (doc.v !== 1 || (doc.for !== "held" && doc.for !== "visit") || typeof doc.id !== "number" || typeof doc.leftAt !== "number") return null;
    if (Date.now() - doc.leftAt > AWAY_FOR_MS) return null;
    return { v: 1, for: doc.for, id: doc.id, leftAt: doc.leftAt, session: doc.session ?? null, name: typeof doc.name === "string" ? doc.name : null, booking: doc.booking ?? null };
  } catch {
    return null;
  }
}

// ── leaving for the pay page ────────────────────────────────────────────────

const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
/** "Taking you…" stays up long enough to read before the page changes. */
const TAKING_MS = 900;

/**
 * Off to the pay page for one visit. The demo never leaves: it plays the
 * payment out in the browser and comes straight back as from a paid one.
 */
export async function handOff(payUrl: string, of: PayFor, id: Id, booking: BookingShown | null): Promise<void> {
  usePaying.setState({ step: { kind: "taking", for: of, id }, away: false, ...(booking === null ? {} : { shown: booking }) });
  const port = patientsPort();
  await pause(TAKING_MS);
  if (port.simulatePay !== undefined) {
    await port.simulatePay(payUrl);
    await comeBack({ v: 1, for: of, id, leftAt: Date.now(), session: null, name: usePatients.getState().found?.name ?? null, booking });
    return;
  }
  try {
    const name = usePatients.getState().found?.name ?? null;
    storage()?.setItem(AWAY_KEY, JSON.stringify({ v: 1, for: of, id, leftAt: Date.now(), session: port.carrySession(), name, booking } satisfies Carried));
  } catch {
    // Without storage the way back finds nothing: the patient looks themselves up again, as after any reload.
  }
  window.location.assign(payUrl);
}

/** Book a visit to pay for it now, and leave for the pay page; or, when it cannot be paid online now, book it for the desk. */
export async function bookAndPay(made: BookedToPay, booking: BookingShown): Promise<"left" | "desk"> {
  if (made.payUrl === null) {
    // The practice stopped taking payments online between the page's question and the booking:
    // the time is the patient's all the same, to pay at the desk.
    await patientsPort().settleHeld(made.id, "booked");
    return "desk";
  }
  await handOff(made.payUrl, "held", made.id, booking);
  return "left";
}

/** Start paying again for a visit the page can read. */
export async function payAgain(of: PayFor, id: Id, booking: BookingShown | null): Promise<void> {
  const url = await patientsPort().payLink(id, of);
  await handOff(url, of, id, booking);
}

// ── coming back ─────────────────────────────────────────────────────────────

/** How often, and how long, the page asks again while a payment it just made is being written down. */
const CHECK_EVERY_MS = 1_500;
const CHECKS = 10;

const sessionGone = (error: unknown): boolean => error instanceof PortError && sessionEnded(error.code);

/** Called once the pages have booted: a patient back from the pay page is taken to where they left. */
export async function comeBackFromPaying(): Promise<void> {
  const carried = readCarried();
  if (carried === null) return;
  patientsPort().resumeSession(carried.session);
  await comeBack(carried);
}

/** Signed out while away: say so, and claim nothing about a payment the page cannot read. */
function signedOutAway(): void {
  usePaying.setState({ step: null, away: true });
  setLookup("visits", { step: "find", sent: null, problem: null });
  go("visits");
}

async function comeBack(carried: Carried): Promise<void> {
  const port = patientsPort();
  const level = port.level();
  if (level === null) {
    signedOutAway();
    return;
  }
  // Who they are, as the server named them: their date of birth and mobile were never kept.
  const held = usePatients.getState().found;
  usePatients.setState({ level, found: held ?? { name: carried.name ?? carried.booking?.foundName ?? "", bornOn: "" } });
  if (carried.for === "visit") {
    // Their own visits: the row shows Paid once the payment is written down.
    go("visits");
    usePaying.setState({ step: { kind: "checking", for: "visit", id: carried.id }, away: false });
    for (let n = 0; n < CHECKS; n += 1) {
      try {
        const visit = (await loadMyVisits()).find((one) => one.id === carried.id);
        if (visit !== undefined && visit.balance <= 0) usePaying.setState({ paidNow: visit.id });
        if (visit === undefined || visit.balance <= 0) break;
      } catch (error) {
        if (sessionGone(error)) {
          signedOutAway();
          return;
        }
        break;
      }
      await pause(CHECK_EVERY_MS);
    }
    usePaying.setState({ step: null });
    return;
  }

  // The visit they were paying for as they booked: the booking form as it was, while the page asks.
  const shown = carried.booking;
  if (shown !== null) {
    usePatients.setState({ typeId: shown.typeId, clinicianId: shown.clinicianId, day: shown.day, time: shown.time });
    setBooking({ returning: true, foundName: shown.foundName, gone: null });
  }
  go("details");
  usePaying.setState({ step: { kind: "checking", for: "held", id: carried.id }, away: false, shown });
  let state: HeldState = "paying";
  for (let n = 0; n < CHECKS; n += 1) {
    try {
      state = await port.held(carried.id);
    } catch (error) {
      if (sessionGone(error)) {
        signedOutAway();
        return;
      }
      break;
    }
    if (state !== "paying") break;
    await pause(CHECK_EVERY_MS);
  }
  if (state === "booked" && shown !== null) {
    usePatients.setState({
      booked: { ...shown.booked, status: "booked", firstVisit: false, firstName: shown.firstName, email: null, typeId: shown.typeId, reason: shown.reason, moved: false, paidAhead: shown.booked.fee },
      time: null,
    });
    usePaying.setState({ step: null });
    go("confirm");
    return;
  }
  if (shown === null) {
    // Nothing to draw the booking with: their visits say how it stands.
    usePaying.setState({ step: null });
    go("visits");
    return;
  }
  if (state === "lapsed") {
    setBooking({ gone: await nearestFor(shown.typeId, shown.clinicianId, undefined, shown.day, shown.time) });
    usePaying.setState({ step: { kind: "gone", for: "held", id: carried.id } });
    return;
  }
  usePaying.setState({ step: state === "paying" ? { kind: "failed", for: "held", id: carried.id } : null });
}
