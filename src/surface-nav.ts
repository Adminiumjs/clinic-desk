/**
 * This app's screens, as data — the ONE declaration two build outputs and one
 * runtime all read (29-app-surfaces.md D7/D8).
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * `App.tsx` held the side split as two literal `SCREENS` records, and the shell
 * held a third list for the sidebar. That was fine while each had one reader.
 * The split now has three:
 *
 *   `App.tsx`         which components a build renders,
 *   `urlSync.ts`      which path selects which screen,
 *   `surface.json`    which sections Adminium's sidebar offers.
 *
 * Three copies of "the screens of this app" is three chances for a path to
 * exist in one and not another — which presents as a link that navigates
 * nowhere, or a sidebar row Adminium offers for a screen the bundle dropped.
 */

import type { View } from "./data/types.ts";
import type { MessageKey } from "./i18n/messages/index.ts";
import type { SurfaceNavEntry } from "./surface-types.ts";

export const APP_KEY = "clinic";

/** The sidebar section heading when this app is blended into Adminium. */
export const APP_LABEL_KEY: MessageKey = "chrome.brand";

type Entry = SurfaceNavEntry<View> & { labelKey: MessageKey };

/**
 * The NAVIGABLE screens — the ones that get a path, a sidebar row and a URL.
 *
 * Order is the sidebar order, and it matches `Shell.tsx`'s own list because
 * both now read this one. Icons are lucide NAMES in kebab-case, never imported
 * components: this module is read by the Vite config to emit `surface.json`,
 * and pulling the icon package into a build script would be both slow and
 * pointless.
 */
export const SURFACE_NAV = [
  {
    id: "daysheet",
    path: "daysheet",
    view: "daysheet",
    side: "staff",
    icon: "calendar-days",
    labelKey: "chrome.nav.daysheet",
  },
  {
    id: "waiting",
    path: "waiting",
    view: "waiting",
    side: "staff",
    icon: "users",
    labelKey: "chrome.nav.waiting",
  },
  {
    id: "patients",
    path: "patients",
    view: "patients",
    side: "staff",
    icon: "stethoscope",
    labelKey: "chrome.nav.patients",
  },
  {
    id: "accounts",
    path: "accounts",
    view: "accounts",
    side: "staff",
    icon: "receipt-text",
    labelKey: "chrome.nav.accounts",
  },
  {
    id: "recalls",
    path: "recalls",
    view: "recalls",
    side: "staff",
    icon: "calendar-plus",
    labelKey: "chrome.nav.recalls",
  },
  /*
   * THE ONE DECLARATION THAT PUTS THE SETTINGS SCREEN IN ALL THREE STAFF
   * PLACEMENTS.
   *
   * This app ships three shells, and a settings surface added to one of them
   * would be invisible in the other two — including the internal placement,
   * where Adminium's own sidebar carries this app's sections and reads exactly
   * this list. A row here is a row in the desk sidebar, a path the URL sync can
   * restore, and a section the dashboard offers. Last, because it is the one
   * screen nobody opens to do the day's work.
   */
  {
    id: "settings",
    path: "settings",
    view: "settings",
    side: "staff",
    icon: "sliders-horizontal",
    labelKey: "chrome.nav.settings",
  },
  /*
   * The patient side's entry screen takes the EMPTY path: a mapped domain
   * serves this app at `/`, and booking is what someone arriving there came to
   * do. Giving it `find` as well would make two URLs for one screen.
   */
  { id: "book", path: "", view: "find", side: "customer", labelKey: "chrome.nav.book" },
  {
    id: "myvisits",
    path: "my-visits",
    view: "myvisits",
    side: "customer",
    labelKey: "chrome.nav.myvisits",
  },
] as const satisfies readonly Entry[];

/**
 * Screens a side RENDERS but does not navigate to directly.
 *
 * They are declared because `App.tsx` derives its `SCREENS` records from nav +
 * extras, so leaving one out drops it from the bundle rather than silently
 * rendering the wrong thing. They get no path: a booking confirmation without a
 * booking is not a page anyone can link to, and inventing one here would
 * promise a deep link the store cannot honour.
 */
export const SURFACE_EXTRAS = {
  staff: ["notfound"],
  customer: ["details", "confirm", "notfound"],
} as const satisfies Record<"staff" | "customer", readonly View[]>;

/**
 * Every view a side renders, as a TYPE — nav entries plus extras.
 *
 * A type and not a test, deliberately. `App.tsx` must keep its two `SCREENS`
 * records as separate object LITERALS: `SURFACE_SIDE` folds to a literal at
 * build time, and that is what lets Rollup eliminate the branch not taken —
 * and with it every screen component only that branch referenced. Building one
 * record by filtering an array at runtime would be tidier and would put the
 * whole clinic app inside the PUBLIC patient bundle.
 *
 * So the two literals stay, and `satisfies Record<StaffView, ComponentType>`
 * over them makes a screen declared here with no component, or a component for
 * a screen not declared here, a compile error.
 */
export type StaffView =
  | Extract<(typeof SURFACE_NAV)[number], { side: "staff" }>["view"]
  | (typeof SURFACE_EXTRAS)["staff"][number];

export type CustomerView =
  | Extract<(typeof SURFACE_NAV)[number], { side: "customer" }>["view"]
  | (typeof SURFACE_EXTRAS)["customer"][number];
