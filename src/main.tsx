import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/rh.css";

import { I18nProvider, initialLocale, setHostLocale } from "./i18n/index.tsx";
import { appName, setTenantCurrency, setTimezoneClaim } from "./i18n/ambient.ts";
import { DEMO, HOSTED, SURFACE_SIDE } from "./surface.ts";
import { setClockSource, setZone } from "./lib/clock.ts";
import { setServerZone } from "./data/venueTime.ts";
import { useUi } from "./state/ui.ts";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root — check index.html");
const mount: HTMLElement = container;

/** This app's name as a failure screen says it: the product's, never a practice's. */
const PRODUCT = "Clinic Desk";

/** The headline for a startup failure, chosen by cause. */
function titleFor(code: string | null): string {
  switch (code) {
    case "NO_CONNECTION":
      return `${PRODUCT} is not connected`;
    case "NO_BACKEND":
      return `${PRODUCT} has no backend configured`;
    case "SCHEMA_MISMATCH":
      return `${PRODUCT}'s tables do not match what it reads`;
    default:
      return `${PRODUCT} could not load its data`;
  }
}

/**
 * The smallest honest "this is not configured" surface: plain DOM and English,
 * because it has to work when the data layer, and maybe the locale bundle,
 * did not.
 */
function showStartupFailure(detail: string, code: string | null): void {
  const title = titleFor(code);
  console.error(`[adminium] ${title}: ${detail}`);
  mount.innerHTML = "";
  const box = document.createElement("div");
  box.setAttribute("role", "alert");
  box.style.cssText =
    "max-width:34rem;margin:12vh auto;padding:1.5rem;font:400 15px/1.6 system-ui,sans-serif;" +
    "border:1px solid #d4d4d8;border-radius:12px;color:#18181b;background:#fff";
  const h = document.createElement("h1");
  h.textContent = title;
  h.style.cssText = "margin:0 0 .5rem;font-size:1.05rem;font-weight:600";
  const p = document.createElement("p");
  p.textContent = detail;
  p.style.cssText = "margin:0;color:#52525b;white-space:pre-wrap";
  box.append(h, p);
  mount.append(box);
}

const codeOf = (error: unknown): string | null => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
};
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function render(App: () => React.JSX.Element | null): void {
  const named = appName();
  if (named !== null) document.title = named;
  createRoot(mount).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}

/** The theme the operating system asks for, until a host or the demo says otherwise. */
function systemTheme(): "light" | "dark" {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * THE PATIENTS' PAGES — the customer side: finding a time, booking, a
 * patient's own visits and reminders. No desk, no staff session: only the
 * public API through the practice's browser key, which Adminium serves beside
 * the bundle. `SURFACE_SIDE` folds to a literal, so nothing of the desk is in
 * this bundle, and nothing of this in the desk's.
 */
async function bootPatients(): Promise<void> {
  const { resolveSurfaceConfig } = await import("./publicConfig.ts");
  const config = await resolveSurfaceConfig();
  if (config === null) {
    showStartupFailure(
      "Adminium served no booking key for this page. Allow the public access when installing the app, or check that its browser key is still live on the API keys page.",
      "NO_BACKEND",
    );
    return;
  }
  const { createPublicClient } = await import("@adminiumjs/public-client");
  // Every write this page makes (a claim, a booking, a registration) asks for the
  // human check: solve it first rather than be refused once and try again.
  const client = createPublicClient({ baseUrl: config.baseUrl, publishableKey: config.publishableKey, humanCheck: true });
  if (client === null) {
    showStartupFailure("This page has no server to talk to.", "NO_BACKEND");
    return;
  }
  const [{ publicPatientsPort }, { setPatientsPort, loadCatalogue }] = await Promise.all([import("./data/publicPatients.ts"), import("./state/patients.ts")]);
  try {
    const port = await publicPatientsPort(client, config.tables ?? {});
    setPatientsPort(port);
    setZone(port.timeZone());
    setTimezoneClaim(port.timeZone(), "operator");
  } catch (error) {
    showStartupFailure(messageOf(error), codeOf(error));
    return;
  }
  useUi.setState({ persona: "patient", view: "find", theme: systemTheme() });
  void loadCatalogue();

  const [{ attachUrlSync }, { connectToHost }, { SURFACE_NAV, APP_KEY }, { go }] = await Promise.all([
    import("./urlSync.ts"),
    import("./embed.ts"),
    import("./surface-nav.ts"),
    import("./state/ui.ts"),
  ]);
  let bridge: { navigated: (path: string) => void } | null = null;
  const sync = attachUrlSync({
    nav: SURFACE_NAV,
    side: "customer",
    go: (view) => go(view),
    current: () => useUi.getState().view,
    onPath: (path) => bridge?.navigated(path),
  });
  bridge = await connectToHost(APP_KEY, "customer", sync.path(), {
    onTheme: (theme) => useUi.setState({ theme: theme === "dark" ? "dark" : "light" }),
    onLocale: setHostLocale,
    onPath: (path) => sync.applyPath(path),
  });
  useUi.subscribe(sync.reflect);

  const { default: App } = await import("./app/App.tsx");
  render(App);
}

/**
 * THE DESK — the staff side, served by Adminium to the signed-in person.
 *
 * It boots from the staff config alone: the database, the tables' real names,
 * the practice's clock and currency, who is signed in (and what they may do),
 * and the token their saves carry. Every read and write is that person's,
 * under their grants and the audit trail.
 */
async function bootDesk(): Promise<void> {
  const [{ loadStaffConfig }, { createSessionTransport }, { realTables }, { REQUIRED, sessionDeskReads }, { sessionSink }] = await Promise.all([
    import("./staffConnection.ts"),
    import("./data/sessionSource.ts"),
    import("./data/tableOfRef.ts"),
    import("./data/adminiumSource.ts"),
    import("./data/sink.ts"),
  ]);
  const staff = await loadStaffConfig();
  if (staff === null) {
    showStartupFailure("Adminium did not send this desk its configuration. Open it from Adminium, signed in.", "NO_BACKEND");
    return;
  }
  // The kiosk's sign-in reads no table: it never loads the desk, only the kiosk's own key.
  // Only when the kiosk is all the person is: a manager who also holds the kiosk
  // role (and so is handed its key) still opens the desk. A server that did not
  // say which roles someone holds sends the key only to a kiosk sign-in.
  const desk = await import("./state/desk.ts");
  if (desk.roleOf(staff.access).role === "kiosk" || (staff.access === null && staff.publicKeys["kiosk"] !== undefined)) {
    await bootKiosk(staff);
    return;
  }
  if (staff.serverTimezone !== null) setServerZone(staff.serverTimezone);
  const tables = realTables(staff.tables);
  const transport = createSessionTransport({
    tableOfRef: tables,
    ...(staff.connectionId === null ? {} : { connectionId: staff.connectionId }),
    ...(staff.csrfToken === null
      ? {}
      : {
          staff: {
            csrfToken: staff.csrfToken,
            timezone: staff.timezone,
            timezoneSource: staff.timezoneSource,
            serverTimezone: staff.serverTimezone,
            currency: staff.currency,
          },
          refreshToken: async () => (await loadStaffConfig())?.csrfToken ?? null,
        }),
  });
  let zone = "UTC";
  try {
    const config = await transport.port.config();
    zone = config.timezone;
    setTimezoneClaim(config.timezone, config.timezoneSource ?? null);
    setTenantCurrency(config.currency ?? staff.currency ?? "USD");
    await transport.port.assertRefs(REQUIRED);
  } catch (error) {
    showStartupFailure(messageOf(error), codeOf(error));
    return;
  }
  setZone(zone);
  setClockSource(() => Date.now());

  const [{ setDeskReads, loadDesk, roleOf, useDesk, can }, { setSink }] = await Promise.all([import("./state/desk.ts"), import("./state/writes.ts")]);
  const { role, roleName } = roleOf(staff.access);
  useDesk.setState({
    me: { name: staff.user?.name ?? "", email: staff.user?.email ?? null, role, roleName, access: staff.access },
  });
  setDeskReads(sessionDeskReads(transport, tables, (ref) => can(ref, "read")));
  setSink(sessionSink(transport, tables));
  useUi.setState({ persona: "clinic", view: "daysheet", theme: systemTheme() });
  await loadDesk();
  if (useDesk.getState().load === "failed") {
    showStartupFailure(useDesk.getState().loadError ?? "The desk could not read its data.", null);
    return;
  }
  const settings = useDesk.getState().settings;
  if (settings !== null) setTenantCurrency(settings.currency || staff.currency || "USD");

  /*
   * LIVE UPDATES: other desks, the clinicians' screens and patients booking
   * online. Off (with a warning) if the stream cannot start: the desk still
   * works, it just follows other computers only when it reads again.
   */
  const [{ startLive }, { applyFrame, resync }] = await Promise.all([import("./data/live.ts"), import("./state/live.ts")]);
  void startLive({ transport, tables, readable: (ref) => can(ref, "read"), onFrame: applyFrame, onReconnect: () => void resync() }).catch((error: unknown) =>
    console.warn("[clinic] live updates are off:", error),
  );

  await wireAddOns();
  await wireHost("staff");
  startTicking();
  const { default: App } = await import("./app/App.tsx");
  render(App);
}

/**
 * THE ARRIVALS KIOSK — the tablet in the waiting room, signed in with the
 * kiosk role. That role may read no table, so nothing of the desk loads: the
 * kiosk works through its own browser key, which the staff config hands only
 * to this sign-in and which the server honours only beside it (the sign-in's
 * cookie and its token on every write). The screen is the kiosk and nothing
 * else, whatever the address asks for.
 */
async function bootKiosk(staff: import("./staffConnection.ts").StaffConfig): Promise<void> {
  const [{ createPublicClient }, { publicKioskPort, setKioskPort, staffSignOut, unavailableKioskPort }, { useDesk, roleOf }, { surfaceBase }] = await Promise.all([
    import("@adminiumjs/public-client"),
    import("./data/kiosk.ts"),
    import("./state/desk.ts"),
    import("./urlSync.ts"),
  ]);
  // The practice's clock: "today" and the times the kiosk says are the practice's, not the tablet's.
  const zone = staff.timezone ?? "UTC";
  setZone(zone);
  const source = staff.timezoneSource;
  setTimezoneClaim(zone, staff.timezone === null ? "fallback" : source === "host" || source === "fallback" ? source : "operator");
  setClockSource(() => Date.now());

  const csrfToken = staff.csrfToken;
  // Whoever signs in after "Staff" comes back to this app: a member of staff lands on the desk.
  const leave = () => staffSignOut({ csrfToken, next: surfaceBase(window.location.pathname, import.meta.env.BASE_URL) });
  const key = staff.publicKeys["kiosk"];
  const client = () =>
    createPublicClient({ baseUrl: window.location.origin, publishableKey: key ?? "", csrfToken: () => csrfToken });
  const first = key === undefined ? null : client();
  setKioskPort(first === null ? unavailableKioskPort(leave) : publicKioskPort(() => client() ?? first, staff.tables, leave));

  const { roleName } = roleOf(staff.access);
  useDesk.setState({ me: { name: staff.user?.name ?? "", email: staff.user?.email ?? null, role: "kiosk", roleName, access: staff.access } });
  useUi.setState({ persona: "clinic", view: "kiosk", theme: systemTheme() });
  await wireHost("staff");
  useUi.setState({ view: "kiosk" });
  const { default: App } = await import("./app/App.tsx");
  render(App);
}

/**
 * THE DEMO — the website's card, with no server: the sample practice in
 * memory, on a pinned Tuesday morning, run by the same screens and the same
 * rules. `DEMO` folds to a literal, so no other build contains any of it.
 */
async function bootDemo(): Promise<void> {
  const [{ demoClock, DEMO_ZONE, DEMO_START }, { resolveSample }, bundle, { createDemoDb, scanReminders }, ports, { DEMO_DESK }] = await Promise.all([
    import("./lib/clock.ts"),
    import("./data/sampleRows.ts"),
    import("../seeds/clinic.sample.json"),
    import("./demo/db.ts"),
    import("./demo/ports.ts"),
    import("./data/demo.ts"),
  ]);
  const clock = demoClock();
  setZone(DEMO_ZONE);
  setClockSource(clock.now);
  setTimezoneClaim(DEMO_ZONE, "operator");
  setTenantCurrency("GBP");
  const resolve = (locale: string) => resolveSample(bundle.default as never, { now: DEMO_START, zone: DEMO_ZONE, locale });
  const db = createDemoDb(resolve("en-US") as never, clock.now, DEMO_ZONE);
  const { relabeller } = await import("./demo/relabel.ts");
  const relabel = relabeller(db, resolve, "en-US");
  // The reminders already due on the pinned morning have gone, as they would have on a real install.
  scanReminders(db);

  const [{ setDeskReads, loadDesk, useDesk }, { setSink }, { setPatientsPort, loadCatalogue }] = await Promise.all([
    import("./state/desk.ts"),
    import("./state/writes.ts"),
    import("./state/patients.ts"),
  ]);
  setDeskReads(ports.demoDeskReads(db));
  setSink(ports.demoSink(db, () => ({ origin: "desk", name: DEMO_DESK.name })));
  setPatientsPort(ports.demoPatientsPort(db));
  // The demo's kiosk keeps the real one's rules; its "Staff" goes straight back to the desk (there is no sign-in to leave).
  const [{ setKioskPort }, { demoKioskPort }, { go }] = await Promise.all([import("./data/kiosk.ts"), import("./demo/kiosk.ts"), import("./state/ui.ts")]);
  setKioskPort(demoKioskPort(db, async () => go("daysheet")));
  useDesk.setState({
    me: {
      name: DEMO_DESK.name,
      email: DEMO_DESK.email,
      role: "manager",
      roleName: DEMO_DESK.roleName,
      access: null,
    },
  });
  useUi.setState({ persona: "patient", view: "find", theme: systemTheme() });
  /*
   * The demo on its own (no card around it) opens where its address says:
   * `?persona=clinic&view=waiting&theme=dark&lang=ar-EG`. It is how a
   * screenshot, a test or a reviewer reaches one screen directly.
   */
  const asked = new URLSearchParams(window.location.search);
  const persona = asked.get("persona");
  if (persona === "patient" || persona === "clinic") useUi.setState({ persona, view: persona === "patient" ? "find" : "daysheet" });
  const view = asked.get("view");
  if (view !== null && view !== "") useUi.setState({ view: view as never });
  const theme = asked.get("theme");
  if (theme === "light" || theme === "dark") useUi.setState({ theme });
  const lang = asked.get("lang");
  if (lang !== null) setHostLocale(lang);
  // The practice's words in the page's language, before anything reads them.
  relabel(initialLocale());
  await Promise.all([loadDesk(), loadCatalogue()]);
  // The demo's database announces its changes as the live stream would: a
  // booking made on the patients' side is on the day sheet when you switch.
  const { applyFrame } = await import("./state/live.ts");
  db.subscribe((table, change) => applyFrame({ table, kind: change.kind, id: change.id }));
  await wireAddOns();

  const { startDemoBridge } = await import("./demoBridge.ts");
  startDemoBridge({ db, clock, relabel });
  const { default: App } = await import("./app/App.tsx");
  render(App);
}

/** The add-ons this build carries, registered once (their days suggest closures on Hours & closures). */
async function wireAddOns(): Promise<void> {
  const [{ demoAddOns }, { useAddOns }] = await Promise.all([import("./add-ons/registry.ts"), import("./state/addOns.ts")]);
  useAddOns.getState().registerAddOns(demoAddOns());
}

/**
 * URL ⇄ screen and the dashboard bridge (hosted builds only): a reload of
 * `/apps/clinic/staff/waiting` opens the waiting room, the dashboard's address
 * bar follows the desk, and its theme and language reach the desk.
 */
async function wireHost(side: "staff" | "customer"): Promise<void> {
  if (!HOSTED) return;
  const [{ attachUrlSync }, { connectToHost }, { SURFACE_NAV, APP_KEY }, { go }] = await Promise.all([
    import("./urlSync.ts"),
    import("./embed.ts"),
    import("./surface-nav.ts"),
    import("./state/ui.ts"),
  ]);
  let bridge: { navigated: (path: string) => void } | null = null;
  const sync = attachUrlSync({
    nav: SURFACE_NAV,
    side,
    go: (view) => go(view),
    current: () => useUi.getState().view,
    onPath: (path) => bridge?.navigated(path),
  });
  bridge = await connectToHost(APP_KEY, side, sync.path(), {
    onTheme: (theme) => useUi.setState({ theme: theme === "dark" ? "dark" : "light" }),
    onLocale: setHostLocale,
    onPath: (path) => sync.applyPath(path),
  });
  useUi.subscribe(sync.reflect);
}

/** The real clock ticks on screen every 30 seconds: waits, "hasn't arrived", the now line. */
function startTicking(): void {
  setInterval(() => {
    import("./lib/clock.ts").then(({ clockJumped }) => clockJumped()).catch(() => undefined);
  }, 30_000);
}

async function boot(): Promise<void> {
  if (SURFACE_SIDE === "customer") {
    await bootPatients();
    return;
  }
  if (DEMO) {
    await bootDemo();
    return;
  }
  if (HOSTED && SURFACE_SIDE === "staff") {
    await bootDesk();
    return;
  }
  showStartupFailure(
    "The desk saves as the person signed in to Adminium, so it runs only inside Adminium. Build it with `npm run build:surface` and open it from the Clinic section.",
    "NO_BACKEND",
  );
}

void boot();
