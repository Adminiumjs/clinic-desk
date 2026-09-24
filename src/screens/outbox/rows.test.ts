import { describe, expect, it } from "vitest";

import type { Appointment, Message, Patient, Settings } from "../../data/types.ts";
import { outboxRows, reasonKey, upcomingReminders, waitingCount } from "./rows.ts";
import { reservedAddress } from "../../lib/outbox.ts";

const NOW = Date.parse("2026-07-28T08:20:00.000Z");
const H = 3_600_000;
const at = (hours: number) => new Date(NOW + hours * H).toISOString();

const visit = (id: number, over: Partial<Appointment> = {}): Appointment =>
  ({ id, ref: `RH-${String(id)}`, patient_id: 1, status: "booked", starts_at: at(20), new_email: null, clinician_id: 1, visit_type_id: 1, ...over }) as Appointment;
const patient = (over: Partial<Patient> = {}): Patient => ({ id: 1, name: "Leila Farsi", email: "leila@example.com", remind_email: true, remind_lead_hours: 24, ...over }) as Patient;
const settings = (over: Partial<Settings> = {}): Settings => ({ reminders_on: true, default_lead_hours: 24, ...over }) as Settings;
const message = (id: number, over: Partial<Message> = {}): Message =>
  ({ id, kind: "reminder", appointment_id: 7, status: "sent", due_at: null, sent_at: null, created_at: null, error: null, to_address: "x@example.com", ...over }) as Message;

describe("upcomingReminders — what the reminder scan will queue", () => {
  it("lists a booked visit within 48 h, going at its patient's own lead", () => {
    const rows = upcomingReminders({ visits: [visit(7)], patients: { 1: patient({ remind_lead_hours: 12 }) }, messages: [], settings: settings(), now: NOW });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.goesAt).toBe(NOW + 8 * H);
    expect(rows[0]!.to).toBe("leila@example.com");
  });

  it("uses the practice's default lead for a first visit, and its own address", () => {
    const rows = upcomingReminders({ visits: [visit(7, { patient_id: null, new_email: "wren@example.com" })], patients: {}, messages: [], settings: settings({ default_lead_hours: 48 }), now: NOW });
    expect(rows[0]!.goesAt).toBe(NOW - 28 * H);
    expect(rows[0]!.to).toBe("wren@example.com");
  });

  it("leaves out a visit the desk already sent a reminder for at this start (a desk 'Send now' is not followed by another)", () => {
    const sentNow = message(1, { appointment_id: 7, due_at: at(20), status: "queued" });
    expect(upcomingReminders({ visits: [visit(7)], patients: { 1: patient() }, messages: [sentNow], settings: settings(), now: NOW })).toEqual([]);
  });

  it("lists a moved visit again: the old reminder named the old start", () => {
    const old = message(1, { appointment_id: 7, due_at: at(5) });
    expect(upcomingReminders({ visits: [visit(7)], patients: { 1: patient() }, messages: [old], settings: settings(), now: NOW })).toHaveLength(1);
  });

  it("lists nothing when reminders are switched off, or for a patient who asked for none", () => {
    expect(upcomingReminders({ visits: [visit(7)], patients: { 1: patient() }, messages: [], settings: settings({ reminders_on: false }), now: NOW })).toEqual([]);
    expect(upcomingReminders({ visits: [visit(7)], patients: { 1: patient({ remind_email: false }) }, messages: [], settings: settings(), now: NOW })).toEqual([]);
  });

  it("lists only booked visits that start after now and within 48 h", () => {
    const visits = [visit(1, { starts_at: at(-1) }), visit(2, { starts_at: at(49) }), visit(3, { status: "cancelled" }), visit(4, { starts_at: at(47) })];
    expect(upcomingReminders({ visits, patients: { 1: patient() }, messages: [], settings: settings(), now: NOW }).map((u) => u.visit.id)).toEqual([4]);
  });

  it("promises nothing for a patient the desk has not read", () => {
    expect(upcomingReminders({ visits: [visit(7, { patient_id: 9 })], patients: {}, messages: [], settings: settings(), now: NOW })).toEqual([]);
  });

  it("keeps a visit with no address, with nowhere to go", () => {
    const rows = upcomingReminders({ visits: [visit(7)], patients: { 1: patient({ email: null }) }, messages: [], settings: settings(), now: NOW });
    expect(rows[0]!.to).toBeNull();
  });
});

describe("outboxRows — the order and the count", () => {
  const dayOf = (iso: string) => iso.slice(0, 10);
  it("puts what is going first and counts only what can go", () => {
    const upcoming = upcomingReminders({ visits: [visit(7), visit(8, { patient_id: 2 })], patients: { 1: patient(), 2: patient({ id: 2, email: null }) }, messages: [], settings: settings(), now: NOW });
    const log = [
      message(1, { status: "sent", sent_at: "2026-07-28T07:00:00.000Z" }),
      message(2, { status: "sent", sent_at: "2026-07-27T07:00:00.000Z" }),
      message(3, { status: "queued", created_at: "2026-07-28T08:00:00.000Z", kind: "recall" }),
      message(4, { status: "failed", created_at: "2026-07-20T08:00:00.000Z" }),
    ];
    const rows = outboxRows(log, upcoming, "2026-07-28", dayOf);
    expect(rows.map((r) => r.state)).toEqual(["queued", "upcoming", "upcoming", "failed", "sent"]);
    // Yesterday's sent row is the Messages page's; the one with no address will not go.
    expect(waitingCount(rows)).toBe(2);
  });
});

describe("reasonKey — the sender's English, in the page's words", () => {
  it("knows the sender's sentences and leaves any other as written", () => {
    expect(reasonKey("No email on file")).toBe("outbox.why.noEmail");
    expect(reasonKey("A reserved address (for examples and tests)")).toBe("outbox.why.example");
    expect(reasonKey("Email is not set up on this server")).toBe("outbox.why.notSetUp");
    expect(reasonKey("Not delivered: the mailbox is full.")).toBeNull();
    expect(reasonKey(null)).toBeNull();
  });
});

describe("a reserved address in a hosted desk", () => {
  it("promises nothing: Adminium never mails one, and every sample patient has one", () => {
    const hosted = (email: string | null) =>
      upcomingReminders({ visits: [visit(7)], patients: { 1: patient({ email }) }, messages: [], settings: settings(), now: NOW, reservedGoNowhere: true });
    expect(hosted("leila@example.com")).toEqual([]);
    expect(hosted("desk@clinic.test")).toEqual([]);
    expect(hosted("leila@rowan.example")).toEqual([]);
    expect(hosted("leila@rowanhealth.co.uk").map((u) => u.to)).toEqual(["leila@rowanhealth.co.uk"]);
    // No address at all is still listed, as "No email on file" — that one the desk can fix.
    expect(hosted(null).map((u) => u.to)).toEqual([null]);
  });

  it("the demo's stand-in world still lists them", () => {
    expect(upcomingReminders({ visits: [visit(7)], patients: { 1: patient() }, messages: [], settings: settings(), now: NOW, reservedGoNowhere: false })).toHaveLength(1);
  });

  it("matches the server's rule for what is reserved", () => {
    for (const a of ["x@example.com", "x@example.org", "x@EXAMPLE.net.", "x@a.test", "x@a.invalid", "x@a.localhost", "x@a.example"]) expect(reservedAddress(a), a).toBe(true);
    for (const a of ["x@myexample.com", "x@example-clinic.com", "x@test.com", "x@a.co.uk"]) expect(reservedAddress(a), a).toBe(false);
  });
});
