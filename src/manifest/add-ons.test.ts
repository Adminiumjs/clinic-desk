/**
 * The add-ons this app works with, the document it ships and the email that
 * carries it — the promises the manifest makes about them:
 *
 *   - nothing is REQUIRED: a practice runs its day without either add-on, so
 *     both are offered and one feature switches off without its add-on;
 *   - the receipt a patient claims with is Invoices & Receipts' `receipt` of
 *     one payment, not an invoice: every slot it maps is one the add-on's
 *     receipt draws, every column is one this app has;
 *   - it names the visit by its kind and never by the reason typed for it, and
 *     nothing anonymous can reach it: no patients'-page door opens payments or
 *     documents, and the patient's address stays personal;
 *   - the receipt email carries the receipt (`attach`) through the outbox's
 *     payment link.
 *
 * With an add-ons checkout beside this repo (`ADD_ONS_REPO`, as the contract
 * runs), the mapped slots are checked against the add-on's own outline too.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { FEATURES, INSURER_RECEIPTS } from "../lib/features.ts";
import { buildManifest, MIN_ADMINIUM, VERSION } from "./build.ts";
import { LOCALES } from "./labels.ts";

type Labels = Record<string, string>;
type Column = { ref: string; type: string; references?: string; nullable?: boolean; rules?: Record<string, unknown> };
type Table = { ref: string; columns: Column[] };
interface Manifest {
  version: string;
  compatibility: { minAdminiumVersion: string };
  addOns: {
    requires?: unknown[];
    suggests: { key: string; range: string; checked?: boolean; reason: Labels }[];
    features: { id: string; label: Labels; requires: string[] }[];
  };
  requiredSchema: { tables: Table[] };
  publicAccess: { table: string; select?: string[]; documents?: unknown }[];
  outbox: { links: Record<string, string>; kinds: Record<string, string> };
  emailTemplates: { key: string; attach?: { kind: string; link: string }; locales: Record<string, unknown> }[];
  documents: { kind: string; addOn: string; table: string; feature?: string; name: Labels; mapping: Record<string, { column: string; via?: string } | { collection: unknown }> }[];
}

const manifest = buildManifest() as unknown as Manifest;
const REPO = fileURLToPath(new URL("../..", import.meta.url));
const table = (ref: string) => manifest.requiredSchema.tables.find((t) => t.ref === ref)!;
const column = (ref: string, name: string) => table(ref).columns.find((c) => c.ref === name);

/** Every language the app ships, each its own words (a copied English one is a missing translation). */
function translated(labels: Labels): string[] {
  const missing = LOCALES.filter((tag) => (labels[tag] ?? "").trim() === "");
  const copied = LOCALES.filter((tag) => tag !== "en-US" && labels[tag] === labels["en-US"]);
  return [...missing.map((tag) => `${tag} missing`), ...copied.map((tag) => `${tag} is the English`)];
}

describe("the add-ons Clinic Desk works with", () => {
  it("requires none, and offers Holiday calendars and Invoices & Receipts, each with its reason", () => {
    expect(manifest.addOns.requires).toBeUndefined();
    expect(manifest.addOns.suggests.map((s) => [s.key, s.range, s.checked])).toEqual([
      ["holiday-calendars", ">=1.0.2", true],
      ["invoices", ">=1.0.4", false],
    ]);
    expect(manifest.addOns.suggests.find((s) => s.key === "holiday-calendars")!.reason["en-US"]).toBe("Mark public holidays as closures");
    expect(manifest.addOns.suggests.find((s) => s.key === "invoices")!.reason["en-US"]).toBe("Email or print a receipt a patient can claim with");
    for (const s of manifest.addOns.suggests) expect(translated(s.reason), s.key).toEqual([]);
  });

  it("switches off receipts for insurers without Invoices & Receipts — the same list the desk reads", () => {
    expect(manifest.addOns.features.map((f) => [f.id, f.requires])).toEqual([[INSURER_RECEIPTS, [...FEATURES[INSURER_RECEIPTS]]]]);
    for (const f of manifest.addOns.features) expect(translated(f.label), f.id).toEqual([]);
  });

  it("asks for the Adminium that reads add-ons, documents and attachments, as a patch of 0.2", () => {
    expect([VERSION, MIN_ADMINIUM, manifest.version, manifest.compatibility.minAdminiumVersion]).toEqual(["0.2.1", "0.3.2", "0.2.1", "0.3.2"]);
    const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as { version: string; repository?: unknown };
    expect(pkg.version).toBe(VERSION);
  });
});

describe("the receipt a patient claims with", () => {
  const [receipt, ...others] = manifest.documents;

  it("is one document: Invoices & Receipts' receipt of one payment, under the feature", () => {
    expect(others).toEqual([]);
    expect(receipt).toMatchObject({ kind: "receipt", addOn: "invoices", table: "payments", feature: INSURER_RECEIPTS });
    expect(translated(receipt!.name)).toEqual([]);
  });

  it("maps the practice's payment, the patient, the visit and the policy number — every column one this app has", () => {
    const problems: string[] = [];
    for (const [slot, source] of Object.entries(receipt!.mapping)) {
      if ("collection" in source) {
        problems.push(`${slot}: a list`);
        continue;
      }
      if (source.via === undefined) {
        if (column("payments", source.column) === undefined) problems.push(`${slot}: payments has no ${source.column}`);
        continue;
      }
      const link = column("payments", source.via);
      if (link?.type !== "fk" || link.references === undefined) problems.push(`${slot}: ${source.via} is no link`);
      else if (column(link.references, source.column) === undefined) problems.push(`${slot}: ${link.references} has no ${source.column}`);
    }
    expect(problems).toEqual([]);
    expect(receipt!.mapping).toMatchObject({
      amount: { column: "amount" },
      issuedAt: { column: "paid_at" },
      customerName: { via: "patient_id", column: "name" },
      title: { via: "visit_type_id", column: "name" },
      serviceDate: { via: "appointment_id", column: "starts_at" },
      attendedBy: { via: "clinician_id", column: "name" },
      reference: { via: "patient_id", column: "policy_ref" },
    });
    // The register numbers it: the add-on prints its receipt series in front.
    expect(receipt!.mapping).not.toHaveProperty("number");
  });

  it("names the visit by its kind, never by the reason typed for it or anything clinical", () => {
    const read = Object.values(receipt!.mapping).map((s) => ("column" in s ? s.column : ""));
    for (const never of ["reason", "desk_note", "allergies_note", "emergency_contact", "born_on", "mobile"]) expect(read, never).not.toContain(never);
  });

  it("reads the patient, the kind of visit and the clinician through links the server keeps equal to the visit's", () => {
    expect(column("payments", "patient_id")).toMatchObject({ type: "fk", references: "patients", nullable: true, rules: { copy: { via: "appointment_id", from: "patient_id", mode: "always" } } });
    expect(column("payments", "visit_type_id")).toMatchObject({ type: "fk", references: "visit_types", nullable: true, rules: { copy: { via: "appointment_id", from: "visit_type_id", mode: "always" } } });
    expect(column("payments", "clinician_id")).toMatchObject({ type: "fk", references: "clinicians", nullable: true, rules: { copy: { via: "appointment_id", from: "clinician_id", mode: "always" } } });
    // What it prints about the patient is personal: the policy number is marked so, the address is by its name.
    expect(column("patients", "policy_ref")?.rules).toMatchObject({ personal: true });
  });

  it("is reached by nothing anonymous: no patients'-page door opens payments, messages or documents", () => {
    expect(manifest.publicAccess.filter((e) => e.table === "payments" || e.table === "messages").map((e) => e.table)).toEqual([]);
    expect(manifest.publicAccess.filter((e) => e.documents !== undefined).map((e) => e.table)).toEqual([]);
    // The patient's address prints on it, so no patients'-page door selects it.
    expect(manifest.publicAccess.filter((e) => e.table === "patients" && (e.select ?? []).includes("address"))).toEqual([]);
  });

  it("goes by email through the outbox, carried by the receipt email", () => {
    expect(manifest.outbox.links["payment"]).toBe("payment_id");
    expect(manifest.outbox.kinds["receipt"]).toBe("clinic-receipt");
    expect(column("messages", "payment_id")).toMatchObject({ type: "fk", references: "payments", nullable: true });
    expect((column("messages", "kind") as Column & { enum?: string[] }).enum).toContain("receipt");
    const email = manifest.emailTemplates.find((t) => t.key === "clinic-receipt")!;
    expect(email.attach).toEqual({ kind: "receipt", link: "payment" });
    expect(Object.keys(email.locales).sort()).toEqual([...LOCALES].sort());
    // Only the receipt email carries a document.
    expect(manifest.emailTemplates.filter((t) => t.attach !== undefined).map((t) => t.key)).toEqual(["clinic-receipt"]);
    expect(JSON.stringify(email.locales)).not.toContain("appointment.reason");
  });
});

/*
 * The add-on's own outline, when its checkout is here: every slot this app
 * maps is one Invoices & Receipts' receipt draws. A slot the add-on does not
 * know would make the install refuse the document; this says so first.
 */
const ADD_ONS = process.env["ADD_ONS_REPO"] ?? join(REPO, "..", "add-ons");
const SERVER = join(ADD_ONS, "packages", "invoices", "dist", "server.js");
describe.skipIf(!existsSync(SERVER))(`the receipt against Invoices & Receipts' own outline${existsSync(SERVER) ? "" : " — skipped: no built add-ons checkout"}`, () => {
  it("maps only slots the add-on's receipt draws", async () => {
    const renderer = ((await import(pathToFileURL(SERVER).href)) as { default: { describe(kind: string): { slots: { id: string }[] } } }).default;
    const slots = renderer.describe("receipt").slots.map((s) => s.id);
    const receipt = manifest.documents.find((d) => d.kind === "receipt")!;
    expect(Object.keys(receipt.mapping).filter((slot) => !slots.includes(slot))).toEqual([]);
  });
});
