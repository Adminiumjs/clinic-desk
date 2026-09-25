/**
 * The add-ons this app works with, and the one part of it that needs one.
 *
 * Nothing here is REQUIRED: the desk runs a practice's day without either,
 * and a practice that never sends a receipt to an insurer is not made to
 * install an invoicing add-on. So both are offered at install, and one
 * feature switches off without its add-on.
 *
 *   Holiday calendars   a country's public holidays, shown on Hours &
 *                       closures as suggestions; "Add as a closure" writes
 *                       the practice's own closure row (`from_date`,
 *                       `to_date`, `label`), because only a closure row
 *                       shuts the diary.
 *   Invoices & Receipts draws the receipt a patient sends to their insurer
 *                       (the `receipt` document in `documents.ts`) and puts
 *                       it on the email that carries it. The desk's own
 *                       printed receipt stays the app's: instant, and there
 *                       whether or not this add-on is.
 *
 * The ranges are the first release of each add-on that does what this app
 * asks of it: Holiday calendars' days from 1.0.2, and the receipt of one
 * payment — its amount, a heading of the app's choosing, the day of the
 * visit, who saw the patient and their policy number — from Invoices &
 * Receipts 1.0.4.
 */
import { FEATURES, INSURER_RECEIPTS } from "../lib/features.ts";
import { l } from "./labels.ts";

export const HOLIDAYS_RANGE = ">=1.0.2";
export const INVOICES_RANGE = ">=1.0.4";

export const ADD_ONS = {
  suggests: [
    { key: "holiday-calendars", range: HOLIDAYS_RANGE, checked: true, reason: l("Mark public holidays as closures") },
    { key: "invoices", range: INVOICES_RANGE, checked: false, reason: l("Email or print a receipt a patient can claim with") },
  ],
  features: [{ id: INSURER_RECEIPTS, label: l("Receipts for insurers"), requires: [...FEATURES[INSURER_RECEIPTS]] }],
};
