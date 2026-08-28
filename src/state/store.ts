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

import { useMemo } from "react";
import { create } from "zustand";

import { source } from "../data/source.ts";
import { ADDRESS, DEMO_LOOKUP, NEXT_REF, STAFF } from "../data/demo.ts";
import { addOnClosures, mergeClosures, DAY_SOURCES } from "../add-ons/closures.ts";
import {
  applyAddOnSettings,
  createRegistry,
  defaultSettingsFor,
  type AddOn,
  type AddOnRegistry,
  type AddOnSettings,
} from "../add-ons/vendor/host/index.ts";
import type {
  Appointment,
  Charge,
  Clinician,
  Closure,
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
import { STATUS_KEY, clock, dateLong, label, money } from "../lib/format.ts";
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
  /**
   * THE PRACTICE'S OWN closing days — the rows a person here entered.
   *
   * An add-on's days are NOT in here and never will be. They live in that
   * add-on's own values (`addOnSettings`), are read through its own function,
   * and are merged into one list at the point of use by `useClosures`. Copying
   * them into this array is the one shortcut that would break every promise
   * this seam makes at once: an operator could then delete a row an add-on
   * owns, a disconnect would either destroy data or leave orphans, and a
   * re-import would have to reconcile against rows it did not write.
   */
  closures: Closure[];
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

  /* --- add-ons --- */
  /**
   * The five things the seam needs from a store, and the one rule.
   *
   * `registry` starts EMPTY and is filled by `registerAddOns` at bootstrap
   * rather than being built here from the add-on list. That is not a detail:
   * every screen imports this store, so building the registry at store-init
   * would put every add-on bundle in every screen's module graph — and it would
   * make the seam impossible to land before an add-on exists, which is exactly
   * the state a retrofit has to be reviewable in.
   */
  registry: AddOnRegistry;
  /** Which add-ons are switched on. Nothing is, until somebody connects one. */
  enabled: Set<string>;
  /**
   * Which add-ons have supplied a credential.
   *
   * SEPARATE FROM `enabled` BECAUSE THEY ARE DIFFERENT FACTS, and this app is
   * the awkward case that proves it rather than the one that demonstrates it:
   * the one add-on it hosts declares `connect: "none"`, so connecting it adds
   * nothing here and this set stays empty. It exists anyway because
   * `disconnectAddOn` promises two things — the surfaces go, the data stays —
   * and an app with one set cannot say which of the two it did. The day a
   * credentialled add-on is vendored here, the promise is already implemented.
   */
  credentialled: Set<string>;
  /** Each add-on's saved values, keyed by add-on key and opaque to this app. */
  addOnSettings: AddOnSettings;

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
  /** Theme pushed by the Adminium host frame; never persisted (29 D8). */
  setHostTheme: (theme: Theme) => void;
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

  /** Replace the registry, and push everyone their saved values. */
  registerAddOns: (addOns: readonly AddOn[]) => void;
  toggleAddOn: (key: string) => void;
  connectAddOn: (key: string) => void;
  disconnectAddOn: (key: string) => void;
  patchAddOnSettings: (addOn: string, patch: Record<string, unknown>) => void;

  /** Record a day the practice will be shut. Refuses a duplicate of its own. */
  addClosure: (date: string, reason: string, clinician: string | null) => boolean;
  /** Drop one of the practice's OWN closing days. Cannot reach an add-on's. */
  removeClosure: (date: string, reason: string) => void;

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
  closures: source.closures(),
  walkIns: {},

  registry: createRegistry([]),
  enabled: new Set<string>(),
  credentialled: new Set<string>(),
  /*
   * EMPTY, AND FILLED BY `registerAddOns` — because this file must not import
   * the add-on list.
   *
   * The obvious spelling is `defaultSettingsFor(demoAddOns())` right here, and
   * it costs the whole bundle split: every screen imports this store, so a
   * store that named the add-on list would put every add-on's settings panel in
   * every screen's module graph. `registerAddOns` seeds the defaults from the
   * add-ons it is handed instead, which is the same information arriving from
   * the one place that is allowed to know it.
   */
  addOnSettings: {},

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

  /*
   * The HOST owns the theme while blended: it is the dashboard's setting, not
   * this app's, so this does not write the app's own storage key. Persisting it
   * would leave the app stuck in the host's theme after it is opened
   * standalone.
   */
  setHostTheme: (theme) => {
    if (get().theme === theme) return;
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

  /* ------------------------------------------------------------- add-ons */

  registerAddOns: (addOns) => {
    /*
     * Defaults first, then whatever is already saved — so registering twice, or
     * registering after somebody has changed a value, cannot reset it. An
     * add-on's defaults are the value it starts from and never a value it goes
     * back to.
     */
    const addOnSettings: AddOnSettings = { ...defaultSettingsFor(addOns), ...get().addOnSettings };
    set({ registry: createRegistry(addOns), addOnSettings });
    applyAddOnSettings(addOns, addOnSettings);
  },

  toggleAddOn: (key) => {
    if (get().enabled.has(key)) get().disconnectAddOn(key);
    else get().connectAddOn(key);
  },

  connectAddOn: (key) =>
    set((s) => {
      const enabled = new Set(s.enabled);
      enabled.add(key);
      return { enabled };
    }),

  /**
   * DISCONNECTING TAKES THE SURFACES AND THE CREDENTIALS. IT NEVER TAKES DATA.
   *
   * ── WHAT HAPPENS TO THE DAYS, AND WHY IT IS THIS AND NOT THE OTHER ONE ────
   *
   * The add-on's saved days are untouched — `addOnSettings` is not read, not
   * cleared, not filtered. What changes is that the add-on is no longer in
   * `enabled`, so `useClosures` stops asking it, so those days stop shutting
   * the practice. Reconnect and every one of them is back, unchanged, in the
   * same order.
   *
   * THE ALTERNATIVE WAS TO KEEP APPLYING THEM, and it is worse on a clinic's
   * screens rather than merely different. A disconnected add-on has no surface:
   * no panel, no list, nothing to open. Days that went on closing the practice
   * from behind a disconnected add-on would be a rule with no page — a reader
   * looking at a shut Thursday with nothing anywhere that explains it and no
   * control that changes it. That is the shape of bug this app has a settings
   * screen to prevent.
   *
   * SO THE APP SAYS SO. `dormantDayCounts` is read by the settings screen for
   * exactly this: while an add-on is disconnected it prints how many days are
   * still saved, that they are not being applied, and the two things a reader
   * can do about it — reconnect, or enter the ones they need as the practice's
   * own. That is 25 D10: a refusal by a real rule the reader can act on, rather
   * than a silence.
   */
  disconnectAddOn: (key) =>
    set((s) => {
      const enabled = new Set(s.enabled);
      enabled.delete(key);
      const credentialled = new Set(s.credentialled);
      credentialled.delete(key);
      return { enabled, credentialled };
    }),

  /**
   * Merge a patch into ONE add-on's own values, and push the result.
   *
   * `applyAddOnSettings` on the last line is the rule: add-ons are HANDED their
   * settings and never poll for them. An add-on that read this store would be
   * coupled to this app's state shape, which is the coupling every other
   * decision in the seam exists to prevent — and one that read it on a timer
   * would be worse, because the version that works is indistinguishable from
   * the version that is one tick stale.
   *
   * The add-on this app hosts declares no `applySettings`, deliberately: its
   * engines take the values as an argument, so it has no copy to keep in step.
   * The push happens anyway, for every add-on, because the seam is written
   * about add-ons and not about the one that is here.
   */
  patchAddOnSettings: (addOn, patch) => {
    const addOnSettings: AddOnSettings = {
      ...get().addOnSettings,
      [addOn]: { ...(get().addOnSettings[addOn] ?? {}), ...patch },
    };
    set({ addOnSettings });
    applyAddOnSettings(get().registry.all, addOnSettings);
  },

  /* ------------------------------------------------------------ closures */

  /**
   * Record a day the practice will be shut.
   *
   * Refuses a date the practice has ALREADY entered at the same scope, and
   * refuses only that: adding "Stocktake" to a day an add-on has already named
   * a public holiday is a coherent thing to record, and refusing it would make
   * an imported set an obstacle rather than a starting point. It also refuses
   * an empty reason, because "the practice is shut on the fourth" with no
   * reason beside it is the row somebody comes back to in March and cannot act
   * on. Returns false so the screen can say which refusal it was.
   */
  addClosure: (date, reason, clinician) => {
    const trimmed = reason.trim();
    if (date.length === 0 || trimmed.length === 0) return false;
    if (get().closures.some((c) => c.date === date && c.clinician === clinician)) return false;
    set({
      closures: [...get().closures, { date, reason: trimmed, clinician, from: null }],
    });
    get().toast(t("chrome.toast.closureAdded", { date: dateLong(date) }), "pos");
    return true;
  },

  /**
   * Drop one of the practice's own closing days.
   *
   * THE FILTER TESTS `from === null`, AND THAT IS NOT BELT AND BRACES. Nothing
   * an add-on supplied is in `closures` to begin with — imported days live in
   * that add-on's own values and are merged at read time — so this clause can
   * never fire today. It is here because the day it CAN fire is the day
   * somebody has copied imported rows into this array, and the first symptom
   * would be a delete button that appears to work and un-deletes itself on the
   * next render. A predicate that states the rule is how that arrives as an
   * unreachable branch rather than as a bug report.
   */
  removeClosure: (date, reason) =>
    set((s) => ({
      closures: s.closures.filter(
        (c) => !(c.from === null && c.date === date && c.reason === reason),
      ),
    })),

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
      closures: source.closures(),
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

/**
 * EVERY DAY THE PRACTICE DOES NOT WORK — its own, and the add-ons'.
 *
 * ── THIS IS THE MOUNT SITE, AND IT IS A HOOK RATHER THAN A STORE FIELD ─────
 *
 * The merged list is DERIVED, and this app's rule is that derived things are
 * computed at render time from what lives in the store, never stored beside it
 * — a stored copy is a copy to keep in step, and the five actions that can
 * change this one are five chances to forget. So it is computed here.
 *
 * The five inputs are selected SEPARATELY and the merge is memoised on them.
 * That is not style: a zustand selector returning a fresh array on every call
 * compares unequal to itself, so `useStore((s) => merge(...))` re-renders for
 * ever. Each selector below returns a field the store already holds, so each is
 * reference-stable until something actually changes it.
 *
 * ── WHAT IT MEANS FOR A SCREEN ─────────────────────────────────────────────
 *
 * A screen asks for closures and gets one list. It does not know, and must not
 * ask, which rows came from where — except to LABEL them, which is what `from`
 * is for. That is what makes the whole retrofit reversible: with nothing
 * connected the list is the practice's own rows and nothing else, which in the
 * demo is the empty array `db/seed.sql` seeds, and every screen behaves exactly
 * as it did before this seam existed.
 */
export function useClosures(): Closure[] {
  const own = useStore((s) => s.closures);
  const enabled = useStore((s) => s.enabled);
  const addOnSettings = useStore((s) => s.addOnSettings);
  return useMemo(
    () => mergeClosures(own, addOnClosures(DAY_SOURCES, enabled, addOnSettings)),
    [own, enabled, addOnSettings],
  );
}
