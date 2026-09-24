/**
 * What the outbox lists, worked out from the log and the diary.
 *
 * The log (`messages`) says what was queued, sent, failed or skipped. What is
 * still to come is not in the log yet: Adminium's reminder scan queues each
 * booked visit's reminder at its patient's own lead before the visit (12, 24
 * or 48 hours; the practice's default when they chose none), and never twice —
 * a reminder already in the log for that visit at that start time, in any
 * state, is the reminder. So "waiting to go" is the queued rows plus the
 * reminders the scan WILL queue: booked visits starting within the largest
 * lead, whose patient asked for reminders, with none logged for that start.
 */
import type { Message, MessageKind } from "../../data/types.ts";
import type { Upcoming } from "../../lib/outbox.ts";

export { MAX_LEAD_HOURS, remindsThisStart, upcomingReminders, type Upcoming } from "../../lib/outbox.ts";

export type RowState = "queued" | "upcoming" | "failed" | "skipped" | "sent";

export interface OutboxRow {
  key: string;
  state: RowState;
  kind: MessageKind;
  message: Message | null;
  upcoming: Upcoming | null;
  /** For ordering inside a state. */
  at: number;
}

const ORDER: Record<RowState, number> = { queued: 0, upcoming: 1, failed: 2, skipped: 3, sent: 4 };

/**
 * The rows, in the order the desk reads them: what is going (queued, then the
 * reminders to come, by when), what needs a hand (failed), what will not go
 * (skipped), then what went — today's, newest first. Older sent and skipped
 * rows are the Messages page's.
 */
export function outboxRows(messages: readonly Message[], upcoming: readonly Upcoming[], today: string, dayOf: (at: string) => string): OutboxRow[] {
  const rows: OutboxRow[] = [];
  for (const m of messages) {
    const when = m.sent_at ?? m.created_at ?? m.due_at;
    if ((m.status === "sent" || m.status === "skipped") && (when === null || dayOf(when) !== today)) continue;
    rows.push({ key: `m${String(m.id)}`, state: m.status, kind: m.kind, message: m, upcoming: null, at: when === null ? 0 : Date.parse(when) });
  }
  for (const u of upcoming) rows.push({ key: `v${String(u.visit.id)}`, state: "upcoming", kind: "reminder", message: null, upcoming: u, at: u.goesAt });
  return rows.sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.state === "sent" || a.state === "skipped" ? b.at - a.at : a.at - b.at) || a.key.localeCompare(b.key));
}

/** "N waiting to go": what is queued, and the reminders to come that have somewhere to go. */
export const waitingCount = (rows: readonly OutboxRow[]): number =>
  rows.filter((r) => r.state === "queued" || (r.state === "upcoming" && r.upcoming?.to !== null)).length;

/**
 * The sender writes its reason in English (it is the server's log); these are
 * the ones it writes, so the page can say them in its own language. Any other
 * reason (a mailbox's bounce) is shown as written.
 */
export type ReasonKey = "outbox.why.noEmail" | "outbox.why.example" | "outbox.why.switchedOff" | "outbox.why.html" | "outbox.why.notSetUp" | "outbox.why.prepare" | "outbox.why.noKind";

export function reasonKey(error: string | null): ReasonKey | null {
  const text = (error ?? "").trim().toLowerCase();
  if (text === "") return null;
  if (text === "no email on file" || text === "no email") return "outbox.why.noEmail";
  if (text.startsWith("a reserved address")) return "outbox.why.example";
  if (text.startsWith("the email is switched off")) return "outbox.why.switchedOff";
  if (text.startsWith("the email has an html block")) return "outbox.why.html";
  if (text.startsWith("email is not set up")) return "outbox.why.notSetUp";
  if (text.startsWith("the email could not be prepared")) return "outbox.why.prepare";
  if (text.startsWith("no email is set for")) return "outbox.why.noKind";
  return null;
}
