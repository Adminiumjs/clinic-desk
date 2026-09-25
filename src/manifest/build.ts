/**
 * `manifest.json`, assembled from the modules beside this file.
 *
 * The manifest is what Adminium installs: the tables and their rules, the
 * pages, the roles, the patients' doors, the emails. It is written from typed
 * modules rather than by hand because it is long and mostly the same eight
 * languages over and over; the modules say each thing once. The file itself
 * is still the product's input, checked in, and `manifest-drift.test.ts`
 * fails when it and the modules disagree (`npm run manifest` re-writes it).
 */
import { ADD_ONS } from "./add-ons.ts";
import { DOCUMENTS } from "./documents.ts";
import { emailTemplates } from "./emails.ts";
import { untranslated } from "./labels.ts";
import { OUTBOX } from "./outbox.ts";
import { NAV_GROUPS, pages } from "./pages.ts";
import { PUBLIC_ACCESS, PUBLIC_KEYS } from "./public.ts";
import { ROLES } from "./roles.ts";
import { TABLES } from "./tables.ts";

/** This release. The version moved 0.1.4 → 0.2.0 once (its tables were new); since then, patches. */
export const VERSION = "0.2.1";

/**
 * The Adminium release that first reads everything below: booking, the
 * outbox and claims (0.3.0), the add-ons an app works with, the documents it
 * ships and an email that carries one (0.3.1), and an update that rebuilds a
 * SQLite table, a document switched on when its add-on is connected later, and
 * a print copy that opens in a tab (0.3.2).
 */
export const MIN_ADMINIUM = "0.3.2";

const ENV = {
  VITE_ADMINIUM_API_BASE_URL: { required: false, example: "https://admin.example.com" },
  VITE_ADMINIUM_PUBLISHABLE_KEY: { required: false, example: "adm_pub_..." },
};

export function buildManifest(): Record<string, unknown> {
  return {
    kind: "app",
    manifestVersion: 1,
    key: "clinic",
    name: "Clinic Desk",
    version: VERSION,
    publisher: { id: "adminium", name: "Adminium", url: "https://adminium.dev" },
    license: "AGPL-3.0-only",
    description: {
      key: "mft.clinic.desc",
      fallback:
        "An appointment desk for a small practice: patients book online, the desk checks them in and takes payment, reminders go by email — backed by your own database.",
    },
    categories: ["operations"],
    compatibility: {
      minAdminiumVersion: MIN_ADMINIUM,
      engines: ["sqlite", "postgres", "mysql"],
      requires: ["realtime"],
      // 0.1.4 kept its tables unprefixed and in another shape: it cannot be
      // updated in place (uninstall it first — its tables are kept).
      updatesFrom: ">=0.2.0",
    },
    capabilities: ["email-delivery", "realtime"],
    frontends: [
      {
        side: "staff",
        kind: "spa",
        entry: "index.html",
        env: ENV,
        placement: "internal",
        routes: {
          daysheet: "/daysheet",
          waiting: "/waiting",
          patients: "/patients",
          registrations: "/registrations",
          week: "/week",
          accounts: "/accounts",
          recalls: "/recalls",
          hours: "/hours",
          outbox: "/outbox",
          endofday: "/endofday",
          settings: "/settings",
        },
      },
      {
        side: "customer",
        kind: "spa",
        entry: "index.html",
        env: ENV,
        routes: {
          find: "/",
          visits: "/my-visits",
          team: "/clinicians",
          findus: "/find-us",
          prices: "/prices",
          prefs: "/reminders",
          register: "/register",
          faq: "/questions",
        },
      },
    ],
    navGroups: NAV_GROUPS,
    addOns: ADD_ONS,
    requiredSchema: { prefixed: true, tables: TABLES },
    pages: pages(),
    roles: ROLES,
    publicKeys: PUBLIC_KEYS,
    publicAccess: PUBLIC_ACCESS,
    outbox: OUTBOX,
    emailTemplates: emailTemplates(),
    documents: DOCUMENTS,
    sampleData: { file: "seeds/clinic.sample.json" },
  };
}

/** The manifest as it is written to disk: two-space JSON and a final newline. */
export function manifestText(): string {
  const text = `${JSON.stringify(buildManifest(), null, 2)}\n`;
  const missing = untranslated();
  if (missing.length > 0) {
    throw new Error(
      `these labels have no translation in words.ts, so the manifest would show English in seven languages:\n  ${missing.join("\n  ")}`,
    );
  }
  return text;
}
