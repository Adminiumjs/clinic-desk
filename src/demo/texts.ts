/**
 * The website's demo is a practice that sends visit texts, so the box, the
 * Prefs switch and the desk's side of them all show. Nothing leaves the
 * browser: there is no provider, and a text is logged as gone, as on a
 * practice whose provider took it.
 *
 * The sample bundle itself keeps texts off and holds no answers, because a
 * real install's sample cannot hold a yes Adminium never heard: a patient's
 * yes lives in Adminium's text consent log, written only by the box itself.
 * So the demo's patients' answers are made here, the way the boxes would have
 * made them:
 *
 *   - Ewan said yes on his Reminders page a few weeks ago;
 *   - Nour ticked the box in her first booking, which the desk then linked;
 *   - Solveig said yes, then switched texts off ("Texts are off because you
 *     asked us to stop");
 *   - Tariq ticked it as he registered, and the desk has not accepted him yet.
 */
import type { DemoDb, Writer } from "./db.ts";

const PATIENT: Writer = { origin: "patient", name: null };
const DAY = 86_400_000;

export function demoTexts(db: DemoDb): void {
  const settings = db.rows.settings[0];
  if (settings === undefined) return;
  db.update("settings", settings.id, { texts_on: true }, { origin: "desk", name: null });
  const now = db.now();
  const ago = (days: number) => new Date(now - days * DAY).toISOString();
  const patient = (name: string) => db.rows.patients.find((p) => p.name === name);
  const answer = (values: Record<string, unknown>, at: string) => {
    const row = db.insert("text_answers", values, PATIENT);
    // When it was given: the demo's practice has a past.
    const held = db.rows.text_answers.find((a) => a.id === row.id);
    if (held !== undefined) held.created_at = at;
  };
  const ewan = patient("Ewan Pryce");
  if (ewan !== undefined) answer({ patient_id: ewan.id, mobile: ewan.mobile, texts_ok: true, source: "prefs" }, ago(41));
  const nour = patient("Nour Khalil");
  if (nour !== undefined) answer({ patient_id: nour.id, name: nour.name, mobile: nour.mobile, texts_ok: true, source: "booking" }, nour.created_at ?? ago(330));
  const solveig = patient("Solveig Rasmussen");
  if (solveig !== undefined) {
    answer({ patient_id: solveig.id, mobile: solveig.mobile, texts_ok: true, source: "prefs" }, ago(96));
    answer({ patient_id: solveig.id, mobile: solveig.mobile, texts_off: true, source: "prefs" }, ago(12));
  }
  const tariq = db.rows.registrations.find((r) => r.name === "Tariq Mahmood");
  if (tariq !== undefined) answer({ name: tariq.name, mobile: tariq.mobile, texts_ok: true, source: "register", about_ref: tariq.ref }, tariq.created_at ?? ago(0));
}
