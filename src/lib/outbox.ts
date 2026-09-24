/**
 * What is still to come in the outbox, worked out from the log and the diary.
 *
 * Adminium's reminder scan queues each booked visit's reminder at its
 * patient's own lead before the visit (12, 24 or 48 hours; the practice's
 * default when they chose none), and never twice — a reminder already in the
 * log for that visit at that start time, in any state, is the reminder. So
 * "waiting to go" is the queued rows plus the reminders the scan WILL queue.
 * The Reminders outbox lists them; the sidebar counts them with the same
 * function, so the two never disagree.
 */
import type { Appointment, Id, Message, Patient, Settings } from "../data/types.ts";
import type { DeskState } from "../state/desk.ts";
import { HOSTED } from "../surface.ts";

/** The largest lead a patient may choose; the scan looks no further ahead. */
export const MAX_LEAD_HOURS = 48;
const HOUR = 3_600_000;

export interface Upcoming {
  visit: Appointment;
  /** When the scan will queue it (epoch ms). At or before now: any minute. */
  goesAt: number;
  /** Where it would go; null when there is no address (it would be logged "No email on file"). */
  to: string | null;
}

/**
 * Whether an address is on a domain reserved for examples and tests (RFC 2606,
 * RFC 6761): `example.<anything>`, or a `.test`, `.invalid`, `.localhost` or
 * `.example` name. Adminium's sender never mails one (it logs it "skipped"),
 * and every sample patient has one — so in a hosted desk a reminder to one is
 * not coming, and listing it as "goes now" would promise it forever. The same
 * rule as the server's `reservedAddress`.
 */
export function reservedAddress(address: string): boolean {
  const domain = address.trim().toLowerCase().split("@").pop()?.replace(/\.$/, "") ?? "";
  const labels = domain.split(".");
  const top = labels[labels.length - 1] ?? "";
  return labels[0] === "example" || ["test", "invalid", "localhost", "example"].includes(top);
}

/** Whether a logged reminder is this visit's, for the start it has now. */
export function remindsThisStart(message: Message, visit: Appointment): boolean {
  if (message.kind !== "reminder" || message.appointment_id !== visit.id || message.due_at === null) return false;
  // The server compares within a second: a stored instant may carry a fraction a browser date cannot.
  return Math.abs(Date.parse(message.due_at) - Date.parse(visit.starts_at)) < 1000;
}

export function upcomingReminders(input: {
  visits: readonly Appointment[];
  patients: Readonly<Record<Id, Patient>>;
  messages: readonly Message[];
  settings: Settings | null;
  now: number;
  /**
   * Whether a reserved address gets nothing. True where Adminium sends (a
   * hosted desk); the demo's stand-in world "sends" to its sample addresses.
   */
  reservedGoNowhere?: boolean;
}): Upcoming[] {
  const { visits, patients, messages, settings, now, reservedGoNowhere = HOSTED } = input;
  // Switched off: the scan queues nothing, so nothing is coming.
  if (settings !== null && !settings.reminders_on) return [];
  const fallback = settings?.default_lead_hours ?? 24;
  const out: Upcoming[] = [];
  for (const visit of visits) {
    if (visit.status !== "booked") continue;
    const start = Date.parse(visit.starts_at);
    if (!(start > now && start <= now + MAX_LEAD_HOURS * HOUR)) continue;
    const patient = visit.patient_id === null ? undefined : patients[visit.patient_id];
    // A patient the desk has not read: whether they asked for reminders is unknown, so it is not promised.
    if (visit.patient_id !== null && patient === undefined) continue;
    if (patient !== undefined && !patient.remind_email) continue;
    if (messages.some((m) => remindsThisStart(m, visit))) continue;
    const lead = Math.min(patient?.remind_lead_hours ?? fallback, MAX_LEAD_HOURS);
    const address = (patient === undefined ? visit.new_email : patient.email)?.trim() ?? "";
    if (reservedGoNowhere && address !== "" && reservedAddress(address)) continue;
    out.push({ visit, goesAt: start - lead * HOUR, to: address === "" ? null : address });
  }
  return out.sort((a, b) => a.goesAt - b.goesAt || a.visit.id - b.visit.id);
}

/** "N waiting to go": what is queued, and the reminders to come that have somewhere to go. */
export function outboxWaiting(s: Pick<DeskState, "messages" | "visits" | "patients" | "settings">, now: number): number {
  const messages = Object.values(s.messages);
  const queued = messages.filter((m) => m.status === "queued").length;
  const coming = upcomingReminders({ visits: Object.values(s.visits), patients: s.patients, messages, settings: s.settings, now });
  return queued + coming.filter((u) => u.to !== null).length;
}
