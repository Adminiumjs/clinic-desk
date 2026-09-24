/**
 * What Registrations and its sheet both say about an item: where it came
 * from ("Registered · RG-4127", "First visit · Thu 30 Jul 10:30 with Dr
 * Nowak"), the person's one-line meta, how long it has waited, and how it
 * ended.
 */
import type { Id, VisitType } from "../../data/types.ts";
import type { TFunction } from "../../i18n/index.tsx";
import { dayOf, dayShort, daysBetween, ageOn, time } from "../../lib/format.ts";
import type { DeskState } from "../../state/desk.ts";
import { notesOf, personOf, shortOf, type RegItem } from "../bits/logic.ts";

/** The colour the design gives a newcomer's tile: the first-visit type's, else the first type's. */
export function newcomerColor(types: readonly VisitType[]): string {
  const active = types.filter((t) => t.active).sort((a, b) => a.position - b.position || a.id - b.id);
  return (active.find((t) => t.new_patients_only) ?? active[0])?.color ?? "#0369a1";
}
/** The colour of a patient on file's tile: the first visit type's. */
export function patientColor(types: readonly VisitType[]): string {
  const active = types.filter((t) => t.active).sort((a, b) => a.position - b.position || a.id - b.id);
  return active[0]?.color ?? "#0369a1";
}

/** "1990-04-21 · 36 yrs · 07700 900126" */
export function metaLine(t: TFunction, person: { bornOn: string | null; mobile: string }, today: string): string {
  if (person.bornOn === null) return person.mobile;
  return t("registrations.meta", { born: person.bornOn, age: ageOn(person.bornOn, today), mobile: person.mobile });
}

/** "Registered · RG-4127" or "First visit · Thu 30 Jul 10:30 with Dr Nowak". */
export function sourceLine(t: TFunction, s: DeskState, item: RegItem): string {
  if (item.kind === "registration") return t("registrations.source.registered", { ref: item.row.ref });
  return t("registrations.source.firstVisit", {
    day: dayShort(dayOf(item.row.starts_at)),
    time: time(item.row.starts_at),
    who: shortOf(s, item.row.clinician_id),
  });
}

/** "today", "1 day", "3 days" since the item arrived; late from two days. */
export function waited(t: TFunction, since: string | null, today: string): { text: string; days: number } {
  const days = since === null ? 0 : Math.max(0, daysBetween(dayOf(since), today));
  return { text: days === 0 ? t("registrations.waited.today") : t("registrations.waited.days", { count: days }, days), days };
}

/** How a handled item ended, in the desk's words; null while it is still open. */
export function outcomeLine(t: TFunction, s: DeskState, item: RegItem): string | null {
  if (item.tab !== "done") return null;
  const nameOf = (id: Id | null) => (id === null ? "" : (s.patients[id]?.name ?? ""));
  const same = (id: Id | null) => {
    const name = nameOf(id);
    return name === "" ? t("registrations.outcome.sameAnyone") : t("registrations.outcome.same", { name });
  };
  const declined = (why: string | null) => (why === null || why.trim() === "" ? t("registrations.outcome.declinedBare") : t("registrations.outcome.declined", { why: why.trim() }));
  if (item.kind === "registration") {
    if (item.row.status === "accepted") return t("registrations.outcome.accepted");
    if (item.row.status === "duplicate") return same(item.row.patient_id);
    return declined(item.row.outcome);
  }
  if (item.row.check_status === "accepted") return t("registrations.outcome.accepted");
  if (item.row.check_status === "linked") return same(item.row.patient_id);
  // A visit keeps no outcome of its own: the reason is the last note written on it.
  const notes = notesOf(s, item);
  return declined(notes[notes.length - 1]?.note ?? null);
}

export { personOf };
