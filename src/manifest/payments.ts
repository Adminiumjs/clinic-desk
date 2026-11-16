/**
 * Paying for a visit online, through the payments Adminium takes.
 *
 * A visit is payable: its fee, its balance, the practice's own currency (the
 * settings row's), and each payment written into the practice's own
 * `payments` table as `online`, with the service's reference and name. They
 * arrive switched off: someone who manages payments switches Clinic Desk on
 * in Adminium's Payments, and until then every page reads as it always has.
 *
 *   - after the visit: a seen visit with something still to pay, from My
 *     visits or the link the desk e-mails;
 *   - ahead of it: a patient already on file may pay as they book (a setting
 *     of the practice). The visit is made waiting for the payment (`paying`)
 *     and its time held for a few minutes; the payment confirms it. Such a
 *     visit is paid only by the ways that settle at once (a card, a wallet),
 *     so no bank debit holds a time for days.
 *
 * Refunds are kept on the payment row (`refunded`, a running total Adminium
 * writes). A visit paid ahead and cancelled before the cancellation window —
 * by the patient, or by a desk member who may refund — is refunded by itself,
 * unless the practice turns that off in the desk settings; any other money a
 * cancelled or missed visit still holds shows "Refund owed" on the desk, for
 * a person to decide.
 *
 * Adminium sends the receipt of an online payment, to the address on the
 * patient's file (`receipt_email`); the desk's own receipt for an insurer is
 * unchanged.
 */
const setting = (column: string) => ({ table: "settings", column });

export const PAYMENTS = {
  payables: [
    {
      table: "appointments",
      label: "ref",
      amount: { column: "fee" },
      currency: { setting: setting("currency") },
      due: { column: "balance" },
      payments: {
        kind: "table",
        table: "payments",
        link: "appointment_id",
        amount: "amount",
        paidAt: "paid_at",
        method: { column: "method", values: { "*": "online" } },
        voided: "voided",
        reference: "payment_ref",
        refunded: "refunded",
        provider: "provider",
        currency: "currency",
      },
      // Only a visit waiting for its payment is confirmed by it; a seen visit stays seen.
      status: { column: "status", paid: "booked", from: ["paying"] },
      customerEmail: "receipt_email",
      payableWhen: [{ column: "status", in: ["paying", "booked", "seen"] }],
      returnTo: "/my-visits",
      receipt: "engine",
      instantOnly: { where: [{ column: "status", eq: "paying" }] },
      refunds: { model: "column" },
      refundOn: {
        moves: [{ from: ["booked"], to: "cancelled", by: ["customer", "refund-right"] }],
        switch: setting("auto_refund"),
        before: { column: "starts_at", hours: setting("cancel_hours") },
      },
    },
  ],
};
