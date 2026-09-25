/**
 * Everything the desk DOES, each one a save to Adminium.
 *
 * Every action answers an `Outcome`: done (with what was saved), or refused
 * with a reason the screen turns into words — the slot was taken, the day is
 * closed, the payment is more than the balance, the person may not do this,
 * the network is down. Nothing is shown as saved before the server says so;
 * money in particular waits for the answer.
 *
 * ── ACTIONS THAT WRITE SEVERAL ROWS ─────────────────────────────────────────
 * Send them off (a payment, a recall, the visit seen), accepting a first
 * visit (a new patient, then the visit linked to them), booking a recall
 * (the visit, then the recall booked), a closure with clashes (the closure,
 * then each visit cancelled and emailed): each is RESUMABLE, not undone.
 * Every row such an action creates carries a key made once for the action
 * (`lib/keys.ts`); the caller keeps the key until the action succeeds, and
 * trying again with it finds what the first try saved and carries on from the
 * first step not yet done. The row that makes the action visible is written
 * LAST (the visit's "seen" after its payment and recall), except a closure,
 * which is written FIRST so no email ever names a closure that does not exist.
 */
import type { DrawnDocument, SinkError } from "../data/sink.ts";
import type {
  AppointmentStatus,
  Appointment,
  CheckNote,
  Closure,
  Day,
  DayClose,
  Id,
  Instant,
  Message,
  OpeningHours,
  PayMethod,
  Patient,
  Payment,
  Recall,
  Registration,
  Settings,
  TableRef,
  WaitingEntry,
  WriteOff,
  ClinicianHours,
  Channel,
} from "../data/types.ts";
import { addDays, venueDay } from "../data/venueTime.ts";
import { now, practiceZone } from "../lib/clock.ts";
import { stepKey } from "../lib/keys.ts";
import { deskReads, drop, ensurePatients, upsert, useDesk } from "./desk.ts";
import { forgetAddOn } from "./features.ts";
import { sink } from "./writes.ts";

// ── outcomes ────────────────────────────────────────────────────────────────

export type Refusal =
  /** Someone else took the time a moment ago. */
  | "taken"
  /** The practice or the clinician is closed that day. */
  | "closed"
  /** Outside the clinician's hours, on the break, or off the grid. */
  | "out-of-hours"
  /** In the past, or beyond the booking window. */
  | "out-of-range"
  /** That clinician does not do that kind of visit. */
  | "not-offered"
  /** More than the balance. */
  | "balance"
  /** A value that must be unique already is (today's desk is already closed). */
  | "duplicate"
  /** The signed-in person may not do this. */
  | "not-allowed"
  /** The row has gone (someone else deleted it). */
  | "gone"
  /** The server refused a value; `field` names it. */
  | "invalid"
  /** The session ended: sign in again. */
  | "signed-out"
  /** No answer: try again. */
  | "offline"
  /** The part of the desk that needs an add-on is off: the add-on is not connected to this app. */
  | "off"
  /** The add-on could not draw the document (a value it needs is empty). */
  | "not-drawn";

export type Outcome<T = void> = { ok: true; value: T } | { ok: false; reason: Refusal; field?: string | null; balance?: number };

const BOOKING_REASONS: Record<string, Refusal> = {
  BOOKING_TAKEN: "taken",
  BOOKING_CLOSED: "closed",
  BOOKING_OUT_OF_HOURS: "out-of-hours",
  BOOKING_OUT_OF_RANGE: "out-of-range",
  BOOKING_NOT_OFFERED: "not-offered",
};

/** What a refused write means for the person at the desk. */
export function refusalOf(error: unknown): Outcome<never> {
  const e = error as Partial<SinkError> & { kind?: string };
  if (e.kind === "signed-out") return { ok: false, reason: "signed-out" };
  if (e.kind === "offline" || e.kind === undefined) return { ok: false, reason: "offline" };
  const code = e.code ?? "";
  const details = e.details ?? {};
  const booking = BOOKING_REASONS[code] ?? BOOKING_REASONS[String(details["reason"] ?? "")];
  if (booking !== undefined) return { ok: false, reason: booking, field: e.field ?? null };
  if (code === "BALANCE_EXCEEDED") {
    const balance = Number(details["balance"]);
    return { ok: false, reason: "balance", ...(Number.isFinite(balance) ? { balance } : {}) };
  }
  if (code === "UNIQUE_VIOLATION") return { ok: false, reason: "duplicate", field: e.field ?? null };
  if (code === "FEATURE_OFF") return { ok: false, reason: "off" };
  if (code === "DOCUMENT_NOT_DRAWN") return { ok: false, reason: "not-drawn" };
  if (e.status === 403) return { ok: false, reason: "not-allowed" };
  if (e.status === 404) return { ok: false, reason: "gone" };
  return { ok: false, reason: "invalid", field: e.field ?? null };
}

/** Run an action's steps; any refusal stops it and says why. */
async function attempt<T>(steps: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await steps() };
  } catch (error) {
    const outcome = refusalOf(error);
    if (!outcome.ok && outcome.reason === "signed-out") signedOutListeners.forEach((l) => l());
    return outcome;
  }
}

const signedOutListeners = new Set<() => void>();
/** Told when a save found the session ended (the screen shows "Sign in again"). */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

// ── the saves, each folded into the desk as it lands ────────────────────────

async function insert<R extends TableRef>(ref: R, values: Record<string, unknown>): Promise<Record<string, unknown> & { id: Id }> {
  const row = (await sink().insert(ref, values)) as Record<string, unknown> & { id: Id };
  upsert(ref, row);
  return row;
}
async function update<R extends TableRef>(ref: R, id: Id, patch: Record<string, unknown>): Promise<Record<string, unknown> & { id: Id }> {
  const row = (await sink().update(ref, id, patch)) as Record<string, unknown> & { id: Id };
  upsert(ref, { ...findHeld(ref, id), ...row, id });
  return row;
}
async function remove(ref: TableRef, id: Id): Promise<void> {
  await sink().remove(ref, id);
  drop(ref, id);
}
function findHeld(ref: TableRef, id: Id): Record<string, unknown> {
  const s = useDesk.getState();
  const byRef: Partial<Record<TableRef, Record<Id, unknown>>> = {
    appointments: s.visits,
    patients: s.patients,
    registrations: s.registrations,
    recalls: s.recalls,
    payments: s.payments,
    messages: s.messages,
    waiting_list: s.waiting,
  };
  return (byRef[ref]?.[id] as Record<string, unknown> | undefined) ?? {};
}
/** Re-read visits whose money the server just settled (a payment, a write-off). */
async function refreshVisits(ids: readonly Id[]): Promise<void> {
  for (const visit of await deskReads().visits(ids)) upsert("appointments", visit);
}

/**
 * A money action refused as more than the balance means this desk's balance
 * was stale (another desk took a payment): read the visit again, so the sheet
 * shows what is really owed before anyone tries again.
 */
async function moneyAttempt<T>(visitId: Id, steps: () => Promise<T>): Promise<Outcome<T>> {
  const outcome = await attempt(steps);
  if (!outcome.ok && outcome.reason === "balance") await refreshVisits([visitId]).catch(() => undefined);
  return outcome;
}

const visitOf = (id: Id): Appointment | undefined => useDesk.getState().visits[id];
const patientOf = (id: Id | null): Patient | undefined => (id === null ? undefined : useDesk.getState().patients[id]);

// ── booking and moving ──────────────────────────────────────────────────────

export interface NewPatientDetails {
  name: string;
  born_on: Day;
  mobile: string;
  email: string | null;
}

export interface BookInput {
  /** Someone on file, or someone new typed at the desk (who becomes a patient first). */
  patient: { id: Id } | { details: NewPatientDetails };
  visitTypeId: Id;
  /** Null: whoever is free first. */
  clinicianId: Id | null;
  startsAt: Instant;
  channel: Extract<Channel, "phone" | "desk" | "walk_in" | "recall" | "waiting_list">;
  reason: string | null;
  deskNote: string | null;
  /** Someone standing at the desk: booked into the current slot and checked in at once. */
  walkIn?: boolean;
  /** The action's key (`actionKey()`), kept until it succeeds. */
  key: string;
}

/**
 * Book a visit at the desk. A new patient is saved as a patient first, then
 * the visit in their name — never as a first visit to check, which is for
 * people who booked themselves online.
 */
export function bookVisit(input: BookInput): Promise<Outcome<Appointment>> {
  return attempt(async () => {
    let patientId: Id;
    if ("id" in input.patient) patientId = input.patient.id;
    else {
      const made = await insert("patients", { ...input.patient.details, client_key: stepKey(input.key, "a") });
      patientId = made.id;
    }
    const visit = await insert("appointments", {
      patient_id: patientId,
      visit_type_id: input.visitTypeId,
      clinician_id: input.clinicianId,
      starts_at: input.startsAt,
      channel: input.channel,
      reason: input.reason,
      desk_note: input.deskNote,
      status: input.walkIn === true ? "checked_in" : "booked",
      client_key: stepKey(input.key, "b"),
    });
    return visit as unknown as Appointment;
  });
}

/** Move a visit to another time (and clinician). Its reference stays. */
export function moveVisit(id: Id, to: { startsAt: Instant; clinicianId: Id | null }): Promise<Outcome<Appointment>> {
  return attempt(async () => (await update("appointments", id, { starts_at: to.startsAt, clinician_id: to.clinicianId })) as unknown as Appointment);
}

/** Check in, room, with the clinician, ready, seen, no-show: the server stamps the times. */
export function setStatus(id: Id, status: AppointmentStatus): Promise<Outcome<Appointment>> {
  return attempt(async () => (await update("appointments", id, { status })) as unknown as Appointment);
}

/** Cancel at the desk: the time goes back on the board; inside the window it is logged as late. */
export function cancelVisit(id: Id): Promise<Outcome<Appointment>> {
  return attempt(async () => (await update("appointments", id, { status: "cancelled" })) as unknown as Appointment);
}

// ── money ───────────────────────────────────────────────────────────────────

export interface SendOffInput {
  visitId: Id;
  payment: { amount: number; method: PayMethod } | null;
  /** See them again in N weeks; null for none. */
  recallWeeks: number | null;
  /** "Book the follow-up now": the visit placed on the day sheet, which books the recall. */
  followUp: { startsAt: Instant; clinicianId: Id | null } | null;
  key: string;
}

/**
 * Send them off: the payment, the recall (and its follow-up visit, booked),
 * then the visit seen — last, so a visit never reads "seen" with its payment
 * or recall missing.
 */
export function sendOff(input: SendOffInput): Promise<Outcome<{ visit: Appointment; payment: Payment | null; recall: Recall | null }>> {
  return moneyAttempt(input.visitId, async () => {
    const visit = visitOf(input.visitId);
    if (visit === undefined) throw Object.assign(new Error("gone"), { kind: "refused", status: 404, code: "NOT_FOUND" });
    let payment: Payment | null = null;
    if (input.payment !== null && input.payment.amount > 0) {
      payment = (await insert("payments", {
        appointment_id: visit.id,
        amount: input.payment.amount,
        method: input.payment.method,
        client_key: stepKey(input.key, "a"),
      })) as unknown as Payment;
    }
    let recall: Recall | null = null;
    if (input.recallWeeks !== null && input.recallWeeks > 0 && visit.patient_id !== null && visit.clinician_id !== null) {
      const day = venueDay(Date.parse(visit.starts_at), practiceZone());
      recall = (await insert("recalls", {
        patient_id: visit.patient_id,
        from_appointment_id: visit.id,
        visit_type_id: visit.visit_type_id,
        clinician_id: visit.clinician_id,
        weeks: input.recallWeeks,
        due_on: addDays(day, input.recallWeeks * 7),
        reason: visit.reason,
        status: "due",
        client_key: stepKey(input.key, "b"),
      })) as unknown as Recall;
      if (input.followUp !== null) {
        const next = await insert("appointments", {
          patient_id: visit.patient_id,
          visit_type_id: visit.visit_type_id,
          clinician_id: input.followUp.clinicianId,
          starts_at: input.followUp.startsAt,
          channel: "recall",
          reason: visit.reason,
          status: "booked",
          client_key: stepKey(input.key, "c"),
        });
        recall = (await update("recalls", recall.id, { status: "booked", booked_appointment_id: next.id })) as unknown as Recall;
      }
    }
    const seen = (await update("appointments", visit.id, { status: "seen", recall_weeks: input.recallWeeks })) as unknown as Appointment;
    if (payment !== null) await refreshVisits([visit.id]);
    return { visit: visitOf(visit.id) ?? seen, payment, recall };
  });
}

/** Record a payment on a seen visit. More than the balance is refused by the server. */
export function recordPayment(input: { visitId: Id; amount: number; method: PayMethod; key: string }): Promise<Outcome<Payment>> {
  return moneyAttempt(input.visitId, async () => {
    const payment = (await insert("payments", {
      appointment_id: input.visitId,
      amount: input.amount,
      method: input.method,
      client_key: stepKey(input.key, "a"),
    })) as unknown as Payment;
    await refreshVisits([input.visitId]);
    return payment;
  });
}

/** Void a payment (managers): the balance comes back. */
export function voidPayment(id: Id, reason: string): Promise<Outcome<Payment>> {
  return attempt(async () => {
    const payment = (await update("payments", id, { voided: true, void_reason: reason })) as unknown as Payment;
    const visitId = payment.appointment_id ?? (findHeld("payments", id)["appointment_id"] as Id | undefined);
    if (visitId !== undefined) await refreshVisits([visitId]);
    return payment;
  });
}

/** Write off part or all of a balance (managers only — the server refuses anyone else). */
export function writeOff(input: { visitId: Id; amount: number; reason: string; key: string }): Promise<Outcome<WriteOff>> {
  return moneyAttempt(input.visitId, async () => {
    const row = (await insert("write_offs", {
      appointment_id: input.visitId,
      amount: input.amount,
      reason: input.reason,
      client_key: stepKey(input.key, "a"),
    })) as unknown as WriteOff;
    await refreshVisits([input.visitId]);
    return row;
  });
}

// ── registrations and first visits ──────────────────────────────────────────

/** A registration, or a first visit booked online: the two things Registrations checks. */
export type ToCheck = { kind: "registration"; row: Registration } | { kind: "visit"; row: Appointment };

/** Accept as a new patient: the patient first (keyed, so a retry finds them), then the item linked to them. */
export function acceptNewPatient(item: ToCheck, key: string): Promise<Outcome<Patient>> {
  return attempt(async () => {
    const details =
      item.kind === "registration"
        ? {
            name: item.row.name,
            born_on: item.row.born_on,
            mobile: item.row.mobile,
            email: item.row.email,
            address: item.row.address,
            emergency_contact: item.row.emergency_contact,
            language: item.row.language,
          }
        : { name: item.row.new_name, born_on: item.row.new_born_on, mobile: item.row.new_mobile, email: item.row.new_email, language: item.row.language };
    const patient = (await insert("patients", { ...details, client_key: stepKey(key, "a") })) as unknown as Patient;
    if (item.kind === "registration") await update("registrations", item.row.id, { patient_id: patient.id, status: "accepted" });
    // The first visit's confirmation email goes now, to the address just accepted.
    else await update("appointments", item.row.id, { patient_id: patient.id, check_status: "accepted" });
    return patient;
  });
}

/** Same person as a patient already on file: linked, and NOTHING typed is copied onto their record. */
export function linkToPatient(item: ToCheck, patientId: Id): Promise<Outcome<void>> {
  return attempt(async () => {
    if (item.kind === "registration") await update("registrations", item.row.id, { patient_id: patientId, status: "duplicate" });
    else await update("appointments", item.row.id, { patient_id: patientId, check_status: "linked" });
  });
}

/** A note on an item ("Left a message…"), and — when the desk rang — the item marked rang. */
export function addCheckNote(item: ToCheck, note: string, key: string, rang: boolean): Promise<Outcome<CheckNote>> {
  return attempt(async () => {
    const row = (await insert("check_notes", {
      ...(item.kind === "registration" ? { registration_id: item.row.id } : { appointment_id: item.row.id }),
      note,
      client_key: stepKey(key, "a"),
    })) as unknown as CheckNote;
    if (rang) {
      if (item.kind === "registration") await update("registrations", item.row.id, { status: "rang" });
      else await update("appointments", item.row.id, { check_status: "rang" });
    }
    return row;
  });
}

/**
 * Decline: the registration closes with its outcome ("Declined — moved away");
 * a first visit is declined AND cancelled, so its time is freed, with the
 * outcome kept as a note (a visit has no outcome column).
 */
export function decline(item: ToCheck, outcome: string, key: string): Promise<Outcome<void>> {
  return attempt(async () => {
    if (item.kind === "registration") {
      await update("registrations", item.row.id, { status: "declined", outcome });
      return;
    }
    await insert("check_notes", { appointment_id: item.row.id, note: outcome, client_key: stepKey(key, "a") });
    await update("appointments", item.row.id, { check_status: "declined", status: "cancelled" });
  });
}

// ── recalls and the waiting list ────────────────────────────────────────────

/** Book a recall in: the visit, then the recall booked with it. */
export function bookRecall(recall: Recall, visit: Omit<BookInput, "patient" | "channel" | "key">, key: string): Promise<Outcome<Appointment>> {
  return attempt(async () => {
    const booked = await insert("appointments", {
      patient_id: recall.patient_id,
      visit_type_id: visit.visitTypeId,
      clinician_id: visit.clinicianId,
      starts_at: visit.startsAt,
      channel: "recall",
      reason: visit.reason ?? recall.reason,
      desk_note: visit.deskNote,
      status: "booked",
      client_key: stepKey(key, "a"),
    });
    await update("recalls", recall.id, { status: "booked", booked_appointment_id: booked.id });
    return booked as unknown as Appointment;
  });
}

/** Queue the recall email, and mark the recall "note queued". */
export function queueRecallNote(recall: Recall, key: string): Promise<Outcome<Message>> {
  return attempt(async () => {
    await ensurePatients([recall.patient_id]);
    const patient = patientOf(recall.patient_id);
    const message = (await insert("messages", {
      kind: "recall",
      patient_id: recall.patient_id,
      recall_id: recall.id,
      to_address: patient?.email ?? null,
      language: patient?.language ?? null,
      status: "queued",
      client_key: stepKey(key, "a"),
    })) as unknown as Message;
    await update("recalls", recall.id, { status: "noted" });
    return message;
  });
}

/** Take someone off the recall list, with why. */
export function recallNotNeeded(recall: Recall, reason: string): Promise<Outcome<void>> {
  return attempt(async () => {
    await update("recalls", recall.id, { status: "not_needed", dismiss_reason: reason });
  });
}

/** Take a waiting-list fit: the visit, then the entry booked with it. */
export function takeWaiting(entry: WaitingEntry, visit: { startsAt: Instant; clinicianId: Id | null }, key: string): Promise<Outcome<Appointment>> {
  return attempt(async () => {
    // As it stands now: another desk may have booked or taken off this entry
    // since the list was drawn — then it is not this desk's to book again,
    // unless the booking on it is this very action's, finished on an earlier try.
    const [now] = (await deskReads().rows("waiting_list", [entry.id])) as WaitingEntry[];
    if (now === undefined) throw Object.assign(new Error("gone"), { kind: "refused", status: 404, code: "NOT_FOUND" });
    upsert("waiting_list", now);
    if (now.status !== "waiting") {
      const [mine] = now.booked_appointment_id === null ? [] : await deskReads().visits([now.booked_appointment_id]);
      if (mine !== undefined && mine.client_key === stepKey(key, "a")) {
        upsert("appointments", mine);
        return mine;
      }
      throw Object.assign(new Error("gone"), { kind: "refused", status: 404, code: "NOT_FOUND" });
    }
    const booked = await insert("appointments", {
      patient_id: entry.patient_id,
      visit_type_id: entry.visit_type_id,
      clinician_id: visit.clinicianId,
      starts_at: visit.startsAt,
      channel: "waiting_list",
      status: "booked",
      client_key: stepKey(key, "a"),
    });
    await update("waiting_list", entry.id, { status: "booked", booked_appointment_id: booked.id });
    return booked as unknown as Appointment;
  });
}

export function takeOffWaiting(entry: WaitingEntry): Promise<Outcome<void>> {
  return attempt(async () => {
    await update("waiting_list", entry.id, { status: "removed" });
  });
}

// ── hours and closures ──────────────────────────────────────────────────────

export interface HoursEdit {
  /** The practice's weekdays, changed ones only. */
  practice: Pick<OpeningHours, "id" | "open" | "opens" | "closes" | "break_start" | "break_end">[];
  /** Per clinician: back to the practice's hours, or their own rows (added, changed, removed). */
  clinicians: { clinicianId: Id; own: Omit<ClinicianHours, "id" | "clinician_id">[] | null }[];
}

/** Save the hours (managers): the practice's rows, then each clinician's own. */
export function saveHours(edit: HoursEdit): Promise<Outcome<void>> {
  return attempt(async () => {
    for (const row of edit.practice) {
      const { id, ...patch } = row;
      await update("opening_hours", id, patch);
    }
    for (const change of edit.clinicians) {
      const held = useDesk.getState().clinicianHours.filter((h) => h.clinician_id === change.clinicianId);
      const wanted = change.own ?? [];
      for (const row of held) {
        const keep = wanted.find((w) => w.weekday === row.weekday);
        if (keep === undefined) await remove("clinician_hours", row.id);
        else if (keep.opens !== row.opens || keep.closes !== row.closes || keep.break_start !== row.break_start || keep.break_end !== row.break_end) {
          await update("clinician_hours", row.id, keep);
        }
      }
      for (const row of wanted) {
        if (!held.some((h) => h.weekday === row.weekday)) await insert("clinician_hours", { clinician_id: change.clinicianId, ...row });
      }
    }
  });
}

export interface ClosureInput {
  clinicianId: Id | null;
  from: Day;
  to: Day;
  label: string;
  note: string | null;
}

/**
 * Add a closure. The closure is saved FIRST (on its own it only takes free
 * times away); then each visit chosen for cancelling is cancelled and its
 * patient emailed, each with a key of its own. A visit chosen for moving stays
 * booked and listed as a clash until someone moves it.
 */
export function addClosure(input: ClosureInput, cancel: { visitId: Id; key: string }[], key: string): Promise<Outcome<Closure>> {
  return attempt(async () => {
    const closure = (await insert("closures", {
      clinician_id: input.clinicianId,
      from_date: input.from,
      to_date: input.to,
      label: input.label,
      note: input.note,
      active: true,
      client_key: stepKey(key, "a"),
    })) as unknown as Closure;
    // Read each clash as it stands NOW (another desk may have moved it out of
    // the closure since the list was drawn), and its patient for the email.
    const fresh = cancel.length === 0 ? [] : await deskReads().visits(cancel.map((c) => c.visitId));
    for (const row of fresh) upsert("appointments", row);
    await ensurePatients(cancel.map((c) => visitOf(c.visitId)?.patient_id ?? null));
    const inside = (visit: Appointment): boolean => {
      const day = venueDay(Date.parse(visit.starts_at), practiceZone());
      return day >= input.from && day <= input.to && (input.clinicianId === null || visit.clinician_id === input.clinicianId);
    };
    for (const clash of cancel) {
      const visit = visitOf(clash.visitId);
      if (visit === undefined) throw Object.assign(new Error("gone"), { kind: "refused", status: 404, code: "NOT_FOUND" });
      // Moved out, or already begun: no longer this closure's to cancel. A
      // visit this closure cancelled on an earlier try still gets its email.
      if (!inside(visit) || (visit.status !== "booked" && visit.status !== "cancelled")) continue;
      if (visit.status !== "cancelled") await update("appointments", visit.id, { status: "cancelled" });
      const patient = patientOf(visit.patient_id);
      await insert("messages", {
        kind: "cancelled",
        patient_id: visit.patient_id,
        appointment_id: visit.id,
        closure_id: closure.id,
        to_address: patient?.email ?? visit.new_email ?? null,
        language: patient?.language ?? visit.language ?? null,
        status: "queued",
        client_key: stepKey(clash.key, "a"),
      });
    }
    return closure;
  });
}

/** Reopen a closed day, or close it again. */
export function setClosureActive(id: Id, active: boolean): Promise<Outcome<void>> {
  return attempt(async () => {
    await update("closures", id, { active });
  });
}

// ── the outbox ──────────────────────────────────────────────────────────────

/** "Send now": a reminder for a visit, queued at once (the automatic one then does not follow). */
export function sendReminderNow(visitId: Id, key: string): Promise<Outcome<Message>> {
  return attempt(async () => {
    // As it stands now: a visit cancelled or begun since the list was drawn gets no reminder.
    for (const row of await deskReads().visits([visitId])) upsert("appointments", row);
    const visit = visitOf(visitId);
    if (visit === undefined || visit.status !== "booked" || Date.parse(visit.starts_at) <= now()) {
      throw Object.assign(new Error("gone"), { kind: "refused", status: 404, code: "NOT_FOUND" });
    }
    await ensurePatients([visit.patient_id]);
    const patient = patientOf(visit.patient_id);
    return (await insert("messages", {
      kind: "reminder",
      patient_id: visit.patient_id,
      appointment_id: visitId,
      // A first visit has no patient row yet: the address it booked with.
      to_address: patient?.email ?? visit.new_email ?? null,
      language: patient?.language ?? visit.language ?? null,
      due_at: visit.starts_at,
      status: "queued",
      client_key: stepKey(key, "a"),
    })) as unknown as Message;
  });
}

/**
 * "Send again": a failed message back in the queue. The status alone: why it
 * failed is Adminium's to write (and to clear when it sends), and a desk that
 * sent `error` too would be refused outright.
 */
export function sendAgain(messageId: Id): Promise<Outcome<Message>> {
  return attempt(async () => (await update("messages", messageId, { status: "queued" })) as unknown as Message);
}

// ── receipts for insurers (Invoices & Receipts) ─────────────────────────────

/** The server said the feature is off: forget the add-on it named, so its buttons go. */
function offWhenRefused(error: unknown): never {
  const e = error as Partial<SinkError>;
  if (e.code === "FEATURE_OFF") forgetAddOn(typeof e.details?.["addOn"] === "string" && e.details["addOn"] !== "" ? e.details["addOn"] : "invoices");
  throw error;
}

/**
 * The receipt of one payment for the patient's insurer, drawn by Invoices &
 * Receipts — or the one already drawn while the payment is unchanged — and
 * where to print it from. In the document's language when one is given.
 */
export function drawInsurerReceipt(paymentId: Id, locale?: string): Promise<Outcome<DrawnDocument>> {
  return attempt(async () => {
    const target = sink();
    if (target.renderDocument === undefined) {
      throw Object.assign(new Error("off"), { kind: "refused", status: 409, code: "FEATURE_OFF", details: { addOn: "invoices" } });
    }
    return await target.renderDocument({ kind: "receipt", ref: "payments", id: paymentId, ...(locale === undefined ? {} : { locale }) }).catch(offWhenRefused);
  });
}

/**
 * Email the receipt of one payment to the patient, for their insurer: a row in
 * the outbox, which Adminium sends with the receipt attached. It goes to the
 * patient the payment is for (the address a first visit booked with, when
 * they are not on file yet), in their language. A voided payment has no
 * receipt to send.
 */
export function emailInsurerReceipt(paymentId: Id, key: string): Promise<Outcome<Message>> {
  return attempt(async () => {
    const payment = useDesk.getState().payments[paymentId];
    if (payment === undefined || payment.voided) {
      throw Object.assign(new Error("gone"), { kind: "refused", status: 404, code: "NOT_FOUND" });
    }
    if (visitOf(payment.appointment_id) === undefined) await refreshVisits([payment.appointment_id]);
    const visit = visitOf(payment.appointment_id);
    // The visit's patient as it stands: a first visit linked since the payment was taken counts.
    const patientId = visit?.patient_id ?? payment.patient_id ?? null;
    await ensurePatients([patientId]);
    const patient = patientOf(patientId);
    return (await insert("messages", {
      kind: "receipt",
      payment_id: payment.id,
      patient_id: patientId,
      appointment_id: payment.appointment_id,
      to_address: patient?.email ?? visit?.new_email ?? null,
      language: patient?.language ?? visit?.language ?? null,
      status: "queued",
      client_key: stepKey(key, "a"),
    })) as unknown as Message;
  });
}

// ── end of day and the desk's settings ──────────────────────────────────────

/**
 * Close the desk: the ticked visits marked no-shows, then the day's close
 * with the cash count. A second close of the same day is refused ("already
 * closed").
 */
export function closeDesk(input: { day: Day; noShows: Id[]; cashExpected: number; cashCounted: number | null; note: string | null }): Promise<Outcome<DayClose>> {
  return attempt(async () => {
    for (const id of input.noShows) {
      if (visitOf(id)?.status === "booked") await update("appointments", id, { status: "no_show" });
    }
    // A day closes once: a second close answers "duplicate" (the day is unique).
    return (await insert("day_closes", {
      day: input.day,
      no_shows_marked: input.noShows.length,
      cash_expected: input.cashExpected,
      cash_counted: input.cashCounted,
      note: input.note,
    })) as unknown as DayClose;
  });
}

/** Change the desk's settings (managers). */
export function saveSettings(patch: Partial<Omit<Settings, "id">>): Promise<Outcome<Settings>> {
  return attempt(async () => {
    const id = useDesk.getState().settings?.id;
    if (id === undefined) throw Object.assign(new Error("no settings row"), { kind: "refused", status: 404, code: "NOT_FOUND" });
    return (await update("settings", id, patch)) as unknown as Settings;
  });
}

/** Lift a patient's code lock (ten wrong codes in a day). */
export function clearCodeLock(patientId: Id): Promise<Outcome<void>> {
  return attempt(async () => {
    await deskReads().clearCodeLock(patientId);
  });
}
