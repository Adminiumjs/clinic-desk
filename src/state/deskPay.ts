/**
 * What the desk knows of paying online: whether the practice takes payments
 * (someone switched Clinic Desk on in Adminium's Payments), whether patients
 * can pay online right now, whether this person is rehearsing it, and whether
 * they may give money back — all as the staff config says, all false when it
 * says nothing. While `on` is false the desk reads exactly as it always has.
 *
 * And what the desk needs to draw Adminium's own refund and pay-link parts:
 * where the kit is loaded from, the database and the real name of the visits'
 * table, and the token the person's writes carry.
 */
import { create } from "zustand";

import type { StaffKit, StaffPayments } from "../staffConnection.ts";

export interface DeskPayState extends StaffPayments {
  kit: StaffKit | null;
  connectionId: string | null;
  /** The visits' table as Adminium named it at install (`clinic_appointments`). */
  visitsTable: string | null;
  csrfToken: string | null;
}

export const useDeskPay = create<DeskPayState>(() => ({
  on: false,
  online: false,
  test: false,
  refund: false,
  kit: null,
  connectionId: null,
  visitsTable: null,
  csrfToken: null,
}));

export function setDeskPay(next: Partial<DeskPayState>): void {
  useDeskPay.setState(next);
}

/** Whether the desk shows anything of paying online: the practice takes payments, or money paid online is still here to account for. */
export const showsOnline = (s: Pick<DeskPayState, "on">, onlineMoney: number): boolean => s.on || onlineMoney > 0;
