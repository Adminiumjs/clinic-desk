/**
 * Every table this app reads and writes, by the manifest's short name, and
 * the real name an install gave it.
 *
 * The manifest asks for prefixed tables, so Adminium makes `clinic_patients`
 * for `patients` and hands the real names over at boot (`realTables`).
 * `TABLE_OF_REF` is the fallback the demo and an older server use: the same
 * prefix Adminium would have chosen. `refCoverage.test.ts` checks it against
 * `REQUIRED`, so a table read at boot is never missing from the map.
 */
import type { TableRef } from "./types.ts";

const REFS: readonly TableRef[] = [
  "settings",
  "opening_hours",
  "clinicians",
  "visit_types",
  "clinician_visit_types",
  "clinician_hours",
  "closures",
  "faqs",
  "patients",
  "registrations",
  "appointments",
  "payments",
  "write_offs",
  "check_notes",
  "recalls",
  "waiting_list",
  "messages",
  "day_closes",
];

export const TABLE_OF_REF: Readonly<Record<TableRef, string>> = Object.fromEntries(REFS.map((ref) => [ref, `clinic_${ref}`])) as Record<TableRef, string>;

/** The real names Adminium sent, over the default ones for any it did not. */
export function realTables(fromConfig: Record<string, string>): Record<TableRef, string> {
  return { ...TABLE_OF_REF, ...Object.fromEntries(Object.entries(fromConfig).filter(([ref]) => ref in TABLE_OF_REF)) } as Record<TableRef, string>;
}
