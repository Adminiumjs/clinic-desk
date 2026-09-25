/**
 * The add-ons this app hosts: which are registered, which are switched on,
 * and each one's own saved values.
 *
 * The one add-on today is holiday calendars: its days are shown on Hours &
 * closures as suggestions ("Add as a closure"), because only a row in the
 * closures table closes the diary — the server's booking rule cannot see an
 * add-on's settings.
 *
 * `registry` starts EMPTY and is filled at boot (`registerAddOns`), so no
 * screen that imports this store pulls an add-on's bundle into its own.
 *
 * DISCONNECTING TAKES THE SURFACES AND THE CREDENTIALS, NEVER THE DATA: an
 * add-on switched off keeps its saved values, and switched on again shows
 * them unchanged.
 *
 * In a desk Adminium serves, an add-on Adminium says is connected to this app
 * (the staff config's `addOns`) starts switched on, with the values Adminium
 * keeps for it: Holiday calendars ticked at install shows its saved days on
 * Hours & closures without anyone switching it on here.
 */
import { create } from "zustand";

import { applyAddOnSettings, createRegistry, defaultSettingsFor, type AddOn, type AddOnRegistry, type AddOnSettings } from "../add-ons/vendor/host/index.ts";
import type { ConnectedAddOns } from "../data/connectedAddOns.ts";

export interface AddOnsState {
  registry: AddOnRegistry;
  /** Which add-ons are switched on. Nothing is, until somebody connects one. */
  enabled: Set<string>;
  /** Which add-ons have supplied a credential (none of this app's needs one). */
  credentialled: Set<string>;
  /** Each add-on's saved values, keyed by add-on key and opaque to this app. */
  addOnSettings: AddOnSettings;
  registerAddOns: (addOns: readonly AddOn[]) => void;
  /** Adminium's word on which add-ons are connected to this app, and the values it keeps for each. */
  connectFromServer: (connected: ConnectedAddOns) => void;
  toggleAddOn: (key: string) => void;
  connectAddOn: (key: string) => void;
  disconnectAddOn: (key: string) => void;
  patchAddOnSettings: (addOn: string, patch: Record<string, unknown>) => void;
}

export const useAddOns = create<AddOnsState>((set, get) => ({
  registry: createRegistry([]),
  enabled: new Set<string>(),
  credentialled: new Set<string>(),
  addOnSettings: {},

  registerAddOns: (addOns) => {
    // Defaults first, then what is already saved: registering twice cannot reset a value.
    const addOnSettings: AddOnSettings = { ...defaultSettingsFor(addOns), ...get().addOnSettings };
    set({ registry: createRegistry(addOns), addOnSettings });
    applyAddOnSettings(addOns, addOnSettings);
  },
  connectFromServer: (connected) => {
    const { registry } = get();
    const here = registry.all.filter((addOn) => connected[addOn.key] !== undefined);
    if (here.length === 0) return;
    const enabled = new Set(get().enabled);
    const seeded: Record<string, Record<string, unknown>> = {};
    for (const addOn of here) {
      enabled.add(addOn.key);
      seeded[addOn.key] = { ...(get().addOnSettings[addOn.key] ?? {}), ...connected[addOn.key]!.settings };
    }
    const addOnSettings: AddOnSettings = { ...get().addOnSettings, ...seeded };
    set({ enabled, addOnSettings });
    applyAddOnSettings(registry.all, addOnSettings);
  },
  toggleAddOn: (key) => {
    if (get().enabled.has(key)) get().disconnectAddOn(key);
    else get().connectAddOn(key);
  },
  connectAddOn: (key) =>
    set((s) => {
      const enabled = new Set(s.enabled);
      enabled.add(key);
      return { enabled };
    }),
  disconnectAddOn: (key) =>
    set((s) => {
      const enabled = new Set(s.enabled);
      enabled.delete(key);
      const credentialled = new Set(s.credentialled);
      credentialled.delete(key);
      return { enabled, credentialled };
    }),
  patchAddOnSettings: (addOn, patch) => {
    const addOnSettings: AddOnSettings = { ...get().addOnSettings, [addOn]: { ...(get().addOnSettings[addOn] ?? {}), ...patch } };
    set({ addOnSettings });
    applyAddOnSettings(get().registry.all, addOnSettings);
  },
}));
