/**
 * Find a time's third step: the strip of days the practice takes bookings
 * for, then the chosen day's times, morning and afternoon — or, when the day
 * has none, why (closed, away, full, nothing left today) and the next day
 * with room.
 *
 * The strip covers the practice's booking window in WORKING days (its
 * `booking_days`), so a weekend in the middle does not shorten it. Days and
 * times come from the server; "has passed" is only how a time before now is
 * drawn.
 */
import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX, Hourglass, RotateCw } from "lucide-react";

import type { Catalogue, DayState, SlotTime } from "../../data/ports.ts";
import type { Day, Hhmm, Id, VisitType } from "../../data/types.ts";
import { venueDay, venueTime } from "../../data/venueTime.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Btn, MONO, cardStyle, monoPill, mono, stepBadge } from "../../components/ui.tsx";
import { practiceZone } from "../../lib/clock.ts";
import { dayLong, dayShort, num, weekdayShort } from "../../lib/format.ts";
import { useNow } from "../../lib/useNow.ts";
import { patientsPort } from "../../state/patients.ts";
import { groupTimes, morningEnds, weekdayOf, windowSpan, type SlotView } from "./logic.ts";
import { clockLabel, dayNumber } from "./when.ts";

/** The first free time in the window, for the demo card's "First open time". */
export async function firstOpenTime(cat: Catalogue, kind: Id, resource: Id | "any", exclude: Id | undefined, today: Day): Promise<{ day: Day; time: Hhmm } | null> {
  const settings = cat.settings;
  if (settings === null) return null;
  const port = patientsPort();
  const ex = exclude === undefined ? {} : { exclude };
  const days = await port.days({ kind, resource, ...ex, from: today, days: windowSpan(cat.hours, cat.closures, today, settings.booking_days) });
  for (const d of days) {
    if (d.state !== "open") continue;
    const free = (await port.times({ kind, resource, ...ex, date: d.date })).find((x) => x.state === "free");
    if (free !== undefined) return { day: d.date, time: free.time };
  }
  return null;
}

export function DayStep({
  cat,
  type,
  resource,
  exclude,
  day,
  today,
  time,
  whoShort,
  onDay,
  onTime,
}: {
  cat: Catalogue;
  type: VisitType;
  resource: Id | "any";
  exclude: Id | undefined;
  day: Day;
  today: Day;
  time: Hhmm | null;
  whoShort: string | null;
  onDay: (day: Day) => void;
  onTime: (time: Hhmm) => void;
}) {
  const { t } = useI18n();
  const nowMs = useNow();
  const settings = cat.settings!;
  const [days, setDays] = useState<DayState[] | null>(null);
  const [times, setTimes] = useState<SlotTime[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [again, setAgain] = useState(0);
  const span = windowSpan(cat.hours, cat.closures, today, settings.booking_days);

  useEffect(() => {
    let live = true;
    setDays(null);
    patientsPort()
      .days({ kind: type.id, resource, ...(exclude === undefined ? {} : { exclude }), from: today, days: span })
      .then((d) => live && setDays(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [cat, type.id, resource, exclude, today, span, again]);

  useEffect(() => {
    let live = true;
    setTimes(null);
    patientsPort()
      .times({ kind: type.id, resource, ...(exclude === undefined ? {} : { exclude }), date: day })
      .then((x) => live && setTimes(x))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [cat, type.id, resource, exclude, day, again]);

  const zone = practiceZone();
  const at = (ms: number) => `${venueDay(ms, zone)}T${venueTime(ms, zone)}`;
  const groups = times === null ? null : groupTimes(times, morningEnds(cat.hours, day), day, at(nowMs), at(nowMs + settings.min_notice_minutes * 60_000));
  const all = groups === null ? [] : [...groups.morning, ...groups.afternoon];
  const openN = all.filter((s) => s.free).length;
  const next = days?.find((d) => d.date > day && d.state === "open") ?? null;
  const who = whoShort ?? t("find.whoever");

  return (
    <section className="rh-card" aria-labelledby="find-q3" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span aria-hidden="true" style={stepBadge(true)}>
          {num(3)}
        </span>
        <h2 id="find-q3" style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: "-.022em", lineHeight: "normal" }}>
          {t("find.q3")}
        </h2>
        <span style={{ marginInlineStart: "auto", ...monoPill("var(--surface-3)", "var(--fg-muted)") }}>
          <Hourglass size={12} aria-hidden="true" />
          {t("find.lenChip", { n: num(type.minutes), who })}
        </span>
      </div>

      {failed ? (
        <div role="alert" style={{ marginBlockStart: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>{t("pShell.offline")}</span>
          <Btn
            kind="ghostSm"
            icon={RotateCw}
            onClick={() => {
              setFailed(false);
              setAgain((n) => n + 1);
            }}
          >
            {t("common.tryAgain")}
          </Btn>
        </div>
      ) : (
        <>
          <div className="rh-hide" role="group" aria-label={t("find.days")} style={{ display: "flex", gap: 7, marginBlockStart: 14, overflowX: "auto", paddingBlockEnd: 4 }}>
            {days === null
              ? Array.from({ length: Math.min(span, 10) }, (_, i) => <div key={i} className="rh-skel" style={{ minWidth: 62, height: 68 }} />)
              : days.map((d) => <DayButton key={d.date} d={d} on={d.date === day} onPick={() => onDay(d.date)} />)}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBlockStart: 16, paddingBlockEnd: 12, borderBlockEnd: "1px solid var(--border)" }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.022em" }}>
              {dayLong(day)}
              {day === today ? ` · ${t("find.today")}` : ""}
            </span>
            {groups !== null && (
              <span style={monoPill(openN > 0 ? "var(--pos-soft)" : "var(--warn-soft)", openN > 0 ? "var(--pos)" : "var(--warn)")}>{openN > 0 ? t("find.open", { n: num(openN) }) : t("find.nothingOpen")}</span>
            )}
            <span style={{ marginInlineStart: "auto", display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>
                <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: 4, border: "1px solid var(--border-strong)", background: "var(--surface-3)" }} />
                {t("find.taken")}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>
                <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: 4, border: "1px dashed var(--border-strong)", background: "transparent" }} />
                {t("find.passed")}
              </span>
            </span>
          </div>

          {groups === null ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))", gap: 7, marginBlockStart: 16 }}>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="rh-skel" style={{ height: 40, borderRadius: 11 }} />
              ))}
            </div>
          ) : openN > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBlockStart: 16 }}>
              {(["morning", "afternoon"] as const)
                .filter((g) => groups[g].length > 0)
                .map((g) => (
                  <div key={g} role="group" aria-labelledby={`find-${g}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span id={`find-${g}`} style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>
                        {t(g === "morning" ? "find.morning" : "find.afternoon")}
                      </span>
                      <span style={mono(11, 600, "var(--fg-subtle)")}>{t("find.open", { n: num(groups[g].filter((s) => s.free).length) })}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))", gap: 7, marginBlockStart: 10 }}>
                      {groups[g].map((s) => (
                        <SlotButton key={s.time} s={s} day={day} minutes={type.minutes} on={time === s.time} onPick={() => onTime(s.time)} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyDay cat={cat} type={type} resource={resource} day={day} today={today} whoShort={whoShort} next={next} onDay={onDay} />
          )}
        </>
      )}
    </section>
  );
}

function DayButton({ d, on, onPick }: { d: DayState; on: boolean; onPick: () => void }) {
  const { t } = useI18n();
  const shut = d.state === "closed";
  const tag = shut ? t("find.closed") : d.open === 0 ? t("find.full") : t("find.open", { n: num(d.open) });
  return (
    <button
      type="button"
      className="rh-day"
      onClick={onPick}
      disabled={shut}
      aria-pressed={on}
      aria-label={`${dayShort(d.date)}, ${tag}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        minWidth: 62,
        padding: "9px 8px",
        borderRadius: 12,
        cursor: shut ? "default" : "pointer",
        border: `1px solid ${on ? "transparent" : "var(--border)"}`,
        background: on ? "var(--accent)" : shut ? "var(--surface-2)" : "var(--surface)",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: on ? "var(--accent-fg)" : "var(--fg-subtle)", opacity: shut ? 0.55 : 1 }}>
        {weekdayShort(d.date)}
      </span>
      <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: 17, fontWeight: 600, color: on ? "var(--accent-fg)" : shut ? "var(--fg-subtle)" : "var(--fg)", opacity: shut ? 0.55 : 1 }}>
        {dayNumber(d.date)}
      </span>
      <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: on ? "var(--accent-fg)" : d.open === 0 && !shut ? "var(--warn)" : "var(--fg-subtle)", opacity: shut ? 0.5 : on ? 0.85 : 1, whiteSpace: "nowrap" }}>
        {tag}
      </span>
    </button>
  );
}

function SlotButton({ s, day, minutes, on, onPick }: { s: SlotView; day: Day; minutes: number; on: boolean; onPick: () => void }) {
  const { t } = useI18n();
  const label = clockLabel(day, s.time);
  const dashed = s.passed || s.soon;
  const taken = !s.free && !dashed;
  const state = s.passed ? t("find.slotPassed") : s.soon ? t("find.slotSoon") : taken ? t("find.slotTaken") : t("find.slotOpen", { from: label, to: endLabel(day, s.time, minutes) });
  const bg = on ? "var(--accent)" : dashed ? "transparent" : taken ? "var(--surface-3)" : "var(--surface)";
  const fg = on ? "var(--accent-fg)" : s.free ? "var(--fg)" : "var(--fg-subtle)";
  return (
    <button
      type="button"
      className="rh-slot"
      onClick={onPick}
      disabled={!s.free}
      aria-pressed={on}
      aria-label={s.free ? label : `${label}, ${state}`}
      title={state}
      style={{
        height: 40,
        borderRadius: 11,
        cursor: s.free ? "pointer" : "not-allowed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px ${dashed ? "dashed" : "solid"} ${on ? "transparent" : "var(--border-strong)"}`,
        background: bg,
        fontFamily: MONO,
        fontSize: 13,
        fontWeight: 600,
        color: fg,
        ...(s.free || on ? {} : { opacity: 0.6 }),
        ...(taken && !on ? { textDecoration: "line-through", textDecorationThickness: 1 } : {}),
      }}
    >
      {label}
    </button>
  );
}

const endLabel = (day: Day, hhmm: Hhmm, minutes: number): string => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const end = h * 60 + m + minutes;
  return clockLabel(day, `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`);
};

/** Why a day has no time, and where to go instead. */
function EmptyDay({
  cat,
  type,
  resource,
  day,
  today,
  whoShort,
  next,
  onDay,
}: {
  cat: Catalogue;
  type: VisitType;
  resource: Id | "any";
  day: Day;
  today: Day;
  whoShort: string | null;
  next: DayState | null;
  onDay: (day: Day) => void;
}) {
  const { t } = useI18n();
  const settings = cat.settings!;
  const covers = (c: { from_date: Day; to_date: Day; active: boolean }) => c.active && c.from_date <= day && day <= c.to_date;
  const row = cat.hours.find((h) => h.weekday === weekdayOf(day));
  const whole = cat.closures.find((c) => c.clinician_id === null && covers(c));
  const theirs = resource === "any" ? undefined : cat.closures.find((c) => c.clinician_id === resource && covers(c));
  const weekend = weekdayOf(day) === "sat" || weekdayOf(day) === "sun";
  const n = num(type.minutes);
  const dayText = dayShort(day);

  let title: string;
  let body: string;
  if (row === undefined || !row.open) {
    title = weekend ? t("find.closedWeekend") : t("find.closedDay");
    body = "";
  } else if (whole !== undefined) {
    title = t("find.closedDay");
    body = whole.note !== null && whole.note !== "" ? `${whole.label} — ${whole.note}` : whole.label;
  } else if (theirs !== undefined) {
    title = t("find.away", { name: whoShort ?? "" });
    body = theirs.note ?? "";
  } else {
    title = day === today ? t("find.nothingToday") : t("find.dayFull");
    const key = whoShort === null ? (day === today ? "find.fullAnyToday" : "find.fullAny") : day === today ? "find.fullWithToday" : "find.fullWith";
    body = t(key, { n, name: whoShort ?? "", day: dayText });
  }
  const then = next !== null ? t("find.nextRoom", { day: dayShort(next.date) }) : t("find.callUs", { phone: settings.phone });
  const text = [body, then].filter((x) => x !== "").join(" ");

  return (
    <div style={{ marginBlockStart: 18, padding: 22, borderRadius: 14, border: "1px dashed var(--border-strong)", background: "var(--surface-2)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 12, background: "var(--surface-3)", color: "var(--fg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CalendarX size={18} />
      </span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.022em" }}>{title}</div>
        <p style={{ margin: "6px 0 0", maxWidth: "46ch", fontSize: 13.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{text}</p>
      </div>
      {next !== null && (
        <Btn icon={CalendarCheck} onClick={() => onDay(next.date)} style={{ height: 40 }}>
          {t("find.takeInstead", { day: dayShort(next.date) })}
        </Btn>
      )}
    </div>
  );
}
