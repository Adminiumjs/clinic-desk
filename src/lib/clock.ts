/**
 * The practice's clock: what time it is, and what day, where the practice is.
 *
 * A real desk runs on the real time, read on the practice's zone (the one
 * Adminium keeps for the connection), so "today", "hasn't arrived" and a
 * waiting time mean the same thing on every screen whatever zone the computer
 * is set to. The demo runs on a pinned Tuesday — 28 July 2026, 09:20 in
 * London — which the website's card moves on in 15-minute steps and puts back.
 */
import { venueDay, venueStamp, venueTime } from "../data/venueTime.ts";

/** The demo's morning: Tuesday 28 July 2026, 09:20 in London. */
export const DEMO_ZONE = "Europe/London";
export const DEMO_START = venueStamp("2026-07-28", "09:20", DEMO_ZONE);

let zone = "UTC";
let read: () => number = () => Date.now();
const listeners = new Set<() => void>();

/** The practice's zone, from the staff config or the public config. */
export function setZone(next: string): void {
  zone = next;
}
export const practiceZone = (): string => zone;

/** Where "now" comes from: the real clock, or the demo's. */
export function setClockSource(source: () => number): void {
  read = source;
  listeners.forEach((l) => l());
}
export const now = (): number => read();
export const today = (): string => venueDay(read(), zone);
export const timeNow = (): string => venueTime(read(), zone);

/** Called when the demo's clock jumps, so screens re-read the time at once. */
export function onClockJump(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const clockJumped = (): void => listeners.forEach((l) => l());

/** The demo's clock: the pinned morning plus the card's quarter-hours. */
export function demoClock(): { now: () => number; advance: (minutes: number) => void; reset: () => void } {
  let at = DEMO_START;
  return {
    now: () => at,
    advance(minutes) {
      at += minutes * 60_000;
      clockJumped();
    },
    reset() {
      at = DEMO_START;
      clockJumped();
    },
  };
}
