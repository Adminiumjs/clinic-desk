/**
 * The two doors the screens read through, as contracts.
 *
 *   DeskReads      what the desk reads, as the signed-in staff member: the
 *                  practice's set-up, the day on screen, the open work, and
 *                  the server's own free times (`booking-slots`). Live it is
 *                  Adminium's data API (`adminiumSource.ts`); in the demo, the
 *                  in-memory practice (`demo/`).
 *   PatientsPort   what the patients' pages may do, through the practice's
 *                  browser key (`publicPatients.ts`), or the demo's.
 *
 * Writes from the desk go through the sink (`sink.ts`); the patients' pages
 * write through their port, because every patient write is a narrow public
 * door with its own refusals.
 *
 * Nothing here computes a free time: the server's booking rule does, and both
 * doors only ask it. (The demo answers the same questions with the same rule,
 * written once for the browser in `demo/booking.ts`.)
 */
import type {
  Appointment,
  CheckNote,
  Clinician,
  ClinicianHours,
  ClinicianVisitType,
  Closure,
  Day,
  DayClose,
  Faq,
  Hhmm,
  Id,
  Instant,
  Message,
  OpeningHours,
  PartOfDay,
  Patient,
  Payment,
  Recall,
  Registration,
  Settings,
  TableRef,
  Tables,
  VisitType,
  WaitingEntry,
  WriteOff,
} from "./types.ts";

// ── free times ──────────────────────────────────────────────────────────────

export interface SlotQuery {
  /** The visit type. */
  kind: Id;
  /** One clinician, or `any` (the default). */
  resource?: Id | "any";
  /** The visit being moved: its own time is not counted against it. */
  exclude?: Id;
}

export interface SlotTime {
  time: Hhmm;
  state: "free" | "full";
  /** The desk only: who would be booked, when the question was "anyone". */
  resource?: Id;
}

export interface DayState {
  date: Day;
  /** How many times are free that day. */
  open: number;
  state: "open" | "full" | "closed";
}

// ── the desk ────────────────────────────────────────────────────────────────

/** How the practice is set up: small tables, read whole. */
export interface Reference {
  settings: Settings | null;
  hours: OpeningHours[];
  clinicians: Clinician[];
  visitTypes: VisitType[];
  links: ClinicianVisitType[];
  clinicianHours: ClinicianHours[];
  /** Closures ending today or later, open or reopened. */
  closures: Closure[];
  faqs: Faq[];
}

/**
 * Everything the desk opens with — the practice, today, and the work that is
 * waiting — and nothing more. Nothing reads the whole history: a patient's
 * past visits are read when their page opens.
 */
export interface DeskSnapshot extends Reference {
  /** The venue day this snapshot is of. */
  today: Day;
  /** Today's visits, every status. */
  day: Appointment[];
  /** Every patient any row below names. */
  patients: Patient[];
  waiting: WaitingEntry[];
  /** New and rang, plus the last two weeks' handled ones (the Done tab). */
  registrations: Registration[];
  /** First visits booked online: to check and rang, plus the last two weeks' handled ones. */
  firstVisits: Appointment[];
  notes: CheckNote[];
  /** Due and noted, up to two months ahead. */
  recalls: Recall[];
  /** Seen visits still owing, oldest first. */
  owing: Appointment[];
  /** Whether there are more owing visits than the snapshot holds. */
  owingMore: boolean;
  paymentsToday: Payment[];
  writeOffsThisMonth: WriteOff[];
  /** Queued and failed, and everything of the last two days. */
  messages: Message[];
  dayClose: DayClose | null;
}

export interface PatientPage {
  patient: Patient;
  /** Their visits, newest first. */
  visits: Appointment[];
  visitsTotal: number;
  recalls: Recall[];
  payments: Payment[];
}

export type PatientFilter = "all" | "owing" | "allergies" | "recall";

export interface PatientSearch {
  q?: string;
  filter?: PatientFilter;
  limit: number;
  offset: number;
}

export interface DeskReads {
  snapshot(today: Day, zone: string): Promise<DeskSnapshot>;
  /** Every visit starting in `[from, to)`, with the patients they name. */
  between(from: Instant, to: Instant): Promise<{ visits: Appointment[]; patients: Patient[] }>;
  patients(ids: readonly Id[]): Promise<Patient[]>;
  /** Visits by key, as they stand now (a payment changed one's balance). */
  visits(ids: readonly Id[]): Promise<Appointment[]>;
  /**
   * Any table's rows by key, as they stand now — what a live update reads,
   * since the stream's own copy of a row arrives with the personal columns
   * blanked. A key missing from the answer is a row that is gone (or no
   * longer readable by this person).
   */
  rows<R extends TableRef>(ref: R, ids: readonly Id[]): Promise<Tables[R][]>;
  /** Server search on name and mobile, paged; `total` counts every match. */
  search(query: PatientSearch, today: Day): Promise<{ rows: Patient[]; total: number | null }>;
  /** For each patient on screen: their last seen visit and what they owe. */
  glance(ids: readonly Id[]): Promise<Map<Id, { lastSeen: Instant | null; owing: number }>>;
  patientPage(id: Id): Promise<PatientPage>;
  /** Possible matches for a registration: same mobile + date of birth, same name + date of birth, same mobile. */
  matches(person: { name: string; born_on: Day; mobile: string }): Promise<{ both: Patient[]; name: Patient[]; mobile: Patient[] }>;
  times(query: SlotQuery & { date: Day }): Promise<SlotTime[]>;
  days(query: SlotQuery & { from: Day; days: number }): Promise<DayState[]>;
  /** A patient's code lock: ten wrong codes in a day. */
  codeLock(patientId: Id): Promise<{ locked: boolean; failures: number }>;
  clearCodeLock(patientId: Id): Promise<void>;
}

// ── the patients' pages ─────────────────────────────────────────────────────

/** What anyone may read: the practice and what it offers. */
export interface Catalogue {
  settings: Settings | null;
  hours: OpeningHours[];
  /** Clinicians bookable online, with what patients read about them. */
  clinicians: Clinician[];
  /** Every clinician's name, for a visit with someone not bookable online. */
  names: Pick<Clinician, "id" | "name" | "short_name" | "role_label" | "color">[];
  visitTypes: VisitType[];
  links: ClinicianVisitType[];
  faqs: Faq[];
  /** Closed days from today, with the note for patients. */
  closures: Closure[];
}

export type Level = "lookup" | "verified";

/** A visit as its patient sees it. */
export type OwnVisit = Pick<
  Appointment,
  "id" | "ref" | "clinician_id" | "visit_type_id" | "starts_at" | "minutes" | "status" | "late_cancel" | "reason" | "balance"
>;

export interface OwnDetails {
  name: string;
  email: string | null;
  mobile: string;
  remind_email: boolean;
  remind_lead_hours: number;
}

/** The visit just booked, as the confirmation shows it. */
export interface Booked {
  ref: string;
  starts_at: Instant;
  minutes: number;
  clinician_id: Id | null;
  status: string;
}

export interface NewVisit {
  visit_type_id: Id;
  clinician_id: Id | null;
  starts_at: Instant;
  reason: string | null;
  desk_note: string | null;
  language: string;
  /** A first visit by someone not on file. */
  newPatient?: { name: string; born_on: Day; mobile: string; email: string | null };
}

export interface NewRegistration {
  name: string;
  born_on: Day;
  mobile: string;
  email: string | null;
  address: string | null;
  emergency_contact: string | null;
  language: string;
}

/** What someone joining the earlier-time list asks for. */
export interface Wish {
  visit_type_id: Id;
  /** One clinician, or null for anyone. */
  clinician_id: Id | null;
  part_of_day: PartOfDay;
}

export interface CodeSent {
  sentTo: string;
  resendAfter: number;
  expiresAt: number;
}

export type CodeResult = { ok: true; level: Level; ended: boolean } | { ok: false; triesLeft: number };

/**
 * A refusal the patients' pages turn into words: the server's own code
 * (`PUBLIC_SLOT_FULL`, `PUBLIC_TOO_LATE`, `PUBLIC_CODE_WRONG` …) and what it
 * named (`column`, `reason`, `retryAfter`, `triesLeft`).
 */
export class PortError extends Error {
  readonly code: string;
  readonly params: Record<string, unknown>;
  constructor(code: string, message: string, params: Record<string, unknown> = {}) {
    super(message);
    this.name = "PortError";
    this.code = code;
    this.params = params;
  }
}

export interface PatientsPort {
  /** The practice's clock: every day and time the pages show is on it. */
  timeZone(): string;
  catalogue(): Promise<Catalogue>;
  times(query: SlotQuery & { date: Day }): Promise<SlotTime[]>;
  days(query: SlotQuery & { from: Day; days: number }): Promise<DayState[]>;
  /** Find the patient by mobile and date of birth. Null when nobody (or more than one) matches. */
  find(mobile: string, bornOn: Day): Promise<{ name: string } | null>;
  /** The session held: its level, or null when there is none (or it ended). */
  level(): Level | null;
  requestCode(request: { purpose: "verify" } | { purpose: "email-change"; email: string }): Promise<CodeSent>;
  verifyCode(code: string, purpose?: "verify" | "email-change"): Promise<CodeResult>;
  myDetails(): Promise<OwnDetails>;
  savePrefs(prefs: { remind_email: boolean; remind_lead_hours: number }): Promise<OwnDetails>;
  myVisits(): Promise<OwnVisit[]>;
  book(visit: NewVisit): Promise<Booked>;
  reschedule(id: Id, startsAt: Instant): Promise<OwnVisit>;
  cancel(id: Id): Promise<OwnVisit>;
  register(person: NewRegistration): Promise<{ ref: string }>;
  /**
   * Put the person found by `find` on the earlier-time list. The answer is
   * only where they stand on it (null when the server does not say); a
   * second place while they already wait is refused (`PUBLIC_LIMIT_REACHED`).
   */
  joinWaitlist(wish: Wish): Promise<{ rank: number | null }>;
  signOut(): Promise<void>;
}
