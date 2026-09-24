/**
 * The week diary: each clinician's week at a glance — how many visits a day,
 * how many open times are left, and a bar for how much of their own hours
 * those visits take. The days are the ones the practice opens that week.
 * Tapping a day opens it on the day sheet.
 */
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { Day, VisitType } from "../data/types.ts";
import { addDays } from "../data/venueTime.ts";
import { useI18n } from "../i18n/index.tsx";
import { tint } from "../lib/color.ts";
import { today } from "../lib/clock.ts";
import { activeClinicians, typesOf, visitsOn } from "../lib/desk.ts";
import { dayMonth, num, weekdayShort } from "../lib/format.ts";
import { ensureDays, useDesk } from "../state/desk.ts";
import { go, useUi } from "../state/ui.ts";
import { chipStyle, iconBtnStyle, kicker, mono, Tile, useDark } from "../components/ui.tsx";
import { mondayOf, weekCell, weekDays } from "./daysheet/model.ts";
import { useTimesStamp, useWeekDays, type TimesAsk } from "./daysheet/times.ts";

const shortest = (types: VisitType[]): VisitType | undefined => [...types].filter((ty) => ty.active).sort((a, b) => a.minutes - b.minutes || a.position - b.position)[0];

export default function Week() {
  const { t, dir, number } = useI18n();
  const dark = useDark();
  const todayIs = today();
  const monday = mondayOf(useUi((s) => s.weekOf) ?? todayIs);
  const desk = useDesk();
  const read = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).every((d) => desk.daysRead[d] === true);

  useEffect(() => {
    if (!read) void ensureDays(monday, 7).catch(() => undefined);
  }, [monday, read]);

  const days = weekDays(desk, monday);
  const clinicians = activeClinicians(desk);
  const asks: TimesAsk[] = [];
  for (const c of clinicians) {
    const ty = shortest(typesOf(desk, c.id));
    if (ty !== undefined) asks.push({ clinician: c.id, type: ty.id });
  }
  const stamp = useTimesStamp(days);
  const open = useWeekDays(monday, 7, asks, stamp);

  const first = days[0] ?? monday;
  const last = days[days.length - 1] ?? addDays(monday, 4);
  const thisWeek = days.includes(todayIs) || mondayOf(todayIs) === monday;
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  const setWeek = (d: Day) => useUi.setState({ weekOf: d });
  const openDay = (d: Day) => {
    go("daysheet");
    useUi.setState({ sheetDay: d });
  };

  return (
    <section className="rh-screen" data-screen="Week" aria-labelledby="week-title" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={kicker}>{t("nav.week")}</div>
          <h1 id="week-title" style={{ margin: "5px 0 0", fontSize: "clamp(21px,2.8vw,27px)", fontWeight: 800, letterSpacing: "-.032em", lineHeight: "normal" }}>
            {t("week.title", { from: dayMonth(first), to: dayMonth(last), year: number(Number(last.slice(0, 4)), { useGrouping: false }) })}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginInlineStart: "auto" }}>
          <button type="button" className="rh-gi" onClick={() => setWeek(addDays(monday, -7))} aria-label={t("week.prev")} title={t("week.prev")} style={iconBtnStyle}>
            <Prev size={15} aria-hidden="true" />
          </button>
          <button type="button" className="rh-chip" onClick={() => setWeek(todayIs)} aria-pressed={thisWeek} style={chipStyle(thisWeek)}>
            {t("week.this")}
          </button>
          <button type="button" className="rh-gi" onClick={() => setWeek(addDays(monday, 7))} aria-label={t("week.next")} title={t("week.next")} style={iconBtnStyle}>
            <Next size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rh-scroll" style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)", overflowX: "auto" }}>
        <table style={{ minWidth: 660, width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <caption style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>{t("week.caption")}</caption>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBlockEnd: "1px solid var(--border)" }}>
              <td style={{ width: 152, borderInlineEnd: "1px solid var(--border)" }} />
              {days.map((d) => {
                const on = d === todayIs;
                return (
                  <th key={d} scope="col" style={{ minWidth: 104, padding: "10px 8px", borderInlineEnd: "1px solid var(--border)", background: on ? "var(--accent-soft)" : undefined, fontWeight: "inherit" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: on ? "var(--accent)" : "var(--fg-subtle)" }}>{weekdayShort(d)}</span>
                      <span style={mono(12, 600, on ? "var(--accent)" : "var(--fg)")}>{dayMonth(d)}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {clinicians.map((c) => {
              const states = open?.get(c.id) ?? null;
              return (
                <tr key={c.id} style={{ borderBlockEnd: "1px solid var(--border)" }}>
                  <th scope="row" style={{ width: 152, padding: 12, borderInlineEnd: "1px solid var(--border)", fontWeight: "inherit", textAlign: "start" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Tile name={c.name} color={c.color} size={30} />
                      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "-.022em", whiteSpace: "nowrap" }}>{c.short_name}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>{c.role_label}</span>
                      </span>
                    </span>
                  </th>
                  {days.map((d) => {
                    const cell = weekCell(desk, visitsOn(desk, d), c.id, d);
                    const off = cell.kind !== "working";
                    const state = states?.find((x) => x.date === d);
                    const label =
                      cell.kind === "closed" ? t("week.closed") : cell.kind === "away" ? t("week.away") : cell.kind === "notIn" ? t("week.notIn") : t("week.visits", { n: num(cell.visits) }, cell.visits);
                    // A past day, or one beyond the booking window, has no open times to count.
                    const sub = off || state === undefined || state.state === "closed" ? null : state.open > 0 ? t("week.open", { n: num(state.open) }, state.open) : t("week.full");
                    const percent = cell.kind === "working" ? cell.percent : 0;
                    return (
                      <td key={d} style={{ padding: 0, borderInlineEnd: "1px solid var(--border)", background: off ? "var(--surface-2)" : "transparent", verticalAlign: "top" }}>
                        <button
                          type="button"
                          className="rh-row"
                          disabled={off}
                          onClick={() => openDay(d)}
                          aria-label={t("week.cell", { clinician: c.short_name, day: `${weekdayShort(d)} ${dayMonth(d)}`, what: sub === null ? label : `${label}, ${sub}` })}
                          style={{ width: "100%", minHeight: 71, display: "flex", flexDirection: "column", gap: 2, padding: "11px 10px", cursor: off ? "default" : "pointer", textAlign: "start", border: "none", background: "transparent" }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "-.02em", color: off ? "var(--fg-subtle)" : "var(--fg)" }}>{label}</span>
                          <span style={{ ...mono(10.5, 600, state !== undefined && state.open > 0 ? "var(--pos)" : "var(--warn)"), direction: "inherit", minHeight: 14 }}>{sub ?? ""}</span>
                          <span aria-hidden="true" style={{ display: "block", width: "100%", height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden", marginBlockStart: 7 }}>
                            <span style={{ display: "block", height: "100%", width: `${String(percent)}%`, borderRadius: 3, background: tint(c.color, dark) }} />
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("week.note")}</p>
    </section>
  );
}
