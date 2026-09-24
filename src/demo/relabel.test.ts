import { describe, expect, it } from "vitest";

import bundle from "../../seeds/clinic.sample.json";
import { resolveSample } from "../data/sampleRows.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { createDemoDb } from "./db.ts";
import { relabeller } from "./relabel.ts";

const resolve = (locale: string) => resolveSample(bundle as never, { now: DEMO_START, zone: DEMO_ZONE, locale });

describe("the demo practice in the page's language", () => {
  it("swaps the sample's words, keeps what the visitor typed, and leaves times alone", () => {
    const db = createDemoDb(resolve("en-US") as never, () => DEMO_START, DEMO_ZONE);
    const relabel = relabeller(db, resolve, "en-US");
    const english = db.rows.visit_types.map((t) => t.name);
    const times = db.rows.appointments.map((a) => a.starts_at);
    // The visitor renames one visit type before switching language.
    db.rows.visit_types[1]!.name = "My own name";
    expect(relabel("de-DE")).toBe(true);
    const german = resolve("de-DE")["visit_types"]!.map((t) => t["name"]);
    expect(db.rows.visit_types[0]!.name).toBe(german[0]);
    expect(db.rows.visit_types[0]!.name).not.toBe(english[0]);
    expect(db.rows.visit_types[1]!.name).toBe("My own name");
    expect(db.rows.appointments.map((a) => a.starts_at)).toEqual(times);
    // Back again, and the same language twice changes nothing.
    expect(relabel("en-US")).toBe(true);
    expect(db.rows.visit_types[0]!.name).toBe(english[0]);
    expect(relabel("en-US")).toBe(false);
  });
});
