/**
 * The waiting-list ask: a time has come up that fits someone on the list —
 * did the desk ring them, and shall it book it?
 *
 * Booking saves the visit and then marks the entry booked (one key for both,
 * kept until it succeeds, so a retry never books twice); the confirmation
 * email follows from the outbox when they have an address. If the time has
 * gone meanwhile, the dialog says so and stays open.
 */
import { useState } from "react";
import { CircleAlert, Mail, PhoneCall } from "lucide-react";

import { useI18n } from "../i18n/index.tsx";
import { actionKey } from "../lib/keys.ts";
import type { Id } from "../data/types.ts";
import { dayOf, dayShort, time } from "../lib/format.ts";
import { takeWaiting } from "../state/actions.ts";
import { useDesk } from "../state/desk.ts";
import { toast, type Sheet as SheetKind } from "../state/ui.ts";
import { Btn, Dialog, btnGhost } from "../components/ui.tsx";
import { Note, useRefusal, useSaving } from "./bits/ui.tsx";

/** The action key of each entry's booking, kept until it succeeds. */
const askKeys = new Map<Id, string>();

export default function WaitlistAsk({ sheet, onClose }: { sheet: Extract<SheetKind, { kind: "waitAsk" }>; onClose: () => void }) {
  const { t } = useI18n();
  const desk = useDesk();
  const refusal = useRefusal();
  const { busy, run } = useSaving();
  const [error, setError] = useState<string | null>(null);
  // One key per entry until it is booked: closing the dialog after a half-done
  // try and opening it again resumes that try instead of booking twice.
  const [key] = useState(() => {
    const kept = askKeys.get(sheet.entryId) ?? actionKey();
    askKeys.set(sheet.entryId, kept);
    return kept;
  });

  const entry = desk.waiting[sheet.entryId];
  const patient = entry === undefined ? undefined : desk.patients[entry.patient_id];
  const name = patient?.name ?? "";
  const first = name.split(/\s+/)[0] ?? name;
  const who = desk.clinicians.find((c) => c.id === sheet.at.clinicianId)?.short_name ?? "";
  const day = dayShort(dayOf(sheet.at.startsAt));
  const at = time(sheet.at.startsAt);
  const email = patient?.email !== null && patient?.email !== undefined && patient.email.trim() !== "";

  const book = async () => {
    if (entry === undefined) return;
    setError(null);
    const outcome = await run(() => takeWaiting(entry, sheet.at, key));
    if (outcome === null) return;
    if (!outcome.ok) return setError(refusal(outcome.reason));
    askKeys.delete(sheet.entryId);
    const line = t("waitAsk.toast", { name, who, time: time(outcome.value.starts_at), day: dayShort(dayOf(outcome.value.starts_at)), ref: outcome.value.ref });
    toast(email ? `${line} ${t("waitAsk.toastEmail")}` : line, { icon: "calendar-check", tone: "pos" });
    onClose();
  };

  if (entry === undefined || entry.status !== "waiting") {
    return (
      <Dialog icon={PhoneCall} title={t("waitAsk.gone")} onClose={onClose}>
        <div style={{ display: "flex", marginBlockStart: 15 }}>
          <button type="button" className="rh-gi" onClick={onClose} style={{ ...btnGhost, flex: 1 }}>
            {t("common.close")}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog icon={PhoneCall} title={t("waitAsk.title", { name: first })} body={t("waitAsk.body", { day, time: at, who })} width={420} closeButton onClose={onClose}>
      {error !== null && (
        <Note tone="danger" icon={CircleAlert} role="alert" style={{ marginBlockStart: 15 }}>
          {error}
        </Note>
      )}
      <div style={{ display: "flex", gap: 10, marginBlockStart: 15 }}>
        <button type="button" className="rh-gi" onClick={onClose} style={{ ...btnGhost, flex: 1 }}>
          {t("waitAsk.notYet")}
        </button>
        <Btn icon={Mail} busy={busy} onClick={() => void book()} style={{ flex: 1 }}>
          {email ? t("waitAsk.bookEmail", { name: first }) : t("waitAsk.book")}
        </Btn>
      </div>
    </Dialog>
  );
}
