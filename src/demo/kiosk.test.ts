/**
 * The demo's kiosk keeps the kiosk key's rules, read from the same manifest
 * entries: today only, booked … ready, an hour's window with the visit's time
 * when it is too early, a begun visit never checked in twice, and the
 * practice's switch stopping everything.
 */
import { beforeEach, describe, expect, it } from "vitest";

import bundle from "../../seeds/clinic.sample.json";
import { DEMO_FILLS } from "../data/demo.ts";
import { runCheckIn, type KioskPort } from "../data/kiosk.ts";
import type { Appointment, AppointmentStatus, Id } from "../data/types.ts";
import { resolveSample } from "../data/sampleRows.ts";
import { addDays, venueDay, venueStamp } from "../data/venueTime.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { createDemoDb, type DemoDb } from "./db.ts";
import { KIOSK_BEGUN, KIOSK_SESSION_MS, KIOSK_VISIBLE, KIOSK_WINDOW_MINUTES, demoKioskPort } from "./kiosk.ts";

let db: DemoDb;
let port: KioskPort;
let at = DEMO_START;
const TODAY = venueDay(DEMO_START, DEMO_ZONE);
const who = DEMO_FILLS.returning;
let patientId: Id;
let nextId = 90_000;

/** Cormac's day, as each test lays it out: every visit of his replaced by these. */
function visits(...list: { day?: string; time: string; status: AppointmentStatus }[]): Appointment[] {
  const template = db.rows.appointments[0]!;
  db.rows.appointments = db.rows.appointments.filter((a) => a.patient_id !== patientId);
  const made = list.map((v) => ({
    ...template,
    id: (nextId += 1),
    patient_id: patientId,
    status: v.status,
    starts_at: new Date(venueStamp(v.day ?? TODAY, v.time, DEMO_ZONE)).toISOString(),
    clinician_id: db.rows.clinicians[0]!.id,
  }));
  db.rows.appointments.push(...made);
  return made;
}
const check = () => runCheckIn(port, { mobile: who.mobile, bornOn: who.bornOn }, () => at);
const kioskOn = (on: boolean) => {
  db.rows.settings[0]!.kiosk_on = on;
};

beforeEach(() => {
  at = DEMO_START; // 09:20 in London
  const rows = resolveSample(bundle as never, { now: DEMO_START, zone: DEMO_ZONE, locale: "en-US" });
  db = createDemoDb(rows as never, () => at, DEMO_ZONE);
  kioskOn(true);
  patientId = db.rows.patients.find((p) => p.mobile === who.mobile && p.born_on === who.bornOn)!.id;
  port = demoKioskPort(db, async () => undefined);
});

describe("the demo kiosk reads its rules from the manifest", () => {
  it("an hour's window, booked … ready, and the begun statuses", () => {
    expect(KIOSK_WINDOW_MINUTES).toBe(60);
    expect(KIOSK_VISIBLE).toEqual(["booked", "checked_in", "roomed", "with_clinician", "ready"]);
    expect(KIOSK_BEGUN).toEqual(["checked_in", "roomed", "with_clinician", "ready"]);
  });
});

describe("checking in at the demo's kiosk", () => {
  it("checks in a visit due within the hour, with its time and clinician", async () => {
    const [visit] = visits({ time: "10:00", status: "booked" });
    const outcome = await check();
    expect(outcome).toEqual({ kind: "done", firstName: "Cormac", at: visit!.starts_at, clinician: db.rows.clinicians[0]!.short_name });
    expect(db.rows.appointments.find((a) => a.id === visit!.id)?.status).toBe("checked_in");
  });

  it("checks in a late arrival (the time has passed)", async () => {
    visits({ time: "09:00", status: "booked" });
    expect((await check()).kind).toBe("done");
  });

  it("more than an hour ahead: early, with the time and from when, and nothing changed", async () => {
    const [visit] = visits({ time: "10:30", status: "booked" });
    expect(await check()).toEqual({ kind: "early", at: visit!.starts_at, from: new Date(venueStamp(TODAY, "09:30", DEMO_ZONE)).toISOString() });
    expect(db.rows.appointments.find((a) => a.id === visit!.id)?.status).toBe("booked");
  });

  it("exactly an hour ahead is inside the window", async () => {
    visits({ time: "10:20", status: "booked" });
    expect((await check()).kind).toBe("done");
  });

  it("today only: tomorrow's visit is not found, and says no time", async () => {
    visits({ day: addDays(TODAY, 1), time: "09:30", status: "booked" });
    expect(await check()).toEqual({ kind: "notfound" });
  });

  it("already begun: says so, and never checks in twice", async () => {
    const [visit] = visits({ time: "09:30", status: "roomed" });
    expect(await check()).toEqual({ kind: "already" });
    expect(db.rows.appointments.find((a) => a.id === visit!.id)?.status).toBe("roomed");
  });

  it("cancelled or a no-show is outside the read: not found", async () => {
    visits({ time: "09:30", status: "cancelled" }, { time: "09:45", status: "no_show" });
    expect(await check()).toEqual({ kind: "notfound" });
  });

  it("a second visit today checks in after the first has begun", async () => {
    const [, later] = visits({ time: "08:30", status: "seen" }, { time: "10:00", status: "booked" });
    expect((await check()).kind).toBe("done");
    expect(db.rows.appointments.find((a) => a.id === later!.id)?.status).toBe("checked_in");
  });

  it("the wrong date of birth finds nobody", async () => {
    visits({ time: "10:00", status: "booked" });
    expect(await runCheckIn(port, { mobile: who.mobile, bornOn: "1968-10-03" }, () => at)).toEqual({ kind: "notfound" });
  });

  it("switched off: every door stops, before anything is read", async () => {
    visits({ time: "10:00", status: "booked" });
    kioskOn(false);
    expect(await check()).toEqual({ kind: "off" });
    await expect(port.probe()).rejects.toMatchObject({ stop: "off" });
    await expect(port.clinicians()).rejects.toMatchObject({ stop: "off" });
  });

  it("a found person is found for three minutes, then no longer", async () => {
    visits({ time: "10:00", status: "booked" });
    expect(await port.claim(who.mobile, who.bornOn)).toEqual({ name: who.name });
    expect(port.expiresAt()).toBe(at + KIOSK_SESSION_MS);
    expect(await port.visits()).toHaveLength(1);
    at += KIOSK_SESSION_MS;
    expect(port.expiresAt()).toBeNull();
    expect(await port.visits()).toEqual([]);
    await expect(port.checkIn(String(db.rows.appointments.at(-1)!.id))).rejects.toMatchObject({ stop: "missed" });
  });

  it("forgets the person after a check-in, so the next read sees nobody", async () => {
    visits({ time: "10:00", status: "booked" });
    await check();
    expect(port.expiresAt()).toBeNull();
    expect(await port.visits()).toEqual([]);
  });
});
