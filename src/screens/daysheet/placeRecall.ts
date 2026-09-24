/**
 * "Place a recall" (the demo card's shortcut on the day sheet): the most
 * overdue recall — else the next one due — goes on the day sheet to be
 * placed, and tapping an open time books it in and marks the recall booked.
 */
import type { TFunction } from "../../i18n/index.tsx";
import { actionKey } from "../../lib/keys.ts";
import { today } from "../../lib/clock.ts";
import { clinicianOf, typeOf, typesOf } from "../../lib/desk.ts";
import { dayOf, dayShort, time } from "../../lib/format.ts";
import { bookRecall } from "../../state/actions.ts";
import { ensurePatients, useDesk } from "../../state/desk.ts";
import { startPlacing, stopPlacing, toast } from "../../state/ui.ts";
import { refreshTimes } from "./times.ts";

export async function placeFirstRecall(t: TFunction): Promise<void> {
  const day = today();
  const open = Object.values(useDesk.getState().recalls)
    .filter((r) => r.status === "due" || r.status === "noted")
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.id - b.id);
  const recall = open.find((r) => r.due_on < day) ?? open[0];
  if (recall === undefined) return;
  await ensurePatients([recall.patient_id]).catch(() => undefined);
  const s = useDesk.getState();
  const type = typeOf(s, recall.visit_type_id) ?? typesOf(s, recall.clinician_id)[0];
  if (type === undefined) return;
  const name = s.patients[recall.patient_id]?.name ?? "";
  // One key for the whole booking, kept until it succeeds: a retry finds what the first try saved.
  const key = actionKey();
  let busy = false;
  startPlacing({
    what: "booking",
    patientName: name,
    typeId: type.id,
    minutes: type.minutes,
    clinicianId: null,
    day,
    place: (at) => {
      if (busy) return;
      busy = true;
      void bookRecall(recall, { visitTypeId: type.id, clinicianId: at.clinicianId, startsAt: at.startsAt, reason: null, deskNote: null }, key).then((out) => {
        busy = false;
        if (!out.ok) {
          toast(t(`refusal.${out.reason}`), { icon: "calendar-x", tone: "danger" });
          refreshTimes();
          return;
        }
        stopPlacing();
        const who = clinicianOf(useDesk.getState(), out.value.clinician_id)?.short_name ?? "";
        toast(t("daysheet.booked", { name, clinician: who, time: time(out.value.starts_at), day: dayShort(dayOf(out.value.starts_at)), ref: out.value.ref }), { icon: "calendar-check", tone: "pos" });
      });
    },
  });
}
