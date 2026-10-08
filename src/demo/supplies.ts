/**
 * The demo's supplies: a small shelf of its own.
 *
 * On a real install a visit's supplies are counted by Inventory, an add-on the
 * practice connects. The website's demo has no server and no add-on, so this
 * file is the shelf: a dozen treatment-room items, two kits, one batch of flu
 * vaccine that runs out soon — the demo's own figures, fixed, like every other
 * figure the demo shows. Nothing here asks anything of an add-on.
 *
 * The lines themselves are rows of the demo's practice (`db.ts`), under the
 * rules a real install keeps: a kit's item once a visit, who recorded it, and
 * a line closed once its visit is seen. What the shelf holds does not move in
 * the demo: "8 left" stays 8, because counting stock is Inventory's work and
 * the demo does not pretend to do it.
 *
 * Only the demo build contains this.
 */
import type { ListCondition } from "../data/snapshotPort.ts";
import { VISIT_TYPES_REF, suppliesPort, type StockReads, type StockTable, type SuppliesPort } from "../data/supplies.ts";
import type { Id, SupplyLine } from "../data/types.ts";
import { addDays } from "../data/venueTime.ts";
import { locale } from "../i18n/ambient.ts";
import type { DemoDb, Writer } from "./db.ts";
import { todayIn } from "./db.ts";

type Raw = Record<string, unknown>;

/** The sample's seen flu jab (Wren Calloway, three working days back), by the reference the sample gives it. */
export const DEMO_SUPPLIES_VISIT = "RH-SPCR";
/** The treatment room: the one place the demo's supplies come off. */
export const DEMO_ROOM = { id: 1 as Id, name: "Treatment room" };
/** The flu vaccine's one batch, and how many days from the demo's day it runs out. */
export const DEMO_FLU_BATCH = { id: 1 as Id, code: "FV26A", expiresInDays: 21 };

/** [id, name, unit, left, low, kept in batches] */
const ITEMS: readonly [number, string, string, number, boolean, boolean][] = [
  [1, "Flu vaccine, single dose", "each", 8, true, true],
  [2, "Syringe 5 ml", "each", 124, false, false],
  [3, "Needle 23G", "each", 152, false, false],
  [4, "Alcohol swab", "each", 636, false, false],
  [5, "Plaster strip", "each", 144, false, false],
  [6, "Gloves, nitrile, M", "pair", 240, false, false],
  [7, "Gauze pad, sterile", "each", 72, false, false],
  [8, "Saline ampoule 10 ml", "each", 96, false, false],
  [9, "Syringe 10 ml", "each", 88, false, false],
  [10, "Gloves, nitrile, L", "pair", 96, true, false],
  [11, "Lidocaine 1% ampoule", "each", 14, true, false],
  [12, "Sharps bin 1 l", "each", 6, false, false],
];

export const DEMO_FLU_KIT = { id: 1 as Id, name: "Flu vaccination", lines: [[1, 1], [2, 1], [3, 1], [4, 2], [5, 1], [6, 1]] as const };
const DRESSING_KIT = { id: 2 as Id, name: "Dressing change", lines: [[7, 2], [8, 1], [5, 2], [6, 1]] as const };
const KITS = [DEMO_FLU_KIT, DRESSING_KIT];

/**
 * The shelf's words in the seven languages beside English. On a real install
 * these are the practice's own rows in Inventory, written in its own language;
 * the demo changes language under the visitor, so its shelf speaks all eight.
 */
const WORDS: Record<string, Partial<Record<string, string>>> = {
  "Flu vaccine, single dose": { "de-DE": "Grippeimpfstoff, Einzeldosis", "fr-FR": "Vaccin antigrippal, dose unique", "da-DK": "Influenzavaccine, enkeltdosis", "cs-CZ": "Vakcína proti chřipce, jedna dávka", "ar-EG": "لقاح الإنفلونزا، جرعة واحدة", "zh-CN": "流感疫苗，单剂", "zh-TW": "流感疫苗，單劑" },
  "Syringe 5 ml": { "de-DE": "Spritze 5 ml", "fr-FR": "Seringue 5 ml", "da-DK": "Sprøjte 5 ml", "cs-CZ": "Stříkačka 5 ml", "ar-EG": "محقنة 5 مل", "zh-CN": "注射器 5 毫升", "zh-TW": "針筒 5 毫升" },
  "Needle 23G": { "de-DE": "Kanüle 23G", "fr-FR": "Aiguille 23G", "da-DK": "Kanyle 23G", "cs-CZ": "Jehla 23G", "ar-EG": "إبرة 23G", "zh-CN": "针头 23G", "zh-TW": "針頭 23G" },
  "Alcohol swab": { "de-DE": "Alkoholtupfer", "fr-FR": "Tampon d’alcool", "da-DK": "Spritserviet", "cs-CZ": "Alkoholový tampon", "ar-EG": "مسحة كحول", "zh-CN": "酒精棉片", "zh-TW": "酒精棉片" },
  "Plaster strip": { "de-DE": "Pflasterstreifen", "fr-FR": "Pansement adhésif", "da-DK": "Plaster", "cs-CZ": "Náplast", "ar-EG": "لاصق طبي", "zh-CN": "创可贴", "zh-TW": "OK 繃" },
  "Gloves, nitrile, M": { "de-DE": "Nitrilhandschuhe, M", "fr-FR": "Gants nitrile, M", "da-DK": "Nitrilhandsker, M", "cs-CZ": "Nitrilové rukavice, M", "ar-EG": "قفازات نتريل، M", "zh-CN": "丁腈手套，M", "zh-TW": "丁腈手套，M" },
  "Gauze pad, sterile": { "de-DE": "Mullkompresse, steril", "fr-FR": "Compresse de gaze stérile", "da-DK": "Gazekompres, steril", "cs-CZ": "Gázový čtverec, sterilní", "ar-EG": "ضمادة شاش معقّمة", "zh-CN": "无菌纱布垫", "zh-TW": "無菌紗布墊" },
  "Saline ampoule 10 ml": { "de-DE": "Kochsalzampulle 10 ml", "fr-FR": "Ampoule de sérum physiologique 10 ml", "da-DK": "Saltvandsampul 10 ml", "cs-CZ": "Ampule fyziologického roztoku 10 ml", "ar-EG": "أمبولة محلول ملحي 10 مل", "zh-CN": "生理盐水安瓿 10 毫升", "zh-TW": "生理食鹽水安瓿 10 毫升" },
  "Syringe 10 ml": { "de-DE": "Spritze 10 ml", "fr-FR": "Seringue 10 ml", "da-DK": "Sprøjte 10 ml", "cs-CZ": "Stříkačka 10 ml", "ar-EG": "محقنة 10 مل", "zh-CN": "注射器 10 毫升", "zh-TW": "針筒 10 毫升" },
  "Gloves, nitrile, L": { "de-DE": "Nitrilhandschuhe, L", "fr-FR": "Gants nitrile, L", "da-DK": "Nitrilhandsker, L", "cs-CZ": "Nitrilové rukavice, L", "ar-EG": "قفازات نتريل، L", "zh-CN": "丁腈手套，L", "zh-TW": "丁腈手套，L" },
  "Lidocaine 1% ampoule": { "de-DE": "Lidocain 1 % Ampulle", "fr-FR": "Ampoule de lidocaïne 1 %", "da-DK": "Lidokain 1 % ampul", "cs-CZ": "Lidokain 1% ampule", "ar-EG": "أمبولة ليدوكايين 1٪", "zh-CN": "利多卡因 1% 安瓿", "zh-TW": "利多卡因 1% 安瓿" },
  "Sharps bin 1 l": { "de-DE": "Kanülenabwurfbehälter 1 l", "fr-FR": "Collecteur d’aiguilles 1 l", "da-DK": "Kanyleboks 1 l", "cs-CZ": "Nádoba na ostré předměty 1 l", "ar-EG": "حاوية الأدوات الحادة 1 لتر", "zh-CN": "锐器盒 1 升", "zh-TW": "銳器盒 1 公升" },
  "each": { "de-DE": "Stück", "fr-FR": "pièce", "da-DK": "stk.", "cs-CZ": "ks", "ar-EG": "قطعة", "zh-CN": "个", "zh-TW": "個" },
  "pair": { "de-DE": "Paar", "fr-FR": "paire", "da-DK": "par", "cs-CZ": "pár", "ar-EG": "زوج", "zh-CN": "副", "zh-TW": "雙" },
  "Flu vaccination": { "de-DE": "Grippeimpfung", "fr-FR": "Vaccination antigrippale", "da-DK": "Influenzavaccination", "cs-CZ": "Očkování proti chřipce", "ar-EG": "تطعيم الإنفلونزا", "zh-CN": "流感疫苗接种", "zh-TW": "流感疫苗接種" },
  "Dressing change": { "de-DE": "Verbandwechsel", "fr-FR": "Changement de pansement", "da-DK": "Forbindingsskift", "cs-CZ": "Převaz", "ar-EG": "تغيير الضمادة", "zh-CN": "换药", "zh-TW": "換藥" },
  "Treatment room": { "de-DE": "Behandlungsraum", "fr-FR": "Salle de soins", "da-DK": "Behandlingsrum", "cs-CZ": "Ošetřovna", "ar-EG": "غرفة العلاج", "zh-CN": "治疗室", "zh-TW": "治療室" },
};
const said = (english: string): string => WORDS[english]?.[locale()] ?? english;

/** Enough of the data API's `where` for the demo's shelf. */
function matches(row: Raw, where: ListCondition | undefined): boolean {
  if (where === undefined) return true;
  if ("and" in where) return where.and.every((part) => matches(row, part));
  if ("or" in where) return where.or.some((part) => matches(row, part));
  const value = row[where.column];
  switch (where.op) {
    case "in":
      return (where.value as unknown[]).map(String).includes(String(value));
    case "eq":
      return String(value) === String(where.value);
    case "ilike":
      return String(value).toLowerCase().includes(String(where.value).replace(/%/g, "").toLowerCase());
    default:
      return true;
  }
}

/** The shelf as Inventory's tables would hold it; the nurse's visit type offers both kits. */
function shelf(db: DemoDb): Record<StockTable, Raw[]> {
  // The visit type that covers a dressing and a jab: the last of the sample's four.
  const nurse = [...db.rows.visit_types].sort((a, b) => b.position - a.position)[0];
  const expires = addDays(todayIn(db), DEMO_FLU_BATCH.expiresInDays);
  return {
    items: ITEMS.map(([id, name, unit, , , batches]) => ({ id, name: said(name), unit: said(unit), decimals: 0, tracks_batches: batches, active: true })),
    units: [],
    kits: KITS.map((kit) => ({ id: kit.id, name: said(kit.name), active: true })),
    kit_lines: KITS.flatMap((kit) => kit.lines.map(([item, qty], index) => ({ id: Number(kit.id) * 100 + index, kit_id: kit.id, item_id: item, qty, per: "unit", action: "use" }))),
    links: nurse === undefined ? [] : KITS.map((kit) => ({ id: kit.id, source_table: VISIT_TYPES_REF, source_row: String(nurse.id), kind: "kit", kit_id: kit.id, item_id: null })),
    batches: [{ id: DEMO_FLU_BATCH.id, item_id: 1, code: DEMO_FLU_BATCH.code, unassigned: false, expires_on: expires }],
    levels: [{ id: 1, stock_point_id: 1, batch_id: DEMO_FLU_BATCH.id, qty: 8, expires_on: expires }],
    stock_points: ITEMS.map(([id, , , left, low]) => ({ id, item_id: id, place_id: DEMO_ROOM.id, available: left, low: low ? 1 : 0 })),
    places: [{ id: DEMO_ROOM.id, name: said(DEMO_ROOM.name) }],
  };
}

export function demoStockReads(db: DemoDb): StockReads {
  return {
    lines: async (visitId) => structuredClone(db.rows.appointment_supplies.filter((line) => line.appointment_id === visitId).sort((a, b) => Number(a.id) - Number(b.id))),
    rows: async (table, where, _order, limit = 200) => {
      const found = shelf(db)[table].filter((row) => matches(row, where));
      return (table === "items" || table === "kits" ? found.sort((a, b) => String(a["name"]).localeCompare(String(b["name"]))) : found).slice(0, limit);
    },
    // The one word the shelf has to say: the vaccine's batch runs out soon.
    words: async (itemIds) => (itemIds.includes(1 as Id) ? [{ itemId: 1 as Id, exact: "8", batch: DEMO_FLU_BATCH.code, soon: true }] : []),
  };
}

export function demoSuppliesPort(db: DemoDb): SuppliesPort {
  return suppliesPort(demoStockReads(db));
}

/**
 * What the sample's flu jab used, three working days before the demo's day:
 * the flu kit's six lines as the nurse recorded them — the vaccine from its
 * batch, the plaster not used — so the Supplies tab of a seen visit has
 * something to show the moment the demo opens. Written as history: straight
 * into the practice's rows, as Adminium writes a sample.
 */
export function seedDemoSupplies(db: DemoDb, visit: { id: Id; seenAt: string | null; by: string }): void {
  if (db.rows.appointment_supplies.some((line) => line.appointment_id === visit.id)) return;
  let next = db.rows.appointment_supplies.reduce((most, line) => Math.max(most, Number(line.id)), 0);
  for (const [item, qty] of DEMO_FLU_KIT.lines) {
    next += 1;
    const line: SupplyLine = {
      id: next as Id,
      appointment_id: visit.id,
      kit_id: DEMO_FLU_KIT.id,
      item_id: item as Id,
      qty,
      // The plaster stayed in its wrapper.
      not_used_at: item === 5 ? visit.seenAt : null,
      batch_id: item === 1 ? DEMO_FLU_BATCH.id : null,
      place_id: DEMO_ROOM.id,
      recorded_by: visit.by,
      recorded_at: visit.seenAt,
      changed_by: null,
      changed_at: null,
      client_key: null,
    };
    db.rows.appointment_supplies.push(line);
  }
}

/** The demo's signed-in person, for the tests that write as them. */
export const demoWriter = (name: string): Writer => ({ origin: "desk", name });
