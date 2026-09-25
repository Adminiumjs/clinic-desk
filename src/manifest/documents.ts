/**
 * The document this app ships for its own rows: a receipt a patient can send
 * to their insurer, one per payment, drawn by Invoices & Receipts.
 *
 * It is the add-on's `receipt` — the receipt of money received — and not an
 * invoice: a visit is not an invoice, and nothing here is owed by the paper.
 * What it prints:
 *
 *   the practice      the add-on's letterhead (its settings: the business's
 *                     name, address lines, tax or provider number);
 *   the patient       their name and address, through the payment's
 *                     `patient_id` (copied from the visit, as `clinician_id`
 *                     and `visit_type_id` are);
 *   the visit         its kind, as the heading — never the reason typed for
 *                     it, which can carry a clinical detail the patient did
 *                     not choose to share (the desk's own receipt says the
 *                     same) — the day it took place and the clinician who
 *                     saw them;
 *   the claim         the patient's policy number, as their insurer asks;
 *   the money         the amount paid, when and how, and what the visit
 *                     still owes; a voided payment is drawn marked void.
 *
 * The desk prints it from the receipt of a payment, and emails it with the
 * `clinic-receipt` email, which carries it as an attachment. Both only while
 * the feature is on: Invoices & Receipts connected to this app.
 */
import { INSURER_RECEIPTS } from "../lib/features.ts";
import { l } from "./labels.ts";

export const DOCUMENTS = [
  {
    kind: "receipt",
    addOn: "invoices",
    table: "payments",
    name: l("Receipt for an insurer"),
    feature: INSURER_RECEIPTS,
    mapping: {
      issuedAt: { column: "paid_at" },
      amount: { column: "amount" },
      paidWith: { column: "method" },
      voided: { column: "voided" },
      customerName: { via: "patient_id", column: "name" },
      customerLines: { via: "patient_id", column: "address" },
      title: { via: "visit_type_id", column: "name" },
      serviceDate: { via: "appointment_id", column: "starts_at" },
      attendedBy: { via: "clinician_id", column: "name" },
      reference: { via: "patient_id", column: "policy_ref" },
      balanceAfter: { via: "appointment_id", column: "balance" },
    },
  },
];
