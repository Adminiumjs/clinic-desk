/**
 * What the desk shows of a visit's supplies, from what Inventory's tables say.
 *
 * The reads are stood in for by rows written here, spelled the three ways the
 * three databases spell them (a count as `8` or `"8.000"`, a yes/no as `true`
 * or `1`, a date as a day or its midnight), because the view is built in the
 * browser from whichever arrives.
 */
import { describe, expect, it } from "vitest";

import type { ListCondition } from "./snapshotPort.ts";
import { loadVisitSupplies, proposalsOf, SuppliesGone, suppliesPort, VISIT_TYPES_REF, type StockReads, type StockTable, type StockWord } from "./supplies.ts";
import type { Id, SupplyLine } from "./types.ts";

type Raw = Record<string, unknown>;
const TODAY = "2026-10-01";
const ROOM = 3;
const SHOP = 1;

const line = (id: number, more: Partial<SupplyLine>): SupplyLine => ({
  id: id as Id,
  appointment_id: 50 as Id,
  kit_id: null,
  item_id: null,
  qty: 1,
  not_used_at: null,
  batch_id: null,
  place_id: ROOM as Id,
  recorded_by: "Tom Villaseñor",
  recorded_at: "2026-10-01T09:00:00.000Z",
  changed_by: null,
  changed_at: null,
  client_key: null,
  ...more,
});

const TABLES: Record<StockTable, Raw[]> = {
  items: [
    { id: 1, name: "Flu vaccine, single dose", unit: "each", decimals: 0, tracks_batches: true, active: true },
    { id: 2, name: "Alcohol swab", unit: "each", decimals: 0, tracks_batches: 0, active: 1 },
    { id: 3, name: "Gloves, nitrile, M", unit: "pair", decimals: "0", tracks_batches: false, active: true },
  ],
  units: [],
  kits: [
    { id: 20, name: "Dressing change", active: true },
    { id: 21, name: "Flu vaccination", active: true },
    { id: 22, name: "Room turnover", active: true },
  ],
  kit_lines: [
    { id: 1, kit_id: 21, item_id: 1, qty: "1.000", per: "unit", action: "use" },
    { id: 2, kit_id: 21, item_id: 2, qty: "2.000", per: "unit", action: "use" },
    { id: 3, kit_id: 20, item_id: 3, qty: 1, per: "unit", action: "use" },
    // A kit that only moves linen holds nothing a visit uses.
    { id: 4, kit_id: 22, item_id: 3, qty: 1, per: "unit", action: "move" },
  ],
  links: [{ id: 1, source_table: VISIT_TYPES_REF, source_row: "7", kind: "kit", kit_id: 21, item_id: null }],
  batches: [
    { id: 30, item_id: 1, code: "-", unassigned: true, expires_on: null },
    { id: 31, item_id: 1, code: "FV26B", unassigned: false, expires_on: "2027-01-15" },
    { id: 32, item_id: 1, code: "FV26A", unassigned: 0, expires_on: "2026-10-27T00:00:00.000Z" },
    { id: 33, item_id: 1, code: "FV25Z", unassigned: false, expires_on: "2026-09-30" },
    { id: 34, item_id: 1, code: "FV26C", unassigned: false, expires_on: "2026-10-05" },
  ],
  levels: [
    { id: 1, stock_point_id: 100, batch_id: 31, qty: "4.000", expires_on: "2027-01-15" },
    { id: 2, stock_point_id: 100, batch_id: 32, qty: 8, expires_on: "2026-10-27" },
    // Past its date yesterday: still on the shelf, never offered.
    { id: 3, stock_point_id: 100, batch_id: 33, qty: 2, expires_on: "2026-09-30" },
    // The soonest of all, and none of it left.
    { id: 4, stock_point_id: 100, batch_id: 34, qty: "0.000", expires_on: "2026-10-05" },
    // Another shelf's.
    { id: 5, stock_point_id: 101, batch_id: 34, qty: 9, expires_on: "2026-10-05" },
  ],
  stock_points: [
    { id: 100, item_id: 1, place_id: ROOM, available: "8.000", low: 1 },
    { id: 101, item_id: 1, place_id: SHOP, available: 40, low: 0 },
    { id: 102, item_id: 2, place_id: ROOM, available: 636, low: 0 },
  ],
  places: [
    { id: ROOM, name: "Treatment room" },
    { id: SHOP, name: "Shop floor" },
  ],
};

/** Enough of the data API's `where` for these rows. */
function matches(row: Raw, where: ListCondition | undefined): boolean {
  if (where === undefined) return true;
  if ("and" in where) return where.and.every((part) => matches(row, part));
  if ("or" in where) return where.or.some((part) => matches(row, part));
  const value = row[where.column];
  if (where.op === "in") return (where.value as unknown[]).map(String).includes(String(value));
  if (where.op === "eq") return typeof where.value === "boolean" ? [true, 1, "1"].includes(value as never) === where.value : String(value) === String(where.value);
  if (where.op === "ilike") return String(value).toLowerCase().includes(String(where.value).replace(/%/g, "").toLowerCase());
  throw new Error(`the stand-in knows no "${where.op}"`);
}

function reads(lines: SupplyLine[], opts: { hidden?: StockTable[]; words?: StockWord[] } = {}): StockReads & { asked: StockTable[] } {
  const asked: StockTable[] = [];
  return {
    asked,
    lines: async () => lines,
    rows: async (table, where) => {
      asked.push(table);
      return opts.hidden?.includes(table) === true ? null : TABLES[table].filter((row) => matches(row, where));
    },
    words: async () => opts.words ?? [],
  };
}

const VISIT = { id: 50 as Id, visitTypeId: 7 as Id };
const CONTEXT = { today: TODAY, defaultPlaceId: null };

describe("the batches a line could come from", () => {
  it("proposes the batch that expires first and never one past its date, nor one with nothing left, nor another shelf's", async () => {
    const view = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id })]), VISIT, CONTEXT);
    expect(view.lines[0]!.proposals.map((batch) => [batch.code, batch.expiresOn])).toEqual([
      ["FV26A", "2026-10-27"],
      ["FV26B", "2027-01-15"],
    ]);
    // Nothing is confirmed for the clinician: the line's own batch stays empty until they say.
    expect(view.lines[0]!.batch).toBeNull();
  });

  it("offers a batch on its last day, and a batch with no date last", () => {
    const batches = new Map([
      [1 as Id, { id: 1 as Id, code: "LAST-DAY", expiresOn: TODAY }],
      [2 as Id, { id: 2 as Id, code: "NO-DATE", expiresOn: null }],
      [3 as Id, { id: 3 as Id, code: "LATER", expiresOn: "2026-12-01" }],
    ]);
    const levels = [1, 2, 3].map((batch) => ({ stock_point_id: 9, batch_id: batch, qty: 1 }));
    expect(proposalsOf(levels, batches, 9 as Id, TODAY).map((batch) => batch.code)).toEqual(["LAST-DAY", "LATER", "NO-DATE"]);
    expect(proposalsOf(levels, batches, null, TODAY)).toEqual([]);
  });

  it("proposes nothing once a batch is confirmed, for an item not kept in batches, or on a line marked not used", async () => {
    const view = await loadVisitSupplies(
      reads([line(1, { item_id: 1 as Id, batch_id: 32 as Id }), line(2, { item_id: 2 as Id }), line(3, { item_id: 1 as Id, not_used_at: "2026-10-01T09:05:00.000Z" })]),
      VISIT,
      CONTEXT,
    );
    expect(view.lines.map((shown) => [shown.batch?.code ?? null, shown.proposals.length, shown.notUsed])).toEqual([
      ["FV26A", 0, false],
      [null, 0, false],
      [null, 0, true],
    ]);
  });
});

describe("what is left", () => {
  it("shows what is left at the line's place, with Inventory's own low mark — never another shelf's figure", async () => {
    const view = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id }), line(2, { item_id: 1 as Id, place_id: SHOP as Id }), line(3, { item_id: 2 as Id })]), VISIT, CONTEXT);
    expect(view.lines.map((shown) => [shown.left, shown.low])).toEqual([
      [8, true],
      [40, false],
      [636, false],
    ]);
  });

  it("reads a line with no place at the practice's own shelf; with neither, at the item's only shelf, or says nothing", async () => {
    const own = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id, place_id: null })]), VISIT, { today: TODAY, defaultPlaceId: SHOP as Id });
    expect(own.lines[0]!.left).toBe(40);
    const none = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id, place_id: null }), line(2, { item_id: 2 as Id, place_id: null })]), VISIT, CONTEXT);
    // The vaccine is on two shelves and nobody said which; the swab is on one.
    expect(none.lines.map((shown) => shown.left)).toEqual([null, 636]);
    // Inventory's own figure for its default place stands in when it gives one.
    const said = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id, place_id: null })], { words: [{ itemId: 1 as Id, exact: "40", batch: null, soon: false }] }), VISIT, CONTEXT);
    expect(said.lines[0]!.left).toBe(40);
  });

  it("names the item and its unit, and shows a line whose item is gone by nothing rather than failing", async () => {
    const view = await loadVisitSupplies(reads([line(1, { item_id: 3 as Id }), line(2, { item_id: 99 as Id })]), VISIT, CONTEXT);
    expect(view.lines.map((shown) => [shown.name, shown.unit, shown.left])).toEqual([
      ["Gloves, nitrile, M", "pair", null],
      ["", "", null],
    ]);
  });
});

describe("the expiry warning", () => {
  const soon: StockWord = { itemId: 1 as Id, exact: "8", batch: "FV26A", soon: true };

  it("is Inventory's own word, kept only for the batch the line shows", async () => {
    const proposed = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id })], { words: [soon] }), VISIT, CONTEXT);
    expect(proposed.lines[0]!.expiresSoon).toBe(true);
    // The clinician confirmed the other batch: the word is about a batch this line does not come from.
    const other = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id, batch_id: 31 as Id })], { words: [soon] }), VISIT, CONTEXT);
    expect(other.lines[0]!.expiresSoon).toBe(false);
    const quiet = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id })], { words: [{ ...soon, soon: false }] }), VISIT, CONTEXT);
    expect(quiet.lines[0]!.expiresSoon).toBe(false);
  });

  it("is not raised for a line marked not used, nor when Inventory says nothing", async () => {
    const view = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id, not_used_at: "2026-10-01T09:05:00.000Z" })], { words: [soon] }), VISIT, CONTEXT);
    expect(view.lines[0]!.expiresSoon).toBe(false);
    expect((await loadVisitSupplies(reads([line(1, { item_id: 1 as Id })]), VISIT, CONTEXT)).lines[0]!.expiresSoon).toBe(false);
  });
});

describe("kits", () => {
  it("offers the visit type's own kits first, then the rest by name, each with the lines pressing it adds — never one that uses nothing", async () => {
    const view = await loadVisitSupplies(reads([]), VISIT, CONTEXT);
    expect(view.kits.map((kit) => [kit.name, kit.linked, kit.added, kit.lines])).toEqual([
      ["Flu vaccination", true, false, [{ itemId: 1, qty: 1 }, { itemId: 2, qty: 2 }]],
      ["Dressing change", false, false, [{ itemId: 3, qty: 1 }]],
    ]);
  });

  it("marks a kit already on the visit, and names it on its lines", async () => {
    const view = await loadVisitSupplies(reads([line(1, { item_id: 1 as Id, kit_id: 21 as Id }), line(2, { item_id: 3 as Id })]), VISIT, CONTEXT);
    expect(view.kits.find((kit) => kit.id === 21)!.added).toBe(true);
    expect(view.lines.map((shown) => shown.kitName)).toEqual(["Flu vaccination", null]);
  });

  it("offers reception none: it reads the lines and their names, not what a kit holds", async () => {
    const asked = reads([line(1, { item_id: 1 as Id, kit_id: 21 as Id })], { hidden: ["links", "kit_lines", "levels"] });
    const view = await loadVisitSupplies(asked, VISIT, { ...CONTEXT, records: false });
    expect(view.kits).toEqual([]);
    // Never asked: a read that is not theirs is not sent to be refused.
    expect(asked.asked.filter((table) => ["links", "kit_lines", "levels"].includes(table))).toEqual([]);
    // And a reader who was not told apart is refused quietly, with the same result.
    expect((await loadVisitSupplies(reads([line(1, { item_id: 1 as Id, kit_id: 21 as Id })], { hidden: ["links", "kit_lines", "levels"] }), VISIT, CONTEXT)).kits).toEqual([]);
    // The line still reads whole: its name, its kit, what is left — and no batch to propose.
    expect([view.lines[0]!.name, view.lines[0]!.kitName, view.lines[0]!.left, view.lines[0]!.proposals]).toEqual(["Flu vaccine, single dose", "Flu vaccination", 8, []]);
  });
});

describe("Inventory not there", () => {
  it("says so when its names cannot be read, so the desk hides the feature rather than showing an empty list", async () => {
    await expect(loadVisitSupplies(reads([], { hidden: ["kits"] }), VISIT, CONTEXT)).rejects.toBeInstanceOf(SuppliesGone);
    await expect(loadVisitSupplies(reads([line(1, { item_id: 1 as Id })], { hidden: ["items"] }), VISIT, CONTEXT)).rejects.toBeInstanceOf(SuppliesGone);
    await expect(suppliesPort(reads([], { hidden: ["items"] })).searchItems("swab")).rejects.toBeInstanceOf(SuppliesGone);
  });
});

describe("adding by hand", () => {
  it("finds active items by a part of their name, and lists the places for the practice's setting", async () => {
    const port = suppliesPort(reads([]));
    expect((await port.searchItems("swab")).map((item) => [item.name, item.unit])).toEqual([["Alcohol swab", "each"]]);
    expect((await port.searchItems("")).length).toBe(3);
    expect((await port.places()).map((place) => place.name)).toEqual(["Treatment room", "Shop floor"]);
  });
});
