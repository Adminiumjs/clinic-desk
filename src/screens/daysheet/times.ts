/**
 * The server's open times, as the day sheet and the week diary ask for them:
 * per clinician, for one visit type, on one day (or a week of days).
 *
 * The answers are kept until something that could change them does — a visit
 * booked, moved or cancelled that day, a closure, an hours change, the clock
 * moving on a quarter hour — so the page reads again then and not on every
 * render. A refusal elsewhere ("that time has just gone") can ask for a fresh
 * read with `refreshTimes`.
 */
import { useEffect, useState } from "react";
import { create } from "zustand";

import type { DayState, SlotTime } from "../../data/ports.ts";
import type { Day, Id } from "../../data/types.ts";
import { dayOf } from "../../lib/format.ts";
import { useNow } from "../../lib/useNow.ts";
import { deskReads, useDesk } from "../../state/desk.ts";

const useSeq = create<{ seq: number }>(() => ({ seq: 0 }));

/** Read every open time again (after a save was refused because a time had gone). */
export function refreshTimes(): void {
  useSeq.setState((s) => ({ seq: s.seq + 1 }));
}

export interface TimesAsk {
  clinician: Id;
  type: Id;
  /** The visit being moved, whose own time does not count against it. */
  exclude?: Id;
}

/**
 * Read again whenever `key` changes. While a new answer is on its way the last
 * one stays on screen if it was about the same thing (`scope`: the same day
 * and the same questions), so a refresh does not blink; another day's answer
 * is never shown for this one.
 */
function useAnswer<T>(scope: string, key: string, read: () => Promise<T>): T | null {
  const [held, setHeld] = useState<{ scope: string; value: T } | null>(null);
  useEffect(() => {
    let live = true;
    read()
      .then((value) => {
        if (live) setHeld({ scope, value });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // The key says everything the read depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return held !== null && held.scope === scope ? held.value : null;
}

/** Each clinician's times on a day, for the type asked of them. `stamp` changes when anything that moves them does. */
export function useDayTimes(day: Day, asks: readonly TimesAsk[], stamp: string): Map<Id, SlotTime[]> | null {
  const seq = useSeq((s) => s.seq);
  const scope = JSON.stringify([day, asks]);
  return useAnswer(scope, `${scope}|${stamp}|${String(seq)}`, async () => {
    const entries = await Promise.all(
      asks.map(async (a): Promise<[Id, SlotTime[]]> => {
        try {
          const times = await deskReads().times({ kind: a.type, resource: a.clinician, date: day, ...(a.exclude === undefined ? {} : { exclude: a.exclude }) });
          return [a.clinician, times];
        } catch {
          return [a.clinician, []];
        }
      }),
    );
    return new Map(entries);
  });
}

/** Each clinician's days from `from`, for the type asked of them. */
export function useWeekDays(from: Day, days: number, asks: readonly TimesAsk[], stamp: string): Map<Id, DayState[]> | null {
  const seq = useSeq((s) => s.seq);
  const scope = JSON.stringify([from, days, asks]);
  return useAnswer(scope, `${scope}|${stamp}|${String(seq)}`, async () => {
    const entries = await Promise.all(
      asks.map(async (a): Promise<[Id, DayState[]]> => {
        try {
          return [a.clinician, await deskReads().days({ kind: a.type, resource: a.clinician, from, days })];
        } catch {
          return [a.clinician, []];
        }
      }),
    );
    return new Map(entries);
  });
}

/**
 * What the open times of `days` depend on, as one string: the visits on those
 * days (where and in what state), the closures, the hours, and the quarter
 * hour on the clock (a time that has passed is no longer open).
 */
export function useTimesStamp(days: readonly Day[]): string {
  const now = useNow();
  const desk = useDesk((s) => {
    const wanted = new Set(days);
    const visits = Object.values(s.visits)
      .filter((v) => wanted.has(dayOf(v.starts_at)))
      .map((v) => `${String(v.id)}.${v.status}.${v.starts_at}.${String(v.clinician_id)}`)
      .sort()
      .join(",");
    const closures = s.closures.map((c) => `${String(c.id)}.${String(c.active)}.${c.from_date}.${c.to_date}`).join(",");
    return `${visits}|${closures}|${JSON.stringify(s.hours)}|${JSON.stringify(s.clinicianHours)}|${String(s.settings?.slot_minutes)}`;
  });
  return `${desk}|${String(Math.floor(now / 900_000))}`;
}
