/**
 * The demo's doors: the desk's reads, the desk's writes and the patients'
 * pages, all over the demo's in-memory practice (`db.ts`).
 *
 * They answer exactly what the live doors answer — the same shapes, the same
 * refusal codes — so every screen runs the same code in the demo as on a
 * real install. The patients' emailed code is 482 913 (the demo cannot send
 * mail); its sign-in rules (found by mobile and date of birth, a code to see
 * your visits) are the real ones.
 */
import { SinkError, kindOfStatus, type DataSink } from "../data/sink.ts";
import {
  PortError,
  type Catalogue,
  type DeskReads,
  type DeskSnapshot,
  type OwnDetails,
  type OwnVisit,
  type PatientsPort,
} from "../data/ports.ts";
import type { Appointment, Id, Patient, TableRef, WaitingEntry } from "../data/types.ts";
import { addDays, venueDay, venueMidnight } from "../data/venueTime.ts";
import { DemoRefusal, type DemoDb, type Writer } from "./db.ts";
import { days, slots } from "./booking.ts";

/** The code the demo's emails would carry. */
export const DEMO_CODE = "482913";

const plain = <T,>(value: T): T => structuredClone(value);

function asSinkError(error: unknown): SinkError {
  if (error instanceof DemoRefusal) {
    return new SinkError(error.message, kindOfStatus(error.status, error.code), error.status, error.code, (error.details["column"] as string | undefined) ?? null, error.details);
  }
  return new SinkError(String(error), "offline", 0, "NETWORK");
}

/**
 * "Next booking loses the race": the demo card's way to show what happens
 * when two desks reach for one time — the next booking finds it just taken.
 */
export const demoRace = { next: false };

/** The desk's writes, as `writer` (the demo's signed-in person). */
export function demoSink(db: DemoDb, writer: () => Writer): DataSink {
  const run = async <T,>(work: () => T): Promise<T> => {
    try {
      return plain(work());
    } catch (error) {
      const refused = asSinkError(error);
      throw refused;
    }
  };
  return {
    insert: (ref, values) =>
      run(() => {
        if (ref === "appointments" && demoRace.next) {
          demoRace.next = false;
          throw new DemoRefusal(409, "BOOKING_TAKEN", "That time has just gone.", { column: "starts_at" });
        }
        try {
          return db.insert(ref, values, writer()) as unknown as Record<string, unknown>;
        } catch (error) {
          // An earlier try of this same action saved it: answer with that row.
          const key = values["client_key"];
          if (error instanceof DemoRefusal && error.code === "UNIQUE_VIOLATION" && typeof key === "string") {
            const earlier = (db.rows[ref] as unknown as Record<string, unknown>[]).find((r) => r["client_key"] === key);
            if (earlier !== undefined) return earlier;
          }
          throw error;
        }
      }),
    update: (ref, id, patch) => run(() => db.update(ref, Number(id), patch, writer()) as unknown as Record<string, unknown>),
    remove: (ref, id) => run(() => db.remove(ref, Number(id))),
  };
}

export function demoDeskReads(db: DemoDb): DeskReads {
  const r = db.rows;
  const patientsOf = (ids: readonly (Id | null)[]): Patient[] => {
    const want = new Set(ids.filter((id): id is Id => id !== null));
    return r.patients.filter((p) => want.has(p.id));
  };
  const ask = () => ({ zone: db.zone, now: db.now(), isPublic: false });
  const minutesOf = (kind: Id) => r.visit_types.find((t) => t.id === kind)?.minutes ?? 15;

  return {
    async snapshot(today, zone) {
      const midnight = Date.parse(venueMidnight(today, zone));
      const tomorrow = Date.parse(venueMidnight(addDays(today, 1), zone));
      const twoWeeksAgo = venueMidnight(addDays(today, -14), zone);
      const yesterday = venueMidnight(addDays(today, -1), zone);
      const monthStart = venueMidnight(`${today.slice(0, 8)}01`, zone);
      const within = (at: string) => {
        const ms = Date.parse(at);
        return ms >= midnight && ms < tomorrow;
      };
      const day = r.appointments.filter((a) => within(a.starts_at)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const registrations = r.registrations.filter((x) => x.status === "new" || x.status === "rang" || (x.handled_at !== null && x.handled_at >= twoWeeksAgo));
      const firstVisits = r.appointments.filter(
        (a) => a.check_status === "to_check" || a.check_status === "rang" || (a.check_status !== null && (a.created_at ?? "") >= twoWeeksAgo),
      );
      const owingAll = r.appointments.filter((a) => a.status === "seen" && a.balance > 0).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const snap: DeskSnapshot = {
        settings: r.settings[0] ?? null,
        hours: r.opening_hours,
        clinicians: [...r.clinicians].sort((a, b) => a.position - b.position),
        visitTypes: [...r.visit_types].sort((a, b) => a.position - b.position),
        links: r.clinician_visit_types,
        clinicianHours: r.clinician_hours,
        closures: r.closures.filter((c) => c.to_date >= today),
        faqs: [...r.faqs].sort((a, b) => a.position - b.position),
        today,
        day,
        patients: [],
        waiting: r.waiting_list.filter((w) => w.status === "waiting"),
        registrations,
        firstVisits,
        notes: r.check_notes.filter((n) => registrations.some((x) => x.id === n.registration_id) || firstVisits.some((a) => a.id === n.appointment_id)),
        recalls: r.recalls.filter((x) => (x.status === "due" || x.status === "noted") && x.due_on <= addDays(today, 60)),
        owing: owingAll.slice(0, 200),
        owingMore: owingAll.length > 200,
        paymentsToday: r.payments.filter((p) => Date.parse(p.paid_at) >= midnight),
        writeOffsThisMonth: r.write_offs.filter((w) => w.written_at >= monthStart),
        messages: r.messages.filter((m) => m.status === "queued" || m.status === "failed" || (m.created_at ?? "") >= yesterday),
        dayClose: r.day_closes.find((d) => d.day === today) ?? null,
      };
      snap.patients = patientsOf([
        ...snap.day.map((a) => a.patient_id),
        ...snap.waiting.map((w) => w.patient_id),
        ...snap.registrations.map((x) => x.patient_id),
        ...snap.firstVisits.map((a) => a.patient_id),
        ...snap.recalls.map((x) => x.patient_id),
        ...snap.owing.map((a) => a.patient_id),
      ]);
      return plain(snap);
    },

    async between(from, to) {
      const visits = r.appointments.filter((a) => a.starts_at >= from && a.starts_at < to).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      return plain({ visits, patients: patientsOf(visits.map((v) => v.patient_id)) });
    },

    patients: async (ids) => plain(patientsOf(ids)),
    visits: async (ids) => plain(r.appointments.filter((a) => ids.includes(a.id))),
    rows: async (ref, ids) => plain((r[ref] as { id: Id }[]).filter((row) => ids.includes(row.id)) as never),

    async search(query, today) {
      const text = (query.q ?? "").trim().toLowerCase();
      const digits = text.replace(/\D/g, "");
      let rows = r.patients.filter(
        (p) => text === "" || p.name.toLowerCase().includes(text) || (digits.length >= 3 && p.mobile.replace(/\D/g, "").includes(digits)),
      );
      if (query.filter === "allergies") rows = rows.filter((p) => (p.allergies_note ?? "") !== "");
      if (query.filter === "owing") {
        const owing = new Set(r.appointments.filter((a) => a.status === "seen" && a.balance > 0).map((a) => a.patient_id));
        rows = rows.filter((p) => owing.has(p.id));
      }
      if (query.filter === "recall") {
        const due = new Set(r.recalls.filter((x) => (x.status === "due" || x.status === "noted") && x.due_on <= addDays(today, 28)).map((x) => x.patient_id));
        rows = rows.filter((p) => due.has(p.id));
      }
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return plain({ rows: rows.slice(query.offset, query.offset + query.limit), total: rows.length });
    },

    async glance(ids) {
      const out = new Map<Id, { lastSeen: string | null; owing: number }>();
      for (const id of ids) {
        const seen = r.appointments.filter((a) => a.patient_id === id && a.status === "seen");
        out.set(id, {
          lastSeen: seen.reduce<string | null>((max, a) => (max === null || a.starts_at > max ? a.starts_at : max), null),
          owing: seen.reduce((sum, a) => sum + Math.max(0, a.balance), 0),
        });
      }
      return out;
    },

    async patientPage(id) {
      const patient = r.patients.find((p) => p.id === id);
      if (patient === undefined) throw new Error(`patient ${String(id)} is not there`);
      const visits = r.appointments.filter((a) => a.patient_id === id).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
      const ids = new Set(visits.map((v) => v.id));
      return plain({
        patient,
        visits: visits.slice(0, 50),
        visitsTotal: visits.length,
        recalls: r.recalls.filter((x) => x.patient_id === id),
        payments: r.payments.filter((p) => ids.has(p.appointment_id)),
      });
    },

    async matches(person) {
      const digits = (s: string) => s.replace(/\D/g, "");
      const both = r.patients.filter((p) => digits(p.mobile) === digits(person.mobile) && p.born_on === person.born_on);
      const seen = new Set(both.map((p) => p.id));
      const name = r.patients.filter((p) => !seen.has(p.id) && p.name.trim().toLowerCase() === person.name.trim().toLowerCase() && p.born_on === person.born_on);
      for (const p of name) seen.add(p.id);
      const mobile = r.patients.filter((p) => !seen.has(p.id) && digits(p.mobile) === digits(person.mobile));
      return plain({ both, name, mobile });
    },

    async times(query) {
      return slots(db.practice(), query.kind, minutesOf(query.kind), query.date, query.resource ?? "any", { ...ask(), exclude: query.exclude ?? null });
    },

    async days(query) {
      return days(db.practice(), query.kind, minutesOf(query.kind), query.from, query.days, query.resource ?? "any", { ...ask(), exclude: query.exclude ?? null });
    },

    async codeLock() {
      return { locked: false, failures: 0 };
    },
    async clearCodeLock() {},
  };
}

const OWN_COLUMNS = ["id", "ref", "clinician_id", "visit_type_id", "starts_at", "minutes", "status", "late_cancel", "reason", "balance"] as const;
const ownVisit = (a: Appointment): OwnVisit => Object.fromEntries(OWN_COLUMNS.map((c) => [c, a[c]])) as unknown as OwnVisit;

/** The patients' pages over the demo practice. */
export function demoPatientsPort(db: DemoDb): PatientsPort {
  const r = db.rows;
  const patient: Writer = { origin: "patient", name: null };
  let session: { patientId: Id; level: "lookup" | "verified"; tries: number; newEmail?: string } | null = null;
  const minutesOf = (kind: Id) => r.visit_types.find((t) => t.id === kind)?.minutes ?? 15;
  const ask = (exclude?: Id) => ({ zone: db.zone, now: db.now(), isPublic: true, exclude: exclude ?? null });
  const refuse = (code: string, message: string, params: Record<string, unknown> = {}): never => {
    throw new PortError(code, message, params);
  };
  const mine = (): Patient => {
    if (session === null) return refuse("PUBLIC_CLAIM_REQUIRED", "Find yourself first.");
    if (session.level !== "verified") return refuse("PUBLIC_CLAIM_LEVEL", "Confirm the emailed code first.");
    return r.patients.find((p) => p.id === session!.patientId)!;
  };
  const refusalOf = (error: unknown): PortError => {
    if (error instanceof PortError) return error;
    if (error instanceof DemoRefusal) {
      if (error.code === "BOOKING_TAKEN") return new PortError("PUBLIC_SLOT_FULL", error.message);
      if (error.code === "PUBLIC_TOO_LATE") return new PortError("PUBLIC_TOO_LATE", error.message);
      if (error.code === "VALIDATION_FAILED" || error.code === "BOOKING_CLOSED") {
        const reason = String(error.details["reason"] ?? "");
        return new PortError("PUBLIC_WRITE_REFUSED", error.message, {
          column: error.details["column"] ?? "starts_at",
          reason: { BOOKING_CLOSED: "closed", BOOKING_OUT_OF_HOURS: "out-of-hours", BOOKING_OUT_OF_RANGE: "out-of-range", BOOKING_NOT_OFFERED: "not-offered" }[reason] ?? "closed",
        });
      }
    }
    return new PortError("PUBLIC_NETWORK_UNAVAILABLE", String(error));
  };
  const attempt = async <T,>(work: () => T): Promise<T> => {
    try {
      return plain(work());
    } catch (error) {
      throw refusalOf(error);
    }
  };
  const onlineOff = () => r.settings[0]?.online_booking_on === false;

  return {
    timeZone: () => db.zone,

    async catalogue(): Promise<Catalogue> {
      const today = venueDay(db.now(), db.zone);
      return plain({
        settings: r.settings[0] ?? null,
        hours: r.opening_hours,
        clinicians: r.clinicians.filter((c) => c.active && c.bookable_online).sort((a, b) => a.position - b.position),
        names: r.clinicians.map(({ id, name, short_name, role_label, color }) => ({ id, name, short_name, role_label, color })),
        visitTypes: r.visit_types.filter((t) => t.active && t.bookable_online).sort((a, b) => a.position - b.position),
        links: r.clinician_visit_types,
        faqs: r.faqs.filter((f) => f.active).sort((a, b) => a.position - b.position),
        closures: r.closures.filter((c) => c.active && c.to_date >= today),
      });
    },

    times: async (query) => slots(db.practice(), query.kind, minutesOf(query.kind), query.date, query.resource ?? "any", ask(query.exclude)),
    days: async (query) => days(db.practice(), query.kind, minutesOf(query.kind), query.from, query.days, query.resource ?? "any", ask(query.exclude)),

    async find(mobile, bornOn) {
      const digits = (s: string) => s.replace(/\D/g, "");
      const found = r.patients.filter((p) => digits(p.mobile) === digits(mobile) && p.born_on === bornOn);
      if (found.length !== 1) return null;
      session = { patientId: found[0]!.id, level: "lookup", tries: 5 };
      return { name: found[0]!.name };
    },

    level: () => session?.level ?? null,

    async requestCode(request) {
      if (session === null) return refuse("PUBLIC_CLAIM_REQUIRED", "Find yourself first.");
      const person = r.patients.find((p) => p.id === session!.patientId)!;
      const to = request.purpose === "email-change" ? request.email : person.email;
      if (to === null || to === "") return refuse("PUBLIC_CLAIM_NO_EMAIL", "No email on file.");
      session.tries = 5;
      // The address a change is for: it is written only once its code is confirmed.
      if (request.purpose === "email-change") session.newEmail = request.email;
      const at = to.indexOf("@");
      const domain = to.slice(at + 1);
      const dot = domain.lastIndexOf(".");
      const masked = `${to.charAt(0)}•••@${domain.charAt(0)}•••${dot === -1 ? "" : domain.slice(dot)}`;
      return { sentTo: masked, resendAfter: 30, expiresAt: db.now() + 10 * 60_000 };
    },

    async verifyCode(code, purpose = "verify") {
      if (session === null) return refuse("PUBLIC_CLAIM_REQUIRED", "Find yourself first.");
      if (code.replace(/\D/g, "") !== DEMO_CODE) {
        session.tries -= 1;
        if (session.tries <= 0) return refuse("PUBLIC_CODE_LOCKED", "Too many tries.");
        return { ok: false, triesLeft: session.tries };
      }
      if (purpose === "email-change") {
        // The address changes and every session ends: the person finds themselves again.
        if (session.newEmail !== undefined) db.update("patients", session.patientId, { email: session.newEmail }, { origin: "patient", name: null });
        session = null;
        return { ok: true, level: "verified", ended: true };
      }
      session.level = "verified";
      return { ok: true, level: "verified", ended: false };
    },

    async myDetails(): Promise<OwnDetails> {
      const p = mine();
      return { name: p.name, email: p.email, mobile: p.mobile, remind_email: p.remind_email, remind_lead_hours: p.remind_lead_hours };
    },

    savePrefs: (prefs) =>
      attempt(() => {
        const p = mine();
        if (onlineOff()) refuse("PUBLIC_SWITCHED_OFF", "Online booking is closed.");
        const saved = db.update("patients", p.id, prefs, patient);
        return { name: saved.name, email: saved.email, mobile: saved.mobile, remind_email: saved.remind_email, remind_lead_hours: saved.remind_lead_hours };
      }),

    myVisits: async () => plain(r.appointments.filter((a) => a.patient_id === mine().id).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).map(ownVisit)),

    book: (visit) =>
      attempt(() => {
        if (demoRace.next) {
          demoRace.next = false;
          refuse("PUBLIC_SLOT_FULL", "That time has just gone.");
        }
        const settings = r.settings[0];
        if (onlineOff()) refuse("PUBLIC_SWITCHED_OFF", "Online booking is closed.");
        const values: Record<string, unknown> = {
          visit_type_id: visit.visit_type_id,
          clinician_id: visit.clinician_id,
          starts_at: visit.starts_at,
          reason: visit.reason,
          desk_note: visit.desk_note,
          language: visit.language,
          status: "booked",
          channel: "online",
        };
        if (session !== null) {
          values["patient_id"] = session.patientId;
          const upcoming = r.appointments.filter((a) => a.patient_id === session!.patientId && a.status === "booked" && Date.parse(a.starts_at) > db.now());
          if (upcoming.length >= 2) refuse("PUBLIC_LIMIT_REACHED", "Two visits are already booked.");
        } else {
          if (settings?.new_patients_online === false) refuse("PUBLIC_SWITCHED_OFF", "New patients cannot book online.");
          const p = visit.newPatient;
          values["new_name"] = p?.name ?? null;
          values["new_born_on"] = p?.born_on ?? null;
          values["new_mobile"] = p?.mobile ?? null;
          values["new_email"] = p?.email ?? null;
          values["check_status"] = "to_check";
        }
        const row = db.insert("appointments", values, patient);
        return { ref: row.ref, starts_at: row.starts_at, minutes: row.minutes, clinician_id: row.clinician_id, status: row.status };
      }),

    reschedule: (id, startsAt) =>
      attempt(() => {
        const p = mine();
        const visit = r.appointments.find((a) => a.id === id && a.patient_id === p.id);
        if (visit === undefined || visit.status !== "booked" || Date.parse(visit.starts_at) < db.now()) refuse("PUBLIC_NOT_FOUND", "That visit cannot be changed.");
        return ownVisit(db.update("appointments", id, { starts_at: startsAt }, patient));
      }),

    cancel: (id) =>
      attempt(() => {
        const p = mine();
        const visit = r.appointments.find((a) => a.id === id && a.patient_id === p.id);
        if (visit === undefined || visit.status !== "booked" || Date.parse(visit.starts_at) < db.now()) refuse("PUBLIC_NOT_FOUND", "That visit cannot be changed.");
        return ownVisit(db.update("appointments", id, { status: "cancelled" }, patient));
      }),

    register: (person) =>
      attempt(() => {
        if (onlineOff()) refuse("PUBLIC_SWITCHED_OFF", "Online booking is closed.");
        const row = db.insert("registrations", { ...person }, patient);
        return { ref: row.ref };
      }),

    joinWaitlist: (wish) =>
      attempt(() => {
        if (onlineOff()) refuse("PUBLIC_SWITCHED_OFF", "Online booking is closed.");
        // Found people only, and one place each while they wait: the endpoint's own rules.
        if (session === null) return refuse("PUBLIC_CLAIM_REQUIRED", "Find yourself first.");
        const patientId = session.patientId;
        if (r.waiting_list.some((w) => w.patient_id === patientId && w.status === "waiting")) {
          refuse("PUBLIC_LIMIT_REACHED", "You already have as many of these as can be made online.");
        }
        const row = db.insert(
          "waiting_list",
          { visit_type_id: wish.visit_type_id, clinician_id: wish.clinician_id, part_of_day: wish.part_of_day, patient_id: patientId, status: "waiting", channel: "online" },
          patient,
        );
        return { rank: rankAmongWaiting(r.waiting_list, row) };
      }),

    async signOut() {
      session = null;
    },
  };
}

/**
 * Where an entry stands among the waiting ones, as the server counts it:
 * those made before it, and those made at the same moment with a key no
 * later than its own.
 */
export function rankAmongWaiting(list: readonly WaitingEntry[], entry: WaitingEntry): number {
  const made = (w: WaitingEntry) => (w.created_at == null ? Number.MAX_SAFE_INTEGER : Date.parse(w.created_at));
  const at = made(entry);
  return list.filter((w) => w.status === "waiting" && (made(w) < at || (made(w) === at && w.id <= entry.id))).length;
}

/** Which tables a demo change touches, for the demo's live updates. */
export type DemoChange = TableRef;
