/**
 * `manifest.json` is written from `src/manifest/` (`npm run manifest`), and
 * this is what keeps the two from drifting: an edit to a module that was not
 * written out, or a hand edit to the file, fails here with the fix named.
 *
 * It also holds the manifest's own promises that the product's validator
 * cannot see: every label in all eight languages, every email in all eight,
 * and the rules a clinic depends on present on the tables they guard.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildManifest, manifestText } from "./build.ts";
import { LOCALES } from "./labels.ts";

const FILE = join(__dirname, "..", "..", "manifest.json");

type Json = Record<string, unknown>;
const manifest = buildManifest() as Json & { requiredSchema: { tables: (Json & { ref: string; columns: (Json & { ref: string })[] })[] } };
const table = (ref: string) => manifest.requiredSchema.tables.find((t) => t.ref === ref)!;
const column = (t: string, c: string) => table(t).columns.find((col) => col.ref === c)!;

describe("manifest.json is what src/manifest/ writes", () => {
  it("is byte for byte the modules' output — run `npm run manifest` after changing them", () => {
    expect(readFileSync(FILE, "utf8") === manifestText()).toBe(true);
  });
});

describe("every word a person reads is in all eight languages", () => {
  it("labels every table, column and choice in each language", () => {
    const labels: unknown[] = [];
    const walk = (value: unknown, key: string): void => {
      if (Array.isArray(value)) value.forEach((v) => walk(v, key));
      else if (value !== null && typeof value === "object") {
        const record = value as Json;
        if (["label", "labelPlural"].includes(key) || (key === "labels" && "en-US" in record)) labels.push(record);
        for (const [k, v] of Object.entries(record)) walk(v, k);
      }
    };
    walk(manifest.requiredSchema, "");
    walk(manifest["navGroups"], "");
    expect(labels.length).toBeGreaterThan(150);
    for (const label of labels) expect(Object.keys(label as Json).sort()).toEqual([...LOCALES].sort());
  });

  it("titles every page in each language", () => {
    for (const page of manifest["pages"] as { ref: string; titles: Json }[]) {
      expect(Object.keys(page.titles).sort(), page.ref).toEqual(LOCALES.filter((tag) => tag !== "en-US").sort());
    }
  });

  it("ships every email in each language, with the English email's variables and no others", () => {
    const vars = (value: unknown): string[] => [...JSON.stringify(value).matchAll(/\{\{([a-z_.]+)\}\}/g)].map((m) => m[1]!).sort();
    for (const template of manifest["emailTemplates"] as { key: string; locales: Record<string, unknown> }[]) {
      expect(Object.keys(template.locales).sort(), template.key).toEqual([...LOCALES].sort());
      const english = vars(template.locales["en-US"]);
      for (const tag of LOCALES) expect(vars(template.locales[tag]), `${template.key} ${tag}`).toEqual(english);
    }
  });
});

describe("the rules a clinic depends on are declared on the tables they guard", () => {
  it("books clinicians by overlap, on the practice's hours, closures and settings", () => {
    const booking = table("appointments")["booking"] as Json;
    expect(booking).toMatchObject({ start: "starts_at", minutes: "minutes", resource: "clinician_id", kind: "visit_type_id" });
    expect(booking["cancel"]).toMatchObject({ mode: "flag", flag: "late_cancel" });
  });

  it("keeps the money: paid and written-off are totals, the balance is capped", () => {
    expect((column("appointments", "paid")["rules"] as Json)["rollup"]).toMatchObject({
      from: "payments",
      where: { column: "voided", eq: false },
      balance: { column: "balance", of: "fee", minus: ["waived"] },
      cap: true,
    });
    expect((column("appointments", "waived")["rules"] as Json)["rollup"]).toMatchObject({ from: "write_offs", cap: true });
  });

  it("gives every multi-step create a per-action key, so a retry finds what the first try saved", () => {
    for (const ref of ["patients", "appointments", "payments", "write_offs", "recalls", "messages", "closures"]) {
      expect(column(ref, "client_key"), ref).toMatchObject({ unique: true, nullable: true });
    }
  });
});
