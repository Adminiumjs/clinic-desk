/**
 * The desk's bounded read, as a person whose role reads only part of the
 * practice: a table they may not read is never asked for (the server would
 * refuse it, and one refused read would fail the whole desk).
 */
import { describe, expect, it } from "vitest";

import { sessionDeskReads } from "./adminiumSource.ts";
import type { SessionTransport } from "./sessionSource.ts";
import { TABLE_OF_REF } from "./tableOfRef.ts";
import type { TableRef } from "./types.ts";

function fakeTransport(asked: string[]): SessionTransport {
  return {
    port: {
      list: async (ref: string) => {
        asked.push(ref);
        return { data: [], total: null };
      },
    },
  } as unknown as SessionTransport;
}

describe("the desk's reads", () => {
  it("never asks for a table the person may not read", async () => {
    const asked: string[] = [];
    const clinicianReads: TableRef[] = ["settings", "opening_hours", "clinicians", "visit_types", "clinician_visit_types", "clinician_hours", "closures", "patients", "appointments", "recalls"];
    const reads = sessionDeskReads(fakeTransport(asked), TABLE_OF_REF, (ref) => clinicianReads.includes(ref));
    const snap = await reads.snapshot("2026-07-28", "Europe/London");
    expect(asked.length).toBeGreaterThan(0);
    expect([...new Set(asked)].filter((ref) => !clinicianReads.includes(ref as TableRef))).toEqual([]);
    expect(snap.waiting).toEqual([]);
    expect(snap.paymentsToday).toEqual([]);
  });

  it("asks for everything when the server said nothing about access", async () => {
    const asked: string[] = [];
    await sessionDeskReads(fakeTransport(asked), TABLE_OF_REF).snapshot("2026-07-28", "Europe/London");
    expect(new Set(asked)).toContain("payments");
    expect(new Set(asked)).toContain("messages");
  });
});
