import { describe, expect, it } from "vitest";

import manifest from "../../manifest.json";
import { COLUMN_KINDS, normalise } from "./rows.ts";

describe("a row with personal columns the reader may not see", () => {
  it("reads a masked address as none and other masked text as empty, never as the word null", () => {
    const row = normalise("patients", { id: 3, name: "Cormac Ellery", mobile: null, email: null, address: null, born_on: "1968-10-02", _masked: ["mobile", "email", "address"] });
    expect(row).toMatchObject({ id: 3, name: "Cormac Ellery", mobile: "", email: null, address: "" });
    expect(row).not.toHaveProperty("_masked");
    const message = normalise("messages", { id: 9, to_address: null, _masked: ["to_address"] });
    expect(message.to_address).toBeNull();
  });

  it("leaves an unmasked row as it came", () => {
    const row = normalise("patients", { id: 3, mobile: "07700 900164", email: "c@example.com" });
    expect(row).toMatchObject({ mobile: "07700 900164", email: "c@example.com" });
  });
});

describe("the column kinds the page reads rows by", () => {
  /*
   * Postgres and MySQL answer money as "45.00" and a yes/no as 1 or "t": a
   * column the list leaves out reaches the screens in that spelling, and a
   * switch turned off reads as on. Every money, yes/no and whole-number column
   * of a table the page reads is in the list, as the manifest declares it.
   */
  it("names every money, yes/no and whole-number column of the manifest's tables the page reads", () => {
    const want: Record<string, string> = { money: "money", bool: "bool", int: "int" };
    const missing: string[] = [];
    for (const table of manifest.requiredSchema.tables as { ref: string; columns: { ref: string; type: string }[] }[]) {
      const kinds = (COLUMN_KINDS as Record<string, Record<string, string> | undefined>)[table.ref];
      if (kinds === undefined) continue;
      for (const column of table.columns) {
        const kind = want[column.type];
        if (kind !== undefined && kinds[column.ref] !== kind) missing.push(`${table.ref}.${column.ref}: ${kind}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("reads money paid online and given back as numbers, and the paying settings as yes or no", () => {
    expect(normalise("appointments", { id: 1, paid_online: "45.00", refunded: "0.00" })).toMatchObject({ paid_online: 45, refunded: 0 });
    expect(normalise("payments", { id: 1, amount: "45.00", refunded: "45.00", kept: "0.00" })).toMatchObject({ amount: 45, refunded: 45, kept: 0 });
    expect(normalise("settings", { id: 1, auto_refund: 0, pay_ahead: 1, pay_hold_minutes: "15" })).toMatchObject({ auto_refund: false, pay_ahead: true, pay_hold_minutes: 15 });
  });
});
