/**
 * THE MOUNT COMPONENT, BOUND TO THIS APP — once, at module scope.
 *
 * ── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────
 *
 * The kit ships a FACTORY rather than a component. The two hosts that had the
 * seam before it was packaged each declared `AddOnSlot` as a plain component
 * with their own class prefix written into the `className` and their own store
 * imported by a fixed relative path — so the file could only ever be installed
 * by hand-editing it, and a copy that must be edited to be installed is a fork
 * from the first keystroke. `createAddOnSlot` turns both of those into
 * arguments, and this is the one place this app supplies them.
 *
 * ── CALL IT ONCE ───────────────────────────────────────────────────────────
 *
 * A second call makes a second component IDENTITY, so React unmounts and
 * remounts every fill under it whenever a screen renders the other one. An
 * add-on's panel losing its local state — a half-typed year, a chosen country —
 * every time a screen re-renders is the symptom, and nothing about it looks
 * like two components.
 *
 * ── WHAT `useSlotFills` HANDS OVER, AND WHAT IT DOES NOT ───────────────────
 *
 * The fills for one slot, and every add-on's saved values. The component takes
 * it from there: it injects each fill's OWN settings into the payload as it
 * renders, so a mount site never has to know which add-on it is about to draw
 * and can never hand one add-on another's values.
 *
 * `enabled` is what scopes it. A disconnected add-on is not in that set, so it
 * has no fills, so the slot draws its fallback — which is the whole of what
 * "disconnecting removes surfaces" means in code, and it is why nothing in the
 * settings screen has to remember to hide a panel.
 */

import { createAddOnSlot, type UseSlotFills } from './kit/index.ts';
import { hostKit } from './host-kit.config.ts';
import { useStore } from '../state/store.ts';
import type { HostedSlotId } from './slots.ts';

const useSlotFills: UseSlotFills<HostedSlotId> = (slot, forAddOn) => ({
  /*
   * Two separate selectors and not one object literal. A selector returning a
   * fresh object compares unequal to itself under `useSyncExternalStore`, which
   * is a render loop rather than a slow render. `fillsFor` builds a new array
   * every call and that is fine — it is called during render, not selected.
   */
  fills: useStore((s) => s.registry).fillsFor(slot, useStore((s) => s.enabled), forAddOn),
  settings: useStore((s) => s.addOnSettings),
});

export const { AddOnSlot, SlotFill } = createAddOnSlot(hostKit, useSlotFills);
