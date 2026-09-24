/**
 * What opens over the patients' pages: the toasts, and the patient's own
 * cancel dialog (outside the window "Cancel this visit?"; inside it "This is
 * inside 24 hours", in the patient's voice, with "Cancel it anyway").
 *
 * The dialog opens through the shared `sheet` (`{kind: "cancel"}`), so the
 * demo card hides while it is up, as it does for every dialog. Whether the
 * cancellation was late is the server's answer (`late_cancel` in its reply);
 * the window here only chooses the words before the patient decides.
 */
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, CalendarSync, CalendarX, Check, CircleCheck, ListOrdered, Mail, MailCheck, TriangleAlert, UserPlus } from "lucide-react";

import { PortError } from "../data/ports.ts";
import { useI18n } from "../i18n/index.tsx";
import { dayOf, dayShort, num, timeRange } from "../lib/format.ts";
import { now } from "../lib/clock.ts";
import { cancelMine, usePatients } from "../state/patients.ts";
import { closeSheet, toast, useUi } from "../state/ui.ts";
import { Btn, Dialog, btnGhost, mono } from "./ui.tsx";
import { Toasts } from "./ui.tsx";
import { insideWindow, sessionEnded } from "../screens/patient/logic.ts";
import { ClinicianTile, Notice, clinicianNamed, useCatalogue } from "../screens/patient/parts.tsx";
import { endSession } from "../screens/patient/VerifyFlow.tsx";

const ICONS: Record<string, LucideIcon> = {
  check: Check,
  "circle-check": CircleCheck,
  "triangle-alert": TriangleAlert,
  mail: Mail,
  "mail-check": MailCheck,
  "calendar-sync": CalendarSync,
  "calendar-check": CalendarCheck,
  "calendar-x": CalendarX,
  "user-plus": UserPlus,
  "list-ordered": ListOrdered,
};
const iconFor = (name: string): LucideIcon => ICONS[name] ?? Check;

export function PatientOverlays() {
  const sheet = useUi((s) => s.sheet);
  return (
    <>
      {sheet?.kind === "cancel" && <PatientCancel visitId={sheet.visitId} />}
      <Toasts icons={iconFor} />
    </>
  );
}

function PatientCancel({ visitId }: { visitId: number }) {
  const { t } = useI18n();
  const cat = useCatalogue();
  const visit = usePatients((s) => s.visits?.find((v) => v.id === visitId) ?? null);
  const found = usePatients((s) => s.found);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  const settings = cat?.settings ?? null;
  if (visit === null || settings === null || cat === null) return null;

  const late = insideWindow(visit.starts_at, now(), settings.cancel_hours);
  const who = clinicianNamed(cat, visit.clinician_id);
  const hours = num(settings.cancel_hours);

  const confirm = async () => {
    setBusy(true);
    setRefused(false);
    try {
      const done = await cancelMine(visit.id);
      closeSheet();
      if (done.late_cancel) toast(t("pCancel.doneLate", { ref: visit.ref }), { icon: "triangle-alert", tone: "warn" });
      else toast(t("pCancel.done", { ref: visit.ref }), { icon: "circle-check" });
    } catch (error) {
      if (error instanceof PortError && sessionEnded(error.code)) {
        closeSheet();
        await endSession(true, "timeout");
        return;
      }
      setRefused(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      icon={late ? TriangleAlert : CalendarX}
      tone={late ? "warn" : "neutral"}
      title={late ? t("pCancel.lateTitle", { hours }) : t("pCancel.title")}
      body={late ? t("pCancel.lateBody", { hours }) : t("pCancel.body")}
      onClose={closeSheet}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBlockStart: 15, padding: 13, borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <ClinicianTile name={who?.name ?? null} color={who?.color ?? null} size={36} />
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em" }}>{who === null ? (found?.name ?? "") : t("pCancel.who", { name: found?.name ?? "", clinician: who.short })}</span>
          <span style={{ ...mono(12, 600, "var(--fg-muted)"), whiteSpace: "normal" }}>{`${dayShort(dayOf(visit.starts_at))} · ${timeRange(visit.starts_at, visit.minutes)} · ${visit.ref}`}</span>
        </span>
      </div>
      {refused && <Notice style={{ marginBlockStart: 12 }}>{t("pCancel.refused", { phone: settings.phone })}</Notice>}
      <div style={{ display: "flex", gap: 10, marginBlockStart: 16 }}>
        <button type="button" className="rh-gi" onClick={closeSheet} style={{ ...btnGhost, flex: 1 }}>
          {t("pCancel.keep")}
        </button>
        <Btn busy={busy} onClick={() => void confirm()} style={{ flex: 1, background: late ? "var(--warn)" : "var(--danger)", color: "var(--accent-fg)" }}>
          {late ? t("pCancel.anyway") : t("pCancel.confirm")}
        </Btn>
      </div>
    </Dialog>
  );
}
