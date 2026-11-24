/**
 * Visit texts on the demo's practice keep the real doors' rules: a yes from
 * the box with nobody on file only while the practice sends texts, a yes or a
 * no in Prefs only once verified; and the demo's reminder scan texts only the
 * patients whose last word for the number on file is a yes.
 */
import { beforeEach, describe, expect, it } from "vitest";

import bundle from "../../seeds/clinic.sample.json";
import { DEMO_FILLS } from "../data/demo.ts";
import { PortError, type PatientsPort } from "../data/ports.ts";
import { resolveSample } from "../data/sampleRows.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { ownTextState } from "../lib/texts.ts";
import { createDemoDb, scanReminders, type DemoDb } from "./db.ts";
import { DEMO_CODE, demoPatientsPort } from "./ports.ts";
import { demoTexts } from "./texts.ts";

let db: DemoDb;
let port: PatientsPort;

beforeEach(() => {
  const rows = resolveSample(bundle as never, { now: DEMO_START, zone: DEMO_ZONE, locale: "en-US" });
  db = createDemoDb(rows as never, () => DEMO_START, DEMO_ZONE);
  port = demoPatientsPort(db);
});

const refusal = async (run: Promise<unknown>) => {
  const error = await run.then(() => null, (e: unknown) => e);
  return error instanceof PortError ? error.code : String(error);
};

describe("the sample practice", () => {
  it("sends no texts and holds no answers until it is turned on: no yes exists that Adminium never heard", () => {
    expect(db.rows.settings[0]).toMatchObject({ texts_on: false, text_name: "Rowan Health" });
    expect(db.rows.text_answers).toEqual([]);
  });
});

describe("the box with nobody on file", () => {
  it("takes a yes only while the practice sends texts", async () => {
    expect(await refusal(port.textYes({ mobile: "07700 900301", source: "booking", name: "Lea Novak", aboutRef: "RH-0001" }))).toBe("PUBLIC_SWITCHED_OFF");
    demoTexts(db);
    const before = db.rows.text_answers.length;
    await port.textYes({ mobile: "07700 900301", source: "booking", name: "Lea Novak", aboutRef: "RH-0001" });
    expect(db.rows.text_answers.length).toBe(before + 1);
    expect(db.rows.text_answers.at(-1)).toMatchObject({ patient_id: null, mobile: "07700 900301", texts_ok: true, texts_off: false, source: "booking", about_ref: "RH-0001" });
  });
});

describe("Remind me by text, in Prefs", () => {
  it("needs the emailed code, then keeps their yes and their no as their own", async () => {
    demoTexts(db);
    expect(await refusal(port.textNo(DEMO_FILLS.returning.mobile))).toBe("PUBLIC_CLAIM_REQUIRED");
    await port.find(DEMO_FILLS.returning.mobile, DEMO_FILLS.returning.bornOn);
    expect(await refusal(port.myTextAnswers())).toBe("PUBLIC_CLAIM_LEVEL");
    await port.requestCode({ purpose: "verify" });
    await port.verifyCode(DEMO_CODE);
    // Cormac has never answered: off, and nothing to say about it.
    expect(ownTextState(await port.myTextAnswers())).toBe("none");
    await port.textYes({ mobile: DEMO_FILLS.returning.mobile, source: "prefs" });
    expect(ownTextState(await port.myTextAnswers())).toBe("on");
    await port.textNo(DEMO_FILLS.returning.mobile);
    expect(ownTextState(await port.myTextAnswers())).toBe("stopped");
    expect(db.rows.text_answers.filter((a) => a.source === "prefs" && a.mobile === DEMO_FILLS.returning.mobile).map((a) => [a.texts_ok, a.texts_off])).toEqual([
      [true, false],
      [false, true],
    ]);
  });
});

describe("the demo's reminder scan", () => {
  it("texts the patients who said yes, and nobody who said no or never said", () => {
    demoTexts(db);
    scanReminders(db);
    const texted = new Set(db.rows.messages.filter((m) => m.kind === "reminder_text").map((m) => db.rows.patients.find((p) => p.id === m.patient_id)?.name));
    expect(texted.has("Solveig Rasmussen")).toBe(false);
    expect(texted.has("Saoirse Whelan")).toBe(false);
    for (const m of db.rows.messages.filter((x) => x.kind === "reminder_text")) {
      const p = db.rows.patients.find((x) => x.id === m.patient_id)!;
      expect([p.name, m.to_address, m.status]).toEqual([p.name, p.mobile, "sent"]);
      expect(["Ewan Pryce", "Nour Khalil"]).toContain(p.name);
    }
    // Ewan and Nour are both in today's sample day, within a day's lead.
    expect(texted.size).toBeGreaterThan(0);
  });
});
