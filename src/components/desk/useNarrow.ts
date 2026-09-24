/**
 * Whether the desk is narrower than 900 px — the width below which the design
 * folds the sidebar into a menu, stacks the waiting room and lets the day
 * sheet's columns scroll sideways.
 */
import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 899.98px)";

function subscribe(tell: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const list = matchMedia(QUERY);
  list.addEventListener("change", tell);
  return () => list.removeEventListener("change", tell);
}
const read = (): boolean => typeof matchMedia === "function" && matchMedia(QUERY).matches;

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
