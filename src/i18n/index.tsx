/**
 * A tiny, dependency-free i18n runtime for this example app.
 *
 * Deliberately not i18next: the app ships as a self-contained demo people
 * clone and read, so a ~120-line context beats a 40 KB dependency. It covers
 * exactly what the app needs — message lookup with `{placeholder}`
 * substitution, a persisted locale, `lang`/`dir` stamping on <html>, and
 * memoized `Intl` formatters for money, numbers and dates.
 *
 * Plurals: `t()` takes an optional `count`, and a message may carry
 * `|`-separated variants selected through `Intl.PluralRules`, e.g.
 *   "{count} deal|{count} deals"                        (en: one|other)
 *   "{count} obchod|{count} obchody|{count} obchodů"     (cs: one|few|other)
 * The variant order is the locale's own CLDR category order, declared per
 * locale in `PLURAL_ORDER` so a translator never has to guess.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { tenantCurrency } from "./ambient.ts";

import {
  DEFAULT_LOCALE,
  LOCALES,
  dirFor,
  isLocaleTag,
  resolveLocale,
  type LocaleTag,
} from "./locales.ts";
import { MESSAGES, type MessageKey } from "./messages/index.ts";

const STORAGE_KEY = "clinic-desk-locale";

/** CLDR cardinal categories, in the order translators write `|` variants. */
const PLURAL_ORDER: Record<LocaleTag, Intl.LDMLPluralRule[]> = {
  "en-US": ["one", "other"],
  "de-DE": ["one", "other"],
  "fr-FR": ["one", "other"],
  "da-DK": ["one", "other"],
  "cs-CZ": ["one", "few", "other"],
  "zh-CN": ["other"],
  "zh-TW": ["other"],
  "ar-EG": ["zero", "one", "two", "few", "many", "other"],
};

export type TFunction = (
  key: MessageKey,
  params?: Record<string, string | number>,
  count?: number,
) => string;

/**
 * The same lookup, over a key THIS APP DOES NOT OWN.
 *
 * An add-on's strings arrive at registration rather than at compile time
 * (`messages/index.ts` sets out the whole trade), so their keys are not members
 * of `MessageKey` and the compiler cannot check them. They are also never
 * written down in this app: they arrive on the add-on object as `lineKey`,
 * `whatKey` and the two disconnect keys, so what a screen has in its hand is a
 * `string` and the question is only how to render it.
 *
 * A SEPARATE FUNCTION RATHER THAN A CAST AT EACH CALL SITE. `t(addOn.lineKey as
 * never)` is what the other hosts in this fleet write, and it works; it also
 * teaches every reader of a screen file that a cast next to a slot is ordinary,
 * in an app whose one payload contract is enforced by there being no casts.
 * One named function says the true thing instead: this key is unchecked, and
 * `registerAddOnMessages` is what took the compiler's job over.
 */
export type TAddOnFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string;

interface I18nValue {
  locale: LocaleTag;
  dir: "ltr" | "rtl";
  setLocale: (t: LocaleTag) => void;
  t: TFunction;
  /** Render a key an add-on contributed. See `TAddOnFunction`. */
  tAddOn: TAddOnFunction;
  /** Currency is a property of the money, not of the reader's language. */
  money: (value: number, currency?: string) => string;
  number: (n: number, opts?: Intl.NumberFormatOptions) => string;
  date: (d: Date | number, opts?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * The locale the Adminium host frame pushed, and the live setter that applies
 * it (29 D8).
 *
 * Module scope because it arrives from the embed bridge BEFORE React mounts —
 * the host hands over its locale during the handshake — and again later when an
 * operator switches language in the dashboard. Neither is persisted: the host's
 * language is the host's setting, and writing it here would leave the app stuck
 * in it once opened standalone.
 */
let hostLocale: LocaleTag | null = null;
let applyLocale: ((t: LocaleTag) => void) | null = null;

export function setHostLocale(tag: string): void {
  if (!isLocaleTag(tag)) return; // an unknown tag leaves the app's own default
  hostLocale = tag;
  applyLocale?.(tag);
}

function initialLocale(): LocaleTag {
  if (hostLocale !== null) return hostLocale;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocaleTag(stored)) return stored;
  } catch {
    // Private mode / storage disabled — fall through to the browser's list.
  }
  return resolveLocale(navigator.languages ?? [navigator.language]);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleTag>(initialLocale);
  const dir = dirFor(locale);

  // Stamp <html> so CSS logical properties resolve and screen readers announce
  // the right language. This is the single switch that turns RTL on.
  // Register the un-persisted setter for `setHostLocale`, so a language flip in
  // the dashboard restyles this frame live rather than on next load.
  useEffect(() => {
    applyLocale = setLocaleState;
    return () => {
      applyLocale = null;
    };
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("lang", LOCALES[locale].tag);
    el.setAttribute("dir", dir);
  }, [locale, dir]);

  const setLocale = useCallback((next: LocaleTag) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is not a reason to refuse it.
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const bundle = MESSAGES[locale];
    const fallback = MESSAGES[DEFAULT_LOCALE];
    const pr = new Intl.PluralRules(locale);
    const nf = new Intl.NumberFormat(locale);

    /* One implementation, over a plain `string`, so the two views below differ
     * in what the COMPILER will accept and in nothing else. A second lookup
     * would be a second place for the plural and placeholder rules to live. */
    const lookup = (
      key: string,
      params?: Record<string, string | number>,
      count?: number,
    ): string => {
      let raw = bundle[key] ?? fallback[key] ?? key;

      if (count !== undefined && raw.includes("|")) {
        const variants = raw.split("|");
        const order = PLURAL_ORDER[locale];
        const idx = order.indexOf(pr.select(count));
        raw =
          variants[
            idx === -1 ? variants.length - 1 : Math.min(idx, variants.length - 1)
          ];
      }

      const all = count === undefined ? params : { count, ...params };
      if (!all) return raw;
      return raw.replace(/\{(\w+)\}/g, (m: string, name: string) =>
        name in all ? String(all[name as keyof typeof all]) : m,
      );
    };

    const t: TFunction = (key, params, count) => lookup(key, params, count);
    const tAddOn: TAddOnFunction = (key, params) => lookup(key, params);

    return {
      locale,
      dir,
      setLocale,
      t,
      tAddOn,
      money: (v, currency = tenantCurrency()) =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(v),
      number: (n, opts) =>
        opts ? new Intl.NumberFormat(locale, opts).format(n) : nf.format(n),
      date: (d, opts) => new Intl.DateTimeFormat(locale, opts).format(d),
    };
  }, [locale, dir, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx === null) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Shorthand for the common case. */
export function useT(): TFunction {
  return useI18n().t;
}

export { LOCALES, LOCALE_TAGS, DEFAULT_LOCALE, type LocaleTag } from "./locales.ts";
export type { MessageKey } from "./messages/index.ts";
