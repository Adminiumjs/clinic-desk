/**
 * This app's screens, as data — the one list the builds and the runtime all
 * read:
 *
 *   `App.tsx`        which components a build renders,
 *   `urlSync.ts`     which path selects which screen,
 *   `surface.json`   which rows Adminium's sidebar offers for the desk.
 *
 * Order is the sidebar's order. Icons are lucide NAMES, never components:
 * this module is read by the Vite config to write `surface.json`.
 *
 * Each desk screen lives in `src/screens/<View>.tsx` (the build gate maps a
 * staff view to exactly that file, to prove no desk screen reaches the
 * patients' bundle). The patients' pages live in `src/screens/patient/`.
 */
import type { View } from "./data/types.ts";
import type { MessageKey } from "./i18n/messages/index.ts";
import type { SurfaceNavEntry } from "./surface-types.ts";

export const APP_KEY = "clinic";

/** The sidebar section's heading when the desk sits inside Adminium. */
export const APP_LABEL_KEY: MessageKey = "nav.frontDesk";

type Entry = SurfaceNavEntry<View> & { labelKey: MessageKey };

export const SURFACE_NAV = [
  { id: "daysheet", path: "daysheet", view: "daysheet", side: "staff", icon: "calendar-days", labelKey: "nav.daysheet" },
  { id: "waiting", path: "waiting", view: "waiting", side: "staff", icon: "armchair", labelKey: "nav.waiting" },
  { id: "patients", path: "patients", view: "patients", side: "staff", icon: "users", labelKey: "nav.patients" },
  { id: "registrations", path: "registrations", view: "registrations", side: "staff", icon: "inbox", labelKey: "nav.registrations" },
  { id: "week", path: "week", view: "week", side: "staff", icon: "calendar-range", labelKey: "nav.week" },
  { id: "waitlist", path: "waiting-list", view: "waitlist", side: "staff", icon: "list-ordered", labelKey: "nav.waitlist" },
  { id: "accounts", path: "accounts", view: "accounts", side: "staff", icon: "wallet", labelKey: "nav.accounts" },
  { id: "recalls", path: "recalls", view: "recalls", side: "staff", icon: "bell-ring", labelKey: "nav.recalls" },
  { id: "hours", path: "hours", view: "hours", side: "staff", icon: "clock", labelKey: "nav.hours" },
  { id: "outbox", path: "outbox", view: "outbox", side: "staff", icon: "send", labelKey: "nav.outbox" },
  { id: "endofday", path: "end-of-day", view: "endofday", side: "staff", icon: "moon-star", labelKey: "nav.endofday" },
  { id: "settings", path: "settings", view: "settings", side: "staff", icon: "settings-2", labelKey: "nav.settings" },
  /*
   * The patients' first page takes the EMPTY path: a practice's own domain
   * serves this side at `/`, and booking is what someone arriving there came
   * to do.
   */
  { id: "book", path: "", view: "find", side: "customer", labelKey: "nav.book" },
  { id: "team", path: "clinicians", view: "team", side: "customer", labelKey: "nav.team" },
  { id: "visits", path: "my-visits", view: "visits", side: "customer", labelKey: "nav.visits" },
  { id: "findus", path: "find-us", view: "findus", side: "customer", labelKey: "nav.findus" },
  { id: "prices", path: "prices", view: "prices", side: "customer", labelKey: "nav.prices" },
  { id: "sooner", path: "earlier-times", view: "sooner", side: "customer", labelKey: "nav.sooner" },
  { id: "prefs", path: "reminders", view: "prefs", side: "customer", labelKey: "nav.prefs" },
  { id: "register", path: "register", view: "register", side: "customer", labelKey: "nav.register" },
  { id: "faq", path: "questions", view: "faq", side: "customer", labelKey: "nav.faq" },
] as const satisfies readonly Entry[];

/**
 * Screens a side RENDERS but does not navigate to directly: a confirmation
 * without a booking is not a page anyone can link to, and the arrivals kiosk
 * is reached only by signing in with the kiosk role — never from the sidebar.
 */
export const SURFACE_EXTRAS = {
  staff: ["kiosk", "notfound"],
  customer: ["details", "confirm", "notfound"],
} as const satisfies Record<"staff" | "customer", readonly View[]>;

export type StaffView =
  | Extract<(typeof SURFACE_NAV)[number], { side: "staff" }>["view"]
  | (typeof SURFACE_EXTRAS)["staff"][number];

export type CustomerView =
  | Extract<(typeof SURFACE_NAV)[number], { side: "customer" }>["view"]
  | (typeof SURFACE_EXTRAS)["customer"][number];
