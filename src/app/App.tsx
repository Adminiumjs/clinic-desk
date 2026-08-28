/**
 * The app shell.
 *
 * Routing is a plain state switch over `store.view` — no react-router. Every
 * member of the `View` union is mapped to a screen below, so no nav item, link
 * or search hit can land on a route that does not exist; anything the union
 * does not cover falls through to the 404.
 *
 * The chrome — both shells, the dock, the toasts, the visit panel, the cancel
 * confirm and the card sheet — is mounted once around the switch, so a view
 * change never remounts it and a toast survives the navigation that raised it.
 */

import { useEffect } from "react";
import type { ComponentType } from "react";

import DemoDock from "../components/DemoDock.tsx";
import { DEMO, SURFACE_SIDE } from "../surface.ts";
import { CancelDialog, CardSheet, ToastLayer, VisitPanel } from "../components/Overlays.tsx";
import Shell from "../components/Shell.tsx";
import type { View } from "../data/types.ts";
import { setAmbient } from "../i18n/ambient.ts";
import { useI18n } from "../i18n/index.tsx";
import { useStore } from "../state/store.ts";

import { Accounts, DaySheet, Patients, Recalls, Waiting } from "../screens/Clinic.tsx";
import Settings from "../screens/Settings.tsx";
import NotFound from "../screens/NotFound.tsx";
import { Confirm, Details, Find, MyVisits } from "../screens/Patient.tsx";

const CLINIC_SCREENS = {
  daysheet: DaySheet,
  waiting: Waiting,
  patients: Patients,
  accounts: Accounts,
  recalls: Recalls,
  /*
   * STAFF ONLY, and that is a build-time fact rather than a hidden route. The
   * practice's settings — its closing days, and the add-ons that supply some of
   * them — are the desk's, so this component is referenced from the clinic
   * record and from nowhere else. `SURFACE_SIDE` folds to a literal, so the
   * public patient bundle does not contain this screen, the add-on shelf, or
   * the settings panel any add-on draws inside it.
   */
  settings: Settings,
} satisfies Partial<Record<View, ComponentType>>;

const PATIENT_SCREENS = {
  find: Find,
  details: Details,
  confirm: Confirm,
  myvisits: MyVisits,
} satisfies Partial<Record<View, ComponentType>>;

/*
 * A surface build ships ONE side's screens. `SURFACE_SIDE` folds to a literal,
 * so the branch not taken is eliminated and every screen only it referenced
 * goes with it — which is what stops the PUBLIC patient bundle from carrying
 * the day sheet, the accounts ledger and the recall list.
 *
 * The two screen files import nothing from each other here, so the cut is
 * clean; `notfound` is in every build because an unknown view must land
 * somewhere.
 */
const SCREENS: Partial<Record<View, ComponentType>> =
  SURFACE_SIDE === "staff"
    ? { ...CLINIC_SCREENS, notfound: NotFound }
    : SURFACE_SIDE === "customer"
      ? { ...PATIENT_SCREENS, notfound: NotFound }
      : { ...CLINIC_SCREENS, ...PATIENT_SCREENS, notfound: NotFound };

function CurrentScreen() {
  const view = useStore((s) => s.view);
  /* Unknown values can only arrive from injected state — 404 them. */
  const Screen = SCREENS[view] ?? NotFound;
  return <Screen />;
}

export default function App() {
  const initTheme = useStore((s) => s.initTheme);
  const escape = useStore((s) => s.escape);

  /*
   * Publish the live locale to the module-level bridge before anything below
   * renders. `lib/format.ts` builds its `Intl` instances from it, and the store
   * and the engine call those formatters from outside React where no hook can
   * reach the provider. Assigning during render rather than in an effect
   * matters: children render after this line, so the first paint after a locale
   * switch is already in the new locale instead of one frame behind.
   */
  const { locale, t, money, number } = useI18n();
  setAmbient(locale, t, money, number);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  /* Document-level Escape. The store closes overlays outermost-first. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") escape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [escape]);

  return (
    <>
      <a className="rh-sr-only" href="#main">
        {t("chrome.skipToContent")}
      </a>
      <Shell>
        <CurrentScreen />
      </Shell>
      {/* §5.2 item 8 — the dock resets and advances seeded fiction. Against
          real rows those controls either lie or do damage. */}
      {/*
        Build-time, not runtime. `DEMO` folds to a literal, so a hosted or
        connected build does not CONTAIN the dock — it is not merely hidden.
        The old guard was `!isConnected()`, a runtime comparison against a
        mutable module binding, which no bundler can eliminate.
      */}
      {DEMO && <DemoDock />}
      <ToastLayer />
      <VisitPanel />
      <CancelDialog />
      <CardSheet />
    </>
  );
}
