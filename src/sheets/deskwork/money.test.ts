import { describe, expect, it } from "vitest";

import { amountInput, amountText, cents, half, parseAmount } from "./money.ts";

describe("parseAmount — what the desk typed, in any of its languages", () => {
  it("reads plain amounts", () => {
    expect(parseAmount("45")).toBe(45);
    expect(parseAmount(" 22.5 ")).toBe(22.5);
    expect(parseAmount("0.99")).toBe(0.99);
    expect(parseAmount(".5")).toBe(0.5);
  });

  it("reads a comma as the decimal mark (de, fr, da, cs)", () => {
    expect(parseAmount("22,50")).toBe(22.5);
    expect(parseAmount("0,5")).toBe(0.5);
    // Never the hundredfold amount stripping the comma would give.
    expect(parseAmount("22,50")).not.toBe(2250);
  });

  it("reads Arabic-Indic digits and the Arabic decimal mark", () => {
    expect(parseAmount("٢٢٫٥٠")).toBe(22.5);
    expect(parseAmount("٤٥")).toBe(45);
    expect(parseAmount("۱۲")).toBe(12);
  });

  it("reads grouping where it cannot be pence", () => {
    expect(parseAmount("1,234.50")).toBe(1234.5);
    expect(parseAmount("1.234,50")).toBe(1234.5);
    expect(parseAmount("1 234,5")).toBe(1234.5);
    expect(parseAmount("1,234")).toBe(1234);
    expect(parseAmount("1.234.567")).toBe(1234567);
  });

  it("ignores a currency sign around the number", () => {
    expect(parseAmount("£45")).toBe(45);
    expect(parseAmount("45 Kč")).toBe(45);
    expect(parseAmount("€ 12,50")).toBe(12.5);
  });

  it("refuses what is not plainly an amount", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("12.345.6")).toBeNull();
    expect(parseAmount("1.2345")).toBeNull();
    expect(parseAmount("1,2,3")).toBeNull();
    expect(parseAmount("1a2")).toBeNull();
    expect(parseAmount(".")).toBeNull();
  });
});

describe("cents and halves", () => {
  it("compares in whole cents", () => {
    expect(cents(0.1 + 0.2)).toBe(cents(0.3));
    expect(half(45)).toBe(22.5);
    expect(half(0.05)).toBe(0.03);
  });

  it("writes an amount back as it is typed", () => {
    expect(amountInput(45)).toBe("45");
    expect(amountInput(22.5)).toBe("22.50");
  });

  it("keeps pence on screen and drops a whole amount's", () => {
    expect(amountText(22.5, "GBP")).toBe("£22.50");
    expect(amountText(45, "GBP")).toBe("£45");
  });
});
