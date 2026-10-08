/**
 * A visit's supplies, through the desk's own actions, against the demo
 * practice and its shelf — the same rules a real install keeps on the lines (a
 * kit's item once a visit, who recorded it, a line closed once its visit is
 * seen), answered with the same codes.
 */
import { beforeEach, describe, expect, it } from "vitest";

import bundle from "../../seeds/clinic.sample.json";
import { resolveSample } from "../data/sampleRows.ts";
import { SinkError, type DataSink } from "../data/sink.ts";
import { FLU_LINES, SUPPLIES_VISIT } from "../data/sample-supplies.ts";
import type { Appointment, Id } from "../data/types.ts";
import { createDemoDb, type DemoDb } from "../demo/db.ts";
import { demoDeskReads, demoSink } from "../demo/ports.ts";
import { DEMO_FLU_BATCH, DEMO_FLU_KIT, DEMO_SUPPLIES_VISIT, demoSuppliesPort, seedDemoSupplies } from "../demo/supplies.ts";
import { DEMO_START, DEMO_ZONE, setClockSource, setZone } from "../lib/clock.ts";
import { actionKey } from "../lib/keys.ts";
import * as act from "./actions.ts";
import { ensureDays, loadDesk, setDeskReads, useDesk } from "./desk.ts";
import { venueDay } from "../data/venueTime.ts";
import { isFeatureOn, setConnectedAddOns } from "./features.ts";
import { SUPPLIES } from "../lib/features.ts";
import { SuppliesGone } from "../data/supplies.ts";
import { forgetSupplies, holdSupplies, loadSupplies, setSuppliesPort, suppliesChanged, useSupplies } from "./supplies.ts";
import { setSink } from "./writes.ts";

let db: DemoDb;
const TODAY = "2026-07-28";
const view = (visitId: Id) => useSupplies.getState().byVisit[visitId]!.view!;
const kit = () => ({ kitId: DEMO_FLU_KIT.id, lines: DEMO_FLU_KIT.lines.map(([itemId, qty]) => ({ itemId: itemId as Id, qty })) });

/** A sink that fails its `n`th write the way a dropped network does, once. */
function flaky(inner: DataSink, failOn: number): DataSink {
  let n = 0;
  const maybe = () => {
    n += 1;
    if (n === failOn) throw new SinkError("no answer", "offline", 0, "NETWORK");
  };
  return {
    insert: async (ref, values) => (maybe(), inner.insert(ref, values)),
    update: async (ref, id, patch) => (maybe(), inner.update(ref, id, patch)),
    remove: async (ref, id) => (maybe(), inner.remove(ref, id)),
  };
}

/** A visit of today, put where the test needs it. */
function visitAt(status: Appointment["status"]): Appointment {
  // With the nurse, whose kind of visit offers the two kits.
  const nurse = [...db.rows.visit_types].sort((a, b) => b.position - a.position)[0]!;
  const visit = db.rows.appointments.find((a) => a.status === "booked" && a.patient_id !== null && a.visit_type_id === nurse.id && a.starts_at >= TODAY)!;
  db.update("appointments", visit.id, { status }, { origin: "desk", name: "Demo" });
  return visit;
}

/** The desk reads today at boot; a visit of another day is read when its day is opened. */
const hold = async (visit: Appointment) => {
  await loadDesk();
  await ensureDays(venueDay(Date.parse(visit.starts_at), DEMO_ZONE));
  // As a screen does: the supplies are read, and kept current, while it shows them.
  holdSupplies(visit.id);
  await loadSupplies(visit.id);
};

beforeEach(async () => {
  const rows = resolveSample(bundle as never, { now: DEMO_START, zone: DEMO_ZONE, locale: "en-US" });
  db = createDemoDb(rows as never, () => DEMO_START, DEMO_ZONE, () => 0.42);
  setZone(DEMO_ZONE);
  setClockSource(() => DEMO_START);
  setDeskReads(demoDeskReads(db));
  setSink(demoSink(db, () => ({ origin: "desk", name: "Tom Villaseñor" })));
  setSuppliesPort(demoSuppliesPort(db));
  setConnectedAddOns({ inventory: { version: "", settings: {} } });
  forgetSupplies();
  useDesk.setState({ me: { name: "Tom Villaseñor", email: null, role: "manager", roleName: "Clinic manager", access: null } });
  await loadDesk();
});

describe("a kit", () => {
  it("adds one line for each thing in it, in its order, with what the shelf says of each", async () => {
    const visit = visitAt("with_clinician");
    await hold(visit);
    expect((await act.addKit({ visitId: visit.id, ...kit(), key: actionKey() })).ok).toBe(true);
    expect(view(visit.id).lines.map((shown) => [shown.name, shown.line.qty, shown.kitName])).toEqual([
      ["Flu vaccine, single dose", 1, "Flu vaccination"],
      ["Syringe 5 ml", 1, "Flu vaccination"],
      ["Needle 23G", 1, "Flu vaccination"],
      ["Alcohol swab", 2, "Flu vaccination"],
      ["Plaster strip", 1, "Flu vaccination"],
      ["Gloves, nitrile, M", 1, "Flu vaccination"],
    ]);
    // The vaccine: eight left and marked low; its batch proposed, expiring soon — and confirmed by nobody.
    const vaccine = view(visit.id).lines[0]!;
    expect([vaccine.left, vaccine.low, vaccine.batch, vaccine.proposals.map((batch) => batch.code), vaccine.expiresSoon]).toEqual([8, true, null, [DEMO_FLU_BATCH.code], true]);
    expect(db.rows.appointment_supplies.find((line) => line.id === vaccine.line.id)!.batch_id).toBeNull();
    // Who recorded it is stamped, never sent.
    expect(new Set(view(visit.id).lines.map((shown) => shown.line.recorded_by))).toEqual(new Set(["Tom Villaseñor"]));
    expect(view(visit.id).kits.find((offer) => offer.id === DEMO_FLU_KIT.id)).toMatchObject({ linked: true, added: true });
  });

  it("adds a kit once however often it is pressed: with the same key, and with a fresh one", async () => {
    const visit = visitAt("with_clinician");
    await hold(visit);
    const key = actionKey();
    for (const pressed of [key, key, actionKey()]) expect((await act.addKit({ visitId: visit.id, ...kit(), key: pressed })).ok).toBe(true);
    expect(db.rows.appointment_supplies.filter((line) => line.appointment_id === visit.id).length).toBe(DEMO_FLU_KIT.lines.length);
  });

  it("finishes a kit the network dropped half-way, with the same key, writing nothing twice", async () => {
    const visit = visitAt("with_clinician");
    await hold(visit);
    const key = actionKey();
    const whole = demoSink(db, () => ({ origin: "desk", name: "Tom Villaseñor" }));
    setSink(flaky(whole, 4));
    const first = await act.addKit({ visitId: visit.id, ...kit(), key });
    expect(first).toMatchObject({ ok: false, reason: "offline" });
    // The lines that were saved stay, and show.
    expect(view(visit.id).lines.length).toBe(3);
    setSink(whole);
    expect((await act.addKit({ visitId: visit.id, ...kit(), key })).ok).toBe(true);
    expect(view(visit.id).lines.map((shown) => shown.line.item_id)).toEqual(DEMO_FLU_KIT.lines.map(([itemId]) => itemId));
  });
});

describe("a line", () => {
  it("is marked not used and used again, counted up and down, given its batch, and — added by hand — removed", async () => {
    const visit = visitAt("ready");
    await hold(visit);
    await act.addKit({ visitId: visit.id, ...kit(), key: actionKey() });
    const [vaccine, , , swab, plaster] = view(visit.id).lines;
    expect((await act.setNotUsed({ visitId: visit.id, lineId: plaster!.line.id, notUsed: true })).ok).toBe(true);
    expect(view(visit.id).lines[4]).toMatchObject({ notUsed: true, expiresSoon: false });
    expect((await act.setNotUsed({ visitId: visit.id, lineId: plaster!.line.id, notUsed: false })).ok).toBe(true);
    expect(view(visit.id).lines[4]!.notUsed).toBe(false);
    expect((await act.setSupplyQty({ visitId: visit.id, lineId: swab!.line.id, qty: 3 })).ok).toBe(true);
    expect(view(visit.id).lines[3]!.line.qty).toBe(3);
    expect((await act.confirmBatch({ visitId: visit.id, lineId: vaccine!.line.id, batchId: DEMO_FLU_BATCH.id })).ok).toBe(true);
    expect([view(visit.id).lines[0]!.batch?.code, view(visit.id).lines[0]!.proposals]).toEqual([DEMO_FLU_BATCH.code, []]);
    // Each change is stamped with who made it.
    expect(db.rows.appointment_supplies.find((line) => line.id === swab!.line.id)!.changed_by).toBe("Tom Villaseñor");
    // By hand: one more of the same item is a line of its own, and can be taken off again.
    const extra = await act.addSupply({ visitId: visit.id, itemId: 4 as Id, key: actionKey() });
    expect(extra.ok && extra.value.kit_id).toBeNull();
    expect(view(visit.id).lines.length).toBe(7);
    expect((await act.removeSupply({ visitId: visit.id, lineId: (extra as { value: { id: Id } }).value.id })).ok).toBe(true);
    expect(view(visit.id).lines.length).toBe(6);
    // A kit's line is never removed: it is marked not used, so the list still says the kit was opened.
    expect((await act.removeSupply({ visitId: visit.id, lineId: plaster!.line.id })).ok).toBe(false);
    expect(view(visit.id).lines.length).toBe(6);
  });

  it("is closed once its visit is seen: no change, no not-used, no removal — and still an addition", async () => {
    const visit = visitAt("ready");
    await hold(visit);
    await act.addKit({ visitId: visit.id, ...kit(), key: actionKey() });
    await act.addSupply({ visitId: visit.id, itemId: 7 as Id, key: actionKey() });
    expect((await act.setStatus(visit.id, "seen")).ok).toBe(true);
    const lines = view(visit.id).lines;
    expect(await act.setSupplyQty({ visitId: visit.id, lineId: lines[3]!.line.id, qty: 5 })).toMatchObject({ ok: false, reason: "supplies-closed" });
    expect(await act.setNotUsed({ visitId: visit.id, lineId: lines[4]!.line.id, notUsed: true })).toMatchObject({ ok: false, reason: "supplies-closed" });
    expect(await act.confirmBatch({ visitId: visit.id, lineId: lines[0]!.line.id, batchId: DEMO_FLU_BATCH.id })).toMatchObject({ ok: false, reason: "supplies-closed" });
    expect(await act.removeSupply({ visitId: visit.id, lineId: lines[6]!.line.id })).toMatchObject({ ok: false, reason: "supplies-closed" });
    expect(view(visit.id).lines.map((shown) => [shown.line.qty, shown.notUsed])).toEqual(lines.map((shown) => [shown.line.qty, shown.notUsed]));
    expect((await act.addSupply({ visitId: visit.id, itemId: 8 as Id, key: actionKey() })).ok).toBe(true);
    // Taken back, the list opens again.
    expect((await act.setStatus(visit.id, "ready")).ok).toBe(true);
    expect((await act.setSupplyQty({ visitId: visit.id, lineId: lines[3]!.line.id, qty: 5 })).ok).toBe(true);
  });
});

describe("sending someone off", () => {
  it("keeps the payment and the recall when the seen step is refused for its supplies, and finishes on the next try with the same key", async () => {
    const visit = visitAt("ready");
    await hold(visit);
    const whole = demoSink(db, () => ({ origin: "desk", name: "Ivy Ferreira" }));
    let refuse = true;
    // The ledger cannot answer: the last step, and only that one, is refused.
    setSink({
      ...whole,
      update: async (ref, id, patch) => {
        if (refuse && ref === "appointments" && patch["status"] === "seen") throw new SinkError("The add-on cannot be asked now.", "refused", 409, "POSTING_REFUSED", null, { reason: "add-on-unavailable" });
        return whole.update(ref, id, patch);
      },
    });
    const key = actionKey();
    const input = { visitId: visit.id, payment: { amount: 10, method: "card" as const }, recallWeeks: 6, followUp: null, key };
    expect(await act.sendOff(input)).toMatchObject({ ok: false, reason: "supplies" });
    const held = () => [db.rows.payments.filter((p) => p.appointment_id === visit.id).length, db.rows.recalls.filter((r) => r.from_appointment_id === visit.id).length, db.rows.appointments.find((a) => a.id === visit.id)!.status];
    expect(held()).toEqual([1, 1, "ready"]);
    refuse = false;
    expect((await act.sendOff(input)).ok).toBe(true);
    expect(held()).toEqual([1, 1, "seen"]);
  });
});

describe("the demo's shelf", () => {
  it("shows the sample's flu jab as it was recorded: six lines, the vaccine from its batch, the plaster not used", async () => {
    const jab = db.rows.appointments.find((visit) => visit.ref === DEMO_SUPPLIES_VISIT)!;
    // The same visit the sample's own rows for Inventory name.
    expect([jab.status, SUPPLIES_VISIT.label]).toEqual(["seen", "visit:h-wren"]);
    seedDemoSupplies(db, { id: jab.id, seenAt: jab.seen_at, by: SUPPLIES_VISIT.by });
    seedDemoSupplies(db, { id: jab.id, seenAt: jab.seen_at, by: SUPPLIES_VISIT.by });
    await hold(jab);
    expect(view(jab.id).lines.map((shown) => [shown.line.qty, shown.batch?.code ?? null, shown.notUsed])).toEqual(FLU_LINES.map((line) => [line.qty, line.batch === undefined ? null : DEMO_FLU_BATCH.code, line.notUsed === true]));
    expect(view(jab.id).lines.every((shown) => shown.line.recorded_by === SUPPLIES_VISIT.by)).toBe(true);
  });

  it("keeps a visit's supplies only while a screen shows them, and reads nothing for a panel that has closed", async () => {
    const visit = visitAt("with_clinician");
    await loadDesk();
    await ensureDays(venueDay(Date.parse(visit.starts_at), DEMO_ZONE));
    const [panel, sheet] = [holdSupplies(visit.id), holdSupplies(visit.id)];
    await loadSupplies(visit.id);
    panel();
    expect(useSupplies.getState().byVisit[visit.id]).toBeDefined();
    sheet();
    expect(useSupplies.getState().byVisit[visit.id]).toBeUndefined();
    // A save that lands after the panel closed reads nothing back: no list is kept for a screen nobody has open.
    expect((await act.addSupply({ visitId: visit.id, itemId: 4 as Id, key: actionKey() })).ok).toBe(true);
    expect(useSupplies.getState().byVisit[visit.id]).toBeUndefined();
  });

  it("hides the feature when the stock list is gone", async () => {
    const visit = visitAt("with_clinician");
    await hold(visit);
    expect(isFeatureOn(SUPPLIES)).toBe(true);
    // Inventory disconnected while the desk is open: its names can no longer be read.
    const real = demoSuppliesPort(db);
    setSuppliesPort({ ...real, load: async () => Promise.reject(new SuppliesGone()) });
    await loadSupplies(visit.id);
    expect(isFeatureOn(SUPPLIES)).toBe(false);
    expect(useSupplies.getState().byVisit).toEqual({});
  });

  it("reads once for a burst of changes from other desks", async () => {
    const visit = visitAt("with_clinician");
    await hold(visit);
    const real = demoSuppliesPort(db);
    let reads = 0;
    setSuppliesPort({ ...real, load: (...args) => ((reads += 1), real.load(...args)) });
    for (let i = 0; i < 6; i += 1) suppliesChanged();
    await new Promise((resolve) => setTimeout(resolve, 260));
    expect(reads).toBe(1);
  });
});

describe("a kit half on the visit", () => {
  it("is offered again until every thing in it is there, and a confirmed batch can be taken back", async () => {
    const visit = visitAt("ready");
    await hold(visit);
    const whole = demoSink(db, () => ({ origin: "desk", name: "Tom Villaseñor" }));
    // Refused, not dropped, on its third line: the first two are saved.
    let n = 0;
    setSink({ ...whole, insert: async (ref, values) => ((n += 1) === 3 ? Promise.reject(new SinkError("no", "refused", 422, "VALIDATION_FAILED")) : whole.insert(ref, values)) });
    expect((await act.addKit({ visitId: visit.id, ...kit(), key: actionKey() })).ok).toBe(false);
    expect(view(visit.id).kits.find((offer) => offer.id === DEMO_FLU_KIT.id)!.added).toBe(false);
    setSink(whole);
    expect((await act.addKit({ visitId: visit.id, ...kit(), key: actionKey() })).ok).toBe(true);
    expect(view(visit.id).kits.find((offer) => offer.id === DEMO_FLU_KIT.id)!.added).toBe(true);
    expect(view(visit.id).lines.length).toBe(DEMO_FLU_KIT.lines.length);
    const vaccine = view(visit.id).lines.find((shown) => shown.tracksBatches)!;
    await act.confirmBatch({ visitId: visit.id, lineId: vaccine.line.id, batchId: DEMO_FLU_BATCH.id });
    expect((await act.confirmBatch({ visitId: visit.id, lineId: vaccine.line.id, batchId: null })).ok).toBe(true);
    const again = view(visit.id).lines.find((shown) => shown.tracksBatches)!;
    expect([again.batch, again.proposals.map((batch) => batch.code)]).toEqual([null, [DEMO_FLU_BATCH.code]]);
  });
});

describe("a visit taken back and sent off again", () => {
  it("keeps its one recall, whatever the sheet is asked the second time", async () => {
    const visit = visitAt("ready");
    await hold(visit);
    const first = await act.sendOff({ visitId: visit.id, payment: null, recallWeeks: 6, followUp: null, key: actionKey() });
    expect(first.ok).toBe(true);
    expect((await act.setStatus(visit.id, "ready")).ok).toBe(true);
    // Another day, another key, the recall chosen again.
    const second = await act.sendOff({ visitId: visit.id, payment: null, recallWeeks: 6, followUp: null, key: actionKey() });
    expect(second.ok).toBe(true);
    expect(db.rows.recalls.filter((recall) => recall.from_appointment_id === visit.id).length).toBe(1);
  });
});
