/**
 * WHERE AN ADD-ON'S DAYS BECOME THIS APP'S CLOSURES — the mount site, in the
 * data sense.
 *
 * ── THE RULE THIS FILE IS THE WHOLE IMPLEMENTATION OF ──────────────────────
 *
 * `SettingsPanelPayload.patch` writes THE ADD-ON'S OWN VALUES. An import lands
 * in the add-on's own settings document, in the add-on's own shape, and NOTHING
 * anywhere writes a `closures` row on an add-on's behalf. What happens instead
 * is this: the host asks each add-on for what it knows, in the plain shape the
 * add-on publishes, and translates that into its OWN record shape at the seam.
 * The add-on never reaches into this app's store, and this app never reaches
 * into the add-on's storage — it calls one pure function and maps the result.
 *
 * Literal rows in the `closures` table is what Phase B (the add-on runtime,
 * which does not exist) is for. Simulating it here — writing rows into the
 * store and marking them somehow — would produce records an operator cannot
 * tell from their own, that survive a disconnect with no owner, and that a
 * second import would have to reconcile against. Every one of those is a bug
 * this arrangement does not have.
 *
 * ── AND WHY NOTHING IN THIS FILE NAMES AN ADD-ON ───────────────────────────
 *
 * It iterates `DAY_SOURCES`, which `add-ons/daySources.ts` declares — one of the
 * two files in this app allowed to name an add-on (24 AC5). So the merge rule,
 * the provenance labelling and the disconnect behaviour below are written about
 * "a source of closing days" rather than about the one that exists, and a
 * second one is a row in that list rather than an edit here.
 */

import type { Closure } from '../data/types.ts';
import { DAY_SOURCES, type DaySource } from './daySources.ts';
import type { AddOnSettings } from './vendor/host/index.ts';

/** The sources this app consults. Exported as a value so a suite can substitute. */
export { DAY_SOURCES };
export type { DaySource };

/**
 * Every closing day the ENABLED add-ons hold, in this app's record shape.
 *
 * ── THE MAPPING, WHICH IS THE HOST'S JOB AND NOT THE ADD-ON'S ──────────────
 *
 *   `day.date` → `date`        — both are `YYYY-MM-DD`, deliberately. The
 *                                add-on hands over the form that is exactly
 *                                convertible to a day serial and sorts as text.
 *   `day.name` → `reason`      — the country's own name for the day. It is NOT
 *                                a message key and must never be run through
 *                                `t()`: this app cannot translate a holiday's
 *                                name, and a lookup would print a dotted key.
 *   `null`     → `clinician`   — the whole practice is shut, which is what
 *                                `db/schema.sql` says a null clinician means. A
 *                                public holiday is not one person's day off.
 *   the key    → `from`        — which add-on supplied it, so every screen can
 *                                say so and no delete button can reach it.
 *
 * `day.from` — the add-on's own record of which curated set a day came from —
 * is deliberately DROPPED. It is the add-on's document about the add-on's data;
 * this app's question is only "did somebody here type this", and carrying a
 * country and a year it does not use would be storing a shape that is expected
 * to change.
 */
export function addOnClosures(
  sources: readonly DaySource[],
  enabled: ReadonlySet<string>,
  settings: AddOnSettings,
): Closure[] {
  const out: Closure[] = [];
  for (const source of sources) {
    if (!enabled.has(source.addOn)) continue;
    for (const day of source.days(settings[source.addOn])) {
      out.push({ date: day.date, reason: day.name, clinician: null, from: source.addOn });
    }
  }
  return out;
}

/**
 * How many days each DISCONNECTED source still holds — 24 D16, made visible.
 *
 * Disconnecting an add-on takes its surfaces and leaves its data alone, and an
 * app that only kept the data would be keeping a promise nobody can see. This
 * is what the settings screen counts so it can say, in words, that the days are
 * still there and what would bring them back.
 *
 * IT ASKS A DISCONNECTED ADD-ON A QUESTION, which is worth being explicit
 * about: `source.days` is a pure function of values this app already holds, so
 * asking costs nothing, reaches nothing and cannot start anything. That is only
 * true because the read surface is pure — an add-on that answered by calling
 * something would make this line a call to a service the operator has just
 * switched off, and this file would have to stop asking.
 */
export function dormantDayCounts(
  sources: readonly DaySource[],
  enabled: ReadonlySet<string>,
  settings: AddOnSettings,
): { addOn: string; days: number }[] {
  return sources
    .filter((source) => !enabled.has(source.addOn))
    .map((source) => ({ addOn: source.addOn, days: source.days(settings[source.addOn]).length }))
    .filter((row) => row.days > 0);
}

/**
 * THE PRACTICE'S OWN DAYS AND THE ADD-ONS' DAYS, IN ONE LIST.
 *
 * ── IT CONCATENATES. THAT IS THE WHOLE SAFETY ARGUMENT ─────────────────────
 *
 * The worst bug this retrofit could have is an imported day displacing one
 * somebody here entered. A practice shuts for reasons that are not public
 * holidays — a training day, a refit, a bereavement — and those are exactly the
 * closures that cannot be recovered from anywhere else if they are lost.
 *
 * So there is no de-duplication, no "the imported one wins", no keying by date
 * and no merge by any other name. Two rows on one date is not a conflict: it is
 * two true statements, and both are kept. `closuresOn` in the engine then
 * returns the practice's own first, so the reason a reader sees on a shared
 * date is theirs and the imported name sits beside it rather than over it.
 *
 * A DATE-KEYED MERGE IS THE VERSION THIS IS INSTEAD OF, and it would have been
 * two lines shorter and silently destructive: nothing about it fails, nothing
 * about it warns, and the day it deletes is a day a patient turns up on.
 *
 * The add-on guarantees the same thing on its own side — its import filters by
 * ORIGIN and never by date, so re-importing a year replaces only what that year
 * put there. This function must not undo that by re-deriving uniqueness here.
 *
 * ── AND THE SORT IS DISPLAY, NOT MERGE ─────────────────────────────────────
 *
 * By date, then the practice's own before an add-on's, then by reason. Content
 * determined all the way down, so re-importing a set that changed nothing
 * produces a byte-identical list rather than one that merely looks the same —
 * which is what lets a suite assert "nothing happened" rather than "nothing
 * important happened". The engine's own `closuresOn` re-sorts what it is given
 * and does not rely on this, so the ordering guarantee holds for a caller that
 * builds a list some other way.
 */
export function mergeClosures(
  own: readonly Closure[],
  contributed: readonly Closure[],
): Closure[] {
  return [...own, ...contributed].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if ((a.from === null) !== (b.from === null)) return a.from === null ? -1 : 1;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });
}
