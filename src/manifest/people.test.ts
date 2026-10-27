/**
 * The practice's patients, as the manifest tells Adminium of them: who a
 * patient is and where they are copied, that the reminders switch is not a
 * newsletter's yes, which emails the do-not-email list may stop (none), and
 * which tables the law keeps.
 */
import { describe, expect, it } from "vitest";

import { mailClassFloorIssues, mailClassOf } from "../testing/manifest/mail-class.ts";
import { buildManifest, MIN_ADMINIUM } from "./build.ts";
import { OUTBOX } from "./outbox.ts";

type Json = Record<string, unknown>;
type Column = Json & { ref: string; type: string; references?: string; rules?: Json };
type Copy = { table: string; column: string; holds: string; via?: string };
type Person = Json & { table: string; email: string; copies: Copy[] };
type Entry = Json & { table: string; methods: string[]; claim?: Json };

const manifest = buildManifest() as Json & {
  people: Person[];
  publicAccess: Entry[];
  outbox: Json & { recipient: Json; kinds: Record<string, string>; classes: Record<string, string>; producers: Json[] };
  requiredSchema: { tables: (Json & { ref: string; keep?: Json; columns: Column[] })[] };
  compatibility: { minAdminiumVersion: string };
};
const table = (ref: string) => manifest.requiredSchema.tables.find((t) => t.ref === ref)!;
const column = (t: string, ref: string) => table(t).columns.find((c) => c.ref === ref);

describe("the practice's patients", () => {
  it("are the patients' records: their address, name, first name and language, with no consent column and no customer column, and every copy of them", () => {
    expect(manifest.people).toEqual([
      {
        table: "patients",
        kind: "people",
        email: "email",
        name: "name",
        firstName: "firstWordOfName",
        language: "language",
        copies: [
          { table: "registrations", column: "name", holds: "name", via: "patient_id" },
          { table: "registrations", column: "email", holds: "email", via: "patient_id" },
          { table: "registrations", column: "mobile", holds: "phone", via: "patient_id" },
          { table: "appointments", column: "new_name", holds: "name", via: "patient_id" },
          { table: "appointments", column: "new_email", holds: "email", via: "patient_id" },
          { table: "appointments", column: "new_mobile", holds: "phone", via: "patient_id" },
        ],
      },
    ]);
    expect([MIN_ADMINIUM, manifest.compatibility.minAdminiumVersion]).toEqual(["0.3.38", "0.3.38"]);
  });

  it("have one address: the one the outbox writes to and the one their emailed code goes to", () => {
    const person = manifest.people[0]!;
    expect([manifest.outbox.recipient["table"], manifest.outbox.recipient["email"]]).toEqual([person.table, person.email]);
    const signIn = manifest.publicAccess.filter((e) => e.table === "patients" && e.claim?.["email"] !== undefined);
    expect(signIn.map((e) => e.claim!["email"])).toEqual([person.email]);
  });

  it("say yes to nothing by their reminders switch: it stays the outbox's opt-in for reminders, and is no consent", () => {
    const person = manifest.people[0]!;
    expect(manifest.outbox.recipient["optIn"]).toBe("remind_email");
    expect(person["consent"]).toBeUndefined();
    expect(JSON.stringify(manifest.people)).not.toContain("remind_email");
    // Only reminders ask for it; a confirmation goes whatever it says.
    expect(manifest.outbox.producers.filter((p) => p["optIn"] === true).map((p) => p["kind"])).toEqual(["reminder"]);
    expect(column("patients", "remind_email")).toMatchObject({ type: "bool", default: true });
  });

  it("are copied onto text columns of what the copy says, each linked back to the patient", () => {
    /** What the column checks it holds: an address, a phone number, or (a name) nothing. */
    const format = { email: "email", phone: "phone", name: undefined } as Record<string, string | undefined>;
    for (const copy of manifest.people[0]!.copies) {
      const held = column(copy.table, copy.column);
      const checked = (held?.rules?.["validation"] as { format?: string } | undefined)?.format;
      expect([copy.table, copy.column, held?.type, checked]).toEqual([copy.table, copy.column, "text", format[copy.holds]]);
      expect([copy.table, copy.via, column(copy.table, copy.via!)]).toEqual([copy.table, "patient_id", expect.objectContaining({ type: "fk", references: "patients" })]);
    }
  });

  it("keep the same personal marks they had: the allergy note and the policy number, and nothing new hidden from the desk or the clinician", () => {
    const personal = manifest.requiredSchema.tables.flatMap((t) => t.columns.filter((c) => c.rules?.["personal"] === true).map((c) => `${t.ref}.${c.ref}`));
    expect(personal).toEqual(["patients.allergies_note", "patients.policy_ref"]);
  });
});

describe("the tables the law keeps", () => {
  it("are a patient's health record — the patient, their visits, the notes on them and the recalls their clinician asked for — and the practice's money, for tax", () => {
    const kept = manifest.requiredSchema.tables.filter((t) => t.keep !== undefined).map((t) => [t.ref, t.keep]);
    expect(kept).toEqual([
      ["patients", { law: "health" }],
      ["appointments", { law: "health" }],
      ["payments", { law: "tax" }],
      ["write_offs", { law: "tax" }],
      ["check_notes", { law: "health" }],
      ["recalls", { law: "health" }],
    ]);
  });

  it("leave a registration, which is not yet a record, the one table where an erasure blanks a patient's copies", () => {
    const keptRefs = manifest.requiredSchema.tables.filter((t) => t.keep !== undefined).map((t) => t.ref);
    const blanked = [...new Set(manifest.people[0]!.copies.map((c) => c.table))].filter((ref) => !keptRefs.includes(ref));
    expect(blanked).toEqual(["registrations"]);
  });
});

describe("the practice's emails", () => {
  it("are every one service mail: the do-not-email list stops none", () => {
    expect(Object.keys(manifest.outbox.classes).sort()).toEqual(Object.keys(OUTBOX.kinds).sort());
    for (const kind of Object.keys(OUTBOX.kinds)) expect([kind, mailClassOf(manifest as never, { outboxKind: kind })]).toEqual([kind, "service"]);
    // A recall is a clinician's "time for your check-up" about this patient's care: service, not marketing.
    expect(manifest.outbox.classes["recall"]).toBe("service");
  });

  it("leave no kind unclassed, as Adminium 0.3.38 asks of every app that needs it", () => {
    expect(mailClassFloorIssues(manifest as never)).toEqual([]);
    const { classes: _classes, ...unclassed } = manifest.outbox;
    expect(mailClassFloorIssues({ ...manifest, outbox: unclassed } as never).length).toBe(Object.keys(OUTBOX.kinds).length);
  });
});
