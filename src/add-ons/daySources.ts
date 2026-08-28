/**
 * WHO THIS APP CAN ASK FOR CLOSING DAYS, AND HOW TO ASK THEM.
 *
 * ── WHY THIS IS NOT IN `registry.ts` ───────────────────────────────────────
 *
 * `registry.ts` calls `register()` at module load. `register()` returns a fill
 * whose `render` builds a React settings panel, so every module that imports
 * the registry pulls that panel into its chunk — including, transitively, the
 * PATIENT-FACING bundle, which reaches the store, which reaches the closure
 * merge. A booking page carrying an operator's settings form is weight nobody
 * can render and copy nobody there should read.
 *
 * This module reaches one thing: a pure function of values this app already
 * holds. Nothing here constructs a component, so the panel is not in the
 * import graph of anything that only wants the days.
 *
 * ── IT IS STILL A LIST, WHICH IS THE OTHER HALF OF THE POINT ───────────────
 *
 * `closures.ts` iterates this and names nothing. The merge rule, the labelling
 * and the disconnect behaviour are therefore written about "a source of closing
 * days" rather than about the one that exists, and a second source is a row
 * here rather than an edit to any of them.
 *
 * Beside `registry.ts` and nowhere else: the import below names an add-on, and
 * these two files are the only shipped source in this app allowed to (24 AC5).
 */

import { nonWorkingDays, type NonWorkingDay } from './vendor/holiday-calendars/index.ts';
import type { AddOnSettingValues } from './vendor/host/index.ts';

export interface DaySource {
  /** The add-on this reads. `registry.byKey` resolves it for a label. */
  readonly addOn: string;
  /**
   * Its own values in, plain days out.
   *
   * PURE AND TOTAL, and both words are load-bearing. Total, because an add-on
   * that has just been registered and imported nothing answers `[]` — so a host
   * merging it behaves exactly as it did before the add-on existed, which is
   * 24 D6 expressed as a return value and is why `closures.ts` needs no "is
   * anything connected" branch. Pure, because `dormantDayCounts` asks a
   * DISCONNECTED add-on how many days it is still holding, and that question
   * has to cost nothing and reach nothing.
   */
  readonly days: (values: AddOnSettingValues | undefined) => readonly NonWorkingDay[];
}

export const DAY_SOURCES: readonly DaySource[] = [
  { addOn: 'holiday-calendars', days: nonWorkingDays },
];
