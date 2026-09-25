/**
 * THE SAMPLE DATA, THE STAND-ALONE SQL AND THE MANIFEST AGREE — AND THE
 * SAMPLE IS A PRACTICE THAT COULD EXIST.
 *
 * `seeds/clinic.sample.json`, `db/schema.sql`, `db/seed.sql` and the column
 * list in sampleRows.ts are written by `npm run sample` from the manifest and
 * sample.ts. This holds the committed files to a fresh build, so an edit to
 * any source without regenerating is a red suite rather than a demo that
 * quietly disagrees with the product.
 *
 * It puts the bundle through the checks Adminium runs when an operator adds
 * it (vendored with the rest of the manifest checks), so a bundle the product
 * would refuse never ships. And because Adminium writes sample rows as
 * history — no booking rule, no cap, no stamps — it checks here what the
 * server would have refused of a person: two visits at once for one
 * clinician, a visit outside the hours or over lunch or off the grid, a
 * clinician booked for a visit they do not do, a payment beyond the fee.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { LOCALE_TAGS } from "../i18n/locales.ts";
import { sampleBundleIssues, sampleBundleSchema } from "../testing/manifest/sample.ts";
import type { Manifest } from "../testing/manifest/schema.ts";
import { SAMPLE_MOMENT, SAMPLE_ZONE, buildSample, type SampleRow } from "./sample.ts";
import { schemaSql, seedSql, type ManifestTables } from "./sample-sql.ts";
import { COLUMNS, COPIES, ROLLUPS, resolveSample, type ResolvedSample } from "./sampleRows.ts";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const manifest = JSON.parse(read("../../manifest.json")) as ManifestTables & { sampleData?: unknown };
const bundle = buildSample();
const rowsOf = (ref: string): SampleRow[] => bundle.tables.find((t) => t.ref === ref)?.rows ?? [];

type Ref = { "@ref": string };
type Wall = { "@day": number; "@time": string; "@workdays"?: true };
const labelOf = (value: unknown) => (value as Ref | null)?.["@ref"] ?? null;

describe("the committed files are what `npm run sample` writes today", () => {
  it("seeds/clinic.sample.json", () => {
    expect(read("../../seeds/clinic.sample.json") === `${JSON.stringify(bundle, null, 2)}\n`).toBe(true);
  });

  it("db/schema.sql, from the manifest", () => {
    expect(read("../../db/schema.sql") === schemaSql(manifest)).toBe(true);
  });

  it("db/seed.sql, from the bundle", () => {
    expect(read("../../db/seed.sql") === seedSql(bundle, manifest)).toBe(true);
  });
});

describe("the bundle is one Adminium will add", () => {
  it("is the file the manifest names", () => {
    expect(manifest.sampleData).toEqual({ file: "seeds/clinic.sample.json" });
  });

  it("passes the product’s own checks against this manifest", () => {
    const parsed = sampleBundleSchema.safeParse(bundle);
    expect(parsed.success ? [] : parsed.error.issues).toEqual([]);
    if (!parsed.success) return;
    // The checks read the app's key and its tables, which is all of the manifest a bundle meets.
    expect(sampleBundleIssues(parsed.data, manifest as unknown as Manifest)).toEqual([]);
  });

  it("names everything a reader sees in all eight languages", () => {
    const missing: string[] = [];
    let count = 0;
    const visit = (value: unknown, at: string) => {
      if (typeof value !== "object" || value === null) return;
      const record = value as Record<string, unknown>;
      if (record["@t"] !== undefined) {
        count += 1;
        const texts = record["@t"] as Record<string, string>;
        for (const tag of LOCALE_TAGS) if (!texts[tag]?.trim()) missing.push(`${at} ${tag}`);
        expect(Object.keys(texts).sort(), at).toEqual([...LOCALE_TAGS].sort());
        return;
      }
      for (const [key, child] of Object.entries(record)) visit(child, `${at}.${key}`);
    };
    visit(bundle.tables, "tables");
    expect(count).toBeGreaterThan(100);
    expect(missing).toEqual([]);
  });

  it("keeps the questions page’s placeholders in every language", () => {
    const answers = rowsOf("faqs").map((row) => (row["answer"] as { "@t": Record<string, string> })["@t"]);
    expect(answers).toHaveLength(6);
    for (const tag of LOCALE_TAGS) {
      const all = answers.map((a) => a[tag]).join(" ");
      for (const name of ["{phone}", "{no_show_minutes}", "{cancel_hours}"]) expect(all, tag).toContain(name);
    }
  });

  it("gives every text column a text that fits it, in every language", () => {
    const tables = new Map(manifest.requiredSchema.tables.map((t) => [t.ref, t]));
    for (const { ref, rows } of bundle.tables) {
      for (const row of rows) {
        for (const [column, value] of Object.entries(row)) {
          const max = (tables.get(ref)?.columns.find((c) => c.ref === column) as { maxLength?: number } | undefined)?.maxLength;
          if (max === undefined) continue;
          const texts = typeof value === "string" ? [value] : typeof value === "object" && value !== null && "@t" in value ? Object.values((value as { "@t": Record<string, string> })["@t"]) : [];
          for (const text of texts) expect(text.length, `${ref}.${column}: ${text}`).toBeLessThanOrEqual(max);
        }
      }
    }
  });
});

describe("every value passes the checks a person's write would meet", () => {
  // Adminium's column checks (`crud/column-rules.ts`): an admin's format, range and list, and an enum's values.
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE = /^\+?\(?[0-9][0-9\s().-]{4,}$/;
  type Rules = { validation?: { format?: string; min?: number; max?: number; minLength?: number; maxLength?: number }; options?: { values: { value: string }[] } };

  it.each(["en-US", "ar-EG"])("resolved for %s", (locale) => {
    const rows = resolveSample(bundle, { now: SAMPLE_MOMENT, zone: SAMPLE_ZONE, locale });
    const problems: string[] = [];
    for (const table of manifest.requiredSchema.tables) {
      for (const row of rows[table.ref] ?? []) {
        for (const column of table.columns) {
          const value = row[column.ref];
          const at = `${table.ref} ${String(row["id"])}.${column.ref} = ${JSON.stringify(value)}`;
          if (value === null || value === undefined) {
            if (column.nullable !== true && column.role !== "pk") problems.push(`${at}: may not be empty`);
            continue;
          }
          const rules = (column.rules ?? {}) as Rules;
          const text = String(value).trim();
          const v = rules.validation;
          if (v?.minLength !== undefined && text.length < v.minLength) problems.push(`${at}: too short`);
          if (v?.maxLength !== undefined && text.length > v.maxLength) problems.push(`${at}: too long`);
          if (v?.format === "email" && !EMAIL.test(text)) problems.push(`${at}: not an email`);
          if (v?.format === "phone" && !PHONE.test(text)) problems.push(`${at}: not a phone number`);
          if (v?.format === "url" && !URL.canParse(text)) problems.push(`${at}: not a link`);
          if (v?.min !== undefined && Number(value) < v.min) problems.push(`${at}: below ${String(v.min)}`);
          if (v?.max !== undefined && Number(value) > v.max) problems.push(`${at}: above ${String(v.max)}`);
          if (rules.options !== undefined && !rules.options.values.some((o) => o.value === String(value))) problems.push(`${at}: not an offered choice`);
          if (column.enum !== undefined && !column.enum.includes(String(value))) problems.push(`${at}: not one of ${column.enum.join(", ")}`);
          if (column.maxLength !== undefined && String(value).length > column.maxLength) problems.push(`${at}: longer than ${String(column.maxLength)}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("the in-browser resolver knows the manifest's columns and rules", () => {
  const tables = new Map(manifest.requiredSchema.tables.map((t) => [t.ref, t]));

  it("fills every column the way the database does — `npm run sample` writes the list", () => {
    const expected = Object.fromEntries(
      manifest.requiredSchema.tables.map((t) => [
        t.ref,
        Object.fromEntries(
          t.columns
            .filter((c) => c.role !== "pk")
            .map((c) => [c.ref, c.default === "now" ? "now" : c.default !== undefined ? c.default : c.nullable === true ? null : "required"]),
        ),
      ]),
    );
    const actual = Object.fromEntries(
      Object.entries(COLUMNS).map(([table, columns]) => [
        table,
        Object.fromEntries(Object.entries(columns).map(([c, fill]) => [c, typeof fill === "symbol" ? (fill.description === "now" ? "now" : "required") : fill])),
      ]),
    );
    expect(actual).toEqual(expected);
  });

  it("copies and settles what the manifest says it does", () => {
    const visits = tables.get("appointments")!;
    const rules = (column: string, table = visits) => table.columns.find((c) => c.ref === column)?.rules ?? {};
    for (const copy of COPIES) {
      const table = tables.get(copy.table)!;
      expect(rules(copy.column, table)["copy"], `${copy.table}.${copy.column}`).toEqual({ via: copy.via, from: copy.from, ...(copy.always ? { mode: "always" } : {}) });
      expect(table.columns.find((c) => c.ref === copy.via)?.references, `${copy.table}.${copy.via}`).toBe(copy.to);
    }
    // Every copy the manifest declares is one the demo's loader makes too.
    const declared = [...tables.values()].flatMap((t) => t.columns.filter((c) => c.rules?.["copy"] !== undefined).map((c) => `${t.ref}.${c.ref}`));
    expect(declared.sort()).toEqual(COPIES.map((c) => `${c.table}.${c.column}`).sort());
    expect(rules("paid")["rollup"]).toMatchObject({
      from: ROLLUPS.paid.from,
      via: ROLLUPS.paid.via,
      sum: ROLLUPS.paid.sum,
      where: { column: ROLLUPS.paid.unless, eq: false },
      balance: { column: "balance", of: ROLLUPS.balance.of, minus: ["waived"] },
    });
    expect(rules("waived")["rollup"]).toMatchObject({ from: ROLLUPS.waived.from, via: ROLLUPS.waived.via, sum: ROLLUPS.waived.sum });
  });
});

// ── the practice could exist ────────────────────────────────────────────────

const COUNTED = new Set(["booked", "checked_in", "roomed", "with_clinician", "ready", "seen"]);
const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Every status a row can take, whichever way its clock falls. */
function statusesOf(row: SampleRow): string[] {
  const clock = row["@byClock"] as Record<string, Record<string, unknown>> | undefined;
  if (clock === undefined) return [String(row["status"] ?? "booked")];
  return (["before", "around", "after"] as const).map((branch) => String(clock[branch]?.["status"] ?? row["status"] ?? "booked"));
}

describe("every visit fits the booking rule, as the desk could have booked it", () => {
  const types = new Map(rowsOf("visit_types").map((row) => [row["@label"], Number(row["minutes"])]));
  const does = new Set(rowsOf("clinician_visit_types").map((row) => `${labelOf(row["clinician_id"])}|${labelOf(row["visit_type_id"])}`));
  const practice = new Map(rowsOf("opening_hours").map((row) => [row["weekday"], row]));
  const own = new Map(rowsOf("clinician_hours").map((row) => [`${labelOf(row["clinician_id"])}|${row["weekday"]}`, row]));
  const visits = rowsOf("appointments").map((row) => {
    const start = row["starts_at"] as Wall;
    const length = types.get(labelOf(row["visit_type_id"]))!;
    return {
      row,
      name: String(row["@label"]),
      clinician: labelOf(row["clinician_id"])!,
      patient: labelOf(row["patient_id"]),
      type: labelOf(row["visit_type_id"])!,
      day: start["@day"],
      workdays: start["@workdays"] === true,
      from: minutes(start["@time"]),
      to: minutes(start["@time"]) + length,
      holds: statusesOf(row).some((status) => COUNTED.has(status)),
    };
  });

  it("dates every visit on a working day", () => {
    for (const v of visits) expect(v.workdays, v.name).toBe(true);
  });

  it("books each clinician only for a visit they do", () => {
    for (const v of visits) expect(does.has(`${v.clinician}|${v.type}`), v.name).toBe(true);
  });

  it("starts every visit on the practice's 15-minute grid", () => {
    const grid = Number(rowsOf("settings")[0]!["slot_minutes"]);
    for (const v of visits) expect(v.from % grid, v.name).toBe(0);
  });

  it("keeps every visit inside its clinician's hours and off the break, on whichever weekday it lands", () => {
    for (const v of visits.filter((visit) => visit.holds)) {
      for (const weekday of WEEKDAYS) {
        const hours = own.get(`${v.clinician}|${weekday}`) ?? practice.get(weekday)!;
        expect(practice.get(weekday)!["open"], weekday).toBe(true);
        expect(v.from >= minutes(String(hours["opens"])) && v.to <= minutes(String(hours["closes"])), `${v.name} on ${weekday}`).toBe(true);
        if (hours["break_start"] !== null) {
          const clear = v.to <= minutes(String(hours["break_start"])) || v.from >= minutes(String(hours["break_end"]));
          expect(clear, `${v.name} over the break on ${weekday}`).toBe(true);
        }
      }
    }
  });

  it("never books a clinician, or a patient, twice at once", () => {
    const holding = visits.filter((v) => v.holds);
    for (const [i, a] of holding.entries()) {
      for (const b of holding.slice(i + 1)) {
        if (a.day !== b.day || a.to <= b.from || b.to <= a.from) continue;
        expect(a.clinician === b.clinician, `${a.name} and ${b.name} share ${a.clinician}`).toBe(false);
        expect(a.patient !== null && a.patient === b.patient, `${a.name} and ${b.name} are one patient`).toBe(false);
      }
    }
  });

  it("books nobody on a day their clinician or the practice is closed", () => {
    for (const closure of rowsOf("closures")) {
      const from = (closure["from_date"] as Wall)["@day"];
      const to = (closure["to_date"] as Wall)["@day"];
      const who = labelOf(closure["clinician_id"]);
      for (const v of visits.filter((visit) => visit.holds && visit.day >= from && visit.day <= to)) {
        expect(who !== null && who !== v.clinician, `${v.name} falls in ${String(closure["@label"])}`).toBe(false);
      }
    }
  });

  it("gives new-patient visits only to patients with no earlier visit", () => {
    const newOnly = new Set(rowsOf("visit_types").filter((row) => row["new_patients_only"] === true).map((row) => row["@label"]));
    for (const v of visits.filter((visit) => newOnly.has(visit.type) && visit.patient !== null)) {
      const earlier = visits.filter((o) => o.patient === v.patient && (o.day < v.day || (o.day === v.day && o.from < v.from)));
      expect(earlier.map((o) => o.name), v.name).toEqual([]);
    }
  });
});

describe("nothing in the sample can reach a real person", () => {
  /** RFC 2606 / 6761, as Adminium's sender reads them: those addresses are never mailed. */
  const reserved = (address: string) => {
    const labels = address.toLowerCase().split("@").pop()!.split(".");
    return labels[0] === "example" || ["test", "invalid", "localhost", "example"].includes(labels[labels.length - 1]!);
  };

  it("puts every email address on a reserved domain", () => {
    const found: string[] = [];
    const visit = (value: unknown) => {
      if (typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) found.push(value);
      else if (typeof value === "object" && value !== null) Object.values(value).forEach(visit);
    };
    visit(bundle.tables);
    expect(found.length).toBeGreaterThan(30);
    expect(found.filter((address) => !reserved(address))).toEqual([]);
  });

  it("queues no message: only what was sent, and one reminder that failed", () => {
    const messages = rowsOf("messages");
    expect(messages.filter((m) => m["status"] !== "sent" && m["status"] !== "failed")).toEqual([]);
    expect(messages.filter((m) => m["status"] === "failed").map((m) => m["kind"])).toEqual(["reminder"]);
    expect(messages.filter((m) => m["status"] === "sent").length).toBeGreaterThanOrEqual(10);
  });
});

describe("the references are the practice's own, in a series of their own", () => {
  for (const [table, prefix] of [
    ["appointments", "RH-"],
    ["registrations", "RG-"],
  ] as const) {
    it(`${table}: ${prefix}S and three Crockford characters, as the code rule makes them`, () => {
      const rule = manifest.requiredSchema.tables.find((t) => t.ref === table)!.columns.find((c) => c.ref === "ref")!.rules!["code"];
      expect(rule).toEqual({ prefix, length: 4 });
      const refs = rowsOf(table).map((row) => String(row["ref"]));
      for (const value of refs) expect(value).toMatch(new RegExp(`^${prefix}S[0-9A-HJKMNP-TV-Z]{3}$`));
      expect(new Set(refs).size).toBe(refs.length);
    });
  }
});

// ── resolved, at many moments ───────────────────────────────────────────────

/** London wall time → epoch ms (summer: UTC+1; January: UTC). */
const london = (date: string, time: string) => Date.parse(`${date}T${time}:00${date.slice(5, 7) >= "04" && date.slice(5, 7) <= "10" ? "+01:00" : "Z"}`);
const MOMENTS: [string, number][] = [
  ["Tuesday before opening", london("2026-07-28", "07:10")],
  ["the demo moment", SAMPLE_MOMENT],
  ["Tuesday lunch", london("2026-07-28", "12:50")],
  ["Tuesday after closing", london("2026-07-28", "18:30")],
  ["a Saturday", london("2026-08-01", "10:05")],
  ["a Sunday night", london("2026-08-02", "23:40")],
  ["a Monday in January", london("2027-01-11", "11:20")],
  ["a Friday in March", london("2027-03-12", "15:05")],
];
const PAST = ["created_at", "paid_at", "written_at", "sent_at", "handled_at", "cancelled_at", "checked_in_at", "roomed_at", "seen_at", "closed_at"];

describe.each(MOMENTS)("added %s", (_, now) => {
  const rows: ResolvedSample = resolveSample(bundle, { now, zone: SAMPLE_ZONE, locale: "en-US" });
  const at = (value: unknown) => Date.parse(String(value));
  const visitOf = (id: unknown) => rows["appointments"]!.find((v) => v["id"] === id)!;

  it("dates nothing that has happened after the moment it is added", () => {
    for (const [table, list] of Object.entries(rows)) {
      for (const row of list) {
        for (const column of PAST) {
          if (row[column] === undefined || row[column] === null) continue;
          expect(at(row[column]) <= now, `${table} ${String(row["id"])}.${column} = ${String(row[column])}`).toBe(true);
        }
      }
    }
  });

  it("gives every status the stamps it implies, in order", () => {
    for (const v of rows["appointments"]!) {
      const status = String(v["status"]);
      const inBuilding = ["checked_in", "roomed", "with_clinician", "ready", "seen"].includes(status);
      expect(v["checked_in_at"] !== null, `${String(v["ref"])} ${status}`).toBe(inBuilding);
      expect(v["roomed_at"] !== null, `${String(v["ref"])} ${status}`).toBe(inBuilding && status !== "checked_in");
      expect(v["seen_at"] !== null, `${String(v["ref"])} ${status}`).toBe(status === "seen");
      expect(v["cancelled_at"] !== null, `${String(v["ref"])} ${status}`).toBe(status === "cancelled");
      if (v["roomed_at"] !== null) expect(at(v["checked_in_at"]) <= at(v["roomed_at"])).toBe(true);
      if (v["seen_at"] !== null) expect(at(v["roomed_at"]) <= at(v["seen_at"])).toBe(true);
      if (status === "seen" || status === "no_show") expect(at(v["starts_at"]) < now, String(v["ref"])).toBe(true);
      if (status === "cancelled") expect(at(v["created_at"]) <= at(v["cancelled_at"]), String(v["ref"])).toBe(true);
      expect(at(v["created_at"]) <= at(v["starts_at"]), String(v["ref"])).toBe(true);
    }
  });

  it("books a patient's visits only after they joined", () => {
    const patients = new Map(rows["patients"]!.map((p) => [p["id"], p]));
    for (const v of rows["appointments"]!.filter((visit) => visit["patient_id"] !== null)) {
      expect(at(patients.get(v["patient_id"])!["created_at"]) <= at(v["created_at"]), String(v["ref"])).toBe(true);
    }
  });

  it("takes money only for visits that are over, and never more than the fee", () => {
    for (const p of rows["payments"]!) expect(visitOf(p["appointment_id"])["status"], `payment ${String(p["id"])}`).toBe("seen");
    for (const w of rows["write_offs"]!) expect(visitOf(w["appointment_id"])["status"]).toBe("seen");
    for (const v of rows["appointments"]!) {
      expect(typeof v["fee"], String(v["ref"])).toBe("number");
      expect(Number(v["fee"]) - Number(v["waived"]) - Number(v["paid"]), String(v["ref"])).toBe(v["balance"]);
      expect(Number(v["balance"]) >= 0, `${String(v["ref"])} is overpaid`).toBe(true);
    }
  });

  it("puts every visit, closure and close-of-day on a working day", () => {
    const weekend = (iso: string) => [0, 6].includes(new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay());
    const localDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: SAMPLE_ZONE }).format(new Date(iso));
    for (const v of rows["appointments"]!) expect(weekend(localDay(String(v["starts_at"]))), String(v["ref"])).toBe(false);
    for (const c of rows["closures"]!) expect(weekend(String(c["from_date"])) || weekend(String(c["to_date"]))).toBe(false);
    const today = localDay(new Date(now).toISOString());
    expect(String(rows["day_closes"]![0]!["day"]) < today).toBe(true);
  });
});

describe("the Overview has something in every card at the demo moment", () => {
  const rows = resolveSample(bundle, { now: SAMPLE_MOMENT, zone: SAMPLE_ZONE, locale: "en-US" });
  const visits = rows["appointments"]!;
  const DAY = 86_400_000;
  const today = "2026-07-28";
  const onDay = (v: Record<string, unknown>) => new Intl.DateTimeFormat("en-CA", { timeZone: SAMPLE_ZONE }).format(new Date(String(v["starts_at"])));

  it("shows today's day across the statuses, with someone who has not arrived", () => {
    const statuses = new Set(visits.filter((v) => onDay(v) === today).map((v) => v["status"]));
    for (const status of ["seen", "checked_in", "roomed", "with_clinician", "ready", "booked", "cancelled"]) expect(statuses).toContain(status);
    expect(visits.filter((v) => onDay(v) === today && v["status"] !== "cancelled")).toHaveLength(19);
    const late = visits.filter((v) => v["status"] === "booked" && Date.parse(String(v["starts_at"])) + 15 * 60_000 < SAMPLE_MOMENT);
    expect(late.length).toBeGreaterThanOrEqual(1);
  });

  it("has money owed at every age, and money taken today by more than one method", () => {
    const owed = visits.filter((v) => v["status"] === "seen" && Number(v["balance"]) > 0).map((v) => (SAMPLE_MOMENT - Date.parse(String(v["starts_at"]))) / DAY);
    expect(owed.some((d) => d <= 7)).toBe(true);
    expect(owed.some((d) => d > 7 && d <= 28)).toBe(true);
    expect(owed.some((d) => d > 28 && d <= 41)).toBe(true);
    const methods = new Set(rows["payments"]!.filter((p) => String(p["paid_at"]).startsWith(today)).map((p) => p["method"]));
    expect(methods.size).toBeGreaterThanOrEqual(2);
    expect(rows["payments"]!.filter((p) => p["voided"] === true)).toHaveLength(1);
    expect(rows["write_offs"]!.length).toBeGreaterThanOrEqual(1);
  });

  it("leaves work waiting on the desk", () => {
    expect(rows["registrations"]!.filter((r) => r["status"] === "new")).toHaveLength(2);
    expect(visits.filter((v) => v["check_status"] === "to_check")).toHaveLength(1);
    const overdue = rows["recalls"]!.filter((r) => ["due", "noted"].includes(String(r["status"])) && String(r["due_on"]) < today);
    expect(overdue.length).toBeGreaterThanOrEqual(3);
    expect(rows["recalls"]).toHaveLength(12);
    expect(rows["waiting_list"]).toHaveLength(5);
    expect(rows["closures"]).toHaveLength(3);
  });

  it("has this week's cancellations, a late one among them, and visits booked every way", () => {
    const week = visits.filter((v) => onDay(v) >= "2026-07-27" && onDay(v) <= "2026-08-02");
    const cancelled = week.filter((v) => v["status"] === "cancelled");
    expect(cancelled.length).toBeGreaterThanOrEqual(3);
    expect(cancelled.some((v) => v["late_cancel"] === true)).toBe(true);
    expect(new Set(week.map((v) => v["channel"])).size).toBeGreaterThanOrEqual(5);
  });

  it("has patients who joined this month", () => {
    expect(rows["patients"]!.filter((p) => String(p["created_at"]) >= "2026-07-01").length).toBeGreaterThanOrEqual(3);
    expect(rows["patients"]!.filter((p) => p["allergies_note"] !== null).length).toBeGreaterThanOrEqual(5);
  });

  it("closes yesterday with the cash yesterday took", () => {
    const close = rows["day_closes"]![0]!;
    expect(close["day"]).toBe("2026-07-27");
    const cash = rows["payments"]!.filter((p) => p["method"] === "cash" && p["voided"] !== true && String(p["paid_at"]).startsWith("2026-07-27"));
    expect(close["cash_expected"]).toBe(cash.reduce((sum, p) => sum + Number(p["amount"]), 0));
  });
});
