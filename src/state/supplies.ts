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
  if (port === null || visit === undefined) return;
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
      useSupplies.setState({ byVisit: {}, correcting: {} });
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

/** A manager took a seen visit back to correct its supplies, or finished doing so. */
export function setCorrecting(visitId: Id, on: boolean): void {
  useSupplies.setState((s) => {
    if ((s.correcting[visitId] === true) === on) return s;
    const { [visitId]: _was, ...rest } = s.correcting;
    return { correcting: on ? { ...rest, [visitId]: true } : rest };
  });
}

/** Someone changed a supply line (this desk or another): read the open visits again. */
export function suppliesChanged(): Promise<void> {
  return Promise.all(Object.keys(useSupplies.getState().byVisit).map((visitId) => loadSupplies(Number(visitId) as Id))).then(() => undefined);
}
