/**
 * The patients' pages: what they have read, and where the patient is in
 * booking, finding themselves and confirming their code.
 *
 * Everything a patient does goes through the practice's browser key
 * (`PatientsPort`); nothing here decides whether a time is free or a visit
 * may move — the server does, and the pages say what it said.
 */
import { create } from "zustand";

import type { Booked, Catalogue, CodeResult, CodeSent, Level, NewRegistration, NewVisit, OwnDetails, OwnVisit, PatientsPort, Wish } from "../data/ports.ts";
import { PortError } from "../data/ports.ts";
import type { Day, Hhmm, Id, Instant } from "../data/types.ts";

/** The visit being moved: Find a time books its new time on the same visit. */
export interface Moving {
  id: Id;
  ref: string;
  startsAt: Instant;
  typeId: Id;
  clinicianId: Id | null;
}

export interface PatientsState {
  catalogue: Catalogue | null;
  catalogueError: string | null;

  /** Find a time. */
  typeId: Id | null;
  clinicianId: Id | "any";
  day: Day | null;
  time: Hhmm | null;
  /** Moving a visit instead of booking one. */
  moving: Moving | null;

  /** The person found by mobile and date of birth (the name the server showed). */
  found: { name: string; bornOn: Day } | null;
  level: Level | null;

  /** The visit just booked, for the confirmation page. */
  booked: (Booked & { firstVisit: boolean; firstName: string; email: string | null; typeId: Id; reason: string | null; moved: boolean }) | null;

  visits: OwnVisit[] | null;
  details: OwnDetails | null;
}

export const usePatients = create<PatientsState>(() => ({
  catalogue: null,
  catalogueError: null,
  typeId: null,
  clinicianId: "any",
  day: null,
  time: null,
  moving: null,
  found: null,
  level: null,
  booked: null,
  visits: null,
  details: null,
}));

let port: PatientsPort | null = null;
export function setPatientsPort(next: PatientsPort): void {
  port = next;
}
export function patientsPort(): PatientsPort {
  if (port === null) throw new Error("the patients' port is not set: boot sets it before any page mounts");
  return port;
}

export async function loadCatalogue(): Promise<void> {
  try {
    usePatients.setState({ catalogue: await patientsPort().catalogue(), catalogueError: null });
  } catch (error) {
    usePatients.setState({ catalogueError: error instanceof Error ? error.message : String(error) });
  }
}

/** A refusal's code, for the page to put into words. */
export const codeOf = (error: unknown): string => (error instanceof PortError ? error.code : "PUBLIC_NETWORK_UNAVAILABLE");

/** Find the patient; null when the details match nobody (or more than one person). */
export async function findMe(mobile: string, bornOn: Day): Promise<{ name: string } | null> {
  const found = await patientsPort().find(mobile, bornOn);
  usePatients.setState({ found: found === null ? null : { name: found.name, bornOn }, level: found === null ? null : "lookup", visits: null, details: null });
  return found;
}

export async function sendCode(request: { purpose: "verify" } | { purpose: "email-change"; email: string }): Promise<CodeSent> {
  return patientsPort().requestCode(request);
}

export async function checkCode(code: string, purpose: "verify" | "email-change" = "verify"): Promise<CodeResult> {
  const result = await patientsPort().verifyCode(code, purpose);
  if (result.ok) {
    // After an address change every session ends: the patient finds themselves again.
    usePatients.setState(result.ended ? { level: null, found: null, visits: null, details: null } : { level: result.level });
  }
  return result;
}

export async function loadMyVisits(): Promise<OwnVisit[]> {
  const visits = await patientsPort().myVisits();
  usePatients.setState({ visits });
  return visits;
}

export async function loadMyDetails(): Promise<OwnDetails> {
  const details = await patientsPort().myDetails();
  usePatients.setState({ details });
  return details;
}

export async function savePrefs(prefs: { remind_email: boolean; remind_lead_hours: number }): Promise<OwnDetails> {
  const details = await patientsPort().savePrefs(prefs);
  usePatients.setState({ details });
  return details;
}

export async function bookVisit(visit: NewVisit, who: { firstName: string; email: string | null }): Promise<Booked> {
  const booked = await patientsPort().book(visit);
  usePatients.setState({
    booked: {
      ...booked,
      firstVisit: visit.newPatient !== undefined,
      firstName: who.firstName,
      email: who.email,
      typeId: visit.visit_type_id,
      reason: visit.reason,
      moved: false,
    },
  });
  return booked;
}

/** Move the visit being moved to the chosen time: the same visit, the same reference. */
export async function moveMine(startsAt: Instant): Promise<OwnVisit> {
  const moving = usePatients.getState().moving;
  if (moving === null) throw new PortError("PUBLIC_NOT_FOUND", "nothing is being moved");
  const moved = await patientsPort().reschedule(moving.id, startsAt);
  const found = usePatients.getState().found;
  usePatients.setState((s) => ({
    moving: null,
    visits: s.visits === null ? null : s.visits.map((v) => (v.id === moved.id ? moved : v)),
    booked: {
      ref: moved.ref,
      starts_at: moved.starts_at,
      minutes: moved.minutes,
      clinician_id: moved.clinician_id,
      status: moved.status,
      firstVisit: false,
      firstName: (found?.name ?? "").split(/\s+/)[0] ?? "",
      email: s.details?.email ?? null,
      typeId: moved.visit_type_id,
      reason: moved.reason,
      moved: true,
    },
  }));
  return moved;
}

export async function cancelMine(id: Id): Promise<OwnVisit> {
  const cancelled = await patientsPort().cancel(id);
  usePatients.setState((s) => ({ visits: s.visits === null ? null : s.visits.map((v) => (v.id === id ? cancelled : v)) }));
  return cancelled;
}

export async function register(person: NewRegistration): Promise<{ ref: string }> {
  return patientsPort().register(person);
}

/**
 * Put the person just found on the earlier-time list. The answer is where
 * they stand (null when the server does not say); a second place while they
 * already wait is the server's refusal, for the page to put into words.
 */
export async function joinWaitlist(wish: Wish): Promise<{ rank: number | null }> {
  return patientsPort().joinWaitlist(wish);
}

/** "Not you? Sign out": the session ends and the page forgets them. */
export async function signOutPatient(): Promise<void> {
  await patientsPort()
    .signOut()
    .catch(() => undefined);
  usePatients.setState({ found: null, level: null, visits: null, details: null, moving: null });
}
