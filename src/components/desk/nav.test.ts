/**
 * The desk's sidebar: which screens a person sees, and what the counts beside
 * them count.
 */
import { describe, expect, it } from "vitest";

import type { Appointment, Message, Patient } from "../../data/types.ts";
import type { StaffAccess } from "../../staffConnection.ts";
import type { DeskState } from "../../state/desk.ts";
import { outboxWaiting } from "../../lib/outbox.ts";
import { visibleNav } from "./nav.ts";

const tables = (entries: Record<string, ("read" | "create" | "update" | "delete")[]>): StaffAccess => ({ tables: entries, roles: [] });
const views = (access: StaffAccess | null, role: DeskState["me"]["role"]) => visibleNav(access, role).map((i) => i.view);

describe("which screens show", () => {
  it("shows everything when the server said nothing about access", () => {
    expect(views(null, null)).toHaveLength(12);
  });
  it("follows what the person may read, and settings only to someone who may change them", () => {
    const reception = tables({ appointments: ["read", "update"], patients: ["read"], registrations: ["read"], payments: ["read"], recalls: ["read"], opening_hours: ["read"], messages: ["read"], day_closes: ["read"], settings: ["read"] });
    expect(views(reception, "reception")).toEqual(["daysheet", "waiting", "patients", "registrations", "week", "accounts", "recalls", "hours", "outbox", "endofday"]);
    expect(views(tables({ ...reception.tables, settings: ["read", "update"] }), "manager")).toContain("settings");
  });
  it("gives a clinician the day sheet, the waiting room and the patients only", () => {
    const clinician = tables({ appointments: ["read", "update"], patients: ["read"], recalls: ["read"], opening_hours: ["read"], settings: ["read"] });
    expect(views(clinician, "clinician")).toEqual(["daysheet", "waiting", "patients"]);
  });
  it("gives the kiosk nothing", () => {
    expect(views(tables({}), "kiosk")).toEqual([]);
  });
});

describe("the outbox count", () => {
  const NOW = Date.parse("2026-07-28T08:20:00.000Z");
  const patient = (id: number, email: string | null, lead = 24): Patient => ({ id, email, remind_email: true, remind_lead_hours: lead } as unknown as Patient);
  const booked = (id: number, patientId: number, at: string): Appointment => ({ id, patient_id: patientId, starts_at: at, status: "booked" } as unknown as Appointment);
  const message = (id: number, status: Message["status"], kind: Message["kind"], appointment: number | null, dueAt: string | null = null): Message =>
    ({ id, status, kind, appointment_id: appointment, due_at: dueAt } as unknown as Message);
  it("counts queued messages and the reminders due in the next two days that are not queued yet", () => {
    const s = {
      settings: { reminders_on: true },
      patients: { 1: patient(1, "a@example.com"), 2: patient(2, null), 3: patient(3, "c@example.com", 12) },
      visits: {
        10: booked(10, 1, "2026-07-29T09:00:00.000Z"), // tomorrow: due
        11: booked(11, 2, "2026-07-29T09:00:00.000Z"), // no email: never
        12: booked(12, 1, "2026-08-05T09:00:00.000Z"), // next week: not yet
        13: booked(13, 3, "2026-07-29T10:00:00.000Z"), // already queued below
        14: booked(14, 1, "2026-07-28T07:00:00.000Z"), // started already
      },
      messages: { 1: message(1, "queued", "reminder", 13, "2026-07-29T10:00:00.000Z"), 2: message(2, "sent", "confirmation", 10), 3: message(3, "failed", "recall", null) },
    } as unknown as DeskState;
    expect(outboxWaiting(s, NOW)).toBe(2);
    expect(outboxWaiting({ ...s, settings: { reminders_on: false } } as unknown as DeskState, NOW)).toBe(1);
  });
});
