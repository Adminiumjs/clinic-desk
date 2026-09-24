/**
 * What is on screen, as opposed to what is in the database (`desk.ts`): the
 * screen, the side (patients or the desk), the theme, the toast, the one
 * sheet or panel that is open, and the day sheet's "placing" mode.
 *
 * Only one sheet or panel is open at a time, which is also what the demo
 * card reads to hide itself (`overlayOpen`).
 */
import { create } from "zustand";

import type { Day, DeskView, Id, Instant, PatientView, Persona, View } from "../data/types.ts";

export type Theme = "light" | "dark";

export type ToastTone = "fg" | "pos" | "warn" | "danger";
export interface Toast {
  id: number;
  text: string;
  /** Lucide icon name. */
  icon: string;
  tone: ToastTone;
}

/** Every sheet and dialog the desk opens, with what it is about. */
export type Sheet =
  | { kind: "book"; prefill?: { patientId?: Id; typeId?: Id; clinicianId?: Id | null; day?: Day } }
  | { kind: "move"; visitId: Id; to: { startsAt: Instant; clinicianId: Id | null } }
  | { kind: "cancel"; visitId: Id }
  | { kind: "sendOff"; visitId: Id }
  | { kind: "payment"; visitId: Id; amount?: number }
  | { kind: "receipt"; paymentId: Id }
  | { kind: "writeOff"; visitId: Id }
  | { kind: "notNeeded"; recallId: Id }
  | { kind: "closure"; prefill?: { clinicianId: Id | null; from: Day; to: Day; label: string; note: string | null } }
  | { kind: "hours" }
  | { kind: "closeDesk" }
  | { kind: "registration"; item: { kind: "registration" | "visit"; id: Id } }
  | { kind: "waitAsk"; entryId: Id; at: { startsAt: Instant; clinicianId: Id } };

/**
 * The day sheet asking for a time: booking someone in, moving a visit,
 * placing a recall or a follow-up. The open slots shown are the server's
 * free times for this visit type (and clinician), and tapping one hands the
 * choice to `place`.
 */
export interface Placing {
  /** What the banner says: who, what, how long. */
  what: "booking" | "moving";
  patientName: string;
  typeId: Id;
  minutes: number;
  /** One clinician, or anyone. */
  clinicianId: Id | null;
  /** The visit being moved, whose own time does not count against it. */
  exclude?: Id;
  /** The visit's reference, for "Moving … · RH-7Q2K". */
  ref?: string;
  /** The day to open on. */
  day?: Day;
  place: (at: { startsAt: Instant; clinicianId: Id }) => void;
}

export interface UiState {
  persona: Persona;
  view: View;
  theme: Theme;
  toasts: Toast[];
  sheet: Sheet | null;
  /** The visit panel: which visit it shows. */
  panel: Id | null;
  /** The phone-width menu (desk, standalone only). */
  menu: boolean;
  placing: Placing | null;
  /** The day the day sheet shows. */
  sheetDay: Day | null;
  /** The Monday of the week diary's week. */
  weekOf: Day | null;
  /** The patient whose page is open on the Patients screen. */
  patientId: Id | null;
  /** The session ended: nothing more saves until the person signs in again. */
  signedOut: boolean;
}

export const useUi = create<UiState>(() => ({
  persona: "clinic",
  view: "daysheet",
  theme: "light",
  toasts: [],
  sheet: null,
  panel: null,
  menu: false,
  placing: null,
  sheetDay: null,
  weekOf: null,
  patientId: null,
  signedOut: false,
}));

const PATIENT_VIEWS: readonly PatientView[] = ["find", "details", "confirm", "visits", "team", "findus", "prices", "sooner", "prefs", "register", "faq", "notfound"];
export const isPatientView = (view: View): view is PatientView => (PATIENT_VIEWS as readonly string[]).includes(view);

/** Go to a screen: whatever sheet, panel or menu was open closes. */
export function go(view: View): void {
  useUi.setState({ view, sheet: null, panel: null, menu: false });
  if (typeof window !== "undefined") window.scrollTo?.({ top: 0 });
}

export function goDesk(view: DeskView): void {
  go(view);
}

/** Switch sides (the demo): each opens on its first screen. */
export function setPersona(persona: Persona): void {
  useUi.setState({ persona, view: persona === "patient" ? "find" : "daysheet", sheet: null, panel: null, menu: false, placing: null });
}

export function openSheet(sheet: Sheet): void {
  useUi.setState({ sheet, panel: null, menu: false });
}
export function closeSheet(): void {
  useUi.setState({ sheet: null });
}
export function openPanel(visitId: Id): void {
  useUi.setState({ panel: visitId, sheet: null });
}
export function closePanel(): void {
  useUi.setState({ panel: null });
}

/** Start placing on the day sheet (which it opens). */
export function startPlacing(placing: Placing): void {
  useUi.setState((s) => ({ placing, view: "daysheet", sheet: null, panel: null, sheetDay: placing.day ?? s.sheetDay }));
}
export function stopPlacing(): void {
  useUi.setState({ placing: null });
}

let toastNo = 0;
/** A short message at the foot of the screen, gone after a few seconds. */
export function toast(text: string, opts: { icon?: string; tone?: ToastTone } = {}): void {
  const id = ++toastNo;
  useUi.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, icon: opts.icon ?? "check", tone: opts.tone ?? "fg" }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
}

/** Whether a sheet, dialog, panel or menu covers the page (the demo card hides then). */
export const overlayOpen = (s: UiState): boolean => s.sheet !== null || s.panel !== null || s.menu;
