/**
 * Write off part or all of a visit's balance — a manager's decision, with a
 * reason. The server's grant is what refuses anyone else; the desk only
 * offers the sheet to managers, and asks for no PIN (Adminium has none, and a
 * PIN would be decoration).
 *
 * The amount can never take the balance below zero: the sheet refuses more
 * than the balance it holds, and the server — which may know a smaller one,
 * if another desk took money meanwhile — refuses again with the balance as it
 * stands. The key is made when the sheet opens and kept until the write-off is
 * saved, so a retry never writes off twice.
 */
import { useId, useState } from "react";
import { CircleAlert, FileMinus, Lock } from "lucide-react";

import type { Sheet } from "../state/ui.ts";
import { useI18n } from "../i18n/index.tsx";
import { actionKey } from "../lib/keys.ts";
import { typeOf, visitName } from "../lib/desk.ts";
import { writeOff, type Refusal } from "../state/actions.ts";
import { useCan, useDesk } from "../state/desk.ts";
import { toast } from "../state/ui.ts";
import { Btn, btnPrimary, fieldStyle, mono, monoPill, segWide, Modal, ModalHead } from "../components/ui.tsx";
import { amountText, cents, parseAmount } from "./deskwork/money.ts";
import { ErrorBox, labelStyle } from "./deskwork/dialogBits.tsx";
import { rereadVisit, useVisit } from "./deskwork/visit.ts";

export default function WriteOff({ sheet, onClose }: { sheet: Extract<Sheet, { kind: "writeOff" }>; onClose: () => void }) {
  const { t } = useI18n();
  const titleId = useId();
  const errorId = useId();
  const visit = useVisit(sheet.visitId);
  const desk = useDesk();
  const manager = useCan("write_offs", "create");
  // White on the dark theme's light red fails contrast; the page's near-black reads.
  const onDanger = "var(--accent-fg)";
  const [key] = useState(actionKey);
  const [part, setPart] = useState(false);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<{ reason: Refusal; balance?: number } | null>(null);

  const close = busy ? () => undefined : onClose;
  if (visit === undefined) return null;

  const balance = visit?.balance ?? 0;
  const sub = visit === null ? "" : [visitName(desk, visit), visit.ref, visit.reason ?? typeOf(desk, visit.visit_type_id)?.name].filter(Boolean).join(" · ");
  const amount = part ? parseAmount(text) : balance;
  const over = amount !== null && cents(amount) > cents(balance);
  const amountOk = amount !== null && cents(amount) > 0 && !over;
  const reasonOk = reason.trim().length > 2;
  const ok = visit !== null && amountOk && reasonOk && balance > 0;

  const save = async () => {
    if (!ok || busy || visit === null || amount === null) return;
    setBusy(true);
    setRefused(null);
    const outcome = await writeOff({ visitId: visit.id, amount, reason: reason.trim(), key });
    setBusy(false);
    if (outcome.ok) {
      const left = useDesk.getState().visits[visit.id]?.balance ?? 0;
      toast(t("writeOff.done", { amount: amountText(outcome.value.amount), ref: visit.ref, left: left > 0 ? t("payment.stillOwing", { amount: amountText(left) }) : t("payment.settled") }), {
        icon: "file-minus",
        tone: "warn",
      });
      onClose();
      return;
    }
    setRefused({ reason: outcome.reason, ...(outcome.balance === undefined ? {} : { balance: outcome.balance }) });
    if (outcome.reason === "balance") await rereadVisit(visit.id).catch(() => undefined);
  };

  const error = (() => {
    if (visit === null) return t("refusal.gone");
    if (refused?.reason === "balance") return t("writeOff.over", { amount: amountText(refused.balance ?? balance) });
    if (refused !== null) return t(`refusal.${refused.reason}`);
    if (over) return t("writeOff.over", { amount: amountText(balance) });
    if (part && text.trim() !== "" && amount === null) return t("payment.notAmount");
    return null;
  })();
  const hint = ok ? null : !amountOk && part && error === null ? t("writeOff.hintAmount") : !reasonOk ? t("writeOff.hintReason") : null;

  return (
    <Modal width={420} onClose={close} labelledBy={titleId}>
      <ModalHead icon={FileMinus} tone="danger" titleId={titleId} title={t("writeOff.title")} sub={sub} subStyle={{ ...mono(11.5, 600, "var(--fg-subtle)"), lineHeight: "normal", whiteSpace: "normal" }} onClose={close} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={monoPill("var(--warn-soft)", "var(--warn)")}>{t("payment.balance", { amount: amountText(balance) })}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>
          <Lock size={12} aria-hidden="true" />
          {t("writeOff.managersOnly")}
        </span>
      </div>

      {!manager ? (
        <>
          <div role="status" style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, color: "var(--fg-muted)" }}>
            {t("writeOff.notManager")}
          </div>
          <button type="button" className="rh-btn" onClick={onClose} style={{ ...btnPrimary, width: "100%" }}>
            {t("common.close")}
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 15 }}
        >
          <div role="group" aria-label={t("writeOff.howMuch")} style={{ display: "flex", gap: 3, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 11, padding: 3 }}>
            <button type="button" className="rh-chip" aria-pressed={!part} onClick={() => setPart(false)} style={{ ...segWide(!part), height: 34 }}>
              {t("writeOff.whole")}
            </button>
            <button type="button" className="rh-chip" aria-pressed={part} onClick={() => setPart(true)} style={{ ...segWide(part), height: 34 }}>
              {t("writeOff.part")}
            </button>
          </div>
          {part && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={labelStyle}>{t("writeOff.amount")}</span>
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
          )}
          {error !== null && (
            <ErrorBox id={errorId} icon={CircleAlert}>
              {error}
            </ErrorBox>
          )}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={labelStyle}>{t("writeOff.reason")}</span>
            <textarea
              className="rh-fld"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("writeOff.reasonPlaceholder")}
              style={{ width: "100%", minHeight: 72, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)", fontSize: 13, fontWeight: 600, lineHeight: 1.55, resize: "vertical", fontFamily: "inherit" }}
            />
          </label>
          <Btn
            type="submit"
            busy={busy}
            disabled={!ok}
            style={{ width: "100%", ...(ok || busy ? { background: "var(--danger)", color: onDanger } : { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 }) }}
          >
            {t("writeOff.cta", { amount: amountText(amount !== null && amountOk ? amount : 0) })}
          </Btn>
          {hint !== null && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{hint}</span>}
        </form>
      )}
    </Modal>
  );
}
