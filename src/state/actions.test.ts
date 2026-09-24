/**
 * Every action the desk takes, against the demo practice — the same sample
 * data an operator adds, under the same rules Adminium keeps (a visit's fee
 * and length copied, stamps, the capped balance, the booking rule, unique
 * keys). Each test is one row of the desk's actions: what it writes, in what
 * order, and what it answers when the practice says no.
 *
 * The multi-step actions are also run HALF-WAY: a first try that stops after
 * a step (the network drops), then a second try with the same key, which must
 * finish without writing anything twice.
 */
import { beforeEach, describe, expect, it } from "vitest";

import bundle from "../../seeds/clinic.sample.json";
import { resolveSample } from "../data/sampleRows.ts";
import { createDemoDb, type DemoDb } from "../demo/db.ts";
import { demoDeskReads, demoSink } from "../demo/ports.ts";
import { SinkError, type DataSink } from "../data/sink.ts";
import type { Appointment, Id } from "../data/types.ts";
import { addDays, venueStamp } from "../data/venueTime.ts";
import { DEMO_START, DEMO_ZONE, setClockSource, setZone } from "../lib/clock.ts";
import { actionKey } from "../lib/keys.ts";
import * as act from "./actions.ts";
import { ensureDays, loadDesk, setDeskReads, useDesk } from "./desk.ts";
import { setSink } from "./writes.ts";

let db: DemoDb;
let at = DEMO_START;
const TODAY = "2026-07-28";
const when = (day: string, hhmm: string) => new Date(venueStamp(day, hhmm, DEMO_ZONE)).toISOString();

/** A sink that fails its `n`th write the way a dropped network does, once. */
function flaky(inner: DataSink, failOn: number): DataSink {
  let n = 0;
  const maybe = () => {
    n += 1;
    if (n === failOn) throw new SinkError("no answer", "offline", 0, "NETWORK");
  };
  return {
    insert: async (ref, values) => {
      maybe();
      return inner.insert(ref, values);
    },
    update: async (ref, id, patch) => {
      maybe();
      return inner.update(ref, id, patch);
    },
    remove: async (ref, id) => {
      maybe();
      return inner.remove(ref, id);
    },
  };
}

beforeEach(async () => {
  at = DEMO_START;
  const rows = resolveSample(bundle as never, { now: DEMO_START, zone: DEMO_ZONE, locale: "en-US" });
  // A seeded generator: references differ from one another, and every run makes the same ones.
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  db = createDemoDb(rows as never, () => at, DEMO_ZONE, random);
  setZone(DEMO_ZONE);
  setClockSource(() => at);
  setDeskReads(demoDeskReads(db));
  setSink(demoSink(db, () => ({ origin: "desk", name: "Ivy Ferreira" })));
  await loadDesk();
});

const visit = (id: Id): Appointment => db.rows.appointments.find((a) => a.id === id)!;
const patientNamed = (name: string) => db.rows.patients.find((p) => p.name === name)!;
const clinicianNamed = (name: string) => db.rows.clinicians.find((c) => c.short_name === name)!;
const typeNamed = (minutes: number) => db.rows.visit_types.find((t) => t.minutes === minutes && !t.new_patients_only)!;
/** A time tomorrow that `clinician` has free for a visit of `minutes`. */
function freeTomorrow(clinician: Id, minutes: number): string {
  for (let m = 8 * 60 + 30; m < 17 * 60; m += 15) {
    const hhmm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const start = Date.parse(when(addDays(TODAY, 1), hhmm));
    const busy = db.rows.appointments.some(
      (a) => a.clinician_id === clinician && !["cancelled", "no_show"].includes(a.status) && Date.parse(a.starts_at) < start + minutes * 60_000 && Date.parse(a.starts_at) + a.minutes * 60_000 > start,
    );
    const lunch = m < 13 * 60 + 15 && m + minutes > 12 * 60 + 30;
    if (!busy && !lunch) return new Date(start).toISOString();
  }
  throw new Error("no free time tomorrow");
}

describe("booking and moving", () => {
  it("books a phone call for a patient on file: reference, fee, length and who booked it", async () => {
    const osei = clinicianNamed("Dr Osei");
    const routine = typeNamed(15);
    const cormac = patientNamed("Cormac Ellery");
    const startsAt = freeTomorrow(osei.id, 15);
    const done = await act.bookVisit({ patient: { id: cormac.id }, visitTypeId: routine.id, clinicianId: osei.id, startsAt, channel: "phone", reason: "blood pressure", deskNote: null, key: actionKey() });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.ref).toMatch(/^RH-[0-9A-Z]{4}$/);
    expect(done.value).toMatchObject({ minutes: 15, fee: routine.fee, balance: routine.fee, booked_by: "Ivy Ferreira", status: "booked", channel: "phone" });
    // …and it is on the desk at once, as the server answered it.
    expect(useDesk.getState().visits[done.value.id]?.ref).toBe(done.value.ref);
    // The same time again is refused as taken.
    const again = await act.bookVisit({ patient: { id: cormac.id }, visitTypeId: routine.id, clinicianId: osei.id, startsAt, channel: "phone", reason: null, deskNote: null, key: actionKey() });
    expect(again).toMatchObject({ ok: false, reason: "taken" });
  });

  it("books a new patient typed at the desk: the patient first, then the visit in their name — never a first visit to check", async () => {
    const osei = clinicianNamed("Dr Osei");
    const done = await act.bookVisit({
      patient: { details: { name: "Mina Okafor", born_on: "1990-04-02", mobile: "07700 900999", email: null } },
      visitTypeId: typeNamed(15).id,
      clinicianId: osei.id,
      startsAt: freeTomorrow(osei.id, 15),
      channel: "desk",
      reason: null,
      deskNote: null,
      key: actionKey(),
    });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    const mina = patientNamed("Mina Okafor");
    expect(done.value.patient_id).toBe(mina.id);
    expect(done.value.check_status).toBeNull();
  });

  it("resumes a half-booked new patient with the same key: one patient, one visit", async () => {
    const osei = clinicianNamed("Dr Osei");
    const input = {
      patient: { details: { name: "Rhea Sol", born_on: "1985-01-09", mobile: "07700 900998", email: null } },
      visitTypeId: typeNamed(15).id,
      clinicianId: osei.id,
      startsAt: freeTomorrow(osei.id, 15),
      channel: "phone" as const,
      reason: null,
      deskNote: null,
      key: actionKey(),
    };
    const sinkBefore = demoSink(db, () => ({ origin: "desk", name: "Ivy Ferreira" }));
    setSink(flaky(sinkBefore, 2));
    expect(await act.bookVisit(input)).toMatchObject({ ok: false, reason: "offline" });
    setSink(sinkBefore);
    expect((await act.bookVisit(input)).ok).toBe(true);
    expect(db.rows.patients.filter((p) => p.name === "Rhea Sol")).toHaveLength(1);
    expect(db.rows.appointments.filter((a) => a.patient_id === patientNamed("Rhea Sol").id)).toHaveLength(1);
  });

  it("books a walk-in into the slot that holds now, already checked in and stamped", async () => {
    const osei = clinicianNamed("Dr Osei");
    // 09:20 now: the 09:15 slot, if Dr Osei is free for it; else any slot is refused.
    at = venueStamp(TODAY, "12:05", DEMO_ZONE);
    const done = await act.bookVisit({ patient: { id: patientNamed("Cormac Ellery").id }, visitTypeId: typeNamed(15).id, clinicianId: osei.id, startsAt: when(TODAY, "12:00"), channel: "walk_in", reason: null, deskNote: null, walkIn: true, key: actionKey() });
    if (done.ok) {
      expect(done.value.status).toBe("checked_in");
      expect(done.value.checked_in_at).not.toBeNull();
    } else {
      expect(["taken", "out-of-hours"]).toContain(done.reason);
    }
  });

  it("moves a visit, keeping its reference; into a taken time it is refused", async () => {
    const booked = db.rows.appointments.find((a) => a.status === "booked" && a.clinician_id !== null && Date.parse(a.starts_at) > at)!;
    const to = freeTomorrow(booked.clinician_id!, booked.minutes);
    const moved = await act.moveVisit(booked.id, { startsAt: to, clinicianId: booked.clinician_id });
    expect(moved).toMatchObject({ ok: true });
    expect(visit(booked.id)).toMatchObject({ ref: booked.ref, starts_at: to });
    const other = db.rows.appointments.find((a) => a.status === "booked" && a.clinician_id === booked.clinician_id && a.id !== booked.id && Date.parse(a.starts_at) > at);
    if (other !== undefined) {
      expect(await act.moveVisit(booked.id, { startsAt: other.starts_at, clinicianId: other.clinician_id })).toMatchObject({ ok: false, reason: "taken" });
    }
  });

  it("steps a visit through the day, each step stamped", async () => {
    const booked = db.rows.appointments.find((a) => a.status === "booked" && a.patient_id !== null)!;
    for (const status of ["checked_in", "roomed", "with_clinician", "ready"] as const) {
      expect((await act.setStatus(booked.id, status)).ok).toBe(true);
    }
    expect(visit(booked.id)).toMatchObject({ status: "ready" });
    expect(visit(booked.id).checked_in_at).not.toBeNull();
    expect(visit(booked.id).roomed_at).not.toBeNull();
  });

  it("cancels at the desk: the time goes back, a late one is flagged, never refused", async () => {
    const soon = db.rows.appointments.find((a) => a.status === "booked" && Date.parse(a.starts_at) > at && Date.parse(a.starts_at) - at < 24 * 3_600_000)!;
    const done = await act.cancelVisit(soon.id);
    expect(done.ok).toBe(true);
    expect(visit(soon.id)).toMatchObject({ status: "cancelled", late_cancel: true, cancelled_by: "desk" });
  });
});

describe("money", () => {
  const seenOwing = () => db.rows.appointments.find((a) => a.status === "seen" && a.balance > 0)!;

  it("records a payment and the balance follows; more than the balance is refused", async () => {
    const owing = seenOwing();
    const balance = owing.balance;
    expect(await act.recordPayment({ visitId: owing.id, amount: balance + 5, method: "card", key: actionKey() })).toMatchObject({ ok: false, reason: "balance" });
    expect((await act.recordPayment({ visitId: owing.id, amount: balance, method: "cash", key: actionKey() })).ok).toBe(true);
    expect(visit(owing.id).balance).toBe(0);
    expect(useDesk.getState().visits[owing.id]?.balance).toBe(0);
  });

  it("voids a payment and the balance comes back; writes off, capped by the balance", async () => {
    const owing = seenOwing();
    const paid = await act.recordPayment({ visitId: owing.id, amount: 1, method: "card", key: actionKey() });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    const before = visit(owing.id).balance;
    expect((await act.voidPayment(paid.value.id, "wrong visit")).ok).toBe(true);
    expect(visit(owing.id).balance).toBe(before + 1);
    expect(await act.writeOff({ visitId: owing.id, amount: visit(owing.id).balance + 1, reason: "too much", key: actionKey() })).toMatchObject({ ok: false, reason: "balance" });
    expect((await act.writeOff({ visitId: owing.id, amount: 1, reason: "goodwill", key: actionKey() })).ok).toBe(true);
    expect(visit(owing.id).balance).toBe(before);
  });

  it("sends someone off: payment, recall, then seen — and a retry after a dropped step writes nothing twice", async () => {
    const inRoom = db.rows.appointments.find((a) => ["checked_in", "roomed", "with_clinician", "ready"].includes(a.status) && a.patient_id !== null && a.balance > 1)!;
    const key = actionKey();
    const input = { visitId: inRoom.id, payment: { amount: 1, method: "card" as const }, recallWeeks: 6, followUp: null, key };
    const real = demoSink(db, () => ({ origin: "desk", name: "Ivy Ferreira" }));
    // The recall's write (the second) gets no answer.
    setSink(flaky(real, 2));
    expect(await act.sendOff(input)).toMatchObject({ ok: false, reason: "offline" });
    expect(visit(inRoom.id).status).not.toBe("seen");
    setSink(real);
    const done = await act.sendOff(input);
    expect(done.ok).toBe(true);
    expect(db.rows.payments.filter((p) => p.appointment_id === inRoom.id && p.amount === 1)).toHaveLength(1);
    const recalls = db.rows.recalls.filter((r) => r.from_appointment_id === inRoom.id);
    expect(recalls).toHaveLength(1);
    expect(recalls[0]).toMatchObject({ weeks: 6, status: "due", due_on: addDays(TODAY, 42), clinician_id: inRoom.clinician_id });
    expect(visit(inRoom.id)).toMatchObject({ status: "seen", recall_weeks: 6 });
  });

  it("books the follow-up now: the placed visit books the recall it made", async () => {
    const inRoom = db.rows.appointments.find((a) => ["checked_in", "roomed", "with_clinician", "ready"].includes(a.status) && a.patient_id !== null && a.clinician_id !== null)!;
    const startsAt = freeTomorrow(inRoom.clinician_id!, inRoom.minutes);
    const done = await act.sendOff({ visitId: inRoom.id, payment: null, recallWeeks: 2, followUp: { startsAt, clinicianId: inRoom.clinician_id }, key: actionKey() });
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.recall).toMatchObject({ status: "booked" });
    expect(visit(done.value.recall!.booked_appointment_id!)).toMatchObject({ channel: "recall", starts_at: startsAt });
  });
});

describe("registrations and first visits", () => {
  it("accepts a registration as a new patient (keyed: a retry makes no second patient)", async () => {
    const reg = db.rows.registrations.find((r) => r.status === "new")!;
    const key = actionKey();
    const real = demoSink(db, () => ({ origin: "desk", name: "Ivy Ferreira" }));
    setSink(flaky(real, 2));
    expect((await act.acceptNewPatient({ kind: "registration", row: reg }, key)).ok).toBe(false);
    setSink(real);
    expect((await act.acceptNewPatient({ kind: "registration", row: reg }, key)).ok).toBe(true);
    expect(db.rows.patients.filter((p) => p.name === reg.name && p.born_on === reg.born_on)).toHaveLength(1);
    expect(db.rows.registrations.find((r) => r.id === reg.id)).toMatchObject({ status: "accepted", handled_by: "Ivy Ferreira" });
  });

  it("accepts a first visit booked online: a patient from its details, the visit linked and accepted", async () => {
    const first = db.rows.appointments.find((a) => a.check_status === "to_check")!;
    const done = await act.acceptNewPatient({ kind: "visit", row: first }, actionKey());
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(visit(first.id)).toMatchObject({ patient_id: done.value.id, check_status: "accepted" });
    expect(done.value).toMatchObject({ name: first.new_name, mobile: first.new_mobile });
  });

  it("links to a patient on file, copying nothing typed onto their record", async () => {
    const reg = db.rows.registrations.find((r) => r.status === "new")!;
    const cormac = patientNamed("Cormac Ellery");
    const before = { ...cormac };
    expect((await act.linkToPatient({ kind: "registration", row: reg }, cormac.id)).ok).toBe(true);
    expect(db.rows.registrations.find((r) => r.id === reg.id)).toMatchObject({ patient_id: cormac.id, status: "duplicate" });
    expect(patientNamed("Cormac Ellery")).toEqual(before);
  });

  it("notes a call and marks the item rang; declines a first visit, cancelling it and freeing the time", async () => {
    const first = db.rows.appointments.find((a) => a.check_status === "to_check")!;
    expect((await act.addCheckNote({ kind: "visit", row: first }, "Left a message", actionKey(), true)).ok).toBe(true);
    expect(visit(first.id).check_status).toBe("rang");
    expect(db.rows.check_notes.some((n) => n.appointment_id === first.id && n.note === "Left a message")).toBe(true);
    expect((await act.decline({ kind: "visit", row: first }, "Declined — moved away", actionKey())).ok).toBe(true);
    expect(visit(first.id)).toMatchObject({ check_status: "declined", status: "cancelled" });
  });
});

describe("recalls, hours and closures, the outbox, the end of the day", () => {
  it("books a recall in, queues a recall note, and takes one off the list", async () => {
    const [a, b, c] = db.rows.recalls.filter((r) => r.status === "due");
    const startsAt = freeTomorrow(a!.clinician_id, 15);
    expect((await act.bookRecall(a!, { visitTypeId: a!.visit_type_id ?? typeNamed(15).id, clinicianId: a!.clinician_id, startsAt, reason: null, deskNote: null }, actionKey())).ok).toBe(true);
    expect(db.rows.recalls.find((r) => r.id === a!.id)).toMatchObject({ status: "booked" });
    expect((await act.queueRecallNote(b!, actionKey())).ok).toBe(true);
    expect(db.rows.recalls.find((r) => r.id === b!.id)?.status).toBe("noted");
    expect(db.rows.messages.some((m) => m.kind === "recall" && m.recall_id === b!.id && m.status === "queued")).toBe(true);
    expect((await act.recallNotNeeded(c!, "Moved away")).ok).toBe(true);
    expect(db.rows.recalls.find((r) => r.id === c!.id)).toMatchObject({ status: "not_needed", dismiss_reason: "Moved away" });
  });

  it("adds a closure FIRST, then cancels and emails the visits chosen; one left to move stays booked", async () => {
    const day = addDays(TODAY, 1);
    const clashes = db.rows.appointments.filter((a) => a.status === "booked" && a.starts_at.slice(0, 10) === day);
    expect(clashes.length).toBeGreaterThan(1);
    const [cancelMe, moveMe] = clashes;
    const done = await act.addClosure({ clinicianId: null, from: day, to: day, label: "Staff training", note: "The practice is closed for staff training that day." }, [{ visitId: cancelMe!.id, key: actionKey() }], actionKey());
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(visit(cancelMe!.id).status).toBe("cancelled");
    expect(db.rows.messages.some((m) => m.kind === "cancelled" && m.closure_id === done.value.id && m.appointment_id === cancelMe!.id)).toBe(true);
    expect(visit(moveMe!.id).status).toBe("booked");
  });

  it("reads the balance again when another desk took a payment first", async () => {
    const owing = db.rows.appointments.find((a) => a.status === "seen" && a.balance > 1 && useDesk.getState().visits[a.id] !== undefined)!;
    const held = useDesk.getState().visits[owing.id]!.balance;
    // Another desk takes 1 straight into the database: this desk still holds the old balance.
    db.insert("payments", { appointment_id: owing.id, amount: 1, method: "card" }, { origin: "desk", name: "Another desk" });
    expect(useDesk.getState().visits[owing.id]!.balance).toBe(held);
    expect(await act.recordPayment({ visitId: owing.id, amount: held, method: "cash", key: actionKey() })).toMatchObject({ ok: false, reason: "balance" });
    expect(useDesk.getState().visits[owing.id]!.balance).toBe(held - 1);
  });

  it("leaves alone a clash another desk has moved out of the closure since the list was drawn", async () => {
    const day = addDays(TODAY, 1);
    const [stays, moved] = db.rows.appointments.filter((a) => a.status === "booked" && a.starts_at.slice(0, 10) === day);
    await ensureDays(day);
    // Another desk moves one to the day after, straight in the database.
    db.rows.appointments.find((a) => a.id === moved!.id)!.starts_at = when(addDays(TODAY, 2), "16:45");
    const done = await act.addClosure({ clinicianId: null, from: day, to: day, label: "Staff training", note: null }, [{ visitId: stays!.id, key: actionKey() }, { visitId: moved!.id, key: actionKey() }], actionKey());
    expect(done.ok).toBe(true);
    expect(visit(stays!.id).status).toBe("cancelled");
    expect(visit(moved!.id).status).toBe("booked");
    expect(db.rows.messages.some((m) => m.kind === "cancelled" && m.appointment_id === moved!.id)).toBe(false);
  });

  it("books a waiting-list entry once: another desk's booking of it is refused, this desk's half-done try resumes", async () => {
    const entry = Object.values(useDesk.getState().waiting)[0]!;
    const doesIt = db.rows.clinician_visit_types.find((l) => l.visit_type_id === entry.visit_type_id)!;
    const osei = db.rows.clinicians.find((c) => c.id === doesIt.clinician_id)!;
    const startsAt = freeTomorrow(osei.id, db.rows.visit_types.find((t) => t.id === entry.visit_type_id)!.minutes);
    const key = actionKey();
    // The first try books the visit, then the network drops before the entry is marked.
    setSink(flaky(demoSink(db, () => ({ origin: "desk", name: "Ivy Ferreira" })), 2));
    expect((await act.takeWaiting(entry, { startsAt, clinicianId: osei.id }, key)).ok).toBe(false);
    setSink(demoSink(db, () => ({ origin: "desk", name: "Ivy Ferreira" })));
    const again = await act.takeWaiting(entry, { startsAt, clinicianId: osei.id }, key);
    expect(again.ok).toBe(true);
    expect(db.rows.appointments.filter((a) => a.channel === "waiting_list" && a.patient_id === entry.patient_id && a.starts_at === startsAt)).toHaveLength(1);
    // A second desk, still showing the entry as waiting, is refused rather than booking a second visit.
    const other = await act.takeWaiting(entry, { startsAt, clinicianId: osei.id }, actionKey());
    expect(other).toMatchObject({ ok: false, reason: "gone" });
  });

  it("saves the hours: a clinician back on the practice's hours loses their own rows", async () => {
    const withOwn = db.rows.clinician_hours[0]!.clinician_id;
    expect((await act.saveHours({ practice: [], clinicians: [{ clinicianId: withOwn, own: null }] })).ok).toBe(true);
    expect(db.rows.clinician_hours.filter((h) => h.clinician_id === withOwn)).toEqual([]);
    expect((await act.saveHours({ practice: [], clinicians: [{ clinicianId: withOwn, own: [{ weekday: "mon", opens: "09:00", closes: "13:00", break_start: null, break_end: null }] }] })).ok).toBe(true);
    expect(db.rows.clinician_hours.filter((h) => h.clinician_id === withOwn)).toHaveLength(1);
  });

  it("sends a reminder now and a failed message again", async () => {
    const booked = db.rows.appointments.find((a) => a.status === "booked" && a.patient_id !== null && Date.parse(a.starts_at) > at)!;
    expect((await act.sendReminderNow(booked.id, actionKey())).ok).toBe(true);
    expect(db.rows.messages.some((m) => m.kind === "reminder" && m.appointment_id === booked.id && m.status === "queued")).toBe(true);
    // Cancelled since the outbox was drawn: no reminder.
    const cancelled = db.rows.appointments.find((a) => a.status === "booked" && a.id !== booked.id && Date.parse(a.starts_at) > at)!;
    db.rows.appointments.find((a) => a.id === cancelled.id)!.status = "cancelled";
    expect(await act.sendReminderNow(cancelled.id, actionKey())).toMatchObject({ ok: false, reason: "gone" });
    // A first visit, not yet on file, is reminded at the address it booked with.
    const first = db.insert(
      "appointments",
      { patient_id: null, visit_type_id: typeNamed(15).id, clinician_id: clinicianNamed("Dr Osei").id, starts_at: freeTomorrow(clinicianNamed("Dr Osei").id, 15), new_name: "Rhian Vale", new_email: "rhian@example.com", language: "de-DE", channel: "online", check_status: "to_check" },
      { origin: "patient", name: null },
    );
    expect((await act.sendReminderNow(first.id, actionKey())).ok).toBe(true);
    expect(db.rows.messages.find((m) => m.kind === "reminder" && m.appointment_id === first.id)).toMatchObject({ to_address: "rhian@example.com", language: "de-DE" });
    const failed = db.rows.messages.find((m) => m.status === "failed")!;
    expect((await act.sendAgain(failed.id)).ok).toBe(true);
    expect(db.rows.messages.find((m) => m.id === failed.id)).toMatchObject({ status: "queued", error: null });
  });

  it("closes the desk once: the never-arrived marked no-shows, the cash counted; a second close is refused", async () => {
    at = venueStamp(TODAY, "17:40", DEMO_ZONE);
    const neverCame = db.rows.appointments.filter((a) => a.status === "booked" && a.starts_at.slice(0, 10) === TODAY).map((a) => a.id);
    const done = await act.closeDesk({ day: TODAY, noShows: neverCame, cashExpected: 45, cashCounted: 45, note: null });
    expect(done.ok).toBe(true);
    for (const id of neverCame) expect(visit(id).status).toBe("no_show");
    expect(await act.closeDesk({ day: TODAY, noShows: [], cashExpected: 0, cashCounted: null, note: null })).toMatchObject({ ok: false, reason: "duplicate" });
  });

  it("changes the desk's settings", async () => {
    expect((await act.saveSettings({ no_show_minutes: 20, reminders_on: false })).ok).toBe(true);
    expect(useDesk.getState().settings).toMatchObject({ no_show_minutes: 20, reminders_on: false });
  });
});
