/**
 * The practice's emails: the `messages` table is the outbox, and every email
 * is a row in it that the desk can read, send early or send again.
 *
 * Rows are queued by the producers below, by the desk ("Send now", a recall
 * note, a closure's cancellations) and by nobody else; Adminium sends them
 * and writes back `sent`, `failed` or `skipped` with the reason.
 *
 *   confirmation  on a new visit — except a first visit booked online by
 *                 someone not yet on file, whose address nobody has proved:
 *                 that one goes when the desk accepts or links the booking,
 *                 so the practice's name is never mailed to a stranger's
 *                 typed address;
 *   missed        when a visit is marked a no-show (reminders switch);
 *   reminder      at each patient's own lead time before the visit (12, 24
 *                 or 48 hours; the practice's default when they chose none),
 *                 only to patients who asked for reminders.
 *
 * And one the desk queues when a patient asks for it:
 *
 *   receipt       the receipt of one payment, for their insurer — the
 *                 Invoices & Receipts document carried as an attachment
 *                 (`attach` on the template). Only while that add-on is
 *                 connected; without it the message fails with the reason,
 *                 and never goes without its receipt.
 *
 * The log is the dedupe: a kind already queued or sent for a visit is not
 * queued again, so the desk's early "Send now" is never followed by the
 * automatic one, and a moved visit gets a fresh reminder.
 */
export const OUTBOX = {
  table: "messages",
  columns: {
    kind: "kind",
    status: "status",
    to: "to_address",
    language: "language",
    due: "due_at",
    sentAt: "sent_at",
    error: "error",
  },
  links: {
    patient: "patient_id",
    appointment: "appointment_id",
    recall: "recall_id",
    closure: "closure_id",
    payment: "payment_id",
  },
  recipient: {
    via: "patient_id",
    table: "patients",
    email: "email",
    name: "name",
    language: "language",
    optIn: "remind_email",
    // A first visit is on the appointment itself until the desk accepts it.
    fallback: { via: "appointment_id", email: "new_email", name: "new_name", language: "language" },
  },
  // `phone`: the notice to a patient's old address after an email change ends
  // "If this wasn't you, ring us on …" with the desk's number.
  settings: { table: "settings", enabled: "reminders_on", name: "practice_name", phone: "phone" },
  pages: { manage: "/my-visits", booking: "/" },
  kinds: {
    confirmation: "clinic-confirmation",
    reminder: "clinic-reminder",
    missed: "clinic-missed",
    recall: "clinic-recall",
    cancelled: "clinic-cancelled",
    receipt: "clinic-receipt",
  },
  producers: [
    // A visit booked by the desk, or by a patient already on file.
    { kind: "confirmation", link: "appointment_id", onCreate: { table: "appointments", where: { column: "check_status", isNull: true } } },
    // A first visit, once the desk has accepted it or linked it to a patient.
    { kind: "confirmation", link: "appointment_id", onChange: { table: "appointments", column: "check_status", to: ["accepted", "linked"] } },
    { kind: "missed", link: "appointment_id", gate: "enabled", onChange: { table: "appointments", column: "status", to: "no_show" } },
    {
      kind: "reminder",
      link: "appointment_id",
      gate: "enabled",
      optIn: true,
      before: {
        table: "appointments",
        at: "starts_at",
        lead: {
          via: "patient_id",
          table: "patients",
          column: "remind_lead_hours",
          fallback: { table: "settings", column: "default_lead_hours" },
          max: 48,
        },
        where: { column: "status", eq: "booked" },
      },
    },
  ],
} as const;
