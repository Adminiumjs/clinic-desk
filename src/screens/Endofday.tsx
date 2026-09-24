/**
 * End of day: four cards from today's rows (who is still to be seen, what is
 * unpaid, who never came, what was taken), the first hour of tomorrow, and
 * "Close the desk" — once a day, after which the screen says who closed it
 * and when.
 */
import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { Banknote, Lock, MoonStar, UserRoundX, UsersRound, Wallet } from "lucide-react";

import { COUNTED, IN_THE_BUILDING, type View } from "../data/types.ts";
import { addDays } from "../data/venueTime.ts";
import { useI18n } from "../i18n/index.tsx";
import { today } from "../lib/clock.ts";
import { clockOf, dayLong, dayOf, hhmmOf, minutesOf, time, num } from "../lib/format.ts";
import { clinicianOf, practiceHours, typeOf, visitName, visitsOn } from "../lib/desk.ts";
import { ensureDays, useCan, useDesk } from "../state/desk.ts";
import { go, openSheet } from "../state/ui.ts";
import { Btn, Dot, btnGhostSm, mono } from "../components/ui.tsx";
import { amountText } from "../sheets/deskwork/money.ts";
import { counted, wallTime } from "./deskwork/dates.ts";
import { Screen, ScreenHead, cardStyle, sectionTitle } from "./deskwork/parts.tsx";

const TONES = { pos: ["var(--pos-soft)", "var(--pos)"], warn: ["var(--warn-soft)", "var(--warn)"], danger: ["var(--danger-soft)", "var(--danger)"] } as const;

/** How far into tomorrow "first thing" looks: the first hour after opening. */
const FIRST_THING_MINUTES = 60;

export default function Endofday() {
  const { t } = useI18n();
  const day = today();
  const tomorrow = addDays(day, 1);
  const desk = useDesk();
  const canClose = useCan("day_closes", "create");

  useEffect(() => {
    void ensureDays(tomorrow, 1).catch(() => undefined);
  }, [tomorrow]);

  const todays = visitsOn(desk, day);
  const unseen = todays.filter((v) => v.status === "booked" || IN_THE_BUILDING.includes(v.status));
  const unpaid = todays.filter((v) => v.status === "seen" && v.balance > 0);
  const owed = unpaid.reduce((sum, v) => sum + v.balance, 0);
  const noShows = todays.filter((v) => v.status === "no_show");
  const messages = Object.values(desk.messages);
  const noted = noShows.filter((v) => messages.some((m) => m.kind === "missed" && m.appointment_id === v.id && m.status !== "skipped" && m.status !== "failed")).length;
  const taken = Object.values(desk.payments)
    .filter((p) => !p.voided && dayOf(p.paid_at) === day)
    .reduce((sum, p) => sum + p.amount, 0);
  const remindersOn = desk.settings?.reminders_on ?? true;

  const opens = practiceHours(desk, tomorrow);
  const cutOff = opens === null ? null : opens.opens + FIRST_THING_MINUTES;
  const early =
    cutOff === null
      ? []
      : visitsOn(desk, tomorrow).filter((v) => COUNTED.includes(v.status) && minutesOf(hhmmOf(v.starts_at)) <= cutOff);
  const closed = Object.values(desk.dayCloses).find((c) => c.day === day);

  const noShowNote =
    noShows.length === 0 ? t("eod.nobodyMissed") : !remindersOn ? t("eod.notesOff") : noted === noShows.length ? t("eod.noteEach") : t("eod.noteSome", { count: noted, of: noShows.length });

  const cards: { id: string; icon: LucideIcon; label: string; value: string; note: string; tone: keyof typeof TONES; to: View; button: string }[] = [
    {
      id: "u",
      icon: UsersRound,
      label: t("eod.unseen"),
      value: num(unseen.length),
      note: unseen.length > 0 ? t("eod.lastStarts", { time: time(unseen[unseen.length - 1]!.starts_at) }) : t("eod.dayDone"),
      tone: unseen.length > 0 ? "warn" : "pos",
      to: "daysheet",
      button: t("eod.openDay"),
    },
    {
      id: "p",
      icon: Wallet,
      label: t("eod.unpaid"),
      value: amountText(owed),
      note: t("eod.toSettle", counted(unpaid.length), unpaid.length),
      tone: owed > 0 ? "warn" : "pos",
      to: "accounts",
      button: t("eod.goAccounts"),
    },
    { id: "n", icon: UserRoundX, label: t("eod.noShows"), value: num(noShows.length), note: noShowNote, tone: noShows.length > 0 ? "danger" : "pos", to: "outbox", button: t("eod.openOutbox") },
    { id: "t", icon: Banknote, label: t("eod.taken"), value: amountText(taken), note: t("eod.methods"), tone: "pos", to: "accounts", button: t("eod.goAccounts") },
  ];

  return (
    <Screen name="Endofday">
      <ScreenHead kicker={t("nav.endofday")} title={t("eod.title")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 11 }}>
        {cards.map((c) => (
          <div key={c.id} className="rh-card" style={{ padding: 16, borderRadius: 15, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span aria-hidden="true" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: TONES[c.tone][0], color: TONES[c.tone][1] }}>
                <c.icon size={15} />
              </span>
              <h2 style={{ margin: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" }}>{c.label}</h2>
            </div>
            <span style={mono(22, 600, "var(--fg)")}>{c.value}</span>
            <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-muted)", textWrap: "pretty" }}>{c.note}</span>
            <button type="button" className="rh-btn" onClick={() => go(c.to)} style={{ ...btnGhostSm, height: 36 }}>
              {c.button}
            </button>
          </div>
        ))}
      </div>

      <section aria-labelledby="eod-first" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <h2 id="eod-first" style={sectionTitle}>
            {t("eod.firstThing")}
          </h2>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)" }}>{t("eod.tomorrowIs", { day: dayLong(tomorrow) })}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBlockStart: 13 }}>
          {early.map((v) => {
            const type = typeOf(desk, v.visit_type_id);
            return (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, paddingBlockEnd: 9, borderBlockEnd: "1px solid var(--border)" }}>
                <span style={mono(13, 600, "var(--fg)")}>{time(v.starts_at)}</span>
                <Dot color={type?.color ?? "#0369a1"} size={8} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, letterSpacing: "-.02em" }}>{visitName(desk, v)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)", textAlign: "end" }}>
                  {[clinicianOf(desk, v.clinician_id)?.short_name, v.reason ?? type?.name].filter(Boolean).join(" · ")}
                </span>
              </div>
            );
          })}
          {early.length === 0 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>{cutOff === null ? t("eod.closedTomorrow") : t("eod.gentle", { time: wallTime(clockOf(cutOff)) })}</div>
          )}
        </div>
      </section>

      {closed !== undefined && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderRadius: 13, background: "var(--pos-soft)", color: "var(--pos)", fontSize: 13, fontWeight: 800 }}>
          <Lock size={15} aria-hidden="true" />
          {closed.closed_by ? t("eod.closedBy", { time: time(closed.closed_at), name: closed.closed_by }) : t("eod.closedAt", { time: time(closed.closed_at) })}
        </div>
      )}
      {canClose && (
        <Btn
          icon={MoonStar}
          disabled={closed !== undefined}
          onClick={() => openSheet({ kind: "closeDesk" })}
          style={{ alignSelf: "flex-start", ...(closed !== undefined ? { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 } : {}) }}
        >
          {closed !== undefined ? t("eod.closed") : t("eod.close")}
        </Btn>
      )}
    </Screen>
  );
}
