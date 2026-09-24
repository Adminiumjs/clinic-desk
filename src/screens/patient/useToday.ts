/**
 * The practice's today, re-read when its clock moves (every half minute on a
 * real page, at once when the demo's card moves the demo's clock).
 */
import type { Day } from "../../data/types.ts";
import { venueDay } from "../../data/venueTime.ts";
import { practiceZone } from "../../lib/clock.ts";
import { useNow } from "../../lib/useNow.ts";

export function useTodayDay(): Day {
  return venueDay(useNow(), practiceZone());
}
