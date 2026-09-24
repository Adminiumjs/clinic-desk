/**
 * Recalls: who is due to be seen again, grouped by their due day against the
 * practice's today — overdue at the top, then the next four weeks, then later.
 *
 * "Book them in" places the visit on the day sheet (the server's free times
 * for the recall's kind of visit and clinician), and the placed time books
 * the visit and marks the recall booked, as one resumable action with its own
 * key. "Queue a note" puts the recall email in the outbox; "Not needed" takes
 * them off the list with why.
 */
import { useRef, useState } from "react";
import { BellRing, CalendarPlus, Send } from "lucide-react";

import type { Recall } from "../data/types.ts";
import { addDays } from "../data/venueTime.ts";
import { useI18n } from "../i18n/index.tsx";
import { today } from "../lib/clock.ts";
import { dayOf, daysBetween, dayShort, time, num } from "../lib/format.ts";
import { actionKey } from "../lib/keys.ts";
import { clinicianOf, typeOf } from "../lib/desk.ts";
import { bookRecall, queueRecallNote } from "../state/actions.ts";
import { useCan, useDesk } from "../state/desk.ts";
import { openSheet, startPlacing, stopPlacing, toast } from "../state/ui.ts";
import { Btn, Empty, Tile, btnGhostSm, btnPrimary, mono, monoPill } from "../components/ui.tsx";
import { counted, dayMonthNear } from "./deskwork/dates.ts";
import { recallGroup, type RecallGroup } from "./deskwork/rules.ts";
import { Screen, ScreenHead, groupLabel, nameStyle } from "./deskwork/parts.tsx";

const GROUPS: { id: RecallGroup; key: "recalls.overdue" | "recalls.dueMonth" | "recalls.later" }[] = [
  { id: "over", key: "recalls.overdue" },
  { id: "due", key: "recalls.dueMonth" },
  { id: "later", key: "recalls.later" },
];

export default function Recalls() {
  const { t } = useI18n();
  const day = today();
  const recalls = useDesk((s) => s.recalls);
  const list = Object.values(recalls)
    .filter((r) => r.status === "due" || r.status === "noted")
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.id - b.id);

  return (
    <Screen name="Recalls">
      <ScreenHead kicker={t("nav.recalls")} title={t("recalls.title")} lede={t("recalls.lede")} />
      {list.length === 0 && <Empty icon={BellRing} title={t("recalls.empty")} body={t("recalls.emptyBody")} />}
      {GROUPS.map((g) => {
        const rows = list.filter((r) => recallGroup(r.due_on, day) === g.id);
        if (rows.length === 0) return null;
        const over = g.id === "over";
        return (
          <section key={g.id} aria-labelledby={`rc-${g.id}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <h2 id={`rc-${g.id}`} style={groupLabel}>
                {t(g.key)}
              </h2>
              <span style={{ ...mono(10.5, 600, over ? "var(--danger)" : "var(--fg-subtle)"), padding: "2px 7px", borderRadius: 999, background: over ? "var(--danger-soft)" : "var(--surface-3)" }}>{num(rows.length)}</span>
            </div>
            <ul style={{ listStyle: "none", margin: "11px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r) => (
                <li key={r.id}>
                  <RecallRow recall={r} over={over} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Screen>
  );
}

function RecallRow({ recall: r, over }: { recall: Recall; over: boolean }) {
  const { t } = useI18n();
  const desk = useDesk();
  const day = today();
  const canBook = useCan("appointments", "create");
  const canNote = useCan("messages", "create");
  const canClose = useCan("recalls", "update");
  const [noting, setNoting] = useState(false);
  // One key per action, kept until it succeeds: a retried "Book" or "Queue" finds what the first try saved.
  const bookKey = useRef<string | null>(null);
  const noteKey = useRef<string | null>(null);
  const inFlight = useRef(false);

  const patient = desk.patients[r.patient_id];
  const name = patient?.name ?? "";
  const clinician = clinicianOf(desk, r.clinician_id);
  const type = typeOf(desk, r.visit_type_id) ?? [...desk.visitTypes].sort((a, b) => a.position - b.position)[0];
  // The visit it came from: its day is the due day less the weeks it was set for.
  const lastSeen = dayMonthNear(addDays(r.due_on, -r.weeks * 7), day);
  const noted = r.status === "noted";

  const book = () => {
    if (type === undefined) return;
    bookKey.current ??= actionKey();
    const key = bookKey.current;
    startPlacing({
      what: "booking",
      patientName: name,
      typeId: type.id,
      minutes: type.minutes,
      clinicianId: r.clinician_id,
      day,
      place: (at) => {
        void bookRecall(r, { visitTypeId: type.id, clinicianId: at.clinicianId, startsAt: at.startsAt, reason: r.reason, deskNote: null }, key).then((outcome) => {
          if (outcome.ok) {
            bookKey.current = null;
            stopPlacing();
            toast(t("recalls.booked", { name, when: `${dayShort(dayOf(outcome.value.starts_at))} ${time(outcome.value.starts_at)}` }), { icon: "calendar-check", tone: "pos" });
          } else {
            toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
          }
        });
      },
    });
    toast(t("recalls.place", { name }), { icon: "calendar-plus" });
  };

  const note = async () => {
    // Read the recall as it is now: a second press may come before the screen has redrawn.
    if (noting || inFlight.current || useDesk.getState().recalls[r.id]?.status !== "due") return;
    if (patient !== undefined && (patient.email ?? "").trim() === "") {
      toast(t("recalls.noEmail", { name }), { icon: "mail-x", tone: "warn" });
      return;
    }
    noteKey.current ??= actionKey();
    inFlight.current = true;
    setNoting(true);
    const outcome = await queueRecallNote(r, noteKey.current);
    setNoting(false);
    inFlight.current = false;
    if (outcome.ok) {
      noteKey.current = null;
      toast(t("recalls.noted", { name }), { icon: "send" });
    } else {
      toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
    }
  };

  const gap = daysBetween(r.due_on, day);
  return (
    <div
      className="rh-row"
      style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 15px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", ...(over ? { borderInlineStart: "3px solid var(--danger)" } : {}) }}
    >
      <Tile name={name} color={type?.color ?? "#0369a1"} size={36} />
      <span style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={nameStyle}>{name}</span>
        <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), lineHeight: 1.6, paddingBlock: 1, whiteSpace: "normal" }}>
          {t("recalls.meta", { date: lastSeen, clinician: clinician?.short_name ?? "", weeks: t("recalls.weeks", counted(r.weeks), r.weeks) })}
        </span>
      </span>
      <span style={monoPill(over ? "var(--danger-soft)" : "var(--surface-3)", over ? "var(--danger)" : "var(--fg-muted)")}>
        {over ? t("recalls.overdueBy", counted(gap), gap) : t("recalls.dueOn", { date: dayMonthNear(r.due_on, day) })}
      </span>
      <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canBook && (
          <button type="button" className="rh-btn" onClick={book} style={{ ...btnPrimary, height: 38, fontSize: 12.5 }}>
            <CalendarPlus size={15} aria-hidden="true" />
            {t("recalls.book")}
          </button>
        )}
        {canNote && (
          <Btn kind="ghostSm" icon={Send} busy={noting} disabled={noted} onClick={() => void note()} style={{ height: 38 }}>
            {noted ? t("recalls.noteQueued") : t("recalls.note")}
          </Btn>
        )}
        {canClose && (
          <button type="button" className="rh-btn" onClick={() => openSheet({ kind: "notNeeded", recallId: r.id })} style={{ ...btnGhostSm, height: 38, color: "var(--fg-muted)" }}>
            {t("recalls.notNeeded")}
          </button>
        )}
      </span>
    </div>
  );
}
