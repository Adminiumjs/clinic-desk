/**
 * TWO shells, switched by the demo dock's Patient | Clinic segment.
 *
 * The patient gets a calm public site: a small wordmark, three links, a theme
 * toggle, and a centered column that simply narrows. No sidebar, no search, no
 * sight of anybody else's name. The clinic gets internal desk chrome — a
 * sidebar, a topbar with patient search and a staff chip, and under 900px a
 * hamburger plus a slide-in sheet.
 *
 * That difference is the product story, so it lives in the chrome rather than
 * being simulated inside each screen.
 */

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  MapPin,
  Menu,
  Moon,
  ReceiptText,
  Search,
  Stethoscope,
  Sun,
  Users,
  X,
} from "lucide-react";

import type { View } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { ageOn } from "../lib/schedule.ts";
import { DESK_STAFF, PATIENTS, PRACTICE_ADDRESS, useStore } from "../state/store.ts";
import { Avatar } from "./Primitives.tsx";

/* ------------------------------------------------------------ clinic nav */

interface NavEntry {
  view: View;
  labelKey:
    | "chrome.nav.daysheet"
    | "chrome.nav.waiting"
    | "chrome.nav.patients"
    | "chrome.nav.accounts"
    | "chrome.nav.recalls";
  icon: typeof CalendarDays;
}

const NAV: NavEntry[] = [
  { view: "daysheet", labelKey: "chrome.nav.daysheet", icon: CalendarDays },
  { view: "waiting", labelKey: "chrome.nav.waiting", icon: Users },
  { view: "patients", labelKey: "chrome.nav.patients", icon: Stethoscope },
  { view: "accounts", labelKey: "chrome.nav.accounts", icon: ReceiptText },
  { view: "recalls", labelKey: "chrome.nav.recalls", icon: CalendarPlus },
];

function NavList({ onPick }: { onPick?: () => void }) {
  const { t } = useI18n();
  const view = useStore((s) => s.view);
  const go = useStore((s) => s.go);

  return (
    <nav className="rh-sidebar__nav" aria-label={t("chrome.brand.desk")}>
      {NAV.map((entry) => {
        const Icon = entry.icon;
        return (
          <button
            key={entry.view}
            type="button"
            className="rh-navitem"
            aria-current={view === entry.view ? "page" : undefined}
            onClick={() => {
              go(entry.view);
              onPick?.();
            }}
          >
            <Icon size={16} aria-hidden="true" />
            {t(entry.labelKey)}
          </button>
        );
      })}
    </nav>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <div className="rh-sidebar__brand">
      <span className="rh-sidebar__mark" aria-hidden="true">
        <Stethoscope size={18} />
      </span>
      <span>
        <span className="rh-sidebar__name">{t("chrome.brand")}</span>
        <span className="rh-sidebar__sub" style={{ display: "block" }}>
          {t("chrome.brand.desk")}
        </span>
      </span>
    </div>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <div className="rh-sidebar__foot">
      {t("chrome.footer.copy")}
      <span className="rh-sidebar__chip rh-mono">{t("chrome.footer.chip")}</span>
    </div>
  );
}

function ThemeButton() {
  const { t } = useI18n();
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  return (
    <button
      type="button"
      className="rh-iconbtn rh-btn"
      onClick={toggleTheme}
      aria-label={t(theme === "dark" ? "chrome.dock.theme.light" : "chrome.dock.theme.dark")}
    >
      {theme === "dark" ? (
        <Sun size={16} aria-hidden="true" />
      ) : (
        <Moon size={16} aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Patient search. A filter over what is already in memory rather than a query —
 * there is no server in a demo — closing on pick so the reader lands on the
 * record instead of on a list of everyone.
 */
function PatientSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const openPatient = useStore((s) => s.openPatient);
  const now = useStore((s) => s.now);

  const q = query.trim().toLowerCase();
  const hits = useMemo(() => {
    if (q.length < 2) return null;
    return PATIENTS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [q]);

  return (
    <div className="rh-topbar__search">
      <Search size={15} aria-hidden="true" />
      <input
        className="rh-topbar__input rh-fld"
        type="search"
        value={query}
        placeholder={t("chrome.search.placeholder")}
        aria-label={t("chrome.search.label")}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 140)}
      />

      {open && hits !== null && (
        <div className="rh-searchpop rh-scroll">
          {hits.length === 0 && (
            <p className="rh-searchpop__empty">{t("chrome.search.empty", { query })}</p>
          )}
          {hits.length > 0 && (
            <div className="rh-searchpop__group">{t("chrome.search.patients")}</div>
          )}
          {hits.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rh-searchpop__row"
              onMouseDown={() => {
                openPatient(p.id);
                setQuery("");
              }}
            >
              <Avatar name={p.name} tint={DESK_STAFF.tint} ini={p.ini} />
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </span>
              <span className="rh-searchpop__meta rh-mono">{ageOn(p.dob, now.date)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The desk's internal chrome. */
function ClinicShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const navOpen = useStore((s) => s.navOpen);
  const setNavOpen = useStore((s) => s.setNavOpen);

  return (
    <div className="rh-app">
      <aside className="rh-sidebar">
        <Brand />
        <NavList />
        <Footer />
      </aside>

      {navOpen && (
        <>
          <button
            type="button"
            className="rh-scrim"
            aria-label={t("chrome.menu.close")}
            onClick={() => setNavOpen(false)}
          />
          <div
            className="rh-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("chrome.brand")}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <Brand />
              <button
                type="button"
                className="rh-iconbtn rh-btn"
                style={{ marginInlineStart: "auto", marginInlineEnd: 12 }}
                onClick={() => setNavOpen(false)}
                aria-label={t("chrome.menu.close")}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <NavList onPick={() => setNavOpen(false)} />
            <Footer />
          </div>
        </>
      )}

      <div className="rh-main">
        <header className="rh-topbar">
          <button
            type="button"
            className="rh-iconbtn rh-btn rh-narrow-only"
            onClick={() => setNavOpen(true)}
            aria-label={t("chrome.menu.open")}
          >
            <Menu size={18} aria-hidden="true" />
          </button>

          <PatientSearch />
          <div className="rh-topbar__spacer" />

          <ThemeButton />
          <span className="rh-userchip">
            <Avatar name={DESK_STAFF.name} tint={DESK_STAFF.tint} ini={DESK_STAFF.ini} />
            <span className="rh-wide-only">{DESK_STAFF.name}</span>
          </span>
        </header>

        <main className="rh-content" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * The public side: a centered column with three links and nothing else. Find us
 * is a deliberately cut view — it exists, says so honestly, and offers the way
 * back, rather than being a dead link in the header.
 */
function PatientShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const view = useStore((s) => s.view);
  const go = useStore((s) => s.go);

  const links: { view: View; key: "chrome.nav.book" | "chrome.nav.myvisits" | "chrome.nav.findus" }[] = [
    { view: "find", key: "chrome.nav.book" },
    { view: "myvisits", key: "chrome.nav.myvisits" },
    { view: "notfound", key: "chrome.nav.findus" },
  ];

  return (
    <div className="rh-site">
      <header className="rh-site__head">
        <button type="button" className="rh-site__brand" onClick={() => go("find")}>
          <span className="rh-site__mark" aria-hidden="true">
            <Stethoscope size={17} />
          </span>
          <span>
            <span className="rh-site__wordmark">{t("chrome.brand")}</span>
            <span className="rh-site__tag">{t("chrome.brand.site")}</span>
          </span>
        </button>

        <nav className="rh-site__nav" aria-label={t("chrome.brand.site")}>
          {links.map((l) => (
            <button
              key={l.key}
              type="button"
              className="rh-site__link"
              aria-current={view === l.view ? "page" : undefined}
              onClick={() => go(l.view)}
            >
              {t(l.key)}
            </button>
          ))}
        </nav>

        <div style={{ marginInlineStart: "auto" }}>
          <ThemeButton />
        </div>
      </header>

      <main className="rh-site__body" id="main">
        {children}
      </main>

      <footer className="rh-site__foot">
        <span className="rh-site__where">
          <MapPin size={13} aria-hidden="true" />
          {PRACTICE_ADDRESS}
        </span>
        <span>{t("chrome.footer.copy")}</span>
        <span className="rh-sidebar__chip rh-mono">{t("chrome.footer.chip")}</span>
      </footer>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const persona = useStore((s) => s.persona);
  return persona === "clinic" ? (
    <ClinicShell>{children}</ClinicShell>
  ) : (
    <PatientShell>{children}</PatientShell>
  );
}
