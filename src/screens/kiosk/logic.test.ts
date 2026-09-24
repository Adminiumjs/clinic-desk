/**
 * What a person types at the kiosk, read as the kiosk reads it.
 */
import { describe, expect, it } from "vitest";

import { bornOnOf, boxesOf, digitsOf, doneLine, mobileReady } from "./logic.ts";

const TODAY = "2026-07-28";

describe("the date of birth from its three boxes", () => {
  it("reads a real day, one digit or two", () => {
    expect(bornOnOf("02", "10", "1968", TODAY)).toBe("1968-10-02");
    expect(bornOnOf("2", "3", "1990", TODAY)).toBe("1990-03-02");
  });
  it("refuses a day that does not exist", () => {
    expect(bornOnOf("31", "02", "1990", TODAY)).toBeNull();
    expect(bornOnOf("29", "02", "2023", TODAY)).toBeNull();
    expect(bornOnOf("29", "02", "2024", TODAY)).toBe("2024-02-29");
    expect(bornOnOf("0", "10", "1990", TODAY)).toBeNull();
    expect(bornOnOf("10", "13", "1990", TODAY)).toBeNull();
  });
  it("refuses a short year and a day after today", () => {
    expect(bornOnOf("02", "10", "68", TODAY)).toBeNull();
    expect(bornOnOf("29", "07", "2026", TODAY)).toBeNull();
    expect(bornOnOf("28", "07", "2026", TODAY)).toBe(TODAY);
  });
  it("reads Arabic-Indic digits as an Arabic keyboard types them", () => {
    expect(digitsOf("٠٢")).toBe("02");
    expect(digitsOf("۱۹۶۸")).toBe("1968");
    expect(bornOnOf("٠٢", "١٠", "١٩٦٨", TODAY)).toBe("1968-10-02");
  });
  it("fills the boxes from a date (the demo's fill)", () => {
    expect(boxesOf("1968-10-02")).toEqual({ day: "02", month: "10", year: "1968" });
    expect(boxesOf("02/10/1968")).toBeNull();
  });
});

describe("the mobile", () => {
  it("needs seven digits at least, however it is spaced", () => {
    expect(mobileReady("07700 900164")).toBe(true);
    expect(mobileReady("20 12 34 56")).toBe(true);
    expect(mobileReady("123 45")).toBe(false);
    expect(mobileReady("")).toBe(false);
  });
});

describe("the thank-you's line", () => {
  it("says the clinician and time when both were read, else what there is", () => {
    expect(doneLine({ kind: "done", firstName: "C", at: "2026-07-28T08:00:00Z", clinician: "Nadia" }).key).toBe("kiosk.doneWith");
    expect(doneLine({ kind: "done", firstName: "C", at: "2026-07-28T08:00:00Z", clinician: null }).key).toBe("kiosk.doneAt");
    expect(doneLine({ kind: "done", firstName: "C", at: null, clinician: "Nadia" }).key).toBe("kiosk.donePlain");
  });
});
