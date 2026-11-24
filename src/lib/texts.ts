/**
 * Visit texts, worked out once for every screen that shows them.
 *
 *   - the box: whether the number typed is one we may never text (mainland
 *     China, +86: Adminium refuses every text there) and whether it reads as
 *     a number at all — neither stops the form, they only change its words;
 *   - where a patient stands, from the practice's copy of their answers and
 *     the last text the outbox logged for them;
 *   - what a text row's reason says, in the desk's words.
 *
 * Pure: the demo, the desk and the patients' pages read the same answers.
 */
import type { Message, MessageKind, Patient, TextAnswer } from "../data/types.ts";
import { isTextKind } from "../data/types.ts";

/** A number with only its digits, a leading `+` kept as `00` (`+44 7700…` and `0044 7700…` read the same). */
function digitsOf(phone: string): string {
  const trimmed = phone.trim();
  return `${trimmed.startsWith("+") ? "00" : ""}${trimmed.replace(/\D/g, "")}`;
}

/**
 * A mainland Chinese number (+86): Adminium sends no text there, from either
 * provider. Hong Kong (+852) and Taiwan (+886) are not it.
 */
export function chinaMainland(phone: string): boolean {
  const digits = digitsOf(phone);
  return digits.startsWith("0086");
}

/**
 * Whether the number reads as a phone number: digits with the usual marks
 * between them, 7 to 15 digits. Loose on purpose: a number this passes and
 * the provider refuses still costs nothing but that one text.
 */
export function readableNumber(phone: string): boolean {
  const trimmed = phone.trim();
  if (trimmed === "") return false;
  if (!/^\+?[\d\s().\-/]+$/.test(trimmed)) return false;
  const count = trimmed.replace(/\D/g, "").length;
  return count >= 7 && count <= 15;
}

/**
 * Whether two numbers are one, written either way: a leading 0 or a country
 * code aside. The last nine digits are compared, as the desk compares a
 * typed number with the one on file.
 */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = (a ?? "").replace(/\D/g, "");
  const y = (b ?? "").replace(/\D/g, "");
  if (x.length < 7 || y.length < 7) return false;
  return x.slice(-9) === y.slice(-9);
}

/** What the box says under itself, and whether it may be ticked. */
export type BoxState = { kind: "open" } | { kind: "china" } | { kind: "check" };

export function boxState(phone: string, ticked: boolean): BoxState {
  if (chinaMainland(phone)) return { kind: "china" };
  if (ticked && phone.trim() !== "" && !readableNumber(phone)) return { kind: "check" };
  return { kind: "open" };
}

/** Oldest first, by when each answer was given (and the order they were made). */
const byTime = (a: Pick<TextAnswer, "created_at" | "id">, b: Pick<TextAnswer, "created_at" | "id">) =>
  (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id - b.id;

/** The patient's own last word on texts, from the Prefs page's read: on, off (they asked us to stop), or never asked. */
export function ownTextState(answers: readonly Pick<TextAnswer, "created_at" | "id" | "texts_ok" | "texts_off">[]): "on" | "stopped" | "none" {
  const last = [...answers].sort(byTime).filter((a) => a.texts_ok || a.texts_off).at(-1);
  if (last === undefined) return "none";
  return last.texts_off ? "stopped" : "on";
}

/**
 * What Adminium wrote on a text row it did not send, said as one of the
 * desk's reasons. The sentences are Adminium's fixed English
 * (`outbox/text-words.ts`): none holds a number or a word of the text.
 */
export type TextReason = "noConsent" | "stopped" | "noProvider" | "noMobile" | "number" | "country" | "empty" | "waiting" | "limit" | "off";

export function textReason(error: string | null): TextReason | null {
  const text = (error ?? "").trim().toLowerCase();
  if (text === "") return null;
  if (text.includes("has not agreed to texts") || text.includes("has not confirmed their yes")) return "noConsent";
  if (text.includes("replied stop") || text.includes("opted out")) return "stopped";
  if (text.startsWith("no text provider") || text.startsWith("no sender is set")) return "noProvider";
  if (text.startsWith("no mobile number")) return "noMobile";
  if (text.includes("number cannot be read") || text.includes("number is invalid") || text.includes("cannot receive a text") || text.includes("not a mobile")) return "number";
  if (text.includes("no texts go to this country")) return "country";
  if (text.includes("value the text prints is empty")) return "empty";
  if (text.startsWith("waiting for the sending hours")) return "waiting";
  if (text.includes("daily text limit")) return "limit";
  if (text.startsWith("texts are switched off")) return "off";
  return null;
}

/**
 * A text row that will never go, and that nobody needs to act on from the
 * desk: the patient never said yes, or asked to stop, or has no mobile, or
 * the practice has no provider. The desk shows it quietly as "No text", never
 * as a failure to send again.
 */
export function quietText(message: Pick<Message, "kind" | "status" | "error">): boolean {
  if (!isTextKind(message.kind)) return false;
  if (message.status !== "failed" && message.status !== "skipped") return false;
  const why = textReason(message.error);
  return why === "noConsent" || why === "stopped" || why === "noMobile" || why === "noProvider" || why === "country" || why === "off";
}

export type TextStandingKind = "off" | "none" | "yes" | "no" | "other" | "stopped";

export interface TextStanding {
  kind: TextStandingKind;
  /** The answer that decides it, when one does. */
  answer: TextAnswer | null;
  /** The last text the outbox logged for them. */
  last: Message | null;
}

/**
 * Where a patient stands on texts, as the desk can tell it: their last
 * answer for the number on file (their own, or one given on the box before
 * they were on file, matched by the number), and a STOP the outbox has heard
 * of since. A yes is for one number: a yes for another number needs a new one.
 */
export function textStanding(input: {
  patient: Pick<Patient, "id" | "mobile">;
  answers: readonly TextAnswer[];
  messages: readonly Message[];
  textsOn: boolean;
}): TextStanding {
  const { patient, answers, messages, textsOn } = input;
  const texts = messages.filter((m) => m.patient_id === patient.id && isTextKind(m.kind as MessageKind));
  const last = [...texts].sort((a, b) => (a.sent_at ?? a.created_at ?? "").localeCompare(b.sent_at ?? b.created_at ?? "") || a.id - b.id).at(-1) ?? null;
  const given = answers.filter((a) => a.texts_ok || a.texts_off);
  const forThisNumber = given.filter((a) => samePhone(a.mobile, patient.mobile) && (a.patient_id === null || a.patient_id === patient.id)).sort(byTime);
  const answer = forThisNumber.at(-1) ?? null;
  if (!textsOn) return { kind: "off", answer, last };
  // A STOP heard of after their last yes: the text that told us is the last one.
  if (last !== null && textReason(last.error) === "stopped" && (answer === null || (last.created_at ?? "") >= (answer.created_at ?? ""))) {
    return { kind: "stopped", answer, last };
  }
  if (answer !== null) return { kind: answer.texts_off ? "no" : "yes", answer, last };
  const elsewhere = given.some((a) => a.patient_id === patient.id && a.texts_ok);
  return { kind: elsewhere ? "other" : "none", answer: null, last };
}

/**
 * A run of left-to-right text inside any line: a phone number stays in
 * order in Arabic. First-strong isolate, so the run takes no direction from
 * the sentence around it and gives it none.
 */
export const ltr = (text: string): string => `\u2066${text}\u2069`;
