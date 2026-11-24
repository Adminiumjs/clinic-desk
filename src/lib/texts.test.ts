import { describe, expect, it } from "vitest";

import type { Message, TextAnswer } from "../data/types.ts";
import { boxState, chinaMainland, ownTextState, quietText, readableNumber, samePhone, textReason, textStanding } from "./texts.ts";

const answer = (over: Partial<TextAnswer>): TextAnswer => ({
  id: 1,
  patient_id: 7,
  name: null,
  mobile: "07700 900142",
  texts_ok: false,
  texts_off: false,
  source: "prefs",
  about_ref: null,
  created_at: "2026-07-01T10:00:00.000Z",
  ...over,
});
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
  due_at: null,
  sent_at: "2026-07-20T09:00:00.000Z",
  created_by: null,
  client_key: null,
  created_at: "2026-07-20T09:00:00.000Z",
  ...over,
});
const patient = { id: 7, mobile: "07700 900142" };

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

describe("the patient's own word on texts", () => {
  it("is their last yes or no, whatever came between", () => {
    expect(ownTextState([])).toBe("none");
    expect(ownTextState([answer({ id: 1, texts_ok: true })])).toBe("on");
    expect(ownTextState([answer({ id: 2, texts_off: true, created_at: "2026-07-05T10:00:00.000Z" }), answer({ id: 1, texts_ok: true })])).toBe("stopped");
  });
});

describe("Adminium's reasons on a text row", () => {
  it("are read as the desk's, and the ones nobody acts on read quietly", () => {
    expect(textReason("Not sent: this person has not agreed to texts")).toBe("noConsent");
    expect(textReason("Not sent: this person replied STOP")).toBe("stopped");
    expect(textReason("Not sent: this person opted out at the provider")).toBe("stopped");
    expect(textReason("No text provider is connected")).toBe("noProvider");
    expect(textReason("No mobile number on file")).toBe("noMobile");
    expect(textReason("Not sent: no texts go to this country")).toBe("country");
    expect(textReason("Not sent: a value the text prints is empty")).toBe("empty");
    expect(textReason("Waiting for the sending hours: goes at 2026-07-28 08:00 UTC")).toBe("waiting");
    expect(textReason("Not delivered: the provider reports it failed")).toBeNull();
    expect(quietText(text({ status: "failed", error: "Not sent: this person has not agreed to texts" }))).toBe(true);
    expect(quietText(text({ status: "failed", error: "Not delivered: the provider reports it failed" }))).toBe(false);
    expect(quietText(text({ status: "failed", error: "Not sent: a value the text prints is empty" }))).toBe(false);
    // An email's reason is the email's own.
    expect(quietText(text({ kind: "reminder", status: "failed", error: "Not sent: this person has not agreed to texts" }))).toBe(false);
  });
});

describe("where a patient stands on texts, for the desk", () => {
  const standing = (answers: TextAnswer[], messages: Message[] = [], textsOn = true) => textStanding({ patient, answers, messages, textsOn }).kind;

  it("is off while the practice sends no texts", () => {
    expect(standing([answer({ texts_ok: true })], [], false)).toBe("off");
  });

  it("is their last answer for the number on file, theirs or one given on the box before they were on file", () => {
    expect(standing([])).toBe("none");
    expect(standing([answer({ texts_ok: true })])).toBe("yes");
    expect(standing([answer({ patient_id: null, mobile: "+44 7700 900142", texts_ok: true, source: "booking" })])).toBe("yes");
    expect(standing([answer({ id: 1, texts_ok: true }), answer({ id: 2, texts_off: true, created_at: "2026-07-09T10:00:00.000Z" })])).toBe("no");
  });

  it("needs a yes for this number: one for another number is not it", () => {
    expect(standing([answer({ mobile: "07700 900999", texts_ok: true })])).toBe("other");
    // Somebody else's answer for another number is nothing of theirs.
    expect(standing([answer({ patient_id: 8, mobile: "07700 900999", texts_ok: true })])).toBe("none");
  });

  it("says they asked to stop when a text since their yes was refused for a STOP", () => {
    const stop = text({ status: "failed", error: "Not sent: this person replied STOP", created_at: "2026-07-21T09:00:00.000Z" });
    expect(standing([answer({ texts_ok: true })], [stop])).toBe("stopped");
    // A yes given after that STOP is the last word.
    expect(standing([answer({ texts_ok: true, created_at: "2026-07-22T10:00:00.000Z" })], [stop])).toBe("yes");
  });
});
