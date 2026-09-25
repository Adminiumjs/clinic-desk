/**
 * The session sink: what each answer from Adminium's data API means for the
 * desk. The one that matters most is a 409: only a create whose action key
 * (`client_key`) is found was "already saved"; every other 409 — a taken
 * time, a payment over the balance, a day already closed — is a refusal the
 * desk must show, never a silent success.
 */
import { describe, expect, it, vi } from "vitest";

import type { SessionTransport } from "./sessionSource.ts";
import { sessionSink, SinkError } from "./sink.ts";
import { TABLE_OF_REF } from "./tableOfRef.ts";

function transport(mutate: SessionTransport["mutate"], found: Record<string, unknown>[] = []): SessionTransport {
  return {
    port: {
      config: async () => ({ side: "staff", timezone: "Europe/London", currency: "GBP", refs: {} }),
      assertRefs: async () => undefined,
      list: vi.fn(async () => ({ data: found })) as never,
    },
    mutate,
    get: async () => ({}) as never,
    connection: async () => "conn-1",
    tableId: async (name) => name,
    relation: async () => "rel",
    refresh: vi.fn(async () => undefined),
  };
}
const fail = (status: number, code: string, details?: unknown) => Object.assign(new Error(code), { status, code, details });

describe("the session sink", () => {
  it("writes to the real table, and answers with the saved row in the app's spelling", async () => {
    const mutate = vi.fn(async () => ({ data: { id: 7, amount: "45.00", voided: 0 } }));
    const sink = sessionSink(transport(mutate as never), TABLE_OF_REF);
    expect(await sink.insert("payments", { amount: 45, client_key: "k" })).toMatchObject({ id: 7, amount: 45, voided: false });
    expect(mutate).toHaveBeenCalledWith("/api/v1/data/conn-1/clinic_payments", "POST", { values: { amount: 45, client_key: "k" } });
  });

  it("finds the row an earlier try saved when its action key is already taken", async () => {
    const mutate = vi.fn(async () => {
      throw fail(409, "UNIQUE_VIOLATION");
    });
    const sink = sessionSink(transport(mutate as never, [{ id: 3, client_key: "k", amount: "10" }]), TABLE_OF_REF);
    expect(await sink.insert("payments", { amount: 10, client_key: "k" })).toMatchObject({ id: 3, amount: 10 });
  });

  it("refuses a unique clash that is not its own key (a day already closed)", async () => {
    const mutate = vi.fn(async () => {
      throw fail(409, "UNIQUE_VIOLATION");
    });
    const sink = sessionSink(transport(mutate as never, []), TABLE_OF_REF);
    await expect(sink.insert("day_closes", { day: "2026-07-28" })).rejects.toMatchObject({ kind: "refused", code: "UNIQUE_VIOLATION" });
  });

  it("reads a taken time, an overshooting payment and a refused value as refusals, with what they named", async () => {
    for (const [status, code, details] of [
      [409, "BOOKING_TAKEN", undefined],
      [409, "BALANCE_EXCEEDED", { column: "balance", balance: 15 }],
      [422, "VALIDATION_FAILED", { reason: "BOOKING_OUT_OF_HOURS", fields: { starts_at: {} } }],
    ] as const) {
      const sink = sessionSink(
        transport(vi.fn(async () => {
          throw fail(status, code, details);
        }) as never),
        TABLE_OF_REF,
      );
      const error = await sink.insert("appointments", {}).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(SinkError);
      expect(error).toMatchObject({ kind: "refused", code });
    }
  });

  it("stops for a sign-in on 401, and keeps trying on no answer or a lost lock race", async () => {
    for (const [status, code, kind] of [
      [401, "UNAUTHENTICATED", "signed-out"],
      [0, "NETWORK", "offline"],
      [503, "UNAVAILABLE", "offline"],
      [409, "WRITE_CONFLICT", "offline"],
    ] as const) {
      const sink = sessionSink(
        transport(vi.fn(async () => {
          throw fail(status, code);
        }) as never),
        TABLE_OF_REF,
      );
      await expect(sink.update("appointments", 1, { status: "roomed" })).rejects.toMatchObject({ kind });
    }
  });

  it("tries once more with a fresh token when the session's has rotated", async () => {
    let calls = 0;
    const mutate = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw fail(403, "CSRF_FAILED");
      return { data: { id: 1, status: "roomed" } };
    });
    const t = transport(mutate as never);
    const sink = sessionSink(t, TABLE_OF_REF);
    expect(await sink.update("appointments", 1, { status: "roomed" })).toMatchObject({ status: "roomed" });
    expect(t.refresh).toHaveBeenCalledTimes(1);
  });

  it("asks the app's own document door by the manifest's names, never the real table's", async () => {
    const mutate = vi.fn(async () => ({ id: "doc-1", printUrl: "/api/v1/documents/doc-1/print", contentUrl: "/api/v1/documents/doc-1/content", reused: false }));
    const sink = sessionSink(transport(mutate as never), TABLE_OF_REF);
    expect(await sink.renderDocument!({ kind: "receipt", ref: "payments", id: 12, locale: "fr-FR" })).toEqual({
      id: "doc-1",
      printUrl: "/api/v1/documents/doc-1/print",
      contentUrl: "/api/v1/documents/doc-1/content",
    });
    expect(mutate).toHaveBeenCalledWith("/api/v1/apps/clinic/documents/render", "POST", { kind: "receipt", ref: "payments", pk: { id: 12 }, locale: "fr-FR" });
  });

  it("hands a switched-off feature and an undrawable document back as refusals, with the server's code", async () => {
    const off = sessionSink(transport(vi.fn(async () => Promise.reject(fail(409, "FEATURE_OFF", { addOn: "invoices", feature: "insurer-receipts" }))) as never), TABLE_OF_REF);
    await expect(off.renderDocument!({ kind: "receipt", ref: "payments", id: 1 })).rejects.toMatchObject({ kind: "refused", status: 409, code: "FEATURE_OFF", details: { addOn: "invoices" } });
    const undrawn = sessionSink(transport(vi.fn(async () => Promise.reject(fail(422, "DOCUMENT_NOT_DRAWN"))) as never), TABLE_OF_REF);
    await expect(undrawn.renderDocument!({ kind: "receipt", ref: "payments", id: 1 })).rejects.toMatchObject({ kind: "refused", code: "DOCUMENT_NOT_DRAWN" });
    const empty = sessionSink(transport(vi.fn(async () => ({})) as never), TABLE_OF_REF);
    await expect(empty.renderDocument!({ kind: "receipt", ref: "payments", id: 1 })).rejects.toBeInstanceOf(SinkError);
  });
});
