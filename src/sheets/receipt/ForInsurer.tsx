/**
 * "For their insurer": the receipt of one payment that a patient can claim
 * with — the practice's letterhead, their name and address, the kind of visit
 * and what was paid — drawn by Invoices & Receipts, emailed to the patient or
 * opened here to print.
 *
 * It is there only while Invoices & Receipts is connected to this app (the
 * `insurer-receipts` feature) and only for a payment that stands: a voided
 * payment has nothing to claim. The desk's own receipt above it — the 80 mm
 * slip — does not depend on it and prints the same with or without.
 *
 * Emailing is a row in the outbox, which Adminium sends with the receipt
 * attached; the line under the buttons follows that row as it goes. Opening
 * draws the receipt (or hands back the one already drawn while the payment is
 * unchanged) and shows its print copy in a new tab, in any language, ready
 * for the browser's print dialog.
 */
import { useRef, useState } from "react";
import { FileText, Mail } from "lucide-react";

import type { Appointment, Message, Payment } from "../../data/types.ts";
import { useI18n } from "../../i18n/index.tsx";
import { INSURER_RECEIPTS } from "../../lib/features.ts";
import { time } from "../../lib/format.ts";
import { actionKey } from "../../lib/keys.ts";
import { visitName } from "../../lib/desk.ts";
import { drawInsurerReceipt, emailInsurerReceipt } from "../../state/actions.ts";
import { useCan, useDesk } from "../../state/desk.ts";
import { useAddOnText, useFeature } from "../../state/features.ts";
import { toast } from "../../state/ui.ts";
import { Btn } from "../../components/ui.tsx";
import { reasonKey } from "../../screens/outbox/rows.ts";

const quiet = { margin: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-muted)", textWrap: "pretty" } as const;

/** The newest receipt email for a payment, as the desk holds it. */
function newestFor(messages: Record<string, Message>, paymentId: number): Message | undefined {
  let best: Message | undefined;
  for (const m of Object.values(messages)) {
    if (m.kind !== "receipt" || m.payment_id !== paymentId) continue;
    if (best === undefined || m.id > best.id) best = m;
  }
  return best;
}

export default function ForInsurer({ payment, visit }: { payment: Payment; visit: Appointment }) {
  const { t } = useI18n();
  const on = useFeature(INSURER_RECEIPTS);
  const letterhead = useAddOnText("invoices", "business_name");
  const canEmail = useCan("messages", "create");
  const desk = useDesk();
  const newest = useDesk((s) => newestFor(s.messages as Record<string, Message>, payment.id));
  const [busy, setBusy] = useState<"email" | "open" | null>(null);
  // One key per email, kept until it is saved: a double click queues one message.
  const key = useRef<string | null>(null);

  if (!on || payment.voided) return null;

  const patient = visit.patient_id === null ? undefined : desk.patients[visit.patient_id];
  const name = visitName(desk, visit);
  const address = (patient?.email ?? visit.new_email ?? "").trim();
  // The receipt in the patient's language, else the practice's.
  const language = patient?.language ?? visit.language ?? desk.settings?.language ?? undefined;

  const email = async () => {
    if (busy !== null) return;
    key.current ??= actionKey();
    setBusy("email");
    const outcome = await emailInsurerReceipt(payment.id, key.current);
    setBusy(null);
    if (!outcome.ok) {
      toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
      return;
    }
    key.current = null;
    toast(t("receipt.insurer.queuedToast", { name }), { icon: "send", tone: "pos" });
  };

  const open = async () => {
    if (busy !== null) return;
    // The tab is opened by the click itself, which a browser lets through; one
    // opened after the wait may be stopped as a pop-up. It shows the print
    // copy, a page that runs nothing, so it keeps no hold on this one.
    const tab = window.open("", "_blank");
    if (tab === null) {
      toast(t("receipt.insurer.blocked"), { icon: "circle-alert", tone: "warn" });
      return;
    }
    tab.opener = null;
    setBusy("open");
    const outcome = await drawInsurerReceipt(payment.id, language ?? undefined);
    setBusy(null);
    if (!outcome.ok) {
      tab.close();
      toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
      return;
    }
    // Its print copy, in every language: the page the browser's print dialog prints.
    tab.location.href = new URL(outcome.value.printUrl, window.location.origin).href;
    toast(t("receipt.insurer.opened"), { icon: "printer" });
  };

  return (
    <section aria-labelledby={`insurer-${String(payment.id)}`} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <h2 id={`insurer-${String(payment.id)}`} style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>
        {t("receipt.insurer.title")}
      </h2>
      <p style={quiet}>{t("receipt.insurer.lede")}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canEmail && (
          <Btn kind="ghostSm" icon={Mail} busy={busy === "email"} disabled={address === ""} onClick={() => void email()} label={t("receipt.insurer.emailLabel", { name })} style={{ flex: 1, minWidth: 120 }}>
            {t("receipt.insurer.email")}
          </Btn>
        )}
        <Btn kind="ghostSm" icon={FileText} busy={busy === "open"} onClick={() => void open()} label={t("receipt.insurer.openLabel")} style={{ flex: 1, minWidth: 120 }}>
          {t("receipt.insurer.open")}
        </Btn>
      </div>
      <Status newest={newest} noAddress={canEmail && address === ""} />
      {payment.patient_id === null && <p style={quiet}>{t("receipt.insurer.noPatient")}</p>}
      <p style={{ ...quiet, fontSize: 11.5, color: "var(--fg-subtle)" }}>{letterhead === null ? t("receipt.insurer.noLetterhead") : t("receipt.insurer.letterhead", { name: letterhead })}</p>
    </section>
  );
}

/** Where the newest receipt email is: on its way, sent, or why not. */
function Status({ newest, noAddress }: { newest: Message | undefined; noAddress: boolean }) {
  const { t } = useI18n();
  if (newest === undefined) {
    return noAddress ? <p style={quiet}>{t("receipt.insurer.noEmail")}</p> : null;
  }
  const address = newest.to_address ?? "";
  const why = reasonKey(newest.error);
  const reason = why !== null ? t(why) : (newest.error ?? "").trim();
  switch (newest.status) {
    case "queued":
      return (
        <p role="status" style={quiet}>
          {t("receipt.insurer.queued", { address })}
        </p>
      );
    case "sent":
      return (
        <p role="status" style={{ ...quiet, color: "var(--pos)" }}>
          {t("receipt.insurer.sent", { address, time: time(newest.sent_at ?? newest.created_at ?? new Date().toISOString()) })}
        </p>
      );
    case "failed":
      return (
        <p role="status" style={{ ...quiet, color: "var(--danger)" }}>
          {t("receipt.insurer.failed", { why: reason })}
        </p>
      );
    case "skipped":
      return (
        <p role="status" style={quiet}>
          {t("receipt.insurer.skipped", { why: reason })}
        </p>
      );
  }
}
