/**
 * Every icon a desk toast asks for is one the toast host can draw: a name
 * missing from the map quietly draws the plain tick instead, which no other
 * test would notice.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { toastIcon } from "./icons.ts";

const SRC = join(import.meta.dirname, "..", "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.includes(".test.") ? [path] : [];
  });
}

describe("desk toasts", () => {
  it("ask only for icons the toast host has", () => {
    const asked = new Set<string>();
    for (const file of sources(SRC)) {
      // The patients' pages have their own toast host and icons.
      if (file.includes(join("screens", "patient")) || file.includes("PatientOverlays")) continue;
      for (const match of readFileSync(file, "utf8").matchAll(/toast\([\s\S]{0,400}?icon: "([a-z0-9-]+)"/g)) asked.add(match[1]!);
    }
    expect(asked.size).toBeGreaterThan(10);
    const fallback = toastIcon("no-such-icon");
    expect([...asked].filter((name) => toastIcon(name) === fallback && name !== "check")).toEqual([]);
  });
});
