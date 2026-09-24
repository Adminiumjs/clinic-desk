/**
 * Record a payment on a seen visit: how they paid, how much (half, the whole
 * balance, or any part of it), then — once the server has saved it — the
 * saved line and "Print a receipt".
 *
 * Money is never shown as taken before the server says so. The action's key
 * is made when the sheet opens and kept until the payment is saved, so a
 * second press after a lost answer finds the first payment instead of taking
 * a second one; and what the saved line and the receipt print is the payment
 * the server returned, not what was typed. More than the balance is refused
 * here, and again by the server (another desk may have taken money a moment
 * ago), which answers with the balance as it now stands.
 */
import { useEffect, useId, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, BadgeCheck, Banknote, CircleAlert, CreditCard, Printer, Receipt } from "lucide-react";

import type { PayMethod, Payment } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { actionKey } from "../lib/keys.ts";
import { typeOf, visitName } from "../lib/desk.ts";
import { recordPayment, type Refusal } from "../state/actions.ts";
import { useDesk } from "../state/desk.ts";
import { openSheet, type Sheet } from "../state/ui.ts";
import { Btn, btnGhost, btnPrimary, chipStyle, fieldStyle, mono, monoPill, segWide, Modal, ModalHead } from "../components/ui.tsx";
import { amountInput, amountText, cents, half, parseAmount } from "./deskwork/money.ts";
import { ErrorBox, labelStyle } from "./deskwork/dialogBits.tsx";
import { rereadVisit, useVisit } from "./deskwork/visit.ts";

export const METHODS: { id: PayMethod; icon: LucideIcon; key: "payment.method.card" | "payment.method.cash" | "payment.method.transfer" }[] = [
  { id: "card", icon: CreditCard, key: "payment.method.card" },
  { id: "cash", icon: Banknote, key: "payment.method.cash" },
  { id: "transfer", icon: ArrowLeftRight, key: "payment.method.transfer" },
];

type PaymentSheet = Extract<Sheet, { kind: "payment" }>;

/**
 * The method the sheet opens on: the card's "Part payment" shortcut asks for
 * cash.
 *
 * INTEGRATOR: add `method?: PayMethod` to the `payment` sheet in state/ui.ts;
 * this reads it without a cast until then.
 */
function openingMethod(sheet: PaymentSheet): PayMethod {
  const asked = "method" in sheet ? (sheet as { method?: unknown }).method : undefined;
  return asked === "cash" || asked === "transfer" ? asked : "card";
}

export default function RecordPayment({ sheet, onClose }: { sheet: PaymentSheet; onClose: () => void }) {
  const { t } = useI18n();
  const titleId = useId();
  const errorId = useId();
  const visit = useVisit(sheet.visitId);
  const desk = useDesk();
  const [key] = useState(actionKey);
  const [method, setMethod] = useState<PayMethod>(() => openingMethod(sheet));
  const [text, setText] = useState(sheet.amount === undefined ? "" : amountInput(sheet.amount));
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<{ reason: Refusal; balance?: number } | null>(null);
  const [saved, setSaved] = useState<Payment | null>(null);

  // With no amount asked for, the field starts at the whole balance (as drawn).
  const balance = visit?.balance ?? 0;
  useEffect(() => {
    if (visit && sheet.amount === undefined && text === "" && saved === null) setText(amountInput(visit.balance));
    // Once, when the visit arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visit === undefined || visit === null]);

  const close = busy ? () => undefined : onClose;
  if (visit === undefined) return null;

  const who = visit === null ? "" : visitName(desk, visit);
  const what = visit === null ? "" : (visit.reason ?? typeOf(desk, visit.visit_type_id)?.name ?? "");
  const sub = visit === null ? "" : [who, visit.ref, what].filter(Boolean).join(" · ");
  const amount = parseAmount(text);
  const typed = text.trim() !== "";
  const over = amount !== null && cents(amount) > cents(balance);
  const valid = amount !== null && cents(amount) > 0 && !over;
  const owes = visit !== null && visit.status === "seen" && balance > 0;

  const save = async () => {
    if (!valid || busy || visit === null) return;
    setBusy(true);
    setRefused(null);
    const outcome = await recordPayment({ visitId: visit.id, amount, method, key });
    setBusy(false);
    if (outcome.ok) {
      setSaved(outcome.value);
      return;
    }
    setRefused({ reason: outcome.reason, ...(outcome.balance === undefined ? {} : { balance: outcome.balance }) });
    // The balance moved under us: read it again, so the pill and the chips follow.
    if (outcome.reason === "balance") await rereadVisit(visit.id).catch(() => undefined);
  };

  const error = (() => {
    if (visit === null) return t("refusal.gone");
    if (refused?.reason === "balance") return t("payment.over", { ref: visit.ref, amount: amountText(refused.balance ?? balance) });
    if (refused !== null) return t(`refusal.${refused.reason}`);
    if (over) return t("payment.over", { ref: visit.ref, amount: amountText(balance) });
    if (typed && amount === null) return t("payment.notAmount");
    return null;
  })();

  return (
    <Modal width={400} onClose={close} labelledBy={titleId} padding={20} gap={0}>
      <ModalHead
        icon={Receipt}
        small
        titleId={titleId}
        title={saved === null ? t("payment.title") : t("payment.savedTitle")}
        sub={sub}
        subStyle={{ ...mono(11.5, 600, "var(--fg-subtle)"), lineHeight: "normal", whiteSpace: "normal" }}
        onClose={close}
      />

      {saved !== null && visit !== null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBlockStart: 14 }}>
          <div role="status" style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 14px", borderRadius: 13, background: "var(--pos-soft)", color: "var(--pos)", fontSize: 13, fontWeight: 800, lineHeight: 1.5 }}>
            <BadgeCheck size={16} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 1 }} />
            <span>
              {t("payment.savedLine", {
                amount: amountText(saved.amount),
                method: t(`payment.paidBy.${saved.method}`),
                ref: visit.ref,
                rest: visit.balance > 0 ? t("payment.stillOwing", { amount: amountText(visit.balance) }) : t("payment.settled"),
              })}
            </span>
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button type="button" className="rh-btn" onClick={() => openSheet({ kind: "receipt", paymentId: saved.id })} style={{ ...btnGhost, flex: 1, paddingInline: 18 }}>
              <Printer size={15} aria-hidden="true" />
              {t("payment.print")}
            </button>
            <button type="button" className="rh-btn" onClick={onClose} style={{ ...btnPrimary, flex: 1 }}>
              {t("common.done")}
            </button>
          </div>
        </div>
      ) : visit === null || !owes ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBlockStart: 14 }}>
          <div role="status" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, color: "var(--fg-muted)" }}>
            {visit === null ? t("refusal.gone") : t("payment.nothingOwed")}
          </div>
          <button type="button" className="rh-btn" onClick={onClose} style={{ ...btnPrimary, width: "100%" }}>
            {t("common.done")}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div style={{ marginBlockStart: 14 }}>
            <span style={monoPill("var(--warn-soft)", "var(--warn)")}>{t("payment.balance", { amount: amountText(balance) })}</span>
          </div>
          <div role="group" aria-label={t("payment.methods")} style={{ display: "flex", gap: 3, marginBlockStart: 14, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 11, padding: 3 }}>
            {METHODS.map((m) => (
              <button key={m.id} type="button" className="rh-chip" aria-pressed={method === m.id} onClick={() => setMethod(m.id)} style={{ ...segWide(method === m.id), height: 38 }}>
                <m.icon size={13} aria-hidden="true" />
                {t(m.key)}
              </button>
            ))}
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBlockStart: 14 }}>
            <span style={labelStyle}>{t("payment.amount")}</span>
            <input
              className="rh-fld"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setRefused(null);
              }}
              placeholder="0"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={error !== null}
              aria-describedby={error !== null ? errorId : undefined}
              style={fieldStyle(true)}
            />
          </label>
          <div style={{ display: "flex", gap: 7, marginBlockStart: 10, flexWrap: "wrap" }}>
            <button type="button" className="rh-chip" onClick={() => setText(amountInput(half(balance)))} style={{ ...chipStyle(false), height: 30, fontSize: 11.5 }}>
              {t("payment.half")}
            </button>
            <button type="button" className="rh-chip" onClick={() => setText(amountInput(balance))} style={{ ...chipStyle(false), height: 30, fontSize: 11.5 }}>
              {t("payment.whole")}
            </button>
          </div>
          {error !== null && (
            <div style={{ marginBlockStart: 12 }}>
              <ErrorBox id={errorId} icon={CircleAlert}>
                {error}
              </ErrorBox>
            </div>
          )}
          <Btn
            type="submit"
            busy={busy}
            disabled={!valid}
            style={{ width: "100%", marginBlockStart: 14, ...(valid || busy ? {} : { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 }) }}
          >
            {valid ? t("payment.record", { amount: amountText(amount) }) : t("payment.recordPlain")}
          </Btn>
          <p style={{ margin: "9px 0 0", fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-subtle)", textWrap: "pretty" }}>{t("payment.note")}</p>
        </form>
      )}
    </Modal>
  );
}
