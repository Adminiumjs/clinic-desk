/**
 * "That time has just gone": the server is asked again for the day's times,
 * and the three free ones nearest to the lost time are offered instead.
 */
import type { Day, Hhmm, Id } from "../../data/types.ts";
import { patientsPort } from "../../state/patients.ts";
import { nearestFree } from "./logic.ts";

export async function nearestFor(kind: Id, resource: Id | "any", exclude: Id | undefined, day: Day, gone: Hhmm): Promise<Hhmm[]> {
  try {
    const times = await patientsPort().times({ kind, resource, ...(exclude === undefined ? {} : { exclude }), date: day });
    return nearestFree(times, gone);
  } catch {
    return [];
  }
}
