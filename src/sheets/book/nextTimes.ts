/**
 * Book a visit's "next open times": the first six the server offers for a
 * visit type (and clinician), two a day at most so the desk sees a spread of
 * days, looked for over the next fortnight.
 *
 * The server's booking rule answers which times are open; this only asks it
 * day by day, in order, and stops once it has six.
 */
import { useEffect, useState } from "react";

import type { SlotTime } from "../../data/ports.ts";
import type { Day, Id } from "../../data/types.ts";
import { venueStamp } from "../../data/venueTime.ts";
import { practiceZone } from "../../lib/clock.ts";
import { deskReads } from "../../state/desk.ts";

export interface OpenTime {
  day: Day;
  time: string;
  startsAt: string;
  clinicianId: Id | null;
}

/** How far ahead the sheet looks, in calendar days. */
export const LOOK_AHEAD = 14;

/** The first `count` open times, at most `perDay` a day, from what the server answered for each day in order. */
export function pickTimes(days: { day: Day; times: SlotTime[] }[], chosen: Id | null, count = 6, perDay = 2): OpenTime[] {
  const out: OpenTime[] = [];
  for (const { day, times } of days) {
    let taken = 0;
    for (const slot of times) {
      if (out.length >= count || taken >= perDay) break;
      if (slot.state !== "free") continue;
      out.push({ day, time: slot.time, startsAt: new Date(venueStamp(day, slot.time, practiceZone())).toISOString(), clinicianId: slot.resource ?? chosen });
      taken += 1;
    }
    if (out.length >= count) break;
  }
  return out;
}

export type TimesState = { state: "loading" } | { state: "ready"; times: OpenTime[] } | { state: "failed" };

/** The next open times for a visit type and clinician, from a day; `reload` asks again (a time has just gone). */
export function useNextTimes(typeId: Id | null, clinicianId: Id | null, from: Day, reload: number): TimesState {
  const [result, setResult] = useState<{ key: string; value: TimesState }>({ key: "", value: { state: "loading" } });
  const key = `${String(typeId)}|${String(clinicianId)}|${from}|${String(reload)}`;
  useEffect(() => {
    if (typeId === null) return;
    let live = true;
    const reads = deskReads();
    const resource = clinicianId ?? "any";
    (async () => {
      const strip = await reads.days({ kind: typeId, resource, from, days: LOOK_AHEAD });
      const answered: { day: Day; times: SlotTime[] }[] = [];
      let found = 0;
      for (const d of strip) {
        if (d.state !== "open") continue;
        const times = await reads.times({ kind: typeId, resource, date: d.date });
        answered.push({ day: d.date, times });
        found += Math.min(2, times.filter((t) => t.state === "free").length);
        if (found >= 6) break;
      }
      return pickTimes(answered, clinicianId);
    })()
      .then((times) => {
        if (live) setResult({ key, value: { state: "ready", times } });
      })
      .catch(() => {
        if (live) setResult({ key, value: { state: "failed" } });
      });
    return () => {
      live = false;
    };
  }, [key, typeId, clinicianId, from]);
  return result.key === key ? result.value : { state: "loading" };
}
