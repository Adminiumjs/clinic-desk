/**
 * The kiosk's small rules, kept apart from the screen so they can be tested:
 * reading what a person typed, and which sentence each outcome shows.
 */
import type { LucideIcon } from "lucide-react";
import { Armchair, CircleAlert, Clock, TimerReset, WifiOff } from "lucide-react";

import type { KioskOutcome } from "../../data/kiosk.ts";
import type { Day } from "../../data/types.ts";
import type { MessageKey } from "../../i18n/index.tsx";

/** How long the thank-you stays before the screen is ready for the next person. */
export const DONE_SECONDS = 10;

/**
 * Digits as a tablet's keyboard may type them — Arabic-Indic and Persian
 * digits too, which an Arabic keyboard gives — as plain 0–9, and nothing else.
 */
export function digitsOf(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

/**
 * The date of birth from its three boxes, as `YYYY-MM-DD`, or null when it is
 * not a real day on or before today. A one-digit day or month is fine ("3"
 * is the 3rd).
 */
export function bornOnOf(day: string, month: string, year: string, today: Day): Day | null {
  const d = Number(digitsOf(day));
  const m = Number(digitsOf(month));
  const y = digitsOf(year);
  if (y.length !== 4 || d < 1 || d > 31 || m < 1 || m > 12) return null;
  const at = new Date(Date.UTC(Number(y), m - 1, d));
  // 31 February rolls into March: not a day anyone was born on.
  if (at.getUTCDate() !== d || at.getUTCMonth() !== m - 1) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return iso > today ? null : iso;
}

/**
 * Enough of a mobile number to look for. Seven digits is the shortest a
 * number is anywhere the practice may be (a Danish mobile is eight); the
 * server compares the whole number, however it was spaced.
 */
export const mobileReady = (mobile: string): boolean => digitsOf(mobile).length >= 7;

/** What the start says under the fields: an outcome of "Check in", or the fields left empty. */
export type KioskNote = Exclude<KioskOutcome, { kind: "done" } | { kind: "off" }> | { kind: "empty" };

export interface NoteLook {
  tone: "warn" | "info";
  icon: LucideIcon;
  key: MessageKey;
  /** The fields are what is wrong (read out as invalid), rather than the day. */
  invalid: boolean;
}

/** Each message's tone, icon and sentence — the design's three, and the kiosk's own refusals in the warning's look. */
export function noteLook(note: KioskNote): NoteLook {
  switch (note.kind) {
    case "empty":
      return { tone: "warn", icon: CircleAlert, key: "kiosk.msg.empty", invalid: true };
    case "notfound":
      return { tone: "warn", icon: CircleAlert, key: "kiosk.msg.notfound", invalid: true };
    case "already":
      return { tone: "info", icon: Armchair, key: "kiosk.msg.already", invalid: false };
    case "early":
      return { tone: "info", icon: Clock, key: "kiosk.msg.early", invalid: false };
    case "signedOut":
      return { tone: "warn", icon: CircleAlert, key: "kiosk.msg.signedOut", invalid: false };
    case "gone":
      return { tone: "warn", icon: CircleAlert, key: "kiosk.msg.gone", invalid: false };
    case "busy":
      return { tone: "warn", icon: TimerReset, key: "kiosk.msg.busy", invalid: false };
    case "offline":
      return { tone: "warn", icon: WifiOff, key: "kiosk.msg.offline", invalid: false };
  }
}

/** The thank-you's line: with the clinician and time, the time alone, or neither, as the read allowed. */
export function doneLine(done: Extract<KioskOutcome, { kind: "done" }>): { key: MessageKey; withTime: boolean } {
  if (done.at !== null && done.clinician !== null && done.clinician !== "") return { key: "kiosk.doneWith", withTime: true };
  if (done.at !== null) return { key: "kiosk.doneAt", withTime: true };
  return { key: "kiosk.donePlain", withTime: false };
}

/** `1990-04-07` as the three boxes hold it (the demo's fill). */
export function boxesOf(bornOn: Day): { day: string; month: string; year: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bornOn);
  return m === null ? null : { day: m[3]!, month: m[2]!, year: m[1]! };
}
