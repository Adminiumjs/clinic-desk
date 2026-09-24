/**
 * What a live update changes in the desk's store.
 *
 * Every change arrives here — including this desk's OWN saves, echoed back by
 * the stream — so each is applied by key and is harmless twice.
 *
 * A frame names a row; it does not carry a usable copy of it (the stream
 * blanks personal columns), so the row is read again by its key. Frames that
 * arrive together are read together: closing the desk marks a dozen visits as
 * no-shows, and that is one read, not twelve. What follows from a row is
 * read with it:
 *
 *   payments, write_offs   the visit they belong to — its paid and balance
 *                          moved on the server with no frame of its own
 *   appointments           the patient it names, when the desk does not hold them
 *   patients               only a patient the desk already holds; the rest are
 *                          read when something on screen names them
 *
 * A key the read does not return is a row that is gone, or one this person
 * may no longer read: either way it leaves the desk.
 *
 * After a reconnect the whole desk is read again (`resync`), with the days the
 * day sheet and the week diary had open, because whatever was announced while
 * the connection was down is gone.
 */
import type { LiveFrame } from "../data/live.ts";
import type { Appointment, Id, Payment, TableRef, WriteOff } from "../data/types.ts";
import { practiceZone, today } from "../lib/clock.ts";
import { applySnapshot, deskReads, drop, ensureDays, ensurePatients, upsert, useDesk } from "./desk.ts";

/** How long frames gather before one read answers them all. */
const GATHER_MS = 120;
/** The most days a resync re-reads for the screens that had them open. */
const MOST_DAYS = 14;

const pending = new Map<TableRef, Set<Id>>();
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> = Promise.resolve();

function queue(ref: TableRef, id: Id): void {
  const ids = pending.get(ref) ?? new Set<Id>();
  ids.add(id);
  pending.set(ref, ids);
  if (timer === null) timer = setTimeout(() => void flush(), GATHER_MS);
}

/** Read every queued row again and fold it in. */
export function flush(): Promise<void> {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  const batch = [...pending.entries()];
  pending.clear();
  // One flush at a time, so an older answer never lands over a newer one.
  flushing = flushing.then(() => readAgain(batch));
  return flushing;
}

async function readAgain(batch: [TableRef, Set<Id>][]): Promise<void> {
  const visits = new Set<Id>();
  for (const [ref, ids] of batch) {
    if (ref === "appointments") {
      ids.forEach((id) => visits.add(id));
      continue;
    }
    const rows = await readRows(ref, ids);
    if (rows === null) continue;
    if (ref === "payments" || ref === "write_offs") {
      for (const row of rows as (Payment | WriteOff)[]) visits.add(row.appointment_id);
    }
  }
  if (visits.size > 0) {
    const rows = (await readRows("appointments", visits)) as Appointment[] | null;
    if (rows !== null) await ensurePatients(rows.map((v) => v.patient_id)).catch(() => undefined);
  }
}

/** One table's rows by key, folded in; null when the read failed (the next reconnect catches up). */
async function readRows(ref: TableRef, ids: Set<Id>): Promise<{ id: Id }[] | null> {
  let rows: { id: Id }[];
  try {
    rows = (await deskReads().rows(ref, [...ids])) as { id: Id }[];
  } catch (error) {
    console.warn(`[clinic] a live update of ${ref} could not be read:`, error);
    return null;
  }
  const found = new Set(rows.map((row) => row.id));
  for (const row of rows) upsert(ref, row);
  for (const id of ids) if (!found.has(id)) drop(ref, id);
  return rows;
}

/** One frame from the stream (or the demo's database). */
export function applyFrame(frame: LiveFrame): void {
  if (frame.id === null) return;
  if (frame.kind === "record.delete") {
    // A payment or write-off taken back changes its visit's balance.
    const s = useDesk.getState();
    const money = frame.table === "payments" ? s.payments[frame.id] : frame.table === "write_offs" ? s.writeOffs[frame.id] : undefined;
    drop(frame.table, frame.id);
    if (money !== undefined) queue("appointments", money.appointment_id);
    return;
  }
  if (frame.table === "patients" && useDesk.getState().patients[frame.id] === undefined) return;
  queue(frame.table, frame.id);
}

/** Read the whole desk again, keeping the days that were open. */
export async function resync(): Promise<void> {
  const open = Object.keys(useDesk.getState().daysRead).sort().slice(-MOST_DAYS);
  try {
    applySnapshot(await deskReads().snapshot(today(), practiceZone()));
    for (const day of open) await ensureDays(day);
  } catch (error) {
    console.warn("[clinic] the desk could not be read again after reconnecting:", error);
  }
}
