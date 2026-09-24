/**
 * What the patients' pages work out for themselves: how much of a name
 * "Found you" shows, the booking window in working days, the day's times
 * as drawn (passed, too soon, taken), the nearest times to one that has
 * gone, the cancellation window, the opening hours in a few lines, the
 * calendar file, and — the part that must never drift — which refusal gets
 * which words: every failed lookup reads the same.
 */
import { describe, expect, it } from "vitest";

import type { Closure, OpeningHours, Weekday } from "../../data/types.ts";
import {
  bookProblem,
  buildIcs,
  codeProblem,
  fillPractice,
  firstAndInitial,
  groupTimes,
  hoursRows,
  icsText,
  insideWindow,
  isBirthDay,
  lookupProblem,
  morningEnds,
  nearestFree,
  personReady,
  practiceWorks,
  windowSpan,
} from "./logic.ts";

const hours = (open: Weekday[], extra: Partial<OpeningHours> = {}): OpeningHours[] =>
  (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as Weekday[]).map((weekday, i) => ({
    id: i + 1,
    weekday,
    open: open.includes(weekday),
    opens: "08:30",
    closes: "17:30",
    break_start: "12:30",
    break_end: "13:15",
    ...extra,
  }));
const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
const closure = (from: string, to: string, clinician: number | null = null): Closure => ({
  id: 1,
  client_key: null,
  clinician_id: clinician,
  from_date: from,
  to_date: to,
  label: "Training",
  note: null,
  active: true,
  created_at: null,
});

describe("what \"Found you\" shows", () => {
  it("is the first name and the last name's initial, never the whole name", () => {
    expect(firstAndInitial("Cormac Ellery")).toBe("Cormac E.");
    expect(firstAndInitial("  Anne Marie  de  Vries ")).toBe("Anne V.");
    expect(firstAndInitial("Cher")).toBe("Cher");
    expect(firstAndInitial("")).toBe("");
  });
});

describe("the booking window", () => {
  it("covers the practice's working days, skipping weekends (Tue 28 Jul + 10 working days = 14 calendar days)", () => {
    expect(windowSpan(hours(WEEKDAYS), [], "2026-07-28", 10)).toBe(14);
  });
  it("does not count a day the whole practice is closed, but does count a day one clinician is away", () => {
    expect(windowSpan(hours(WEEKDAYS), [closure("2026-07-29", "2026-07-29")], "2026-07-28", 3)).toBe(4);
    expect(windowSpan(hours(WEEKDAYS), [closure("2026-07-29", "2026-07-29", 4)], "2026-07-28", 3)).toBe(3);
    expect(practiceWorks(hours(WEEKDAYS), [{ ...closure("2026-07-29", "2026-07-29"), active: false }], "2026-07-29")).toBe(true);
  });
  it("never asks the server for more than 31 days", () => {
    expect(windowSpan(hours([]), [], "2026-07-28", 10)).toBe(31);
  });
});

describe("a day's times as drawn", () => {
  const times = [
    { time: "09:00", state: "full" as const },
    { time: "09:45", state: "full" as const },
    { time: "10:30", state: "free" as const },
    { time: "11:00", state: "full" as const },
    { time: "13:15", state: "free" as const },
  ];
  it("splits at the lunch close's start, or noon without one", () => {
    expect(morningEnds(hours(WEEKDAYS), "2026-07-28")).toBe(12 * 60 + 30);
    expect(morningEnds(hours(WEEKDAYS, { break_start: null, break_end: null }), "2026-07-28")).toBe(12 * 60);
  });
  it("tells passed, too soon to book online, and taken apart", () => {
    const g = groupTimes(times, 12 * 60 + 30, "2026-07-28", "2026-07-28T09:20", "2026-07-28T10:20");
    expect(g.morning.map((s) => [s.time, s.free, s.passed, s.soon])).toEqual([
      ["09:00", false, true, false],
      ["09:45", false, false, true],
      ["10:30", true, false, false],
      ["11:00", false, false, false],
    ]);
    expect(g.afternoon.map((s) => s.time)).toEqual(["13:15"]);
  });
  it("never draws a free time that has already passed as open", () => {
    const g = groupTimes([{ time: "08:30", state: "free" }], 750, "2026-07-28", "2026-07-28T09:20", "2026-07-28T10:20");
    expect(g.morning[0]).toMatchObject({ free: false, passed: true });
  });
});

describe("that time has just gone", () => {
  it("offers the three free times nearest the lost one (the earlier on a tie), earliest first", () => {
    const times = ["09:00", "09:15", "09:30", "10:00", "10:15", "11:30"].map((time) => ({ time, state: "free" as const }));
    expect(nearestFree([...times, { time: "09:45", state: "full" }], "09:45")).toEqual(["09:15", "09:30", "10:00"]);
    expect(nearestFree([{ time: "09:45", state: "free" }], "09:45")).toEqual([]);
  });
});

describe("the cancellation window", () => {
  const start = "2026-07-29T08:15:00.000Z";
  it("is inside when fewer than the practice's hours are left", () => {
    expect(insideWindow(start, Date.parse(start) - 23 * 3_600_000, 24)).toBe(true);
    expect(insideWindow(start, Date.parse(start) - 24 * 3_600_000, 24)).toBe(false);
    expect(insideWindow(start, Date.parse(start) - 13 * 3_600_000, 12)).toBe(false);
  });
});

describe("the opening hours in a few lines", () => {
  it("writes matching weekdays as one line, the lunch close, and a closed weekend", () => {
    expect(hoursRows(hours(WEEKDAYS)).map((r) => r.kind)).toEqual(["weekdays", "deskClosed", "weekendClosed"]);
  });
  it("writes a day at a time when the weekdays differ, and an open Saturday on its own", () => {
    const h = hours([...WEEKDAYS, "sat"]).map((row) => (row.weekday === "wed" ? { ...row, closes: "13:00", break_start: null, break_end: null } : row));
    const rows = hoursRows(h);
    expect(rows.map((r) => r.kind)).toEqual(["day", "day", "day", "day", "day", "day", "dayClosed"]);
    expect(rows[2]).toMatchObject({ weekday: "wed", closes: "13:00", breakFrom: null });
  });
});

describe("the practice's numbers in its questions", () => {
  it("fills every placeholder, as often as it appears", () => {
    const s = { phone: "0117 496 0142", no_show_minutes: 15, cancel_hours: 24 };
    expect(fillPractice("Ring {phone}. Late after {no_show_minutes} min; {cancel_hours} h; {phone}.", s)).toBe("Ring 0117 496 0142. Late after 15 min; 24 h; 0117 496 0142.");
    expect(fillPractice("{phone}", null)).toBe("{phone}");
  });
});

describe("the calendar file", () => {
  const ics = buildIcs({
    ref: "RH-7Q2K",
    startsAt: "2026-07-30T08:00:00.000Z",
    minutes: 45,
    summary: "Physiotherapy · Nadia",
    location: "12 Rowan Walk, Ashgrove BS7 4QN",
    description: "Reference RH-7Q2K; desk 0117",
    practice: "Rowan Health",
    stampedAt: Date.parse("2026-07-28T08:20:00.000Z"),
  });
  it("puts the visit at UTC instants, so any phone shows the practice's own time", () => {
    expect(ics).toContain("DTSTART:20260730T080000Z\r\n");
    expect(ics).toContain("DTEND:20260730T084500Z\r\n");
    expect(ics).toContain("DTSTAMP:20260728T082000Z\r\n");
  });
  it("names the practice, not a hard-coded one, and escapes text", () => {
    expect(ics).toContain("PRODID:-//Rowan Health//Booking//EN");
    expect(ics).toContain("UID:RH-7Q2K@rowan-health");
    expect(ics).toContain("LOCATION:12 Rowan Walk\\, Ashgrove BS7 4QN");
    expect(ics).toContain("DESCRIPTION:Reference RH-7Q2K\\; desk 0117");
    expect(icsText("a\nb\\c")).toBe("a\\nb\\\\c");
  });
});

describe("refusals, in the page's words", () => {
  it("reads every failed lookup the same — nobody, two people, a lock — so no detail is singled out", () => {
    for (const code of ["PUBLIC_CLAIM_NO_MATCH", "PUBLIC_CLAIM_UNAVAILABLE", "PUBLIC_CLAIM_LOCKED", "PUBLIC_REF_NOT_FOUND", ""]) {
      expect(lookupProblem(code), code).toBe("notFound");
    }
    expect(lookupProblem("PUBLIC_RATE_LIMITED")).toBe("tooMany");
    expect(lookupProblem("PUBLIC_PROOF_REQUIRED")).toBe("proof");
    expect(lookupProblem("PUBLIC_NETWORK_UNAVAILABLE")).toBe("offline");
  });
  it("gives each code answer its own words", () => {
    expect(codeProblem("PUBLIC_CODE_EXPIRED")).toBe("expired");
    expect(codeProblem("PUBLIC_CODE_LOCKED")).toBe("locked");
    expect(codeProblem("PUBLIC_CLAIM_LOCKED")).toBe("dayLocked");
    expect(codeProblem("PUBLIC_CODE_TOO_SOON")).toBe("tooSoon");
    expect(codeProblem("PUBLIC_CLAIM_NO_EMAIL")).toBe("noEmail");
    expect(codeProblem("PUBLIC_CODE_STEP_UP")).toBe("stepUp");
    expect(codeProblem("PUBLIC_EMAIL_CHANGE_LIMIT")).toBe("changeLimit");
    expect(codeProblem("PUBLIC_CLAIM_LEVEL")).toBe("sessionEnded");
  });
  it("turns a lost or out-of-range time into \"just gone\", and the rest into their own words", () => {
    expect(bookProblem("PUBLIC_SLOT_FULL")).toBe("gone");
    expect(bookProblem("PUBLIC_WRITE_REFUSED", { reason: "out-of-range" })).toBe("gone");
    expect(bookProblem("PUBLIC_WRITE_REFUSED", { reason: "not-offered" })).toBe("invalid");
    expect(bookProblem("PUBLIC_TOO_LATE")).toBe("tooLate");
    expect(bookProblem("PUBLIC_LIMIT_REACHED")).toBe("limit");
    expect(bookProblem("PUBLIC_CLAIM_LEVEL")).toBe("sessionEnded");
  });
});

describe("a new person's details", () => {
  it("needs a real past date of birth, a name and a mobile", () => {
    expect(isBirthDay("1994-06-12", "2026-07-28")).toBe(true);
    expect(isBirthDay("1994-02-30", "2026-07-28")).toBe(false);
    expect(isBirthDay("2027-01-01", "2026-07-28")).toBe(false);
    expect(isBirthDay("12/06/1994", "2026-07-28")).toBe(false);
    expect(personReady({ name: "Anouk Brenner", bornOn: "1994-06-12", mobile: "07700 900216" }, "2026-07-28")).toBe(true);
    expect(personReady({ name: "Al", bornOn: "1994-06-12", mobile: "07700 900216" }, "2026-07-28")).toBe(false);
    expect(personReady({ name: "Anouk Brenner", bornOn: "1994-06-12", mobile: "0770" }, "2026-07-28")).toBe(false);
  });
});
