/**
 * Hours & closures: when the doors are open, the closures ahead, and the days
 * an add-on suggests closing.
 *
 * A closure lists the visits still booked inside it — "2 visits already
 * booked in it" — until each is moved or cancelled; reopening a day takes
 * the closure off the diary (and brings it back with "Closed again"), which
 * is a change to the closure row, never a deletion.
 *
 * The holiday add-on's days are SUGGESTIONS: the server's booking rule sees
 * only the closures table, so a public holiday shuts the diary only when
 * someone here adds it as a closure. The add-on's own settings panel is
 * mounted here, in the slot this app hosts.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarX, DoorClosed, Pencil, TriangleAlert } from "lucide-react";

import type { CatalogueSample } from "../add-ons/vendor/host/index.ts";
import { AddOnSlot } from "../add-ons/slot.tsx";
import { DAY_SOURCES, addOnClosures, closureFor, dormantDayCounts } from "../add-ons/closures.ts";
import { AddOnAttributions, Affiliation, SourceChip } from "../components/Affiliation.tsx";
import type { Closure, Weekday } from "../data/types.ts";
import { addDays } from "../data/venueTime.ts";
import { useI18n } from "../i18n/index.tsx";
import { today } from "../lib/clock.ts";
import { dayLong, dayShort, daysBetween, weekdayLong } from "../lib/format.ts";
import { activeClinicians, clinicianOf, weekdayOf } from "../lib/desk.ts";
import { setClosureActive } from "../state/actions.ts";
import { useAddOns } from "../state/addOns.ts";
import { ensureDays, useCan, useDesk } from "../state/desk.ts";
import { useDemoSignal } from "../state/demoSignal.ts";
import { openSheet, toast } from "../state/ui.ts";
import { Btn, Tile, btnGhostSm, btnPrimary, mono, monoPill, pill } from "../components/ui.tsx";
import { counted, wallTime } from "./deskwork/dates.ts";
import { closureClashes, hoursLines, type HoursLine } from "./deskwork/rules.ts";
import { Screen, ScreenHead, cardStyle, footNote, groupLabel, sectionTitle } from "./deskwork/parts.tsx";

/** A Monday, so a weekday's name can be written in the page's language. */
const A_MONDAY = "2026-01-05";
const WEEK: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const weekdayName = (d: Weekday): string => weekdayLong(addDays(A_MONDAY, WEEK.indexOf(d)));
const range = (from: string, to: string): string => `${wallTime(from)} – ${wallTime(to)}`;
/** A closure's clashes are read for at most this many days ahead of its start. */
const CLASH_DAYS = 31;

export default function Hours() {
  const { t } = useI18n();
  const day = today();
  const desk = useDesk();
  const canEditHours = useCan("opening_hours", "update");
  const canAddClosure = useCan("closures", "create");

  const ahead = useMemo(() => desk.closures.filter((c) => c.to_date >= day).sort((a, b) => a.from_date.localeCompare(b.from_date) || a.id - b.id), [desk.closures, day]);

  // The days each closure covers, so its clashes can be counted.
  useEffect(() => {
    for (const c of ahead) {
      const from = c.from_date < day ? day : c.from_date;
      void ensureDays(from, Math.min(CLASH_DAYS, daysBetween(from, c.to_date) + 1)).catch(() => undefined);
    }
  }, [ahead, day]);

  // The card's "Add a sample closure": the last clinician on the list, away the day after tomorrow.
  useDemoSignal("hours.sampleClosure", () => {
    const who = activeClinicians(desk).at(-1);
    if (who === undefined) return;
    let on = addDays(day, 2);
    while (weekdayOf(on) === "sat" || weekdayOf(on) === "sun") on = addDays(on, 1);
    // INTEGRATOR: these two lines are the demo's words; move them to the demo strings with the other fills.
    openSheet({ kind: "closure", prefill: { clinicianId: who.id, from: on, to: on, label: t("hours.sample.label", { name: who.short_name }), note: t("hours.sample.note", { name: who.short_name }) } });
  });

  const lines = hoursLines(desk.hours);
  const slot = desk.settings?.slot_minutes ?? 15;
  const slotText = slot === 15 ? t("hours.grid.quarter") : slot === 30 ? t("hours.grid.half") : slot === 60 ? t("hours.grid.hour") : t("hours.grid.every", counted(slot), slot);
  const rows: { id: string; label: string; value: string }[] = [];
  const push = (line: HoursLine) => rows.push(hoursRow(line, t));
  const weekend = lines.filter((l) => l.kind === "weekendClosed" || (l.kind === "day" && (l.weekday === "sat" || l.weekday === "sun")));
  lines.filter((l) => !weekend.includes(l)).forEach(push);
  rows.push({ id: "slot", label: t("hours.slotGrid"), value: slotText });
  weekend.forEach(push);

  return (
    <Screen name="Hours">
      <ScreenHead kicker={t("nav.hours")} title={t("hours.title")} />
      <section aria-labelledby="hr-open" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 14 }}>
          <h2 id="hr-open" style={sectionTitle}>
            {t("hours.opening")}
          </h2>
          {canEditHours && (
            <button type="button" className="rh-btn" onClick={() => openSheet({ kind: "hours" })} style={{ ...btnGhostSm, height: 32, marginInlineStart: "auto" }}>
              <Pencil size={13} aria-hidden="true" />
              {t("hours.edit")}
            </button>
          )}
        </div>
        <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBlockEnd: 10, borderBlockEnd: "1px solid var(--border)", flexWrap: "wrap" }}>
              <dt style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-muted)" }}>{r.label}</dt>
              <dd style={{ margin: 0, marginInlineStart: "auto", ...mono(13, 600, "var(--fg)"), whiteSpace: "normal", textAlign: "end" }}>{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div>
        {canAddClosure && (
          <button type="button" className="rh-btn" onClick={() => openSheet({ kind: "closure" })} style={{ ...btnPrimary, height: 40, marginBlockEnd: 16 }}>
            <CalendarX size={15} aria-hidden="true" />
            {t("hours.addClosure")}
          </button>
        )}
        <h2 style={groupLabel}>{t("hours.ahead")}</h2>
        <ul style={{ listStyle: "none", margin: "11px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {ahead.map((c) => (
            <li key={c.id}>
              <ClosureRow closure={c} />
            </li>
          ))}
        </ul>
        {ahead.length === 0 && <div style={{ marginBlockStart: 11, fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>{t("hours.none")}</div>}
        <p style={{ ...footNote, marginBlockStart: 12 }}>{t("hours.foot")}</p>
      </div>

      <AddOnDays />
    </Screen>
  );
}

function hoursRow(line: HoursLine, t: ReturnType<typeof useI18n>["t"]): { id: string; label: string; value: string } {
  switch (line.kind) {
    case "weekdays":
      return { id: line.id, label: t("hours.monFri"), value: range(line.opens, line.closes) };
    case "break":
      return { id: line.id, label: t("hours.deskClosed"), value: range(line.from, line.to) };
    case "weekendClosed":
      return { id: line.id, label: t("hours.weekend"), value: t("hours.closed") };
    case "day":
      return {
        id: line.id,
        label: weekdayName(line.weekday),
        value: !line.open
          ? t("hours.closed")
          : line.breakFrom !== null && line.breakTo !== null
            ? t("hours.dayWithBreak", { hours: range(line.opens, line.closes), desk: range(line.breakFrom, line.breakTo) })
            : range(line.opens, line.closes),
      };
  }
}

function ClosureRow({ closure: c }: { closure: Closure }) {
  const { t } = useI18n();
  const desk = useDesk();
  const canToggle = useCan("closures", "update");
  const [busy, setBusy] = useState(false);
  const whole = c.clinician_id === null;
  const clinician = clinicianOf(desk, c.clinician_id);
  const clashes = c.active ? closureClashes(c, Object.values(desk.visits)).length : 0;
  const span = c.from_date === c.to_date ? dayShort(c.from_date) : `${dayShort(c.from_date)} – ${dayShort(c.to_date)}`;

  const toggle = async () => {
    setBusy(true);
    const outcome = await setClosureActive(c.id, !c.active);
    setBusy(false);
    if (!outcome.ok) toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
    else toast(c.active ? t("hours.reopened", { label: c.label }) : t("hours.closedAgain", { label: c.label }), { icon: "calendar-cog" });
  };

  return (
    <div
      className="rh-row"
      style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 15px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", ...(c.active ? {} : { background: "var(--surface-2)" }) }}
    >
      {whole ? (
        <span aria-hidden="true" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 12, background: "var(--surface-3)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <DoorClosed size={16} />
        </span>
      ) : (
        <Tile name={clinician?.name ?? ""} color={clinician?.color ?? "#0369a1"} size={36} />
      )}
      <span style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em", color: c.active ? "var(--fg)" : "var(--fg-muted)" }}>{c.label}</span>
          <span style={pill(whole ? "var(--danger-soft)" : "var(--warn-soft)", whole ? "var(--danger)" : "var(--warn)")}>{whole ? t("hours.whole") : (clinician?.short_name ?? "")}</span>
          {!c.active && <span style={pill("var(--surface-3)", "var(--fg-muted)")}>{t("hours.reopenedPill")}</span>}
        </span>
        {(c.note ?? "").trim() !== "" && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-muted)", textWrap: "pretty" }}>{c.note}</span>}
        {clashes > 0 && (
          <span style={{ alignSelf: "flex-start", ...monoPill("var(--danger-soft)", "var(--danger)") }}>
            <TriangleAlert size={11} aria-hidden="true" />
            {t("hours.clash", counted(clashes), clashes)}
          </span>
        )}
      </span>
      <span style={mono(12, 600, c.active ? "var(--fg)" : "var(--fg-subtle)")}>{span}</span>
      {canToggle && (
        <Btn kind="ghostSm" busy={busy} onClick={() => void toggle()} style={{ height: 36, ...(c.active ? {} : { color: "var(--accent)" }) }} label={c.active ? t("hours.reopenLabel", { label: c.label }) : t("hours.closeAgainLabel", { label: c.label })}>
          {c.active ? t("hours.reopen") : t("hours.closeAgain")}
        </Btn>
      )}
    </div>
  );
}

/**
 * The add-ons that can supply closing days: each one's switch and its own
 * settings (the hosted slot), and the days they suggest that no closure
 * covers yet, each with "Add as a closure".
 */
function AddOnDays() {
  const { t, tAddOn } = useI18n();
  const day = today();
  const registry = useAddOns((s) => s.registry);
  const enabled = useAddOns((s) => s.enabled);
  const addOnSettings = useAddOns((s) => s.addOnSettings);
  const toggleAddOn = useAddOns((s) => s.toggleAddOn);
  const patchAddOnSettings = useAddOns((s) => s.patchAddOnSettings);
  const closures = useDesk((s) => s.closures);
  const visitTypes = useDesk((s) => s.visitTypes);
  const currency = useDesk((s) => s.settings?.currency ?? "GBP");
  const canAdd = useCan("closures", "create");
  const canSwitch = useCan("settings", "update");

  // What a practice offers is kinds of visit: one of each, at its fee. Nothing about a person.
  const samples = useMemo<readonly CatalogueSample[]>(
    () => visitTypes.filter((v) => v.active).map((v) => ({ key: String(v.id), label: v.name, quantity: 1, unitPrice: { amount: v.fee, currency } })),
    [visitTypes, currency],
  );
  const dormant = useMemo(() => new Map(dormantDayCounts(DAY_SOURCES, enabled, addOnSettings).map((r) => [r.addOn, r.days])), [enabled, addOnSettings]);
  // A day already shut for the whole practice is not suggested again.
  const suggested = addOnClosures(DAY_SOURCES, enabled, addOnSettings).filter(
    (d) => d.date >= day && !closures.some((c) => c.active && c.clinician_id === null && c.from_date <= d.date && d.date <= c.to_date),
  );

  return (
    <section aria-labelledby="hr-addons" style={cardStyle}>
      <h2 id="hr-addons" style={sectionTitle}>
        {t("hours.addOns.title")}
      </h2>
      <p style={{ margin: "6px 0 0", fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("hours.addOns.sub")}</p>
      {registry.all.length === 0 ? (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)" }}>{t("hours.addOns.none")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBlockStart: 14 }}>
          {registry.all.map((addOn) => {
            const on = enabled.has(addOn.key);
            const held = dormant.get(addOn.key) ?? 0;
            return (
              <div key={addOn.key} style={{ padding: 14, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
                  <span aria-hidden="true" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                    {addOn.monogram}
                  </span>
                  <span style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 2 }}>
                    <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" }}>{addOn.name}</h3>
                    <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-muted)" }}>{tAddOn(addOn.lineKey)}</span>
                  </span>
                  {on && <span style={pill("var(--pos-soft)", "var(--pos)")}>{t("hours.addOns.isOn")}</span>}
                  {canSwitch && (
                    <button type="button" className="rh-btn" onClick={() => toggleAddOn(addOn.key)} style={{ ...(on ? btnGhostSm : { ...btnPrimary, height: 36, fontSize: 12.5 }) }}>
                      {on ? t("hours.addOns.off") : t("hours.addOns.on")}
                    </button>
                  )}
                </div>
                <Affiliation addOn={addOn} style={{ margin: 0, fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-subtle)" }} />
                {!on && held > 0 && (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-muted)" }}>
                    {t("hours.addOns.dormant", counted(held), held)} {t("hours.addOns.dormantHow")}
                  </p>
                )}
                {on && (
                  <AddOnSlot
                    slot="settings.add-on.panel"
                    forAddOn={addOn.key}
                    payload={{ patch: (values) => patchAddOnSettings(addOn.key, values), samples }}
                    fallback={<p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--fg-muted)" }}>{t("hours.addOns.slotEmpty")}</p>}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {enabled.size > 0 && (
        <div style={{ marginBlockStart: 16 }}>
          <h3 style={groupLabel}>{t("hours.addOns.suggested")}</h3>
          {suggested.length === 0 ? (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)" }}>{t("hours.addOns.nothing")}</p>
          ) : (
            <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {suggested.map((d) => (
                <li key={`${d.date}·${d.from ?? ""}·${d.reason}`} className="rh-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", borderRadius: 13, border: "1px solid var(--border)", background: "var(--surface)" }}>
                  <span style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" }}>{d.reason}</span>
                    <span style={mono(11.5, 600, "var(--fg-subtle)")}>{dayLong(d.date)}</span>
                  </span>
                  {d.from !== null && <SourceChip addOnKey={d.from} messageKey="addon.host.fromAddOn" style={{ ...pill("var(--surface-3)", "var(--fg-muted)") }} />}
                  {canAdd && (
                    <button
                      type="button"
                      className="rh-btn"
                      onClick={() => openSheet({ kind: "closure", prefill: closureFor(d) })}
                      aria-label={t("hours.addOns.addAsFor", { name: d.reason })}
                      style={{ ...btnGhostSm, height: 34 }}
                    >
                      <CalendarX size={14} aria-hidden="true" />
                      {t("hours.addOns.addAs")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <AddOnAttributions from={suggested.map((d) => d.from)} />
        </div>
      )}
    </section>
  );
}
