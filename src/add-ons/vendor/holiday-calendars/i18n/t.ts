/*
 * VENDORED from add-ons/packages/holiday-calendars/src/i18n/t.ts — synced by scripts/sync-add-ons.sh.
 * Never hand-edit this copy: edit the monorepo and re-run `sync-add-ons.sh sync`.
 * The add-on key is `holiday-calendars`; its manifest, tests and README live in the monorepo.
 */
/**
 * A message lookup, and the reason it exists rather than a hook from the host.
 *
 * A slot fill is handed a payload and nothing else. It cannot import the host's
 * `useT` — that would be a runtime dependency on the host's module graph, which
 * 24 D7 does not allow — so it has to work out the reader's language for
 * itself. The one thing the host guarantees is `<html lang>`, stamped by its
 * i18n provider; this module reads that attribute and re-renders when it moves.
 *
 * `useSyncExternalStore` over a `MutationObserver` rather than reading the
 * attribute during render: the host sets `lang` in an effect, so a plain read
 * would be one render behind on every language switch and this panel would sit
 * in the old language until something else moved.
 *
 * This is the fourth copy of this seam in the repository and it is a copy on
 * purpose — see `@adminium/add-on-host`'s own header. What is NOT copied is the
 * rule about digits: `describeNumerals` lives in the shared mirror and is run
 * against this seam by `numerals.test.ts`, because three of four add-ons
 * shipped the same digit defect independently.
 */

import { useCallback, useSyncExternalStore } from "react";

import { strings, type LocaleTag, type StringKey } from "./strings.ts";

const DEFAULT_LOCALE: LocaleTag = "en-US";

function isLocaleTag(value: string | null): value is LocaleTag {
  return value !== null && value in strings;
}

/**
 * Resolve the document's `lang` to a locale we have.
 *
 * `zh` is split by script rather than by prefix, because Simplified and
 * Traditional are separately translated and falling one through to the other
 * would silently ship the wrong Chinese.
 */
export function localeFromLang(lang: string | null): LocaleTag {
  if (isLocaleTag(lang)) return lang;
  if (lang === null || lang.length === 0) return DEFAULT_LOCALE;
  const lower = lang.toLowerCase();
  if (lower.startsWith("zh")) return /hant|tw|hk|mo/.test(lower) ? "zh-TW" : "zh-CN";
  const prefix = lower.split("-")[0];
  const hit = (Object.keys(strings) as LocaleTag[]).find(
    (tag) => tag.toLowerCase().split("-")[0] === prefix,
  );
  return hit ?? DEFAULT_LOCALE;
}

function currentLocale(): LocaleTag {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  return localeFromLang(document.documentElement.getAttribute("lang"));
}

function subscribe(onChange: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["lang"] });
  return () => observer.disconnect();
}

export type TFunction = (key: StringKey, params?: Record<string, string | number>) => string;

/**
 * Pure lookup with `{placeholder}` substitution — no plurals, by design.
 *
 * A NUMBER SUBSTITUTED INTO COPY IS FORMATTED, NEVER `String()`d, and this one
 * line is what decides whether an Arabic reader sees ١٣ or 13. Three of the
 * four add-ons in this repository shipped the same defect at the same seam, in
 * copy sitting next to host strings that were formatted correctly; fixing it
 * here rather than at each call site fixes the call sites nobody has written
 * yet.
 *
 * A caller that has ALREADY formatted its value passes a STRING and is left
 * alone, which is what keeps dates and years coming out right — see `year()`
 * below for the one number in this add-on that must not be formatted the
 * ordinary way.
 */
export function translate(
  locale: LocaleTag,
  key: StringKey,
  params?: Record<string, string | number>,
): string {
  const raw = strings[locale][key] ?? strings[DEFAULT_LOCALE][key] ?? key;
  if (params === undefined) return raw;
  const nf = new Intl.NumberFormat(locale);
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!(name in params)) return whole;
    const value = params[name];
    return typeof value === "number" ? nf.format(value) : String(value);
  });
}

export function useLocale(): LocaleTag {
  return useSyncExternalStore(subscribe, currentLocale, () => DEFAULT_LOCALE);
}

export function useT(): TFunction {
  const locale = useLocale();
  return useCallback((key, params) => translate(locale, key, params), [locale]);
}

/**
 * A YEAR IN THE READER'S NUMERALS, AND WITHOUT A THOUSANDS SEPARATOR.
 *
 * This is the one number in this add-on that the `t` seam above would get
 * wrong, and it would get it wrong in every locale rather than only in Arabic:
 * `Intl.NumberFormat("en-US").format(2026)` is `2,026`, and a picker offering
 * "2,026" and "2,027" reads as a quantity of something. A year is an ordinal
 * label, not a count.
 *
 * So it is formatted HERE, with grouping off, and passed to `translate` as a
 * string — which the seam above deliberately leaves alone. That is the same
 * arrangement `shipping-dhl` uses for a clock face, and for the same reason:
 * the rule "format every number" has exactly two exceptions in this system, and
 * both of them are handled by formatting differently rather than by not
 * formatting at all. An Arabic reader still gets ٢٠٢٦.
 */
export function yearLabel(locale: LocaleTag, year: number): string {
  return new Intl.NumberFormat(locale, { useGrouping: false }).format(year);
}

/**
 * Dates and years in the reader's own numerals and calendar.
 *
 * `day` takes an ISO calendar day and formats it IN UTC. That is not a detail:
 * an ISO day string is a calendar day and not an instant, and formatting it in
 * the reader's zone is how a holiday on the first of January is displayed as
 * the thirty-first of December to everybody west of Greenwich. `civil.ts`
 * exists so that nothing in this add-on but this line ever builds a `Date` at
 * all, and this line builds one only because `Intl.DateTimeFormat` takes one.
 */
export function useFormat(): {
  day: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  year: (value: number) => string;
} {
  const locale = useLocale();
  return {
    year: (value) => yearLabel(locale, value),
    day: (iso, opts) => {
      const [y, m, d] = iso.split("-").map((part) => Number.parseInt(part, 10));
      const at = new Date(Date.UTC(y!, m! - 1, d!));
      return new Intl.DateTimeFormat(locale, {
        timeZone: "UTC",
        ...(opts ?? { weekday: "short", day: "numeric", month: "short" }),
      }).format(at);
    },
  };
}
