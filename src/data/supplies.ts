/**
 * A visit's supplies, as the desk reads them.
 *
 * The lines are the practice's own rows (`appointment_supplies`): a link to an
 * item, how many, the batch once confirmed. Everything said ABOUT a line —
 * the item's name and unit, what is left where it is taken from, the batch to
 * propose — is Inventory's, read from Inventory's own tables on the same
 * connection, under the reads the signed-in person's role was given there
 * (names for reception; kits, links and what each batch holds for the
 * clinician and the manager; never a cost for anyone).
 *
 * NOTHING HERE IS WORKED OUT that a count depends on. "8 left" is the stock
 * point's own `available`; "low" is its own flag; "expires soon" is the word
 * Inventory answers for the item (the staff stock words), kept only when the
 * batch it speaks of is the one the line shows. The one thing the page
 * decides is the ORDER of the batches offered — the one that expires first,
 * never one already past its date — which is the order Inventory itself takes
 * stock in, so the proposal is what would be taken.
 *
 * Inventory may not be there: not installed, not connected to this app, or
 * disconnected while the desk is open. A read of its tables then answers 403
 * or 404, and `load` throws `SuppliesGone`: the desk hides the feature.
 */
import type { SessionTransport } from "./sessionSource.ts";
import type { ListCondition } from "./snapshotPort.ts";
import { normaliseAll } from "./rows.ts";
import type { Day, Id, SupplyLine } from "./types.ts";

/** Inventory's tables this app reads, by Inventory's own short names. */
export type StockTable = "items" | "units" | "kits" | "kit_lines" | "links" | "batches" | "levels" | "stock_points" | "places";

/** The name a link in Inventory keeps for this app's visit types: the app's key, then the table. */
export const VISIT_TYPES_REF = "clinic:visit_types";

type Raw = Record<string, unknown>;

/** The reads the view is built from. A table the person may not read answers `null`. */
export interface StockReads {
  lines(visitId: Id): Promise<SupplyLine[]>;
  rows(table: StockTable, where?: ListCondition, order?: string, limit?: number): Promise<Raw[] | null>;
  /** What Inventory says of each item at its default place; empty when it says nothing to this person. */
  words(itemIds: readonly Id[]): Promise<StockWord[]>;
}

/** Inventory's own word on one item (the staff stock words). */
export interface StockWord {
  itemId: Id;
  /** What is left, as Inventory writes the figure. */
  exact: string | null;
  /** The batch a use would take, by its code. */
  batch: string | null;
  /** Whether that batch expires soon, by Inventory's own judgement. */
  soon: boolean;
}

export class SuppliesGone extends Error {
  constructor() {
    super("Inventory is not here for this app.");
    this.name = "SuppliesGone";
  }
}

export interface Batch {
  id: Id;
  code: string;
  /** The day it expires; null for one that does not. */
  expiresOn: Day | null;
}

/** One line as a screen shows it. */
export interface SupplyView {
  line: SupplyLine;
  /** The item's name; empty when Inventory no longer has it (the line then shows its number). */
  name: string;
  unit: string;
  decimals: number;
  tracksBatches: boolean;
  kitName: string | null;
  notUsed: boolean;
  /** What is left where this line is taken from; null when Inventory does not say. */
  left: number | null;
  /** Inventory's own low mark for that place. */
  low: boolean;
  /** The batch the clinician confirmed. */
  batch: Batch | null;
  /** For an unconfirmed line of an item kept in batches: the batches it could come from, the one that expires first at the top. */
  proposals: Batch[];
  /** The batch this line shows (confirmed, or the first proposed) expires soon. */
  expiresSoon: boolean;
}

export interface KitOffer {
  id: Id;
  name: string;
  /** Linked to this visit's type: offered without being asked for. */
  linked: boolean;
  /** The lines pressing it would add, in the kit's order. */
  lines: { itemId: Id; qty: number }[];
  /** Already on the visit, every line of it. */
  added: boolean;
}

export interface VisitSupplies {
  visitId: Id;
  lines: SupplyView[];
  /** Every kit the practice keeps, the visit type's own first. Empty for a reader who does not record. */
  kits: KitOffer[];
}

export interface StockItem {
  id: Id;
  name: string;
  unit: string;
}

export interface LoadContext {
  today: Day;
  /** The practice's own shelf (its setting), for a line that names none. */
  defaultPlaceId: Id | null;
  /**
   * Whether the reader records supplies. Someone who only reads them (reception)
   * is not asked what a kit holds or which batch to propose: those reads are
   * not theirs, and asking would only be refused.
   */
  records?: boolean;
}

export interface SuppliesPort {
  /** Everything the Supplies tab of one visit shows. Throws `SuppliesGone` when Inventory is not there. */
  load(visit: { id: Id; visitTypeId: Id }, context: LoadContext): Promise<VisitSupplies>;
  /** Items to add by hand: the active ones whose name holds `text`, by name. */
  searchItems(text: string): Promise<StockItem[]>;
  /** The places supplies can be taken from (the Settings picker). */
  places(): Promise<{ id: Id; name: string }[]>;
}

const num = (value: unknown): number => (typeof value === "number" ? value : Number(value));
const id = (value: unknown): Id | null => (value === null || value === undefined || value === "" ? null : (num(value) as Id));
const yes = (value: unknown): boolean => value === true || value === 1 || value === "1" || value === "t" || value === "true";
const text = (value: unknown): string => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
/** A date column as the three databases spell it → `YYYY-MM-DD`. */
const day = (value: unknown): Day | null => {
  if (value === null || value === undefined || value === "") return null;
  const spelled = value instanceof Date ? value.toISOString() : String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(spelled) ? spelled.slice(0, 10) : null;
};
const oneOf = (column: string, ids: readonly Id[]): ListCondition => ({ column, op: "in", value: [...new Set(ids)] });
const CHUNK = 100;

/**
 * The batches a line could be taken from, as Inventory takes them: at the
 * line's place, with something left, not past their date, the one that
 * expires first at the top (one with no date last), then the older batch.
 */
export function proposalsOf(levels: readonly Raw[], batches: ReadonlyMap<Id, Batch>, pointId: Id | null, today: Day): Batch[] {
  if (pointId === null) return [];
  return levels
    .filter((level) => id(level["stock_point_id"]) === pointId && num(level["qty"]) > 0)
    .flatMap((level) => {
      const batch = batches.get(id(level["batch_id"]) ?? -1);
      return batch === undefined ? [] : [batch];
    })
    .filter((batch) => batch.expiresOn === null || batch.expiresOn >= today)
    .sort((a, b) => (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31") || Number(a.id) - Number(b.id));
}

/** The view of one visit's supplies, from the reads. */
export async function loadVisitSupplies(reads: StockReads, visit: { id: Id; visitTypeId: Id }, context: LoadContext): Promise<VisitSupplies> {
  const lines = await reads.lines(visit.id);
  const records = context.records !== false;
  // Which kits this visit's type offers, and what each holds. Only someone who records reads these.
  const [kitRows, linkRows] = await Promise.all([
    reads.rows("kits", { column: "active", op: "eq", value: true }, "name.asc", 200),
    records ? reads.rows("links", { and: [{ column: "source_table", op: "eq", value: VISIT_TYPES_REF }, { column: "source_row", op: "eq", value: String(visit.visitTypeId) }, { column: "kind", op: "eq", value: "kit" }] }) : Promise.resolve(null),
  ]);
  // The kits are names: a person with a clinic role reads them whenever Inventory is here for this app.
  if (kitRows === null) throw new SuppliesGone();
  const linked = new Set((linkRows ?? []).map((link) => id(link["kit_id"])).filter((kit): kit is Id => kit !== null));
  const kitIds = kitRows.map((kit) => id(kit["id"])!);
  const kitLines = linkRows === null || kitIds.length === 0 ? [] : ((await reads.rows("kit_lines", { and: [oneOf("kit_id", kitIds), { column: "action", op: "eq", value: "use" }] }, "id.asc", 1000)) ?? []);

  const itemIds = [...new Set(lines.map((line) => line.item_id).filter((item): item is Id => item !== null))];
  const none: Raw[] = [];
  const [items, points, batchRows, words] =
    itemIds.length === 0
      ? [none, none, none, [] as StockWord[]]
      : await Promise.all([
          reads.rows("items", oneOf("id", itemIds)),
          reads.rows("stock_points", oneOf("item_id", itemIds), undefined, 1000),
          reads.rows("batches", oneOf("item_id", itemIds), undefined, 1000),
          reads.words(itemIds).catch(() => [] as StockWord[]),
        ]);
  if (items === null) throw new SuppliesGone();
  const pointIds = (points ?? []).map((point) => id(point["id"])!);
  const levels = pointIds.length === 0 || !records ? [] : ((await reads.rows("levels", oneOf("stock_point_id", pointIds), undefined, 1000)) ?? []);

  const itemOf = new Map(items.map((item) => [id(item["id"])!, item]));
  const kitName = new Map(kitRows.map((kit) => [id(kit["id"])!, text(kit["name"])]));
  const batches = new Map<Id, Batch>(
    (batchRows ?? []).filter((batch) => !yes(batch["unassigned"])).map((batch) => [id(batch["id"])!, { id: id(batch["id"])!, code: text(batch["code"]), expiresOn: day(batch["expires_on"]) }]),
  );
  const wordOf = new Map(words.map((word) => [word.itemId, word]));

  const views = lines.map((line): SupplyView => {
    const item = line.item_id === null ? undefined : itemOf.get(line.item_id);
    const mine = (points ?? []).filter((point) => id(point["item_id"]) === line.item_id);
    const placeId = line.place_id ?? context.defaultPlaceId;
    // The place the line names (or the practice's own); with neither, the item's only shelf, if it has just one.
    const point = placeId !== null ? mine.find((candidate) => id(candidate["place_id"]) === placeId) : mine.length === 1 ? mine[0] : undefined;
    const word = line.item_id === null ? undefined : wordOf.get(line.item_id);
    const tracksBatches = item !== undefined && yes(item["tracks_batches"]);
    const notUsed = line.not_used_at !== null;
    const batch = line.batch_id === null ? null : (batches.get(line.batch_id) ?? null);
    const proposals = tracksBatches && batch === null && !notUsed ? proposalsOf(levels, batches, point === undefined ? null : id(point["id"]), context.today) : [];
    const shown = batch ?? proposals[0] ?? null;
    // With no shelf to read, Inventory's own figure for its default place stands in.
    const left = point !== undefined ? num(point["available"]) : placeId === null && word?.exact != null ? Number(word.exact) : null;
    return {
      line,
      name: item === undefined ? "" : text(item["name"]),
      unit: item === undefined ? "" : text(item["unit"]),
      decimals: item === undefined ? 0 : num(item["decimals"] ?? 0),
      tracksBatches,
      kitName: line.kit_id === null ? null : (kitName.get(line.kit_id) ?? null),
      notUsed,
      left: left === null || !Number.isFinite(left) ? null : left,
      low: point !== undefined && num(point["low"]) === 1,
      batch,
      proposals,
      expiresSoon: !notUsed && shown !== null && word !== undefined && word.soon && word.batch === shown.code,
    };
  });

  const kits: KitOffer[] =
    linkRows === null
      ? []
      : kitRows
          .map((kit) => {
            const kitId = id(kit["id"])!;
            // A kit that lists an item twice asks for it once, with both amounts: a visit holds an item of a kit once.
            const amounts = new Map<Id, number>();
            for (const line of kitLines) {
              const item = id(line["item_id"]);
              if (id(line["kit_id"]) === kitId && item !== null) amounts.set(item, (amounts.get(item) ?? 0) + num(line["qty"]));
            }
            const held = new Set(lines.filter((line) => line.kit_id === kitId).map((line) => line.item_id));
            return {
              id: kitId,
              name: text(kit["name"]),
              linked: linked.has(kitId),
              lines: [...amounts].map(([itemId, qty]) => ({ itemId, qty })),
              // Whole only when every thing in it is on the visit: a kit half added can be pressed again for the rest.
              added: amounts.size > 0 && [...amounts.keys()].every((item) => held.has(item)),
            };
          })
          .filter((kit) => kit.lines.length > 0)
          .sort((a, b) => Number(b.linked) - Number(a.linked) || a.name.localeCompare(b.name));
  return { visitId: visit.id, lines: views, kits };
}

/** The port over reads: the hosted desk's and the tests' alike. */
export function suppliesPort(reads: StockReads): SuppliesPort {
  return {
    load: (visit, context) => loadVisitSupplies(reads, visit, context),
    async searchItems(typed) {
      const wanted = typed.trim();
      const found = await reads.rows(
        "items",
        wanted === "" ? { column: "active", op: "eq", value: true } : { and: [{ column: "active", op: "eq", value: true }, { column: "name", op: "ilike", value: `%${wanted.replace(/[%_\\]/g, "")}%` }] },
        "name.asc",
        20,
      );
      if (found === null) throw new SuppliesGone();
      return found.map((item) => ({ id: id(item["id"])!, name: text(item["name"]), unit: text(item["unit"]) }));
    },
    async places() {
      const found = await reads.rows("places", undefined, "name.asc", 200);
      if (found === null) throw new SuppliesGone();
      return found.map((place) => ({ id: id(place["id"])!, name: text(place["name"]) }));
    },
  };
}

interface ErrorLike {
  status?: number;
}

/**
 * The reads of a hosted desk: the practice's own lines through the desk's
 * session port, and Inventory's tables by their real names — `inventory_`
 * then the short name, on the app's own connection, where Adminium puts an
 * add-on connected to this app.
 */
export function sessionStockReads(transport: SessionTransport): StockReads {
  const list = async (table: StockTable, where: ListCondition | undefined, order: string | undefined, limit: number): Promise<Raw[] | null> => {
    const conn = await transport.connection();
    const out: Raw[] = [];
    try {
      for (let offset = 0; offset < limit; offset += 200) {
        const size = Math.min(200, limit - offset);
        let query = `limit=${String(size)}&offset=${String(offset)}`;
        if (where !== undefined) query += `&where=${encodeURIComponent(JSON.stringify(where))}`;
        if (order !== undefined) query += `&order=${encodeURIComponent(order)}`;
        const page = (await transport.get<{ data?: Raw[] }>(`/api/v1/data/${encodeURIComponent(conn)}/inventory_${table}?${query}`)).data ?? [];
        out.push(...page);
        if (page.length < size) break;
      }
    } catch (error) {
      // Not this person's to read, or not here at all: the caller decides what that hides.
      const status = (error as ErrorLike).status;
      if (status === 403 || status === 404) return null;
      throw error;
    }
    return out;
  };
  return {
    async lines(visitId) {
      const found = await transport.port.list<Raw>("appointment_supplies", { limit: 200, offset: 0, where: { column: "appointment_id", op: "eq", value: visitId }, order: "id.asc" });
      return normaliseAll("appointment_supplies", found.data);
    },
    async rows(table, where, order, limit = 200) {
      // A long list of keys goes in pieces, so no address grows past what a server reads.
      if (where !== undefined && "op" in where && where.op === "in" && Array.isArray(where.value) && where.value.length > CHUNK) {
        const out: Raw[] = [];
        for (let at = 0; at < where.value.length; at += CHUNK) {
          const part = await list(table, { ...where, value: where.value.slice(at, at + CHUNK) }, order, limit);
          if (part === null) return null;
          out.push(...part);
        }
        return out;
      }
      return list(table, where, order, limit);
    },
    async words(itemIds) {
      if (itemIds.length === 0) return [];
      const reply = await transport.get<{ data?: { id: string; exact?: string; batch?: string; soon?: boolean }[] }>(
        `/api/v1/words/inventory/item?table=${encodeURIComponent("inventory:items")}&ids=${encodeURIComponent(itemIds.slice(0, 50).join(","))}`,
      );
      return (reply.data ?? []).map((word) => ({ itemId: Number(word.id) as Id, exact: word.exact ?? null, batch: word.batch ?? null, soon: word.soon === true }));
    },
  };
}
