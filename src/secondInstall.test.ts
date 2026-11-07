/**
 * A SECOND INSTALL OF THE DESK: the same bundle, served at another database's
 * mount, must say it is that install on every call.
 *
 * Adminium installs one app once per database. Each install's staff side is
 * served at its own mount (`/apps/clinic/<slug>/staff/`) with its own
 * `surface-config.json`, naming its `installId`. The desk reads that document
 * from the mount it was opened at and sends the id back as
 * `X-Adminium-Install`, so the server renders the document, answers the
 * stock words and saves an add-on's values for THIS practice, not the first
 * install's (with two installs and no header, those routes answer 409).
 */
import { describe, expect, it, vi } from "vitest";

import { createSessionTransport, INSTALL_HEADER } from "./data/sessionSource.ts";
import { sessionSink } from "./data/sink.ts";
import { sessionStockReads } from "./data/supplies.ts";
import { realTables } from "./data/tableOfRef.ts";
import { configBase, loadStaffConfig } from "./staffConnection.ts";

const BAKED = "/apps/clinic/staff/";

/** Two installs' documents, each at its own mount. */
const DOCS: Record<string, unknown> = {
  "/apps/clinic/staff/surface-config.json": { connectionId: "conn-1", installId: "install-1", csrfToken: "tok-1", timezone: "Europe/London" },
  "/apps/clinic/kiln/staff/surface-config.json": { connectionId: "conn-2", installId: "install-2", csrfToken: "tok-2", timezone: "Europe/Lisbon" },
};

interface Sent {
  url: string;
  headers: Record<string, string>;
}

function server() {
  const sent: Sent[] = [];
  const fetchImpl = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    sent.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const path = url.split("?")[0] ?? url;
    const doc = DOCS[path];
    const payload =
      doc ??
      (path.endsWith("/documents/render")
        ? { id: "d1", printUrl: "/api/v1/documents/d1/print", contentUrl: "/api/v1/documents/d1/content" }
        : { data: [] });
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  });
  return { sent, fetchImpl: fetchImpl as unknown as typeof fetch };
}

async function deskAt(pathname: string) {
  const { sent, fetchImpl } = server();
  const staff = await loadStaffConfig({ hostedStaff: true, base: configBase(BAKED, pathname), fetchImpl });
  if (staff === null) throw new Error("no staff config");
  // Built the way `main.tsx` builds the desk's transport.
  const transport = createSessionTransport({
    tableOfRef: realTables(staff.tables),
    ...(staff.connectionId === null ? {} : { connectionId: staff.connectionId }),
    installId: staff.installId,
    ...(staff.csrfToken === null ? {} : { staff: { csrfToken: staff.csrfToken, timezone: staff.timezone } }),
    fetchImpl,
  });
  await transport.port.config();
  return { staff, transport, sent };
}

describe("a second install of the desk", () => {
  it("reads its own install from its own mount", async () => {
    const first = await deskAt("/apps/clinic/staff/daysheet");
    const second = await deskAt("/apps/clinic/kiln/staff/daysheet");
    expect([first.staff.installId, first.staff.connectionId]).toEqual(["install-1", "conn-1"]);
    expect([second.staff.installId, second.staff.connectionId]).toEqual(["install-2", "conn-2"]);
  });

  it("says which install it is on the document render, the stock words and an add-on's values", async () => {
    const { transport, sent } = await deskAt("/apps/clinic/kiln/staff/accounts");
    const before = sent.length;
    await sessionSink(transport, realTables({})).renderDocument!({ kind: "receipt", ref: "payments", id: 7 });
    await sessionStockReads(transport).words([3 as never]);
    await transport.mutate("/api/v1/add-ons/invoices/settings", "PUT", { values: {} });
    await transport.port.list("payments", { limit: 10, offset: 0 });
    const calls = sent.slice(before);
    expect(calls.map((c) => c.url.split("?")[0])).toEqual([
      "/api/v1/apps/clinic/documents/render",
      "/api/v1/words/inventory/item",
      "/api/v1/add-ons/invoices/settings",
      "/api/v1/data/conn-2/clinic_payments",
    ]);
    for (const call of calls) expect(call.headers[INSTALL_HEADER]).toBe("install-2");
  });

  it("sends no install header when an older Adminium names no install", async () => {
    const { sent, fetchImpl } = server();
    const transport = createSessionTransport({
      tableOfRef: realTables({}),
      connectionId: "conn-1",
      installId: null,
      staff: { csrfToken: "tok-1" },
      fetchImpl,
    });
    await transport.port.list("payments", { limit: 10, offset: 0 });
    expect(sent.every((c) => !(INSTALL_HEADER in c.headers))).toBe(true);
  });
});
