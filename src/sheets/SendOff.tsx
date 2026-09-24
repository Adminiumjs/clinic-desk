/**
 * Send them off: the visit is over — take a payment (or leave it on their
 * account), say when to see them again, and mark the visit seen.
 *
 * The saves go in that order, the visit's "seen" LAST, so a visit never reads
 * Seen with its payment or recall missing. The key is made once and kept
 * until everything is saved: a second "Done" after a dropped answer finds
 * the payment and the recall already made and carries on, never taking the
 * money twice. Once a payment or recall is saved it is shown as saved and can
 * no longer be changed here, so a retry cannot quietly keep an old amount.
 *
 * "Book the follow-up now" saves first and then asks the day sheet for a time
 * on the due day: the time placed books the recall just made. Leaving the day
 * sheet without placing one leaves the recall due, which is the truth.
 */
import { useMemo, useState } from "react";
import { ArrowLeftRight, Banknote, CalendarPlus, CircleAlert, CircleCheck, CreditCard, HandHeart, Info, Printer, UserRound, type LucideIcon } from "lucide-react";

import type { PayMethod, Payment, Recall } from "../data/types.ts";
import { addDays } from "../data/venueTime.ts";
import { useI18n } from "../i18n/index.tsx";
import { actionKey, stepKey } from "../lib/keys.ts";
import { dayMonth, dayOf, dayShort, money, time } from "../lib/format.ts";
import { useNow } from "../lib/useNow.ts";
import { clinicianOf, typeOf, visitName } from "../lib/desk.ts";
import { bookRecall, bookVisit, sendOff } from "../state/actions.ts";
import { deskReads, upsert, useDesk } from "../state/desk.ts";
import { openSheet, startPlacing, stopPlacing, toast, type Sheet as SheetKind } from "../state/ui.ts";
import { Btn, Sheet, Tile, btnGhost, chipStyle, fieldStyle, kicker, monoPill, mono, segTrack, segWide } from "../components/ui.tsx";
import { halfOf, lastBookableDay, parseAmount, savedByKey } from "./bits/logic.ts";
import { Note, TickBox, labelText, useRefusal, useSaving } from "./bits/ui.tsx";

const METHODS: { id: PayMethod; icon: LucideIcon }[] = [
  { id: "card", icon: CreditCard },
  { id: "cash", icon: Banknote },
  { id: "transfer", icon: ArrowLeftRight },
];
/** "See them again in": none, 2, 4, 6 weeks, 3 months, 6 months, a year — in weeks. */
export const RECALL_WEEKS = [0, 2, 4, 6, 13, 26, 52] as const;

export default function SendOff({ sheet, onClose }: { sheet: Extract<SheetKind, { kind: "sendOff" }>; onClose: () => void }) {
  const { t } = useI18n();
  const today = dayOf(useNow());
  const desk = useDesk();
  const visit = desk.visits[sheet.visitId];
  const refusal = useRefusal();
  const { busy, run } = useSaving();

  const [method, setMethod] = useState<PayMethod>("card");
  const [amount, setAmount] = useState(() => (visit !== undefined && visit.balance > 0 ? String(visit.balance) : ""));
  const [skip, setSkip] = useState(false);
  const [weeks, setWeeks] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [balanceFromServer, setBalanceFromServer] = useState<number | null>(null);
  const [finished, setFinished] = useState<{ payment: Payment | null; recall: Recall | null; follow: boolean } | null>(null);
  // The send-off's key: made once, kept through every retry until it is all saved.
  const [key] = useState(actionKey);

  // What an earlier try of this send-off already saved, found by its key.
  const savedPayment = useMemo(() => savedByKey(Object.values(desk.payments), stepKey(key, "a")), [desk.payments, key]);
  const savedRecall = useMemo(() => savedByKey(Object.values(desk.recalls), stepKey(key, "b")), [desk.recalls, key]);

  if (visit === undefined) {
    return (
      <Sheet icon={UserRound} title={t("sendOff.gone")} onClose={onClose}>
        <Note tone="info" icon={Info} role="status">
          {t("refusal.gone")}
        </Note>
      </Sheet>
    );
  }

  const name = visitName(desk, visit);
  const first = name.split(/\s+/)[0] ?? name;
  const clinician = clinicianOf(desk, visit.clinician_id);
  const type = typeOf(desk, visit.visit_type_id);
  const visitDay = dayOf(visit.starts_at);
  const fee = visit.fee ?? 0;
  const balance = balanceFromServer ?? visit.balance;
  const hasBalance = visit.balance > 0 || savedPayment !== undefined;
  const typed = parseAmount(amount);
  const over = hasBalance && savedPayment === undefined && !skip && typed !== null && typed > balance;
  const noPatient = visit.patient_id === null || visit.clinician_id === null;
  const chosenWeeks = savedRecall?.weeks ?? weeks;
  const due = chosenWeeks > 0 ? addDays(visitDay, chosenWeeks * 7) : null;
  const lastDay = lastBookableDay(desk, today);
  const followBeyond = due !== null && lastDay !== null && due > lastDay;
  const alreadyDone = finished === null && (visit.status === "seen" || visit.status === "no_show" || visit.status === "cancelled");

  const take = savedPayment !== undefined ? null : !hasBalance || skip || typed === null || typed <= 0 ? null : { amount: Math.min(typed, balance), method };

  const placeFollowUp = (recall: Recall | null) => {
    if (visit.patient_id === null || type === undefined) return;
    const patientId = visit.patient_id;
    const followKey = actionKey();
    startPlacing({
      what: "booking",
      patientName: name,
      typeId: visit.visit_type_id,
      minutes: type.minutes,
      clinicianId: visit.clinician_id,
      day: due ?? today,
      place: (at) => {
        const booking =
          recall !== null
            ? bookRecall(recall, { visitTypeId: visit.visit_type_id, clinicianId: at.clinicianId, startsAt: at.startsAt, reason: visit.reason, deskNote: null }, followKey)
            : bookVisit({ patient: { id: patientId }, visitTypeId: visit.visit_type_id, clinicianId: at.clinicianId, startsAt: at.startsAt, channel: "desk", reason: visit.reason, deskNote: null, key: followKey });
        void booking.then((outcome) => {
          if (!outcome.ok) return toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "warn" });
          stopPlacing();
          toast(t("sendOff.toast.followUp", { name: first, day: dayShort(dayOf(outcome.value.starts_at)), time: time(outcome.value.starts_at), ref: outcome.value.ref }), { icon: "calendar-check", tone: "pos" });
        });
      },
    });
  };

  const finish = async (follow: boolean) => {
    if (over || alreadyDone) return;
    setError(null);
    const outcome = await run(() => sendOff({ visitId: visit.id, payment: take, recallWeeks: chosenWeeks > 0 && !noPatient ? chosenWeeks : null, followUp: null, key }));
    if (outcome === null) return;
    if (!outcome.ok) {
      if (outcome.reason === "balance") {
        // Someone else took money a moment ago: show the balance as it stands now.
        if (outcome.balance !== undefined) setBalanceFromServer(outcome.balance);
        for (const row of await deskReads().visits([visit.id]).catch(() => [])) upsert("appointments", row);
        setError(t("sendOff.over", { most: money(outcome.balance ?? visit.balance) }));
      } else setError(refusal(outcome.reason));
      return;
    }
    const { payment, recall } = outcome.value;
    const paid = payment ?? savedPayment ?? null;
    const left = outcome.value.visit.balance;
    const parts = [t("sendOff.toast.done", { name: first })];
    if (paid !== null) parts.push(t("sendOff.toast.paid", { amount: money(paid.amount), how: t(`sendOff.by.${paid.method}`) }));
    if (left > 0) parts.push(t("sendOff.toast.left", { amount: money(left) }));
    if (recall !== null) parts.push(t("sendOff.toast.recall", { day: dayMonth(recall.due_on) }));
    toast(parts.join(" "), { icon: "hand-heart", tone: "pos" });
    if (paid !== null) {
      // Offer the receipt before anything else happens.
      setFinished({ payment: paid, recall, follow });
      return;
    }
    onClose();
    if (follow) placeFollowUp(recall);
  };

  // ── after a payment: the receipt, and the follow-up if asked for ──
  if (finished !== null) {
    return (
      <Sheet icon={HandHeart} title={name} sub={visit.ref} subStyle={{ ...mono(12, 600, "var(--fg-subtle)"), lineHeight: "normal", whiteSpace: "normal" }} onClose={onClose} tone="pos">
        <Note tone="pos" icon={CircleCheck} role="status" strong>
          {t("sendOff.doneLine", { name: first, amount: money(finished.payment?.amount ?? 0), how: t(`sendOff.by.${finished.payment?.method ?? "card"}`) })}
        </Note>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {finished.payment !== null && (
            <Btn kind={finished.follow ? "ghost" : "primary"} icon={Printer} onClick={() => openSheet({ kind: "receipt", paymentId: finished.payment!.id })} style={{ width: "100%" }}>
              {t("sendOff.receipt")}
            </Btn>
          )}
          {finished.follow && (
            <Btn
              icon={CalendarPlus}
              onClick={() => {
                onClose();
                placeFollowUp(finished.recall);
              }}
              style={{ width: "100%" }}
            >
              {t("sendOff.placeFollowUp")}
            </Btn>
          )}
          <button type="button" className="rh-btn" onClick={onClose} style={{ ...btnGhost, width: "100%" }}>
            {t("common.close")}
          </button>
        </div>
      </Sheet>
    );
  }

  const sub = [visit.ref, visit.reason ?? type?.name ?? "", clinician?.short_name ?? ""].filter((x) => x !== "").join(" · ");
  const lockedPay = savedPayment !== undefined;
  const lockedRecall = savedRecall !== undefined;
  const followDisabled = over || alreadyDone || noPatient || followBeyond;

  return (
    <Sheet
      icon={HandHeart}
      // Who they saw, in that clinician's colour, as the design heads the sheet.
      lead={clinician === undefined ? undefined : <Tile name={clinician.name} color={clinician.color} size={42} />}
      titleSize={17}
      title={name}
      sub={sub}
      subStyle={{ ...mono(12, 600, "var(--fg-subtle)"), lineHeight: "normal", whiteSpace: "normal" }}
      onClose={onClose}
    >
      <span style={{ alignSelf: "flex-start", ...monoPill(visit.balance > 0 ? "var(--warn-soft)" : "var(--pos-soft)", visit.balance > 0 ? "var(--warn)" : "var(--pos)") }}>
        {t("sendOff.fee", { fee: money(fee), paid: money(visit.paid) })}
      </span>

      {alreadyDone && (
        <Note tone="info" icon={Info} role="status">
          {t("sendOff.already")}
        </Note>
      )}

      {hasBalance && !alreadyDone && (
        <section aria-labelledby="co-pay" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 id="co-pay" style={{ ...kicker, margin: 0 }}>
            {t("sendOff.take")}
          </h3>
          {lockedPay ? (
            <Note tone="pos" icon={CircleCheck} role="status">
              {t("sendOff.paySaved", { amount: money(savedPayment.amount), how: t(`sendOff.by.${savedPayment.method}`) })}
            </Note>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, ...(skip ? { opacity: 0.45 } : {}) }}>
                <div role="group" aria-label={t("sendOff.method")} style={segTrack}>
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="rh-chip"
                      aria-pressed={method === m.id}
                      onClick={() => {
                        setMethod(m.id);
                        setSkip(false);
                      }}
                      style={{ ...segWide(method === m.id), height: 36 }}
                    >
                      <m.icon size={13} aria-hidden="true" />
                      {t(`sendOff.method.${m.id}`)}
                    </button>
                  ))}
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={labelText}>{t("sendOff.amount")}</span>
                  <input
                    className="rh-fld"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setSkip(false);
                      setError(null);
                    }}
                    inputMode="decimal"
                    aria-invalid={over}
                    aria-describedby={over ? "co-err" : undefined}
                    style={fieldStyle(true)}
                  />
                </label>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {[
                    { id: "half", label: t("sendOff.half"), value: halfOf(balance) },
                    { id: "all", label: t("sendOff.whole"), value: balance },
                  ].map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className="rh-chip"
                      onClick={() => {
                        setAmount(String(q.value));
                        setSkip(false);
                        setError(null);
                      }}
                      style={{ ...chipStyle(false), height: 30, fontSize: 11.5 }}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
              {over && (
                <Note tone="danger" icon={CircleAlert} role="alert" id="co-err">
                  {t("sendOff.over", { most: money(balance) })}
                </Note>
              )}
              <button
                type="button"
                className="rh-gi"
                role="checkbox"
                aria-checked={skip}
                onClick={() => setSkip((v) => !v)}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 11, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--fg)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "start" }}
              >
                <TickBox on={skip} size={20} />
                {t("sendOff.notNow")}
              </button>
            </>
          )}
        </section>
      )}

      {!alreadyDone && (
        <section aria-labelledby="co-again" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <h3 id="co-again" style={{ ...kicker, margin: 0 }}>
              {t("sendOff.again")}
            </h3>
            {due !== null && <span style={monoPill("var(--accent-soft)", "var(--accent)")}>{t("sendOff.due", { day: dayShort(due) })}</span>}
          </div>
          <div role="group" aria-labelledby="co-again" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {RECALL_WEEKS.map((w) => (
              <button
                key={w}
                type="button"
                className="rh-chip"
                aria-pressed={chosenWeeks === w}
                disabled={noPatient || lockedRecall}
                onClick={() => setWeeks(w)}
                style={{ ...chipStyle(chosenWeeks === w), height: 32, paddingInline: 11, fontSize: 12, ...(noPatient || lockedRecall ? { cursor: "not-allowed", opacity: chosenWeeks === w ? 1 : 0.55 } : {}) }}
              >
                {t(`sendOff.weeks.${String(w)}` as "sendOff.weeks.0")}
              </button>
            ))}
          </div>
          {noPatient && (
            <Note tone="info" icon={Info}>
              {t("sendOff.noPatient")}
            </Note>
          )}
        </section>
      )}

      {!alreadyDone && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBlockStart: 14, borderBlockStart: "1px solid var(--border)" }}>
          {error !== null && (
            <Note tone="danger" icon={CircleAlert} role="alert">
              {error}
            </Note>
          )}
          <Btn kind="ghost" icon={CalendarPlus} disabled={followDisabled || busy} onClick={() => void finish(true)} style={{ width: "100%" }}>
            {t("sendOff.followUp")}
          </Btn>
          {followBeyond && !noPatient && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{t("sendOff.beyond")}</span>}
          <Btn icon={HandHeart} busy={busy} disabled={over} onClick={() => void finish(false)} style={{ width: "100%", ...(over ? { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 } : {}) }}>
            {lockedPay || lockedRecall ? t("sendOff.finish") : t("sendOff.done")}
          </Btn>
        </div>
      )}
    </Sheet>
  );
}
