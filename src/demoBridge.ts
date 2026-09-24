/**
 * The demo's side of the website card's protocol (`demo-types.ts`): the card
 * picks a side and a screen, runs a screen's shortcuts, sets the language and
 * the theme, moves the clock; this answers with the app's state after every
 * change — which screen, which side, the clock as the card should print it,
 * and whether a sheet or dialog is covering the page (the card hides then).
 *
 * Only the demo build contains this file (`DEMO` folds it away), and only a
 * page framed by the website's own origin speaks it.
 */
import { DEMO_APP_KEY, DEMO_SCREENS, type DemoShortcutId } from "./demo-card.ts";
import { DEMO_PROTOCOL_VERSION, isDemoMessage, type DemoMessage } from "./demo-types.ts";
import { DEMO_FILLS } from "./data/demo.ts";
import { setHostLocale } from "./i18n/index.tsx";
import { isLocaleTag } from "./i18n/locales.ts";
import { locale as currentLocale, t } from "./i18n/ambient.ts";
import { dayOf, dayShort, time } from "./lib/format.ts";
import { now, today } from "./lib/clock.ts";
import { DEMO_CODE, demoRace } from "./demo/ports.ts";
import { scanReminders, type DemoDb } from "./demo/db.ts";
import type { Id, View } from "./data/types.ts";
import { resync } from "./state/live.ts";
import { loadCatalogue, usePatients } from "./state/patients.ts";
import { sendDemoSignal } from "./state/demoSignal.ts";
import { go, overlayOpen, setPersona, toast, useUi } from "./state/ui.ts";
import { instantOf } from "./data/publicPatients.ts";

interface Bridge {
  db: DemoDb;
  clock: { now: () => number; advance: (minutes: number) => void; reset: () => void };
  /** The practice's words in another language; true when any changed. */
  relabel: (locale: string) => boolean;
}

/** The page's language, and the demo practice's words with it. */
function language(bridge: Bridge, tag: string): void {
  setHostLocale(tag);
  if (isLocaleTag(tag) && bridge.relabel(tag)) void changed();
}

/** The card's screen for what is showing. */
export function currentScreen(): string {
  const { view, persona } = useUi.getState();
  if (view === "notfound") return persona === "patient" ? "patient-404" : "desk-404";
  return DEMO_SCREENS.find((s) => s.view === view)?.id ?? view;
}

export function goToScreen(id: string): void {
  const screen = DEMO_SCREENS.find((s) => s.id === id);
  if (screen === undefined) return;
  if (useUi.getState().persona !== screen.persona) setPersona(screen.persona);
  go(screen.view as View);
}

/**
 * The demo's own practice changed under a shortcut: the desk hears of each
 * row through the live path already; this also re-reads the patients' side and
 * anything a whole-table change (a setting) moves.
 */
async function changed(): Promise<void> {
  await Promise.all([resync(), loadCatalogue()]);
}

function shortcuts(bridge: Bridge): Record<DemoShortcutId, () => void> {
  const { db } = bridge;
  const setBooking = (on: boolean) => {
    const settings = db.rows.settings[0];
    if (settings !== undefined) db.update("settings", settings.id, { online_booking_on: on }, { origin: "desk", name: null });
    void changed();
  };
  const fill = (target: string) => sendDemoSignal(target);
  return {
    "first-open": () => fill("find.firstOpen"),
    "booking-off": () => setBooking(false),
    "booking-on": () => setBooking(true),
    returning: () => sendDemoSignal("details.fill", { mode: "returning", mobile: DEMO_FILLS.returning.mobile, bornOn: DEMO_FILLS.returning.bornOn }),
    "first-visit": () =>
      sendDemoSignal("details.fill", {
        mode: "first",
        name: DEMO_FILLS.firstVisit.name,
        bornOn: DEMO_FILLS.firstVisit.bornOn,
        mobile: DEMO_FILLS.firstVisit.mobile,
        email: DEMO_FILLS.firstVisit.email,
      }),
    // Another patient books the very time chosen, so "Book this time" meets "that time has just gone".
    "take-this-time": () => {
      const { day, time: hhmm, typeId, clinicianId } = usePatients.getState();
      if (day === null || hhmm === null || typeId === null) return;
      const other = db.rows.patients.find((p) => p.name !== DEMO_FILLS.returning.name) ?? db.rows.patients[0];
      const startsAt = instantOf(day, hhmm, db.zone);
      const who = clinicianId === "any" ? null : clinicianId;
      try {
        db.insert("appointments", { patient_id: other?.id ?? null, visit_type_id: typeId, clinician_id: who, starts_at: startsAt, channel: "phone" }, { origin: "desk", name: "Demo" });
        toast(t("demo.toast.taken"), { icon: "calendar-x", tone: "warn" });
      } catch {
        // Already taken: nothing to do.
      }
      void changed();
    },
    "sample-visit": () => sendDemoSignal("confirm.sampleVisit", { mobile: DEMO_FILLS.returning.mobile, bornOn: DEMO_FILLS.returning.bornOn }),
    "fill-leila": () => sendDemoSignal("visits.fill", { mobile: DEMO_FILLS.withVisits.mobile, bornOn: DEMO_FILLS.withVisits.bornOn }),
    "fill-code": () => sendDemoSignal("code.fill", { code: DEMO_CODE }),
    "shared-number": () => sendDemoSignal("visits.fill", { mobile: DEMO_FILLS.sharedNumber.mobile, bornOn: DEMO_FILLS.sharedNumber.bornOn }),
    "prefs-fill-leila": () => sendDemoSignal("prefs.fill", { mobile: DEMO_FILLS.withVisits.mobile, bornOn: DEMO_FILLS.withVisits.bornOn }),
    "prefs-fill-code": () => sendDemoSignal("code.fill", { code: DEMO_CODE }),
    "fill-new-patient": () =>
      sendDemoSignal("register.fill", {
        name: DEMO_FILLS.register.name,
        bornOn: DEMO_FILLS.register.bornOn,
        mobile: DEMO_FILLS.register.mobile,
        email: DEMO_FILLS.register.email,
        address: DEMO_FILLS.register.address,
        contact: DEMO_FILLS.register.contact,
      }),
    "place-recall": () => fill("daysheet.placeRecall"),
    "jump-to-now": () => fill("daysheet.jumpToNow"),
    race: () => {
      demoRace.next = true;
      toast(t("demo.toast.race"), { icon: "timer" });
    },
    // The first booked visit still to arrive walks in.
    "someone-arrives": () => {
      const day = today();
      const due = db.rows.appointments
        .filter((a) => a.status === "booked" && dayOf(a.starts_at) === day && a.patient_id !== null)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
      if (due !== undefined) db.update("appointments", due.id as Id, { status: "checked_in" }, { origin: "desk", name: "Demo" });
      void changed();
    },
    "sample-closure": () => fill("hours.sampleClosure"),
    "fill-cormac": () => sendDemoSignal("sooner.fill", { mobile: DEMO_FILLS.returning.mobile, bornOn: DEMO_FILLS.returning.bornOn }),
    // Someone whose visit today starts within the hour (or has just started) walks up to the tablet.
    "kiosk-sample": () => {
      const at = now();
      const due = db.rows.appointments
        .filter((a) => a.status === "booked" && a.patient_id !== null && Math.abs(Date.parse(a.starts_at) - at) <= 60 * 60_000)
        .sort((a, b) => Math.abs(Date.parse(a.starts_at) - at) - Math.abs(Date.parse(b.starts_at) - at))[0];
      const who = due === undefined ? undefined : db.rows.patients.find((p) => p.id === due.patient_id);
      if (who === undefined) {
        toast(t("demo.toast.nobodyDue"), { icon: "info" });
        return;
      }
      sendDemoSignal("kiosk.fill", { mobile: who.mobile, bornOn: who.born_on });
    },
    "part-payment": () => fill("accounts.partPayment"),
  };
}

function stateMessage(): DemoMessage {
  const ui = useUi.getState();
  return {
    type: "adminium:demo:state",
    dv: DEMO_PROTOCOL_VERSION,
    screen: currentScreen(),
    persona: ui.persona,
    mode: null,
    online: true,
    toggles: {},
    locale: currentLocale(),
    theme: ui.theme,
    clockLabel: `${dayShort(today())} · ${time(now())}`,
    overlay: overlayOpen(ui),
  };
}

export function applyDemoMessage(message: DemoMessage, bridge: Bridge): void {
  switch (message.type) {
    case "adminium:demo:init":
      language(bridge, message.locale);
      useUi.setState({ theme: message.theme });
      if (message.persona === "patient" || message.persona === "clinic") setPersona(message.persona);
      if (message.screen !== undefined) goToScreen(message.screen);
      return;
    case "adminium:demo:go":
      goToScreen(message.screen);
      return;
    case "adminium:demo:do": {
      const run = (shortcuts(bridge) as Record<string, (() => void) | undefined>)[message.shortcut];
      run?.();
      return;
    }
    case "adminium:demo:set":
      if (message.theme !== undefined) useUi.setState({ theme: message.theme });
      if (message.locale !== undefined) language(bridge, message.locale);
      if (message.persona === "patient" || message.persona === "clinic") setPersona(message.persona);
      return;
    case "adminium:demo:clock":
      bridge.clock.advance(15);
      scanReminders(bridge.db);
      toast(t("demo.toast.clock", { time: time(now()) }), { icon: "fast-forward" });
      void resync();
      return;
    case "adminium:demo:reset":
      // Everything back as it was: the sample practice, the pinned morning.
      window.location.reload();
      return;
    default:
      return;
  }
}

export function startDemoBridge(bridge: Bridge): () => void {
  if (typeof window === "undefined" || window.parent === window) return () => {};
  const origin = window.location.origin;
  const parent = window.parent;
  const post = (message: DemoMessage) => parent.postMessage(message, origin);
  let last = "";
  const report = () => {
    const message = stateMessage();
    const text = JSON.stringify(message);
    if (text === last) return;
    last = text;
    post(message);
  };
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== origin || event.source !== parent || !isDemoMessage(event.data)) return;
    applyDemoMessage(event.data, bridge);
    report();
    setTimeout(report, 50);
    if (event.data.type === "adminium:demo:init") {
      setTimeout(report, 400);
      setTimeout(report, 1500);
    }
  };
  window.addEventListener("message", onMessage);
  const unsubscribe = [useUi.subscribe(report), usePatients.subscribe(report)];
  post({ type: "adminium:demo:hello", dv: DEMO_PROTOCOL_VERSION, appKey: DEMO_APP_KEY });
  return () => {
    window.removeEventListener("message", onMessage);
    for (const off of unsubscribe) off();
  };
}
