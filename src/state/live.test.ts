/**
 * Live updates against the demo practice: another desk (or a patient online)
 * writes straight into the database, the database announces each change the
 * way Adminium's stream does, and this desk's store must follow — by reading
 * the rows again, since the stream's own copy of a row has its personal
 * columns blanked.
 */
import { beforeEach, describe, expect, it } from "vitest";

import bundle from "../../seeds/clinic.sample.json";
import { resolveSample } from "../data/sampleRows.ts";
import { createDemoDb, type DemoDb } from "../demo/db.ts";
import { demoDeskReads } from "../demo/ports.ts";
import type { DeskReads } from "../data/ports.ts";
import type { Appointment, Id, TableRef } from "../data/types.ts";
import { DEMO_START, DEMO_ZONE, setClockSource, setZone } from "../lib/clock.ts";
import { ensureDays, loadDesk, setDeskReads, useDesk } from "./desk.ts";
import { applyFrame, flush, resync } from "./live.ts";

let db: DemoDb;
let reads: { ref: TableRef; ids: Id[] }[];
const other = { origin: "desk" as const, name: "Another desk" };

beforeEach(async () => {
  const rows = resolveSample(bundle as never, { now: DEMO_START, zone: DEMO_ZONE, locale: "en-US" });
  let seed = 11;
  db = createDemoDb(rows as never, () => DEMO_START, DEMO_ZONE, () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
  setZone(DEMO_ZONE);
  setClockSource(() => DEMO_START);
  const inner = demoDeskReads(db);
  reads = [];
  const counted: DeskReads = {
    ...inner,
    rows: (ref, ids) => {
      reads.push({ ref, ids: [...ids] });
      return inner.rows(ref, ids);
    },
  };
  setDeskReads(counted);
  await loadDesk();
  db.subscribe((table, change) => applyFrame({ table, kind: change.kind, id: change.id }));
});

const todays = (): Appointment[] => Object.values(useDesk.getState().visits).filter((v) => v.starts_at.startsWith("2026-07-28"));

describe("live updates in the store", () => {
  it("a check-in at another desk reaches this one, read again by its key", async () => {
    const visit = todays().find((v) => v.status === "booked")!;
    db.update("appointments", visit.id, { status: "checked_in" }, other);
    expect(useDesk.getState().visits[visit.id]!.status).toBe("booked");
    await flush();
    expect(useDesk.getState().visits[visit.id]!.status).toBe("checked_in");
    expect(useDesk.getState().visits[visit.id]!.checked_in_at).not.toBeNull();
    expect(reads).toEqual([{ ref: "appointments", ids: [visit.id] }]);
  });

  it("frames that arrive together are read together", async () => {
    const booked = todays().filter((v) => v.status === "booked").slice(0, 3);
    expect(booked).toHaveLength(3);
    for (const v of booked) db.update("appointments", v.id, { status: "no_show" }, other);
    await flush();
    expect(reads).toHaveLength(1);
    expect(reads[0]!.ids.sort()).toEqual(booked.map((v) => v.id).sort());
    for (const v of booked) expect(useDesk.getState().visits[v.id]!.status).toBe("no_show");
  });

  it("a payment taken at another desk moves its visit's balance here, though no frame names the visit", async () => {
    const owing = Object.values(useDesk.getState().visits).find((v) => v.status === "seen" && v.balance > 10)!;
    const before = owing.balance;
    const payment = db.insert("payments", { appointment_id: owing.id, amount: 10, method: "card" }, other);
    await flush();
    expect(useDesk.getState().payments[payment.id]).toBeDefined();
    expect(useDesk.getState().visits[owing.id]!.balance).toBe(before - 10);
  });

  it("a row the read no longer returns leaves the desk", async () => {
    const note = db.insert("check_notes", { registration_id: db.rows.registrations[0]!.id, note: "Rang, no answer" }, other);
    await flush();
    expect(useDesk.getState().notes[note.id]).toBeDefined();
    // Gone from the server without a delete frame reaching us (or no longer readable): the next read of it drops it.
    db.rows.check_notes.splice(db.rows.check_notes.findIndex((n) => n.id === note.id), 1);
    applyFrame({ table: "check_notes", kind: "record.update", id: note.id });
    await flush();
    expect(useDesk.getState().notes[note.id]).toBeUndefined();
  });

  it("a patient the desk does not hold is not read on their own frame", async () => {
    const stranger = db.rows.patients.find((p) => useDesk.getState().patients[p.id] === undefined);
    expect(stranger).toBeDefined();
    db.update("patients", stranger!.id, { remind_email: false }, other);
    await flush();
    expect(reads).toEqual([]);
    expect(useDesk.getState().patients[stranger!.id]).toBeUndefined();
  });

  it("a booking made on the patients' side brings its patient with it", async () => {
    const stranger = db.rows.patients.find((p) => useDesk.getState().patients[p.id] === undefined)!;
    const type = db.rows.visit_types[0]!;
    const clinician = db.rows.clinicians[0]!;
    const visit = db.insert(
      "appointments",
      { patient_id: stranger.id, visit_type_id: type.id, clinician_id: clinician.id, starts_at: "2026-07-29T15:00:00.000Z", channel: "online" },
      { origin: "patient", name: null },
    );
    await flush();
    expect(useDesk.getState().visits[visit.id]).toBeDefined();
    expect(useDesk.getState().patients[stranger.id]?.name).toBe(stranger.name);
  });

  it("after a reconnect the desk is read again, with the days that were open", async () => {
    await ensureDays("2026-07-30");
    const later = Object.values(useDesk.getState().visits).find((a) => a.starts_at.startsWith("2026-07-30"))!;
    // Changed while the connection was down: no frame will ever say so.
    db.rows.appointments.find((a) => a.id === later.id)!.desk_note = "moved while we were away";
    await resync();
    expect(useDesk.getState().daysRead["2026-07-30"]).toBe(true);
    expect(useDesk.getState().visits[later.id]!.desk_note).toBe("moved while we were away");
  });
});

