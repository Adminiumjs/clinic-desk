/**
 * Engine assertions for `lib/schedule.ts`.
 *
 * These run against the shipped seed rather than fixtures wherever the seed
 * makes the point, so a change to `data/demo.ts` that quietly breaks the desk —
 * a check-in stamp moved, a physiotherapy visit pushed into lunch, an amount
 * paid twice — fails here instead of on the screen.
 *
 * Fixtures appear only where the seed deliberately does NOT go: a completely
 * full day, an overpayment, a start that lands on the wrong side of the break.
 */

import { describe, expect, it } from "vitest";

import {
  APPOINTMENTS,
  CHARGES,
  CLINICIANS,
  NOW,
  PATIENTS,
  PAYMENTS,
  VISIT_TYPES,
} from "../data/demo.ts";
import type { Appointment, Now } from "../data/types.ts";
import {
  BREAK_END,
  BREAK_START,
  CLOSE,
  OPEN,
  addDays,
  ageOn,
  apptsFor,
  awaitingArrival,
  balanceOf,
  checkPayment,
  cliniciansFor,
  collides,
  dayDiff,
  daySheet,
  dayStrip,
  endOf,
  findPatient,
  fitsHours,
  gridRows,
  hhmm,
  isBreakRow,
  isLateCancel,
  isWorkingDay,
  lastVisit,
  minutesLate,
  minutesUntil,
  nextDayWithRoom,
  nextStatus,
  nextWorkingDay,
  noShowsThisWeek,
  nowOffset,
  openStarts,
  outstanding,
  recalls,
  seenCount,
  slotsFor,
  takenOn,
  totalOutstanding,
  visitTypeById,
  visitsForPatient,
  waitTone,
  waitingBoard,
  waitingMinutes,
  weekStart,
} from "./schedule.ts";

const appt = (over: Partial<Appointment> = {}): Appointment => ({
  id: "RH-9001",
  patient: "june",
  clinician: "amara",
  type: "routine",
  date: "2026-07-28",
  start: 600,
  status: "booked",
  checkedInAt: null,
  reason: "data.reason.review",
  deskNote: null,
  recallWeeks: null,
  ...over,
});

const at = (date: string, minutes: number): Now => ({ date, minutes });

describe("the pinned clock", () => {
  it("is Tuesday 28 July 2026 at 09:20", () => {
    expect(NOW.date).toBe("2026-07-28");
    expect(NOW.minutes).toBe(560);
    expect(hhmm(NOW.minutes)).toBe("09:20");
    expect(isWorkingDay(NOW.date)).toBe(true);
  });

  it("renders minutes as a zero-padded 24-hour clock", () => {
    expect(hhmm(OPEN)).toBe("08:30");
    expect(hhmm(CLOSE)).toBe("17:30");
    expect(hhmm(BREAK_START)).toBe("12:30");
    expect(hhmm(BREAK_END)).toBe("13:15");
  });
});

describe("calendar helpers", () => {
  it("counts whole days in both directions", () => {
    expect(dayDiff("2026-07-28", "2026-07-14")).toBe(14);
    expect(dayDiff("2026-07-28", "2026-08-11")).toBe(-14);
    expect(dayDiff("2026-07-28", "2026-07-28")).toBe(0);
  });

  it("crosses a month boundary without drifting", () => {
    expect(addDays("2026-07-28", 14)).toBe("2026-08-11");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("knows the practice is shut at the weekend", () => {
    expect(isWorkingDay("2026-08-01")).toBe(false);
    expect(isWorkingDay("2026-08-02")).toBe(false);
    expect(isWorkingDay("2026-08-03")).toBe(true);
  });

  it("skips the weekend when asked for the next working day", () => {
    expect(nextWorkingDay("2026-07-31")).toBe("2026-08-03");
    expect(nextWorkingDay("2026-07-28")).toBe("2026-07-29");
  });

  it("builds a ten-day strip that shows the weekend rather than hiding it", () => {
    const strip = dayStrip(NOW.date, 10);
    expect(strip).toHaveLength(10);
    expect(strip[0].iso).toBe("2026-07-28");
    expect(strip.filter((d) => !d.working).map((d) => d.iso)).toEqual([
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("puts the week's Monday before the pinned Tuesday", () => {
    expect(weekStart("2026-07-28")).toBe("2026-07-27");
    expect(weekStart("2026-08-02")).toBe("2026-07-27");
  });
});

describe("appointment length is set by the reason for the visit", () => {
  it("carries the four lengths the practice offers", () => {
    expect(visitTypeById(VISIT_TYPES, "routine").minutes).toBe(15);
    expect(visitTypeById(VISIT_TYPES, "newpatient").minutes).toBe(30);
    expect(visitTypeById(VISIT_TYPES, "physio").minutes).toBe(45);
    expect(visitTypeById(VISIT_TYPES, "nurse").minutes).toBe(15);
  });

  it("derives the end of a visit from its type, never from a stored field", () => {
    const physio = APPOINTMENTS.find((a) => a.id === "RH-4012");
    expect(physio).toBeDefined();
    expect(endOf(physio as Appointment, VISIT_TYPES)).toBe(600);
  });

  it("prices each length differently", () => {
    expect(visitTypeById(VISIT_TYPES, "routine").fee).toBe(45);
    expect(visitTypeById(VISIT_TYPES, "newpatient").fee).toBe(80);
    expect(visitTypeById(VISIT_TYPES, "physio").fee).toBe(60);
    expect(visitTypeById(VISIT_TYPES, "nurse").fee).toBe(25);
  });

  it("offers only the clinicians who take that kind of visit", () => {
    expect(cliniciansFor(CLINICIANS, "physio").map((c) => c.id)).toEqual(["nadia"]);
    expect(cliniciansFor(CLINICIANS, "nurse").map((c) => c.id)).toEqual(["tom"]);
    expect(cliniciansFor(CLINICIANS, "routine").map((c) => c.id)).toEqual([
      "amara",
      "piotr",
    ]);
  });
});

describe("a start has to fit the day", () => {
  it("lets a visit end exactly on the close but never after it", () => {
    expect(fitsHours(CLOSE - 15, 15)).toBe(true);
    expect(fitsHours(CLOSE - 15, 30)).toBe(false);
    expect(fitsHours(CLOSE - 45, 45)).toBe(true);
  });

  it("lets a visit end exactly on the break but never overrun it", () => {
    expect(fitsHours(BREAK_START - 15, 15)).toBe(true);
    expect(fitsHours(BREAK_START - 45, 45)).toBe(true);
    expect(fitsHours(BREAK_START - 30, 45)).toBe(false);
    expect(fitsHours(BREAK_START, 15)).toBe(false);
  });

  it("resumes the moment the break ends", () => {
    expect(fitsHours(BREAK_END, 45)).toBe(true);
    expect(fitsHours(BREAK_END - 15, 15)).toBe(false);
  });

  it("refuses a start before the doors open", () => {
    expect(fitsHours(OPEN - 15, 15)).toBe(false);
    expect(fitsHours(OPEN, 15)).toBe(true);
  });
});

describe("slot generation", () => {
  it("offers a 45-minute visit visibly fewer starts than a 15-minute one", () => {
    const short = slotsFor(APPOINTMENTS, VISIT_TYPES, "tom", "2026-08-04", "nurse", NOW);
    const long = slotsFor(APPOINTMENTS, VISIT_TYPES, "nadia", "2026-08-04", "physio", NOW);
    expect(short.length).toBeGreaterThan(long.length);
    expect(short).toHaveLength(33);
    expect(long).toHaveLength(29);
  });

  it("never draws a start that would run into lunch or past the close", () => {
    const long = slotsFor(APPOINTMENTS, VISIT_TYPES, "nadia", "2026-08-04", "physio", NOW);
    const starts = long.map((s) => s.start);
    expect(starts).not.toContain(BREAK_START - 30);
    expect(starts).toContain(BREAK_START - 45);
    expect(starts).toContain(BREAK_END);
    expect(Math.max(...starts)).toBe(CLOSE - 45);
  });

  it("dims a start that has already gone by on today, rather than hiding it", () => {
    const today = slotsFor(APPOINTMENTS, VISIT_TYPES, "piotr", NOW.date, "routine", NOW);
    const nine = today.find((s) => s.start === 540);
    expect(nine).toBeDefined();
    expect(nine?.available).toBe(false);
    expect(nine?.blocked).toBe("past");
  });

  it("does not dim anything on a future day", () => {
    const future = slotsFor(APPOINTMENTS, VISIT_TYPES, "piotr", "2026-08-04", "routine", NOW);
    expect(future.some((s) => s.blocked === "past")).toBe(false);
  });

  it("marks a start taken when the diary already holds it", () => {
    const today = slotsFor(APPOINTMENTS, VISIT_TYPES, "nadia", NOW.date, "physio", NOW);
    const taken = today.find((s) => s.start === 615);
    expect(taken?.blocked).toBe("taken");
    expect(taken?.available).toBe(false);
  });

  it("blocks the quarter-hours a long visit sits across, not just its start", () => {
    const today = slotsFor(APPOINTMENTS, VISIT_TYPES, "nadia", NOW.date, "physio", NOW);
    /* RH-4013 runs 10:15–11:00, so 10:30 and 10:45 cannot start anything. */
    expect(today.find((s) => s.start === 630)?.blocked).toBe("taken");
    expect(today.find((s) => s.start === 645)?.blocked).toBe("taken");
  });

  it("releases the slot a cancelled visit used to hold", () => {
    const withCancelled = APPOINTMENTS.map((a) =>
      a.id === "RH-4014" ? { ...a, status: "cancelled" as const } : a,
    );
    const before = slotsFor(APPOINTMENTS, VISIT_TYPES, "nadia", NOW.date, "physio", NOW);
    const after = slotsFor(withCancelled, VISIT_TYPES, "nadia", NOW.date, "physio", NOW);
    expect(before.find((s) => s.start === 675)?.available).toBe(false);
    expect(after.find((s) => s.start === 675)?.available).toBe(true);
  });

  it("still holds the slot of someone who never turned up", () => {
    const noShow = APPOINTMENTS.find((a) => a.id === "RH-3999");
    expect(noShow?.status).toBe("no_show");
    const held = apptsFor(APPOINTMENTS, "amara", "2026-07-27");
    expect(held.map((a) => a.id)).toContain("RH-3999");
  });

  it("detects an overlap half-open, so back-to-back visits are legal", () => {
    const booked = [appt({ start: 600, type: "routine" })];
    expect(collides(booked, VISIT_TYPES, 615, 15)).toBe(false);
    expect(collides(booked, VISIT_TYPES, 585, 15)).toBe(false);
    expect(collides(booked, VISIT_TYPES, 585, 30)).toBe(true);
    expect(collides(booked, VISIT_TYPES, 600, 15)).toBe(true);
  });
});

describe("finding a day with room", () => {
  it("finds open starts today for a routine check after the pinned clock", () => {
    const open = openStarts(APPOINTMENTS, CLINICIANS, VISIT_TYPES, "any", NOW.date, "routine", NOW);
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((o) => o.start >= NOW.minutes)).toBe(true);
    expect(open[0].start).toBeGreaterThanOrEqual(NOW.minutes);
  });

  it("returns nothing at all for a weekend", () => {
    expect(
      openStarts(APPOINTMENTS, CLINICIANS, VISIT_TYPES, "any", "2026-08-01", "routine", NOW),
    ).toEqual([]);
  });

  it("returns nothing when the chosen clinician does not do that visit", () => {
    expect(
      openStarts(APPOINTMENTS, CLINICIANS, VISIT_TYPES, "amara", "2026-08-04", "physio", NOW),
    ).toEqual([]);
  });

  it("names the next day with room when a day is completely full", () => {
    /* Fill Nadia's Wednesday with back-to-back physiotherapy visits. */
    const full: Appointment[] = [];
    let seq = 0;
    for (let start = OPEN; start + 45 <= CLOSE; start += 15) {
      if (!fitsHours(start, 45)) continue;
      if (full.some((a) => start < a.start + 45 && start + 45 > a.start)) continue;
      seq += 1;
      full.push(
        appt({ id: `RH-95${seq}`, clinician: "nadia", type: "physio", date: "2026-07-29", start }),
      );
    }
    const book = [...APPOINTMENTS, ...full];
    expect(
      openStarts(book, CLINICIANS, VISIT_TYPES, "nadia", "2026-07-29", "physio", NOW),
    ).toEqual([]);
    expect(
      nextDayWithRoom(book, CLINICIANS, VISIT_TYPES, "nadia", "2026-07-29", "physio", NOW),
    ).toBe("2026-07-30");
  });

  it("skips the weekend when naming the next day with room", () => {
    expect(
      nextDayWithRoom(APPOINTMENTS, CLINICIANS, VISIT_TYPES, "any", "2026-07-31", "routine", NOW),
    ).toBe("2026-08-03");
  });
});

describe("today's book", () => {
  it("holds nineteen visits across the four columns", () => {
    const today = APPOINTMENTS.filter((a) => a.date === NOW.date);
    expect(today).toHaveLength(19);
    const sheet = daySheet(APPOINTMENTS, CLINICIANS, NOW.date);
    expect(sheet.map((c) => c.appts.length)).toEqual([6, 5, 4, 4]);
  });

  it("has already seen three people", () => {
    expect(seenCount(APPOINTMENTS, NOW)).toBe(3);
  });

  it("draws a quarter-hour row for every slot of the day", () => {
    const rows = gridRows();
    expect(rows[0]).toBe(OPEN);
    expect(rows[rows.length - 1]).toBe(CLOSE - 15);
    expect(rows).toHaveLength(36);
    expect(rows.filter(isBreakRow).map(hhmm)).toEqual(["12:30", "12:45", "13:00"]);
  });

  it("places the now line inside the day and nowhere else", () => {
    expect(nowOffset(NOW, NOW.date)).toBeCloseTo(50 / 540, 6);
    expect(nowOffset(NOW, "2026-07-29")).toBeNull();
    expect(nowOffset(at(NOW.date, 7 * 60), NOW.date)).toBeNull();
    expect(nowOffset(at(NOW.date, 20 * 60), NOW.date)).toBeNull();
  });

  it("sorts a clinician's column by start time", () => {
    const starts = apptsFor(APPOINTMENTS, "amara", NOW.date).map((a) => a.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

describe("the waiting room", () => {
  it("puts four people on the board at the pinned clock", () => {
    const board = waitingBoard(APPOINTMENTS, NOW);
    const total =
      board.checked_in.length +
      board.roomed.length +
      board.with_clinician.length +
      board.ready.length;
    expect(total).toBe(4);
    expect(board.checked_in.map((a) => a.id)).toEqual(["RH-4012", "RH-4009"]);
    expect(board.roomed.map((a) => a.id)).toEqual(["RH-4016"]);
    expect(board.with_clinician.map((a) => a.id)).toEqual(["RH-4003"]);
  });

  it("derives every waiting time from the check-in stamp", () => {
    const by = (id: string) => APPOINTMENTS.find((a) => a.id === id) as Appointment;
    expect(waitingMinutes(by("RH-4009"), NOW)).toBe(6);
    expect(waitingMinutes(by("RH-4012"), NOW)).toBe(22);
    expect(waitingMinutes(by("RH-4016"), NOW)).toBe(34);
    expect(waitingMinutes(by("RH-4003"), NOW)).toBe(47);
  });

  it("shows an amber chip on load and a danger one behind it", () => {
    const by = (id: string) => APPOINTMENTS.find((a) => a.id === id) as Appointment;
    expect(waitTone(waitingMinutes(by("RH-4009"), NOW))).toBe("ok");
    expect(waitTone(waitingMinutes(by("RH-4012"), NOW))).toBe("warn");
    expect(waitTone(waitingMinutes(by("RH-4016"), NOW))).toBe("warn");
    expect(waitTone(waitingMinutes(by("RH-4003"), NOW))).toBe("danger");
  });

  it("escalates exactly on the twenty and forty minute marks", () => {
    expect(waitTone(20)).toBe("ok");
    expect(waitTone(21)).toBe("warn");
    expect(waitTone(40)).toBe("warn");
    expect(waitTone(41)).toBe("danger");
  });

  it("re-derives every waiting time when the demo clock moves", () => {
    const later = at(NOW.date, NOW.minutes + 15);
    const arjun = APPOINTMENTS.find((a) => a.id === "RH-4012") as Appointment;
    expect(waitingMinutes(arjun, later)).toBe(37);
    expect(waitTone(waitingMinutes(arjun, later))).toBe("warn");
  });

  it("sorts each column with the longest wait at the top", () => {
    const board = waitingBoard(APPOINTMENTS, NOW);
    const waits = board.checked_in.map((a) => waitingMinutes(a, NOW));
    expect(waits).toEqual([...waits].sort((a, b) => b - a));
  });

  it("moves a visit one step at a time and stops at done", () => {
    expect(nextStatus("booked")).toBe("checked_in");
    expect(nextStatus("checked_in")).toBe("roomed");
    expect(nextStatus("roomed")).toBe("with_clinician");
    expect(nextStatus("with_clinician")).toBe("ready");
    expect(nextStatus("ready")).toBe("done");
    expect(nextStatus("done")).toBe("done");
    expect(nextStatus("cancelled")).toBe("cancelled");
  });
});

describe("the hasn't-arrived strip", () => {
  it("lists exactly one person at the pinned clock", () => {
    const late = awaitingArrival(APPOINTMENTS, NOW);
    expect(late.map((a) => a.id)).toEqual(["RH-4008"]);
    expect(minutesLate(late[0], NOW)).toBe(20);
  });

  it("leaves someone alone until they are more than fifteen minutes late", () => {
    const teo = APPOINTMENTS.find((a) => a.id === "RH-4017") as Appointment;
    expect(minutesLate(teo, NOW)).toBe(5);
    expect(awaitingArrival(APPOINTMENTS, NOW).map((a) => a.id)).not.toContain("RH-4017");
  });

  it("opens the window on the next person after two taps of the demo clock", () => {
    const later = at(NOW.date, NOW.minutes + 30);
    expect(awaitingArrival(APPOINTMENTS, later).map((a) => a.id)).toEqual([
      "RH-4008",
      "RH-4017",
    ]);
  });

  it("never lists anyone who has already checked in", () => {
    const later = at(NOW.date, 17 * 60);
    const ids = awaitingArrival(APPOINTMENTS, later).map((a) => a.id);
    expect(ids).not.toContain("RH-4003");
    expect(ids).not.toContain("RH-4016");
  });
});

describe("patients", () => {
  it("seeds thirty patients spanning ages six to eighty-four", () => {
    expect(PATIENTS).toHaveLength(30);
    const ages = PATIENTS.map((p) => ageOn(p.dob, NOW.date));
    expect(Math.min(...ages)).toBe(6);
    expect(Math.max(...ages)).toBe(84);
  });

  it("derives age against the pinned date, birthday included", () => {
    expect(ageOn("1968-07-30", "2026-07-28")).toBe(57);
    expect(ageOn("1968-07-30", "2026-07-30")).toBe(58);
    expect(ageOn("1968-07-30", "2026-07-29")).toBe(57);
  });

  it("finds a returning patient by mobile and date of birth together", () => {
    const found = findPatient(PATIENTS, "07700 900405", "1968-07-30");
    expect(found?.id).toBe("june");
    expect(findPatient(PATIENTS, "07700900405", "1968-07-30")?.id).toBe("june");
    expect(findPatient(PATIENTS, "07700 900405", "1970-01-01")).toBeNull();
    expect(findPatient(PATIENTS, "", "1968-07-30")).toBeNull();
  });

  it("splits a patient's visits around the pinned clock, soonest first", () => {
    const { upcoming, past } = visitsForPatient(APPOINTMENTS, "june", NOW);
    expect(upcoming.map((a) => a.id)).toEqual(["RH-4004", "RH-4020"]);
    expect(past.map((a) => a.id)).toEqual(["RH-3989"]);
  });

  it("keeps a cancelled visit in the past list rather than losing it", () => {
    const { past } = visitsForPatient(APPOINTMENTS, "priya", NOW);
    expect(past.map((a) => a.id)).toEqual(["RH-3998"]);
    expect(past[0].status).toBe("cancelled");
  });

  it("names the most recent visit that actually happened", () => {
    expect(lastVisit(APPOINTMENTS, "kofi", NOW)?.id).toBe("RH-4007");
    expect(lastVisit(APPOINTMENTS, "sana", NOW)).toBeNull();
  });

  it("carries an allergies chip on some patients and nothing further", () => {
    const withChip = PATIENTS.filter((p) => p.allergies !== null);
    expect(withChip.length).toBeGreaterThan(0);
    expect(Object.keys(PATIENTS[0])).toEqual([
      "id",
      "name",
      "ini",
      "dob",
      "mobile",
      "allergies",
    ]);
  });
});

describe("changing or cancelling", () => {
  it("counts a cancellation inside twenty-four hours as late", () => {
    const today = APPOINTMENTS.find((a) => a.id === "RH-4004") as Appointment;
    expect(minutesUntil(today, NOW)).toBe(25);
    expect(isLateCancel(today, NOW)).toBe(true);
  });

  it("leaves a booking a fortnight out at no charge", () => {
    const later = APPOINTMENTS.find((a) => a.id === "RH-4020") as Appointment;
    expect(minutesUntil(later, NOW)).toBe(14 * 1440 + 600 - 560);
    expect(isLateCancel(later, NOW)).toBe(false);
  });

  it("turns late exactly as the twenty-four hour line is crossed", () => {
    const tomorrow = appt({ date: "2026-07-29", start: NOW.minutes });
    expect(isLateCancel(tomorrow, NOW)).toBe(false);
    expect(isLateCancel(tomorrow, at(NOW.date, NOW.minutes + 1))).toBe(true);
  });
});

describe("accounts", () => {
  it("leaves six amounts outstanding, oldest first", () => {
    const rows = outstanding(CHARGES, PAYMENTS, NOW);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.charge.id)).toEqual([
      "c-3985",
      "c-3989",
      "c-3994",
      "c-3995",
      "c-3996",
      "c-3997",
    ]);
    expect(rows.map((r) => r.ageDays)).toEqual([...rows.map((r) => r.ageDays)].sort((a, b) => b - a));
  });

  it("carries one amount about forty days old", () => {
    const rows = outstanding(CHARGES, PAYMENTS, NOW);
    expect(rows[0].ageDays).toBe(40);
    expect(rows[0].charge.patient).toBe("edith");
  });

  it("nets a part payment off without settling the row", () => {
    const partial = CHARGES.find((c) => c.id === "c-3996") as (typeof CHARGES)[number];
    expect(partial.amount).toBe(45);
    expect(balanceOf(partial, PAYMENTS)).toBe(25);
  });

  it("totals what is owed across every open row", () => {
    expect(totalOutstanding(CHARGES, PAYMENTS)).toBe(245);
  });

  it("sums what the desk has taken today and nothing from other days", () => {
    expect(takenOn(PAYMENTS, NOW.date)).toBe(135);
    expect(takenOn(PAYMENTS, "2026-07-27")).toBe(0);
    expect(takenOn(PAYMENTS, "2026-07-21")).toBe(20);
  });

  it("counts this week's no-shows from Monday", () => {
    const week = noShowsThisWeek(APPOINTMENTS, NOW);
    expect(week.map((a) => a.id)).toEqual(["RH-3999", "RH-4000"]);
  });

  it("accepts a partial amount and reports what is left", () => {
    const charge = CHARGES.find((c) => c.id === "c-3985") as (typeof CHARGES)[number];
    const check = checkPayment(charge, PAYMENTS, 20);
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.amount).toBe(20);
      expect(check.remaining).toBe(25);
    }
  });

  it("accepts the exact balance and leaves nothing behind", () => {
    const charge = CHARGES.find((c) => c.id === "c-3996") as (typeof CHARGES)[number];
    const check = checkPayment(charge, PAYMENTS, 25);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.remaining).toBe(0);
  });

  it("refuses an overpayment and hands back the maximum rather than clamping", () => {
    const charge = CHARGES.find((c) => c.id === "c-3996") as (typeof CHARGES)[number];
    const check = checkPayment(charge, PAYMENTS, 40);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason).toBe("overpay");
      expect(check.max).toBe(25);
    }
  });

  it("refuses zero, a negative amount and a number that is not one", () => {
    const charge = CHARGES.find((c) => c.id === "c-3985") as (typeof CHARGES)[number];
    for (const bad of [0, -10, Number.NaN]) {
      const check = checkPayment(charge, PAYMENTS, bad);
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.reason).toBe("nonpositive");
    }
  });

  it("charges every completed visit exactly once", () => {
    const ids = CHARGES.map((c) => c.appt);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHARGES) {
      expect(APPOINTMENTS.some((a) => a.id === c.appt)).toBe(true);
    }
  });

  it("never records a payment against a charge that does not exist", () => {
    for (const p of PAYMENTS) {
      expect(CHARGES.some((c) => c.id === p.charge)).toBe(true);
    }
  });

  it("never lets a charge be paid more than it is worth", () => {
    for (const c of CHARGES) {
      expect(balanceOf(c, PAYMENTS)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("recalls", () => {
  it("derives five people due back, two of them overdue", () => {
    const rows = recalls(APPOINTMENTS, NOW);
    expect(rows).toHaveLength(5);
    expect(rows.filter((r) => r.overdue)).toHaveLength(2);
  });

  it("counts the weeks from the visit, not from a stored date", () => {
    const rows = recalls(APPOINTMENTS, NOW);
    const hazel = rows.find((r) => r.patient === "hazel");
    expect(hazel?.appt).toBe("RH-3981");
    expect(hazel?.weeks).toBe(6);
    expect(hazel?.due).toBe("2026-07-14");
    expect(hazel?.overdueDays).toBe(14);
  });

  it("puts the most overdue at the top and the rest in date order", () => {
    const rows = recalls(APPOINTMENTS, NOW);
    expect(rows.map((r) => r.patient)).toEqual(["hazel", "hana", "yusuf", "june", "bram"]);
    expect(rows.map((r) => r.overdueDays)).toEqual([14, 7, 0, -1, -2]);
  });

  it("treats a recall falling today as due rather than overdue", () => {
    const rows = recalls(APPOINTMENTS, NOW);
    const yusuf = rows.find((r) => r.patient === "yusuf");
    expect(yusuf?.due).toBe(NOW.date);
    expect(yusuf?.overdue).toBe(false);
  });

  it("ignores a recall from a visit that never happened", () => {
    const book = APPOINTMENTS.map((a) =>
      a.id === "RH-3981" ? { ...a, status: "no_show" as const } : a,
    );
    expect(recalls(book, NOW).map((r) => r.patient)).not.toContain("hazel");
  });

  it("does not reach into next month for something not yet due", () => {
    const book = [
      ...APPOINTMENTS,
      appt({ id: "RH-9002", patient: "otis", date: "2026-07-20", status: "done", recallWeeks: 8 }),
    ];
    expect(recalls(book, NOW).map((r) => r.patient)).not.toContain("otis");
  });
});
