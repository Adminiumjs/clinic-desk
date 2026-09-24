/**
 * The waiting list's fits: the working days looked over, the part of the day,
 * who would see them, and the order the desk works the list in.
 */
import { describe, expect, it } from "vitest";

import type { DayState, SlotTime } from "../data/ports.ts";
import type { OpeningHours, WaitingEntry } from "../data/types.ts";
import { askKey, firstFit, inPart, morningEndsOn, waitingInOrder, workingDays } from "./waitlist.ts";

const day = (date: string, state: DayState["state"]): DayState => ({ date, open: state === "open" ? 3 : 0, state });
const free = (time: string, resource?: number): SlotTime => ({ time, state: "free", ...(resource === undefined ? {} : { resource }) });
const full = (time: string): SlotTime => ({ time, state: "full" });

describe("workingDays", () => {
  it("counts full days but skips closed ones, and stops at the count", () => {
    const strip = [day("2026-07-28", "open"), day("2026-07-29", "full"), day("2026-07-30", "closed"), day("2026-07-31", "open"), day("2026-08-01", "closed"), day("2026-08-03", "open")];
    expect(workingDays(strip, 3)).toEqual(["2026-07-28", "2026-07-29", "2026-07-31"]);
    expect(workingDays(strip)).toEqual(["2026-07-28", "2026-07-29", "2026-07-31", "2026-08-03"]);
  });
});

describe("the part of the day", () => {
  const hours = [{ weekday: "tue", break_start: "12:30" }, { weekday: "wed", break_start: null }] as OpeningHours[];

  it("splits at the practice's lunch close that weekday, or noon without one", () => {
    expect(morningEndsOn(hours, "2026-07-28")).toBe(12 * 60 + 30);
    expect(morningEndsOn(hours, "2026-07-29")).toBe(12 * 60);
    expect(morningEndsOn(hours, "2026-07-30")).toBe(12 * 60);
  });

  it("puts a time before the split in the morning and from it in the afternoon", () => {
    expect(inPart("12:15", "mornings", 750)).toBe(true);
    expect(inPart("12:30", "mornings", 750)).toBe(false);
    expect(inPart("12:30", "afternoons", 750)).toBe(true);
    expect(inPart("08:30", "afternoons", 750)).toBe(false);
    expect(inPart("08:30", "any", 750)).toBe(true);
  });
});

describe("firstFit", () => {
  it("takes the first free time in the part asked for, day by day", () => {
    const days = [
      { day: "2026-07-28", times: [full("09:00"), free("09:15"), free("14:00")], split: 750 },
      { day: "2026-07-29", times: [free("15:00")], split: 720 },
    ];
    expect(firstFit(days, "any", 4)).toEqual({ day: "2026-07-28", time: "09:15", clinicianId: 4 });
    expect(firstFit(days, "afternoons", 4)).toEqual({ day: "2026-07-28", time: "14:00", clinicianId: 4 });
    expect(firstFit(days.slice(1), "mornings", 4)).toBeNull();
  });

  it("books with the clinician the server picked when they asked for anyone", () => {
    expect(firstFit([{ day: "2026-07-28", times: [free("10:00", 7)], split: 720 }], "any", null)).toEqual({ day: "2026-07-28", time: "10:00", clinicianId: 7 });
  });

  it("passes over a free time with nobody named to see them", () => {
    expect(firstFit([{ day: "2026-07-28", times: [free("10:00"), free("10:15", 2)], split: 720 }], "any", null)).toEqual({ day: "2026-07-28", time: "10:15", clinicianId: 2 });
  });

  it("finds nothing in full days", () => {
    expect(firstFit([{ day: "2026-07-28", times: [full("10:00")], split: 720 }], "any", 1)).toBeNull();
  });
});

describe("the list's order", () => {
  const entry = (id: number, created: string | null, status: WaitingEntry["status"] = "waiting"): WaitingEntry => ({
    id,
    patient_id: id,
    visit_type_id: 1,
    clinician_id: null,
    part_of_day: "any",
    status,
    channel: "desk",
    booked_appointment_id: null,
    note: null,
    created_at: created,
  });

  it("is longest wait first, waiting only, ties by key", () => {
    const list = [entry(3, "2026-07-25T09:00:00.000Z"), entry(1, "2026-07-21T09:00:00Z"), entry(2, "2026-07-25T09:00:00Z"), entry(4, "2026-07-20T09:00:00Z", "booked")];
    expect(waitingInOrder(list).map((w) => w.id)).toEqual([1, 2, 3]);
  });

  it("shares one question between entries asking the same", () => {
    expect(askKey({ visit_type_id: 2, clinician_id: null })).toBe("2|any");
    expect(askKey({ visit_type_id: 2, clinician_id: 5 })).toBe("2|5");
  });
});
