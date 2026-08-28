/*
 * Entry point.
 *
 * The four global stylesheets are imported here, before `App`, so the cascade
 * order is deterministic in the built bundle: tokens (custom properties) →
 * base (reset, fonts, behaviour classes) → components (shared UI) → screens
 * (view-specific rules, which therefore always win a tie).
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/screens.css";

import { I18nProvider } from "./i18n/index.tsx";
import { setDataSource } from "./data/source.ts";
import { clientFromConfig, loadSnapshot, snapshotFailure, snapshotSource } from "./data/adminiumSource.ts";
import { createSessionTransport } from "./data/sessionSource.ts";
import { TABLE_OF_REF } from "./data/tableOfRef.ts";
import { resolveStaffConnectionId } from "./staffConnection.ts";
import { setTenantCurrency, setTimezoneClaim } from "./i18n/ambient.ts";
import { DEMO, HOSTED, SURFACE_SIDE } from "./surface.ts";


const container = document.getElementById("root");
if (!container) throw new Error("Missing #root — check index.html");

/*
 * ONE condition decides demo vs connected: whether the API base URL and key are
 * present at build time. `createPublicClient` returns null when either is
 * missing, so the fallback is structural rather than a catch, and there is no
 * second flag to drift. The marketplace demo builds set neither and behave
 * byte-identically to before this file changed.
 *
 * The dynamic `import()` of `App` is load-bearing, not stylistic: `App` pulls
 * `state/store.ts`, which reads the data source at MODULE SCOPE. A static
 * import would evaluate the store during this module's own imports — before the
 * fetch below could resolve — and the app would render demo data whatever the
 * server said. The `await` has to sit between the swap and the import, so the
 * import has to be dynamic.
 */
/** This app's name, as the failure screen says it. */
const BRAND = "Clinic Desk";

/**
 * The headline for a startup failure, chosen by CAUSE.
 *
 * One sentence used to cover every cause: "<Brand> is not connected". It was
 * wrong for most of them and actively misleading for two — an app that reached
 * Adminium, authenticated, and refused only because two databases are serving
 * is not "not connected", and an operator who reads that goes looking for a
 * broken connection instead of the choice the app is actually waiting on.
 *
 * The DETAIL under it already says precisely what happened; this only has to
 * name the KIND of problem without contradicting it.
 */
function titleFor(code: string | null): string {
  switch (code) {
    case "AMBIGUOUS_CONNECTION":
      return `${BRAND} does not know which database to read`;
    case "CONNECTION_PAUSED":
      return `${BRAND}'s database is paused`;
    case "NO_CONNECTION":
      return `${BRAND} is not connected`;
    case "NO_BACKEND":
      return `${BRAND} has no backend configured`;
    default:
      // Reached the server and could not finish: a refused scope, a schema that
      // does not match, an expired session. "Not connected" would be a guess.
      return `${BRAND} could not load its data`;
  }
}

/**
 * The smallest honest "this is not configured" surface.
 *
 * Deliberately plain DOM and inline styles: it has to work when the data layer,
 * and possibly the locale bundle, did not. Anything richer would be one more
 * thing that can fail while reporting a failure.
 */
function showStartupFailure(mount: HTMLElement, detail: string, code: string | null): void {
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
  // `pre-wrap`: the detail is a LIST — one problem per line, and a blank line
  // before any hint. Collapsed to a single run of prose (the CSS default) the
  // nine missing tables and the sentence that explains them read as one
  // sentence, which is how "resume it in Connections" ends up glued to a
  // column name.
  p.style.cssText = "margin:0;color:#52525b;white-space:pre-wrap";
  box.append(h, p);
  mount.append(box);
}

/**
 * The transport's code for a failure, when it carried one.
 *
 * Duck-typed rather than `instanceof`: the reason travels through
 * `snapshotFailure()` as a plain `Error`, and a build that swaps transports
 * should not have to share a class for the screen above to stay accurate.
 */
function codeOf(reason: Error | null): string | null {
  const code = (reason as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}

async function boot(): Promise<void> {
  /*
   * A NON-DEMO BUILD NEVER RENDERS DEMO DATA.
   *
   * This used to fall through: no client, or a failed snapshot, and the seam
   * kept its `demoSource` default — so a real deployment whose backend was
   * unreachable painted a plausible clinic full of invented appointments, for
   * real patients, with no error. Falling back to fiction is the failure the
   * build-time split exists to remove, so it is a hard stop here instead.
   */
  if (!DEMO) {
    /*
     * The transport is chosen at BUILD time, and the two are not
     * interchangeable. Hosted staff talks to this same origin with the
     * operator's session — no key, no scope, no CORS. Everything else goes
     * through the public API with a publishable key. `HOSTED` folds to a
     * literal, so each build contains only the transport it uses.
     */
    /*
     * The staff surface asks WHICH DATABASE it belongs to before it reads one
     * (29 D9). Null — unbound, or an Adminium too old to answer — keeps the old
     * inference, so this is additive for every instance that has one connection.
     */
    const boundConnection =
      HOSTED && SURFACE_SIDE === "staff" ? await resolveStaffConnectionId() : null;

    const client =
      HOSTED && SURFACE_SIDE === "staff"
        ? createSessionTransport({
            tableOfRef: TABLE_OF_REF,
            connectionId: boundConnection ?? undefined,
          }).port
        : // Baked vars first, then — hosted customer — the SERVED config
          // (surface-config.json, 29 D10): the key an operator bound in Studio,
          // fetched at boot, so rotation is Studio + reload with no rebuild.
          await clientFromConfig();
    const failure =
      client === null
        ? "This build has no backend configured. A hosted customer surface needs " +
          "a key bound to it in Studio (or baked VITE_ vars); a standalone build " +
          "needs VITE_ADMINIUM_API_BASE_URL and VITE_ADMINIUM_PUBLISHABLE_KEY."
        : null;

    const snap = failure === null && client !== null ? await loadSnapshot(client) : null;
    if (snap === null) {
      const reason = failure === null ? snapshotFailure() : null;
      showStartupFailure(
        container as HTMLElement,
        reason !== null
          ? // The server said WHY. Repeating a generic sentence over the top of a
            // specific one is how an operator ends up checking a key that does not
            // exist in a build that never had one.
            reason.message
          :
        failure ??
          "Could not load data from Adminium. The server may be unreachable, the " +
            "key may be wrong, or this clinic's tables may not match what it reads.",
        // `failure` is set only on the no-backend path, which throws nothing and
        // so carries no code of its own.
        failure === null ? codeOf(reason) : "NO_BACKEND",
      );
      return;
    }
    // Before `App` mounts, so the first paint formats in the tenant's
    // currency rather than flashing dollars and correcting itself.
    setTenantCurrency(snap.currency);
    // Same timing, same reason: the zone notice must be there on the first
    // paint, not appear after one.
    setTimezoneClaim(snap.timezone, snap.timezoneSource);
    setDataSource(snapshotSource(snap));
    console.info(
      `[adminium] connected: ${String(snap.visitTypes.length)} visit types, ` +
        `${String(snap.clinicians.length)} clinicians, ` +
        `${String(snap.appointments.length)} appointments`,
    );
  }

  const { default: App } = await import("./app/App.tsx");

  /*
   * ── REGISTERING THE ADD-ONS, AND WHY THE CONDITION IS NOT `true` ──────────
   *
   * The store boots an EMPTY registry and is told what exists here, at
   * bootstrap. That ordering is what let this seam land before an add-on
   * existed — with nothing registered every slot draws its fallback and the app
   * is unchanged on screen — and it is what keeps `state/store.ts` from
   * importing an add-on bundle, which every screen would then carry.
   *
   * THE CONDITION IS A BUNDLE DECISION AND CHANGES NO BEHAVIOUR. `register()`
   * builds a React settings panel, and `SURFACE_SIDE` folds to a literal, so a
   * hosted-CUSTOMER build with this branch eliminated does not contain that
   * panel, its eight-locale bundle, or the add-on's day-set data.
   *
   * Nothing is lost, and the reason is worth stating rather than assuming: an
   * add-on's days live in this app's own in-memory settings for that add-on,
   * written by a staff-only panel. A hosted customer surface is a separate page
   * load with no panel and no way to have imported anything, so it could never
   * have had a day to apply. Where its closing days actually come from is the
   * `closures` table, over the transport, which `data/adminiumSource.ts` reads
   * on every side. In the DEMO build both personas share one store, so the
   * booking strip does see what the desk imported — which is why `DEMO` is on
   * the left of the `||` rather than the branch being staff-only.
   */
  if (DEMO || SURFACE_SIDE === "staff") {
    const { useStore } = await import("./state/store.ts");
    const { demoAddOns } = await import("./add-ons/registry.ts");
    useStore.getState().registerAddOns(demoAddOns());
  }

  /*
   * The side→persona map is the ONE app-specific line here, which is why it is
   * not in `surface.ts`: every app names its personas differently, and a shared
   * module that knew those names could not be shared.
   */
  const persona = SURFACE_SIDE === "staff" ? "clinic" : SURFACE_SIDE === "customer" ? "patient" : null;
  if (persona !== null) {
    const { useStore } = await import("./state/store.ts");
    useStore.getState().setPersona(persona);
  }

  /*
   * URL ⇄ SCREEN, and the host bridge — both hosted-only, both before the first
   * paint (29-app-surfaces.md D6/D8).
   *
   * Order matters and is not obvious:
   *
   *  1. `attachUrlSync` reads the CURRENT path and applies it, so a reload of
   *     `/apps/clinic/staff/patients` renders patients rather than the day
   *     sheet and then correcting itself.
   *  2. `connectToHost` handshakes with the dashboard, if there is one. It is
   *     AWAITED so `isEmbedded()` is settled before any component renders;
   *     un-framed it returns immediately and costs nothing.
   *  3. The store subscription reflects later screen changes into the URL and
   *     tells the host, so the dashboard's address bar follows the app.
   *
   * `HOSTED` folds to a literal, so a demo or standalone build contains none of
   * this — not the bridge, not the sync, not the subscription.
   */
  if (HOSTED) {
    const { useStore } = await import("./state/store.ts");
    const { attachUrlSync } = await import("./urlSync.ts");
    const { connectToHost } = await import("./embed.ts");
    const { SURFACE_NAV, APP_KEY } = await import("./surface-nav.ts");
    const { setHostLocale } = await import("./i18n/index.tsx");

    // Forward reference on purpose: the sync reports paths TO the bridge, and
    // the bridge applies paths THROUGH the sync. Nothing fires before both
    // exist — `attachUrlSync`'s own boot read does not call `onPath`.
    let bridge: { navigated: (path: string) => void } | null = null;

    const sync = attachUrlSync({
      nav: SURFACE_NAV,
      side: SURFACE_SIDE,
      go: (view) => useStore.getState().go(view),
      current: () => useStore.getState().view,
      onPath: (path) => bridge?.navigated(path),
    });

    bridge = await connectToHost(APP_KEY, SURFACE_SIDE as "staff" | "customer", sync.path(), {
      onTheme: (theme) => useStore.getState().setHostTheme(theme),
      onLocale: setHostLocale,
      onPath: (path) => sync.applyPath(path),
    });

    useStore.subscribe(sync.reflect);
  }

  createRoot(container as HTMLElement).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}

void boot();
