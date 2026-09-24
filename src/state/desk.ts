/**
 * What the desk holds: the practice's set-up, the day on screen, the work
 * that is waiting, and who is signed in with what they may do.
 *
 * It is filled from one bounded read at boot (`DeskReads.snapshot`), kept
 * current by every save the desk makes (each write answers with the saved
 * row, folded in here) and by live updates from other desks (`live.ts`), and
 * re-read when the connection comes back. Screens read it through the hook;
 * the actions that change it are in `actions.ts`.
 *
 * Rows are kept by key (`byId`), so a row that arrives twice — from this
 * desk's own save and again from the live stream — is one row.
 */
import { create } from "zustand";

import type { DeskReads, DeskSnapshot } from "../data/ports.ts";
import type {
  Appointment,
  CheckNote,
  Clinician,
  ClinicianHours,
  ClinicianVisitType,
  Closure,
  Day,
  DayClose,
  DeskRole,
  Faq,
  Id,
  Message,
  OpeningHours,
  Patient,
  Payment,
  Recall,
  Registration,
  Settings,
  TableRef,
  VisitType,
  WaitingEntry,
  WriteOff,
} from "../data/types.ts";
import type { StaffAccess, TableAction } from "../staffConnection.ts";
import { addDays, venueMidnight } from "../data/venueTime.ts";
import { practiceZone, today } from "../lib/clock.ts";

export type ById<T> = Record<Id, T>;

/** The signed-in person, as the desk shows and obeys them. */
export interface Me {
  name: string;
  email: string | null;
  /** Their role at this practice; null for someone with no clinic role (an administrator). */
  role: DeskRole | null;
  /** The role's own name ("Clinic reception"), for the header. */
  roleName: string | null;
  /** What they may do with each table; null when the server did not say (then every button shows). */
  access: StaffAccess | null;
}

export type LoadState = "loading" | "ready" | "failed";

export interface DeskState {
  load: LoadState;
  /** Why the last load failed, in the server's words. */
  loadError: string | null;
  me: Me;

  settings: Settings | null;
  hours: OpeningHours[];
  clinicians: Clinician[];
  visitTypes: VisitType[];
  links: ClinicianVisitType[];
  clinicianHours: ClinicianHours[];
  closures: Closure[];
  faqs: Faq[];

  /** Every visit the desk has read, by key: today, the day on screen, the week, open work. */
  visits: ById<Appointment>;
  patients: ById<Patient>;
  waiting: ById<WaitingEntry>;
  registrations: ById<Registration>;
  notes: ById<CheckNote>;
  recalls: ById<Recall>;
  payments: ById<Payment>;
  writeOffs: ById<WriteOff>;
  messages: ById<Message>;
  dayCloses: ById<DayClose>;

  /** The venue day the snapshot was read for ("today" when the desk opened). */
  snapshotDay: Day;
  /** Whether there are more owing visits than were read. */
  owingMore: boolean;
  /** Days whose visits have been read (the day sheet's and the week diary's). */
  daysRead: Record<Day, true>;
}

const EMPTY_ME: Me = { name: "", email: null, role: null, roleName: null, access: null };

export const useDesk = create<DeskState>(() => ({
  load: "loading",
  loadError: null,
  me: EMPTY_ME,
  settings: null,
  hours: [],
  clinicians: [],
  visitTypes: [],
  links: [],
  clinicianHours: [],
  closures: [],
  faqs: [],
  visits: {},
  patients: {},
  waiting: {},
  registrations: {},
  notes: {},
  recalls: {},
  payments: {},
  writeOffs: {},
  messages: {},
  dayCloses: {},
  snapshotDay: "",
  owingMore: false,
  daysRead: {},
}));

// ── the reads, set once at boot ─────────────────────────────────────────────

let reads: DeskReads | null = null;
export function setDeskReads(next: DeskReads): void {
  reads = next;
}
export function deskReads(): DeskReads {
  if (reads === null) throw new Error("the desk's reads are not set: boot sets them before any screen mounts");
  return reads;
}

const keyed = <T extends { id: Id }>(rows: readonly T[]): ById<T> => Object.fromEntries(rows.map((row) => [row.id, row])) as ById<T>;

/** Fold rows into a keyed collection, newest wins. */
export function merge<T extends { id: Id }>(into: ById<T>, rows: readonly T[]): ById<T> {
  if (rows.length === 0) return into;
  return { ...into, ...keyed(rows) };
}

/** The collection a table's rows live in. */
const COLLECTION: Partial<Record<TableRef, keyof DeskState>> = {
  appointments: "visits",
  patients: "patients",
  waiting_list: "waiting",
  registrations: "registrations",
  check_notes: "notes",
  recalls: "recalls",
  payments: "payments",
  write_offs: "writeOffs",
  messages: "messages",
  day_closes: "dayCloses",
};
const LISTS: Partial<Record<TableRef, keyof DeskState>> = {
  settings: "settings",
  opening_hours: "hours",
  clinicians: "clinicians",
  visit_types: "visitTypes",
  clinician_visit_types: "links",
  clinician_hours: "clinicianHours",
  closures: "closures",
  faqs: "faqs",
};

/** One saved row, folded into whatever holds its table. */
export function upsert(ref: TableRef, row: { id: Id }): void {
  const collection = COLLECTION[ref];
  if (collection !== undefined) {
    useDesk.setState((s) => ({ [collection]: merge(s[collection] as ById<{ id: Id }>, [row]) }) as Partial<DeskState>);
    return;
  }
  const list = LISTS[ref];
  if (list === "settings") {
    useDesk.setState({ settings: row as unknown as Settings });
    return;
  }
  if (list !== undefined) {
    useDesk.setState((s) => {
      const current = s[list] as { id: Id }[];
      const at = current.findIndex((r) => r.id === row.id);
      const next = at === -1 ? [...current, row] : current.map((r) => (r.id === row.id ? row : r));
      return { [list]: next } as Partial<DeskState>;
    });
  }
}

/** A row gone (a clinician's own hours removed). */
export function drop(ref: TableRef, id: Id): void {
  const collection = COLLECTION[ref];
  if (collection !== undefined) {
    useDesk.setState((s) => {
      const next = { ...(s[collection] as ById<unknown>) };
      delete next[id];
      return { [collection]: next } as Partial<DeskState>;
    });
    return;
  }
  const list = LISTS[ref];
  if (list !== undefined && list !== "settings") {
    useDesk.setState((s) => ({ [list]: (s[list] as { id: Id }[]).filter((r) => r.id !== id) }) as Partial<DeskState>);
  }
}

/** Replace everything the desk holds with a fresh snapshot (boot, and after a reconnect). */
export function applySnapshot(snap: DeskSnapshot): void {
  useDesk.setState((s) => ({
    load: "ready",
    loadError: null,
    settings: snap.settings,
    hours: snap.hours,
    clinicians: snap.clinicians,
    visitTypes: snap.visitTypes,
    links: snap.links,
    clinicianHours: snap.clinicianHours,
    closures: snap.closures,
    faqs: snap.faqs,
    visits: keyed([...snap.day, ...snap.firstVisits, ...snap.owing]),
    patients: merge(s.patients, snap.patients),
    waiting: keyed(snap.waiting),
    registrations: keyed(snap.registrations),
    notes: keyed(snap.notes),
    recalls: keyed(snap.recalls),
    payments: keyed(snap.paymentsToday),
    writeOffs: keyed(snap.writeOffsThisMonth),
    messages: keyed(snap.messages),
    dayCloses: snap.dayClose === null ? {} : keyed([snap.dayClose]),
    snapshotDay: snap.today,
    owingMore: snap.owingMore,
    daysRead: { [snap.today]: true },
  }));
}

/** Read the desk's snapshot for today. */
export async function loadDesk(): Promise<void> {
  useDesk.setState({ load: "loading" });
  try {
    applySnapshot(await deskReads().snapshot(today(), practiceZone()));
  } catch (error) {
    useDesk.setState({ load: "failed", loadError: error instanceof Error ? error.message : String(error) });
  }
}

/** Make sure the visits of `[from, from + days)` are read (the day sheet's day, the week diary's week). */
export async function ensureDays(from: Day, days = 1): Promise<void> {
  const wanted = Array.from({ length: days }, (_, i) => addDays(from, i));
  if (wanted.every((d) => useDesk.getState().daysRead[d])) return;
  const zone = practiceZone();
  const { visits, patients } = await deskReads().between(venueMidnight(from, zone), venueMidnight(addDays(from, days), zone));
  useDesk.setState((s) => ({
    visits: merge(s.visits, visits),
    patients: merge(s.patients, patients),
    daysRead: { ...s.daysRead, ...Object.fromEntries(wanted.map((d) => [d, true])) },
  }));
}

/** Read patients the desk does not hold yet (a search, a live update naming one). */
export async function ensurePatients(ids: readonly (Id | null)[]): Promise<void> {
  const held = useDesk.getState().patients;
  const missing = [...new Set(ids.filter((id): id is Id => id !== null && held[id] === undefined))];
  if (missing.length === 0) return;
  const rows = await deskReads().patients(missing);
  useDesk.setState((s) => ({ patients: merge(s.patients, rows) }));
}

// ── who may do what ─────────────────────────────────────────────────────────

/**
 * Whether the signed-in person may do this to a table, as the server would
 * judge it. When the server did not say, every button shows and the server
 * refuses what it refuses.
 */
export function can(table: TableRef, action: TableAction): boolean {
  const access = useDesk.getState().me.access;
  if (access === null) return true;
  return (access.tables[table] ?? []).includes(action);
}

/** `can`, as a hook: re-renders when the person changes. */
export function useCan(table: TableRef, action: TableAction): boolean {
  return useDesk((s) => (s.me.access === null ? true : (s.me.access.tables[table] ?? []).includes(action)));
}

/** The desk role from the roles the person holds (`clinic-reception` → `reception`). */
export function roleOf(access: StaffAccess | null): { role: DeskRole | null; roleName: string | null } {
  const order: DeskRole[] = ["manager", "reception", "clinician", "kiosk"];
  for (const role of order) {
    const held = access?.roles.find((r) => r.slug === `clinic-${role}`);
    if (held !== undefined) return { role, roleName: held.name };
  }
  const first = access?.roles[0];
  return { role: null, roleName: first?.name ?? null };
}
