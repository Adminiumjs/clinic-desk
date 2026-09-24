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
    ],
  },
  {
    key: "clinician",
    name: "Clinic clinician",
    screensOnly: true,
    // The allergy note is what a clinician must see; the grant is per table, so
    // the patient's contact details come with it.
    permissions: ["app:@:staff", ...CLINICIAN_READS.map(read), ...grant("appointments", "update"), pii("patients")],
    // A clinician moves a visit along — into the room, with them, ready to go —
    // and changes nothing else; the server refuses any other write.
    limits: { appointments: { writable: ["status"], writableValues: { status: ["roomed", "with_clinician", "ready"] } } },
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
    ],
  },
  {
    key: "kiosk",
    name: "Clinic kiosk",
    screensOnly: true,
    permissions: ["app:@:staff"],
  },
];
