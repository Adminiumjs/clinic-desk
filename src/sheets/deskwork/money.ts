/**
 * Amounts the desk types and shows: read in any of the practice's eight
 * languages, compared in whole cents, and written with their pence.
 *
 * A German or French desk types "22,50" and an Arabic keypad may give
 * "٢٢٫٥٠". Stripping everything but digits and dots — the easy way — reads the
 * first as 2250 and the second as nothing, and the balance cap only stops an
 * amount OVER the balance, never a wrong one under it. So an amount is read
 * here, once, and anything that is not plainly an amount is refused rather
 * than guessed.
 */
import { money } from "../../lib/format.ts";

/** Arabic-Indic (U+0660) and extended Arabic-Indic (U+06F0) digits as ASCII. */
function westernDigits(text: string): string {
  return text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String((d.charCodeAt(0) & 0xf) % 10));
}

/**
 * The amount typed, or null when it is not plainly one.
 *
 * Accepted: digits (any of the three scripts), one decimal mark (`.`, `,` or
 * the Arabic `٫`) with at most two decimals, and grouping marks where they
 * cannot be the decimal mark (`1,234.50`, `1.234,50`, `1 234,5`). A currency
 * sign before or after is ignored. Refused: a minus, letters, three or more
 * decimals, grouping that is not in threes.
 */
export function parseAmount(raw: string): number | null {
  let s = westernDigits(raw.trim())
    .replace(/[\s\u00A0\u202F']/g, "")
    .replace(/\u066B/g, ".")
    .replace(/\u066C/g, ",");
  // A currency sign or code around the number ("£45", "45 Kč", "45€").
  s = s.replace(/^[^\d.,-]+/, "").replace(/[^\d.,]+$/, "");
  if (s === "" || /[^\d.,]/.test(s)) return null;

  const dots = s.split(".").length - 1;
  const commas = s.split(",").length - 1;
  let normal: string;
  if (dots > 0 && commas > 0) {
    // Both marks: the last one is the decimal mark, the other groups.
    const decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const group = decimal === "." ? "," : ".";
    if (s.split(decimal).length - 1 !== 1) return null;
    const [whole, fraction] = s.split(decimal) as [string, string];
    if (!groupedInThrees(whole, group)) return null;
    normal = `${whole.split(group).join("")}.${fraction}`;
  } else if (dots + commas === 1) {
    const mark = dots === 1 ? "." : ",";
    const [whole, fraction] = s.split(mark) as [string, string];
    if (whole === "" && fraction === "") return null;
    // "1,234" or "1.234": three digits after one mark is grouping, never pence.
    normal = fraction.length === 3 && whole.length > 0 ? `${whole}${fraction}` : `${whole === "" ? "0" : whole}.${fraction}`;
  } else if (dots + commas > 1) {
    // One mark, several times: only grouping ("1.234.567").
    const mark = dots > 0 ? "." : ",";
    if (!groupedInThrees(s, mark)) return null;
    normal = s.split(mark).join("");
  } else {
    normal = s;
  }

  const [whole = "", fraction = ""] = normal.split(".");
  if (whole === "" && fraction === "") return null;
  if (fraction.length > 2) return null;
  const value = Number(normal);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

/** "1.234.567" / "12,345": a first group of 1–3 digits, then groups of exactly three. */
function groupedInThrees(text: string, mark: string): boolean {
  const groups = text.split(mark);
  if (groups.length === 1) return /^\d+$/.test(text);
  return /^\d{1,3}$/.test(groups[0]!) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
}

/** Whole cents, so 0.1 + 0.2 is never more than 0.3. */
export const cents = (value: number): number => Math.round(value * 100);

/** Half of an amount, to the cent (the "Half" chip). */
export const half = (value: number): number => Math.round(cents(value) / 2) / 100;

/** An amount in the practice's currency, pence kept, ".00" dropped (the shared `money()`). */
export const amountText = (value: number, currency?: string): string => money(value, currency);

/** The text an amount is typed as in a field ("22.5" → "22.50", "45" → "45"). */
export function amountInput(value: number): string {
  return cents(value) % 100 === 0 ? String(Math.round(value)) : value.toFixed(2);
}
