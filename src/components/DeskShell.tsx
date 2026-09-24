/**
 * The desk's frame: the sidebar (the practice's mark and name, "Front desk",
 * the screens with their counts), the header (find a patient, light or dark,
 * who is signed in and as what), the page, and the footer.
 *
 * Below 900 px the sidebar folds into a menu the header opens. Inside
 * Adminium's dashboard none of this is drawn: the dashboard's own sidebar
 * already lists the desk's screens in the practice's section, its header
 * carries the person and the theme, and two of each in one window would be
 * noise. The page then fills the dashboard's content area on its own.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";

import { isEmbedded } from "../embed.ts";
import { useI18n } from "../i18n/index.tsx";
import { initials } from "../lib/color.ts";
import { today } from "../lib/clock.ts";
import { num } from "../lib/format.ts";
import { useNow } from "../lib/useNow.ts";
import { addDays } from "../data/venueTime.ts";
import { ensureDays, useDesk } from "../state/desk.ts";
import { go, useUi } from "../state/ui.ts";
import { iconBtnStyle, mono, navStyle, Skeleton, tileStyle, useDark, useModal } from "./ui.tsx";
import { navCounts, visibleNav } from "./desk/nav.ts";
import PatientSearch from "./desk/PatientSearch.tsx";
import { useNarrow } from "./desk/useNarrow.ts";

/** The colour the design gives the signed-in person's tile. */
const STAFF_TILE = "#6d5bd0";
const GUTTER = "clamp(14px,2.4vw,24px)";

function Brand({ close }: { close?: ReactNode }) {
  const { t } = useI18n();
  const settings = useDesk((s) => s.settings);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingInline: close === undefined ? 6 : 0 }}>
      <span
        aria-hidden="true"
        style={{ width: 29, height: 29, flexShrink: 0, borderRadius: 9, background: "var(--accent)", color: "var(--accent-fg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800, letterSpacing: "-.02em" }}
      >
        {settings?.mark ?? ""}
      </span>
      <span style={{ minWidth: 0, flex: close === undefined ? undefined : 1 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 800, letterSpacing: "-.035em" }}>{settings?.practice_name ?? ""}</span>
        <span style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: close === undefined ? ".03em" : undefined, color: "var(--fg-subtle)" }}>{t("nav.frontDesk")}</span>
      </span>
      {close}
    </div>
  );
}

function Copyright({ style }: { style: CSSProperties }) {
  const { t, number } = useI18n();
  const practice = useDesk((s) => s.settings?.practice_name ?? "");
  return <div style={style}>{t("shell.copyright", { year: number(Number(today().slice(0, 4)), { useGrouping: false }), practice })}</div>;
}

/** The screens this person may open, with their counts. */
function NavList({ ellipsis }: { ellipsis: boolean }) {
  const { t } = useI18n();
  const view = useUi((s) => s.view);
  const access = useDesk((s) => s.me.access);
  const role = useDesk((s) => s.me.role);
  const desk = useDesk();
  const now = useNow();
  const counts = navCounts(desk, today(), now);
  return (
    <>
      {visibleNav(access, role).map((item) => {
        const on = view === item.view;
        const count = counts[item.view] ?? 0;
        const Icon = item.icon;
        return (
          <button key={item.view} type="button" className="rh-nav" aria-current={on ? "page" : undefined} onClick={() => go(item.view)} style={navStyle(on)}>
            <Icon size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, textAlign: "start", ...(ellipsis ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : {}) }}>{t(item.labelKey)}</span>
            {count > 0 && (
              <span style={{ ...mono(10.5, 600, on ? "var(--accent)" : "var(--fg-subtle)"), padding: "2px 7px", borderRadius: 999, background: on ? "var(--surface)" : "var(--surface-3)" }}>{num(count)}</span>
            )}
          </button>
        );
      })}
    </>
  );
}

function Sidebar() {
  return (
    <aside
      style={{ width: 238, flexShrink: 0, alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 16, padding: "18px 13px", background: "var(--surface)", borderInlineEnd: "1px solid var(--border)", position: "sticky", insetBlockStart: 0, height: "100vh", boxSizing: "border-box" }}
    >
      <Brand />
      <nav aria-label={useI18n().t("shell.nav")} className="rh-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        <NavList ellipsis />
      </nav>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "14px 6px 0", borderBlockStart: "1px solid var(--border)" }}>
        <Copyright style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--fg-subtle)", textWrap: "pretty" }} />
      </div>
    </aside>
  );
}

/** The phone-width menu: the sidebar, sliding in from the start edge. */
function PhoneMenu() {
  const { t } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const close = () => useUi.setState({ menu: false });
  useModal(root, close);
  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 750, background: "var(--scrim)", backdropFilter: "blur(3px)", animation: "rh-scrim .16s ease", display: "flex" }}>
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={t("shell.menu")}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(272px,84vw)", height: "100%", boxSizing: "border-box", padding: "18px 14px", background: "var(--surface)", borderInlineEnd: "1px solid var(--border)", boxShadow: "0 0 60px rgba(10,10,25,.4)", animation: "rh-slide .22s cubic-bezier(.2,.7,.3,1)", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", outline: "none" }}
      >
        <Brand
          close={
            <button type="button" data-close className="rh-gi" onClick={close} aria-label={t("common.close")} style={iconBtnStyle}>
              <X size={15} aria-hidden="true" />
            </button>
          }
        />
        <nav aria-label={t("shell.nav")} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <NavList ellipsis={false} />
        </nav>
        <div style={{ marginBlockStart: "auto", display: "flex", flexDirection: "column", gap: 9 }}>
          <Copyright style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--fg-subtle)", textWrap: "pretty" }} />
        </div>
      </div>
    </div>
  );
}

function Header({ narrow }: { narrow: boolean }) {
  const { t } = useI18n();
  const dark = useDark();
  const me = useDesk((s) => s.me);
  const theme = useUi((s) => s.theme);
  return (
    <header style={{ position: "sticky", insetBlockStart: 0, zIndex: 400, background: "var(--surface)", borderBlockEnd: "1px solid var(--border)", padding: `11px ${GUTTER}`, display: "flex", alignItems: "center", gap: 11 }}>
      {narrow && (
        <button type="button" className="rh-gi" onClick={() => useUi.setState({ menu: true })} aria-label={t("shell.menu")} aria-haspopup="dialog" style={iconBtnStyle}>
          <Menu size={16} aria-hidden="true" />
        </button>
      )}
      <PatientSearch />
      <button
        type="button"
        className="rh-gi"
        onClick={() => useUi.setState({ theme: theme === "dark" ? "light" : "dark" })}
        aria-label={t("shell.theme")}
        title={t("shell.theme")}
        style={{ ...iconBtnStyle, marginInlineStart: "auto" }}
      >
        {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
      </button>
      <span
        title={narrow ? `${me.name} · ${me.roleName ?? t("nav.frontDesk")}` : undefined}
        style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, padding: 5, borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <span aria-hidden={!narrow} role={narrow ? "img" : undefined} aria-label={narrow ? `${me.name} · ${me.roleName ?? t("nav.frontDesk")}` : undefined} style={tileStyle(STAFF_TILE, dark, 28)}>
          {initials(me.name)}
        </span>
        {!narrow && (
          <span style={{ display: "flex", flexDirection: "column", gap: 1, paddingInlineEnd: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{me.name}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>{me.roleName ?? t("nav.frontDesk")}</span>
          </span>
        )}
      </span>
    </header>
  );
}

/** What shows while the desk reads its day for the first time. */
function Loading() {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t("common.loading")} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Skeleton height={30} width="38%" />
      <Skeleton height={88} />
      <Skeleton height={340} />
    </div>
  );
}

export default function DeskShell({ children }: { children: ReactNode }) {
  const narrow = useNarrow();
  const menu = useUi((s) => s.menu);
  const loading = useDesk((s) => s.snapshotDay === "");
  const page = loading ? <Loading /> : children;
  // The next two days are read too, so the sidebar's counts (reminders about to go) are whole from the start.
  const ahead = useDesk((s) => [1, 2].every((i) => s.daysRead[addDays(today(), i)] === true));
  useEffect(() => {
    if (!loading && !ahead) void ensureDays(addDays(today(), 1), 2).catch(() => undefined);
  }, [loading, ahead]);

  if (isEmbedded()) {
    return (
      <main id="main" style={{ minHeight: "100vh", background: "var(--bg)", padding: `clamp(16px,2.6vw,26px) ${GUTTER} 40px` }}>
        {page}
      </main>
    );
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "var(--bg)" }}>
      {!narrow && <Sidebar />}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header narrow={narrow} />
        <main id="main" style={{ flex: 1, minWidth: 0, padding: `clamp(16px,2.6vw,26px) ${GUTTER} 110px` }}>
          {page}
        </main>
        <footer style={{ borderBlockStart: "1px solid var(--border)", background: "var(--surface)", padding: `16px ${GUTTER}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
          <Copyright style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }} />
        </footer>
      </div>
      {narrow && menu && <PhoneMenu />}
    </div>
  );
}
