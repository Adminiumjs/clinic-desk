/**
 * Who may do what, enforced by Adminium on every read and write.
 *
 *   reception   runs the desk and the Records pages; cannot void a payment,
 *               write off, change the hours or the desk settings (those are managers', and the
 *               desk hides their buttons from everyone else);
 *   clinician   the day sheet and the waiting room: reads the day and moves a
 *               visit along — roomed → with them → ready, and the server
 *               refuses anything else (`limits`);
 *   manager     everything, the Manage pages included;
 *   kiosk       the arrivals tablet at the door: its sign-in opens the kiosk
 *               screen and nothing else — no table at all. The tablet checks
 *               people in through its own browser key, which answers only
 *               beside this sign-in (`publicKeys` in `public.ts`).
 *
 * The desk shows or hides a button by the role, but the grant below is what
 * refuses the write — a hidden button is not a lock.
 */
import { PAGE_REFS } from "./pages.ts";
import { TABLES } from "./tables.ts";

const read = (table: string) => `table:@${table}:read`;
const grant = (table: string, ...actions: string[]) => actions.map((action) => `table:@${table}:${action}`);
const view = (page: string) => `page:@${page}:view`;
/** Seeing a table's personal columns (a patient's mobile, email, address, allergy note). */
const pii = (table: string) => `table:@${table}:read_pii`;

/** The tables whose personal columns the desk works with: whom to ring, where to write. */
const DESK_PII = ["patients", "registrations", "appointments", "messages"];

const EVERY_TABLE = TABLES.map((t) => t.ref);

/** What reception writes: the day's work, never the practice's set-up or the money it forgives. */
const RECEPTION_WRITES = [
  "patients",
  "registrations",
  "appointments",
  "recalls",
  "waiting_list",
  "messages",
  "day_closes",
  "closures",
  "check_notes",
];
const RECEPTION_PAGES = [
  "clinic-overview",
  "clinic-appointments",
  "clinic-patients",
  "clinic-payments",
  "clinic-recalls",
  "clinic-waiting-list",
  "clinic-registrations",
  "clinic-messages",
];

/** What a clinician reads: the day, the people in it, and what the day is built from. */
const CLINICIAN_READS = [
  "settings",
  "opening_hours",
  "clinicians",
  "visit_types",
  "clinician_visit_types",
  "clinician_hours",
  "closures",
  "patients",
  "appointments",
  "recalls",
];

/**
 * What each role reads of Inventory, table by table and column by column.
 *
 * These are grants on another package's tables, so each says exactly which
 * columns: the names, the units, the kits, the batches and what is left —
 * never what anything cost (`cost_avg`, `supplier_cost`, `value`), never a
 * stock movement, and never the receipts that say which visit a movement was
 * for. Read only: no clinic role writes anything of Inventory's. Adminium
 * makes the grants when Inventory is connected to this app and takes them
 * back when it is disconnected.
 */
const stock = (table: string, readable: string[]) => ({ addOn: "inventory", table, actions: ["read"], limit: { readable } });
const STOCK_NAMES = [
  stock("items", ["id", "name", "unit_id", "unit", "decimals", "tracks_batches", "active"]),
  stock("units", ["id", "code", "name", "decimals"]),
  stock("kits", ["id", "name", "active"]),
  stock("batches", ["id", "item_id", "code", "unassigned", "expires_on"]),
  stock("stock_points", ["id", "item_id", "place_id", "available", "low"]),
  stock("places", ["id", "name"]),
];
/** What recording a visit's supplies reads beside the names: a kit's lines, which kits a visit type offers, and what each batch has left. */
const STOCK_RECORDING = [
  ...STOCK_NAMES,
  stock("kit_lines", ["id", "kit_id", "item_id", "qty", "per", "action"]),
  stock("links", ["id", "source_table", "source_row", "kind", "kit_id", "item_id"]),
  stock("levels", ["id", "stock_point_id", "batch_id", "qty", "expires_on"]),
];

/** Holiday Calendars' own (non-secret) settings: the days picked on Hours & closures are kept there. */
const HOLIDAY_SETTINGS = "addOn:holiday-calendars:settings";

export const ROLES = [
  {
    key: "reception",
    name: "Clinic reception",
    permissions: [
      "app:@:staff",
      ...EVERY_TABLE.map(read),
      ...RECEPTION_WRITES.flatMap((table) => grant(table, "create", "update")),
      // A payment is taken at the desk, but voiding one (an update) is a
      // manager's, like a write-off: money the desk took stays taken.
      ...grant("payments", "create"),
      ...RECEPTION_PAGES.map(view),
      ...DESK_PII.map(pii),
      // The days Holiday Calendars suggests are picked on Hours & closures, and kept in the add-on's own settings.
      HOLIDAY_SETTINGS,
    ],
    // Reception sees what a visit used, by name; it records none of it.
    tables: STOCK_NAMES,
  },
  {
    key: "clinician",
    name: "Clinic clinician",
    screensOnly: true,
    // The allergy note is what a clinician must see; the grant is per table, so
    // the patient's contact details come with it.
    permissions: [
      "app:@:staff",
      ...CLINICIAN_READS.map(read),
      ...grant("appointments", "update"),
      // What the visit used is the clinician's to record: they saw it used.
      ...grant("appointment_supplies", "read", "create", "update", "delete"),
      pii("patients"),
    ],
    // A clinician moves a visit along — into the room, with them, ready to go —
    // and changes nothing else; the server refuses any other write. On a supply
    // line they say which item and how many, then whether it was used and from
    // which batch: where it is taken from and who recorded it are the server's.
    limits: {
      appointments: { writable: ["status"], writableValues: { status: ["roomed", "with_clinician", "ready"] } },
      appointment_supplies: {
        creatable: ["appointment_id", "kit_id", "item_id", "qty", "client_key"],
        writable: ["qty", "not_used_at", "batch_id"],
      },
    },
    tables: STOCK_RECORDING,
  },
  {
    key: "manager",
    name: "Clinic manager",
    permissions: [
      "app:@:staff",
      ...EVERY_TABLE.flatMap((table) =>
        // The outbox is the practice's log of what was sent: nobody deletes from it.
        table === "messages" ? grant(table, "read", "create", "update") : grant(table, "read", "create", "update", "delete"),
      ),
      ...PAGE_REFS.flatMap((page) => [view(page), `page:@${page}:edit`]),
      ...DESK_PII.map(pii),
      HOLIDAY_SETTINGS,
    ],
    tables: STOCK_RECORDING,
  },
  {
    key: "kiosk",
    name: "Clinic kiosk",
    screensOnly: true,
    permissions: ["app:@:staff"],
  },
];
