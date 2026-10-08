/**
 * The supplies of the visits the desk has open, by visit.
 *
 * Read when a visit's Supplies tab (or the send-off sheet) opens, and read
 * again after every save of a line — the line's own row comes back from the
 * save, but what is left on the shelf and which batch to propose are
 * Inventory's to say, so they are asked again rather than worked out here.
 * Another desk's change arrives as a live frame and reads the open visits
 * again too.
 *
 * It lives beside the desk's store rather than in it: the desk's snapshot is
 * the practice's own rows, read whole at boot, and this is read on demand,
 * through Inventory, only where the feature is on.
 */
import { create } from "zustand";

import { SuppliesGone, type SuppliesPort, type VisitSupplies } from "../data/supplies.ts";
import type { Id } from "../data/types.ts";
import { today } from "../lib/clock.ts";
import { can, useDesk } from "./desk.ts";
import { forgetAddOn } from "./features.ts";

export interface SuppliesEntry {
  state: "loading" | "ready" | "failed";
  /** The last view read; kept while a newer read is on its way, so a list never blinks empty. */
  view: VisitSupplies | null;
}

interface SuppliesState {
  byVisit: Record<Id, SuppliesEntry>;
  /** Seen visits a manager took back to put their supplies right: the tab offers "Done" until they are seen again. */
  correcting: Record<Id, true>;
}

export const useSupplies = create<SuppliesState>(() => ({ byVisit: {}, correcting: {} }));

let port: SuppliesPort | null = null;
/** Set once at boot: Inventory's reads on a hosted desk, the demo's own figures in the demo. */
export function setSuppliesPort(next: SuppliesPort | null): void {
  port = next;
}
export function suppliesPort(): SuppliesPort | null {
  return port;
}

/** The newest read asked for each visit: an older answer that lands later is dropped. */
const asked = new Map<Id, number>();
let counter = 0;

const put = (visitId: Id, entry: SuppliesEntry) => useSupplies.setState((s) => ({ byVisit: { ...s.byVisit, [visitId]: entry } }));

/** Read one visit's supplies. Hides the feature when Inventory turns out not to be there. */
export async function loadSupplies(visitId: Id): Promise<void> {
  const visit = useDesk.getState().visits[visitId];
  // Read only for a screen that shows it: a save that lands after its panel closed keeps nothing.
  if (port === null || visit === undefined || !shown.has(visitId)) return;
  const mine = (counter += 1);
  asked.set(visitId, mine);
  const held = useSupplies.getState().byVisit[visitId];
  put(visitId, { state: held?.view == null ? "loading" : "ready", view: held?.view ?? null });
  try {
    const view = await port.load({ id: visitId, visitTypeId: visit.visit_type_id }, { today: today(), defaultPlaceId: useDesk.getState().settings?.supplies_place_id ?? null, records: can("appointment_supplies", "create") });
    if (asked.get(visitId) === mine) put(visitId, { state: "ready", view });
  } catch (error) {
    if (asked.get(visitId) !== mine) return;
    if (error instanceof SuppliesGone) {
      // Disconnected while the desk was open: the tab and the section go with it.
      forgetAddOn("inventory");
      forgetSupplies();
      return;
    }
    put(visitId, { state: "failed", view: useSupplies.getState().byVisit[visitId]?.view ?? null });
  }
}

/** How many screens show each visit's supplies now (its panel's tab, the send-off sheet). */
const shown = new Map<Id, number>();

/**
 * Show a visit's supplies on a screen: read now, kept current while any
 * screen shows them, and let go when the last one closes. Answers the release.
 */
export function holdSupplies(visitId: Id): () => void {
  shown.set(visitId, (shown.get(visitId) ?? 0) + 1);
  void loadSupplies(visitId);
  return () => {
    const left = (shown.get(visitId) ?? 1) - 1;
    if (left > 0) {
      shown.set(visitId, left);
      return;
    }
    shown.delete(visitId);
    asked.delete(visitId);
    useSupplies.setState((s) => {
      if (s.byVisit[visitId] === undefined) return s;
      const { [visitId]: _gone, ...rest } = s.byVisit;
      return { byVisit: rest };
    });
  };
}

/** Let go of every visit's supplies: Inventory is gone, or the desk starts over. */
export function forgetSupplies(): void {
  shown.clear();
  asked.clear();
  useSupplies.setState({ byVisit: {}, correcting: {} });
}

/** A manager took a seen visit back to correct its supplies, or finished doing so. */
export function setCorrecting(visitId: Id, on: boolean): void {
  useSupplies.setState((s) => {
    if ((s.correcting[visitId] === true) === on) return s;
    const { [visitId]: _was, ...rest } = s.correcting;
    return { correcting: on ? { ...rest, [visitId]: true } : rest };
  });
}

/** How long supply frames gather before one read answers them all (a kit is six lines, and six frames). */
const GATHER_MS = 150;
let gathering: ReturnType<typeof setTimeout> | null = null;

/** Someone changed a supply line (this desk or another): the visits on screen read theirs again, once for the burst. */
export function suppliesChanged(): void {
  if (gathering !== null) return;
  gathering = setTimeout(() => {
    gathering = null;
    for (const visitId of shown.keys()) void loadSupplies(visitId);
  }, GATHER_MS);
}
