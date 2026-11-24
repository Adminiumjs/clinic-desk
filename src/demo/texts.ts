/**
 * Visit texts on the website's demo, which has no Adminium behind it: the
 * text consent log and the stop list Adminium keeps, kept here in memory, by
 * number and by the same rules — a yes is for one exact number and this app;
 * the box ticked writes a yes, the box that means no a no; a verified
 * person's own fresh yes replaces their own no; nothing lifts a STOP but the
 * person's START; the desk may record a yes heard in person. Nothing leaves
 * the browser, and a text is logged as gone, as on a practice whose provider
 * took it.
 *
 * The sample bundle keeps texts off and ticks no box, because a real
 * install's sample cannot hold a yes Adminium never heard. The demo turns
 * texts on and gives four patients a past:
 *
 *   - Ewan said yes on his Reminders page a few weeks ago;
 *   - Nour ticked the box in her first booking;
 *   - Solveig said yes, then switched texts off herself;
 *   - Saoirse's parent replied STOP to a reminder (texting START lifts it);
 *   - and Tariq ticked the box as he registered, not yet accepted.
 */
import type { StaffTextAnswer, TextStanding } from "../data/ports.ts";
import type { DemoDb, Writer } from "./db.ts";

const DAY = 86_400_000;

/** One answer in the log: for a number, yes or no, from where. */
interface Answer {
  digits: string;
  state: "yes" | "no";
  at: number;
  source: "form" | "staff" | "person";
  how: string | null;
  by: string | null;
}

interface Log {
  answers: Answer[];
  /** Numbers that replied STOP, and when. */
  stopped: Map<string, number>;
}

const logs = new WeakMap<DemoDb, Log>();
const logOf = (db: DemoDb): Log => {
  let log = logs.get(db);
  if (log === undefined) {
    log = { answers: [], stopped: new Map() };
    logs.set(db, log);
  }
  return log;
};

/** A number as its last nine digits: `07700 900142` and `+44 7700 900142` are one. */
const digitsOf = (phone: string | null | undefined): string => (phone ?? "").replace(/\D/g, "").slice(-9);

export function recordDemoText(db: DemoDb, phone: string, answer: Omit<Answer, "digits" | "at"> & { at?: number }): void {
  const digits = digitsOf(phone);
  if (digits.length < 7) return;
  logOf(db).answers.push({ ...answer, digits, at: answer.at ?? db.now() });
}

/**
 * A yes from a form: never over a no standing for the number, unless it is the
 * verified person's own (Prefs), and never while the number is stopped.
 */
export function demoFormYes(db: DemoDb, phone: string, verified: boolean): void {
  const standing = demoStanding(db, phone);
  if (standing.stopped !== null) return;
  if (standing.service.state === "no" && !verified) return;
  recordDemoText(db, phone, { state: "yes", source: "form", how: null, by: null });
}

export function demoStanding(db: DemoDb, phone: string | null): TextStanding {
  const settings = db.rows.settings[0];
  const ready = settings?.texts_on === true;
  const digits = digitsOf(phone);
  if (digits.length < 7) return { ready, masked: null, service: { state: "no-phone", answer: null }, stopped: null };
  const log = logOf(db);
  const masked = `${(phone ?? "").trim().slice(0, 3)} ••• ${digits.slice(-3)}`;
  const since = log.stopped.get(digits);
  const last = log.answers.filter((a) => a.digits === digits).sort((a, b) => a.at - b.at).at(-1);
  const answer = last === undefined ? null : { at: last.at, source: last.source, how: last.how, by: last.by === null ? null : { id: "demo", label: last.by }, wordingVersion: last.state === "yes" ? "v1 en-US" : null };
  if (since !== undefined) return { ready, masked, service: { state: "stopped", answer }, stopped: { since, reason: "replied-stop", liftBy: "start" } };
  return { ready, masked, service: { state: last === undefined ? "not-asked" : last.state, answer }, stopped: null };
}

/** The desk's record of a yes or a no heard from the patient: named, and never over a STOP. */
export function demoStaffAnswer(db: DemoDb, phone: string, answer: StaffTextAnswer, by: string): TextStanding {
  if (demoStanding(db, phone).stopped === null) recordDemoText(db, phone, { state: answer.state, source: "staff", how: answer.how, by });
  return demoStanding(db, phone);
}

/** Whether a text may go to this number now. */
export const demoMayText = (db: DemoDb, phone: string | null): boolean => demoStanding(db, phone).service.state === "yes";

export function demoTexts(db: DemoDb): void {
  const settings = db.rows.settings[0];
  if (settings === undefined) return;
  const desk: Writer = { origin: "desk", name: null };
  db.update("settings", settings.id, { texts_on: true }, desk);
  const now = db.now();
  const patient = (name: string) => db.rows.patients.find((p) => p.name === name);
  const ewan = patient("Ewan Pryce");
  if (ewan !== undefined) recordDemoText(db, ewan.mobile, { state: "yes", source: "form", how: null, by: null, at: now - 41 * DAY });
  const nour = patient("Nour Khalil");
  if (nour !== undefined) recordDemoText(db, nour.mobile, { state: "yes", source: "form", how: null, by: null, at: now - 300 * DAY });
  const solveig = patient("Solveig Rasmussen");
  if (solveig !== undefined) {
    recordDemoText(db, solveig.mobile, { state: "yes", source: "form", how: null, by: null, at: now - 96 * DAY });
    recordDemoText(db, solveig.mobile, { state: "no", source: "form", how: null, by: null, at: now - 12 * DAY });
  }
  const saoirse = patient("Saoirse Whelan");
  if (saoirse !== undefined) {
    recordDemoText(db, saoirse.mobile, { state: "yes", source: "form", how: null, by: null, at: now - 60 * DAY });
    logOf(db).stopped.set(digitsOf(saoirse.mobile), now - 5 * DAY);
  }
  const tariq = db.rows.registrations.find((r) => r.name === "Tariq Mahmood");
  if (tariq !== undefined) {
    db.update("registrations", tariq.id, { texts_ok: true }, { origin: "patient", name: null });
    recordDemoText(db, tariq.mobile, { state: "yes", source: "form", how: null, by: null, at: Date.parse(tariq.created_at ?? new Date(now).toISOString()) });
  }
}
