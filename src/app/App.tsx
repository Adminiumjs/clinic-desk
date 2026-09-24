/**
 * The app: the patients' pages or the desk, the screen on show, and what can
 * open over it (a sheet, the visit panel, a toast).
 *
 * The two sides' screens are two separate records ON PURPOSE. `SURFACE_SIDE`
 * folds to a literal at build time, so the patients' bundle — served to
 * anyone on the internet — does not contain a single desk screen, and the
 * desk's bundle contains no patients' page. Building one record by filtering
 * at runtime would be tidier and would ship the desk to every visitor
 * (`testing/surfaceBuild.test.ts` checks it does not).
 */
import { useEffect, type ComponentType } from "react";

import { useI18n } from "../i18n/index.tsx";
import { setAmbient } from "../i18n/ambient.ts";
import { SURFACE_SIDE } from "../surface.ts";
import type { CustomerView, StaffView } from "../surface-nav.ts";
import { useUi } from "../state/ui.ts";
import { usePatients } from "../state/patients.ts";
import { useDesk } from "../state/desk.ts";

import DeskShell from "../components/DeskShell.tsx";
import PatientShell from "../components/PatientShell.tsx";
import SheetHost from "../components/SheetHost.tsx";
import { DeskOverlays } from "../components/Overlays.tsx";
import { toastIcon } from "../components/desk/icons.ts";
import { Toasts } from "../components/ui.tsx";
import { PatientOverlays } from "../components/PatientOverlays.tsx";

import Daysheet from "../screens/Daysheet.tsx";
import Waiting from "../screens/Waiting.tsx";
import Patients from "../screens/Patients.tsx";
import Registrations from "../screens/Registrations.tsx";
import Week from "../screens/Week.tsx";
import Waitlist from "../screens/Waitlist.tsx";
import Kiosk from "../screens/Kiosk.tsx";
import Accounts from "../screens/Accounts.tsx";
import Recalls from "../screens/Recalls.tsx";
import Hours from "../screens/Hours.tsx";
import Outbox from "../screens/Outbox.tsx";
import Endofday from "../screens/Endofday.tsx";
import Settings from "../screens/Settings.tsx";
import NotFound from "../screens/NotFound.tsx";

import Find from "../screens/patient/Find.tsx";
import Details from "../screens/patient/Details.tsx";
import Confirm from "../screens/patient/Confirm.tsx";
import MyVisits from "../screens/patient/MyVisits.tsx";
import Team from "../screens/patient/Team.tsx";
import FindUs from "../screens/patient/FindUs.tsx";
import Prices from "../screens/patient/Prices.tsx";
import Sooner from "../screens/patient/Sooner.tsx";
import Prefs from "../screens/patient/Prefs.tsx";
import Register from "../screens/patient/Register.tsx";
import Faq from "../screens/patient/Faq.tsx";
import PatientNotFound from "../screens/patient/NotFound.tsx";
import BookingClosed from "../screens/patient/BookingClosed.tsx";

const DESK_SCREENS = {
  daysheet: Daysheet,
  waiting: Waiting,
  patients: Patients,
  registrations: Registrations,
  week: Week,
  waitlist: Waitlist,
  accounts: Accounts,
  recalls: Recalls,
  hours: Hours,
  outbox: Outbox,
  endofday: Endofday,
  settings: Settings,
  kiosk: Kiosk,
  notfound: NotFound,
} satisfies Record<StaffView, ComponentType>;

const PATIENT_SCREENS = {
  find: Find,
  details: Details,
  confirm: Confirm,
  visits: MyVisits,
  team: Team,
  findus: FindUs,
  prices: Prices,
  sooner: Sooner,
  prefs: Prefs,
  register: Register,
  faq: Faq,
  notfound: PatientNotFound,
} satisfies Record<CustomerView, ComponentType>;

/**
 * The arrivals kiosk stands alone: no sidebar, no sheets, no visit panel —
 * a tablet in the waiting room shows a patient nothing of the desk. Someone
 * signed in with the kiosk role reaches only this, whatever the address asks
 * for; the toasts stay for the demo card's words.
 */
function KioskAlone() {
  return (
    <>
      <Kiosk />
      <Toasts icons={toastIcon} />
    </>
  );
}

function Desk() {
  const view = useUi((s) => s.view);
  const kioskOnly = useDesk((s) => s.me.role === "kiosk");
  if (kioskOnly || view === "kiosk") return <KioskAlone />;
  const Screen = (DESK_SCREENS as Partial<Record<string, ComponentType>>)[view] ?? NotFound;
  return (
    <>
      <DeskShell>
        <Screen />
      </DeskShell>
      <SheetHost />
      <DeskOverlays />
    </>
  );
}

function PatientSide() {
  const view = useUi((s) => s.view);
  const closed = usePatients((s) => s.catalogue?.settings?.online_booking_on === false);
  // Online booking switched off at the desk: the whole side is one page saying so.
  if (closed) return <BookingClosed />;
  const Screen = (PATIENT_SCREENS as Partial<Record<string, ComponentType>>)[view] ?? PatientNotFound;
  return (
    <>
      <PatientShell>
        <Screen />
      </PatientShell>
      <PatientOverlays />
    </>
  );
}

export default function App() {
  const { locale, t, money, number } = useI18n();
  // Publish the live locale before anything renders, so the formatters called
  // outside React are already in the new language on the first paint.
  setAmbient(locale, t, money, number);
  const theme = useUi((s) => s.theme);
  const persona = useUi((s) => s.persona);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  if (SURFACE_SIDE === "staff") return <Desk />;
  if (SURFACE_SIDE === "customer") return <PatientSide />;
  // The demo: both sides, switched by the card's persona.
  return persona === "patient" ? <PatientSide /> : <Desk />;
}
