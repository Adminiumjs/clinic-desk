/**
 * The sheets' small decisions, against the demo practice (the same sample
 * an operator adds): amounts typed in any language, a day's hours, a
 * closure's dates and clashes, the walk-in's "now", where a moved visit
 * lands, the booking window, Registrations' tabs and the Accept key.
 */
import { beforeEach, describe, expect, it } from "vitest";

import bundle from "../../../seeds/clinic.sample.json";
import { resolveSample } from "../../data/sampleRows.ts";
import { createDemoDb, type DemoDb } from "../../demo/db.ts";
import { demoDeskReads, demoSink } from "../../demo/ports.ts";
import type { Appointment, Closure } from "../../data/types.ts";
import { addDays, venueStamp } from "../../data/venueTime.ts";
import { DEMO_START, DEMO_ZONE, setClockSource, setZone } from "../../lib/clock.ts";
import { stepKey } from "../../lib/keys.ts";
import { loadDesk, setDeskReads, useDesk } from "../../state/desk.ts";
import { setSink } from "../../state/writes.ts";
import { pickTimes } from "../book/nextTimes.ts";
import {
  acceptKey,
  closureClashes,
  closureDates,
  halfOf,
  hourOptions,
  hoursProblem,
  isOpenDay,
  lastBookableDay,
  nextOpenDay,
  parseAmount,
  registrationItems,
  sameIds,
  walkInNow,
} from "./logic.ts";

let db: DemoDb;
let at = DEMO_START;
const TODAY = "2026-07-28";
const when = (day: string, hhmm: string) => new Date(venueStamp(day, hhmm, DEMO_ZONE)).toISOString();

beforeEach(async () => {
  at = DEMO_START;
  const rows = resolveSample(bundle as never, { now: DEMO_START, zone: DEMO_ZONE, locale: "en-US" });
  let seed = 11;
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

describe("an amount as typed", () => {
  it("reads a decimal point or a decimal comma, and drops grouping and the currency", () => {
    expect(parseAmount("12.50")).toBe(12.5);
    expect(parseAmount("12,50")).toBe(12.5);
    expect(parseAmount("£ 45")).toBe(45);
    expect(parseAmount("1 234,5")).toBe(1234.5);
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1,000")).toBe(1000);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
  it("halves a balance to the cent", () => {
    expect(halfOf(45)).toBe(22.5);
    expect(halfOf(28.35)).toBe(14.18);
  });
});

describe("a day's hours", () => {
  const row = { open: true, opens: "08:30", closes: "17:30", breakStart: "12:30", breakEnd: "13:15" };
  it("passes good hours, and a closed day whatever its times", () => {
    expect(hoursProblem(row)).toBeNull();
    expect(hoursProblem({ ...row, breakStart: "", breakEnd: "" })).toBeNull();
    expect(hoursProblem({ ...row, open: false, closes: "08:00" })).toBeNull();
  });
  it("names each problem as the design words it", () => {
    expect(hoursProblem({ ...row, closes: "08:30" })).toBe("closesFirst");
    expect(hoursProblem({ ...row, breakEnd: "12:30" })).toBe("breakBackwards");
    expect(hoursProblem({ ...row, breakStart: "08:00", breakEnd: "09:00" })).toBe("breakOutside");
    expect(hoursProblem({ ...row, breakEnd: "" })).toBe("breakHalf");
  });
  it("offers 06:00 to 22:00 on the practice's grid", () => {
    const quarter = hourOptions(15);
    expect(quarter[0]).toBe("06:00");
    expect(quarter[quarter.length - 1]).toBe("22:00");
    expect(quarter).toHaveLength(65);
    expect(hourOptions(10)[1]).toBe("06:10");
  });
});

describe("a closure", () => {
  it("checks its dates", () => {
    expect(closureDates("", "2026-07-30")).toBe("missing");
    expect(closureDates("2026-07-30", "2026-07-29")).toBe("backwards");
    expect(closureDates("2026-07-30", "2026-07-30")).toBeNull();
    expect(closureDates("2026-07-01", "2026-10-01")).toBe("tooLong");
  });

  it("clashes with BOOKED visits only, in its days, for its clinician", () => {
    const s = useDesk.getState();
    const today = Object.values(s.visits).filter((v) => v.starts_at.startsWith("2026-07-28"));
    const all = closureClashes(Object.values(s.visits), { clinicianId: null, from: TODAY, to: TODAY });
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((v) => v.status === "booked")).toBe(true);
    // Seen, cancelled and in-the-building visits are history, not clashes.
    expect(all.length).toBeLessThan(today.length);
    const one = all[0]!.clinician_id;
    const theirs = closureClashes(Object.values(s.visits), { clinicianId: one, from: TODAY, to: TODAY });
    expect(theirs.every((v) => v.clinician_id === one)).toBe(true);
    expect(theirs.length).toBeLessThan(all.length);
    expect(closureClashes(Object.values(s.visits), { clinicianId: null, from: "2026-07-29", to: "2026-07-29" }).some((v) => v.id === all[0]!.id)).toBe(false);
  });

  it("finds a moved visit's day after the closure, skipping a weekend and a closed day", () => {
    const s = useDesk.getState();
    // Friday 31 July → Monday 3 August (the practice does not open at the weekend).
    expect(nextOpenDay(s, "2026-07-31", null)).toBe("2026-08-03");
    const closed: Closure = { id: 999, client_key: null, clinician_id: null, from_date: "2026-08-03", to_date: "2026-08-03", label: "x", note: null, active: true, created_at: null };
    useDesk.setState({ closures: [...s.closures, closed] });
    expect(nextOpenDay(useDesk.getState(), "2026-07-31", null)).toBe("2026-08-04");
    expect(isOpenDay(useDesk.getState(), "2026-08-03", null)).toBe(false);
  });

  it("compares two answers of clash ids whatever their order", () => {
    expect(sameIds([1, 2, 3], [3, 1, 2])).toBe(true);
    expect(sameIds([1, 2], [1, 2, 3])).toBe(false);
    expect(sameIds([1, 2], [1, 4])).toBe(false);
  });
});

describe("the walk-in's now", () => {
  it("is the grid start holding now, with someone who does the visit and is not busy", () => {
    const s = useDesk.getState();
    const routine = s.visitTypes.find((t) => t.minutes === 15 && !t.new_patients_only)!;
    const got = walkInNow(s, routine.id, null, at);
    // 09:20 on a quarter-hour grid from 08:30 → 09:15, with the first clinician in order who is free then.
    expect(got).toEqual({ startsAt: when(TODAY, "09:15"), clinicianId: s.clinicians.find((c) => c.short_name === "Dr Osei")!.id });
    // A 45-minute visit fits nobody's morning just now.
    expect(walkInNow(s, s.visitTypes.find((t) => t.minutes === 45)!.id, null, at)).toBeNull();
    // Every clinician who does it is busy then → nobody.
    const busy: Record<number, Appointment> = { ...s.visits };
    for (const c of s.links.filter((l) => l.visit_type_id === routine.id)) {
      busy[-c.clinician_id] = { ...Object.values(s.visits)[0]!, id: -c.clinician_id, clinician_id: c.clinician_id, starts_at: when(TODAY, "09:00"), minutes: 60, status: "checked_in" };
    }
    expect(walkInNow({ ...s, visits: busy }, routine.id, null, at)).toBeNull();
  });
  it("is nobody before the practice opens", () => {
    const s = useDesk.getState();
    const routine = s.visitTypes.find((t) => t.minutes === 15 && !t.new_patients_only)!;
    expect(walkInNow(s, routine.id, null, venueStamp(TODAY, "07:00", DEMO_ZONE))).toBeNull();
  });
});

describe("the booking window", () => {
  it("counts the practice's open days from today", () => {
    const s = useDesk.getState();
    const window = s.settings!.booking_days;
    const last = lastBookableDay(s, TODAY)!;
    let open = 0;
    for (let d = TODAY; d <= last; d = addDays(d, 1)) if (isOpenDay({ ...s, closures: [] }, d, null)) open += 1;
    expect(open).toBe(window);
  });
});

describe("next open times", () => {
  it("takes two a day at most, six in all, and names who for 'anyone'", () => {
    const free = (time: string, resource?: number) => ({ time, state: "free" as const, ...(resource === undefined ? {} : { resource }) });
    const days = [
      { day: "2026-07-28", times: [{ time: "09:00", state: "full" as const }, free("09:15", 1), free("09:30", 2), free("09:45", 1)] },
      { day: "2026-07-29", times: [free("08:30", 3)] },
      { day: "2026-07-30", times: [free("08:30", 1), free("08:45", 1), free("09:00", 1)] },
      { day: "2026-07-31", times: [free("08:30", 1), free("08:45", 2), free("09:00", 1)] },
    ];
    const got = pickTimes(days, null);
    expect(got.map((t) => `${t.day} ${t.time}`)).toEqual(["2026-07-28 09:15", "2026-07-28 09:30", "2026-07-29 08:30", "2026-07-30 08:30", "2026-07-30 08:45", "2026-07-31 08:30"]);
    expect(got[1]!.clinicianId).toBe(2);
    expect(got[0]!.startsAt).toBe(when("2026-07-28", "09:15"));
    // A chosen clinician: the server names nobody, the chosen one stands.
    expect(pickTimes([{ day: "2026-07-28", times: [free("10:00")] }], 7)[0]!.clinicianId).toBe(7);
  });
});

describe("Registrations", () => {
  it("puts each item in its tab, oldest first, and drops a first visit its patient cancelled", () => {
    const s = useDesk.getState();
    const items = registrationItems(s, TODAY);
    expect(items.filter((i) => i.tab === "check").length).toBeGreaterThanOrEqual(3);
    expect(items.some((i) => i.kind === "registration" && i.tab === "rang")).toBe(true);
    const first = items.find((i) => i.kind === "visit")!;
    expect(first.tab).toBe("check");
    const since = items.map((i) => i.since ?? "");
    expect([...since].sort()).toEqual(since);
    const cancelled = { ...s.visits[first.id]!, status: "cancelled" as const };
    expect(registrationItems({ ...s, visits: { ...s.visits, [first.id]: cancelled } }, TODAY).some((i) => i.kind === "visit" && i.id === first.id)).toBe(false);
  });

  it("keeps two weeks of handled items in Done", () => {
    const s = useDesk.getState();
    const reg = Object.values(s.registrations)[0]!;
    const recent = { ...reg, status: "accepted" as const, handled_at: when(addDays(TODAY, -3), "10:00") };
    const old = { ...reg, id: 9999, status: "declined" as const, handled_at: when(addDays(TODAY, -20), "10:00") };
    const items = registrationItems({ ...s, registrations: { [recent.id]: recent, [old.id]: old } }, TODAY);
    expect(items.filter((i) => i.kind === "registration").map((i) => [i.id, i.tab])).toEqual([[recent.id, "done"]]);
  });

  it("accepts with a key made from the item: 36 characters, the same every time, different per item", () => {
    const a = acceptKey({ kind: "registration", id: 12 });
    expect(a).toHaveLength(36);
    expect(acceptKey({ kind: "registration", id: 12 })).toBe(a);
    expect(acceptKey({ kind: "visit", id: 12 })).not.toBe(a);
    expect(stepKey(a, "a")).toHaveLength(36);
    expect(stepKey(a, "a")).not.toBe(stepKey(acceptKey({ kind: "registration", id: 13 }), "a"));
  });
});
