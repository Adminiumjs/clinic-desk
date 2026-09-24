/**
 * The day sheet's, the waiting room's and the week diary's arithmetic, on a
 * small practice built here: open 08:30–17:30 on weekdays with a 12:30–13:15
 * lunch close, a nurse who keeps her own shorter hours, and a Friday closure.
 */
import { describe, expect, it } from "vitest";

import type { Appointment, AppointmentStatus, Clinician, ClinicianHours, Closure, OpeningHours, Weekday } from "../../data/types.ts";
import { WEEKDAYS } from "../../data/types.ts";
import type { DeskState } from "../../state/desk.ts";
import {
  board,
  columnState,
  insideWindow,
  mayAdvance,
  mondayOf,
  notArrived,
  openMinutes,
  panelActions,
  railOf,
  shutBands,
  waitMinutes,
  waits,
  waitTone,
  weekCell,
  weekDays,
} from "./model.ts";

const hours: OpeningHours[] = WEEKDAYS.map((weekday, i) => ({
  id: i + 1,
  weekday,
  open: weekday !== "sat" && weekday !== "sun",
  opens: "08:30",
  closes: "17:30",
  break_start: "12:30",
  break_end: "13:15",
}));
const person = (id: number, name: string): Clinician => ({
  id,
  name,
  short_name: name,
  role_label: "GP",
  color: "#2f6ad9",
  photo: null,
  bio: null,
  bookable_online: true,
  active: true,
  position: id,
  staff_email: null,
});
const own = (weekday: Weekday, opens: string, closes: string): ClinicianHours => ({ id: 100 + WEEKDAYS.indexOf(weekday), clinician_id: 2, weekday, opens, closes, break_start: null, break_end: null });
const closure = (id: number, clinician: number | null, from: string, to: string): Closure => ({ id, client_key: null, clinician_id: clinician, from_date: from, to_date: to, label: "Away", note: null, active: true, created_at: null });

// Tuesday 28 July 2026 is the demo's day; the nurse (2) works 07:45–15:00 on Tuesdays and not on Wednesdays.
const s = {
  hours,
  clinicians: [person(1, "Dr Osei"), person(2, "Tom")],
  clinicianHours: [own("mon", "08:30", "15:00"), own("tue", "07:45", "15:00"), own("thu", "08:30", "15:00"), own("fri", "08:30", "12:30")],
  closures: [closure(1, null, "2026-07-31", "2026-07-31"), closure(2, 1, "2026-07-30", "2026-07-30")],
} as unknown as DeskState;

let nextId = 1;
function visit(at: string, status: AppointmentStatus, extra: Partial<Appointment> = {}): Appointment {
  return {
    id: nextId++,
    ref: `RH-${String(nextId)}`,
    patient_id: 1,
    new_name: null,
    new_born_on: null,
    new_mobile: null,
    new_email: null,
    clinician_id: 1,
    visit_type_id: 1,
    starts_at: at,
    minutes: 15,
    fee: 45,
    waived: 0,
    paid: 0,
    balance: 45,
    reason: null,
    desk_note: null,
    status,
    channel: "phone",
    checked_in_at: null,
    roomed_at: null,
    seen_at: null,
    cancelled_at: null,
    late_cancel: false,
    cancelled_by: null,
    recall_weeks: null,
    language: null,
    booked_by: null,
    check_status: null,
    client_key: null,
    created_at: null,
    ...extra,
  };
}
const NOW = Date.parse("2026-07-28T08:20:00.000Z"); // 09:20 in London

describe("the rail", () => {
  it("runs from the earliest opening to the latest closing of anyone that day", () => {
    expect(railOf(s, "2026-07-28")).toEqual({ opens: 7 * 60 + 45, closes: 17 * 60 + 30 });
    expect(railOf(s, "2026-07-29")).toEqual({ opens: 8 * 60 + 30, closes: 17 * 60 + 30 });
  });
  it("keeps the practice's usual span on a day nobody works", () => {
    expect(railOf(s, "2026-08-01")).toEqual({ opens: 8 * 60 + 30, closes: 17 * 60 + 30 });
  });
});

describe("a clinician's column", () => {
  it("is closed with the practice, away on their own closure, not in without hours", () => {
    expect(columnState(s, 1, "2026-07-31").kind).toBe("closed");
    expect(columnState(s, 1, "2026-07-30").kind).toBe("away");
    expect(columnState(s, 2, "2026-07-29").kind).toBe("notIn");
    expect(columnState(s, 1, "2026-07-28").kind).toBe("open");
  });
  it("hatches before opening, the lunch close and after closing", () => {
    const rail = railOf(s, "2026-07-28");
    expect(shutBands(columnState(s, 1, "2026-07-28"), rail)).toEqual([
      { from: 465, to: 510, lunch: false },
      { from: 750, to: 795, lunch: true },
    ]);
    expect(shutBands(columnState(s, 2, "2026-07-28"), rail)).toEqual([{ from: 900, to: 1050, lunch: false }]);
    expect(shutBands(columnState(s, 2, "2026-07-29"), rail)).toEqual([{ from: 465, to: 1050, lunch: false }]);
  });
  it("counts open minutes less the lunch close", () => {
    expect(openMinutes({ opens: 510, closes: 1050, breakStart: 750, breakEnd: 795 })).toBe(495);
    expect(openMinutes({ opens: 510, closes: 900, breakStart: null, breakEnd: null })).toBe(390);
  });
});

describe("who has not come, and who is waiting", () => {
  it("lists booked visits more than the no-show window past their start, earliest first", () => {
    const late = visit("2026-07-28T08:00:00.000Z", "booked"); // 09:00, 20 min ago
    const edge = visit("2026-07-28T08:05:00.000Z", "booked"); // 09:05, exactly 15 min ago
    const here = visit("2026-07-28T07:45:00.000Z", "checked_in");
    const early = visit("2026-07-28T07:30:00.000Z", "booked"); // 08:30
    expect(notArrived([late, edge, here, early], NOW, 15).map((v) => v.id)).toEqual([early.id, late.id]);
  });
  it("waits from check-in, in whole minutes, and colours them at 20 and 40", () => {
    const v = visit("2026-07-28T08:00:00.000Z", "checked_in", { checked_in_at: "2026-07-28T07:57:30.000Z" });
    expect(waitMinutes(v, NOW)).toBe(22);
    expect(waitMinutes({ checked_in_at: null }, NOW)).toBe(0);
    expect([waitTone(19), waitTone(20), waitTone(39), waitTone(40)]).toEqual(["fg", "warn", "warn", "danger"]);
  });
  it("orders the building by who has waited longest, and averages the waits", () => {
    const a = visit("2026-07-28T08:00:00.000Z", "roomed", { checked_in_at: "2026-07-28T08:10:00.000Z" });
    const b = visit("2026-07-28T08:00:00.000Z", "checked_in", { checked_in_at: "2026-07-28T07:40:00.000Z" });
    const gone = visit("2026-07-28T07:30:00.000Z", "seen", { checked_in_at: "2026-07-28T07:20:00.000Z" });
    const people = board([a, b, gone]);
    expect(people.map((v) => v.id)).toEqual([b.id, a.id]);
    expect(waits(people, NOW)).toEqual({ longest: 40, average: 25 });
  });
});

describe("which moves a visit offers", () => {
  const desk = { role: "reception" as const, update: true, pay: true, seePatients: true };
  it("gives the front desk every move a booked visit has", () => {
    expect(panelActions({ status: "booked", patient_id: 1, balance: 45 }, desk)).toEqual(["checkIn", "move", "noShow", "cancel", "patient"]);
    expect(panelActions({ status: "ready", patient_id: 1, balance: 45 }, desk)).toEqual(["sendOff", "patient"]);
    expect(panelActions({ status: "seen", patient_id: 1, balance: 12 }, desk)).toEqual(["patient", "payment"]);
    expect(panelActions({ status: "seen", patient_id: null, balance: 0 }, desk)).toEqual([]);
  });
  it("gives a clinician only the steps into a room, in with them and ready", () => {
    const clinician = { ...desk, role: "clinician" as const, pay: false };
    expect(panelActions({ status: "booked", patient_id: 1, balance: 45 }, clinician)).toEqual(["patient"]);
    expect(panelActions({ status: "checked_in", patient_id: 1, balance: 45 }, clinician)).toEqual(["advance", "patient"]);
    expect(panelActions({ status: "with_clinician", patient_id: 1, balance: 45 }, clinician)).toEqual(["advance", "patient"]);
    expect(panelActions({ status: "ready", patient_id: 1, balance: 45 }, clinician)).toEqual(["patient"]);
    expect(["booked", "checked_in", "roomed", "with_clinician", "ready"].map((st) => mayAdvance("clinician", st as AppointmentStatus))).toEqual([false, true, true, true, false]);
  });
  it("offers no moves to someone who may not change visits", () => {
    expect(panelActions({ status: "booked", patient_id: 1, balance: 45 }, { ...desk, update: false })).toEqual(["patient"]);
  });
});

describe("the cancellation window", () => {
  it("is inside when the start is less than the window away", () => {
    expect(insideWindow("2026-07-29T08:00:00.000Z", NOW, 24)).toBe(true);
    expect(insideWindow("2026-07-29T08:30:00.000Z", NOW, 24)).toBe(false);
  });
});

describe("the week diary", () => {
  it("starts on Monday and shows only the days the practice opens", () => {
    expect(mondayOf("2026-07-28")).toBe("2026-07-27");
    expect(mondayOf("2026-08-02")).toBe("2026-07-27");
    expect(weekDays(s, "2026-07-27")).toEqual(["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"]);
  });
  it("counts visits and how much of the clinician's own hours they fill", () => {
    const visits = [
      visit("2026-07-28T08:00:00.000Z", "seen", { clinician_id: 2, minutes: 45 }),
      visit("2026-07-28T09:00:00.000Z", "booked", { clinician_id: 2, minutes: 30 }),
      visit("2026-07-28T10:00:00.000Z", "no_show", { clinician_id: 2, minutes: 15 }),
      visit("2026-07-28T11:00:00.000Z", "cancelled", { clinician_id: 2, minutes: 15 }),
    ];
    // 07:45–15:00 with no lunch close: 435 minutes; 75 of them taken.
    expect(weekCell(s, visits, 2, "2026-07-28")).toEqual({ kind: "working", visits: 2, percent: 17 });
    expect(weekCell(s, visits, 2, "2026-07-29")).toEqual({ kind: "notIn" });
    expect(weekCell(s, visits, 1, "2026-07-30")).toEqual({ kind: "away" });
    expect(weekCell(s, visits, 1, "2026-07-31")).toEqual({ kind: "closed" });
  });
});
