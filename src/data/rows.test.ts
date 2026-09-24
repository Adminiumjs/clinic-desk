import { describe, expect, it } from "vitest";

import { normalise } from "./rows.ts";

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
