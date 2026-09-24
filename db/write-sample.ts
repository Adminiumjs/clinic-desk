/**
 * `npm run sample` — write everything generated from the manifest and the
 * sample builder:
 *
 *   src/data/sampleRows.ts     its column list, between its marker lines:
 *                              what the database fills each column with
 *   seeds/clinic.sample.json   the bundle an operator adds from Adminium
 *   db/schema.sql              the stand-alone stack's tables (from manifest.json)
 *   db/seed.sql                the stand-alone stack's rows (the bundle, resolved)
 *
 * src/data/sample-drift.test.ts fails when any of them is out of date, so run
 * this after changing sample.ts, sample-names.ts, sampleRows.ts or the
 * manifest.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ManifestTables } from "../src/data/sample-sql.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as ManifestTables;

const COLUMNS_START = "// ── written by `npm run sample` from manifest.json; do not edit by hand ──";
const COLUMNS_END = "// ── end of the written part ──";

/**
 * The resolver's `COLUMNS`, from the manifest: every column after `id`, and
 * what the database fills it with — a default, the adding moment (`NOW`),
 * null, or nothing (`REQUIRED`: a row must say). The browser cannot carry
 * the whole manifest to read this from, so it is written into the source.
 */
function withColumns(source: string): string {
  const start = source.indexOf(COLUMNS_START);
  const end = source.indexOf(COLUMNS_END);
  if (start < 0 || end < start) throw new Error("src/data/sampleRows.ts has lost the marker lines around COLUMNS");
  const lines = manifest.requiredSchema.tables.map((table) => {
    const columns = table.columns
      .filter((column) => column.role !== "pk")
      .map((column) => {
        const fill =
          column.default === "now" ? "NOW" : column.default !== undefined ? JSON.stringify(column.default) : column.nullable === true ? "null" : "REQUIRED";
        return `${column.ref}: ${fill}`;
      });
    return `  ${table.ref}: { ${columns.join(", ")} },`;
  });
  const block = [COLUMNS_START, "export const COLUMNS: Record<string, Record<string, Fill>> = {", ...lines, "};", ""].join("\n");
  return source.slice(0, start) + block + source.slice(end);
}

// The column list first: the seed below is resolved with it, so the modules load after.
const resolver = join(root, "src", "data", "sampleRows.ts");
const before = readFileSync(resolver, "utf8");
const after = withColumns(before);
if (after !== before) writeFileSync(resolver, after);

const { buildSample } = await import("../src/data/sample.ts");
const { schemaSql, seedSql } = await import("../src/data/sample-sql.ts");
const bundle = buildSample();

mkdirSync(join(root, "seeds"), { recursive: true });
writeFileSync(join(root, "seeds", "clinic.sample.json"), `${JSON.stringify(bundle, null, 2)}\n`);
writeFileSync(join(root, "db", "schema.sql"), schemaSql(manifest));
writeFileSync(join(root, "db", "seed.sql"), seedSql(bundle, manifest));

const rows = bundle.tables.reduce((sum, table) => sum + table.rows.length, 0);
console.info(
  `wrote seeds/clinic.sample.json (${String(bundle.tables.length)} tables, ${String(rows)} rows), db/schema.sql and db/seed.sql${after === before ? "" : ", and the column list in src/data/sampleRows.ts"}`,
);
