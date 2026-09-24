/**
 * My visits (P4): find yourself, type the emailed code, then what is coming
 * up (move it, cancel it), what has been, and anything still to pay at the
 * desk. "Not you? Sign out" ends the session.
 *
 * Moving is offered only outside the cancellation window; inside it the
 * card says to ring the desk, because the server refuses a patient's move
 * there. Cancelling is always offered on a booked visit — inside the window
 * it is flagged late, never refused.
 */
import { useEffect, useState } from "react";
import { CalendarSync, Check, Clock, RotateCw, Wallet } from "lucide-react";

import type { OwnVisit } from "../../data/ports.ts";
import { PortError } from "../../data/ports.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Btn, Dot, btnGhostSm, cardStyle, mono, monoPill, pill } from "../../components/ui.tsx";
import { ageOn, dayMonth, dayOf, dayShort, money, num, timeRange } from "../../lib/format.ts";
import { useNow } from "../../lib/useNow.ts";
import { loadMyVisits, signOutPatient, usePatients } from "../../state/patients.ts";
import { go, openSheet, toast } from "../../state/ui.ts";
import { forgetSession, useFlow } from "./flow.ts";
import { howFar, insideWindow, sessionEnded } from "./logic.ts";
import { ClinicianTile, Fill, PageHead, Phone, clinicianNamed, quietBtn, sectionLabel, useCatalogue } from "./parts.tsx";
import { useTodayDay } from "./useToday.ts";
import { VerifyFlow, endSession } from "./VerifyFlow.tsx";

export default function MyVisits() {
  const { t } = useI18n();
  const cat = useCatalogue();
  const phone = cat?.settings?.phone ?? "";
  return (
    <div className="rh-screen" data-screen="MyVisits" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHead title={t("visits.title")} lede={t("visits.lede")} />
      <VerifyFlow side="visits" findLabel={t("visits.find")} phone={phone}>
        <Found />
      </VerifyFlow>
    </div>
  );
}

/** Sign out: the session ends, and the page forgets the person. */
export async function signOutHere(): Promise<void> {
  await signOutPatient();
  forgetSession(false);
}

/** The person's header: who, when born, their mobile; the next visit, what is owed; "Not you? Sign out". */
export function PersonHeader({ size, extra }: { size: number; extra?: React.ReactNode }) {
  const { t } = useI18n();
  const cat = useCatalogue();
  const found = usePatients((s) => s.found);
  const mobile = useFlow((s) => s.visits.mobile || s.prefs.mobile);
  const today = useTodayDay();
  if (found === null) return null;
  const meta = [found.bornOn, t("visits.age", { n: num(ageOn(found.bornOn, today)) }), mobile.trim()].filter((x) => x !== "").join(" · ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <ClinicianTile name={found.name} color={cat?.visitTypes[0]?.color ?? "#3b6fbd"} size={size} />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.025em" }}>{found.name}</span>
        <span style={{ ...mono(12, 600, "var(--fg-subtle)"), whiteSpace: "normal" }}>{meta}</span>
      </span>
      <span style={{ marginInlineStart: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {extra}
        <button type="button" className="rh-gi" onClick={() => void signOutHere()} style={{ ...quietBtn, height: 28, paddingInline: 10 }}>
          {t("visits.signOut")}
        </button>
      </span>
    </div>
  );
}

const NEXT_KEY = { min: "visits.next.min", hours: "visits.next.hours", days: "visits.next.days" } as const;

function Found() {
  const { t } = useI18n();
  const cat = useCatalogue();
  const visits = usePatients((s) => s.visits);
  const nowMs = useNow();
  const today = useTodayDay();
  const [failed, setFailed] = useState(false);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    setFailed(false);
    loadMyVisits().catch(async (error: unknown) => {
      if (error instanceof PortError && sessionEnded(error.code)) await endSession(true, "timeout");
      else setFailed(true);
    });
  }, [again]);

  const settings = cat?.settings ?? null;
  if (cat === null || settings === null) return null;

  if (failed) {
    return (
      <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>{t("pShell.offline")}</span>
        <Btn kind="ghostSm" icon={RotateCw} onClick={() => setAgain((n) => n + 1)}>
          {t("common.tryAgain")}
        </Btn>
      </div>
    );
  }

  const up = (visits ?? []).filter((v) => Date.parse(v.starts_at) >= nowMs).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = (visits ?? []).filter((v) => Date.parse(v.starts_at) < nowMs && v.status !== "booked" && v.status !== "cancelled").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const owed = (visits ?? []).filter((v) => v.status === "seen" && v.balance > 0).reduce((sum, v) => sum + v.balance, 0);
  const next = up.find((v) => v.status !== "cancelled");
  const far = next === undefined ? null : howFar(next.starts_at, nowMs);

  const pills = (
    <>
      {far !== null && (
        <span style={monoPill("var(--pos-soft)", "var(--pos)")}>
          <Clock size={12} aria-hidden="true" />
          {t(NEXT_KEY[far.unit], { n: num(far.n) }, far.n)}
        </span>
      )}
      {owed > 0 && (
        <span style={monoPill("var(--warn-soft)", "var(--warn)")}>
          <Wallet size={12} aria-hidden="true" />
          {t("visits.owed", { amount: money(owed, settings.currency) })}
        </span>
      )}
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PersonHeader size={40} extra={visits === null ? undefined : pills} />
      <section aria-labelledby="mv-up">
        <h2 id="mv-up" style={{ ...sectionLabel, margin: 0, lineHeight: "normal" }}>
          {t("visits.comingUp")}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBlockStart: 11 }}>
          {visits === null ? (
            <div className="rh-skel" style={{ height: 96, borderRadius: 15 }} />
          ) : up.length === 0 ? (
            <div style={{ padding: 18, borderRadius: 14, border: "1px dashed var(--border-strong)", background: "var(--surface-2)", fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>
              <Fill text={t("visits.nothingUp")} name="link">
                <button type="button" onClick={() => go("find")} style={{ border: "none", background: "transparent", padding: 0, color: "var(--accent)", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  {t("findUs.findTime")}
                </button>
              </Fill>
            </div>
          ) : (
            up.map((v) => <UpcomingCard key={v.id} v={v} nowMs={nowMs} today={today} />)
          )}
        </div>
      </section>
      <section aria-labelledby="mv-past">
        <h2 id="mv-past" style={{ ...sectionLabel, margin: 0, lineHeight: "normal" }}>
          {t("visits.beenAndGone")}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBlockStart: 11 }}>
          {visits === null ? (
            <div className="rh-skel" style={{ height: 60, borderRadius: 14 }} />
          ) : past.length === 0 ? (
            <div style={{ padding: 18, borderRadius: 14, border: "1px dashed var(--border-strong)", background: "var(--surface-2)", fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>{t("visits.nothingPast")}</div>
          ) : (
            past.map((v) => <PastRow key={v.id} v={v} />)
          )}
        </div>
      </section>
    </div>
  );
}

function UpcomingCard({ v, nowMs, today }: { v: OwnVisit; nowMs: number; today: string }) {
  const { t } = useI18n();
  const cat = useCatalogue()!;
  const settings = cat.settings!;
  const who = clinicianNamed(cat, v.clinician_id);
  const type = cat.visitTypes.find((x) => x.id === v.visit_type_id);
  const gone = v.status === "cancelled";
  const live = v.status === "booked";
  const inside = insideWindow(v.starts_at, nowMs, settings.cancel_hours);

  const reschedule = () => {
    usePatients.setState({
      moving: { id: v.id, ref: v.ref, startsAt: v.starts_at, typeId: v.visit_type_id, clinicianId: v.clinician_id },
      typeId: v.visit_type_id,
      clinicianId: v.clinician_id ?? "any",
      day: today,
      time: null,
    });
    go("find");
    toast(t("visits.pickNew", { ref: v.ref }), { icon: "calendar-sync" });
  };

  return (
    <div className="rh-card" style={{ ...cardStyle, padding: 16, borderRadius: 15, display: "flex", alignItems: "flex-start", gap: 13, flexWrap: "wrap" }}>
      <ClinicianTile name={who?.name ?? null} color={who?.color ?? null} size={40} />
      <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.022em" }}>{who === null ? (type?.name ?? "") : `${who.short} · ${who.role}`}</span>
          {v.late_cancel && <span style={pill("var(--surface-3)", "var(--fg-subtle)")}>{t("visits.lateChip")}</span>}
          {gone && <span style={pill("var(--surface-3)", "var(--fg-subtle)")}>{t("visits.cancelledChip")}</span>}
        </div>
        <span style={{ ...mono(12.5, 600, "var(--fg)"), whiteSpace: "normal" }}>{`${dayShort(dayOf(v.starts_at))} · ${timeRange(v.starts_at, v.minutes)} · ${v.ref}`}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)", textWrap: "pretty" }}>{v.reason !== null && v.reason !== "" ? v.reason : (type?.name ?? "")}</span>
      </div>
      {live && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {!inside ? (
            <Btn kind="ghostSm" icon={CalendarSync} onClick={reschedule} style={{ height: 38 }} label={`${t("visits.reschedule")} ${v.ref}`}>
              {t("visits.reschedule")}
            </Btn>
          ) : (
            <span style={{ maxWidth: "34ch", fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>
              <Fill text={t("visits.ringToMove", { hours: num(settings.cancel_hours) })} name="phone">
                <Phone value={settings.phone} size={12} />
              </Fill>
            </span>
          )}
          <button type="button" className="rh-btn" onClick={() => openSheet({ kind: "cancel", visitId: v.id })} aria-label={`${t("visits.cancel")} ${v.ref}`} style={{ ...btnGhostSm, height: 38, color: "var(--danger)" }}>
            {t("visits.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}

function PastRow({ v }: { v: OwnVisit }) {
  const { t } = useI18n();
  const cat = useCatalogue()!;
  const settings = cat.settings!;
  const who = clinicianNamed(cat, v.clinician_id);
  const type = cat.visitTypes.find((x) => x.id === v.visit_type_id);
  const owes = v.status === "seen" && v.balance > 0;
  const settled = v.status === "seen" && !owes;
  return (
    <div className="rh-row" style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap", padding: "14px 16px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <span style={{ ...mono(12.5, 600, "var(--fg-muted)"), minWidth: 52 }}>{dayMonth(dayOf(v.starts_at))}</span>
      <Dot color={type?.color ?? "#5a5a65"} />
      <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em" }}>{v.reason !== null && v.reason !== "" ? v.reason : (type?.name ?? "")}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)" }}>{who === null ? "" : `${who.short} · ${who.role}`}</span>
      </div>
      {owes && (
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--warn)" }}>
          <Fill text={t("visits.toPay")} name="amount">
            <span style={mono(13, 600, "var(--warn)")}>{money(v.balance, settings.currency)}</span>
          </Fill>
        </span>
      )}
      {settled && (
        <span style={pill("var(--pos-soft)", "var(--pos)")}>
          <Check size={12} aria-hidden="true" />
          {t("visits.settled")}
        </span>
      )}
    </div>
  );
}
