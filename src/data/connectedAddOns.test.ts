/**
 * The add-ons the desk's config says are connected: read leniently (an older
 * server sends none; anything malformed is left out), and never outside a
 * hosted desk — the demo and the patients' pages have no add-ons.
 */
import { describe, expect, it, vi } from "vitest";

import { connectedAddOnsOf, loadConnectedAddOns } from "./connectedAddOns.ts";
import { featureOn, FEATURES, INSURER_RECEIPTS } from "../lib/features.ts";

describe("the connected add-ons", () => {
  it("reads each add-on's version and public settings, and nothing that is not one", () => {
    expect(
      connectedAddOnsOf({
        connectionId: "c1",
        addOns: {
          invoices: { version: "1.0.3", settings: { business_name: "Rowan Health", tax_name: "VAT" } },
          "holiday-calendars": { version: "1.0.2", settings: { days: [] } },
          "Bad Key": { version: "1" },
          broken: "yes",
        },
      }),
    ).toEqual({
      invoices: { version: "1.0.3", settings: { business_name: "Rowan Health", tax_name: "VAT" } },
      "holiday-calendars": { version: "1.0.2", settings: { days: [] } },
    });
    // An older server, or one with nothing connected.
    expect(connectedAddOnsOf({ connectionId: "c1" })).toEqual({});
    expect(connectedAddOnsOf(null)).toEqual({});
    expect(connectedAddOnsOf({ addOns: [] })).toEqual({});
  });

  it("fetches the desk's own config, uncached, and answers none when it cannot", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ addOns: { invoices: { version: "1.0.3", settings: {} } } })));
    expect(await loadConnectedAddOns({ hostedStaff: true, base: "/apps/clinic/staff/", fetchImpl })).toEqual({ invoices: { version: "1.0.3", settings: {} } });
    expect(fetchImpl).toHaveBeenCalledWith("/apps/clinic/staff/surface-config.json", { cache: "no-store" });
    expect(await loadConnectedAddOns({ hostedStaff: true, base: "/", fetchImpl: vi.fn(async () => new Response("<html>", { status: 200 })) })).toEqual({});
    expect(await loadConnectedAddOns({ hostedStaff: true, base: "/", fetchImpl: vi.fn(async () => new Response("", { status: 404 })) })).toEqual({});
    const never = vi.fn();
    expect(await loadConnectedAddOns({ hostedStaff: false, fetchImpl: never })).toEqual({});
    expect(never).not.toHaveBeenCalled();
  });

  it("switches receipts for insurers on with Invoices & Receipts, and only then", () => {
    expect(FEATURES[INSURER_RECEIPTS]).toEqual(["invoices"]);
    expect(featureOn(INSURER_RECEIPTS, ["invoices"])).toBe(true);
    expect(featureOn(INSURER_RECEIPTS, new Set(["invoices", "holiday-calendars"]))).toBe(true);
    expect(featureOn(INSURER_RECEIPTS, ["holiday-calendars"])).toBe(false);
    expect(featureOn(INSURER_RECEIPTS, [])).toBe(false);
  });
});
