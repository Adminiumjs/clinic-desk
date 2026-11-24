/**
 * Visit texts, worked out once for every screen that shows them.
 *
 *   - the box: whether the number typed is one we may never text (mainland
 *     China, +86: Adminium refuses every text there) and whether it reads as
 *     a number at all — neither stops the form, they only change its words;
 *   - what a text row's outcome code says, in the desk's words.
 *
 * Where a person stands on texts is Adminium's to say (its text consent log
 * and stop list): the pages ask it, and keep no copy.
 *
 * Pure: the demo, the desk and the patients' pages read the same answers.
 */
import type { Message } from "../data/types.ts";
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

/**
 * A text row's outcome, as the code Adminium writes beside its sentence
 * (`outbox.columns.textReason`), said as one of the desk's reasons. Null for
 * a text that went, waits in the queue, or for a code the desk has no words
 * for (the sentence in `error` is shown then).
 */
export type TextReason = "noConsent" | "stopped" | "noProvider" | "noMobile" | "number" | "country" | "empty" | "waiting" | "limit";

const REASONS: Readonly<Record<string, TextReason>> = {
  "no-consent": "noConsent",
  "unconfirmed-consent": "noConsent",
  stopped: "stopped",
  "opted-out": "stopped",
  "not-set-up": "noProvider",
  "no-number": "noMobile",
  "unreadable-phone": "number",
  "bad-number": "number",
  "invalid-number": "number",
  "cannot-receive-text": "number",
  "not-mobile": "number",
  "country-blocked": "country",
  "country-blocked-cn": "country",
  "unfilled-placeholder": "empty",
  waiting: "waiting",
  "daily-limit": "limit",
};

export function textReason(code: string | null): TextReason | null {
  return code === null ? null : (REASONS[code.trim()] ?? null);
}

/**
 * A text row that will never go, and that nobody needs to act on from the
 * desk: the patient never said yes, or asked to stop, or has no mobile, or
 * the practice has no provider. The desk shows it quietly as "No text", never
 * as a failure to send again.
 */
export function quietText(message: Pick<Message, "kind" | "status" | "text_reason">): boolean {
  if (!isTextKind(message.kind)) return false;
  if (message.status !== "failed" && message.status !== "skipped") return false;
  const why = textReason(message.text_reason);
  return why === "noConsent" || why === "stopped" || why === "noMobile" || why === "noProvider" || why === "country";
}

/**
 * A run of left-to-right text inside any line: a phone number stays in
 * order in Arabic. First-strong isolate, so the run takes no direction from
 * the sentence around it and gives it none.
 */
export const ltr = (text: string): string => `\u2066${text}\u2069`;
