/**
 * The sample's supplies: what the practice's rows say about Inventory's.
 *
 * A second sample file, `seeds/clinic.inventory.sample.json`, added with the
 * practice's sample only while Inventory is connected and its own sample is
 * in — every item, batch, kit and place below is a row of Inventory's sample,
 * named by the label Inventory gave it. It says what Wren Calloway's flu jab
 * used, three working days ago: the six lines of the flu vaccination kit, the
 * vaccine from batch FV26A, the plaster marked not used.
 *
 * It also says which kits the nurse's kind of visit offers: two rows of
 * Inventory's `links`, the same an owner makes on the visit type's Stock tab.
 * A link is catalogue, not history — nothing is counted from it — so it is the
 * one table of Inventory's a practice's sample may fill.
 *
 * Sample rows are history: nothing is taken off Inventory's shelf for them,
 * so the counts Inventory's own sample shows do not move.
 */
import { SAMPLE_FORMAT, wall, type SampleRow } from "./sample.ts";

const ref = (label: string) => ({ "@ref": label });

/** The sample visit that carries supply lines, and who recorded them. */
export const SUPPLIES_VISIT = { label: "visit:h-wren", date: "2026-07-23", recordedAt: "11:40", by: "Tom Villaseñor" } as const;
/** Inventory's sample rows this file leans on, by Inventory's own labels. */
export const FLU_KIT = "kit:flu-vaccination";
export const TREATMENT_ROOM = "place:treatment-room";
export const FLU_BATCH = "batch:FV26A";
/** The kind of visit that offers kits, and the kits it offers, in the order the tab shows them. */
export const KITS_VISIT_TYPE = "type:nurse";
export const OFFERED_KITS = [FLU_KIT, "kit:dressing-change"] as const;

export interface SampleSupply {
  /** The item's stock code in Inventory's sample: its label is `item:<sku>`. */
  sku: string;
  qty: number;
  batch?: string;
  notUsed?: true;
}

/** The flu vaccination kit as it was used on the sample visit, in the kit's own order. */
export const FLU_LINES: readonly SampleSupply[] = [
  { sku: "VAC-FLU", qty: 1, batch: FLU_BATCH },
  { sku: "SYR-5", qty: 1 },
  { sku: "NDL-23G", qty: 1 },
  { sku: "SWAB-ALC", qty: 2 },
  { sku: "PLST", qty: 1, notUsed: true },
  { sku: "GLV-M", qty: 1 },
];

export interface SupplySampleBundle {
  format: typeof SAMPLE_FORMAT;
  app: "clinic";
  addOn: "inventory";
  tables: { ref: string; own?: true; rows: SampleRow[] }[];
}

export function buildSupplySample(): SupplySampleBundle {
  const at = wall(SUPPLIES_VISIT.date, SUPPLIES_VISIT.recordedAt);
  return {
    format: SAMPLE_FORMAT,
    app: "clinic",
    addOn: "inventory",
    tables: [
      {
        ref: "links",
        rows: OFFERED_KITS.map((kit) => ({ source_table: { "@table": "visit_types" }, source_row: ref(KITS_VISIT_TYPE), kind: "kit", kit_id: ref(kit) })),
      },
      {
        ref: "appointment_supplies",
        own: true,
        rows: FLU_LINES.map((line) => ({
          appointment_id: ref(SUPPLIES_VISIT.label),
          kit_id: ref(FLU_KIT),
          item_id: ref(`item:${line.sku}`),
          qty: line.qty,
          ...(line.batch === undefined ? {} : { batch_id: ref(line.batch) }),
          ...(line.notUsed === true ? { not_used_at: at } : {}),
          place_id: ref(TREATMENT_ROOM),
          recorded_by: SUPPLIES_VISIT.by,
          recorded_at: at,
        })),
      },
    ],
  };
}
