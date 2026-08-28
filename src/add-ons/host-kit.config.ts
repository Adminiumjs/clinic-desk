/**
 * EVERY FACT THE HOST KIT NEEDS ABOUT THIS APP, IN ONE OBJECT.
 *
 * Host-owned and hand-written. The installer refuses to write it and
 * `host-kit.sh status` refuses to compare it, because everything in it is a
 * statement about this repository rather than about the seam — and a file the
 * sync overwrote would take a host's own decisions with it on every re-install.
 *
 * ── THIS FILE IS IMPORTED BY THE BROWSER HALF, WHICH CONSTRAINS IT ──────────
 *
 * `slot.tsx` binds the mount component to this object at module scope, so this
 * module is in the app's bundle. That is why `rootDir` below is derived from
 * `import.meta.url` and not from `node:path`: a `fileURLToPath` here would put
 * a Node builtin in the import graph of every screen that draws a slot, and the
 * Vite build would fail — or worse, resolve a shim and ship it. The path fields
 * are read by the guards only, which run under Node, where `import.meta.url` is
 * a `file:` URL and the derivation is exact.
 */

import type { HostKitConfig } from './kit/index.ts';
import { LOCALE_TAGS } from '../i18n/locales.ts';
import { HOSTED_SLOTS, type HostedSlotId } from './slots.ts';

/**
 * This checkout's root, as an absolute path.
 *
 * `new URL(…, import.meta.url)` rather than `fileURLToPath`, for the reason the
 * header gives. `decodeURIComponent` is not decoration: a checkout under a path
 * with a space in it arrives here percent-encoded, and a `srcDir` that does not
 * exist makes every file-walking guard read an empty list — which is a pass, in
 * every one of them, saying nothing. That failure mode is the one thing each
 * guard's own "guard on the guard" case exists to catch, and it is cheaper to
 * not create it here.
 *
 * The trailing slash is trimmed so `relativeTo` can slice `rootDir.length + 1`
 * off a path and land on the first character of the relative one, which is what
 * every failure message in the kit is formatted against.
 */
const root = decodeURIComponent(new URL('../../', import.meta.url).pathname).replace(/\/$/, '');

export const hostKit: HostKitConfig<HostedSlotId> = {
  appKey: 'clinic-desk',

  /**
   * The app's own class prefix, WITHOUT its hyphen. Every `.rh-` class in the
   * four stylesheets already carries it; the kit collapses the five places the
   * prefix has to agree — the mount component, the CSS rule pair, the dock
   * exclusion, the shelf selectors and the slot-content fixture — into this one
   * field, four of which are test files that would otherwise go green by
   * matching nothing.
   */
  classPrefix: 'rh',

  /** THIS APP'S list, not the closed registry. `slots.ts` records why. */
  hostedSlots: HOSTED_SLOTS,

  /**
   * `speaks`, and the decision is a clinical one rather than a stylistic one.
   *
   * The surface is the practice's own settings screen, under a heading about
   * the days it is shut. A reader who has opened that heading has a question,
   * and a heading with a gap under it answers it with "something is broken
   * here" — which on a screen about closing days is the worst possible reading.
   * So the slot says, in words, that nothing is connected and that the list
   * above is the whole of what the practice holds.
   *
   * `silent` was the alternative and is right on a shop floor, where a reader
   * has nothing to act on. It is wrong here for the same reason the day sheet
   * names the day it is shut rather than drawing an empty grid.
   */
  slotEmptyBehaviour: { 'settings.add-on.panel': 'speaks' },

  /**
   * TIER 1, DECLARED, AND HERE IS WHAT IT COSTS.
   *
   * This repo has no `jsdom`, no `happy-dom` and not one `.test.tsx`: its suite
   * is pure-node engine assertions and `node:fs` structural gates, and nothing
   * in it renders React. Four guards therefore do not run here, and the kit
   * prints all four by name on every run rather than letting the gap be quiet:
   *
   *   `drewSomething`             — did a fill actually PAINT anything. Without
   *     it, a fill that returns a bare wrapper is indistinguishable from one
   *     that drew, and the rule pair in `components.css` degrades to its
   *     one-condition ancestor with nothing failing.
   *   `createAddOnSlot`, driven   — the component's own render behaviours: the
   *     host's own content vanishing when a fill draws nothing, and doubling up
   *     when it draws.
   *   `labelPairingRenderedGuard` — the pixel half of the affiliation rule. The
   *     source half runs (it is the half that covers a surface nobody thought
   *     of); what is missing is the half that reads an ADD-ON's own rendered
   *     copy, which this host's grep cannot see into.
   *   `mountsGuard`              — every hosted slot proved mounted by actually
   *     rendering it. A mount inside a JSX comment satisfies a grep.
   *
   * DECLARING 1 WHILE CARRYING `jsdom` IS A FAILURE WITH NO EXEMPTION FIELD, so
   * the two halves of this decision are one line apart: this word, and the
   * absence of a DOM in `package.json`. Adding `jsdom` would not breach 25 D11
   * — that rule is about what reaches a browser and a devDependency reaches no
   * bundle — so the reason this app sits here is not a rule, it is that a React
   * test tree, a surface tour and a recording mount fixture are a change of
   * their own with their own review, and a half-built tour that visits two
   * screens reports green about the other nine. The honest state is the one
   * that says so on every run.
   */
  tier: 1,

  rootDir: root,
  srcDir: `${root}/src`,
  vendorDir: `${root}/src/add-ons/vendor`,

  /**
   * All eight, English first, read straight off the app's own locale registry.
   *
   * Read rather than written out: the lexicon gate runs per locale, and a
   * hand-copied list that fell one behind `locales.ts` would leave a language
   * unscanned while looking complete. A host that passed only `en-US` would be
   * repeating the release grep and performing none of the seven checks it
   * cannot.
   */
  localeTags: LOCALE_TAGS,

  /**
   * ONE stylesheet, and it is `components.css` rather than `screens.css`.
   *
   * `main.tsx` fixes the cascade order — tokens, base, components, screens — so
   * screens always wins a tie. The slot rule pair must not be something a
   * screen rule can tie with and beat, and it is shared UI rather than
   * view-specific, so it belongs in the third layer. The guard requires the
   * pair in EXACTLY ONE of the files named here, which is stricter than
   * "somewhere": two copies of a cascade rule is how one gets edited and the
   * other does not.
   */
  stylesheets: [`${root}/src/styles/components.css`],

  /**
   * EMPTY, AND THAT IS THE CLAIM RATHER THAN THE DEFAULT.
   *
   * The rule is that a `.tsx` printing an add-on's name or monogram also mounts
   * `Affiliation`. Exactly one file in this app prints either — the practice's
   * settings screen — and it mounts the line rather than being excused from it.
   * `components/Affiliation.tsx` is not listed even though it would qualify:
   * the guard accepts an exemption only for a file still subject to the rule,
   * and an exemption nothing needs is an exemption that widens the rule the day
   * somebody renames the file it names.
   */
  affiliationExempt: {},
};
