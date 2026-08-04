/**
 * The demo dock.
 *
 * A fixed panel holding everything that makes this a demo rather than a
 * product: the persona segment, the clock, the theme toggle, the locale picker
 * and a reset. It is deliberately labelled "Demo controls" so nobody mistakes it
 * for a feature of the practice's software.
 *
 * The "+15 min" chip is the ONLY thing in the app that moves time. One tap
 * re-derives every waiting chip, opens the no-show window on whoever has just
 * crossed fifteen minutes, and greys out the slots that have gone — all of it
 * falling out of the engine reading the new clock.
 *
 * House layout rule 1 is enforced here: whenever an overlay owns the screen —
 * the visit panel, the cancel confirm, the card sheet, the mobile nav — the dock
 * moves to the opposite inline corner rather than sitting on top of a primary
 * action. `--shifted` swaps `inset-inline-end` for `inset-inline-start`, which
 * mirrors correctly in RTL without a second rule.
 */

import { ChevronDown, Clock3, Moon, RotateCcw, Settings2, Sun } from "lucide-react";

import { LOCALES, LOCALE_TAGS, useI18n, type LocaleTag } from "../i18n/index.tsx";
import { useStore } from "../state/store.ts";
import type { Persona } from "../data/types.ts";
import { clock } from "../lib/format.ts";
import { Segmented } from "./Primitives.tsx";

export default function DemoDock() {
  const { t, locale, setLocale } = useI18n();
  const persona = useStore((s) => s.persona);
  const setPersona = useStore((s) => s.setPersona);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const open = useStore((s) => s.dockOpen);
  const setOpen = useStore((s) => s.setDockOpen);
  const reset = useStore((s) => s.reset);
  const shifted = useStore((s) => s.overlayOpen);
  const now = useStore((s) => s.now);
  const advanceClock = useStore((s) => s.advanceClock);

  if (!open) {
    return (
      <button
        type="button"
        className={`rh-dock__mini rh-btn${shifted ? " rh-dock--shifted" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={t("chrome.dock.expand")}
      >
        <Settings2 size={15} aria-hidden="true" />
        {t("chrome.dock.title")}
      </button>
    );
  }

  return (
    <aside
      className={`rh-dock${shifted ? " rh-dock--shifted" : ""}`}
      aria-label={t("chrome.dock.title")}
    >
      <div className="rh-dock__head">
        <Settings2 size={13} aria-hidden="true" />
        {t("chrome.dock.title")}
        <button
          type="button"
          className="rh-dock__collapse"
          onClick={() => setOpen(false)}
          aria-label={t("chrome.dock.collapse")}
        >
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>

      <Segmented<Persona>
        full
        ariaLabel={t("chrome.dock.persona")}
        value={persona}
        onChange={setPersona}
        options={[
          { value: "patient", label: t("chrome.dock.patient") },
          { value: "clinic", label: t("chrome.dock.clinic") },
        ]}
      />

      <div className="rh-dock__row">
        <span className="rh-dock__label">{t("chrome.dock.clock")}</span>
        <span className="rh-dock__clock rh-mono">
          <Clock3 size={13} aria-hidden="true" />
          {clock(now.minutes)}
        </span>
        <button
          type="button"
          className="rh-dock__tick rh-btn rh-mono"
          onClick={advanceClock}
          aria-label={t("chrome.dock.advance.label")}
          title={t("chrome.dock.advance.label")}
        >
          {t("chrome.dock.advance")}
        </button>
      </div>

      <div className="rh-dock__row">
        <span className="rh-dock__label">{t("chrome.dock.language")}</span>
        <select
          className="rh-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as LocaleTag)}
          aria-label={t("chrome.dock.language")}
        >
          {LOCALE_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {LOCALES[tag].native}
            </option>
          ))}
        </select>
      </div>

      <div className="rh-dock__row">
        <span className="rh-dock__label">{t("chrome.dock.theme")}</span>
        <button
          type="button"
          className="rh-iconbtn rh-btn"
          onClick={toggleTheme}
          aria-label={t(theme === "dark" ? "chrome.dock.theme.light" : "chrome.dock.theme.dark")}
          title={t(theme === "dark" ? "chrome.dock.theme.light" : "chrome.dock.theme.dark")}
        >
          {theme === "dark" ? (
            <Sun size={16} aria-hidden="true" />
          ) : (
            <Moon size={16} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="rh-iconbtn rh-btn"
          onClick={reset}
          aria-label={t("chrome.dock.reset")}
          title={t("chrome.dock.reset")}
          style={{ marginInlineStart: "auto" }}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
