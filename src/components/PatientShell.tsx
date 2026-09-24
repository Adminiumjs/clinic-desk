/**
 * The patients' frame: the practice's mark and name, the four places a
 * patient goes (Book · Clinicians · My visits · Find us), light or dark, and
 * a footer with the practice's name and the other pages.
 *
 * The mark is the practice's own letters and the name its own (settings), so
 * one build serves any practice. The footer lists only pages this build has.
 * Until the practice's details have loaded the page shows the design's
 * shimmer; if they cannot load, a line saying so and "Try again".
 */
import type { CSSProperties, ReactNode } from "react";
import { Moon, RotateCw, Sun } from "lucide-react";

import { useI18n } from "../i18n/index.tsx";
import type { MessageKey } from "../i18n/messages/index.ts";
import type { PatientView } from "../data/types.ts";
import { today } from "../lib/clock.ts";
import { loadCatalogue, usePatients } from "../state/patients.ts";
import { go, useUi } from "../state/ui.ts";
import { Btn } from "./ui.tsx";
import { PageSkeleton, useNarrow } from "../screens/patient/parts.tsx";

const NAV: { view: PatientView; key: MessageKey }[] = [
  { view: "find", key: "nav.book" },
  { view: "team", key: "nav.team" },
  { view: "visits", key: "nav.visits" },
  { view: "findus", key: "nav.findus" },
];

/** The footer's pages: those this build has. */
const FOOTER: { view: PatientView; key: MessageKey }[] = [
  { view: "prices", key: "nav.prices" },
  { view: "sooner", key: "sooner.footer" },
  { view: "register", key: "nav.register" },
  { view: "prefs", key: "pShell.reminders" },
  { view: "faq", key: "nav.faq" },
];

/** The brand tile: the practice's letters on the accent. */
export const brandTile: CSSProperties = {
  width: 29,
  height: 29,
  flexShrink: 0,
  borderRadius: 9,
  background: "var(--accent)",
  color: "var(--accent-fg)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11.5,
  fontWeight: 800,
  letterSpacing: "-.02em",
};

export function BrandMark({ mark, name }: { mark: string; name: string }) {
  return (
    <>
      <span aria-hidden="true" style={brandTile}>
        {mark.slice(0, 3)}
      </span>
      <span style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: "-.035em", color: "var(--fg)", whiteSpace: "nowrap" }}>{name}</span>
    </>
  );
}

export default function PatientShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const view = useUi((s) => s.view);
  const theme = useUi((s) => s.theme);
  const settings = usePatients((s) => s.catalogue?.settings ?? null);
  const loaded = usePatients((s) => s.catalogue !== null);
  const failed = usePatients((s) => s.catalogueError !== null && s.catalogue === null);
  const narrow = useNarrow();
  const name = settings?.practice_name ?? "";
  const dark = theme === "dark";

  const navOn = (v: PatientView) => view === v || (v === "find" && (view === "details" || view === "confirm"));

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <header style={{ position: "sticky", insetBlockStart: 0, zIndex: 400, background: "var(--surface)", borderBlockEnd: "1px solid var(--border)" }}>
        <div style={{ width: "100%", maxWidth: 980, marginInline: "auto", padding: "14px clamp(16px,3vw,26px)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            className="rh-nav"
            onClick={() => go("find")}
            aria-label={name === "" ? t("nav.book") : `${name} · ${t("nav.book")}`}
            style={{ display: "flex", alignItems: "center", gap: 9, border: "none", background: "transparent", cursor: "pointer", padding: "4px 6px", borderRadius: 10, marginInlineStart: -6, flexShrink: 0 }}
          >
            <BrandMark mark={settings?.mark ?? ""} name={name} />
          </button>
          <nav
            aria-label={t("pShell.nav")}
            className="rh-hide"
            style={
              narrow
                ? { order: 3, flex: "1 1 100%", display: "flex", alignItems: "center", gap: 2, overflowX: "auto", paddingBlockStart: 4 }
                : { marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 2 }
            }
          >
            {NAV.map((n) => {
              const on = navOn(n.view);
              return (
                <button
                  key={n.view}
                  type="button"
                  className="rh-nav"
                  onClick={() => go(n.view)}
                  aria-current={on ? "page" : undefined}
                  style={{
                    height: 33,
                    paddingInline: 12,
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: on ? 800 : 700,
                    background: on ? "var(--accent-soft)" : "transparent",
                    color: on ? "var(--accent)" : "var(--fg-muted)",
                  }}
                >
                  {t(n.key)}
                </button>
              );
            })}
          </nav>
          <span style={narrow ? { marginInlineStart: "auto" } : undefined}>
            <button
              type="button"
              className="rh-gi"
              onClick={() => useUi.setState({ theme: dark ? "light" : "dark" })}
              aria-label={dark ? t("pShell.light") : t("pShell.dark")}
              title={dark ? t("pShell.light") : t("pShell.dark")}
              style={{ width: 33, height: 33, flexShrink: 0, borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            </button>
          </span>
        </div>
      </header>

      <main id="main" tabIndex={-1} style={{ flex: 1, width: "100%", maxWidth: 980, marginInline: "auto", padding: "clamp(20px,3.4vw,34px) clamp(16px,3vw,26px) 120px", outline: "none" }}>
        {failed ? (
          <div role="alert" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)" }}>{t("pShell.loadError")}</p>
            <Btn kind="ghostSm" icon={RotateCw} onClick={() => void loadCatalogue()}>
              {t("common.tryAgain")}
            </Btn>
          </div>
        ) : loaded ? (
          children
        ) : (
          <PageSkeleton />
        )}
      </main>

      <footer style={{ borderBlockStart: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ width: "100%", maxWidth: 980, marginInline: "auto", padding: "20px clamp(16px,3vw,26px) 26px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>
            © {today().slice(0, 4)} {name}
          </span>
          <nav aria-label={t("pShell.more")} style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {FOOTER.map((f) => (
              <button
                key={f.view}
                type="button"
                className="rh-nav"
                onClick={() => go(f.view)}
                aria-current={view === f.view ? "page" : undefined}
                style={{ border: "none", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 800, cursor: "pointer", padding: "2px 0" }}
              >
                {t(f.key)}
              </button>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
