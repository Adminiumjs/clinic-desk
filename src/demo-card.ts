/**
 * What the website's demo card offers for this app — written into `demo.json`
 * beside the demo build (`demo-emit.ts`, wired in `vite.config.ts`).
 *
 * Two sides, the patients' pages and the desk, each with its own screens; the
 * card shows only the current side's. Each screen may carry shortcuts that
 * act on it ("Returning patient", "Someone takes this time"). The clock row
 * moves the demo's pinned Tuesday on by fifteen minutes and puts it back.
 *
 * Labels are message keys (`i18n/strings/demo.ts`), written out in all eight
 * languages. Icons are lucide names.
 */
import type { DemoFrame } from "./demo-types.ts";

export const DEMO_APP_KEY = "clinic";
export const DEMO_DIR = "clinic-desk";

export interface DemoCardShortcut {
  id: string;
  icon: string;
  labelKey: string;
}

export interface DemoCardScreen {
  id: string;
  view: string;
  icon: string;
  labelKey: string;
  side?: "staff" | "customer";
  persona: "patient" | "clinic";
  shortcuts?: DemoCardShortcut[];
}

export const DEMO_FRAMES: DemoFrame[] = ["desktop", "phone"];

export const DEMO_PERSONAS = [
  { id: "patient", icon: "user-round", labelKey: "demo.persona.patient" },
  { id: "clinic", icon: "clipboard-list", labelKey: "demo.persona.clinic" },
];

const patient = (id: string, icon: string, shortcuts?: DemoCardShortcut[]): DemoCardScreen => ({
  id,
  view: id,
  icon,
  labelKey: `demo.screen.${id}`,
  side: "customer",
  persona: "patient",
  ...(shortcuts === undefined ? {} : { shortcuts }),
});
const desk = (id: string, icon: string, shortcuts?: DemoCardShortcut[]): DemoCardScreen => ({
  id,
  view: id,
  icon,
  labelKey: `demo.screen.${id}`,
  side: "staff",
  persona: "clinic",
  ...(shortcuts === undefined ? {} : { shortcuts }),
});

export const DEMO_SCREENS: DemoCardScreen[] = [
  patient("find", "calendar-search", [
    { id: "first-open", icon: "wand-sparkles", labelKey: "demo.do.firstOpen" },
    { id: "booking-off", icon: "power-off", labelKey: "demo.do.bookingOff" },
    { id: "booking-on", icon: "power", labelKey: "demo.do.bookingOn" },
  ]),
  patient("details", "user-round-pen", [
    { id: "returning", icon: "user-round", labelKey: "demo.do.returning" },
    { id: "first-visit", icon: "user-plus", labelKey: "demo.do.firstVisit" },
    { id: "take-this-time", icon: "calendar-x", labelKey: "demo.do.takeThisTime" },
  ]),
  patient("confirm", "calendar-check", [{ id: "sample-visit", icon: "calendar-plus", labelKey: "demo.do.sampleVisit" }]),
  patient("visits", "history", [
    { id: "fill-leila", icon: "wand-sparkles", labelKey: "demo.do.fillLeila" },
    { id: "fill-code", icon: "key-round", labelKey: "demo.do.fillCode" },
    { id: "shared-number", icon: "users", labelKey: "demo.do.sharedNumber" },
  ]),
  patient("team", "stethoscope"),
  patient("findus", "map-pin"),
  patient("prices", "receipt"),
  patient("sooner", "list-ordered", [{ id: "fill-cormac", icon: "wand-sparkles", labelKey: "demo.do.fillCormac" }]),
  patient("prefs", "bell", [
    { id: "prefs-fill-leila", icon: "wand-sparkles", labelKey: "demo.do.fillLeila" },
    { id: "prefs-fill-code", icon: "key-round", labelKey: "demo.do.fillCode" },
  ]),
  patient("register", "user-plus", [{ id: "fill-new-patient", icon: "wand-sparkles", labelKey: "demo.do.fillNewPatient" }]),
  patient("faq", "circle-help"),
  { ...patient("notfound", "file-x"), id: "patient-404" },

  desk("daysheet", "calendar-days", [
    { id: "place-recall", icon: "bell-ring", labelKey: "demo.do.placeRecall" },
    { id: "jump-to-now", icon: "locate-fixed", labelKey: "demo.do.jumpToNow" },
    { id: "race", icon: "timer", labelKey: "demo.do.race" },
  ]),
  desk("waiting", "armchair", [{ id: "someone-arrives", icon: "log-in", labelKey: "demo.do.someoneArrives" }]),
  desk("patients", "users"),
  desk("week", "calendar-range"),
  desk("waitlist", "list-ordered"),
  desk("accounts", "wallet", [{ id: "part-payment", icon: "receipt", labelKey: "demo.do.partPayment" }]),
  desk("recalls", "bell-ring"),
  desk("registrations", "inbox"),
  desk("hours", "clock", [{ id: "sample-closure", icon: "calendar-x", labelKey: "demo.do.sampleClosure" }]),
  desk("outbox", "send"),
  desk("endofday", "moon-star"),
  desk("settings", "settings-2"),
  desk("kiosk", "tablet-smartphone", [{ id: "kiosk-sample", icon: "wand-sparkles", labelKey: "demo.do.kioskSample" }]),
  { ...desk("notfound", "file-x"), id: "desk-404" },
];

export const DEMO_CLOCK = {
  advance: [{ id: "15m", labelKey: "demo.clock.advance" }],
  reset: { labelKey: "demo.clock.reset" },
};

export type DemoShortcutId = NonNullable<DemoCardScreen["shortcuts"]>[number]["id"];
