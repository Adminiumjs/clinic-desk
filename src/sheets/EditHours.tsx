/**
 * Edit hours (managers): the practice's week, and each clinician's own hours
 * where they keep different ones.
 *
 * Seven rows for the practice — open or not, opens, closes, and when the
 * desk closes in the middle of the day (or not at all). Each clinician is
 * "Same as the practice" (they keep no rows of their own) or "Own hours"
 * (seven rows of their own; a day switched off is a day they are not in).
 * Times run from 06:00 to 22:00 on the practice's slot grid. Nothing saves
 * while a row does not make sense; the booking site follows the saved hours
 * at once.
 */
import { useId, useMemo, useState } from "react";
import { Check, Clock, Info } from "lucide-react";

import type { ClinicianHours, Id, OpeningHours, Weekday } from "../data/types.ts";
import { WEEKDAYS } from "../data/types.ts";
import { addDays } from "../data/venueTime.ts";
import { useI18n } from "../i18n/index.tsx";
import { weekdayLong } from "../lib/format.ts";
import { activeClinicians } from "../lib/desk.ts";
import { saveHours, type HoursEdit } from "../state/actions.ts";
import { useCan, useDesk } from "../state/desk.ts";
import { toast, type Sheet as SheetKind } from "../state/ui.ts";
import { Btn, Sheet, Switch, Tile, btnGhost, fieldStyle, kicker, segStyle } from "../components/ui.tsx";
import { hourOptions, hoursProblem, type HoursRow } from "./bits/logic.ts";
import { Note, useRefusal, useSaving } from "./bits/ui.tsx";

/** A Monday, to name the weekdays in the page's language. */
const A_MONDAY = "2026-07-27";
const dayName = (w: Weekday): string => weekdayLong(addDays(A_MONDAY, WEEKDAYS.indexOf(w)));

const fromPractice = (h: OpeningHours | undefined): HoursRow =>
  h === undefined
    ? { open: false, opens: "09:00", closes: "17:00", breakStart: "", breakEnd: "" }
    : { open: h.open, opens: h.opens, closes: h.closes, breakStart: h.break_start ?? "", breakEnd: h.break_end ?? "" };
const fromOwn = (h: ClinicianHours | undefined, fallback: HoursRow): HoursRow =>
  h === undefined ? { ...fallback, open: false } : { open: true, opens: h.opens, closes: h.closes, breakStart: h.break_start ?? "", breakEnd: h.break_end ?? "" };

type Week = Record<Weekday, HoursRow>;
const weekOf = (make: (w: Weekday) => HoursRow): Week => Object.fromEntries(WEEKDAYS.map((w) => [w, make(w)])) as Week;
const sameRow = (a: HoursRow, b: HoursRow) => a.open === b.open && a.opens === b.opens && a.closes === b.closes && a.breakStart === b.breakStart && a.breakEnd === b.breakEnd;

export default function EditHours({ onClose }: { sheet: Extract<SheetKind, { kind: "hours" }>; onClose: () => void }) {
  const { t } = useI18n();
  const desk = useDesk();
  const refusal = useRefusal();
  const { busy, run } = useSaving();
  const mayEdit = useCan("opening_hours", "update");
  const options = useMemo(() => hourOptions(desk.settings?.slot_minutes ?? 15), [desk.settings?.slot_minutes]);
  const clinicians = activeClinicians(desk);

  const heldPractice = useMemo(() => weekOf((w) => fromPractice(desk.hours.find((h) => h.weekday === w))), [desk.hours]);
  const heldOwn = useMemo(() => {
    const out: Record<Id, Week | null> = {};
    for (const c of clinicians) {
      const rows = desk.clinicianHours.filter((h) => h.clinician_id === c.id);
      out[c.id] = rows.length === 0 ? null : weekOf((w) => fromOwn(rows.find((r) => r.weekday === w), heldPractice[w]));
    }
    return out;
  }, [desk.clinicianHours, clinicians, heldPractice]);

  const [practice, setPractice] = useState<Week>(heldPractice);
  const [own, setOwn] = useState<Record<Id, Week | null>>(heldOwn);
  const [error, setError] = useState<string | null>(null);

  const problems = [...WEEKDAYS.map((w) => hoursProblem(practice[w])), ...Object.values(own).flatMap((week) => (week === null ? [] : WEEKDAYS.map((w) => hoursProblem(week[w]))))];
  const anyProblem = problems.some((p) => p !== null);

  const save = async () => {
    if (anyProblem || !mayEdit) return;
    setError(null);
    const edit: HoursEdit = { practice: [], clinicians: [] };
    for (const w of WEEKDAYS) {
      const held = desk.hours.find((h) => h.weekday === w);
      if (held === undefined || sameRow(practice[w], heldPractice[w])) continue;
      const row = practice[w];
      edit.practice.push({ id: held.id, open: row.open, opens: row.opens, closes: row.closes, break_start: row.breakStart === "" ? null : row.breakStart, break_end: row.breakEnd === "" ? null : row.breakEnd });
    }
    for (const c of clinicians) {
      const now = own[c.id] ?? null;
      const before = heldOwn[c.id] ?? null;
      const unchanged = now === null ? before === null : before !== null && WEEKDAYS.every((w) => sameRow(now[w], before[w]));
      if (unchanged) continue;
      edit.clinicians.push({
        clinicianId: c.id,
        own:
          now === null
            ? null
            : WEEKDAYS.filter((w) => now[w].open).map((w) => ({
                weekday: w,
                opens: now[w].opens,
                closes: now[w].closes,
                break_start: now[w].breakStart === "" ? null : now[w].breakStart,
                break_end: now[w].breakEnd === "" ? null : now[w].breakEnd,
              })),
      });
    }
    const outcome = await run(() => saveHours(edit));
    if (outcome === null) return;
    if (!outcome.ok) return setError(refusal(outcome.reason));
    toast(t("editHours.toast"), { icon: "clock", tone: "pos" });
    onClose();
  };

  return (
    <Sheet icon={Clock} title={t("editHours.title")} sub={(desk.settings?.slot_minutes ?? 15) === 15 ? t("editHours.sub") : t("editHours.subGrid", { minutes: desk.settings?.slot_minutes ?? 15 })} onClose={onClose}>
      {!mayEdit && (
        <Note tone="info" icon={Info} role="status">
          {t("editHours.managersOnly")}
        </Note>
      )}
      <section aria-labelledby="he-practice" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 id="he-practice" style={{ ...kicker, margin: 0 }}>
          {t("editHours.practice")}
        </h3>
        {WEEKDAYS.map((w) => (
          <DayRow key={w} weekday={w} row={practice[w]} options={options} disabled={!mayEdit || desk.hours.every((h) => h.weekday !== w)} onChange={(row) => setPractice((p) => ({ ...p, [w]: row }))} switchLabel={t("editHours.openOn", { day: dayName(w) })} />
        ))}
      </section>

      <section aria-labelledby="he-own" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 id="he-own" style={{ ...kicker, margin: 0 }}>
          {t("editHours.own")}
        </h3>
        {clinicians.map((c) => {
          const week = own[c.id] ?? null;
          return (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "11px 12px", borderRadius: 13, border: "1px solid var(--border)", background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Tile name={c.name} color={c.color} size={32} />
                <span style={{ flex: 1, minWidth: 90, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{c.short_name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-subtle)" }}>{c.role_label}</span>
                </span>
                <div role="group" aria-label={t("editHours.hoursOf", { name: c.short_name })} style={{ display: "flex", gap: 3, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
                  <button type="button" className="rh-chip" aria-pressed={week === null} disabled={!mayEdit} onClick={() => setOwn((o) => ({ ...o, [c.id]: null }))} style={{ ...segStyle(week === null), height: 26, paddingInline: 9, fontSize: 11.5 }}>
                    {t("editHours.same")}
                  </button>
                  <button
                    type="button"
                    className="rh-chip"
                    aria-pressed={week !== null}
                    disabled={!mayEdit}
                    onClick={() => setOwn((o) => ({ ...o, [c.id]: o[c.id] ?? weekOf((w) => ({ ...practice[w] })) }))}
                    style={{ ...segStyle(week !== null), height: 26, paddingInline: 9, fontSize: 11.5 }}
                  >
                    {t("editHours.ownHours")}
                  </button>
                </div>
              </div>
              {week !== null &&
                WEEKDAYS.map((w) => (
                  <DayRow
                    key={w}
                    weekday={w}
                    row={week[w]}
                    options={options}
                    disabled={!mayEdit}
                    onChange={(row) => setOwn((o) => ({ ...o, [c.id]: { ...(o[c.id] ?? week), [w]: row } }))}
                    switchLabel={t("editHours.inOn", { name: c.short_name, day: dayName(w) })}
                  />
                ))}
            </div>
          );
        })}
      </section>

      {error !== null && (
        <Note tone="danger" icon={Info} role="alert">
          {error}
        </Note>
      )}

      <div style={{ display: "flex", gap: 9, position: "sticky", insetBlockEnd: -20, marginBlockEnd: -20, paddingBlock: "14px 20px", background: "var(--surface)", borderBlockStart: "1px solid var(--border)" }}>
        <button type="button" className="rh-btn" onClick={onClose} style={{ ...btnGhost, flex: 1 }}>
          {t("common.cancel")}
        </button>
        <Btn icon={Check} busy={busy} disabled={anyProblem || !mayEdit} onClick={() => void save()} style={{ flex: 1, ...(anyProblem ? { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 } : {}) }}>
          {t("editHours.save")}
        </Btn>
      </div>
    </Sheet>
  );
}

function DayRow({ weekday, row, options, onChange, switchLabel, disabled }: { weekday: Weekday; row: HoursRow; options: string[]; onChange: (row: HoursRow) => void; switchLabel: string; disabled: boolean }) {
  const { t } = useI18n();
  const errId = useId();
  const problem = hoursProblem(row);
  const select = { ...fieldStyle(true), height: 36, paddingInline: 8, fontSize: 12.5 };
  const lab = { fontSize: 10.5, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" } as const;
  const field = (label: string, value: string, set: (v: string) => void, allowNone: boolean) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={lab}>{label}</span>
      <select className="rh-fld" value={value} disabled={disabled} onChange={(e) => set(e.target.value)} aria-invalid={problem !== null} aria-describedby={problem !== null ? errId : undefined} style={select}>
        {allowNone && <option value="">{t("common.none")}</option>}
        {!options.includes(value) && value !== "" && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div style={{ padding: "11px 12px", borderRadius: 13, border: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, letterSpacing: "-.02em" }}>{dayName(weekday)}</span>
        {!row.open && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{t("editHours.closed")}</span>}
        <Switch on={row.open} label={switchLabel} disabled={disabled} onChange={(open) => onChange({ ...row, open })} />
      </div>
      {row.open && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 8 }}>
          {field(t("editHours.opens"), row.opens, (v) => onChange({ ...row, opens: v }), false)}
          {field(t("editHours.closes"), row.closes, (v) => onChange({ ...row, closes: v }), false)}
          {/* Choosing one end of the desk close picks the other a step away; "none" on either clears both. */}
          {field(t("editHours.breakFrom"), row.breakStart, (v) => onChange({ ...row, breakStart: v, breakEnd: v === "" ? "" : row.breakEnd === "" ? (options[options.indexOf(v) + 1] ?? v) : row.breakEnd }), true)}
          {field(t("editHours.breakTo"), row.breakEnd, (v) => onChange({ ...row, breakEnd: v, breakStart: v === "" ? "" : row.breakStart === "" ? (options[options.indexOf(v) - 1] ?? v) : row.breakStart }), true)}
        </div>
      )}
      {problem !== null && (
        <span id={errId} role="alert" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--danger)" }}>
          {t(`editHours.error.${problem}`)}
        </span>
      )}
    </div>
  );
}
