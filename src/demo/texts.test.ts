/**
 * Visit texts on the demo's practice keep Adminium's rules: the box rides the
 * booking or the registration and its yes counts only while the practice
 * sends texts; Prefs needs the emailed code, and a verified person's fresh yes
 * replaces their own no but never lifts a STOP; the desk records a yes heard
 * in person; and the reminder scan texts only a number whose standing is yes.
 */
import { beforeEach, describe, expect, it } from "vitest";

import bundle from "../../seeds/clinic.sample.json";
import { DEMO_FILLS } from "../data/demo.ts";
import { PortError, type DeskReads, type PatientsPort } from "../data/ports.ts";
import { resolveSample } from "../data/sampleRows.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { createDemoDb, scanReminders, type DemoDb } from "./db.ts";
import { DEMO_CODE, demoDeskReads, demoPatientsPort } from "./ports.ts";
import { demoStanding, demoTexts } from "./texts.ts";

let db: DemoDb;
let port: PatientsPort;
let desk: DeskReads;

beforeEach(() => {
  const rows = resolveSample(bundle as never, { now: DEMO_START, zone: DEMO_ZONE, locale: "en-US" });
  db = createDemoDb(rows as never, () => DEMO_START, DEMO_ZONE);
  port = demoPatientsPort(db);
  desk = demoDeskReads(db);
});

const refusal = async (run: Promise<unknown>) => {
  const error = await run.then(() => null, (e: unknown) => e);
  return error instanceof PortError ? error.code : String(error);
};
const verify = async (mobile: string, bornOn: string) => {
  await port.find(mobile, bornOn);
  await port.requestCode({ purpose: "verify" });
  await port.verifyCode(DEMO_CODE);
};

describe("the sample practice", () => {
  it("sends no texts and ticks no box until it is turned on: no yes exists that Adminium never heard", async () => {
    expect(db.rows.settings[0]).toMatchObject({ texts_on: false, text_name: "Rowan Health" });
    expect(db.rows.patients.some((p) => p.remind_text || p.texts_off)).toBe(false);
    expect((await port.catalogue()).textsReady).toBe(false);
  });
});

describe("the box on a first booking", () => {
  it("rides the booking: its yes is kept for the number typed, only while the practice sends texts", async () => {
    const book = (mobile: string, at: string) =>
      port.book({ visit_type_id: 2, clinician_id: null, starts_at: at, reason: null, desk_note: null, language: "en-US", newPatient: { name: "Lea Novak", born_on: "1990-04-21", mobile, email: null, textsOk: true } });
    await book("07700 900301", "2026-07-29T08:30:00.000Z");
    expect(demoStanding(db, "07700 900301").service.state).toBe("not-asked");
    demoTexts(db);
    expect((await port.catalogue()).textsReady).toBe(true);
    await book("07700 900302", "2026-07-29T09:30:00.000Z");
    expect(db.rows.appointments.at(-1)).toMatchObject({ texts_ok: true, new_mobile: "07700 900302" });
    expect(demoStanding(db, "+44 7700 900302").service.state).toBe("yes");
  });
});

describe("Remind me by text, in Prefs", () => {
  it("needs the emailed code, then their own fresh yes replaces their own no", async () => {
    demoTexts(db);
    expect(await refusal(port.setTexts(false))).toBe("PUBLIC_CLAIM_REQUIRED");
    // Solveig switched texts off herself: off, and a fresh yes turns them on again.
    await verify("07700 900155", "1962-09-14");
    expect((await port.myTextStanding()).service.state).toBe("no");
    await port.setTexts(true);
    expect((await port.myTextStanding()).service.state).toBe("yes");
    await port.setTexts(false);
    expect((await port.myTextStanding()).service.state).toBe("no");
  });

  it("never lifts a STOP: only their START does, and the page says so", async () => {
    demoTexts(db);
    const saoirse = db.rows.patients.find((p) => p.name === "Saoirse Whelan")!;
    await verify(saoirse.mobile, saoirse.born_on);
    const standing = await port.myTextStanding();
    expect([standing.service.state, standing.stopped?.liftBy]).toEqual(["stopped", "start"]);
    await port.setTexts(true);
    expect((await port.myTextStanding()).service.state).toBe("stopped");
  });

  it("starts off for someone who never answered", async () => {
    demoTexts(db);
    await verify(DEMO_FILLS.returning.mobile, DEMO_FILLS.returning.bornOn);
    expect((await port.myTextStanding()).service.state).toBe("not-asked");
  });
});

describe("the desk's patient card", () => {
  it("records a yes heard in person, with the box's words, and a no; never over a STOP", async () => {
    demoTexts(db);
    const cormac = db.rows.patients.find((p) => p.name === DEMO_FILLS.returning.name)!;
    expect((await desk.textStanding(cormac.id))?.service.state).toBe("not-asked");
    const yes = await desk.recordText(cormac.id, { state: "yes", how: "in-person", wording: { text: "Text me reminders for my visits.", version: "v1 en-US" } });
    expect([yes?.service.state, yes?.service.answer?.source, yes?.service.answer?.how]).toEqual(["yes", "staff", "in-person"]);
    expect((await desk.recordText(cormac.id, { state: "no", how: "phone" }))?.service.state).toBe("no");
    const saoirse = db.rows.patients.find((p) => p.name === "Saoirse Whelan")!;
    expect((await desk.recordText(saoirse.id, { state: "yes", how: "in-person", wording: { text: "…", version: "v1 en-US" } }))?.service.state).toBe("stopped");
  });
});

describe("the demo's reminder scan", () => {
  it("texts the numbers whose standing is yes, and nobody who said no, stopped or never said", () => {
    demoTexts(db);
    scanReminders(db);
    const texted = db.rows.messages.filter((m) => m.kind === "reminder_text");
    for (const m of texted) {
      const p = db.rows.patients.find((x) => x.id === m.patient_id);
      expect(["Ewan Pryce", "Nour Khalil", undefined]).toContain(p?.name);
      expect([m.status, m.text_reason]).toEqual(["sent", "sent"]);
    }
    const names = new Set(texted.map((m) => db.rows.patients.find((x) => x.id === m.patient_id)?.name));
    expect(names.has("Solveig Rasmussen") || names.has("Saoirse Whelan")).toBe(false);
    expect(texted.length).toBeGreaterThan(0);
  });
});
