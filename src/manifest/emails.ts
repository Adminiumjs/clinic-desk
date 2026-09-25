/**
 * The six emails the practice sends through its outbox, in the eight
 * languages the app ships.
 *
 * Each email's words are a small table of sentences (`…Words`), and the
 * layout that holds them is written once below, so a translation is only the
 * words — nobody re-builds a block list per language, and no language can
 * lose a block the others have.
 *
 * `{{…}}` are the outbox's variables, filled by Adminium when it sends:
 * `appointment.*` the visit, `clinician.*` and `visit_type.*` one step from
 * it, `recall.*` and `closure.*` their rows, `practice.*` the settings row,
 * `recipient.first_name` the patient (or the name a first visit gave),
 * `manage_url` / `booking_url` the patients' pages. A time reads in the
 * patient's own language on the practice's clock (`.date`, `.time`,
 * `.day_month`, `.relative_day`, a visit's `time_range`); money in the
 * practice's currency.
 *
 * A sentence that holds nothing but an optional value (a visit's reason, a
 * closure's note) sits alone in its own block: when the value is empty the
 * block is left out, rather than printing an empty label.
 *
 * No "Add to calendar" button: mail cannot build the calendar file, and the
 * confirmation page has one. One palette: the renderer draws one.
 */
import type { Tag } from "./labels.ts";
import { EMAIL_TRANSLATIONS } from "./email-words.ts";

export interface ConfirmationWords {
  name: string;
  subject: string;
  preheader: string;
  heading: string;
  lead: string;
  reference: string;
  clinician: string;
  date: string;
  time: string;
  whatFor: string;
  where: string;
  manage: string;
  cancel: string;
  fee: string;
  footer: string;
}
export interface ReminderWords {
  name: string;
  subject: string;
  preheader: string;
  heading: string;
  clinician: string;
  reference: string;
  address: string;
  ask: string;
  cancelOnline: string;
  toMove: string;
  late: string;
  footer: string;
}
export interface MissedWords {
  name: string;
  subject: string;
  heading: string;
  lead: string;
  findTime: string;
  footer: string;
}
export interface RecallWords {
  name: string;
  subject: string;
  heading: string;
  lead: string;
  findTime: string;
  footer: string;
}
export interface CancelledWords {
  name: string;
  subject: string;
  preheader: string;
  heading: string;
  lead: string;
  date: string;
  time: string;
  clinician: string;
  findTime: string;
  ring: string;
  footer: string;
}

export interface ReceiptWords {
  name: string;
  subject: string;
  preheader: string;
  heading: string;
  lead: string;
  paid: string;
  visit: string;
  date: string;
  clinician: string;
  reference: string;
  ask: string;
  footer: string;
}

export interface EmailWords {
  confirmation: ConfirmationWords;
  reminder: ReminderWords;
  missed: MissedWords;
  recall: RecallWords;
  cancelled: CancelledWords;
  receipt: ReceiptWords;
}

/** The practice's name, address and phone: the foot of every email. */
const FOOT = "{{practice.practice_name}} · {{practice.address}} · {{practice.phone}}";

export const EMAIL_EN: EmailWords = {
  confirmation: {
    name: "Visit confirmation",
    subject: "You’re booked in at {{appName}}",
    preheader: "{{appointment.starts_at.date}} · {{appointment.starts_at.time}} with {{clinician.short_name}} · {{appointment.ref}}",
    heading: "You’re booked in, {{recipient.first_name}}",
    lead: "We’ve held {{appointment.minutes}} minutes with {{clinician.short_name}}. Come to the desk a few minutes early and we’ll take it from there.",
    reference: "Reference",
    clinician: "Clinician: {{clinician.name}} · {{clinician.role_label}}",
    date: "Date: {{appointment.starts_at.date}}",
    time: "Time: {{appointment.time_range}} ({{appointment.minutes}} min)",
    whatFor: "What for: {{visit_type.name}}",
    where: "Where: {{practice.address}}",
    manage: "See my visits",
    cancel: "No charge to change or cancel until {{practice.cancel_hours}} hours before.",
    fee: "{{appointment.fee}} is payable at the desk.",
    footer: FOOT,
  },
  reminder: {
    name: "Visit reminder",
    subject: "See you {{appointment.starts_at.relative_day}} at {{appointment.starts_at.time}}",
    preheader: "{{clinician.short_name}} · {{appointment.ref}} · {{practice.address}}",
    heading: "See you {{appointment.starts_at.relative_day}} at {{appointment.starts_at.time}}",
    clinician: "Clinician: {{clinician.name}} · {{clinician.role_label}}",
    reference: "Reference: {{appointment.ref}}",
    address: "Address: {{practice.address}}",
    ask: "Can’t make it?",
    cancelOnline: "Cancel it online",
    toMove: "To move it, ring the desk on {{practice.phone}}.",
    late: "Running late? Ring the desk on {{practice.phone}}.",
    footer: FOOT,
  },
  missed: {
    name: "Missed visit",
    subject: "We missed you {{appointment.starts_at.relative_day}}",
    heading: "We missed you {{appointment.starts_at.relative_day}}",
    lead: "Your {{appointment.starts_at.time}} with {{clinician.short_name}}. Ring the desk on {{practice.phone}} and we’ll find another time.",
    findTime: "Find a time",
    footer: FOOT,
  },
  recall: {
    name: "Recall",
    subject: "Time for your check-up",
    heading: "Time for your check-up",
    lead: "{{recall.clinician.short_name}} asked to see you again around {{recall.due_on.day_month}}. Find a time online or ring the desk.",
    findTime: "Find a time",
    footer: FOOT,
  },
  cancelled: {
    name: "Visit cancelled (closure)",
    subject: "We’ve had to cancel your visit",
    preheader: "{{appointment.starts_at.date}} · {{appointment.starts_at.time}} with {{clinician.short_name}}",
    heading: "We’ve had to cancel your visit",
    lead: "We’re sorry — the practice can’t see you at this time after all.",
    date: "Date: {{appointment.starts_at.date}}",
    time: "Time: {{appointment.time_range}} ({{appointment.minutes}} min)",
    clinician: "Clinician: {{clinician.name}} · {{clinician.role_label}}",
    findTime: "Find a new time",
    ring: "Ring the desk on {{practice.phone}}.",
    footer: FOOT,
  },
  receipt: {
    name: "Receipt for an insurer",
    subject: "Your receipt from {{appName}}",
    preheader: "{{payment.amount}} · {{appointment.starts_at.date}} · {{appointment.ref}}",
    heading: "Your receipt, {{recipient.first_name}}",
    lead: "Here is the receipt for your visit, attached to this email. Send it to your insurer with your claim.",
    paid: "Paid",
    visit: "Visit: {{visit_type.name}}",
    date: "Date: {{appointment.starts_at.date}}",
    clinician: "Clinician: {{clinician.name}} · {{clinician.role_label}}",
    reference: "Reference: {{appointment.ref}}",
    ask: "A question about it? Ring the desk on {{practice.phone}}.",
    footer: FOOT,
  },
};

type Block = { block: string; id: string; data: Record<string, unknown> };
const heading = (text: string): Block => ({ block: "email.heading", id: "heading", data: { text } });
const para = (id: string, ...paras: string[]): Block => ({ block: "email.text", id, data: { paras } });
const list = (id: string, items: string[]): Block => ({ block: "email.list", id, data: { items } });
const button = (id: string, label: string, url: string): Block => ({ block: "email.button", id, data: { label, url } });

interface Content {
  subject: string;
  preheader?: string;
  blocks: Block[];
  footer: string;
}

function confirmation(w: ConfirmationWords): Content {
  return {
    subject: w.subject,
    preheader: w.preheader,
    blocks: [
      heading(w.heading),
      para("lead", w.lead),
      { block: "email.box", id: "reference", data: { label: w.reference, value: "{{appointment.ref}}" } },
      list("details", [w.clinician, w.date, w.time, w.whatFor, w.where]),
      // The patient's own words for the visit, when they gave any.
      { block: "email.quote", id: "reason", data: { text: "{{appointment.reason}}" } },
      button("manage", w.manage, "{{manage_url}}"),
      para("notes", w.cancel, w.fee),
    ],
    footer: w.footer,
  };
}

function reminder(w: ReminderWords): Content {
  return {
    subject: w.subject,
    preheader: w.preheader,
    blocks: [
      heading(w.heading),
      list("details", [w.clinician, w.reference, w.address]),
      para("ask", w.ask),
      button("cancel", w.cancelOnline, "{{manage_url}}"),
      para("notes", w.toMove, w.late),
    ],
    footer: w.footer,
  };
}

function missed(w: MissedWords): Content {
  return {
    subject: w.subject,
    blocks: [heading(w.heading), para("lead", w.lead), button("find", w.findTime, "{{booking_url}}")],
    footer: w.footer,
  };
}

function recall(w: RecallWords): Content {
  return {
    subject: w.subject,
    blocks: [heading(w.heading), para("lead", w.lead), button("find", w.findTime, "{{booking_url}}")],
    footer: w.footer,
  };
}

function cancelled(w: CancelledWords): Content {
  return {
    subject: w.subject,
    preheader: w.preheader,
    blocks: [
      heading(w.heading),
      para("lead", w.lead),
      list("details", [w.date, w.time, w.clinician]),
      // The closure's note for patients ("The practice is closed for staff training that day.").
      para("reason", "{{closure.note}}"),
      button("find", w.findTime, "{{booking_url}}"),
      para("ring", w.ring),
    ],
    footer: w.footer,
  };
}

/**
 * The receipt of one payment, for the patient's insurer. The receipt itself is
 * the attachment (`attach` below); the email says what it is for. The visit is
 * named by its kind, never by the reason typed for it.
 */
function receipt(w: ReceiptWords): Content {
  return {
    subject: w.subject,
    preheader: w.preheader,
    blocks: [
      heading(w.heading),
      para("lead", w.lead),
      { block: "email.box", id: "paid", data: { label: w.paid, value: "{{payment.amount}}" } },
      list("details", [w.visit, w.date, w.clinician, w.reference]),
      para("ask", w.ask),
    ],
    footer: w.footer,
  };
}

const LAYOUTS = { confirmation, reminder, missed, recall, cancelled, receipt } as const;
const VARS: Record<keyof EmailWords, string[]> = {
  confirmation: ["recipient.first_name", "appointment.ref", "appointment.starts_at", "appointment.time_range", "appointment.minutes", "appointment.reason", "appointment.fee", "clinician.name", "clinician.short_name", "clinician.role_label", "visit_type.name", "practice.address", "practice.cancel_hours", "manage_url"],
  reminder: ["appointment.ref", "appointment.starts_at", "clinician.name", "clinician.short_name", "clinician.role_label", "practice.address", "practice.phone", "manage_url"],
  missed: ["appointment.starts_at", "clinician.short_name", "practice.phone", "booking_url"],
  recall: ["recall.clinician.short_name", "recall.due_on", "booking_url"],
  cancelled: ["appointment.starts_at", "appointment.time_range", "appointment.minutes", "clinician.name", "clinician.short_name", "clinician.role_label", "closure.note", "practice.phone", "booking_url"],
  receipt: ["recipient.first_name", "payment.amount", "appointment.ref", "appointment.starts_at", "visit_type.name", "clinician.name", "clinician.role_label", "practice.phone"],
};

/** The document an email carries: the receipt of the payment the message links. */
const ATTACH: Partial<Record<keyof EmailWords, { kind: string; link: string }>> = {
  receipt: { kind: "receipt", link: "payment" },
};

/** Every language's words: English here, the other seven in `email-words.ts`. */
export function emailWords(): Record<Tag, EmailWords> {
  return { "en-US": EMAIL_EN, ...EMAIL_TRANSLATIONS };
}

/** The manifest's `emailTemplates`: one per kind, each in all eight languages. */
export function emailTemplates(): unknown[] {
  const words = emailWords();
  return (Object.keys(LAYOUTS) as (keyof EmailWords)[]).map((kind) => {
    const layout = LAYOUTS[kind] as (w: EmailWords[typeof kind]) => Content;
    return {
      key: `clinic-${kind}`,
      name: Object.fromEntries(Object.entries(words).map(([tag, w]) => [tag, w[kind].name])),
      vars: VARS[kind],
      ...(ATTACH[kind] === undefined ? {} : { attach: ATTACH[kind] }),
      locales: Object.fromEntries(Object.entries(words).map(([tag, w]) => [tag, layout(w[kind] as never)])),
    };
  });
}
