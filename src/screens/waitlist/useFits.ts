/**
 * The waiting list's fits, read from the server: for each entry, the first
 * open time within the next six working days for their kind of visit, their
 * clinician (or anyone), in the part of the day they asked for.
 *
 * Entries asking the same question (visit type and clinician) share one set
 * of reads, and a day's times are read only while some entry sharing them
 * still has no fit, so a list of five costs a handful of requests.
 *
 * The fits are read again whenever a visit in the coming fortnight is booked,
 * moved or cancelled (by this desk or another), and when the waiting-list ask
 * closes — a time that was just taken elsewhere then gives way to the next.
 */
import { useEffect, useRef, useState } from "react";

import type { SlotTime } from "../../data/ports.ts";
import type { Day, Id, WaitingEntry } from "../../data/types.ts";
import { COUNTED } from "../../data/types.ts";
import { addDays } from "../../data/venueTime.ts";
import { dayOf } from "../../lib/format.ts";
import { today } from "../../lib/clock.ts";
import { FIT_LOOK, askKey, firstFit, morningEndsOn, workingDays, type Fit } from "../../lib/waitlist.ts";
import { deskReads, useDesk, type DeskState } from "../../state/desk.ts";
import { useUi } from "../../state/ui.ts";

export type FitState = { state: "loading" } | { state: "ready"; fit: Fit | null } | { state: "failed" };

/** What the free times depend on: the visits that hold a time in the coming fortnight. */
function heldTimes(s: DeskState): string {
  const from = today();
  const to = addDays(from, FIT_LOOK);
  return Object.values(s.visits)
    .filter((v) => COUNTED.includes(v.status) && dayOf(v.starts_at) >= from && dayOf(v.starts_at) < to)
    .map((v) => `${v.id}@${v.starts_at}/${v.clinician_id ?? ""}`)
    .sort()
    .join(",");
}

/** Read one question's days in order until every entry asking it has a fit, or the days run out. */
async function fitsFor(group: readonly WaitingEntry[], from: Day, hours: DeskState["hours"]): Promise<Map<Id, Fit | null>> {
  const reads = deskReads();
  const first = group[0]!;
  const kind = first.visit_type_id;
  const resource = first.clinician_id ?? "any";
  const out = new Map<Id, Fit | null>(group.map((e) => [e.id, null]));
  const strip = await reads.days({ kind, resource, from, days: FIT_LOOK });
  const open = new Set(strip.filter((d) => d.state === "open").map((d) => d.date));
  const answered: { day: Day; times: SlotTime[]; split: number }[] = [];
  for (const day of workingDays(strip)) {
    if (!open.has(day)) continue;
    answered.push({ day, times: await reads.times({ kind, resource, date: day }), split: morningEndsOn(hours, day) });
    let pending = false;
    for (const entry of group) {
      const fit = firstFit(answered, entry.part_of_day, entry.clinician_id);
      out.set(entry.id, fit);
      if (fit === null) pending = true;
    }
    if (!pending) break;
  }
  return out;
}

export function useFits(entries: readonly WaitingEntry[]): Map<Id, FitState> {
  const held = useDesk(heldTimes);
  const hours = useDesk((s) => s.hours);
  const closures = useDesk((s) => s.closures);
  const clinicianHours = useDesk((s) => s.clinicianHours);
  const asking = useUi((s) => s.sheet?.kind === "waitAsk");
  const [reload, setReload] = useState(0);
  const wasAsking = useRef(asking);
  useEffect(() => {
    if (wasAsking.current && !asking) setReload((n) => n + 1);
    wasAsking.current = asking;
  }, [asking]);

  const questions = entries.map((e) => `${e.id}:${askKey(e)}:${e.part_of_day}`).join(",");
  const [fits, setFits] = useState<Map<Id, FitState>>(() => new Map());
  const key = `${questions}|${held}|${String(reload)}|${today()}`;

  useEffect(() => {
    let live = true;
    const from = today();
    const groups = new Map<string, WaitingEntry[]>();
    for (const entry of entries) groups.set(askKey(entry), [...(groups.get(askKey(entry)) ?? []), entry]);
    // A short pause: a burst of live updates asks once, not once per row.
    const timer = setTimeout(() => {
      void Promise.all(
        [...groups.values()].map((group) =>
          fitsFor(group, from, hours).then(
            (found) => [...found.entries()].map(([id, fit]): [Id, FitState] => [id, { state: "ready", fit }]),
            () => group.map((e): [Id, FitState] => [e.id, { state: "failed" }]),
          ),
        ),
      ).then((all) => {
        if (live) setFits(new Map(all.flat()));
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `entries` is read through `questions` (in `key`): a new array with the same questions asks nothing new.
  }, [key, hours, closures, clinicianHours]);

  // Until the new answer comes, the last one stands (a re-read does not blank the list); rows it lacks show loading.
  return fits;
}
