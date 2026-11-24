/**
 * The practice's texts: a visit reminder and a missed-visit note, sent by
 * Adminium through the business's own provider (Twilio or Telnyx), and the
 * box a patient ticks to have them.
 *
 * WHAT A TEXT SAYS. Only the practice's name (`settings.text_name`), the date
 * and the time. A text shows on a locked phone and passes through the
 * provider's logs, and a visit's clinician, type, reason or department lets a
 * reader infer something about the patient's health. So no template here reads
 * anything but those three, and the words never say "doctor", "clinic visit"
 * or anything a stranger could read as medical: a "visit", a "Termin", a
 * "预约". `texts.test.ts` holds that line.
 *
 * THE NAME. `text_name`, not `practice_name`: a practice whose name says what
 * it treats writes a plain one, and gives its sender the same plain name in
 * Adminium (Studio → Texts). A text from a sender name cannot take a reply, so
 * Adminium ends it with the desk's phone for stopping (`outbox.settings.phone`);
 * a text from a number ends "Reply STOP to opt out." Neither line is written
 * here: Adminium adds the one that works for the sender.
 *
 * NO "Reply YES", no link and no code: Adminium refuses all three, at install
 * and again for every text.
 *
 * REPLIES ARE OFF (`textReplies`). Patients may answer a reminder with a
 * symptom, which nobody should hold in a shared inbox. A reply is not kept,
 * and its sender is told once that the number is not read, with the desk's
 * phone. STOP still works. The owner may turn replies on in Adminium.
 */
import type { Tag } from "./labels.ts";
import { texts } from "../i18n/strings/texts.ts";

/**
 * The version of the box's words, kept with every yes in Adminium's text
 * consent log. Raise it whenever `texts.box.*` changes in any language.
 */
export const TEXT_BOX_VERSION = 1;

/** The sentence beside the box, as the consent log keeps it: the label, its line, and how to stop. */
export function boxWording(): Record<Tag, string> {
  return Object.fromEntries(
    Object.entries(texts).map(([tag, words]) => [tag, `${words["texts.box.label"]}. ${words["texts.box.sub"]} ${words["texts.box.optional"]}`]),
  ) as Record<Tag, string>;
}

const DATE = "{{appointment.starts_at.date}}";
const TIME = "{{appointment.starts_at.time}}";
const NAME = "{{practice.text_name}}";

interface TextWords {
  reminderName: string;
  reminder: string;
  missedName: string;
  missed: string;
}

/** Each language's two texts. Short on purpose: Czech, Arabic and Chinese count 70 characters a segment. */
export const TEXT_WORDS: Record<Tag, TextWords> = {
  "en-US": {
    reminderName: "Visit reminder text",
    reminder: `${NAME}: your visit is on ${DATE} at ${TIME}.`,
    missedName: "Missed visit text",
    missed: `${NAME}: we missed you on ${DATE} at ${TIME}. Please get in touch to book another time.`,
  },
  "de-DE": {
    reminderName: "Termin-Erinnerung per SMS",
    reminder: `${NAME}: Ihr Termin ist am ${DATE} um ${TIME}.`,
    missedName: "SMS nach verpasstem Termin",
    missed: `${NAME}: Wir haben Sie am ${DATE} um ${TIME} vermisst. Melden Sie sich gern für einen neuen Termin.`,
  },
  "fr-FR": {
    reminderName: "SMS de rappel de rendez-vous",
    reminder: `${NAME} : votre rendez-vous est le ${DATE} à ${TIME}.`,
    missedName: "SMS de rendez-vous manqué",
    missed: `${NAME} : nous ne vous avons pas vu le ${DATE} à ${TIME}. Contactez-nous pour prendre un autre rendez-vous.`,
  },
  "da-DK": {
    reminderName: "Sms-påmindelse om tid",
    reminder: `${NAME}: Din tid er ${DATE} kl. ${TIME}.`,
    missedName: "Sms om udeblivelse",
    missed: `${NAME}: Vi savnede dig ${DATE} kl. ${TIME}. Kontakt os for at få en ny tid.`,
  },
  "cs-CZ": {
    reminderName: "Připomínka termínu SMS",
    reminder: `${NAME}: Váš termín je ${DATE} v ${TIME}.`,
    missedName: "SMS po zmeškaném termínu",
    missed: `${NAME}: Chyběli jste nám ${DATE} v ${TIME}. Ozvěte se o nový termín.`,
  },
  "ar-EG": {
    reminderName: "رسالة تذكير بالموعد",
    reminder: `${NAME}: موعدك يوم ${DATE} الساعة ${TIME}.`,
    missedName: "رسالة موعد فائت",
    missed: `${NAME}: افتقدناك يوم ${DATE} الساعة ${TIME}. تواصل معنا لموعد آخر.`,
  },
  "zh-CN": {
    reminderName: "预约提醒短信",
    reminder: `${NAME}：您的预约时间为${DATE} ${TIME}。`,
    missedName: "错过预约短信",
    missed: `${NAME}：您错过了${DATE} ${TIME}的预约。请联系我们另约时间。`,
  },
  "zh-TW": {
    reminderName: "預約提醒簡訊",
    reminder: `${NAME}：您的預約時間為${DATE} ${TIME}。`,
    missedName: "錯過預約簡訊",
    missed: `${NAME}：您錯過了${DATE} ${TIME}的預約。請與我們聯絡另約時間。`,
  },
};

/** The template each text kind is kept under. */
export const TEXT_KEYS = { reminder_text: "clinic-reminder-text", missed_text: "clinic-missed-text" } as const;

/** The manifest's `textTemplates`: the two texts, each in all eight languages. */
export function textTemplates(): unknown[] {
  const entries = Object.entries(TEXT_WORDS) as [Tag, TextWords][];
  return [
    {
      key: TEXT_KEYS.reminder_text,
      name: Object.fromEntries(entries.map(([tag, w]) => [tag, w.reminderName])),
      locales: Object.fromEntries(entries.map(([tag, w]) => [tag, { body: w.reminder }])),
    },
    {
      key: TEXT_KEYS.missed_text,
      name: Object.fromEntries(entries.map(([tag, w]) => [tag, w.missedName])),
      locales: Object.fromEntries(entries.map(([tag, w]) => [tag, { body: w.missed }])),
    },
  ];
}

/** Clinic's replies start off: a patient's answer is never kept, and they are told the number is not read. */
export const TEXT_REPLIES = "off";
