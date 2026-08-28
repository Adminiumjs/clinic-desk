/**
 * WHO ELSE IS INVOLVED — and the one component in this app that prints an
 * add-on's name.
 *
 * ── WHY THE NAME AND THE LINE ARE IN ONE FILE ──────────────────────────────
 *
 * 24 AC6 says a surface that names a real company carries the line saying
 * Adminium is not affiliated with it — on the surface where the reader meets
 * the name, not a page further in. The gate that checks this is a grep: any
 * `.tsx` of this app's that prints `addOn.name` must also mount `Affiliation`.
 *
 * A grep can be satisfied and still be wrong, in both directions. A file can
 * mention `Affiliation` in a branch that never runs; a file can print a name
 * through a variable the grep does not recognise. So this app does not spread
 * the pairing across its screens and hope: THE THREE COMPONENTS BELOW ARE THE
 * ONLY THINGS ANYWHERE THAT READ A NAME OFF AN ADD-ON, and every one of them
 * either mounts the line or sits next to the one that does, in this file, under
 * a comment saying so. A screen asks for a name; the pairing is not its problem
 * and not something it can get wrong by forgetting.
 *
 * ── THE TWO SENTENCES, AND WHOSE THEY ARE ──────────────────────────────────
 *
 * `namesCompany: true`  → THIS APP's line, `addon.host.notAffiliated`. It names
 *                         no add-on and no company, so holding it here does not
 *                         make this app know anything about which add-ons exist
 *                         (24 AC5).
 * `namesCompany: false` → THE ADD-ON's own words, out of its own eight-locale
 *                         bundle, through `noCompanyKeys`. This app has no
 *                         sentence of its own claiming an add-on connects to
 *                         nobody, because that is not this app's fact to state.
 *
 * An absent line is indistinguishable from a forgotten one, which is why the
 * second branch exists at all rather than rendering nothing for an add-on that
 * names no company. NOTHING is still the right answer when the add-on has
 * supplied nothing to say: an empty paragraph in a stacked layout is a blank
 * stripe with no words in it, which reads as a bug rather than as silence.
 */

import type { CSSProperties } from "react";

import { useI18n } from "../i18n/index.tsx";
import { useStore } from "../state/store.ts";
import type { AddOn } from "../add-ons/vendor/host/index.ts";

export function Affiliation({ addOn, style }: { addOn: AddOn; style?: CSSProperties }) {
  const { t, tAddOn } = useI18n();
  /*
   * `tAddOn` and not `t`: these keys arrived at registration rather than at
   * compile time, so they are not members of this app's `MessageKey` union.
   * `i18n/index.tsx` records the whole trade next to the type.
   */
  const line = addOn.namesCompany
    ? t("addon.host.notAffiliated")
    : (addOn.noCompanyKeys ?? []).map((key) => tAddOn(key)).join(" ");
  if (line.trim().length === 0) return null;
  return (
    <p className="rh-fine" style={style}>
      {line}
    </p>
  );
}

/**
 * WHERE ONE DAY CAME FROM, named, with the line under it — for a SINGLE naming.
 *
 * Takes an add-on KEY rather than an object, because that is what a `Closure`
 * carries: `from` is a key precisely so that nothing outside
 * `add-ons/registry.ts`, `add-ons/daySources.ts` and this component has to know
 * an add-on's name, and so that a day whose add-on has been unvendored resolves
 * to nothing rather than to a stale string baked into a record.
 *
 * RENDERS NOTHING FOR A KEY THE REGISTRY DOES NOT KNOW. That is the honest
 * answer and not a swallow: the alternative is printing the raw key, which
 * shows a reader an internal identifier and tells them nothing, on the one
 * surface where the question is "who says so".
 *
 * USE THIS WHERE ONE DAY IS NAMED — the day sheet's closed-day state. In a LIST
 * use `SourceChip` and `AddOnAttributions`; see the note on the pair below for
 * why one component cannot serve both.
 */
export function FromAddOn({
  addOnKey,
  messageKey,
  style,
}: {
  addOnKey: string;
  /** Which of the two provenance sentences to use. Both are this app's own. */
  messageKey: ProvenanceKey;
  style?: CSSProperties;
}) {
  const addOn = useStore((s) => s.registry).byKey(addOnKey);
  if (addOn === undefined) return null;
  return (
    <>
      <SourceChip addOnKey={addOnKey} messageKey={messageKey} style={style} />
      <Affiliation addOn={addOn} />
    </>
  );
}

/** The two provenance sentences. Both are this app's own copy, not an add-on's. */
export type ProvenanceKey = "addon.host.fromAddOn" | "addon.host.dayFrom";

/**
 * ── THE PAIR, AND WHY A LIST CANNOT USE `FromAddOn` ────────────────────────
 *
 * `FromAddOn` puts the line under the name, which is right when one day is
 * named and wrong the moment a list names eleven: the settings screen rendered
 * the same three-line paragraph under every imported row, so a reader met one
 * sentence twelve times and would learn to skip it by the third. A line
 * everybody skims is the same defect as a line that is not there, arriving by a
 * route AC6 does not describe.
 *
 * So a list draws a `SourceChip` per row and ONE `AddOnAttributions` after
 * them. The two are here, in the same file as the rule, and `AddOnAttributions`
 * takes THE SAME LIST the caller iterated rather than a hand-written set of
 * keys — so it cannot name fewer add-ons than the rows above it do, which is
 * the only way this arrangement could go quietly wrong.
 */
export function SourceChip({
  addOnKey,
  messageKey,
  style,
}: {
  addOnKey: string;
  messageKey: ProvenanceKey;
  style?: CSSProperties;
}) {
  const { t } = useI18n();
  const addOn = useStore((s) => s.registry).byKey(addOnKey);
  if (addOn === undefined) return null;
  return (
    <span className="rh-chip" style={style}>
      {t(messageKey, { name: addOn.name })}
    </span>
  );
}

/**
 * The line, once per add-on actually named in a list.
 *
 * `from` is the raw column off the rows that were drawn — nulls and all —
 * because deriving the set here is what keeps it in step with what a reader
 * saw. A caller that filtered the list after passing it here would show a name
 * with no line; a caller that filtered before is passing what it drew, which is
 * the only correct thing to pass.
 */
export function AddOnAttributions({ from }: { from: readonly (string | null)[] }) {
  const registry = useStore((s) => s.registry);
  const keys = [...new Set(from.filter((key): key is string => key !== null))].sort();
  const addOns = keys.map((key) => registry.byKey(key)).filter((a) => a !== undefined);
  if (addOns.length === 0) return null;
  return (
    <>
      {addOns.map((addOn) => (
        <Affiliation key={addOn.key} addOn={addOn} />
      ))}
    </>
  );
}
