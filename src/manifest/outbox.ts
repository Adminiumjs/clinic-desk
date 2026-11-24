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
 *                 only to patients who asked for reminders;
 *   paid_ahead    the confirmation of a visit the patient paid for as they
 *                 booked: it goes when the payment confirms the booking. A
 *                 visit made waiting for its payment gets no "payable at the
 *                 desk" confirmation: that one is dropped before it goes.
 *
 * And two the desk queues:
 *
 *   balance       what a seen visit still owes, with the link to pay it
 *                 online — once, when the visit is sent off with a balance,
 *                 and only while the practice takes payments online;
 *   receipt       the receipt of one payment, for their insurer — the
 *                 Invoices & Receipts document carried as an attachment
 *                 (`attach` on the template). Only while that add-on is
 *                 connected; without it the message fails with the reason,
 *                 and never goes without its receipt.
 *
 * Every kind is service mail, which the do-not-email list never stops: each
 * is about the patient's own visit, a recall their clinician asked for, a
 * closure that moved their visit, or a payment they made. The practice sends
 * no newsletter.
 *
 * And two texts, to a patient who ticked the box for them (Adminium checks
 * that yes, for that exact number, at every send), while the practice's
 * "Visit texts" switch is on (`texts_on`):
 *
 *   reminder_text  at the same lead as the email reminder, whatever the
 *                  patient chose for email: one switch never moves the other;
 *   missed_text    when a visit is marked a no-show.
 *
 * They say only the practice's name, the date and the time (`texts.ts`). A
 * patient who never ticked the box gets nothing: the row reads "Not sent:
 * this person has not agreed to texts", which the desk shows as "No text".
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
    // Texts go to the patient's mobile: the number their yes is kept for.
    phone: "mobile",
    // A first visit is on the appointment itself until the desk accepts it.
    fallback: { via: "appointment_id", email: "new_email", name: "new_name", language: "language", phone: "new_mobile" },
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
    paid_ahead: "clinic-paid-ahead",
    balance: "clinic-balance",
    reminder_text: "clinic-reminder-text",
    missed_text: "clinic-missed-text",
  },
  channels: { reminder_text: "sms", missed_text: "sms" },
  // About the patient's own care and money, every one: none is stopped by the do-not-email list.
  classes: {
    confirmation: "service",
    reminder: "service",
    missed: "service",
    recall: "service",
    cancelled: "service",
    receipt: "service",
    paid_ahead: "service",
    balance: "service",
    reminder_text: "service",
    missed_text: "service",
  },
  producers: [
    // A visit booked by the desk, or by a patient already on file. One made waiting for its
    // payment is not confirmed yet: its message waits a few seconds and is dropped, and one of
    // the two below goes when the visit is booked after all.
    {
      kind: "confirmation",
      link: "appointment_id",
      onCreate: { table: "appointments", where: { column: "check_status", isNull: true } },
      dropWhen: [{ column: "status", in: ["paying", "lapsed"], reason: "no-longer-needed" }],
      holdSeconds: 5,
    },
    // A visit waiting for its payment, booked after all: by the payment (the paid confirmation),
    // or by the patient choosing to pay at the desk (the confirmation as the desk's).
    {
      kind: "paid_ahead",
      link: "appointment_id",
      onChange: { table: "appointments", column: "status", to: "booked", where: { column: "check_status", isNull: true } },
      dropWhen: [
        { column: "status", in: ["cancelled", "lapsed"], reason: "no-longer-needed" },
        { column: "balance", gte: 0.01, reason: "no-longer-needed" },
      ],
      holdSeconds: 5,
    },
    {
      kind: "confirmation",
      link: "appointment_id",
      onChange: { table: "appointments", column: "status", to: "booked", where: { column: "check_status", isNull: true } },
      dropWhen: [
        { column: "status", in: ["cancelled", "lapsed"], reason: "no-longer-needed" },
        { column: "balance", lte: 0, reason: "paid" },
      ],
      holdSeconds: 5,
    },
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
    // The texts: only while the practice sends them. No `optIn`: that is the email switch, and a text needs its own yes.
    { kind: "missed_text", link: "appointment_id", gate: { setting: { table: "settings", column: "texts_on" } }, onChange: { table: "appointments", column: "status", to: "no_show" } },
    {
      kind: "reminder_text",
      link: "appointment_id",
      gate: { setting: { table: "settings", column: "texts_on" } },
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
