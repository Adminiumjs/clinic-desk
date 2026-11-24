import { describe, expect, it } from "vitest";

import type { Message } from "../data/types.ts";
import { boxState, chinaMainland, quietText, readableNumber, samePhone, textReason } from "./texts.ts";

const text = (over: Partial<Message>): Message => ({
  id: 1,
  kind: "reminder_text",
  patient_id: 7,
  appointment_id: 3,
  recall_id: null,
  closure_id: null,
  payment_id: null,
  to_address: "07700 900142",
  language: "en-US",
  status: "sent",
  error: null,
  text_reason: null,
  due_at: null,
  sent_at: "2026-07-20T09:00:00.000Z",
  created_by: null,
  client_key: null,
  created_at: "2026-07-20T09:00:00.000Z",
  ...over,
});

describe("the box's numbers", () => {
  it("knows a mainland Chinese number however it is written, and leaves Hong Kong and Taiwan alone", () => {
    expect(["+86 138 0013 8000", "0086 13800138000", " +8613800138000"].map(chinaMainland)).toEqual([true, true, true]);
    expect(["+852 6123 4567", "+886 912 345 678", "07700 900142", "+44 7700 900142", "86 1234 5678"].map(chinaMainland)).toEqual([false, false, false, false, false]);
  });

  it("reads a number with the usual marks, and not words or a short scrap", () => {
    expect(["07700 900142", "+44 (0)7700-900142", "0117 496 0142"].map(readableNumber)).toEqual([true, true, true]);
    expect(["", "ring me", "123", "07700 9001420000000000", "07700x900142"].map(readableNumber)).toEqual([false, false, false, false, false]);
  });

  it("says nothing more until the box is ticked; a +86 number turns it off whether ticked or not", () => {
    expect(boxState("12", false)).toEqual({ kind: "open" });
    expect(boxState("12", true)).toEqual({ kind: "check" });
    expect(boxState("", true)).toEqual({ kind: "open" });
    expect(boxState("+86 138 0013 8000", false)).toEqual({ kind: "china" });
    expect(boxState("+86 138 0013 8000", true)).toEqual({ kind: "china" });
  });

  it("matches a number written with or without its country code", () => {
    expect(samePhone("07700 900142", "+44 7700 900142")).toBe(true);
    expect(samePhone("07700 900142", "07700 900143")).toBe(false);
    expect(samePhone(null, "07700 900142")).toBe(false);
  });
});

describe("Adminium's outcome codes on a text row", () => {
  it("are read as the desk's reasons, and the ones nobody acts on read quietly", () => {
    expect(["no-consent", "unconfirmed-consent", "stopped", "opted-out", "not-set-up", "no-number", "unreadable-phone", "country-blocked-cn", "unfilled-placeholder", "waiting", "daily-limit"].map(textReason)).toEqual([
      "noConsent",
      "noConsent",
      "stopped",
      "stopped",
      "noProvider",
      "noMobile",
      "number",
      "country",
      "empty",
      "waiting",
      "limit",
    ]);
    expect([textReason("sent"), textReason("queued"), textReason(null), textReason("something-new")]).toEqual([null, null, null, null]);
    expect(quietText(text({ status: "failed", text_reason: "no-consent", error: "Not sent: this person has not agreed to texts" }))).toBe(true);
    expect(quietText(text({ status: "failed", text_reason: "not-set-up" }))).toBe(true);
    expect(quietText(text({ status: "failed", text_reason: "unfilled-placeholder" }))).toBe(false);
    // The English sentence is never read: a row with no code is a failure to look at.
    expect(quietText(text({ status: "failed", text_reason: null, error: "Not sent: this person has not agreed to texts" }))).toBe(false);
    // An email's outcome is the email's own.
    expect(quietText(text({ kind: "reminder", status: "failed", text_reason: "no-consent" }))).toBe(false);
  });
});
