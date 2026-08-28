/**
 * THE MERGE, AND THE ONE BUG IT EXISTS TO NOT HAVE.
 *
 * A clinic shuts for reasons that are not public holidays — a training day, a
 * refit, a bereavement — and those are exactly the closures nothing else in the
 * world has a copy of. If an imported day could displace or outrank one
 * somebody at the practice entered, a re-import would silently delete it from
 * any date a curated set happens to name too, and the first anybody would know
 * is a patient at a locked door.
 *
 * Every case below is that sentence, checked. They use a FAKE source rather
 * than the real add-on wherever the subject is a rule, because a rule proved
 * against one add-on's data is a rule proved against one add-on's data; the
 * last block is the one that drives the real one, so the wiring is asserted
 * too.
 */

import { describe, expect, it } from "vitest";

import {
  DAY_SOURCES,
  addOnClosures,
  dormantDayCounts,
  mergeClosures,
  type DaySource,
} from "./closures.ts";
import type { Closure } from "../data/types.ts";

/** A source that answers with whatever its values say, in the add-on's shape. */
const fake = (key: string): DaySource => ({
  addOn: key,
  days: (values) => {
    const raw = (values ?? {})["days"];
    return Array.isArray(raw) ? (raw as { date: string; name: string }[]) : [];
  },
});

const day = (date: string, name: string) => ({ date, name });

const own = (date: string, reason: string, clinician: string | null = null): Closure => ({
  date,
  reason,
  clinician,
  from: null,
});

describe("what an add-on contributes", () => {
  it("contributes nothing at all when nothing is switched on (24 D6)", () => {
    const settings = { cal: { days: [day("2026-12-25", "Christmas Day")] } };
    expect(addOnClosures([fake("cal")], new Set(), settings)).toEqual([]);
  });

  it("contributes nothing for an add-on that has imported nothing", () => {
    expect(addOnClosures([fake("cal")], new Set(["cal"]), {})).toEqual([]);
    expect(addOnClosures([fake("cal")], new Set(["cal"]), { cal: {} })).toEqual([]);
  });

  it("maps a day into this app's own record shape, stamped with the source", () => {
    const settings = { cal: { days: [day("2026-12-25", "Christmas Day")] } };
    expect(addOnClosures([fake("cal")], new Set(["cal"]), settings)).toEqual([
      // The whole practice, because that is what a public holiday is. Never one
      // clinician's day off, which the schema spells with a clinician id.
      { date: "2026-12-25", reason: "Christmas Day", clinician: null, from: "cal" },
    ]);
  });

  it("keeps two sources apart, so each row says which one it came from", () => {
    const settings = {
      cal: { days: [day("2026-12-25", "Christmas Day")] },
      other: { days: [day("2026-12-26", "Boxing Day")] },
    };
    const rows = addOnClosures(
      [fake("cal"), fake("other")],
      new Set(["cal", "other"]),
      settings,
    );
    expect(rows.map((r) => [r.date, r.from])).toEqual([
      ["2026-12-25", "cal"],
      ["2026-12-26", "other"],
    ]);
  });
});

describe("switching an add-on off (24 D16)", () => {
  const settings = { cal: { days: [day("2026-12-25", "Christmas"), day("2026-12-26", "Boxing")] } };

  it("stops applying its days", () => {
    expect(addOnClosures([fake("cal")], new Set(), settings)).toEqual([]);
  });

  it("does not destroy them, and can still say how many are held", () => {
    expect(dormantDayCounts([fake("cal")], new Set(), settings)).toEqual([
      { addOn: "cal", days: 2 },
    ]);
  });

  it("says nothing about an add-on that is switched on", () => {
    expect(dormantDayCounts([fake("cal")], new Set(["cal"]), settings)).toEqual([]);
  });

  it("says nothing about a switched-off add-on holding nothing", () => {
    // A line reading "0 saved days are not being applied" is noise on a screen
    // whose whole job is to be believed about what survived.
    expect(dormantDayCounts([fake("cal")], new Set(), { cal: { days: [] } })).toEqual([]);
  });

  it("brings every day back, unchanged, when it is switched on again", () => {
    const off = addOnClosures([fake("cal")], new Set(), settings);
    const on = addOnClosures([fake("cal")], new Set(["cal"]), settings);
    expect(off).toEqual([]);
    expect(on).toHaveLength(2);
    expect(addOnClosures([fake("cal")], new Set(["cal"]), settings)).toEqual(on);
  });
});

describe("merging, which never loses the practice's own day", () => {
  it("keeps both rows when an imported day lands on one somebody entered", () => {
    const merged = mergeClosures(
      [own("2026-12-25", "Refit — no clinicians on site")],
      [{ date: "2026-12-25", reason: "Christmas Day", clinician: null, from: "cal" }],
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((c) => c.from)).toEqual([null, "cal"]);
  });

  it("puts the practice's own first on a shared date, whatever it is called", () => {
    // "Zulu" sorts after "Alpha", so a sort that stopped at the reason would
    // show the imported name as the day's reason on the day sheet.
    const merged = mergeClosures(
      [own("2026-12-25", "Zulu")],
      [{ date: "2026-12-25", reason: "Alpha", clinician: null, from: "cal" }],
    );
    expect(merged[0]!.reason).toBe("Zulu");
  });

  it("never drops a row, however many share a date", () => {
    const mine = [own("2026-12-25", "Refit"), own("2026-12-25", "Stocktake", "nadia")];
    const theirs = [
      { date: "2026-12-25", reason: "Christmas Day", clinician: null, from: "cal" },
      { date: "2026-12-25", reason: "Christmas", clinician: null, from: "other" },
    ];
    expect(mergeClosures(mine, theirs)).toHaveLength(4);
  });

  it("is the identity on the practice's own list when nothing is connected", () => {
    const mine = [own("2026-08-03", "Training"), own("2026-08-04", "Refit")];
    expect(mergeClosures(mine, [])).toEqual(mine);
  });

  it("orders by content, so re-importing the same set changes nothing", () => {
    const mine = [own("2026-12-25", "Refit")];
    const theirs = [
      { date: "2026-12-26", reason: "Boxing Day", clinician: null, from: "cal" },
      { date: "2026-12-25", reason: "Christmas Day", clinician: null, from: "cal" },
    ];
    const first = mergeClosures(mine, theirs);
    const again = mergeClosures(mine, [...theirs].reverse());
    expect(again).toEqual(first);
  });
});

describe("the real add-on, through the real seam", () => {
  /*
   * The rules above are proved against a fake so that they are rules rather
   * than observations about one package. This block drives what actually ships:
   * `DAY_SOURCES` holds the real `nonWorkingDays`, and the values below are the
   * `days` setting the add-on's own `manifest.json` declares — a `json` setting
   * listed in `publicSettings`, so building one here is using a documented
   * public shape rather than reaching into the add-on's private storage.
   */
  const key = DAY_SOURCES[0]!.addOn;

  it("answers [] for an add-on that has imported nothing", () => {
    expect(addOnClosures(DAY_SOURCES, new Set([key]), {})).toEqual([]);
    expect(addOnClosures(DAY_SOURCES, new Set([key]), { [key]: { days: [] } })).toEqual([]);
  });

  it("turns days it holds into this practice's closures", () => {
    const settings = {
      [key]: {
        days: [
          { date: "2026-12-26", name: "Boxing Day", from: { country: "GB", year: 2026 } },
          { date: "2026-12-25", name: "Christmas Day", from: { country: "GB", year: 2026 } },
        ],
      },
    };
    expect(addOnClosures(DAY_SOURCES, new Set([key]), settings)).toEqual([
      { date: "2026-12-25", reason: "Christmas Day", clinician: null, from: key },
      { date: "2026-12-26", reason: "Boxing Day", clinician: null, from: key },
    ]);
  });

  it("drops the add-on's own record of WHICH set a day came from", () => {
    /*
     * `NonWorkingDay.from` carries a country and a year. This app's `Closure`
     * has no room for either and wants none: its question is only "did somebody
     * here type this", and storing a shape the add-on expects to change would
     * couple two apps to it.
     */
    const settings = {
      [key]: { days: [{ date: "2026-12-25", name: "X", from: { country: "GB", year: 2026 } }] },
    };
    const row = addOnClosures(DAY_SOURCES, new Set([key]), settings)[0]!;
    expect(Object.keys(row).sort()).toEqual(["clinician", "date", "from", "reason"]);
    expect(row.from).toBe(key);
  });
});
