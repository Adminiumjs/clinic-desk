/**
 * The desk's reads, from Adminium, as the signed-in staff member.
 *
 * Every read is BOUNDED: the practice's set-up (small tables, read whole),
 * the day on screen, and the work that is waiting — new registrations, first
 * visits to check, due recalls, seen visits still owing, today's money, the
 * outbox's queue. Nothing reads the whole history: a patient's past visits
 * are read when their page opens, the week diary reads its five days.
 *
 * Free times come from the server's booking rule (`booking-slots`), the same
 * rule that judges the booking when it is saved, so a time the desk shows as
 * free is a time the save takes.
 */
import type { SessionTransport } from "./sessionSource.ts";
import type { ListCondition } from "./snapshotPort.ts";
import { normalise, normaliseAll } from "./rows.ts";
import type { DayState, DeskReads, DeskSnapshot, PatientPage, PatientSearch, Reference, SlotQuery, SlotTime } from "./ports.ts";
import type { Appointment, Day, Id, Instant, Patient, TableRef, Tables } from "./types.ts";
import { addDays, venueMidnight } from "./venueTime.ts";

/**
 * The columns the desk cannot work without, per table. Checked at boot, so a
 * database that does not match says which column is missing instead of a
 * screen failing later.
 */
export const REQUIRED: Record<TableRef, string[]> = {
  settings: ["id", "practice_name", "slot_minutes", "booking_days", "cancel_hours", "no_show_minutes", "reminders_on", "online_booking_on"],
  opening_hours: ["id", "weekday", "open", "opens", "closes", "break_start", "break_end"],
  clinicians: ["id", "name", "short_name", "role_label", "color", "active", "position"],
  visit_types: ["id", "name", "short_name", "minutes", "fee", "active", "position"],
  clinician_visit_types: ["id", "clinician_id", "visit_type_id"],
  clinician_hours: ["id", "clinician_id", "weekday", "opens", "closes"],
  closures: ["id", "clinician_id", "from_date", "to_date", "label", "note", "active", "client_key"],
  faqs: ["id", "question", "answer", "position", "active"],
  patients: ["id", "name", "born_on", "mobile", "email", "allergies_note", "client_key"],
  registrations: ["id", "ref", "name", "born_on", "mobile", "status", "patient_id", "outcome"],
  appointments: ["id", "ref", "patient_id", "clinician_id", "visit_type_id", "starts_at", "minutes", "fee", "paid", "balance", "status", "check_status", "client_key"],
  payments: ["id", "appointment_id", "amount", "method", "paid_at", "voided", "client_key"],
  write_offs: ["id", "appointment_id", "amount", "reason", "written_at", "client_key"],
  check_notes: ["id", "registration_id", "appointment_id", "note", "created_at"],
  recalls: ["id", "patient_id", "clinician_id", "weeks", "due_on", "status", "client_key"],
  waiting_list: ["id", "patient_id", "visit_type_id", "status"],
  messages: ["id", "kind", "status", "to_address", "sent_at", "client_key"],
  day_closes: ["id", "day", "cash_expected", "closed_at"],
};

/** The route's largest page. */
const PAGE = 200;
/** How many keys one `in` filter carries. */
const CHUNK = 100;
/** The most rows any one open-work read takes: a practice with more has bigger problems than a slow desk. */
const MOST = 2000;

const and = (...conditions: (ListCondition | null)[]): ListCondition | undefined => {
  const kept = conditions.filter((c): c is ListCondition => c !== null);
  return kept.length === 0 ? undefined : kept.length === 1 ? kept[0] : { and: kept };
};

export function sessionDeskReads(
  transport: SessionTransport,
  tableOf: Readonly<Record<TableRef, string>>,
  /**
   * Whether the signed-in person may read a table. A clinician reads the day,
   * not the money or the outbox: a table they may not read is simply empty on
   * their desk, rather than a refused read failing the whole desk.
   */
  readable: (ref: TableRef) => boolean = () => true,
): DeskReads {
  const port = transport.port;

  /** Every row a condition matches, page by page, up to `limit`. */
  async function all<R extends TableRef>(ref: R, where?: ListCondition, order?: string, limit = MOST): Promise<Tables[R][]> {
    if (!readable(ref)) return [];
    const out: Record<string, unknown>[] = [];
    for (let offset = 0; offset < limit; offset += PAGE) {
      const page = await port.list<Record<string, unknown>>(ref, {
        limit: Math.min(PAGE, limit - offset),
        offset,
        ...(where === undefined ? {} : { where }),
        ...(order === undefined ? {} : { order }),
      });
      out.push(...page.data);
      if (page.data.length < PAGE) break;
    }
    return normaliseAll(ref, out);
  }

  /** Every row whose `column` is one of `ids`, in chunks. */
  async function byIds<R extends TableRef>(ref: R, column: string, ids: readonly Id[], extra?: ListCondition): Promise<Tables[R][]> {
    const unique = [...new Set(ids)];
    const out: Tables[R][] = [];
    for (let i = 0; i < unique.length; i += CHUNK) {
      const chunk = unique.slice(i, i + CHUNK);
      out.push(...(await all(ref, and({ column, op: "in", value: chunk }, extra ?? null))));
    }
    return out;
  }

  const route = async (ref: TableRef, rest: string): Promise<string> =>
    `/api/v1/data/${encodeURIComponent(await transport.connection())}/${encodeURIComponent(tableOf[ref])}${rest}`;

  const slotParams = (query: SlotQuery): URLSearchParams => {
    const params = new URLSearchParams({ kind: String(query.kind) });
    if (query.resource !== undefined) params.set("resource", String(query.resource));
    if (query.exclude !== undefined) params.set("exclude", String(query.exclude));
    return params;
  };

  async function reference(today: Day): Promise<Reference> {
    const [settings, hours, clinicians, visitTypes, links, clinicianHours, closures, faqs] = await Promise.all([
      all("settings", undefined, "id.asc", 1),
      all("opening_hours"),
      all("clinicians", undefined, "position.asc"),
      all("visit_types", undefined, "position.asc"),
      all("clinician_visit_types"),
      all("clinician_hours"),
      all("closures", { column: "to_date", op: "gte", value: today }, "from_date.asc"),
      all("faqs", undefined, "position.asc"),
    ]);
    return { settings: settings[0] ?? null, hours, clinicians, visitTypes, links, clinicianHours, closures, faqs };
  }

  return {
    async snapshot(today, zone) {
      const midnight = venueMidnight(today, zone);
      const tomorrow = venueMidnight(addDays(today, 1), zone);
      const yesterday = venueMidnight(addDays(today, -1), zone);
      const twoWeeksAgo = venueMidnight(addDays(today, -14), zone);
      const monthStart = venueMidnight(`${today.slice(0, 8)}01`, zone);
      const [ref, day, waiting, registrations, firstVisits, recalls, owingPlus, paymentsToday, writeOffsThisMonth, messages, closes] = await Promise.all([
        reference(today),
        all("appointments", and({ column: "starts_at", op: "gte", value: midnight }, { column: "starts_at", op: "lt", value: tomorrow }), "starts_at.asc"),
        all("waiting_list", { column: "status", op: "eq", value: "waiting" }, "created_at.asc"),
        all("registrations", { or: [{ column: "status", op: "in", value: ["new", "rang"] }, { column: "handled_at", op: "gte", value: twoWeeksAgo }] }, "created_at.asc"),
        all(
          "appointments",
          {
            or: [
              { column: "check_status", op: "in", value: ["to_check", "rang"] },
              and({ column: "check_status", op: "in", value: ["accepted", "linked", "declined"] }, { column: "created_at", op: "gte", value: twoWeeksAgo })!,
            ],
          },
          "created_at.asc",
        ),
        all("recalls", and({ column: "status", op: "in", value: ["due", "noted"] }, { column: "due_on", op: "lte", value: addDays(today, 60) }), "due_on.asc"),
        all("appointments", and({ column: "status", op: "eq", value: "seen" }, { column: "balance", op: "gt", value: 0 }), "starts_at.asc", PAGE + 1),
        all("payments", { column: "paid_at", op: "gte", value: midnight }, "paid_at.asc"),
        all("write_offs", { column: "written_at", op: "gte", value: monthStart }, "written_at.asc"),
        all("messages", { or: [{ column: "status", op: "in", value: ["queued", "failed"] }, { column: "created_at", op: "gte", value: yesterday }] }, "created_at.desc"),
        all("day_closes", { column: "day", op: "eq", value: today }, undefined, 1),
      ]);
      const owing = owingPlus.slice(0, PAGE);
      const notes = [
        ...(await byIds("check_notes", "registration_id", registrations.map((r) => r.id))),
        ...(await byIds("check_notes", "appointment_id", firstVisits.map((a) => a.id))),
      ];
      const named = [
        ...day.map((a) => a.patient_id),
        ...waiting.map((w) => w.patient_id),
        ...registrations.map((r) => r.patient_id),
        ...firstVisits.map((a) => a.patient_id),
        ...recalls.map((r) => r.patient_id),
        ...owing.map((a) => a.patient_id),
      ].filter((id): id is Id => id !== null);
      const patients = await byIds("patients", "id", named);
      const snap: DeskSnapshot = {
        ...ref,
        today,
        day,
        patients,
        waiting,
        registrations,
        firstVisits,
        notes,
        recalls,
        owing,
        owingMore: owingPlus.length > PAGE,
        paymentsToday,
        writeOffsThisMonth,
        messages,
        dayClose: closes[0] ?? null,
      };
      return snap;
    },

    async between(from, to) {
      const visits = await all("appointments", and({ column: "starts_at", op: "gte", value: from }, { column: "starts_at", op: "lt", value: to }), "starts_at.asc");
      const patients = await byIds("patients", "id", visits.map((v) => v.patient_id).filter((id): id is Id => id !== null));
      return { visits, patients };
    },

    patients: (ids) => byIds("patients", "id", ids),
    visits: (ids) => byIds("appointments", "id", ids),
    rows: (ref, ids) => byIds(ref, "id", ids),

    async search(query: PatientSearch, today) {
      const text = query.q?.trim() ?? "";
      const conditions: (ListCondition | null)[] = [];
      if (text !== "") {
        const digits = text.replace(/\D/g, "");
        conditions.push({
          or: [
            { column: "name", op: "ilike", value: `%${text}%` },
            ...(digits.length >= 3 ? [{ column: "mobile", op: "ilike" as const, value: `%${text}%` }] : []),
          ],
        });
      }
      if (query.filter === "allergies") conditions.push({ column: "allergies_note", op: "not_null" }, { column: "allergies_note", op: "neq", value: "" });
      if (query.filter === "owing" || query.filter === "recall") {
        const ids =
          query.filter === "owing"
            ? (await all("appointments", and({ column: "status", op: "eq", value: "seen" }, { column: "balance", op: "gt", value: 0 }))).map((a) => a.patient_id)
            : (await all("recalls", and({ column: "status", op: "in", value: ["due", "noted"] }, { column: "due_on", op: "lte", value: addDays(today, 28) }))).map((r) => r.patient_id);
        const unique = [...new Set(ids.filter((id): id is Id => id !== null))];
        if (unique.length === 0) return { rows: [], total: 0 };
        conditions.push({ column: "id", op: "in", value: unique.slice(0, 500) });
      }
      const where = and(...conditions);
      const page = await port.list<Record<string, unknown>>("patients", {
        limit: query.limit,
        offset: query.offset,
        order: "name.asc",
        count: true,
        ...(where === undefined ? {} : { where }),
      });
      return { rows: normaliseAll("patients", page.data), total: page.total ?? null };
    },

    async glance(ids) {
      const seen = await byIds("appointments", "patient_id", ids, { column: "status", op: "eq", value: "seen" });
      const out = new Map<Id, { lastSeen: Instant | null; owing: number }>();
      for (const id of ids) out.set(id, { lastSeen: null, owing: 0 });
      for (const visit of seen) {
        if (visit.patient_id === null) continue;
        const row = out.get(visit.patient_id) ?? { lastSeen: null, owing: 0 };
        if (row.lastSeen === null || visit.starts_at > row.lastSeen) row.lastSeen = visit.starts_at;
        row.owing += Math.max(0, visit.balance);
        out.set(visit.patient_id, row);
      }
      return out;
    },

    async patientPage(id): Promise<PatientPage> {
      const [patient] = await all("patients", { column: "id", op: "eq", value: id }, undefined, 1);
      if (patient === undefined) throw new Error(`patient ${String(id)} is not there`);
      const visitsPage = await port.list<Record<string, unknown>>("appointments", {
        limit: 50,
        offset: 0,
        where: { column: "patient_id", op: "eq", value: id },
        order: "starts_at.desc",
        count: true,
      });
      const visits = normaliseAll("appointments", visitsPage.data);
      const [recalls, payments] = await Promise.all([
        all("recalls", { column: "patient_id", op: "eq", value: id }, "due_on.asc"),
        byIds("payments", "appointment_id", visits.map((v) => v.id)),
      ]);
      return { patient, visits, visitsTotal: visitsPage.total ?? visits.length, recalls, payments };
    },

    async matches(person) {
      const [both, name, mobile] = await Promise.all([
        all("patients", and({ column: "mobile", op: "eq", value: person.mobile }, { column: "born_on", op: "eq", value: person.born_on }), undefined, 10),
        all("patients", and({ column: "name", op: "ilike", value: person.name.trim() }, { column: "born_on", op: "eq", value: person.born_on }), undefined, 10),
        all("patients", { column: "mobile", op: "eq", value: person.mobile }, undefined, 10),
      ]);
      const seen = new Set(both.map((p) => p.id));
      const nameOnly = name.filter((p) => !seen.has(p.id));
      for (const p of nameOnly) seen.add(p.id);
      return { both, name: nameOnly, mobile: mobile.filter((p) => !seen.has(p.id)) };
    },

    async times(query): Promise<SlotTime[]> {
      const params = slotParams(query);
      params.set("date", query.date);
      const reply = await transport.get<{ data: { time: string; state: "free" | "full"; resource?: string | number }[] }>(
        await route("appointments", `/booking-slots?${params.toString()}`),
      );
      return reply.data.map((slot) => ({
        time: slot.time,
        state: slot.state,
        ...(slot.resource === undefined ? {} : { resource: Number(slot.resource) }),
      }));
    },

    async days(query): Promise<DayState[]> {
      const params = slotParams(query);
      params.set("from", query.from);
      params.set("days", String(query.days));
      const reply = await transport.get<{ data: DayState[] }>(await route("appointments", `/booking-slots?${params.toString()}`));
      return reply.data;
    },

    async codeLock(patientId) {
      return transport.get<{ locked: boolean; failures: number }>(await route("patients", `/${encodeURIComponent(String(patientId))}/claim-lock`));
    },

    async clearCodeLock(patientId) {
      await transport.mutate(await route("patients", `/${encodeURIComponent(String(patientId))}/claim-lock`), "DELETE");
    },
  };
}

/** One patient row in the app's spelling (for rows that arrive by live update). */
export const patientRow = (raw: Record<string, unknown>): Patient => normalise("patients", raw);
export const appointmentRow = (raw: Record<string, unknown>): Appointment => normalise("appointments", raw);
