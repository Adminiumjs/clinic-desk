/**
 * "Staff", the quiet button in the kiosk's corner, and the one step behind it.
 *
 * Leaving the kiosk signs the tablet out of Adminium and opens Adminium's own
 * sign-in, where a member of staff signs in as themselves (the practice's
 * passwords and two-step codes, not a PIN kept by this app). The step asks
 * first because a patient can tap the corner by accident, and a tablet signed
 * out stays out of use until someone signs its kiosk account back in.
 */
import { useId, useState } from "react";
import { Lock, LogOut } from "lucide-react";

import { Btn, Modal, ModalHead } from "../../components/ui.tsx";
import { useI18n } from "../../i18n/index.tsx";

/*
 * The design draws the button at 55 % opacity; at that strength its words
 * fall below the contrast a reader needs, so it keeps the quiet colour and
 * drops the fade.
 */
export function StaffDoor({ onLeave }: { onLeave: () => Promise<void> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  const leave = async () => {
    setBusy(true);
    try {
      await onLeave();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="rh-gi"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        style={{ position: "absolute", insetBlockEnd: 14, insetInlineStart: 14, display: "inline-flex", alignItems: "center", gap: 6, height: 32, paddingInline: 10, borderRadius: 9, border: "none", background: "transparent", color: "var(--fg-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        <Lock size={12} aria-hidden="true" />
        {t("kiosk.staff")}
      </button>
      {open && (
        <Modal width={380} gap={14} onClose={() => setOpen(false)} labelledBy={titleId}>
          <ModalHead icon={Lock} title={t("kiosk.staffTitle")} sub={t("kiosk.staffBody")} titleId={titleId} onClose={() => setOpen(false)} />
          <Btn icon={LogOut} busy={busy} onClick={() => void leave()} style={{ width: "100%" }}>
            {t("kiosk.staffGo")}
          </Btn>
        </Modal>
      )}
    </>
  );
}
