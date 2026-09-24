/**
 * Take someone off the recall list, with why: moved away, seen elsewhere, or
 * a few words. The recall is closed with that reason; their record is not
 * touched.
 */
import { useId, useState } from "react";
import { BellOff, CircleAlert } from "lucide-react";

import type { Sheet } from "../state/ui.ts";
import { useI18n } from "../i18n/index.tsx";
import { recallNotNeeded } from "../state/actions.ts";
import { useDesk } from "../state/desk.ts";
import { toast } from "../state/ui.ts";
import { Btn, btnGhost, chipStyle, fieldStyle, Modal, ModalHead } from "../components/ui.tsx";
import { ErrorBox, labelStyle } from "./deskwork/dialogBits.tsx";

const REASONS = ["notNeeded.moved", "notNeeded.elsewhere", "notNeeded.other"] as const;
type Reason = (typeof REASONS)[number];

export default function NotNeeded({ sheet, onClose }: { sheet: Extract<Sheet, { kind: "notNeeded" }>; onClose: () => void }) {
  const { t } = useI18n();
  const titleId = useId();
  const recall = useDesk((s) => s.recalls[sheet.recallId]);
  const name = useDesk((s) => (recall === undefined ? "" : (s.patients[recall.patient_id]?.name ?? "")));
  const [reason, setReason] = useState<Reason | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = busy ? () => undefined : onClose;
  const ok = recall !== undefined && reason !== null && (reason !== "notNeeded.other" || other.trim().length > 1);

  const save = async () => {
    if (!ok || busy || recall === undefined || reason === null) return;
    setBusy(true);
    setError(null);
    // Kept as the page says it: the reason is words for whoever reads the recall later.
    const outcome = await recallNotNeeded(recall, reason === "notNeeded.other" ? other.trim() : t(reason));
    setBusy(false);
    if (!outcome.ok) {
      setError(t(`refusal.${outcome.reason}`));
      return;
    }
    toast(t("notNeeded.done", { name }), { icon: "bell-off" });
    onClose();
  };

  return (
    <Modal width={440} onClose={close} labelledBy={titleId}>
      <ModalHead icon={BellOff} tone="warn" titleId={titleId} title={recall === undefined ? t("notNeeded.gone") : t("notNeeded.title", { name })} sub={t("notNeeded.sub")} onClose={close} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 15 }}
      >
        <div role="group" aria-label={t("notNeeded.reason")} style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {REASONS.map((key) => (
            <button key={key} type="button" className="rh-chip" aria-pressed={reason === key} onClick={() => setReason(key)} style={chipStyle(reason === key)}>
              {t(key)}
            </button>
          ))}
        </div>
        {reason === "notNeeded.other" && (
          <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <span style={labelStyle}>{t("notNeeded.what")}</span>
            <input className="rh-fld" value={other} onChange={(e) => setOther(e.target.value)} placeholder={t("notNeeded.placeholder")} style={fieldStyle(false)} />
          </label>
        )}
        {error !== null && <ErrorBox icon={CircleAlert}>{error}</ErrorBox>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="rh-gi" onClick={close} style={{ ...btnGhost, flex: 1 }}>
            {t("notNeeded.keep")}
          </button>
          <Btn type="submit" busy={busy} disabled={!ok} style={{ flex: 1, ...(ok || busy ? {} : { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 }) }}>
            {t("notNeeded.takeOff")}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
