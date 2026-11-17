/**
 * Paying online, in the website's demo: no money moves, and no service is
 * named. The sample practice is given what a practice that takes payments
 * would hold on the pinned morning — a visit later today paid ahead online
 * this morning, and one paid ahead and then cancelled by the desk, still owed
 * back — so the desk's side shows as the patients' side does. Only the demo
 * build has it.
 */
import type { Id } from "../data/types.ts";
import type { DemoDb, Writer } from "./db.ts";

const SYSTEM: Writer = { origin: "desk", name: null };

/** Mark a booked visit as paid ahead online: one payment of its fee, as Adminium would write it. */
function payAhead(db: DemoDb, visitId: Id, when: string): void {
  const visit = db.rows.appointments.find((one) => one.id === visitId);
  if (visit === undefined || visit.balance <= 0) return;
  db.insert("payments", { appointment_id: visitId, amount: visit.balance, method: "online", paid_at: when, payment_ref: `demo-${String(visitId)}`, currency: db.rows.settings[0]?.currency ?? null }, SYSTEM);
}

export function seedDemoPayments(db: DemoDb): void {
  if (db.rows.payments.some((payment) => payment.method === "online")) return;
  const now = db.now();
  const ahead = db.rows.appointments
    .filter((visit) => visit.status === "booked" && visit.patient_id !== null && Date.parse(visit.starts_at) > now && (visit.fee ?? 0) > 0)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const yesterday = new Date(now - 24 * 3_600_000).toISOString();
  // Paid ahead early this morning, for a visit later today: the panel says so, the fee is not "payable at
  // the desk", and Accounts counts it as today's online money, apart from the drawer's.
  const later = ahead[0];
  if (later !== undefined) payAhead(db, later.id, new Date(now - 2 * 3_600_000).toISOString());
  // Paid ahead, then cancelled by the desk inside the window: the money is owed back, for a person to decide.
  const owed = ahead.find((visit) => visit.id !== later?.id && visit.patient_id !== later?.patient_id);
  if (owed !== undefined) {
    payAhead(db, owed.id, yesterday);
    db.update("appointments", owed.id, { status: "cancelled", late_cancel: true }, SYSTEM);
  }
}
