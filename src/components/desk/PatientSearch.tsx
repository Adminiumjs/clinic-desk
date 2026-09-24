/**
 * The header's "Find a patient": the server searches names and mobile
 * numbers as the desk types (from two characters), and picking someone opens
 * their page on Patients.
 *
 * The list under the field is a real list of buttons: Down moves into it,
 * Up and Down move through it, Escape empties the search and returns to the
 * field. A line only screen readers hear says how many were found.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";

import type { Patient } from "../../data/types.ts";
import { useI18n } from "../../i18n/index.tsx";
import { today } from "../../lib/clock.ts";
import { ageOn, num } from "../../lib/format.ts";
import { deskReads, useDesk } from "../../state/desk.ts";
import { go, useUi } from "../../state/ui.ts";
import { fieldStyle, mono, tileStyle, useDark } from "../ui.tsx";
import { initials } from "../../lib/color.ts";

/** The colour the design gives a patient's tile in the search. */
const PATIENT_TILE = "#3b6fbd";
const WAIT_MS = 200;

export default function PatientSearch() {
  const { t } = useI18n();
  const dark = useDark();
  const listId = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Patient[] | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const trimmed = q.trim();
  const open = trimmed.length > 1;

  useEffect(() => {
    if (!open) {
      setHits(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      deskReads()
        .search({ q: trimmed, limit: 6, offset: 0 }, today())
        .then(({ rows }) => {
          if (!live) return;
          useDesk.setState((s) => ({ patients: { ...s.patients, ...Object.fromEntries(rows.map((p) => [p.id, p])) } }));
          setHits(rows.slice(0, 6));
        })
        .catch(() => {
          if (live) setHits([]);
        });
    }, WAIT_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, trimmed]);

  const pick = (p: Patient) => {
    setQ("");
    go("patients");
    useUi.setState({ patientId: p.id });
  };

  const buttons = () => [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
  const onFieldKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons()[0]?.focus();
    } else if (e.key === "Escape") setQ("");
  };
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = buttons();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      all[Math.min(all.length - 1, at + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (at <= 0) field.current?.focus();
      else all[at - 1]?.focus();
    } else if (e.key === "Escape") {
      setQ("");
      field.current?.focus();
    }
  };

  const day = today();
  return (
    <div style={{ flex: 1, minWidth: 0, maxWidth: 360, position: "relative" }}>
      <Search size={15} aria-hidden="true" style={{ position: "absolute", insetInlineStart: 11, insetBlockStart: 11, color: "var(--fg-subtle)", pointerEvents: "none" }} />
      <input
        ref={field}
        type="search"
        className="rh-fld"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onFieldKey}
        placeholder={t("shell.search.placeholder")}
        aria-label={t("shell.search.label")}
        aria-controls={open ? listId : undefined}
        autoComplete="off"
        style={{ ...fieldStyle(false), paddingInlineStart: 34 }}
      />
      <span role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {open && hits !== null ? (hits.length === 0 ? t("shell.search.none") : t("shell.search.found", { n: num(hits.length) }, hits.length)) : ""}
      </span>
      {open && hits !== null && (
        <div
          id={listId}
          ref={list}
          onKeyDown={onListKey}
          style={{ position: "absolute", insetInline: 0, insetBlockStart: 44, zIndex: 420, padding: 6, borderRadius: 13, border: "1px solid var(--border-strong)", background: "var(--surface)", boxShadow: "0 24px 50px -22px rgba(10,10,25,.4)", display: "flex", flexDirection: "column", gap: 2, maxHeight: 300, overflowY: "auto", animation: "rh-pop .14s ease" }}
        >
          {hits.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rh-nav"
              onClick={() => pick(p)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 9px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "start" }}
            >
              <span aria-hidden="true" style={tileStyle(PATIENT_TILE, dark, 30)}>
                {initials(p.name)}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-.02em", color: "var(--fg)" }}>{p.name}</span>
                <span style={{ ...mono(11, 600, "var(--fg-subtle)"), direction: "inherit" }}>{t("shell.search.meta", { born: p.born_on, age: num(ageOn(p.born_on, day)) })}</span>
              </span>
            </button>
          ))}
          {hits.length === 0 && <div style={{ padding: 12, fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{t("shell.search.none")}</div>}
        </div>
      )}
    </div>
  );
}
