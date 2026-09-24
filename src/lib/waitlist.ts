/**
 * The waiting list's "fits": which open time suits someone waiting for an
 * earlier one — their kind of visit, their clinician (or anyone), in the part
 * of the day they asked for, within the next six working days.
 *
 * Nothing here decides a time is free: the server's staff times say which
 * are, per day, and these functions only choose among what it answered, in
 * order. Pure, so the rules are tested without a screen or a server.
 */
import type { DayState, SlotTime } from "../data/ports.ts";
import type { Day, Hhmm, Id, OpeningHours, PartOfDay, WaitingEntry } from "../data/types.ts";
import { minutesOf } from "./format.ts";
import { weekdayOf } from "./desk.ts";

/** How many working days ahead a fit may be. */
export const FIT_DAYS = 6;
/** How many calendar days are asked about to find them (weekends and closures in between). */
export const FIT_LOOK = 14;

export interface Fit {
  day: Day;
  time: Hhmm;
  /** Who would see them: the entry's clinician, or the one the server picked for "anyone". */
  clinicianId: Id;
}

/**
 * The days a fit may fall on: the first `count` the strip does not call
 * closed. A full day is still a working day — it counts, it just has no time.
 */
export function workingDays(strip: readonly DayState[], count = FIT_DAYS): Day[] {
  return strip
    .filter((d) => d.state !== "closed")
    .slice(0, count)
    .map((d) => d.date);
}

/** Where morning ends on a day: the practice's lunch close that weekday, or noon when it has none. */
export function morningEndsOn(hours: readonly OpeningHours[], day: Day): number {
  const row = hours.find((h) => h.weekday === weekdayOf(day));
  return row?.break_start ? minutesOf(row.break_start) : 12 * 60;
}

/** Whether a time is in the part of the day asked for; `split` is where morning ends. */
export function inPart(time: Hhmm, part: PartOfDay, split: number): boolean {
  if (part === "any") return true;
  return part === "mornings" ? minutesOf(time) < split : minutesOf(time) >= split;
}

/**
 * The first fitting time, from the server's answers for each day in order.
 * A free time with nobody to see them (no clinician asked for, and the
 * server named none) is passed over rather than booked with no one.
 */
export function firstFit(days: readonly { day: Day; times: readonly SlotTime[]; split: number }[], part: PartOfDay, chosen: Id | null): Fit | null {
  for (const { day, times, split } of days) {
    for (const slot of times) {
      if (slot.state !== "free" || !inPart(slot.time, part, split)) continue;
      const clinicianId = slot.resource ?? chosen;
      if (clinicianId === null) continue;
      return { day, time: slot.time, clinicianId };
    }
  }
  return null;
}

/** The list as the desk works it: longest wait first (the order the server ranks patients by). */
export function waitingInOrder(entries: readonly WaitingEntry[]): WaitingEntry[] {
  const made = (w: WaitingEntry) => (w.created_at == null ? Number.MAX_SAFE_INTEGER : Date.parse(w.created_at));
  return entries.filter((w) => w.status === "waiting").sort((a, b) => made(a) - made(b) || a.id - b.id);
}

/** Entries that ask the same question of the server share one answer. */
export const askKey = (entry: Pick<WaitingEntry, "visit_type_id" | "clinician_id">): string => `${entry.visit_type_id}|${entry.clinician_id ?? "any"}`;
