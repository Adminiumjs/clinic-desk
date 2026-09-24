/**
 * The demo's practice in the page's language.
 *
 * The sample practice is written in eight languages (`@t` in the bundle), and
 * a real install takes the language of whoever adds it. The demo can change
 * language at any moment, so it keeps the words it resolved last and, on a
 * change, resolves the bundle again at the same pinned moment — same rows, same
 * keys, same times — and swaps each word that the visitor has not changed
 * since. A note the visitor typed stays as they typed it.
 */
import type { ResolvedSample } from "../data/sampleRows.ts";
import type { TableRef } from "../data/types.ts";
import type { DemoDb } from "./db.ts";

export function relabeller(db: DemoDb, resolve: (locale: string) => ResolvedSample, first: string): (locale: string) => boolean {
  let words = resolve(first);
  let current = first;
  return (locale) => {
    if (locale === current) return false;
    const next = resolve(locale);
    let changed = false;
    for (const [ref, rows] of Object.entries(next)) {
      const before = words[ref] ?? [];
      const live = db.rows[ref as TableRef] as unknown as Record<string, unknown>[] | undefined;
      if (live === undefined) continue;
      rows.forEach((row, i) => {
        const was = before[i];
        const held = live.find((r) => r["id"] === row["id"]);
        if (was === undefined || held === undefined) return;
        const patch: Record<string, unknown> = {};
        for (const [column, value] of Object.entries(row)) {
          if (typeof value === "string" && value !== was[column] && held[column] === was[column]) patch[column] = value;
        }
        if (Object.keys(patch).length === 0) return;
        Object.assign(held, patch);
        changed = true;
      });
    }
    words = next;
    current = locale;
    return changed;
  };
}
