/**
 * The overlay layer: toasts, the visit panel, the cancel confirm and the card
 * sheet.
 *
 * All four are mounted once at the root, outside the view switch, so a view
 * change never remounts them and a toast raised by an action survives the
 * navigation that action triggered. Each of them sets `overlayOpen`, which is
 * what moves the demo dock to the opposite corner (house layout rule 1).
 *
 * The record-payment popover is NOT here: it is anchored to the row it belongs
 * to and lives in the accounts screen, because a popover that opens in the
 * middle of the screen is a dialog wearing the wrong clothes.
 */

import { useEffect, useState } from "react";
import { Check, CreditCard, TriangleAlert, X } from "lucide-react";

import type { VisitStatus } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import {
  clock,
  dateLong,
  duration,
  label,
  money,
  span,
  statusLabel,
} from "../lib/format.ts";
import {
  endOf,
  isLateCancel,
  isQueueStatus,
  nextStatus,
  visitTypeById,
} from "../lib/schedule.ts";
import {
  CLINICIANS,
  VISIT_TYPES,
  clinicianById,
  patientName,
  useStore,
} from "../state/store.ts";
import { Avatar, Button, Field, Mono } from "./Primitives.tsx";

export function ToastLayer() {
  const { t } = useI18n();
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="rh-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`rh-toast rh-toast--${toast.tone}`}>
          {toast.tone === "pos" && <Check size={15} aria-hidden="true" />}
          <span>{toast.text}</span>
          <button
            type="button"
            className="rh-toast__x"
            onClick={() => dismiss(toast.id)}
            aria-label={t("chrome.toast.dismiss")}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** The four steps the panel draws, in the order a visit moves through them. */
const CHAIN = ["checked_in", "roomed", "with_clinician", "ready"] as const;

/** How far along the chain a visit has got. `-1` means it has not started. */
function chainReached(status: VisitStatus): number {
  if (isQueueStatus(status)) return CHAIN.indexOf(status);
  /* Somebody already seen has been through every step, even though the board
   * no longer shows them. */
  return status === "done" ? CHAIN.length - 1 : -1;
}

/**
 * The visit panel: everything the desk needs about one appointment, and the
 * four things it can do about it. The status chain is drawn as steps rather
 * than a dropdown so a receptionist can see at a glance how far along someone
 * is without opening anything.
 */
export function VisitPanel() {
  const { t } = useI18n();
  const panelRef = useStore((s) => s.panelRef);
  const appts = useStore((s) => s.appts);
  const walkIns = useStore((s) => s.walkIns);
  const openPanel = useStore((s) => s.openPanel);
  const advanceVisit = useStore((s) => s.advanceVisit);
  const checkIn = useStore((s) => s.checkIn);
  const markNoShow = useStore((s) => s.markNoShow);
  const askCancel = useStore((s) => s.askCancel);
  const openPatient = useStore((s) => s.openPatient);

  if (panelRef === null) return null;
  const appt = appts.find((a) => a.id === panelRef);
  if (!appt) return null;

  const clinician = clinicianById(appt.clinician);
  const type = visitTypeById(VISIT_TYPES, appt.type);
  const name = patientName(appt.patient, walkIns[appt.patient] ?? null);
  const onward = nextStatus(appt.status);
  const closed =
    appt.status === "done" || appt.status === "no_show" || appt.status === "cancelled";

  return (
    <div
      className="rh-modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) openPanel(null);
      }}
    >
      <div
        className="rh-modal rh-panelsheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("panel.title", { ref: appt.id })}
      >
        <div className="rh-panelsheet__head">
          <div style={{ minWidth: 0 }}>
            <h2 className="rh-modal__title">
              <Mono>{appt.id}</Mono>
            </h2>
            <p className="rh-panel__sub">
              {label(type.label)} · {duration(type.minutes)}
            </p>
          </div>
          <button
            type="button"
            className="rh-iconbtn rh-btn"
            style={{ marginInlineStart: "auto" }}
            onClick={() => openPanel(null)}
            aria-label={t("panel.close")}
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="rh-facts">
          <div className="rh-fact">
            <span className="rh-fact__k">{t("panel.patient")}</span>
            <span className="rh-fact__v">{name}</span>
          </div>
          <div className="rh-fact">
            <span className="rh-fact__k">{t("panel.when")}</span>
            <span className="rh-fact__v rh-mono">
              {span(appt.start, endOf(appt, VISIT_TYPES))}
            </span>
          </div>
          <div className="rh-fact">
            <span className="rh-fact__k">{t("confirm.clinician")}</span>
            <span className="rh-fact__v">
              {clinician !== null && (
                <Avatar name={clinician.name} tint={clinician.tint} ini={clinician.ini} />
              )}
              {clinician?.name}
            </span>
          </div>
          <div className="rh-fact">
            <span className="rh-fact__k">{t("panel.reason")}</span>
            <span className="rh-fact__v">{label(appt.reason)}</span>
          </div>
          {appt.deskNote !== null && (
            <div className="rh-fact">
              <span className="rh-fact__k">{t("panel.desknote")}</span>
              <span className="rh-fact__v">{label(appt.deskNote)}</span>
            </div>
          )}
        </div>

        <div className="rh-label" style={{ marginBlockStart: 16, marginBlockEnd: 8 }}>
          {t("panel.status")}
        </div>
        <div className="rh-chain">
          {CHAIN.map((step, i) => (
            <span
              key={step}
              className={`rh-chain__step${i <= chainReached(appt.status) ? " rh-chain__step--on" : ""}`}
            >
              {statusLabel(step)}
            </span>
          ))}
        </div>

        {closed && (
          <p className="rh-honest" style={{ marginBlockStart: 14 }}>
            {statusLabel(appt.status)}
          </p>
        )}

        <div className="rh-panelsheet__actions">
          {appt.status === "booked" && (
            <Button onClick={() => checkIn(appt.id)}>{t("panel.checkIn")}</Button>
          )}
          {isQueueStatus(appt.status) && (
            <Button onClick={() => advanceVisit(appt.id)}>
              {t("panel.advance", { status: statusLabel(onward) })}
            </Button>
          )}
          <Button tone="ghost" onClick={() => openPatient(appt.patient)}>
            {t("panel.openPatient")}
          </Button>
          {appt.status === "booked" && (
            <>
              <Button tone="ghost" onClick={() => markNoShow(appt.id)}>
                {t("panel.noShow")}
              </Button>
              <Button tone="danger" onClick={() => askCancel(appt.id)}>
                {t("panel.cancel")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The cancel confirm. Inside 24 hours it changes character rather than changing
 * behaviour: the same button still cancels, but the dialog says plainly what it
 * costs the patient. Refusing the cancellation would only mean they do not turn
 * up, which is worse for everyone.
 */
export function CancelDialog() {
  const { t } = useI18n();
  const cancelRef = useStore((s) => s.cancelRef);
  const appts = useStore((s) => s.appts);
  const now = useStore((s) => s.now);
  const askCancel = useStore((s) => s.askCancel);
  const confirmCancel = useStore((s) => s.confirmCancel);

  if (cancelRef === null) return null;
  const appt = appts.find((a) => a.id === cancelRef);
  if (!appt) return null;

  const late = isLateCancel(appt, now);
  const clinician = clinicianById(appt.clinician);

  return (
    <div
      className="rh-modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) askCancel(null);
      }}
    >
      <div
        className="rh-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("cancel.title", { ref: appt.id })}
      >
        <h2 className="rh-modal__title">{t("cancel.title", { ref: appt.id })}</h2>
        <p className="rh-panel__sub">
          {t("cancel.body", {
            when: `${dateLong(appt.date)}, ${clock(appt.start)}`,
            clinician: clinician?.name ?? "",
          })}
        </p>

        {late && (
          <div className="rh-warnbox">
            <TriangleAlert size={16} aria-hidden="true" />
            <div>
              <strong>{t("cancel.late.title")}</strong>
              <p>{t("cancel.late.body")}</p>
            </div>
          </div>
        )}

        <div className="rh-modal__actions">
          <Button tone="ghost" onClick={() => askCancel(null)}>
            {t("chrome.action.keep")}
          </Button>
          <Button tone="danger" onClick={confirmCancel}>
            {t("cancel.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The card sheet. Every field is decorative — nothing is validated, nothing is
 * sent — which is exactly why the callout at the top says so in as many words
 * before a reader types a digit.
 */
export function CardSheet() {
  const { t } = useI18n();
  const cardFor = useStore((s) => s.cardFor);
  const openCard = useStore((s) => s.openCard);
  const payCard = useStore((s) => s.payCard);
  const charges = useStore((s) => s.charges);
  const payments = useStore((s) => s.payments);
  const appts = useStore((s) => s.appts);
  const confirmedRef = useStore((s) => s.confirmedRef);

  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  useEffect(() => {
    if (cardFor !== null) {
      setNumber("");
      setExpiry("");
      setCvc("");
    }
  }, [cardFor]);

  if (cardFor === null) return null;

  const amount = (() => {
    if (cardFor === "booking") {
      const appt = appts.find((a) => a.id === confirmedRef);
      return appt ? visitTypeById(VISIT_TYPES, appt.type).fee : 0;
    }
    const charge = charges.find((c) => c.id === cardFor);
    if (!charge) return 0;
    return charge.amount - payments.filter((p) => p.charge === charge.id).reduce((s, p) => s + p.amount, 0);
  })();

  return (
    <div
      className="rh-modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) openCard(null);
      }}
    >
      <div
        className="rh-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("card.title", { amount: money(amount) })}
      >
        <h2 className="rh-modal__title">{t("card.title", { amount: money(amount) })}</h2>

        <div className="rh-demobox">
          <CreditCard size={16} aria-hidden="true" />
          <span>{t("card.demo")}</span>
        </div>

        <div className="rh-cardform">
          <Field label={t("card.number")}>
            <input
              className="rh-input rh-fld rh-mono"
              value={number}
              inputMode="numeric"
              placeholder="4242 4242 4242 4242"
              onChange={(e) => setNumber(e.target.value)}
            />
          </Field>
          <div className="rh-cardform__row">
            <Field label={t("card.expiry")}>
              <input
                className="rh-input rh-fld rh-mono"
                value={expiry}
                placeholder="04/29"
                onChange={(e) => setExpiry(e.target.value)}
              />
            </Field>
            <Field label={t("card.cvc")}>
              <input
                className="rh-input rh-fld rh-mono"
                value={cvc}
                placeholder="123"
                onChange={(e) => setCvc(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="rh-modal__actions">
          <Button tone="ghost" onClick={() => openCard(null)}>
            {t("card.cancel")}
          </Button>
          <Button onClick={payCard}>{t("card.pay", { amount: money(amount) })}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The clinician legend. A reader learns the four tints once here and then reads
 * the day sheet's columns and the waiting cards without a second look.
 */
export function ClinicianLegend() {
  return (
    <div className="rh-legend">
      {CLINICIANS.map((c) => (
        <span key={c.id} className="rh-legend__item">
          <span className="rh-legend__dot" style={{ background: c.tint }} aria-hidden="true" />
          {c.name}
          <span className="rh-legend__role">{label(c.role)}</span>
        </span>
      ))}
    </div>
  );
}
