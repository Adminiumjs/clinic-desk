/**
 * The practice's "now", as a hook: a screen showing waits, "hasn't arrived"
 * or the day sheet's now line re-renders when the clock moves — every 30
 * seconds on a real desk, and at once when the demo's card moves its clock.
 */
import { useSyncExternalStore } from "react";

import { now, onClockJump } from "./clock.ts";

let current = now();
const listeners = new Set<() => void>();
function refresh(): void {
  current = now();
  listeners.forEach((tell) => tell());
}
// A jump (the demo's clock, or the clock source being set at boot) and the real clock's half-minute.
onClockJump(refresh);
if (typeof window !== "undefined") setInterval(refresh, 30_000);

const subscribe = (tell: () => void) => {
  listeners.add(tell);
  return () => listeners.delete(tell);
};

/** Epoch ms on the practice's clock, re-read when it moves. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
