/**
 * THE ONLY PLACE THIS APP'S SHIPPED SOURCE NAMES AN ADD-ON.
 *
 * Two import lines below name one, and everything else about it — its name, its
 * settings, its defaults, the words on its form, its eight-locale bundle, what
 * it says when it is disconnected and every day it holds — arrives inside the
 * object `register()` returns or inside the array `nonWorkingDays()` returns.
 * That is acceptance criterion 5, and the value of it is concrete: replacing
 * the add-on this practice uses for its closing days is an edit to this file
 * and a re-run of `scripts/sync-add-ons.sh`, in a repository that has no other
 * knowledge of what a holiday calendar is.
 *
 * In DEMO MODE the bundle is compiled in and named here. In connected mode
 * (Phase B, the add-on runtime, which does not exist) the list comes from
 * `GET /api/v1/add-ons` and the bundles are `import()`ed. Only the SOURCE of
 * the list changes; `createRegistry` and everything below it stay exactly as
 * they are, which is the same seam rule `DataSource` follows one directory up.
 *
 * ── THE READ SURFACE IS NEXT DOOR, IN `daySources.ts`, ON PURPOSE ──────────
 *
 * A slot fill draws a surface. This add-on also has a READ SURFACE — one pure
 * function of the values this app already holds, returning plain days — and
 * that is the half this app actually installs it for. A fill cannot deliver it:
 * a fill renders into a slot, and the day sheet needs an ARRAY before it
 * renders anything at all.
 *
 * The two live in two files, and the split is a BUNDLE decision. This module
 * calls `register()` at load, `register()` returns a fill that draws a React
 * settings panel, and so anything that imports this module drags that panel
 * into its chunk. The booking screen needs the days; it has no settings surface
 * and never will. So the read surface is in `daySources.ts`, which reaches only
 * `nonWorkingDays` — and the patient-facing bundle, which imports the store,
 * which imports the merge, which imports that file, gets a pure function and
 * not a form.
 *
 * ── WHAT THIS FILE MAY NOT BECOME ──────────────────────────────────────────
 *
 * `SettingsPanelPayload.patch` writes THE ADD-ON'S OWN VALUES. It does not
 * write this app's tables, it cannot, and there is no slot in the closed
 * registry that would let it. An import lands in the add-on's own settings
 * document and THIS APP MERGES what it finds at the mount site. Nothing here
 * may grow a path that writes a `closures` row on an add-on's behalf: that is
 * Phase B's job, and simulating it would put rows in this app's own store that
 * an operator cannot see the origin of and a disconnect could not take back.
 */

/*
 * TWO STATEMENTS FROM ONE MODULE, DELIBERATELY NOT MERGED.
 *
 * The first is THE REGISTRATION LINE, and its exact shape is what acceptance
 * criterion 5's guard forgives: `import { register as X } from '…/vendor/<key>/
 * index.ts'`. An add-on key carries a company name often enough that the guard
 * has to forgive the path, and it forgives a LINE SHAPE rather than this file —
 * exempting the file would forgive a company name written out two lines below,
 * in the one place most likely to hold one.
 *
 * The second is the READ SURFACE, which is a different thing arriving from the
 * same package, and merging them would produce one line that fits neither
 * description. Both reach no deeper than `index.ts`: a host importing an
 * add-on's internals is coupled to a shape the add-on expects to change.
 */
import { register as holidayCalendars } from './vendor/holiday-calendars/index.ts';
import type { AddOn } from './vendor/host/index.ts';
import { registerAddOnMessages } from '../i18n/messages/index.ts';

/**
 * Registered once, at module load, BECAUSE REGISTRATION IS WHERE THE MESSAGES
 * ARRIVE.
 *
 * An add-on's strings ride on the add-on object and are merged here.
 * `registerAddOnMessages` walks the bundle and THROWS, naming the add-on, the
 * locale and the key, on a missing locale or a missing string. Doing it at
 * module load rather than in a mount effect is what makes that a guarantee: the
 * store imports this module and every screen imports the store, so the merge is
 * complete before the first render reads a bundle, and it runs on every boot
 * including the demo — so it cannot be skipped the way a test can.
 *
 * The compiler used to do this job. An add-on's keys are not members of this
 * app's `MessageKey` type any more, and that is the trade `i18n/messages` sets
 * out in full: what was lost is compile-time spell-checking of eight strings
 * this app does not own, and what was kept is the guarantee itself, moved to a
 * function that runs.
 */
const REGISTERED: readonly AddOn[] = [holidayCalendars()];
for (const addOn of REGISTERED) {
  if (addOn.messages !== undefined) registerAddOnMessages(addOn.key, addOn.messages);
}

/** Everything this build can offer. */
export function demoAddOns(): AddOn[] {
  return [...REGISTERED];
}

/*
 * WHAT EVERY ADD-ON STARTS FROM IS NOT EXPORTED FROM HERE, and the absence is a
 * decision this file used to get wrong.
 *
 * `defaultSettingsFor(REGISTERED)` is one line and the store used to import it,
 * which meant the store named the add-on list — and every screen imports the
 * store, so every screen's module graph carried every add-on's settings panel.
 * `registerAddOns` seeds the defaults from the add-ons it is HANDED instead:
 * the same information, arriving from the one place allowed to know it, at the
 * one moment the store already has to be told.
 */

/** The keys a reviewer can switch on and off. */
export const DEMO_KEYS: readonly string[] = REGISTERED.map((a) => a.key);
