/**
 * Add a closure: the whole practice, or one clinician, shut for a day or a
 * run of days — a bank holiday, a course, annual leave.
 *
 * Any visit already booked in it has to be answered first, one by one: Move
 * (it stays booked, and stays listed as a clash on Hours & closures until
 * someone moves it) or Cancel and email them. The visits are read for the
 * whole range before Save opens — a closure next month clashes with visits
 * the desk has not read yet — and read again just before saving, so a visit
 * another desk moved out in the meantime is never cancelled by mistake.
 *
 * The closure is saved FIRST (on its own it only takes free times away),
 * then each cancellation and its email, each with a key of its own. If one
 * of those fails, the closure is already saved: the form locks, and trying
 * again finishes the cancellations without saving the closure twice.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarSync, CalendarX, Check, CircleAlert, DoorClosed, Info, Loader2, MailX, PhoneCall, TriangleAlert } from "lucide-react";

import type { Id } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { actionKey, stepKey } from "../lib/keys.ts";
import { dayOf, dayShort, daysBetween, time } from "../lib/format.ts";
import { useNow } from "../lib/useNow.ts";
import { activeClinicians, patientOf, visitName } from "../lib/desk.ts";
import { addClosure } from "../state/actions.ts";
import { deskReads, ensureDays, upsert, useCan, useDesk } from "../state/desk.ts";
import { openSheet, startPlacing, toast, type Sheet as SheetKind } from "../state/ui.ts";
import { Btn, Sheet, Tile, btnPrimary, chipStyle, fieldStyle, kicker, mono } from "../components/ui.tsx";
import { LONGEST_CLOSURE, closureClashes, closureDates, closureSaved, nextOpenDay, sameIds } from "./bits/logic.ts";
import { Note, areaStyle, labelText, useRefusal, useSaving } from "./bits/ui.tsx";

type Choice = "move" | "cancel";
type ReadState = "idle" | "reading" | "read" | "failed";

export default function AddClosure({ sheet, onClose }: { sheet: Extract<SheetKind, { kind: "closure" }>; onClose: () => void }) {
  const { t } = useI18n();
  const today = dayOf(useNow());
  const desk = useDesk();
  const refusal = useRefusal();
  const { busy, run } = useSaving();
  const prefill = sheet.prefill;

  const [who, setWho] = useState<Id | null>(prefill?.clinicianId ?? null);
  const [from, setFrom] = useState(prefill?.from ?? "");
  const [to, setTo] = useState(prefill?.to ?? "");
  const [label, setLabel] = useState(prefill?.label ?? "");
  const [note, setNote] = useState(prefill?.note ?? "");
  const [choices, setChoices] = useState<Record<Id, Choice>>({});
  const [read, setRead] = useState<ReadState>("idle");
  const [readTick, setReadTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // The closure's key, and one per clash for its email: made once, kept until everything is saved.
  const [key] = useState(actionKey);
  const clashKeys = useRef(new Map<Id, string>());
  const keyFor = (id: Id): string => {
    let k = clashKeys.current.get(id);
    if (k === undefined) {
      k = actionKey();
      clashKeys.current.set(id, k);
    }
    return k;
  };

  const mayAdd = useCan("closures", "create");
  const saved = closureSaved(desk, stepKey(key, "a"));
  const locked = saved !== undefined;
  const problem = closureDates(from, to);

  // Read every day of the range: the clashes may be on days the desk has not read.
  useEffect(() => {
    if (problem !== null || locked) return;
    let live = true;
    setRead("reading");
    ensureDays(from, daysBetween(from, to) + 1)
      .then(() => live && setRead("read"))
      .catch(() => live && setRead("failed"));
    return () => {
      live = false;
    };
  }, [from, to, problem, locked, readTick]);

  const range = { clinicianId: who, from, to };
  const live = useMemo(() => (problem === null ? closureClashes(Object.values(desk.visits), range) : []), [desk.visits, problem, who, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  // Once the closure is saved, the clashes are the ones answered on the first try — even those
  // already cancelled, whose email may still be owed.
  const [answered, setAnswered] = useState<Id[] | null>(null);
  const clashes = locked && answered !== null ? answered.map((id) => desk.visits[id]).filter((v) => v !== undefined) : live;
  const allChosen = clashes.every((v) => choices[v.id] !== undefined);
  const labelOk = label.trim().length > 1;
  const readOk = locked || read === "read";
  const ok = problem === null && labelOk && allChosen && readOk && mayAdd;

  const hint =
    problem === "missing"
      ? t("closure.hint.dates")
      : problem === "tooLong"
        ? t("closure.hint.tooLong", { days: LONGEST_CLOSURE })
        : problem === "backwards"
          ? null
          : !labelOk
            ? t("closure.hint.label")
            : read === "reading"
              ? t("closure.reading")
              : !allChosen
                ? t("closure.hint.choose")
                : null;

  const resetChoices = () => {
    setChoices({});
    setError(null);
  };

  const save = async () => {
    if (!ok) return;
    setError(null);
    if (!locked) {
      // Read the clashes again right before saving: another desk may have moved or cancelled one.
      const ids = clashes.map((v) => v.id);
      try {
        for (const row of await deskReads().visits(ids)) upsert("appointments", row);
      } catch {
        return setError(t("closure.readFailed"));
      }
      const now = closureClashes(Object.values(useDesk.getState().visits), range).map((v) => v.id);
      if (!sameIds(ids, now)) return setError(t("closure.changed"));
      setAnswered(ids);
    }
    const cancel = clashes.filter((v) => choices[v.id] === "cancel").map((v) => ({ visitId: v.id, key: keyFor(v.id) }));
    const outcome = await run(() => addClosure({ clinicianId: who, from, to, label: label.trim(), note: note.trim() === "" ? null : note.trim() }, cancel, key));
    if (outcome === null) return;
    if (!outcome.ok) return setError(refusal(outcome.reason));

    const s = useDesk.getState();
    const noEmail = cancel.filter((c) => !hasEmail(s, c.visitId)).length;
    const moves = clashes.filter((v) => choices[v.id] === "move");
    const parts = [t("closure.toast.saved")];
    if (cancel.length > 0) parts.push(t("closure.toast.cancelled", { count: cancel.length }, cancel.length));
    if (noEmail > 0) parts.push(t("closure.toast.ring", { count: noEmail }, noEmail));
    const firstMove = moves[0];
    if (firstMove !== undefined) {
      const who1 = visitName(s, firstMove);
      parts.push(t("closure.toast.move", { name: who1.split(/\s+/)[0] ?? who1 }));
      if (moves.length > 1) parts.push(t("closure.toast.moreToMove", { count: moves.length - 1 }, moves.length - 1));
    }
    toast(parts.join(" "), { icon: "calendar-x", tone: "pos" });
    onClose();
    if (firstMove !== undefined) {
      const type = s.visitTypes.find((x) => x.id === firstMove.visit_type_id);
      startPlacing({
        what: "moving",
        patientName: visitName(s, firstMove),
        typeId: firstMove.visit_type_id,
        minutes: type?.minutes ?? firstMove.minutes,
        clinicianId: firstMove.clinician_id,
        exclude: firstMove.id,
        ref: firstMove.ref,
        day: nextOpenDay(s, to, firstMove.clinician_id),
        place: (at) => openSheet({ kind: "move", visitId: firstMove.id, to: at }),
      });
    }
  };

  const clinicians = activeClinicians(desk);
  const whoOptions = [{ id: null as Id | null, name: t("closure.whole"), role: t("closure.everyone"), color: "" }, ...clinicians.map((c) => ({ id: c.id as Id | null, name: c.short_name, role: c.role_label, color: c.color }))];

  return (
    <Sheet icon={CalendarX} title={t("closure.title")} sub={t("closure.sub")} onClose={onClose}>
      {locked && (
        <Note tone="info" icon={Info} role="status">
          {t("closure.lockedLine")}
        </Note>
      )}

      <section aria-labelledby="cls-who" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3 id="cls-who" style={{ ...kicker, margin: 0 }}>
          {t("closure.who")}
        </h3>
        <div role="group" aria-labelledby="cls-who" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 7 }}>
          {whoOptions.map((w) => {
            const on = who === w.id;
            return (
              <button
                key={String(w.id)}
                type="button"
                className="rh-btn"
                aria-pressed={on}
                disabled={locked}
                onClick={() => {
                  setWho(w.id);
                  resetChoices();
                }}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: 9, borderRadius: 12, cursor: locked ? "not-allowed" : "pointer", textAlign: "start", border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, background: on ? "var(--accent-soft)" : "var(--surface)", color: "var(--fg)" }}
              >
                {w.id === null ? (
                  <span aria-hidden="true" style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 10, background: "var(--surface-3)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <DoorClosed size={15} />
                  </span>
                ) : (
                  <Tile name={clinicians.find((c) => c.id === w.id)?.name ?? w.name} color={w.color} size={32} />
                )}
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800 }}>{w.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-subtle)" }}>{w.role}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <span style={labelText}>{t("closure.from")}</span>
          <input
            className="rh-fld"
            type="date"
            value={from}
            min={today}
            disabled={locked}
            onChange={(e) => {
              const v = e.target.value;
              setFrom(v);
              setTo((old) => (old !== "" && old >= v ? old : v));
              resetChoices();
            }}
            aria-describedby={problem === "backwards" ? "cls-date-err" : undefined}
            style={fieldStyle(true)}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <span style={labelText}>{t("closure.to")}</span>
          <input
            className="rh-fld"
            type="date"
            value={to}
            min={from === "" ? today : from}
            disabled={locked}
            onChange={(e) => {
              setTo(e.target.value);
              resetChoices();
            }}
            aria-invalid={problem === "backwards"}
            aria-describedby={problem === "backwards" ? "cls-date-err" : undefined}
            style={fieldStyle(true)}
          />
        </label>
      </div>
      {problem === "backwards" && (
        <Note tone="danger" icon={CircleAlert} role="alert" id="cls-date-err">
          {t("closure.backwards")}
        </Note>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span style={labelText}>{t("closure.label")}</span>
        <input className="rh-fld" value={label} disabled={locked} onChange={(e) => setLabel(e.target.value)} placeholder={t("closure.labelPlaceholder")} style={fieldStyle(false)} />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelText}>{t("closure.note")}</span>
        <textarea className="rh-fld" value={note} disabled={locked} onChange={(e) => setNote(e.target.value)} placeholder={t("closure.notePlaceholder")} style={areaStyle} />
      </label>

      {problem === null && read === "reading" && !locked && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "var(--fg-subtle)" }}>
          <Loader2 size={14} aria-hidden="true" style={{ animation: "rh-spin 0.9s linear infinite" }} />
          {t("closure.reading")}
        </div>
      )}
      {problem === null && read === "failed" && !locked && (
        <Note tone="danger" icon={CircleAlert} role="alert">
          <span>{t("closure.readFailed")} </span>
          <button type="button" className="rh-gi" onClick={() => setReadTick((n) => n + 1)} style={{ border: "none", background: "transparent", color: "inherit", font: "inherit", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
            {t("common.tryAgain")}
          </button>
        </Note>
      )}

      {clashes.length > 0 && readOk && (
        <section aria-labelledby="cls-clash" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 13, borderRadius: 14, background: "var(--warn-soft)", color: "var(--warn)" }}>
          <h3 id="cls-clash" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800 }}>
            <TriangleAlert size={15} aria-hidden="true" />
            {t("closure.clashTitle", { count: clashes.length }, clashes.length)}
          </h3>
          {clashes.map((v) => {
            const choice = choices[v.id];
            const vname = visitName(desk, v);
            const pick = (c: Choice) => setChoices((m) => ({ ...m, [v.id]: c }));
            const done = locked && v.status === "cancelled";
            return (
              <div key={v.id} role="group" aria-label={vname} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 11px", borderRadius: 11, background: "var(--surface)", color: "var(--fg)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{vname}</span>
                  <span style={mono(11.5, 600, "var(--fg-muted)")}>{`${dayShort(dayOf(v.starts_at))} ${time(v.starts_at)}`}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{desk.clinicians.find((c) => c.id === v.clinician_id)?.short_name ?? ""}</span>
                </div>
                {done ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--pos)" }}>
                    <Check size={13} aria-hidden="true" />
                    {t("closure.cancelledDone")}
                  </span>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="rh-chip" aria-pressed={choice === "move"} disabled={locked} onClick={() => pick("move")} style={{ ...chipStyle(choice === "move"), height: 30, paddingInline: 10, fontSize: 11.5 }}>
                      <CalendarSync size={12} aria-hidden="true" />
                      {t("closure.move")}
                    </button>
                    <button type="button" className="rh-chip" aria-pressed={choice === "cancel"} disabled={locked} onClick={() => pick("cancel")} style={{ ...chipStyle(choice === "cancel"), height: 30, paddingInline: 10, fontSize: 11.5 }}>
                      <MailX size={12} aria-hidden="true" />
                      {t("closure.cancelEmail")}
                    </button>
                  </div>
                )}
                {choice === "cancel" && !hasEmail(desk, v.id) && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "var(--warn)" }}>
                    <PhoneCall size={12} aria-hidden="true" />
                    {t("closure.noEmail")}
                  </span>
                )}
              </div>
            );
          })}
        </section>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {error !== null && (
          <Note tone="danger" icon={CircleAlert} role="alert">
            {error}
          </Note>
        )}
        {!mayAdd && (
          <Note tone="info" icon={Info}>
            {t("refusal.not-allowed")}
          </Note>
        )}
        <Btn icon={Check} busy={busy} disabled={!ok} onClick={() => void save()} style={{ ...btnPrimary, width: "100%", ...(!ok && !busy ? { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 } : {}) }}>
          {locked ? t("closure.finish") : t("closure.save")}
        </Btn>
        {hint !== null && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{hint}</span>}
      </div>
    </Sheet>
  );
}

/** Whether the cancellation email has somewhere to go: the patient's address, or a first visit's own. */
function hasEmail(s: ReturnType<typeof useDesk.getState>, visitId: Id): boolean {
  const visit = s.visits[visitId];
  if (visit === undefined) return false;
  const email = patientOf(s, visit.patient_id)?.email ?? visit.new_email;
  return email !== null && email !== undefined && email.trim() !== "";
}
