/**
 * The receipt for one payment, as the desk prints it on an 80 mm roll.
 *
 * Everything on it is the server's: the payment as it was saved (its amount,
 * method and time), the visit as it now stands (so "Still owing" is the real
 * balance, whatever another desk took since), the practice from its settings.
 * It names the visit by its TYPE, never by the reason typed for it: a receipt
 * leaves the building — to an employer, an insurer — and a reason can carry a
 * clinical detail the patient did not choose to share.
 *
 * Printing adds `rh-print-receipt` to the body (the print rule in `rh.css`
 * hides everything but the paper) and takes it away when the printer is done.
 *
 * A manager can void the payment from here — where a payment taken twice by
 * mistake is first seen — with a reason; the balance comes back on the visit.
 *
 * With Invoices & Receipts connected to this app, the same payment can also be
 * emailed or printed as a receipt the patient claims with (`receipt/ForInsurer`).
 * This slip stays as it is either way: instant, and the desk's own.
 */
import { useId, useState } from "react";
import { CircleAlert, Printer, Undo2 } from "lucide-react";

import type { Sheet } from "../state/ui.ts";
import { useI18n } from "../i18n/index.tsx";
import { clinicianOf, typeOf, visitName } from "../lib/desk.ts";
import { dayOf, dayShort, time } from "../lib/format.ts";
import { voidPayment } from "../state/actions.ts";
import { useCan, useDesk } from "../state/desk.ts";
import { toast } from "../state/ui.ts";
import { Btn, btnGhost, btnGhostSm, btnPrimary, fieldStyle, MONO, Modal } from "../components/ui.tsx";
import { amountText } from "./deskwork/money.ts";
import { ErrorBox, labelStyle } from "./deskwork/dialogBits.tsx";
import { useVisit } from "./deskwork/visit.ts";
import ForInsurer from "./receipt/ForInsurer.tsx";

const INK = "#191920";
const QUIET = "#5a5a65";
const SOFT = "#4a4a54";
const line = { display: "flex", justifyContent: "space-between", gap: 12, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7 } as const;

/** Print the paper alone, and put the page back when the printer is done. */
function printReceipt(): void {
  const body = document.body;
  body.classList.add("rh-print-receipt");
  const done = () => {
    body.classList.remove("rh-print-receipt");
    window.removeEventListener("afterprint", done);
    window.removeEventListener("focus", done);
  };
  window.addEventListener("afterprint", done);
  // A browser that never says "afterprint" gives focus back to the page instead.
  window.addEventListener("focus", done);
  window.print();
}

export default function Receipt({ sheet, onClose }: { sheet: Extract<Sheet, { kind: "receipt" }>; onClose: () => void }) {
  const { t } = useI18n();
  const payment = useDesk((s) => s.payments[sheet.paymentId]);
  const settings = useDesk((s) => s.settings);
  const desk = useDesk();
  const visit = useVisit(payment?.appointment_id ?? -1);
  // Voiding is a manager's: `write_offs:create` is the manager-only grant, and reception also holds `payments:update`.
  const canUpdatePayments = useCan("payments", "update");
  const canWriteOff = useCan("write_offs", "create");
  const canVoid = canUpdatePayments && canWriteOff;
  const [voiding, setVoiding] = useState(false);

  if (payment === undefined || visit === null) {
    return (
      <Modal width={320} onClose={onClose} label={t("receipt.label")}>
        <div role="status" style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-muted)" }}>
          {t("receipt.missing")}
        </div>
        <button type="button" className="rh-btn" onClick={onClose} style={{ ...btnPrimary, width: "100%" }}>
          {t("common.close")}
        </button>
      </Modal>
    );
  }
  if (visit === undefined) return null;

  const clinician = clinicianOf(desk, visit.clinician_id);
  const rows: [string, string][] = [
    [t("receipt.date"), `${dayShort(dayOf(payment.paid_at))} ${time(payment.paid_at)}`],
    [t("receipt.patient"), visitName(desk, visit)],
    [t("receipt.reference"), visit.ref],
    [t("receipt.visit"), typeOf(desk, visit.visit_type_id)?.name ?? ""],
    [t("receipt.seen"), [dayShort(dayOf(visit.starts_at)), clinician?.short_name].filter(Boolean).join(" · ")],
    [t("receipt.fee"), amountText(visit.fee ?? 0)],
  ];

  return (
    <Modal width={320} onClose={onClose} label={t("receipt.label")} bare zIndex={780}>
      <div data-rh-receipt="1" style={{ padding: "22px 20px", borderRadius: 6, background: "#ffffff", color: INK, boxShadow: "0 30px 70px -30px rgba(10,10,25,.6)", display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 800, letterSpacing: "-.03em" }}>
          {settings?.mark ? (
            <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, paddingInline: 3, borderRadius: 5, background: INK, color: "#ffffff", fontSize: 9.5, fontWeight: 800, letterSpacing: 0 }}>
              {settings.mark}
            </span>
          ) : null}
          {settings?.practice_name ?? ""}
        </div>
        {settings?.address ? <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 11, lineHeight: 1.6, color: SOFT }}>{settings.address}</div> : null}
        {settings?.phone ? <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 11, color: SOFT }}>{settings.phone}</div> : null}
        <div aria-hidden="true" style={{ marginBlock: 10, borderBlockStart: "1px dashed #c9c9d1" }} />
        <dl style={{ margin: 0 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={line}>
              <dt style={{ color: QUIET }}>{k}</dt>
              <dd style={{ margin: 0, textAlign: "end" }}>{v}</dd>
            </div>
          ))}
        </dl>
        <div aria-hidden="true" style={{ marginBlock: 10, borderBlockStart: "1px dashed #c9c9d1" }} />
        <div style={{ ...line, fontSize: 13, fontWeight: 700, lineHeight: "normal" }}>
          <span>{t("receipt.paid")}</span>
          <span>{`${amountText(payment.amount)} · ${t(`payment.paidBy.${payment.method}`)}`}</span>
        </div>
        <div style={line}>
          <span style={{ color: QUIET }}>{t("receipt.owing")}</span>
          <span>{visit.balance > 0 ? amountText(visit.balance) : t("receipt.nothing")}</span>
        </div>
        {payment.voided ? (
          <div role="status" style={{ marginBlockStart: 12, textAlign: "center", fontSize: 11.5, fontWeight: 800, color: "#b3261e" }}>
            {t("receipt.voided")}
          </div>
        ) : (
          <div style={{ marginBlockStart: 12, textAlign: "center", fontSize: 11, fontWeight: 600, color: QUIET }}>{t("receipt.thanks")}</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        <button type="button" className="rh-gi" onClick={onClose} style={{ ...btnGhost, flex: 1 }}>
          {t("common.close")}
        </button>
        <button type="button" className="rh-btn" onClick={printReceipt} disabled={payment.voided} style={{ ...btnPrimary, flex: 1 }}>
          <Printer size={15} aria-hidden="true" />
          {t("receipt.print")}
        </button>
      </div>
      <ForInsurer payment={payment} visit={visit} />
      {canVoid && !payment.voided && !voiding && (
        <button type="button" className="rh-btn" onClick={() => setVoiding(true)} style={{ ...btnGhostSm, alignSelf: "center", color: "var(--fg-muted)" }}>
          <Undo2 size={14} aria-hidden="true" />
          {t("receipt.void")}
        </button>
      )}
      {canVoid && !payment.voided && voiding && <VoidForm paymentId={payment.id} amount={payment.amount} refText={visit.ref} onDone={() => setVoiding(false)} />}
    </Modal>
  );
}

/** Void: a reason, then the payment taken back. Managers only (the button is theirs alone). */
function VoidForm({ paymentId, amount, refText, onDone }: { paymentId: number; amount: number; refText: string; onDone: () => void }) {
  const { t } = useI18n();
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDanger = "var(--accent-fg)";
  const ok = reason.trim().length > 2;
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    const outcome = await voidPayment(paymentId, reason.trim());
    setBusy(false);
    if (!outcome.ok) {
      setError(t(`refusal.${outcome.reason}`));
      return;
    }
    toast(t("receipt.voidedToast", { amount: amountText(amount), ref: refText }), { icon: "undo-2", tone: "warn" });
    onDone();
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void go();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <label htmlFor={reasonId} style={labelStyle}>
        {t("receipt.voidReason")}
      </label>
      <input id={reasonId} className="rh-fld" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("receipt.voidPlaceholder")} style={fieldStyle(false)} />
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)", lineHeight: 1.5 }}>{t("receipt.voidHint")}</div>
      {error !== null && <ErrorBox icon={CircleAlert}>{error}</ErrorBox>}
      <div style={{ display: "flex", gap: 9 }}>
        <button type="button" className="rh-gi" onClick={onDone} style={{ ...btnGhostSm, flex: 1 }}>
          {t("common.cancel")}
        </button>
        <Btn kind="danger" type="submit" busy={busy} disabled={!ok} style={{ flex: 1, height: 36, fontSize: 12.5, color: onDanger }}>
          {t("receipt.voidCta", { amount: amountText(amount) })}
        </Btn>
      </div>
    </form>
  );
}
