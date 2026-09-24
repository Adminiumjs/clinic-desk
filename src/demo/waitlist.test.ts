/**
 * Joining the earlier-time list on the demo's patients' pages keeps the
 * endpoint's rules: found people only, one waiting place each, and the
 * answer is where they stand among everyone waiting, oldest first.
 */
import { beforeEach, describe, expect, it } from "vitest";

import bundle from "../../seeds/clinic.sample.json";
import { DEMO_FILLS } from "../data/demo.ts";
import { PortError, type PatientsPort } from "../data/ports.ts";
import { resolveSample } from "../data/sampleRows.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { createDemoDb, type DemoDb } from "./db.ts";
import { demoPatientsPort, rankAmongWaiting } from "./ports.ts";

let db: DemoDb;
let port: PatientsPort;
let at = DEMO_START;

beforeEach(() => {
  at = DEMO_START;
  const rows = resolveSample(bundle as never, { now: DEMO_START, zone: DEMO_ZONE, locale: "en-US" });
  db = createDemoDb(rows as never, () => at, DEMO_ZONE);
  port = demoPatientsPort(db);
});

const wish = () => ({ visit_type_id: db.rows.visit_types[0]!.id, clinician_id: null, part_of_day: "mornings" as const });
const refusal = async (run: Promise<unknown>) => {
  const error = await run.then(() => null, (e: unknown) => e);
  return error instanceof PortError ? error.code : String(error);
};

describe("joining the earlier-time list", () => {
  it("refuses someone who has not been found", async () => {
    expect(await refusal(port.joinWaitlist(wish()))).toBe("PUBLIC_CLAIM_REQUIRED");
  });

  it("puts a found patient last on the list, as the server ranks it", async () => {
    const waiting = db.rows.waiting_list.filter((w) => w.status === "waiting").length;
    expect(await port.find(DEMO_FILLS.returning.mobile, DEMO_FILLS.returning.bornOn)).not.toBeNull();
    at += 60_000;
    const { rank } = await port.joinWaitlist(wish());
    expect(rank).toBe(waiting + 1);
    const row = db.rows.waiting_list.at(-1)!;
    expect(row).toMatchObject({ status: "waiting", channel: "online", part_of_day: "mornings", clinician_id: null });
    expect(db.rows.patients.find((p) => p.id === row.patient_id)?.name).toBe(DEMO_FILLS.returning.name);
  });

  it("holds one waiting place per person", async () => {
    await port.find(DEMO_FILLS.returning.mobile, DEMO_FILLS.returning.bornOn);
    await port.joinWaitlist(wish());
    const count = db.rows.waiting_list.length;
    expect(await refusal(port.joinWaitlist(wish()))).toBe("PUBLIC_LIMIT_REACHED");
    expect(db.rows.waiting_list.length).toBe(count);
  });

  it("lets them join again once their place is booked or removed", async () => {
    await port.find(DEMO_FILLS.returning.mobile, DEMO_FILLS.returning.bornOn);
    await port.joinWaitlist(wish());
    const mine = db.rows.waiting_list.at(-1)!;
    db.update("waiting_list", mine.id, { status: "removed" }, { origin: "desk", name: "Ivy" });
    await expect(port.joinWaitlist(wish())).resolves.toMatchObject({ rank: expect.any(Number) });
  });

  it("is refused while online booking is off", async () => {
    await port.find(DEMO_FILLS.returning.mobile, DEMO_FILLS.returning.bornOn);
    db.rows.settings[0]!.online_booking_on = false;
    expect(await refusal(port.joinWaitlist(wish()))).toBe("PUBLIC_SWITCHED_OFF");
  });
});

describe("rankAmongWaiting", () => {
  it("counts waiting entries made before it, and ties by key", () => {
    const row = (id: number, created: string, status: "waiting" | "booked" = "waiting") =>
      ({ id, patient_id: id, visit_type_id: 1, clinician_id: null, part_of_day: "any", status, channel: "desk", booked_appointment_id: null, note: null, created_at: created }) as const;
    const list = [row(1, "2026-07-20T09:00:00Z"), row(2, "2026-07-21T09:00:00Z", "booked"), row(3, "2026-07-22T09:00:00.000Z"), row(4, "2026-07-22T09:00:00Z")];
    expect(rankAmongWaiting(list, list[2]!)).toBe(2);
    expect(rankAmongWaiting(list, list[3]!)).toBe(3);
    expect(rankAmongWaiting(list, list[0]!)).toBe(1);
  });
});
