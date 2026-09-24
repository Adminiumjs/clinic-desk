/**
 * The desk-day strings, checked the way a translator's slip would show on a
 * screen: every language names the same placeholders as English, a plural
 * has exactly one variant per plural form of its language (or none), and no
 * string says anything the release sweep refuses — in English or in the
 * language's own words.
 */
import { describe, expect, it } from "vitest";

import { IDEA_IN_LANGUAGE, OTHER_LANGUAGES, SUBSTRING_BANNED, type OtherLanguage } from "../../testing/kit/lexicon.ts";
import { deskDay } from "./desk-day.ts";

/** Plural forms per language, in the order the runtime reads `|` variants. */
const FORMS: Record<string, number> = { "en-US": 2, "de-DE": 2, "fr-FR": 2, "da-DK": 2, "cs-CZ": 3, "ar-EG": 6, "zh-CN": 1, "zh-TW": 1 };
const placeholders = (text: string): string[] => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();

const english = deskDay["en-US"] as Record<string, string>;
const all = Object.entries(deskDay) as [string, Record<string, string>][];

describe("the desk-day strings", () => {
  it("name the same placeholders as English, in every language", () => {
    const wrong: string[] = [];
    for (const [tag, bundle] of all) {
      for (const [key, en] of Object.entries(english)) {
        // Read over all of a plural's variants: Arabic spells out zero, one and two ("زيارتان"), the rest carry {n}.
        const want = placeholders(en);
        const got = placeholders(bundle[key] ?? "");
        if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${tag} ${key}: ${got.join()} ≠ ${want.join()}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("give a plural one variant per plural form, or a single form", () => {
    const wrong: string[] = [];
    for (const [tag, bundle] of all) {
      for (const [key, text] of Object.entries(bundle)) {
        const variants = text.split("|").length;
        if (variants !== 1 && variants !== FORMS[tag]) wrong.push(`${tag} ${key}: ${String(variants)} variants`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("say nothing the release sweep refuses", () => {
    const hits: string[] = [];
    for (const [tag, bundle] of all) {
      for (const [key, text] of Object.entries(bundle)) {
        for (const word of SUBSTRING_BANNED) if (text.toLowerCase().includes(word)) hits.push(`${tag} ${key}: "${word}"`);
        if ((OTHER_LANGUAGES as readonly string[]).includes(tag)) {
          for (const [idea, patterns] of Object.entries(IDEA_IN_LANGUAGE[tag as OtherLanguage])) {
            for (const pattern of patterns) if (pattern.test(text)) hits.push(`${tag} ${key}: ${idea}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("are translated, not English copied across", () => {
    const copied: string[] = [];
    // Patterns with no words in them are the same in every language; "min" is the French, Danish and Czech
    // abbreviation for minutes too, and "Menu" the French and Danish word.
    const wordless = (text: string) => !/[A-Za-z]{2,}/.test(text.replace(/\{\w+\}/g, "").replace(/\bmin\b/g, ""));
    for (const [tag, bundle] of all) {
      if (tag === "en-US") continue;
      for (const [key, text] of Object.entries(bundle)) if (text === english[key] && !wordless(text) && key !== "shell.menu") copied.push(`${tag} ${key}`);
    }
    expect(copied).toEqual([]);
  });
});
