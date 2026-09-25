/**
 * Which add-ons are connected to this app, and so which of its features the
 * desk shows (`lib/features.ts`).
 *
 * Filled once at boot from the desk's config (`data/connectedAddOns.ts`);
 * empty in the demo and on the patients' pages, where nothing is connected.
 * When the server refuses a feature's document as switched off — someone
 * disconnected the add-on while this desk was open — the desk forgets that
 * add-on here, and the feature's buttons go with it.
 */
import { create } from "zustand";

import type { ConnectedAddOns } from "../data/connectedAddOns.ts";
import { featureOn, type FeatureId } from "../lib/features.ts";

interface FeaturesState {
  connected: ConnectedAddOns;
}

export const useFeatures = create<FeaturesState>(() => ({ connected: {} }));

export function setConnectedAddOns(connected: ConnectedAddOns): void {
  useFeatures.setState({ connected });
}

/** The server said an add-on is not there for this app any more. */
export function forgetAddOn(key: string): void {
  useFeatures.setState((s) => {
    if (s.connected[key] === undefined) return s;
    const { [key]: _gone, ...rest } = s.connected;
    return { connected: rest };
  });
}

export function isFeatureOn(id: FeatureId, state: FeaturesState = useFeatures.getState()): boolean {
  return featureOn(id, Object.keys(state.connected));
}

/** Whether a feature is on, as a hook. */
export function useFeature(id: FeatureId): boolean {
  return useFeatures((s) => isFeatureOn(id, s));
}

/** One public setting of a connected add-on, as text; null when it is not there or empty. */
export function useAddOnText(key: string, setting: string): string | null {
  return useFeatures((s) => {
    const value = s.connected[key]?.settings[setting];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
  });
}
