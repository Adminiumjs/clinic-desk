/**
 * "Move Delphine?" — the question after an open time is tapped while moving
 * a visit: from when to when, with whom, and that the reference stays. "Move
 * it" saves the new time on the same visit; if the practice refuses (the time
 * has just gone, the day is closed, it is outside their hours) the dialog
 * closes with why, and the day sheet stays in moving so another time can be
 * picked.
 */
import { useState } from "react";
import { CalendarSync } from "lucide-react";

import { useI18n } from "../i18n/index.tsx";
import { clinicianOf, visitName } from "../lib/desk.ts";
import { dayOf, dayShort, time } from "../lib/format.ts";
import { moveVisit } from "../state/actions.ts";
import { useDesk } from "../state/desk.ts";
import { stopPlacing, toast, type Sheet } from "../state/ui.ts";
import { Btn, Dialog } from "../components/ui.tsx";
import { refreshTimes } from "../screens/daysheet/times.ts";

export default function MoveConfirm({ sheet, onClose }: { sheet: Extract<Sheet, { kind: "move" }>; onClose: () => void }) {
  const { t } = useI18n();
  const visit = useDesk((s) => s.visits[sheet.visitId]);
  const name = useDesk((s) => (visit === undefined ? "" : visitName(s, visit)));
  const to = useDesk((s) => clinicianOf(s, sheet.to.clinicianId));
  const [busy, setBusy] = useState(false);
  if (visit === undefined) return null;

  const fromDay = dayOf(visit.starts_at);
  const toDay = dayOf(sheet.to.startsAt);
  const same = fromDay === toDay;
  const from = same ? time(visit.starts_at) : `${dayShort(fromDay)} ${time(visit.starts_at)}`;
  const until = same ? time(sheet.to.startsAt) : `${dayShort(toDay)} ${time(sheet.to.startsAt)}`;
  const first = name.trim().split(/\s+/)[0] ?? name;

  const move = async () => {
    setBusy(true);
    const out = await moveVisit(visit.id, sheet.to);
    setBusy(false);
    if (!out.ok) {
      toast(t(`refusal.${out.reason}`), { icon: "calendar-x", tone: "danger" });
      refreshTimes();
      onClose();
      return;
    }
    stopPlacing();
    onClose();
    toast(t("move.toast.moved", { name, time: time(out.value.starts_at), clinician: to?.short_name ?? "", ref: out.value.ref }), { icon: "calendar-sync", tone: "pos" });
  };

  return (
    <Dialog
      icon={CalendarSync}
      width={420}
      closeButton
      onClose={onClose}
      title={t("move.title", { name: first })}
      body={t("move.body", { from, to: until, clinician: to?.short_name ?? "", ref: visit.ref })}
    >
      <div style={{ display: "flex", gap: 10, marginBlockStart: 15 }}>
        <Btn kind="ghost" onClick={onClose} style={{ flex: 1 }}>
          {t("move.notYet")}
        </Btn>
        <Btn busy={busy} onClick={() => void move()} style={{ flex: 1 }}>
          {t("move.confirm")}
        </Btn>
      </div>
    </Dialog>
  );
}
