/**
 * The message registry.
 *
 * The app's strings are split across three area modules under `../strings/` so
 * they can be authored without one enormous file. This module is the only
 * place that knows they are separate: it flattens them into one bundle per
 * locale, which is what the runtime looks keys up in.
 *
 * Keys must be unique across areas — a later area silently wins a collision,
 * so namespace them (`chrome.*`, `today.*`, `data.*`).
 *
 * ── AN ADD-ON'S STRINGS ARE NOT IMPORTED HERE, AND WHAT THAT COST ───────────
 *
 * The obvious arrangement is an `import … from '../../add-ons/vendor/…'` line
 * folded into `AREAS` and into the `MessageKey` union, which would give an
 * add-on's keys the same compile-time guarantees this app's own keys have. It
 * is the wrong trade: it makes this app's key vocabulary a function of which
 * add-ons happen to be vendored, and it makes this file — the i18n core — name
 * one. An app that has to be edited to accept a second add-on does not have an
 * add-on seam.
 *
 * So an add-on REGISTERS its bundle (`registerAddOnMessages`, called from
 * `add-ons/registry.ts` at module load), and here is the honest accounting:
 *
 *   LOST   — an add-on's keys are not members of `MessageKey`, so a typo in one
 *            is not caught by the compiler. Nothing in this app writes one down
 *            anyway: they arrive on the add-on object, as `lineKey`, `whatKey`
 *            and the two disconnect keys, and are rendered through `tAddOn`.
 *   LOST   — a locale missing a key inside an add-on's bundle is not a compile
 *            error HERE. It still is in the add-on's own repository, where the
 *            person who can fix it works.
 *   KEPT   — the guarantee itself, moved from the type checker to
 *            `registerAddOnMessages`, which walks the bundle at registration
 *            and throws naming the add-on, the locale and the key. It runs on
 *            every boot, including the demo, so it cannot be skipped the way a
 *            test can.
 *   KEPT   — full compile-time parity for this app's own three areas, below,
 *            entirely unchanged.
 */
import type { Translated } from "../untranslated.ts";
import { LOCALE_TAGS, type LocaleTag } from "../locales.ts";
import { chrome } from "../strings/chrome.ts";
import { screens } from "../strings/screens.ts";
import { data } from "../strings/data.ts";

/**
 * Parity guard. `en-US` defines the keys; the other seven must each carry a
 * string for every one of them. A translation module that is missing an English
 * key is a COMPILE error here rather than a silent per-key fallback to English
 * at runtime — which is the failure mode this whole layer exists to prevent.
 */
type Area<EN extends Record<string, string>> = { "en-US": EN } & Record<
  Exclude<LocaleTag, "en-US">,
  Translated<EN>
>;

const AREAS: [
  Area<(typeof chrome)["en-US"]>,
  Area<(typeof screens)["en-US"]>,
  Area<(typeof data)["en-US"]>,
] = [chrome, screens, data];

export const MESSAGES = Object.fromEntries(
  LOCALE_TAGS.map((t) => [t, Object.assign({}, ...AREAS.map((a) => a[t] ?? {}))]),
) as Record<LocaleTag, Record<string, string>>;

/** Keys are typed off English — the source of truth — so a typo is a compile error. */
export type MessageKey =
  | keyof (typeof chrome)["en-US"]
  | keyof (typeof screens)["en-US"]
  | keyof (typeof data)["en-US"];

/** One add-on's bundle, as it travels on the add-on object. */
export type AddOnMessages = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Which add-ons have registered strings, for the suite that checks they all did. */
const registered = new Set<string>();

export function registeredAddOnMessageKeys(): readonly string[] {
  return [...registered].sort();
}

/**
 * Merge an add-on's strings into the runtime bundle, refusing a bundle that is
 * not complete in all eight locales.
 *
 * THIS THROWS, AND LOUDLY, ON PURPOSE. The check it replaces was a type error,
 * and the failure it guards against — a key present in English and missing in
 * Arabic — renders a raw dotted key on a screen in exactly one of eight
 * languages, which is the failure nobody notices until a reader complains. A
 * boot that dies with the add-on, the locale and the key named is strictly
 * better than a practice running with a hole in its Arabic.
 *
 * `Object.assign(MESSAGES[locale], bundle[locale])` in a loop is four lines,
 * works, passes every test in this repo, and silently accepts an add-on missing
 * three locales. That is the version this function exists instead of.
 *
 * A key that COLLIDES with one already in the bundle is refused for the same
 * reason a later area silently winning a collision is refused above: it is how
 * an add-on ends up quietly rewriting this app's own copy, and on a clinic's
 * screens that is a sentence nobody agreed to.
 */
export function registerAddOnMessages(addOnKey: string, bundle: AddOnMessages): void {
  const english = bundle["en-US"];
  if (english === undefined) {
    throw new Error(`add-on "${addOnKey}" registered no en-US strings`);
  }

  const keys = Object.keys(english);
  for (const locale of LOCALE_TAGS) {
    const localeBundle = bundle[locale];
    if (localeBundle === undefined) {
      throw new Error(`add-on "${addOnKey}" is missing the ${locale} locale entirely`);
    }
    for (const key of keys) {
      const value = localeBundle[key];
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`add-on "${addOnKey}" is missing ${locale} for "${key}"`);
      }
    }
  }

  for (const key of keys) {
    if (MESSAGES["en-US"][key] !== undefined) {
      throw new Error(`add-on "${addOnKey}" would overwrite the existing message key "${key}"`);
    }
  }

  /* Mutating the same objects rather than rebuilding `MESSAGES` is what lets
   * the i18n provider hold a reference to a locale's bundle across a
   * registration — and registration happens at module load, before any of them
   * is read, so nothing is ever read half-merged. */
  for (const locale of LOCALE_TAGS) Object.assign(MESSAGES[locale], bundle[locale]);
  registered.add(addOnKey);
}
