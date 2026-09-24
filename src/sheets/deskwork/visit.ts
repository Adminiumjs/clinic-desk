/**
 * The visit a money sheet is about, as the desk holds it — read first when
 * the desk has not read it (a sheet opened from an old visit on a patient's
 * page), and read again when the server says its balance moved.
 */
import { useEffect, useState } from "react";

import type { Appointment, Id } from "../../data/types.ts";
import { deskReads, ensurePatients, upsert, useDesk } from "../../state/desk.ts";

/**
 * Read a visit as it stands now, with its patient, into the desk.
 *
 * INTEGRATOR: `recordPayment` / `writeOff` could do this themselves on a
 * `balance` refusal; until they do, the sheets call it.
 */
export async function rereadVisit(id: Id): Promise<void> {
  const rows = await deskReads().visits([id]);
  for (const row of rows) upsert("appointments", row);
  await ensurePatients(rows.map((row) => row.patient_id));
}

/** The visit, or `undefined` while it is read, or `null` when it could not be. */
export function useVisit(id: Id): Appointment | undefined | null {
  const held = useDesk((s) => s.visits[id]);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (held !== undefined) {
      void ensurePatients([held.patient_id]).catch(() => undefined);
      return;
    }
    let live = true;
    rereadVisit(id)
      .then(() => {
        if (live && useDesk.getState().visits[id] === undefined) setMissing(true);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
    };
    // Only when the sheet opens, or the visit it names changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return held ?? (missing ? null : undefined);
}
