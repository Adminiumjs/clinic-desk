import { describe, expect, it } from "vitest";

import type { Appointment, OpeningHours } from "../../data/types.ts";
import { closureClashes, hoursLines, recallGroup } from "./rules.ts";

describe("recallGroup", () => {
  it("groups by the due day against today", () => {
    expect(recallGroup("2026-07-16", "2026-07-28")).toBe("over");
    expect(recallGroup("2026-07-28", "2026-07-28")).toBe("due");
    expect(recallGroup("2026-08-25", "2026-07-28")).toBe("due");
    expect(recallGroup("2026-08-26", "2026-07-28")).toBe("later");
  });
});

const day = (weekday: OpeningHours["weekday"], over: Partial<OpeningHours> = {}): OpeningHours => ({
  id: 1,
  weekday,
  open: true,
  opens: "08:30",
  closes: "17:30",
  break_start: "12:30",
  break_end: "13:15",
  ...over,
});
const week = (over: Partial<Record<OpeningHours["weekday"], Partial<OpeningHours>>> = {}): OpeningHours[] =>
  (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((d) => day(d, { ...(d === "sat" || d === "sun" ? { open: false } : {}), ...over[d] }));

describe("hoursLines", () => {
  it("reads a regular week as the design does", () => {
    expect(hoursLines(week()).map((l) => l.kind)).toEqual(["weekdays", "break", "weekendClosed"]);
  });

  it("gives a line per weekday when one differs, and a line per open weekend day", () => {
    const lines = hoursLines(week({ wed: { closes: "15:00" }, sat: { open: true, opens: "09:00", closes: "12:00", break_start: null, break_end: null } }));
    expect(lines.map((l) => l.id)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    const sat = lines.find((l) => l.id === "sat");
    expect(sat).toMatchObject({ open: true, breakFrom: null });
  });

  it("leaves out a lunch close that does not close anything", () => {
    expect(hoursLines(week({ mon: { break_start: null, break_end: null }, tue: { break_start: null, break_end: null }, wed: { break_start: null, break_end: null }, thu: { break_start: null, break_end: null }, fri: { break_start: null, break_end: null } })).map((l) => l.kind)).toEqual(["weekdays", "weekendClosed"]);
  });
});

describe("closureClashes", () => {
  const v = (id: number, over: Partial<Appointment>): Appointment => ({ id, status: "booked", starts_at: "2026-07-30T09:00:00.000Z", clinician_id: 4, ...over }) as Appointment;
  const visits = [v(1, {}), v(2, { clinician_id: 2 }), v(3, { status: "seen" }), v(4, { status: "cancelled" }), v(5, { starts_at: "2026-07-31T09:00:00.000Z" })];

  it("counts only booked visits in its days, of its clinician", () => {
    expect(closureClashes({ from_date: "2026-07-30", to_date: "2026-07-30", clinician_id: 4 }, visits).map((x) => x.id)).toEqual([1]);
  });

  it("counts everybody's for a closure of the whole practice", () => {
    expect(closureClashes({ from_date: "2026-07-30", to_date: "2026-07-31", clinician_id: null }, visits).map((x) => x.id)).toEqual([1, 2, 5]);
  });
});
