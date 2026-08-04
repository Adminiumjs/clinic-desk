/**
 * The app's single store.
 *
 * Deliberately one zustand store rather than several: the booking site, the day
 * sheet, the waiting board and the accounts view all read the same appointment
 * list, and splitting them would mean keeping four copies in step. Everything
 * derived — waiting times, open slots, balances, who is due back — is computed
 * in `lib/schedule.ts` at render time from what lives here, never stored.
 *
 * The seed is copied into state on creation so the demo can be reset without
 * reloading the page, and so `data/demo.ts` stays an immutable description of
 * the fiction rather than mutable app state.
 *
 * THE CLOCK LIVES HERE. `now` starts at the pinned Tuesday 09:20 and moves only
 * when `advanceClock()` runs, which only the dock's "+15 min" chip calls.
 * Nothing else in the app reads a real clock.
 */

import { create } from "zustand";

import { source } from "../data/source.ts";
import { ADDRESS, DEMO_LOOKUP, NEXT_REF, STAFF } from "../data/demo.ts";
import type {
  Appointment,
  Charge,
  Clinician,
  Now,
  PayMethod,
  Patient,
  Payment,
  Persona,
  Toast,
  View,
  VisitType,
  VisitTypeId,
  VisitStatus,
} from "../data/types.ts";
import { t } from "../i18n/ambient.ts";
import { STATUS_KEY, clock, label, money } from "../lib/format.ts";
import {
  addDays,
  balanceOf,
  checkPayment,
  hhmm,
  isLateCancel,
  nextStatus,
  visitTypeById,
} from "../lib/schedule.ts";

const THEME_KEY = "clinic-desk-theme";

export type Theme = "light" | "dark";

/* The reference data never changes during a session, so it is read once here
 * rather than copied into state and reset with everything else. */
export const VISIT_TYPES: VisitType[] = source.visitTypes();
export const CLINICIANS: Clinician[] = source.clinicians();
export const PATIENTS: Patient[] = source.patients();
export const PINNED: Now = source.now();
export const PRACTICE_ADDRESS = ADDRESS;
export const LOOKUP_HINT = DEMO_LOOKUP;
export const DESK_STAFF = STAFF;

export function clinicianById(id: string): Clinician | null {
  return CLINICIANS.find((c) => c.id === id) ?? null;
}

export function patientById(id: string): Patient | null {
  return PATIENTS.find((p) => p.id === id) ?? null;
}

/** The name to show for a visit, whether it is seeded or just booked. */
export function patientName(id: string, walkIn: string | null): string {
  return patientById(id)?.name ?? walkIn ?? id;
}

/** The draft a reader builds up across Find a time → Your details. */
interface Draft {
  type: VisitTypeId;
  /** A clinician id, or `"any"`. */
  clinician: string;
  day: string;
  /** Minutes since midnight, or null before a slot is picked. */
  start: number | null;
  /** Which clinician the picked slot belongs to — resolved from `"any"`. */
  slotClinician: string | null;
  returning: boolean;
  mobile: string;
  dob: string;
  name: string;
  email: string;
  /** The patient the lookup matched, or null. */
  matched: string | null;
  /** True once a lookup has run and found nobody. */
  lookupMissed: boolean;
  reason: string;
  deskNote: string;
}

function freshDraft(now: Now): Draft {
  return {
    type: "routine",
    clinician: "any",
    day: now.date,
    start: null,
    slotClinician: null,
    returning: true,
    mobile: "",
    dob: "",
    name: "",
    email: "",
    matched: null,
    lookupMissed: false,
    reason: "",
    deskNote: "",
  };
}

interface State {
  /* --- routing + persona --- */
  view: View;
  persona: Persona;

  /* --- chrome --- */
  theme: Theme;
  navOpen: boolean;
  dockOpen: boolean;
  /** True while any overlay owns a bottom corner, so the dock steps aside. */
  overlayOpen: boolean;

  /* --- the pinned, hand-cranked clock --- */
  now: Now;

  /* --- data --- */
  appts: Appointment[];
  charges: Charge[];
  payments: Payment[];
  /** Names for people booked during the session, who are not in the seed. */
  walkIns: Record<string, string>;

  /* --- booking flow --- */
  draft: Draft;
  /** The reference of the visit the confirmation screen is showing. */
  confirmedRef: string | null;
  confirmedPaid: boolean;
  refSeq: number;

  /* --- my visits --- */
  lookupMobile: string;
  lookupDob: string;
  /** Which patient the My visits lookup is showing, or null. */
  lookedUp: string | null;
  lookupMissed: boolean;

  /* --- clinic --- */
  sheetDay: string;
  patientQuery: string;
  openPatientId: string | null;
  /** The recall that sent the reader to the day sheet, if any. */
  prefill: { patient: string; reason: string } | null;

  /* --- overlays --- */
  panelRef: string | null;
  cancelRef: string | null;
  /** Which charge the record-payment popover is open for. */
  payChargeId: string | null;
  /** The card sheet: a charge id, or `"booking"` for the new visit. */
  cardFor: string | null;

  toasts: Toast[];

  /* --- actions --- */
  go: (view: View) => void;
  setPersona: (p: Persona) => void;
  initTheme: () => void;
  toggleTheme: () => void;
  setNavOpen: (open: boolean) => void;
  setDockOpen: (open: boolean) => void;
  advanceClock: () => void;

  setDraft: (patch: Partial<Draft>) => void;
  pickSlot: (clinician: string, start: number) => void;
  lookupDraft: () => void;
  fillDemoLookup: () => void;
  book: () => void;

  setLookup: (patch: { mobile?: string; dob?: string }) => void;
  runLookup: () => void;
  fillDemoMyVisits: () => void;
  clearLookup: () => void;

  setSheetDay: (iso: string) => void;
  setPatientQuery: (q: string) => void;
  openPatient: (id: string) => void;
  closePatient: () => void;
  bookThemIn: (patient: string, reason: string) => void;
  clearPrefill: () => void;

  openPanel: (ref: string | null) => void;
  advanceVisit: (ref: string) => void;
  checkIn: (ref: string) => void;
  markNoShow: (ref: string) => void;

  askCancel: (ref: string | null) => void;
  confirmCancel: () => void;
  reschedule: (ref: string) => void;

  openCard: (what: string | null) => void;
  payCard: () => void;
  payAtDesk: () => void;

  openPayPopover: (chargeId: string | null) => void;
  recordPayment: (chargeId: string, amount: number, method: PayMethod) => void;

  toast: (text: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
  escape: () => void;
  reset: () => void;
}

let toastSeq = 0;
let paymentSeq = 0;

/** The home view for each persona — a patient never lands on the day sheet. */
function homeView(persona: Persona): View {
  return persona === "clinic" ? "daysheet" : "find";
}

export const useStore = create<State>((set, get) => ({
  view: "find",
  persona: "patient",

  theme: "light",
  navOpen: false,
  dockOpen: true,
  overlayOpen: false,

  now: source.now(),

  appts: source.appointments(),
  charges: source.charges(),
  payments: source.payments(),
  walkIns: {},

  draft: freshDraft(source.now()),
  confirmedRef: null,
  confirmedPaid: false,
  refSeq: NEXT_REF,

  lookupMobile: "",
  lookupDob: "",
  lookedUp: null,
  lookupMissed: false,

  sheetDay: source.now().date,
  patientQuery: "",
  openPatientId: null,
  prefill: null,

  panelRef: null,
  cancelRef: null,
  payChargeId: null,
  cardFor: null,

  toasts: [],

  /**
   * Every view change scrolls back to the top (house layout rule 3) and closes
   * the mobile nav, so a reader opening a patient lands on their header rather
   * than halfway down the previous screen.
   */
  go: (view) => {
    /* Clearing the open patient matters: without it the Patients nav item
     * would land back on whoever was last opened rather than on the list. */
    set({ view, navOpen: false, overlayOpen: false, panelRef: null, openPatientId: null });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  /*
   * Switching persona lands on that persona's home view rather than keeping the
   * current one: a patient arriving on the waiting board would be looking at
   * other people's names.
   */
  setPersona: (persona) => {
    set({
      persona,
      view: homeView(persona),
      navOpen: false,
      panelRef: null,
      overlayOpen: false,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  initTheme: () => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch {
      // Storage disabled — fall back to the OS preference.
    }
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme: Theme =
      stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },

  toggleTheme: () => {
    const theme: Theme = get().theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Not remembering the choice is not a reason to refuse it.
    }
    set({ theme });
  },

  setNavOpen: (navOpen) => set({ navOpen, overlayOpen: navOpen }),
  setDockOpen: (dockOpen) => set({ dockOpen }),

  /**
   * The only thing in the app that moves time.
   *
   * One tap re-derives every waiting chip, opens the no-show window on whoever
   * has just crossed fifteen minutes, and greys out the slots that have gone —
   * all of which fall out of the engine reading the new `now`, with nothing
   * stored to update. Past midnight it rolls to the next day rather than
   * pretending the clock stands still at 23:59.
   */
  advanceClock: () => {
    const { now } = get();
    const raw = now.minutes + 15;
    const next: Now =
      raw >= 1440
        ? { date: addDays(now.date, 1), minutes: raw - 1440 }
        : { date: now.date, minutes: raw };
    set({ now: next });
    get().toast(t("chrome.toast.clock", { time: hhmm(next.minutes) }), "info");
  },

  /* ------------------------------------------------------- booking flow */

  /*
   * Changing the reason for the visit changes the length, which can strand a
   * slot that no longer fits — so picking a new reason clears the chosen time
   * rather than quietly carrying a start that the grid would no longer offer.
   */
  setDraft: (patch) => {
    const draft = get().draft;
    const resets =
      patch.type !== undefined || patch.clinician !== undefined || patch.day !== undefined;
    set({
      draft: {
        ...draft,
        ...patch,
        ...(resets ? { start: null, slotClinician: null } : {}),
      },
    });
  },

  pickSlot: (slotClinician, start) =>
    set({ draft: { ...get().draft, start, slotClinician } }),

  /**
   * The returning-patient lookup. Mobile and date of birth together, because
   * either alone would eventually match the wrong person.
   */
  lookupDraft: () => {
    const { draft } = get();
    const digits = draft.mobile.replace(/\D/g, "");
    const hit =
      digits.length > 0 && draft.dob.length > 0
        ? PATIENTS.find((p) => p.mobile.replace(/\D/g, "") === digits && p.dob === draft.dob)
        : undefined;
    set({
      draft: {
        ...draft,
        matched: hit?.id ?? null,
        lookupMissed: hit === undefined,
      },
    });
  },

  fillDemoLookup: () =>
    set({
      draft: {
        ...get().draft,
        mobile: DEMO_LOOKUP.mobile,
        dob: DEMO_LOOKUP.dob,
        matched: null,
        lookupMissed: false,
      },
    }),

  /**
   * Mint the booking.
   *
   * A first-time visitor gets an id that is not in the seed, and their name goes
   * into `walkIns` rather than into `PATIENTS` — the patient list is reference
   * data the desk maintains, not something a booking form writes to.
   */
  book: () => {
    const { draft, appts, refSeq, walkIns } = get();
    if (draft.start === null || draft.slotClinician === null) return;

    const ref = `RH-${refSeq}`;
    const patientId = draft.matched ?? `walkin-${refSeq}`;
    const reason = draft.reason.trim();

    const appt: Appointment = {
      id: ref,
      patient: patientId,
      clinician: draft.slotClinician,
      type: draft.type,
      date: draft.day,
      start: draft.start,
      status: "booked",
      checkedInAt: null,
      /* Literal text, not a key: `label()` returns an unknown key unchanged,
       * which is the seam between translated fiction and what a reader typed. */
      reason: reason.length > 0 ? reason : visitTypeById(VISIT_TYPES, draft.type).label,
      deskNote: draft.deskNote.trim().length > 0 ? draft.deskNote.trim() : null,
      recallWeeks: null,
    };

    set({
      appts: [...appts, appt],
      refSeq: refSeq + 1,
      confirmedRef: ref,
      confirmedPaid: false,
      view: "confirm",
      walkIns:
        draft.matched === null && draft.name.trim().length > 0
          ? { ...walkIns, [patientId]: draft.name.trim() }
          : walkIns,
      /* The lookup on My visits is pre-armed with whoever just booked, so the
       * "see my visits" link does not ask for details they gave a screen ago. */
      lookupMobile: draft.mobile,
      lookupDob: draft.dob,
      lookedUp: draft.matched,
      lookupMissed: false,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
    get().toast(t("chrome.toast.booked", { ref }), "pos");
  },

  /* ---------------------------------------------------------- my visits */

  setLookup: (patch) =>
    set({
      lookupMobile: patch.mobile ?? get().lookupMobile,
      lookupDob: patch.dob ?? get().lookupDob,
      lookupMissed: false,
    }),

  runLookup: () => {
    const { lookupMobile, lookupDob } = get();
    const digits = lookupMobile.replace(/\D/g, "");
    const hit =
      digits.length > 0 && lookupDob.length > 0
        ? PATIENTS.find((p) => p.mobile.replace(/\D/g, "") === digits && p.dob === lookupDob)
        : undefined;
    set({ lookedUp: hit?.id ?? null, lookupMissed: hit === undefined });
  },

  fillDemoMyVisits: () =>
    set({
      lookupMobile: DEMO_LOOKUP.mobile,
      lookupDob: DEMO_LOOKUP.dob,
      lookupMissed: false,
    }),

  clearLookup: () =>
    set({ lookedUp: null, lookupMobile: "", lookupDob: "", lookupMissed: false }),

  /* -------------------------------------------------------------- clinic */

  setSheetDay: (sheetDay) => set({ sheetDay, panelRef: null, overlayOpen: false }),
  setPatientQuery: (patientQuery) => set({ patientQuery }),

  openPatient: (id) => {
    set({
      openPatientId: id,
      view: "patients",
      navOpen: false,
      panelRef: null,
      overlayOpen: false,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  closePatient: () => {
    set({ openPatientId: null });
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  /**
   * "Book them in" from a recall row. The day sheet opens on today with the
   * patient and reason carried across, so the receptionist picks a time rather
   * than retyping who it is for.
   */
  bookThemIn: (patient, reason) => {
    set({
      prefill: { patient, reason },
      view: "daysheet",
      sheetDay: get().now.date,
      navOpen: false,
      overlayOpen: false,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
    get().toast(
      t("chrome.toast.prefilled", { name: patientName(patient, get().walkIns[patient] ?? null) }),
      "info",
    );
  },

  clearPrefill: () => set({ prefill: null }),

  /* ------------------------------------------------------------ overlays */

  openPanel: (panelRef) => set({ panelRef, overlayOpen: panelRef !== null }),

  /**
   * One step along the state machine. Reaching `done` means they have left, so
   * the card comes off the board — which is why the last button says so.
   */
  advanceVisit: (ref) => {
    const { appts, now } = get();
    const appt = appts.find((a) => a.id === ref);
    if (!appt) return;

    const status: VisitStatus = nextStatus(appt.status);
    if (status === appt.status) return;

    set({
      appts: appts.map((a) =>
        a.id === ref
          ? {
              ...a,
              status,
              /* Arriving stamps the clock the waiting chip counts from. */
              checkedInAt: status === "checked_in" ? now.minutes : a.checkedInAt,
            }
          : a,
      ),
    });

    const name = patientName(appt.patient, get().walkIns[appt.patient] ?? null);
    get().toast(
      status === "done"
        ? t("chrome.toast.left", { name })
        : t("chrome.toast.advanced", { name, status: t(STATUS_KEY[status]) }),
      "pos",
    );
  },

  checkIn: (ref) => {
    const { appts, now } = get();
    const appt = appts.find((a) => a.id === ref);
    if (!appt) return;
    set({
      appts: appts.map((a) =>
        a.id === ref ? { ...a, status: "checked_in", checkedInAt: now.minutes } : a,
      ),
      panelRef: null,
      overlayOpen: false,
    });
    get().toast(
      t("chrome.toast.checkedIn", {
        name: patientName(appt.patient, get().walkIns[appt.patient] ?? null),
      }),
      "pos",
    );
  },

  markNoShow: (ref) => {
    const { appts } = get();
    const appt = appts.find((a) => a.id === ref);
    if (!appt) return;
    set({
      appts: appts.map((a) => (a.id === ref ? { ...a, status: "no_show" } : a)),
      panelRef: null,
      overlayOpen: false,
    });
    get().toast(
      t("chrome.toast.noShow", {
        name: patientName(appt.patient, get().walkIns[appt.patient] ?? null),
      }),
      "danger",
    );
  },

  askCancel: (cancelRef) => set({ cancelRef, overlayOpen: cancelRef !== null }),

  /**
   * Cancelling inside 24 hours is allowed but recorded: the visit carries a
   * `lateCancel` flag afterwards and the card says so. Refusing the cancel would
   * only mean the person does not turn up.
   */
  confirmCancel: () => {
    const { appts, cancelRef, now } = get();
    if (cancelRef === null) return;
    const appt = appts.find((a) => a.id === cancelRef);
    if (!appt) return;

    const late = isLateCancel(appt, now);
    set({
      appts: appts.map((a) =>
        a.id === cancelRef ? { ...a, status: "cancelled", lateCancel: late } : a,
      ),
      cancelRef: null,
      panelRef: null,
      overlayOpen: false,
    });
    get().toast(
      late
        ? t("chrome.toast.lateCancelled", { ref: cancelRef })
        : t("chrome.toast.cancelled", { ref: cancelRef }),
      late ? "danger" : "info",
    );
  },

  /** Rescheduling is a new booking with the old one's shape carried over. */
  reschedule: (ref) => {
    const { appts, now } = get();
    const appt = appts.find((a) => a.id === ref);
    if (!appt) return;
    set({
      draft: {
        ...freshDraft(now),
        type: appt.type,
        clinician: appt.clinician,
        day: now.date,
        returning: true,
        matched: appt.patient,
        reason: label(appt.reason),
      },
      view: "find",
      overlayOpen: false,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
    get().toast(
      t("chrome.toast.reschedule", {
        name: patientName(appt.patient, get().walkIns[appt.patient] ?? null),
      }),
      "info",
    );
  },

  /* ------------------------------------------------------------ payments */

  openCard: (cardFor) => set({ cardFor, overlayOpen: cardFor !== null }),

  /**
   * The card sheet's only outcome. `"booking"` settles the visit that was just
   * confirmed; anything else is a charge id from the accounts view or a past
   * visit on My visits.
   */
  payCard: () => {
    const { cardFor, charges, payments, confirmedRef, appts } = get();
    if (cardFor === null) return;

    if (cardFor === "booking") {
      const appt = appts.find((a) => a.id === confirmedRef);
      const fee = appt ? visitTypeById(VISIT_TYPES, appt.type).fee : 0;
      set({ cardFor: null, overlayOpen: false, confirmedPaid: true });
      get().toast(t("chrome.toast.paid", { amount: money(fee) }), "pos");
      return;
    }

    const charge = charges.find((c) => c.id === cardFor);
    if (!charge) return set({ cardFor: null, overlayOpen: false });
    const due = balanceOf(charge, payments);
    paymentSeq += 1;
    set({
      payments: [
        ...payments,
        {
          id: `new-p${paymentSeq}`,
          charge: charge.id,
          amount: due,
          method: "card",
          date: get().now.date,
        },
      ],
      cardFor: null,
      overlayOpen: false,
    });
    get().toast(t("chrome.toast.paid", { amount: money(due) }), "pos");
  },

  payAtDesk: () => {
    set({ confirmedPaid: false });
    get().toast(t("chrome.toast.atdesk"), "info");
  },

  openPayPopover: (payChargeId) => set({ payChargeId }),

  /**
   * The desk's own record-payment path. The engine refuses an overpayment and
   * hands back the maximum instead of clamping, so the popover can say what the
   * limit is rather than silently taking less than the reader typed.
   */
  recordPayment: (chargeId, amount, method) => {
    const { charges, payments, now } = get();
    const charge = charges.find((c) => c.id === chargeId);
    if (!charge) return;

    const check = checkPayment(charge, payments, amount);
    if (!check.ok) {
      get().toast(
        check.reason === "overpay"
          ? t("pay.overpay", { amount: money(check.max) })
          : t("pay.nonpositive"),
        "danger",
      );
      return;
    }

    paymentSeq += 1;
    set({
      payments: [
        ...payments,
        {
          id: `new-p${paymentSeq}`,
          charge: chargeId,
          amount: check.amount,
          method,
          date: now.date,
        },
      ],
      payChargeId: null,
    });
    get().toast(
      t("chrome.toast.payment", {
        amount: money(check.amount),
        name: patientName(charge.patient, get().walkIns[charge.patient] ?? null),
      }),
      "pos",
    );
  },

  /* --------------------------------------------------------------- toasts */

  toast: (text, tone = "info") => {
    toastSeq += 1;
    const id = toastSeq;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    window.setTimeout(() => get().dismissToast(id), 3600);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),

  /**
   * The document-level Escape handler. Overlays close outermost-first so one
   * press does one thing rather than dismissing the whole stack.
   */
  escape: () => {
    const s = get();
    if (s.cardFor !== null) return set({ cardFor: null, overlayOpen: false });
    if (s.cancelRef !== null) return set({ cancelRef: null, overlayOpen: false });
    if (s.payChargeId !== null) return set({ payChargeId: null });
    if (s.panelRef !== null) return set({ panelRef: null, overlayOpen: false });
    if (s.navOpen) return set({ navOpen: false, overlayOpen: false });
  },

  reset: () => {
    const now = source.now();
    set({
      now,
      appts: source.appointments(),
      charges: source.charges(),
      payments: source.payments(),
      walkIns: {},
      draft: freshDraft(now),
      confirmedRef: null,
      confirmedPaid: false,
      refSeq: NEXT_REF,
      lookupMobile: "",
      lookupDob: "",
      lookedUp: null,
      lookupMissed: false,
      sheetDay: now.date,
      patientQuery: "",
      openPatientId: null,
      prefill: null,
      panelRef: null,
      cancelRef: null,
      payChargeId: null,
      cardFor: null,
      overlayOpen: false,
      view: homeView(get().persona),
    });
    window.scrollTo({ top: 0, behavior: "auto" });
    get().toast(t("chrome.toast.reset"), "info");
  },
}));

/** The dock's mono clock readout. */
export function clockLabel(now: Now): string {
  return clock(now.minutes);
}
