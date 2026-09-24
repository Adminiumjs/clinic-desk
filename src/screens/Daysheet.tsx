/**
 * The day sheet: one day of the practice, a column per clinician.
 *
 * The day on screen is read when the desk moves to it (today's is read at
 * boot) and follows every save, this desk's and another's. Tapping a visit
 * opens its panel. While the desk is placing a visit — a recall, someone from
 * the waiting list, a new booking, a move — the open times for that visit
 * show as dashed buttons, asked of the server per clinician, and tapping one
 * hands the time to whoever started the placing.
 */
import { useEffect, useMemo } from "react";
import { CalendarCheck, CalendarPlus, ChevronLeft, ChevronRight, Armchair, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Appointment, Day, Id, VisitType } from "../data/types.ts";
import { addDays, venueStamp } from "../data/venueTime.ts";
import { useI18n } from "../i18n/index.tsx";
import { rgba, tint } from "../lib/color.ts";
import { now, practiceZone, today } from "../lib/clock.ts";
import { activeClinicians, cliniciansFor, practiceHours, typesOf, visitName, visitsOn } from "../lib/desk.ts";
import { clockOf, dayLong, hhmmOf, minutesOf, num, time } from "../lib/format.ts";
import { useNow } from "../lib/useNow.ts";
import { useDemoSignal } from "../state/demoSignal.ts";
import { ensureDays, useCan, useDesk } from "../state/desk.ts";
import { openSheet, useUi } from "../state/ui.ts";
import { btnPrimary, chipStyle, iconBtnStyle, kicker, pill, Skeleton, useDark } from "../components/ui.tsx";
import { useNarrow } from "../components/desk/useNarrow.ts";
import DayGrid, { hatch, type Column } from "./daysheet/DayGrid.tsx";
import PlacingBanner from "./daysheet/PlacingBanner.tsx";
import { columnState, inBuilding, notArrived, railOf, standing, topOf } from "./daysheet/model.ts";
import { useDayTimes, useTimesStamp, type TimesAsk } from "./daysheet/times.ts";
import { placeFirstRecall } from "./daysheet/placeRecall.ts";

function Chip({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: "fg" | "info" | "warn" }) {
  const colors = { fg: ["var(--surface-3)", "var(--fg-muted)"], info: ["var(--info-soft)", "var(--info)"], warn: ["var(--warn-soft)", "var(--warn)"] }[tone];
  return (
    <span style={pill(colors[0]!, colors[1]!)}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

function Legend({ types, lunch }: { types: VisitType[]; lunch: string | null }) {
  const { t } = useI18n();
  const dark = useDark();
  const item = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" } as const;
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
      {types.map((ty) => (
        <span key={ty.id} style={item}>
          <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: 4, background: rgba(ty.color, dark ? 0.3 : 0.16), borderInlineStart: `3px solid ${tint(ty.color, dark)}` }} />
          {ty.short_name}
        </span>
      ))}
      {lunch !== null && (
        <span style={item}>
          <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: 4, background: hatch(dark, 4).replace("var(--surface-2)", "var(--surface-3)"), border: "1px solid var(--border-strong)", boxSizing: "border-box" }} />
          {lunch}
        </span>
      )}
      <span style={item}>
        <span aria-hidden="true" style={{ width: 11, height: 3, borderRadius: 2, background: "var(--danger)" }} />
        {t("daysheet.legend.now")}
      </span>
    </div>
  );
}

/** The shortest visit a clinician does: the one their "open" count is counted in. */
function shortestType(types: VisitType[]): VisitType | undefined {
  return [...types].filter((ty) => ty.active).sort((a, b) => a.minutes - b.minutes || a.position - b.position)[0];
}

export default function Daysheet() {
  const { t, dir } = useI18n();
  const narrow = useNarrow();
  const nowAt = useNow();
  const todayIs = today();
  const day: Day = useUi((s) => s.sheetDay) ?? todayIs;
  const placing = useUi((s) => s.placing);
  const canBook = useCan("appointments", "create");
  const desk = useDesk();
  const read = desk.daysRead[day] === true;

  useEffect(() => {
    if (!read) void ensureDays(day).catch(() => undefined);
  }, [day, read]);

  useDemoSignal("daysheet.jumpToNow", () => {
    useUi.setState({ sheetDay: today() });
    setTimeout(() => {
      const grid = document.querySelector<HTMLElement>("[data-rh-daygrid]");
      const rail = railOf(useDesk.getState(), today());
      if (grid !== null) grid.scrollTop = Math.max(0, topOf(minutesOf(hhmmOf(now())), rail) - 120);
    }, 60);
  });
  useDemoSignal("daysheet.placeRecall", () => {
    void placeFirstRecall(t);
  });

  const onDay = useMemo(() => standing(visitsOn(desk, day)), [desk, day]);
  const todays = useMemo(() => standing(visitsOn(desk, todayIs)), [desk, todayIs]);
  const rail = railOf(desk, day);
  const clinicians = activeClinicians(desk);
  const types = new Map<Id, VisitType>(desk.visitTypes.map((ty) => [ty.id, ty]));

  // The open times: each clinician's shortest visit for the heads, and the visit being placed.
  const stamp = useTimesStamp([day]);
  const headAsks: TimesAsk[] = [];
  for (const c of clinicians) {
    const ty = shortestType(typesOf(desk, c.id));
    if (ty !== undefined && columnState(desk, c.id, day).kind === "open") headAsks.push({ clinician: c.id, type: ty.id });
  }
  const placeAsks: TimesAsk[] =
    placing === null
      ? []
      : cliniciansFor(desk, placing.typeId)
          .filter((c) => placing.clinicianId === null || c.id === placing.clinicianId)
          .filter((c) => columnState(desk, c.id, day).kind === "open")
          .map((c) => ({ clinician: c.id, type: placing.typeId, ...(placing.exclude === undefined ? {} : { exclude: placing.exclude }) }));
  const heads = useDayTimes(day, headAsks, stamp);
  const places = useDayTimes(day, placeAsks, stamp);

  const byClinician = new Map<Id, Appointment[]>();
  for (const v of onDay) if (v.clinician_id !== null) byClinician.set(v.clinician_id, [...(byClinician.get(v.clinician_id) ?? []), v]);
  const columns: Column[] = clinicians.map((c) => ({
    clinician: c,
    state: columnState(desk, c.id, day),
    visits: byClinician.get(c.id) ?? [],
    open: heads?.get(c.id) ?? null,
    placeable: places?.get(c.id) ?? null,
  }));

  const inside = todays.filter(inBuilding).length;
  const missing = notArrived(todays, nowAt, desk.settings?.no_show_minutes ?? 15).length;
  const hours = practiceHours(desk, day);
  const lunch =
    hours !== null && hours.breakStart !== null && hours.breakEnd !== null
      ? t("daysheet.legend.lunch", { from: time(venueStamp(day, clockOf(hours.breakStart), practiceZone())), to: time(venueStamp(day, clockOf(hours.breakEnd), practiceZone())) })
      : null;
  const isToday = day === todayIs;
  const Prev = dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = dir === "rtl" ? ChevronLeft : ChevronRight;
  const setDay = (d: Day) => useUi.setState({ sheetDay: d });

  return (
    <section className="rh-screen" data-screen="Daysheet" aria-labelledby="daysheet-title" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={kicker}>{t("nav.daysheet")}</div>
          <h1 id="daysheet-title" style={{ margin: "5px 0 0", fontSize: "clamp(21px,2.8vw,27px)", fontWeight: 800, letterSpacing: "-.032em", lineHeight: 1.15 }}>
            {isToday ? t("daysheet.titleToday", { day: dayLong(day) }) : dayLong(day)}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginInlineStart: "auto", flexWrap: "wrap" }}>
          <button type="button" className="rh-gi" onClick={() => setDay(addDays(day, -1))} aria-label={t("daysheet.prev")} title={t("daysheet.prev")} style={iconBtnStyle}>
            <Prev size={15} aria-hidden="true" />
          </button>
          <button type="button" className="rh-chip" onClick={() => setDay(todayIs)} aria-pressed={isToday} style={chipStyle(isToday)}>
            {t("daysheet.today")}
          </button>
          <button type="button" className="rh-gi" onClick={() => setDay(addDays(day, 1))} aria-label={t("daysheet.next")} title={t("daysheet.next")} style={iconBtnStyle}>
            <Next size={15} aria-hidden="true" />
          </button>
          {canBook && (
            <button type="button" className="rh-btn" onClick={() => openSheet({ kind: "book", prefill: { day } })} style={{ ...btnPrimary, height: 36, paddingInline: 14, fontSize: 12.5 }}>
              <CalendarPlus size={15} aria-hidden="true" />
              {t("daysheet.new")}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Chip icon={CalendarCheck} tone="fg" label={t("daysheet.chip.visits", { n: num(onDay.length) }, onDay.length)} />
        <Chip icon={Armchair} tone="info" label={t("daysheet.chip.inside", { n: num(inside) }, inside)} />
        <Chip icon={TriangleAlert} tone={missing > 0 ? "warn" : "fg"} label={t("daysheet.chip.missing", { n: num(missing) }, missing)} />
      </div>

      {placing !== null && <PlacingBanner placing={placing} day={day} />}

      {read ? (
        <DayGrid
          day={day}
          rail={rail}
          columns={columns}
          names={(v) => visitName(desk, v)}
          types={types}
          placing={placing}
          now={isToday ? { minute: minutesOf(hhmmOf(nowAt)), at: nowAt } : null}
          narrow={narrow}
        />
      ) : (
        <Skeleton height={340} radius={16} />
      )}

      <Legend types={[...desk.visitTypes].filter((ty) => ty.active).sort((a, b) => a.position - b.position)} lunch={lunch} />
    </section>
  );
}
