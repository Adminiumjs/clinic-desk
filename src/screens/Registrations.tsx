/**
 * Registrations: everyone who registered, or booked a first visit, online —
 * the people the desk has to check before they become patients.
 *
 * Three tabs with their counts: To check, Rang (the desk rang and is waiting
 * to hear back) and Done (handled in the last two weeks, with how each
 * ended). Oldest first, so nobody waits at the bottom of the list. A row
 * opens the item's sheet, where the desk accepts, joins, rings or declines.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Hourglass, Inbox, UserPlus } from "lucide-react";

import { useI18n } from "../i18n/index.tsx";
import { useNow } from "../lib/useNow.ts";
import { dayOf } from "../lib/format.ts";
import { chipStyle, monoPill, pill, Skeleton, Tile, kicker, mono } from "../components/ui.tsx";
import { ensurePatients, useDesk } from "../state/desk.ts";
import { openSheet } from "../state/ui.ts";
import { registrationItems, type RegItem, type RegTab } from "../sheets/bits/logic.ts";
import { metaLine, newcomerColor, outcomeLine, personOf, sourceLine, waited } from "../sheets/registration/shared.ts";

const TABS: RegTab[] = ["check", "rang", "done"];

export default function Registrations() {
  const { t, dir } = useI18n();
  const nowMs = useNow();
  const today = dayOf(nowMs);
  const desk = useDesk();
  const [tab, setTab] = useState<RegTab>("check");

  const items = useMemo(() => registrationItems(desk, today), [desk, today]);
  const shown = items.filter((i) => i.tab === tab);
  const color = newcomerColor(desk.visitTypes);

  // "Same person as …" names the patient an item was joined to; read the ones not held yet.
  const joined = items.filter((i) => i.tab === "done").map((i) => i.row.patient_id);
  const joinedKey = joined.join(",");
  useEffect(() => {
    void ensurePatients(joined).catch(() => undefined);
    // The list of ids is the dependency; the array itself is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinedKey]);

  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;
  const empty = { check: t("registrations.empty.check"), rang: t("registrations.empty.rang"), done: t("registrations.empty.done") }[tab];

  return (
    <section className="rh-screen" data-screen="Registrations" aria-labelledby="regs-h" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={kicker}>{t("nav.registrations")}</div>
        <h1 id="regs-h" style={{ margin: "5px 0 0", fontSize: "clamp(21px,2.8vw,27px)", fontWeight: 800, letterSpacing: "-.032em", lineHeight: "normal" }}>
          {t("registrations.title")}
        </h1>
        <p style={{ margin: "8px 0 0", maxWidth: "56ch", fontSize: 13.5, fontWeight: 500, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("registrations.lede")}</p>
      </div>

      <div role="group" aria-label={t("registrations.filters")} style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {TABS.map((id) => {
          const on = tab === id;
          const count = items.filter((i) => i.tab === id).length;
          return (
            <button key={id} type="button" className="rh-chip" aria-pressed={on} onClick={() => setTab(id)} style={chipStyle(on)}>
              {t(`registrations.tab.${id}`)}
              <span style={{ ...mono(10.5, 600, on ? "var(--accent-fg)" : "var(--fg-subtle)"), padding: "1px 6px", borderRadius: 999, background: on ? "rgba(255,255,255,.22)" : "var(--surface-3)" }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {desk.load === "loading" ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={78} radius={14} />)
        ) : shown.length === 0 ? (
          <div
            role="status"
            style={{ display: "flex", alignItems: "center", gap: 12, padding: 20, borderRadius: 14, border: "1px dashed var(--border-strong)", background: "var(--surface-2)", fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}
          >
            <Inbox size={18} aria-hidden="true" style={{ color: "var(--fg-subtle)", flexShrink: 0 }} />
            {empty}
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {shown.map((item) => (
              <li key={`${item.kind}-${String(item.id)}`}>
                <Row item={item} color={color} today={today} Chevron={Chevron} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Row({ item, color, today, Chevron }: { item: RegItem; color: string; today: string; Chevron: typeof ChevronRight }) {
  const { t } = useI18n();
  const desk = useDesk();
  const person = personOf(item);
  const wait = waited(t, item.since, today);
  const late = wait.days >= 2 && item.tab !== "done";
  const outcome = outcomeLine(t, desk, item);
  const isReg = item.kind === "registration";
  const SrcIcon = isReg ? UserPlus : CalendarCheck;
  return (
    <button
      type="button"
      className="rh-row"
      onClick={() => openSheet({ kind: "registration", item: { kind: item.kind, id: item.id } })}
      style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap", width: "100%", padding: "13px 15px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "start" }}
    >
      <Tile name={person.name} color={color} size={38} />
      <span style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em", color: "var(--fg)" }}>{person.name}</span>
        <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), whiteSpace: "normal", alignSelf: "flex-start" }}>{metaLine(t, person, today)}</span>
        <span style={{ alignSelf: "flex-start", ...pill(isReg ? "var(--accent-soft)" : "var(--info-soft)", isReg ? "var(--accent)" : "var(--info)"), whiteSpace: "normal" }}>
          <SrcIcon size={11} aria-hidden="true" />
          {sourceLine(t, desk, item)}
        </span>
      </span>
      {outcome !== null && <span style={{ ...pill("var(--pos-soft)", "var(--pos)"), whiteSpace: "normal" }}>{outcome}</span>}
      <span style={monoPill(late ? "var(--warn-soft)" : "var(--surface-3)", late ? "var(--warn)" : "var(--fg-muted)")}>
        <Hourglass size={12} aria-hidden="true" />
        <span className="rh-sr-only">{t("registrations.waitedLabel")} </span>
        {wait.text}
      </span>
      <Chevron size={16} aria-hidden="true" style={{ color: "var(--fg-subtle)", flexShrink: 0 }} />
    </button>
  );
}
