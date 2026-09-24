/**
 * The day sheet's grid: a column per clinician (in their order), the time
 * rail down the start edge, each visit as a block at its time and length,
 * the stretches nobody can be booked into hatched (the lunch close, before
 * opening and after closing, a day they are away), the now line, and — while
 * the desk is placing a visit — the open times as dashed buttons.
 *
 * A quarter of an hour is 64 px, as drawn. Below 900 px the columns scroll
 * sideways under a fixed rail, with the heads following.
 */
import { useRef, type CSSProperties } from "react";

import type { SlotTime } from "../../data/ports.ts";
import type { Appointment, Clinician, Day, Id, VisitType } from "../../data/types.ts";
import { venueStamp } from "../../data/venueTime.ts";
import { useI18n } from "../../i18n/index.tsx";
import { initials, rgba, tint } from "../../lib/color.ts";
import { practiceZone } from "../../lib/clock.ts";
import { clockOf, dayLong, hhmmOf, minutesOf, num, time, timeRange } from "../../lib/format.ts";
import type { Placing } from "../../state/ui.ts";
import { openPanel } from "../../state/ui.ts";
import { mono, STATUS_META, tileStyle, useDark } from "../../components/ui.tsx";
import { PX_PER_MINUTE, QUARTER_PX, railMarks, shutBands, topOf, type ColumnState, type Rail } from "./model.ts";

export interface Column {
  clinician: Clinician;
  state: ColumnState;
  visits: Appointment[];
  /** The clinician's open times for their shortest visit, when read. */
  open: SlotTime[] | null;
  /** While placing: the open times for the visit being placed, when this clinician does that type. */
  placeable: SlotTime[] | null;
}

const RAIL_W = 58;
/**
 * The now chip's red. The design uses the theme's danger colour, which in the
 * dark theme is a light red that white text cannot be read on; the light
 * theme's deeper red reads on both grounds.
 */
const NOW_RED = "#cf273c";

/** The design's diagonal hatch for a stretch nobody can be booked into. */
export const hatch = (dark: boolean, size = 7): string =>
  `repeating-linear-gradient(135deg, ${dark ? "rgba(255,255,255,.05)" : "rgba(20,20,40,.05)"} 0 ${String(size)}px, transparent ${String(size)}px ${String(size * 2)}px), var(--surface-2)`;

const hidden: CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };

function Head({ col, day, narrow }: { col: Column; day: Day; narrow: boolean }) {
  const { t } = useI18n();
  const dark = useDark();
  const c = col.clinician;
  const booked = col.visits.length;
  const free = col.open?.filter((s) => s.state === "free") ?? [];
  let meta: string;
  if (col.state.kind === "closed") meta = t("daysheet.col.closed", { n: num(booked) }, booked);
  else if (col.state.kind === "away") meta = t("daysheet.col.away", { n: num(booked) }, booked);
  else if (col.state.kind === "notIn") meta = t("daysheet.col.notIn");
  else meta = t("daysheet.col.meta", { booked: num(booked), open: num(free.length) }, booked);
  const next = col.state.kind === "open" && free.length > 0 ? free[0]!.time : null;
  return (
    <div style={{ flex: 1, minWidth: narrow ? 220 : 0, display: "flex", alignItems: "center", gap: 9, padding: "11px 12px", borderInlineEnd: "1px solid var(--border)" }}>
      <span aria-hidden="true" style={tileStyle(c.color, dark, 30)}>
        {initials(c.name)}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "-.022em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.short_name}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>{meta}</span>
        {next !== null && <span style={{ ...mono(10.5, 600, "var(--pos)"), direction: "inherit" }}>{t("daysheet.col.next", { time: time(venueStamp(day, next, practiceZone())) })}</span>}
      </span>
    </div>
  );
}
function Block({ visit, type, name, rail, moving }: { visit: Appointment; type: VisitType | undefined; name: string; rail: Rail; moving: boolean }) {
  const { t } = useI18n();
  const dark = useDark();
  const color = type?.color ?? "#3b6fbd";
  const start = minutesOf(hhmmOf(visit.starts_at));
  const faded = visit.status === "seen" || visit.status === "no_show";
  const top = topOf(start, rail);
  const height = visit.minutes * PX_PER_MINUTE - 4;
  const meta = STATUS_META[visit.status];
  return (
    <>
      <span aria-hidden="true" style={{ position: "absolute", zIndex: 3, insetInlineStart: 8, insetBlockStart: top + 9, width: 9, height: 9, borderRadius: "50%", background: meta.fg, boxShadow: "0 0 0 2.5px var(--surface)", opacity: faded ? 0.55 : 1 }} />
      <button
        type="button"
        className="rh-block"
        onClick={() => openPanel(visit.id)}
        style={{
          position: "absolute",
          zIndex: moving ? 3 : 2,
          insetInlineStart: 26,
          insetInlineEnd: 5,
          insetBlockStart: top,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          gap: 1,
          padding: "5px 9px",
          borderRadius: 10,
          cursor: "pointer",
          overflow: "hidden",
          textAlign: "start",
          border: `1px solid ${rgba(color, dark ? 0.34 : 0.24)}`,
          borderInlineStart: `3px solid ${tint(color, dark)}`,
          background: rgba(color, dark ? 0.16 : 0.09),
          opacity: faded ? 0.55 : 1,
          ...(moving ? { outline: "2px dashed var(--accent)", outlineOffset: 2 } : {}),
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, textAlign: "start", width: "100%" }}>
          <span style={{ ...mono(10.5, 600, faded ? "var(--fg-subtle)" : tint(color, dark)), lineHeight: 1.15 }}>{timeRange(visit.starts_at, visit.minutes)}</span>
          <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--fg)" }}>{name}</span>
          <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, color: "var(--fg-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{visit.reason ?? type?.name ?? ""}</span>
          <span style={hidden}>{t(`status.${visit.status}`)}</span>
        </span>
      </button>
    </>
  );
}

function OpenTime({ slot, col, day, rail, minutes, placing }: { slot: SlotTime; col: Column; day: Day; rail: Rail; minutes: number; placing: Placing }) {
  const { t } = useI18n();
  const at = venueStamp(day, slot.time, practiceZone());
  const label = time(at);
  const name = col.clinician.short_name;
  return (
    <button
      type="button"
      className="rh-btn"
      onClick={() => placing.place({ startsAt: new Date(at).toISOString(), clinicianId: col.clinician.id })}
      aria-label={t(placing.what === "moving" ? "daysheet.slot.move" : "daysheet.slot.book", { time: label, clinician: name })}
      style={{
        position: "absolute",
        insetInlineStart: 26,
        insetInlineEnd: 5,
        insetBlockStart: topOf(minutesOf(slot.time), rail),
        height: minutes * PX_PER_MINUTE - 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 10,
        cursor: "pointer",
        zIndex: 4,
        border: "1.5px dashed var(--accent)",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        ...mono(11, 600, "var(--accent)"),
      }}
    >
      {label}
    </button>
  );
}

export default function DayGrid({
  day,
  rail,
  columns,
  names,
  types,
  placing,
  now,
  narrow,
}: {
  day: Day;
  rail: Rail;
  columns: Column[];
  names: (v: Appointment) => string;
  types: Map<Id, VisitType>;
  placing: Placing | null;
  /** Now, when the day on screen is today: its minute of the day and the instant. */
  now: { minute: number; at: number } | null;
  narrow: boolean;
}) {
  const { t } = useI18n();
  const dark = useDark();
  const heads = useRef<HTMLDivElement>(null);
  const height = topOf(rail.closes, rail);
  const lines = `repeating-linear-gradient(to bottom, ${dark ? "rgba(255,255,255,.05)" : "rgba(20,20,40,.05)"} 0 1px, transparent 1px ${String(QUARTER_PX)}px)`;
  const showNow = now !== null && now.minute >= rail.opens && now.minute <= rail.closes;
  const nowTop = showNow ? topOf(now.minute, rail) : 0;

  return (
    <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
      <div style={{ display: "flex", borderBlockEnd: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div style={{ width: RAIL_W, flexShrink: 0 }} />
        <div ref={heads} className="rh-hide" style={{ flex: 1, minWidth: 0, display: "flex", overflow: "hidden" }}>
          {columns.map((col) => (
            <Head key={col.clinician.id} col={col} day={day} narrow={narrow} />
          ))}
        </div>
      </div>
      <div className="rh-scroll" data-rh-daygrid="1" tabIndex={0} aria-label={t("daysheet.grid", { day: dayLong(day) })} role="region" style={{ maxHeight: "min(62vh,760px)", overflowY: "auto" }}>
        <div style={{ display: "flex", position: "relative" }}>
          <div style={{ width: RAIL_W, flexShrink: 0, position: "relative", borderInlineEnd: "1px solid var(--border)" }}>
            {railMarks(rail).map((m) => (
              <div
                key={m.minute}
                style={{
                  height: QUARTER_PX,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  paddingInlineEnd: 8,
                  paddingBlockStart: 2,
                  ...mono(10.5, m.hour ? 600 : 500, m.hour ? "var(--fg-muted)" : "var(--fg-subtle)"),
                  ...(m.hour ? { borderBlockStart: "1px solid var(--border)" } : {}),
                }}
              >
                {m.labelled ? time(venueStamp(day, clockOf(m.minute), practiceZone())) : ""}
              </div>
            ))}
            {showNow && (
              <span style={{ position: "absolute", insetInlineEnd: 5, insetBlockStart: nowTop - 9, zIndex: 6, padding: "2px 5px", borderRadius: 6, background: NOW_RED, ...mono(10, 600, "#fff") }}>
                {time(now.at)}
              </span>
            )}
          </div>
          <div
            className="rh-scroll rh-snap"
            onScroll={(e) => {
              if (heads.current !== null) heads.current.scrollLeft = e.currentTarget.scrollLeft;
            }}
            style={{ flex: 1, minWidth: 0, display: "flex", overflowX: narrow ? "auto" : "hidden" }}
          >
            {columns.map((col) => (
              <div
                key={col.clinician.id}
                role="group"
                aria-label={col.clinician.short_name}
                style={{ flex: 1, minWidth: narrow ? 220 : 0, position: "relative", height, borderInlineEnd: "1px solid var(--border)", background: lines }}
              >
                {shutBands(col.state, rail).map((b) => (
                  <div
                    key={`${String(b.from)}-${String(b.to)}`}
                    aria-hidden="true"
                    style={{ position: "absolute", insetInline: 0, insetBlockStart: topOf(b.from, rail), height: (b.to - b.from) * PX_PER_MINUTE, background: hatch(dark), borderBlock: "1px solid var(--border)", pointerEvents: "none" }}
                  />
                ))}
                {placing !== null &&
                  col.placeable?.filter((s) => s.state === "free").map((s) => (
                    <OpenTime key={s.time} slot={s} col={col} day={day} rail={rail} minutes={placing.minutes} placing={placing} />
                  ))}
                {col.visits.map((v) => (
                  <Block key={v.id} visit={v} type={types.get(v.visit_type_id)} name={names(v)} rail={rail} moving={placing?.exclude === v.id} />
                ))}
                {showNow && (
                  <>
                    <div aria-hidden="true" style={{ position: "absolute", insetInline: 0, insetBlockStart: nowTop, height: 2, background: rgba(dark ? "#ff6b6b" : "#cf273c", 0.42), zIndex: 0, pointerEvents: "none" }} />
                    <div aria-hidden="true" style={{ position: "absolute", insetInlineStart: 2, width: 20, insetBlockStart: nowTop - 1, height: 4, borderRadius: 2, background: "var(--danger)", zIndex: 6, pointerEvents: "none" }} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
