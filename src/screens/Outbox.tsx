/**
 * The reminders outbox: what is going out, what went today, what could not.
 *
 * "Waiting to go" is the queued rows and the reminders Adminium will queue
 * itself — every booked visit starting within the largest lead, each at its
 * own patient's time (`outbox/rows.ts`). "Send" on one of those queues it now;
 * the reminder scan then finds it in the log and sends no second one. "Send
 * again" puts a failed row back in the queue. A row with no address is not
 * sendable: it reads "No email on file".
 *
 * Every send carries its own action key, kept until it is saved, and every
 * button is busy while its save runs, so a double click or a second "Send
 * them all" never queues an email twice.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, BellOff, BellRing, CalendarCheck, Check, Clock, DoorClosed, MailX, Send, UserRoundX } from "lucide-react";

import type { Appointment, Id, MessageKind } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { now as clockNow, today } from "../lib/clock.ts";
import { dayOf, daysBetween, dayShort, time } from "../lib/format.ts";
import { actionKey } from "../lib/keys.ts";
import { clinicianOf, visitName } from "../lib/desk.ts";
import { useNow } from "../lib/useNow.ts";
import { sendAgain, sendReminderNow } from "../state/actions.ts";
import { deskReads, ensureDays, ensurePatients, upsert, useCan, useDesk, type DeskState } from "../state/desk.ts";
import { toast } from "../state/ui.ts";
import { Btn, Tile, mono, monoPill, pill } from "../components/ui.tsx";
import { counted, dayMonthNear } from "./deskwork/dates.ts";
import { Screen, ScreenHead, dashedNote, footNote, nameStyle } from "./deskwork/parts.tsx";
import { outboxRows, reasonKey, remindsThisStart, upcomingReminders, waitingCount, type OutboxRow } from "./outbox/rows.ts";

const KINDS: Record<MessageKind, { bg: string; fg: string; icon: LucideIcon; key: `outbox.kind.${MessageKind}` }> = {
  reminder: { bg: "var(--info-soft)", fg: "var(--info)", icon: Bell, key: "outbox.kind.reminder" },
  missed: { bg: "var(--warn-soft)", fg: "var(--warn)", icon: UserRoundX, key: "outbox.kind.missed" },
  recall: { bg: "var(--accent-soft)", fg: "var(--accent)", icon: BellRing, key: "outbox.kind.recall" },
  cancelled: { bg: "var(--danger-soft)", fg: "var(--danger)", icon: DoorClosed, key: "outbox.kind.cancelled" },
  confirmation: { bg: "var(--pos-soft)", fg: "var(--pos)", icon: CalendarCheck, key: "outbox.kind.confirmation" },
};

/** A visit the desk may still remind: booked, and not started. */
const remindable = (visit: Appointment | undefined, now: number): boolean => visit !== undefined && visit.status === "booked" && Date.parse(visit.starts_at) > now;

export default function Outbox() {
  const { t } = useI18n();
  const now = useNow();
  const day = today();
  const desk = useDesk();
  const canSend = useCan("messages", "create");
  const canResend = useCan("messages", "update");
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);
  // One key per visit's early reminder, kept until that send is saved.
  const keys = useRef(new Map<Id, string>());
  const sending = useRef(new Set<Id>());

  // The next 48 hours of the diary, and the visits the log names that the desk has not read.
  useEffect(() => {
    void ensureDays(day, 3).catch(() => undefined);
  }, [day]);
  const messages = useMemo(() => Object.values(desk.messages), [desk.messages]);
  useEffect(() => {
    const missing = [...new Set(messages.map((m) => m.appointment_id).filter((id): id is Id => id !== null && useDesk.getState().visits[id] === undefined))];
    if (missing.length === 0) return;
    void deskReads()
      .visits(missing)
      .then(async (rows) => {
        for (const row of rows) upsert("appointments", row);
        await ensurePatients(rows.map((r) => r.patient_id));
      })
      .catch(() => undefined);
  }, [messages]);

  const upcoming = useMemo(
    () => upcomingReminders({ visits: Object.values(desk.visits), patients: desk.patients, messages, settings: desk.settings, now }),
    [desk.visits, desk.patients, messages, desk.settings, now],
  );
  const rows = outboxRows(messages, upcoming, day, dayOf);
  const waiting = waitingCount(rows);
  const off = desk.settings !== null && !desk.settings.reminders_on;
  const tint = [...desk.visitTypes].sort((a, b) => a.position - b.position)[0]?.color ?? "#0369a1";

  const mark = (key: string, on: boolean) =>
    setBusy((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  /** Queue one visit's reminder now; true when it was saved. */
  const sendEarly = async (visit: Appointment, quiet = false): Promise<boolean> => {
    const current = useDesk.getState().visits[visit.id];
    // Checked again at the click: another desk may have moved or cancelled it since the list was drawn.
    if (!remindable(current, clockNow())) {
      if (!quiet) toast(t("outbox.visitGone"), { icon: "calendar-x", tone: "warn" });
      return false;
    }
    // A second press while the first is saving, or after it saved: the log already holds this reminder.
    if (sending.current.has(visit.id) || Object.values(useDesk.getState().messages).some((m) => remindsThisStart(m, current!))) return false;
    const key = keys.current.get(visit.id) ?? actionKey();
    keys.current.set(visit.id, key);
    sending.current.add(visit.id);
    mark(`v${String(visit.id)}`, true);
    const outcome = await sendReminderNow(visit.id, key);
    mark(`v${String(visit.id)}`, false);
    sending.current.delete(visit.id);
    if (!outcome.ok) {
      if (!quiet) toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
      return false;
    }
    keys.current.delete(visit.id);
    if (!quiet) toast(t("outbox.onItsWay", { name: visitName(useDesk.getState(), visit), address: outcome.value.to_address ?? "" }), { icon: "send", tone: "pos" });
    return true;
  };

  const retry = async (row: OutboxRow) => {
    if (row.message === null) return;
    mark(row.key, true);
    const outcome = await sendAgain(row.message.id);
    mark(row.key, false);
    if (outcome.ok) toast(t("outbox.queuedAgain"), { icon: "send" });
    else toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
  };

  const sendAll = async () => {
    if (sendingAll) return;
    const todo = rows.filter((r) => r.state === "upcoming" && r.upcoming !== null && r.upcoming.to !== null).map((r) => r.upcoming!.visit);
    if (todo.length === 0) {
      toast(t("outbox.allGone"), { icon: "check" });
      return;
    }
    setSendingAll(true);
    let sent = 0;
    // One at a time, each with its own key: a failure stops nothing and repeats nothing.
    for (const visit of todo) if (await sendEarly(visit, true)) sent += 1;
    setSendingAll(false);
    const failed = todo.length - sent;
    if (failed === 0) toast(t("outbox.allSent", counted(sent), sent), { icon: "send", tone: "pos" });
    else toast(t("outbox.someSent", { sent, failed }), { icon: "circle-alert", tone: "warn" });
  };

  return (
    <Screen name="Outbox">
      <ScreenHead
        kicker={t("nav.outbox")}
        title={t("outbox.title")}
        end={
          <>
            <span style={monoPill("var(--surface-3)", "var(--fg-muted)")} role="status">
              {t("outbox.waiting", counted(waiting), waiting)}
            </span>
            {canSend && (
              <Btn icon={Send} busy={sendingAll} onClick={() => void sendAll()}>
                {t("outbox.sendAll")}
              </Btn>
            )}
          </>
        }
      />
      <p style={{ ...footNote, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <Clock size={14} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 3 }} />
        {t("outbox.top")}
      </p>
      {off && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 15px", borderRadius: 14, background: "var(--warn-soft)", color: "var(--warn)", fontSize: 13, fontWeight: 700 }}>
          <BellOff size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
          {t("outbox.off")}
        </div>
      )}
      {rows.length === 0 ? (
        <div style={dashedNote}>{t("outbox.empty")}</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => (
            <li key={row.key}>
              <Row
                row={row}
                desk={desk}
                now={now}
                tint={tint}
                busy={busy.has(row.key)}
                canSend={canSend}
                canResend={canResend}
                onSend={() => row.upcoming !== null && void sendEarly(row.upcoming.visit)}
                onRetry={() => void retry(row)}
              />
            </li>
          ))}
        </ul>
      )}
      <p style={footNote}>{t("outbox.foot")}</p>
    </Screen>
  );
}

function Row({
  row,
  desk,
  now,
  tint,
  busy,
  canSend,
  canResend,
  onSend,
  onRetry,
}: {
  row: OutboxRow;
  desk: DeskState;
  now: number;
  tint: string;
  busy: boolean;
  canSend: boolean;
  canResend: boolean;
  onSend: () => void;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const m = row.message;
  const visit = row.upcoming?.visit ?? (m?.appointment_id == null ? undefined : desk.visits[m.appointment_id]);
  const name = m?.patient_id != null ? (desk.patients[m.patient_id]?.name ?? (visit ? visitName(desk, visit) : "")) : visit ? visitName(desk, visit) : "";
  const kind = KINDS[row.kind];
  const to = row.upcoming !== null ? row.upcoming.to : (m?.to_address ?? null);
  const why = m === null ? null : reasonKey(m.error);
  const noAddress = to === null || to.trim() === "";
  const line = lineFor(row, visit, desk, t);

  let state: React.ReactNode = null;
  let action: React.ReactNode = null;
  const quietPill = (icon: LucideIcon, text: string) => {
    const Icon = icon;
    return (
      <span style={monoPill("var(--surface-3)", "var(--fg-muted)")}>
        <Icon size={12} aria-hidden="true" />
        {text}
      </span>
    );
  };
  if (row.state === "sent" && m !== null) {
    state = (
      <span style={monoPill("var(--pos-soft)", "var(--pos)")}>
        <Check size={12} aria-hidden="true" />
        {t("outbox.sent", { time: time(m.sent_at ?? m.created_at ?? new Date(now).toISOString()) })}
      </span>
    );
  } else if (row.state === "failed") {
    state = (
      <span style={pill("var(--danger-soft)", "var(--danger)")}>
        <MailX size={12} aria-hidden="true" />
        {t("outbox.failed")}
      </span>
    );
    // A reminder for a visit no longer happening is not sent again.
    if (canResend && (row.kind !== "reminder" || remindable(visit, now))) {
      action = (
        <Btn kind="ghostSm" icon={Send} busy={busy} onClick={onRetry} style={{ height: 36 }} label={t("outbox.sendAgainTo", { name })}>
          {t("outbox.sendAgain")}
        </Btn>
      );
    }
  } else if (row.state === "skipped") {
    state = quietPill(MailX, why === "outbox.why.example" ? t("outbox.example") : t("outbox.noEmail"));
  } else if (row.state === "queued") {
    state = quietPill(Send, t("outbox.queued"));
  } else if (row.upcoming !== null) {
    if (noAddress) state = quietPill(MailX, t("outbox.noEmail"));
    else {
      const goes = row.upcoming.goesAt;
      state = quietPill(Clock, goes <= now ? t("outbox.goesNow") : dayOf(goes) === today() ? t("outbox.goesAt", { time: time(goes) }) : t("outbox.goesOn", { day: dayShort(dayOf(goes)), time: time(goes) }));
      if (canSend) {
        action = (
          <Btn kind="ghostSm" icon={Send} busy={busy} onClick={onSend} style={{ height: 36 }} label={t("outbox.sendTo", { name })}>
            {t("outbox.send")}
          </Btn>
        );
      }
    }
  }

  const reason = row.state === "failed" && m !== null ? (why !== null ? t(why) : (m.error ?? "").trim()) : "";
  return (
    <div className="rh-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 15px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <Tile name={name} color={tint} size={34} />
      <span style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={nameStyle}>{name}</span>
          <span style={pill(kind.bg, kind.fg)}>
            <kind.icon size={11} aria-hidden="true" />
            {t(kind.key)}
          </span>
        </span>
        {line !== "" && <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, color: row.state === "upcoming" ? "var(--fg-subtle)" : "var(--fg-muted)", textWrap: "pretty" }}>{line}</span>}
        {!noAddress && <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), whiteSpace: "normal" }}>{t("outbox.byEmail", { address: to })}</span>}
        {reason !== "" && <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: "var(--danger)" }}>{reason}</span>}
      </span>
      {state}
      {action}
    </div>
  );
}

type T = ReturnType<typeof useI18n>["t"];

/** The row's one line, in the design's words for each kind. */
function lineFor(row: OutboxRow, visit: Appointment | undefined, desk: DeskState, t: T): string {
  const m = row.message;
  const day = today();
  const start = visit?.starts_at ?? (row.kind === "reminder" ? (m?.due_at ?? null) : null);
  const at = (iso: string) => {
    const d = dayOf(iso);
    const n = daysBetween(day, d);
    return n === 0 ? t("outbox.at.today", { time: time(iso) }) : n === 1 ? t("outbox.at.tomorrow", { time: time(iso) }) : t("outbox.at.day", { day: dayShort(d), time: time(iso) });
  };
  const who = clinicianOf(desk, visit?.clinician_id ?? null)?.short_name ?? "";
  switch (row.kind) {
    case "reminder":
    case "confirmation": {
      if (start === null) return "";
      const base = row.kind === "reminder" ? (who === "" ? at(start) : t("outbox.line.with", { at: at(start), who })) : t("outbox.line.booked", { at: at(start), who });
      return visit?.reason ? `${base} · ${visit.reason}` : base;
    }
    case "missed": {
      if (start === null) return "";
      const d = dayOf(start);
      const missed = d === day ? t("outbox.line.missedToday", { time: time(start) }) : t("outbox.line.missedOn", { time: time(start), day: dayShort(d) });
      return `${missed} — ${t("outbox.line.ringUs")}`;
    }
    case "recall": {
      const recall = m?.recall_id == null ? undefined : desk.recalls[m.recall_id];
      if (recall === undefined) return t("outbox.line.recallAny");
      const late = daysBetween(recall.due_on, day);
      return late > 0 ? t("outbox.line.recallLate", counted(late), late) : t("outbox.line.recallDue", { date: dayMonthNear(recall.due_on, day) });
    }
    case "cancelled": {
      if (start === null) return "";
      const closure = desk.closures.find((c) => c.id === m?.closure_id);
      // The note is the practice's own sentence for patients; it ends as a sentence before "Ring the desk".
      const said = (closure?.note ?? "").trim();
      const note = said === "" || /[.!?。．！？]$/.test(said) ? said : `${said}.`;
      const when = t("outbox.at.day", { day: dayShort(dayOf(start)), time: time(start) });
      return note === "" ? t("outbox.line.cancelled", { at: when }) : t("outbox.line.cancelledWhy", { at: when, why: note });
    }
  }
}
