/**
 * The in-browser resolver gives the answers Adminium's loader gives.
 *
 * The small bundles below are the loader's own worked examples (Adminium's
 * `app-install-pipeline.test.ts`, the sample-by-the-clock scenario): the same
 * rows at the same moments must come out with the same statuses, days,
 * payments and totals. The rest reads the shipped sample at the moment the
 * design is drawn, the way the website's demo will.
 */
import { describe, expect, it } from "vitest";

import { SAMPLE_MOMENT, SAMPLE_ZONE, buildSample, type SampleBundle } from "./sample.ts";
import { pickText, resolveSample } from "./sampleRows.ts";

const LONDON = "Europe/London";
const day0 = (time: string) => ({ "@day": 0, "@time": time, "@workdays": true });

/** Three visits of today, a payment for two of them, and a closure tomorrow. */
function byClockBundle(): SampleBundle {
  const clock = { at: "starts_at", before: { status: "seen" }, around: { status: "checked_in" }, after: { status: "booked" } };
  const paidIf = (time: string) => ({ at: day0(time), before: {}, around: { "@skip": true }, after: { "@skip": true } });
  return {
    format: "adminium.sample/1",
    app: "clinic",
    assets: {},
    tables: [
      { ref: "clinicians", rows: [{ "@label": "ada", name: "Ada", short_name: "Ada", role_label: "GP", position: 1 }] },
      { ref: "visit_types", rows: [{ "@label": "routine", name: "Routine", short_name: "Routine", minutes: 15, fee: 40 }] },
      {
        ref: "appointments",
        rows: ["09:00", "10:00", "15:00"].map((time) => ({
          "@label": `v${time.slice(0, 2)}`,
          ref: `RH-S0${time.slice(0, 2)}`,
          clinician_id: { "@ref": "ada" },
          visit_type_id: { "@ref": "routine" },
          starts_at: day0(time),
          // The length is always the visit type's, whatever a row says.
          minutes: 99,
          "@byClock": clock,
        })),
      },
      {
        ref: "payments",
        rows: [
          { appointment_id: { "@ref": "v09" }, amount: 40, "@byClock": paidIf("09:00") },
          { appointment_id: { "@ref": "v15" }, amount: 40, "@byClock": paidIf("15:00") },
        ],
      },
      {
        ref: "closures",
        rows: [{ from_date: { "@day": 1, "@workdays": true }, to_date: { "@day": 1, "@workdays": true }, label: "Away" }],
      },
    ],
  };
}

describe("the loader's own example", () => {
  it("at Tuesday 28 July 2026, 10:05 in London: 09:00 is over, 10:00 is now, 15:00 is to come", () => {
    const rows = resolveSample(byClockBundle(), { now: Date.UTC(2026, 6, 28, 9, 5), zone: LONDON, locale: "en-US" });
    expect(rows["appointments"]!.map((v) => [v["starts_at"], v["status"], v["minutes"], v["paid"], v["balance"]])).toEqual([
      ["2026-07-28T08:00:00.000Z", "seen", 15, 40, 0],
      ["2026-07-28T09:00:00.000Z", "checked_in", 15, 0, 40],
      ["2026-07-28T14:00:00.000Z", "booked", 15, 0, 40],
    ]);
    // The 15:00 payment was left out, and takes no id: that visit has not happened yet.
    expect(rows["payments"]!.map((p) => [p["id"], p["appointment_id"]])).toEqual([[1, 1]]);
    // A date is the venue's day: tomorrow, a working day.
    expect(rows["closures"]![0]!["from_date"]).toBe("2026-07-29");
  });

  it("added on a Saturday, 'today' is Monday and tomorrow Tuesday; nothing has happened yet", () => {
    const rows = resolveSample(byClockBundle(), { now: Date.UTC(2026, 7, 1, 9, 5), zone: LONDON, locale: "en-US" });
    expect(rows["appointments"]!.map((v) => [v["starts_at"], v["status"]])).toEqual([
      ["2026-08-03T08:00:00.000Z", "booked"],
      ["2026-08-03T09:00:00.000Z", "booked"],
      ["2026-08-03T14:00:00.000Z", "booked"],
    ]);
    expect(rows["closures"]![0]!["from_date"]).toBe("2026-08-04");
    expect(rows["payments"]).toEqual([]);
  });

  it("fills what the database fills: defaults, the adding moment, nulls", () => {
    const now = Date.UTC(2026, 6, 28, 9, 5);
    const rows = resolveSample(byClockBundle(), { now, zone: LONDON, locale: "en-US" });
    expect(rows["clinicians"]![0]).toMatchObject({ id: 1, color: "#0369a1", active: true, bookable_online: true, photo: null, bio: null });
    expect(rows["closures"]![0]).toMatchObject({ clinician_id: null, active: true, created_at: new Date(now).toISOString() });
    expect(rows["payments"]![0]).toMatchObject({ method: "card", voided: false, paid_at: new Date(now).toISOString() });
    expect(rows["appointments"]![0]).toMatchObject({ fee: 40, waived: 0, channel: "desk", late_cancel: false, patient_id: null });
  });
});

describe("the venue's clock, not the reader's", () => {
  const one = (starts_at: Record<string, unknown>, extra: Record<string, number> = {}): SampleBundle => ({
    format: "adminium.sample/1",
    app: "clinic",
    assets: {},
    tables: [
      { ref: "visit_types", rows: [{ "@label": "routine", name: "Routine", short_name: "Routine", fee: 40 }] },
      { ref: "appointments", rows: [{ ref: "RH-S001", visit_type_id: { "@ref": "routine" }, starts_at, ...extra }] },
      { ref: "day_closes", rows: [{ day: { "@day": 0 } }] },
    ],
  });

  it("puts a summer 09:00 at 08:00 UTC, and a winter one at 09:00", () => {
    const summer = resolveSample(one({ "@day": 0, "@time": "09:00" }), { now: Date.UTC(2026, 6, 28, 12), zone: LONDON, locale: "en-US" });
    expect(summer["appointments"]![0]!["starts_at"]).toBe("2026-07-28T08:00:00.000Z");
    const winter = resolveSample(one({ "@day": 0, "@time": "09:00" }), { now: Date.UTC(2027, 0, 12, 12), zone: LONDON, locale: "en-US" });
    expect(winter["appointments"]![0]!["starts_at"]).toBe("2027-01-12T09:00:00.000Z");
  });

  it("dates by the venue's day: 23:30 UTC on 28 July is already the 29th in London", () => {
    const rows = resolveSample(one({ "@day": 1, "@time": "09:00" }), { now: Date.UTC(2026, 6, 28, 23, 30), zone: LONDON, locale: "en-US" });
    expect(rows["day_closes"]![0]!["day"]).toBe("2026-07-29");
    expect(rows["appointments"]![0]!["starts_at"]).toBe("2026-07-30T08:00:00.000Z");
  });

  it("counts working days across a weekend, both ways", () => {
    const friday = Date.UTC(2026, 6, 31, 10);
    const next = resolveSample(one({ "@day": 1, "@time": "09:00", "@workdays": true }), { now: friday, zone: LONDON, locale: "en-US" });
    expect(next["appointments"]![0]!["starts_at"]).toBe("2026-08-03T08:00:00.000Z");
    const monday = Date.UTC(2026, 7, 3, 10);
    const before = resolveSample(one({ "@day": -1, "@time": "09:00", "@workdays": true }), { now: monday, zone: LONDON, locale: "en-US" });
    expect(before["appointments"]![0]!["starts_at"]).toBe("2026-07-31T08:00:00.000Z");
  });

  it("reads `@ago` back from the adding moment", () => {
    const now = Date.UTC(2026, 6, 28, 8, 20);
    const rows = resolveSample(one({ "@ago": "P1DT2H30M" }), { now, zone: LONDON, locale: "en-US" });
    expect(rows["appointments"]![0]!["starts_at"]).toBe(new Date(now - (26 * 60 + 30) * 60_000).toISOString());
  });

  it("keeps a fee the row names, and copies it only when the row has none", () => {
    const rows = resolveSample(one({ "@day": 0, "@time": "09:00" }, { fee: 0 }), { now: SAMPLE_MOMENT, zone: LONDON, locale: "en-US" });
    expect(rows["appointments"]![0]).toMatchObject({ fee: 0, minutes: 15, balance: 0 });
  });
});

describe("the reader's language", () => {
  const texts = { "en-US": "Routine check", "de-DE": "Routinekontrolle", "zh-CN": "常规检查", "zh-TW": "例行檢查" };

  it("takes the exact tag, then the same language, then US English", () => {
    expect(pickText(texts, "de-DE")).toBe("Routinekontrolle");
    expect(pickText(texts, "de_AT")).toBe("Routinekontrolle");
    expect(pickText(texts, "zh-TW")).toBe("例行檢查");
    expect(pickText(texts, "ja-JP")).toBe("Routine check");
  });
});

describe("the shipped sample, as the demo shows it: Tuesday 28 July 2026, 09:20", () => {
  const bundle = buildSample();
  const en = resolveSample(bundle, { now: SAMPLE_MOMENT, zone: SAMPLE_ZONE, locale: "en-US" });
  const patients = new Map(en["patients"]!.map((p) => [p["id"], p["name"]]));
  const visit = (name: string, time: string) =>
    en["appointments"]!.find(
      (v) => patients.get(v["patient_id"]) === name && new Date(String(v["starts_at"])).toLocaleTimeString("en-GB", { timeZone: SAMPLE_ZONE, hour: "2-digit", minute: "2-digit" }) === time,
    )!;

  it("follows the clock: 08:30 seen, 09:15 in with the doctor, 10:00 on booked", () => {
    expect(visit("Harriet Blythe", "08:30")).toMatchObject({ status: "seen", starts_at: "2026-07-28T07:30:00.000Z", paid: 45, balance: 0 });
    expect(visit("Beatriz Salgado", "09:15")).toMatchObject({ status: "with_clinician", checked_in_at: "2026-07-28T08:05:00.000Z" });
    expect(visit("Inés Varela", "09:30")).toMatchObject({ status: "checked_in" });
    expect(visit("Cormac Ellery", "09:00")).toMatchObject({ status: "roomed" });
    expect(visit("Tobias Lindqvist", "08:45")).toMatchObject({ status: "ready" });
    expect(visit("Saoirse Whelan", "10:00")).toMatchObject({ status: "booked", checked_in_at: null });
    // Delphine's 09:00 has not arrived: twenty minutes gone, still booked.
    expect(visit("Delphine Auclair", "09:00")).toMatchObject({ status: "booked" });
  });

  it("leaves out the payments of visits not over yet, and settles the rest", () => {
    const paidToday = en["payments"]!.filter((p) => String(p["paid_at"]).startsWith("2026-07-28"));
    expect(paidToday.map((p) => p["appointment_id"]).sort()).toEqual(
      en["appointments"]!.filter((v) => String(v["starts_at"]).startsWith("2026-07-28") && v["status"] === "seen").map((v) => v["id"]).sort(),
    );
    const evening = resolveSample(bundle, { now: Date.parse("2026-07-28T17:30:00Z"), zone: SAMPLE_ZONE, locale: "en-US" });
    expect(evening["payments"]!.length).toBeGreaterThan(en["payments"]!.length);
    // Beatriz paid part of hers; Priya's insurer has yet to.
    const owed = (rows: typeof en, name: string) => rows["appointments"]!.find((v) => v["status"] === "seen" && String(v["starts_at"]).startsWith("2026-07-28") && patients.get(v["patient_id"]) === name);
    expect(owed(evening, "Beatriz Salgado")).toMatchObject({ paid: 25, balance: 20 });
    expect(owed(evening, "Priya Raman")).toMatchObject({ paid: 0, balance: 45 });
  });

  it("settles part-payments, a voided payment and write-offs into the balance", () => {
    const on = (name: string, date: string) => en["appointments"]!.find((v) => patients.get(v["patient_id"]) === name && String(v["starts_at"]).startsWith(date))!;
    expect(on("Cormac Ellery", "2026-07-15")).toMatchObject({ fee: 60, paid: 38, waived: 0, balance: 22 });
    expect(on("Solveig Rasmussen", "2026-07-21")).toMatchObject({ fee: 45, paid: 45, balance: 0 });
    expect(on("Leila Farsi", "2026-07-20")).toMatchObject({ fee: 60, paid: 0, waived: 15, balance: 45 });
    expect(on("Martha Okonjo", "2026-07-14")).toMatchObject({ fee: 28, paid: 0, waived: 28, balance: 0 });
    expect(on("Héctor Salazar", "2026-06-18")).toMatchObject({ status: "seen", balance: 45 });
  });

  it("numbers each table from 1 and points every reference at a row that exists", () => {
    for (const [table, rows] of Object.entries(en)) expect(rows.map((r) => r["id"]), table).toEqual(rows.map((_, i) => i + 1));
    const ids = (table: string) => new Set(en[table]!.map((r) => r["id"]));
    for (const v of en["appointments"]!) {
      expect(ids("clinicians").has(v["clinician_id"])).toBe(true);
      expect(ids("visit_types").has(v["visit_type_id"])).toBe(true);
      if (v["patient_id"] !== null) expect(ids("patients").has(v["patient_id"])).toBe(true);
    }
    for (const p of en["payments"]!) expect(ids("appointments").has(p["appointment_id"])).toBe(true);
    for (const r of en["recalls"]!) if (r["booked_appointment_id"] !== null) expect(ids("appointments").has(r["booked_appointment_id"])).toBe(true);
  });

  it("speaks German to a German reader, and keeps names as they are", () => {
    const de = resolveSample(bundle, { now: SAMPLE_MOMENT, zone: SAMPLE_ZONE, locale: "de-DE" });
    expect(de["visit_types"]!.map((t) => t["name"])).toEqual(["Routinekontrolle", "Neupatient", "Physiotherapie", "Pflege – Verband oder Impfung"]);
    expect(de["clinicians"]!.map((c) => [c["name"], c["role_label"]])).toEqual([
      ["Dr Amara Osei", "Hausärztin"],
      ["Dr Piotr Nowak", "Hausarzt"],
      ["Nadia Haddad", "Physiotherapeutin"],
      ["Tom Villaseñor", "Pflegefachkraft"],
    ]);
    expect(de["settings"]![0]!["intro"]).toBe("Eine kleine Praxis am Rowan Walk mit ebenerdigem Eingang.");
    expect(de["faqs"]![1]!["answer"]).toContain("{phone}");
    // The same rows, in the same order, with the same ids: only the words change.
    expect(de["appointments"]!.map((v) => [v["id"], v["status"], v["balance"]])).toEqual(en["appointments"]!.map((v) => [v["id"], v["status"], v["balance"]]));
  });

  it("is today's practice whatever day it is added: a Saturday's today is Monday", () => {
    const saturday = resolveSample(bundle, { now: Date.parse("2026-08-01T09:00:00Z"), zone: SAMPLE_ZONE, locale: "en-US" });
    const monday = saturday["appointments"]!.filter((v) => String(v["starts_at"]).startsWith("2026-08-03"));
    expect(monday.filter((v) => v["status"] !== "cancelled")).toHaveLength(19);
    expect(new Set(monday.filter((v) => v["status"] !== "cancelled").map((v) => v["status"]))).toEqual(new Set(["booked"]));
    expect(saturday["payments"]!.filter((p) => String(p["paid_at"]) >= "2026-08-01")).toEqual([]);
  });
});
