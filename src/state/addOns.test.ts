/**
 * Holiday calendars in a desk Adminium serves: connected to this app at
 * install (it is offered then, with "Mark public holidays as closures"), it
 * starts switched on here with the days Adminium keeps for it, and each day is
 * offered as the closure the add-on's README says it is for this app — one
 * day, `from_date` = `to_date`, labelled with the day's name, for the whole
 * practice.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { DAY_SOURCES, addOnClosures, closureFor } from "../add-ons/closures.ts";
import { demoAddOns } from "../add-ons/registry.ts";
import { setAddOnSaver, useAddOns } from "./addOns.ts";

beforeEach(() => {
  useAddOns.setState({ enabled: new Set(), credentialled: new Set(), addOnSettings: {} });
  useAddOns.getState().registerAddOns(demoAddOns());
});

const CHRISTMAS = { date: "2026-12-25", name: "Christmas Day" };

describe("an add-on Adminium says is connected to this app", () => {
  it("starts switched on, with the days Adminium keeps for it", () => {
    useAddOns.getState().connectFromServer({
      "holiday-calendars": { version: "1.0.2", settings: { days: [CHRISTMAS] } },
      // Not one this build carries: nothing to switch on.
      invoices: { version: "1.0.3", settings: { business_name: "Rowan Health" } },
    });
    const { enabled, addOnSettings } = useAddOns.getState();
    expect([...enabled]).toEqual(["holiday-calendars"]);
    expect(addOnClosures(DAY_SOURCES, enabled, addOnSettings)).toEqual([{ date: "2026-12-25", reason: "Christmas Day", clinician: null, from: "holiday-calendars" }]);
  });

  it("leaves the desk as it was when nothing it carries is connected", () => {
    useAddOns.getState().connectFromServer({});
    useAddOns.getState().connectFromServer({ invoices: { version: "1.0.3", settings: {} } });
    expect(useAddOns.getState().enabled.size).toBe(0);
  });

  it("offers each day as a one-day closure of the whole practice, labelled with the day's own name", () => {
    useAddOns.getState().connectFromServer({ "holiday-calendars": { version: "1.0.2", settings: { days: [CHRISTMAS] } } });
    const [day] = addOnClosures(DAY_SOURCES, useAddOns.getState().enabled, useAddOns.getState().addOnSettings);
    expect(closureFor(day!)).toEqual({ clinicianId: null, from: "2026-12-25", to: "2026-12-25", label: "Christmas Day", note: null });
  });
});

describe("the days picked on Hours & closures", () => {
  it("are saved to the add-on's own settings in Adminium, and put back when the save is refused", async () => {
    // They lived in the page alone: "Import this year" listed the holidays, and a reload took them away.
    const saved: [string, Record<string, unknown>][] = [];
    let failed = 0;
    setAddOnSaver(
      async (addOn, values) => {
        saved.push([addOn, values]);
      },
      () => (failed += 1),
    );
    useAddOns.getState().patchAddOnSettings("holiday-calendars", { days: [CHRISTMAS] });
    await Promise.resolve();
    expect(saved).toEqual([["holiday-calendars", { days: [CHRISTMAS] }]]);
    expect(useAddOns.getState().addOnSettings["holiday-calendars"]).toMatchObject({ days: [CHRISTMAS] });

    setAddOnSaver(() => Promise.reject(new Error("refused")), () => (failed += 1));
    useAddOns.getState().patchAddOnSettings("holiday-calendars", { days: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Refused: the page shows what Adminium still holds, and says so.
    expect(useAddOns.getState().addOnSettings["holiday-calendars"]).toMatchObject({ days: [CHRISTMAS] });
    expect(failed).toBe(1);
    setAddOnSaver(null);
  });
});
