/**
 * THE HOST KIT'S GUARDS, WIRED — this app's copy of the gate.
 *
 * ── WHY THIS FILE EXISTS RATHER THAN THE KIT DISCOVERING ITSELF ────────────
 *
 * Every guard in the kit is a function that DECLARES a suite, and none of them
 * is auto-discovered. That is deliberate and it is the reason this file is
 * short and boring: a guard that runs because a file exists is a guard that
 * stops running when a glob changes, silently, and the kit was extracted from
 * two repos where a gate going blind by exactly that route was found eleven
 * times. A host calls each guard by name, and `tierGuard` below fails if this
 * app declares a level it has not wired.
 *
 * ── TIER 1, AND WHAT IS NOT RUNNING ────────────────────────────────────────
 *
 * `host-kit.config.ts` declares `tier: 1` and sets out at length what that
 * costs and why. The short version: this repo has no DOM in its dependencies
 * and not one `.test.tsx`, so the four guards that need to RENDER do not run.
 * `tierGuard` prints all four by name, with the defect each one leaves open, on
 * every single run — a host may sit at tier 1; it may not sit there quietly.
 *
 * ── AND THE ONE COUPLING THE KIT ENFORCES ──────────────────────────────────
 *
 * `payloadCastsGuard` is not optional for a host that mounts the component.
 * The payload contract's entire value is that a wrong shape is a compile error,
 * and one `as never` at a mount site turns that off with `tsc` clean and every
 * other suite green.
 */

import { describe, expect, it } from "vitest";

import {
  brandGuard,
  factsGuard,
  labelPairingSourceGuard,
  lexiconGuard,
  payloadCastsGuard,
  stylesGuard,
  tierGuard,
  vendoredGuard,
} from "../testing/kit/index.ts";
import { hostKit } from "./host-kit.config.ts";
import { HOSTED_SLOTS, CLOSED_SLOT_IDS } from "./slots.ts";
import { MESSAGES, registeredAddOnMessageKeys } from "../i18n/messages/index.ts";
import { demoAddOns } from "./registry.ts";
import { DAY_SOURCES } from "./daySources.ts";

/*
 * Importing the registry is not incidental — it is what REGISTERS the add-ons'
 * message bundles into `MESSAGES`, at module load, through the same code path
 * the app boots through. Without it every case below would read a bundle with
 * no add-on strings in it and the vocabulary gate would pass over nothing,
 * which is the shape of blind gate this whole package exists to end.
 */
const REGISTERED = demoAddOns();

describe("clinic-desk · the add-ons registered their strings", () => {
  it("registered every add-on that carries a bundle", () => {
    const carrying = REGISTERED.filter((a) => a.messages !== undefined).map((a) => a.key);
    expect(registeredAddOnMessageKeys()).toEqual([...carrying].sort());
  });

  it("has add-on-contributed keys in the merged bundle to check", () => {
    /*
     * THE GUARD ON THE GUARD. `lexiconGuard` scopes its failures to keys under
     * `addon.`, and an empty set of those is a pass that means nothing — which
     * is exactly what a registration that stopped happening would look like.
     */
    const contributed = Object.keys(MESSAGES["en-US"]).filter((k) => k.startsWith("addon."));
    expect(contributed.length).toBeGreaterThan(0);
  });
});

describe("clinic-desk · what it hosts is a subset of what exists", () => {
  it("mounts only slots the closed registry has", () => {
    const unknown = HOSTED_SLOTS.filter((id) => !CLOSED_SLOT_IDS.includes(id));
    expect(unknown, "an id nobody bought is an id no add-on can fill").toEqual([]);
  });

  it("hosts fewer slots than the registry holds", () => {
    // Not a count of either: what is asserted is that this app made a CHOICE.
    // A host whose list had silently become the whole registry — the mis-import
    // `slots.ts` warns about — would fail here as well as in the mounts guard.
    expect(HOSTED_SLOTS.length).toBeLessThan(CLOSED_SLOT_IDS.length);
  });

  it("names a day source for an add-on it actually registers", () => {
    /*
     * The read surface and the registration are two files naming the same
     * add-on, and nothing else connects them: a key typed differently in one of
     * them would leave a source that is never enabled — no error, no fill
     * missing, just a practice whose imported days silently stop applying.
     */
    const keys = REGISTERED.map((a) => a.key);
    expect(DAY_SOURCES.map((s) => s.addOn).filter((k) => !keys.includes(k))).toEqual([]);
  });
});

lexiconGuard(hostKit, { bundleFor: (locale) => MESSAGES[locale as "en-US"] ?? {} });
brandGuard(hostKit);
labelPairingSourceGuard(hostKit);
payloadCastsGuard(hostKit);
factsGuard(hostKit);
vendoredGuard(hostKit);
stylesGuard(hostKit);
tierGuard(hostKit);
