/**
 * A VISIT'S SUPPLIES, WITH INVENTORY, ON EVERY ENGINE.
 *
 * This repo's own `manifest.json` and both sample files, installed on a BUILT
 * Adminium beside the built Inventory add-on, on SQLite, Postgres and MySQL:
 *
 *   1. install — Inventory ticked, installed and connected first, then the
 *      app; the desk's config says Inventory is connected, and each clinic
 *      role holds the reads of Inventory the manifest gives it;
 *   2. the samples — Inventory's own, then the practice's: the flu jab of
 *      three working days ago carries the six lines of the flu vaccination
 *      kit, each a link to a row of Inventory's sample, the vaccine from its
 *      batch and the plaster marked not used; and nothing left Inventory's
 *      shelf for them, because a sample row is history.
 *
 * It runs where the plain contract runs (`contract.test.ts`), on four ports
 * after that file's eight.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FLU_LINES, SUPPLIES_VISIT } from "../data/sample-supplies.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { ROLES } from "../manifest/roles.ts";
import { addOnBundle, appBundle, boot, Caller, ENGINES, missing, ok, packedVersion, until, type Engine, type Server } from "./harness.ts";

type Row = Record<string, unknown> & { id: number };

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT = Number(process.env["CONTRACT_PORT_BASE"] ?? 4941) + 8;
const ADMIN = { email: process.env["E2E_ADMIN_EMAIL"] ?? "e2e@adminium.local", password: process.env["E2E_ADMIN_PASSWORD"] ?? "adminium-e2e-password" };

describe.skipIf(why !== null)(`a visit's supplies on a built Adminium with Inventory${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available]) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let server: Server;
      let staff: Caller;
      let connectionId = "";
      /** Every table of the connection, by its real name: the app's and Inventory's. */
      let tableIds: Record<string, string> = {};

      const learnTables = async () => {
        const schema = ok(await staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${connectionId}/schema`));
        tableIds = Object.fromEntries(schema.model.tables.map((t) => [t.name, t.id]));
      };
      const data = (table: string) => `/api/v1/data/${connectionId}/${encodeURIComponent(tableIds[table]!)}`;
      const rows = async (table: string): Promise<Row[]> => {
        const out: Row[] = [];
        for (let offset = 0; ; offset += 200) {
          const page = ok(await staff.get<{ data: Row[] }>(`${data(table)}?limit=200&offset=${String(offset)}`)).data;
          out.push(...page);
          if (page.length < 200) return out.sort((a, b) => Number(a.id) - Number(b.id));
        }
      };
      const upload = async (kind: "add-ons" | "apps", bundle: { buffer: Buffer; integrity: string }) => {
        const reply = await staff.post(`/api/v1/${kind}/upload?expectedSha512=${encodeURIComponent(bundle.integrity)}`, bundle.buffer);
        expect([200, 201], JSON.stringify(reply.body).slice(0, 800)).toContain(reply.status);
      };
      const sampleIn = async (path: string, label: string) => {
        ok(await staff.post(path));
        await until(async () => (ok(await staff.get<{ loaded: boolean }>(path)).loaded ? true : undefined), label);
      };

      beforeAll(async () => {
        server = await boot(engine as Engine, PORT, DEMO_START, `cd_supplies_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`);
        staff = new Caller(server.base, { origin: server.base });
        await staff.signIn(ADMIN.email, ADMIN.password);
        const connections = ok(await staff.get<{ connections: { id: string; name: string }[] }>("/api/v1/connections"));
        connectionId = connections.connections.find((c) => c.name === "northwind")!.id;
        ok(await staff.patch(`/api/v1/connections/${connectionId}`, { timezone: DEMO_ZONE, currency: "GBP" }));
      }, 240_000);
      afterAll(async () => {
        await server?.stop();
      });

      it("installs Inventory first, when ticked, then the app, and tells the desk it is connected", async () => {
        await upload("add-ons", addOnBundle("inventory"));
        const app = appBundle();
        await upload("apps", app);
        const body = { key: app.key, version: app.version, connectionId };
        const plan = ok(
          await staff.post<{ plan: { installable: boolean; problems: unknown[]; checksum: string; addOns: { key: string; need: string; checked: boolean; action: string | null; reason: Record<string, string>; features: { id: string }[] }[] } }>("/api/v1/apps/plan", body),
        ).plan;
        expect([plan.installable, plan.problems]).toEqual([true, []]);
        const inventory = plan.addOns.find((a) => a.key === "inventory")!;
        // Offered unticked, with the app's own reason, for the one part of the desk that needs it.
        expect([inventory.need, inventory.checked, inventory.action, inventory.reason["en-US"], inventory.features.map((f) => f.id)]).toEqual([
          "feature",
          false,
          "install",
          "Record the supplies a visit uses and keep the cupboard counted",
          ["supplies"],
        ]);
        const installed = ok(
          await staff.post<{ rules: { skipped: unknown[] }; addOns?: { installed: { key: string }[]; attached: { key: string }[] } }>("/api/v1/apps/install", {
            ...body,
            planChecksum: plan.checksum,
            addOns: [{ key: "inventory", version: packedVersion("inventory").version }],
          }),
        );
        expect(JSON.stringify(installed.rules.skipped)).toBe("[]");
        expect(installed.addOns?.installed.map((a) => a.key)).toEqual(["inventory"]);
        await learnTables();
        expect(Object.keys(tableIds).filter((name) => name.startsWith("clinic_") && name !== "clinic_sample_data").length).toBe(19);
        const desk = ok(await staff.get<{ addOns?: Record<string, unknown> }>("/apps/clinic/staff/surface-config.json"));
        expect(Object.keys(desk.addOns ?? {})).toEqual(["inventory"]);
      }, 240_000);

      it("gives each clinic role the reads of Inventory the manifest names, column by column, and no other", async () => {
        const roles = ok(await staff.get<{ roles: { id: string; name: string }[] }>("/api/v1/roles")).roles;
        for (const declared of ROLES) {
          const role = roles.find((r) => r.name === declared.name);
          expect(role, declared.name).toBeDefined();
          const grants = ok(await staff.get<{ grants: string[] }>(`/api/v1/roles/${role!.id}/permissions`)).grants;
          // `table:<connection>:<schema>.inventory_<ref>:<action>`, as Adminium keeps a grant.
          const held = grants.flatMap((grant) => /[.:]inventory_([a-z_]+):([a-z_]+)$/.exec(grant)?.slice(1, 3).join(":") ?? []).sort();
          const wanted = ((declared as { tables?: { table: string; actions: string[] }[] }).tables ?? []).flatMap((grant) => grant.actions.map((action) => `${grant.table}:${action}`)).sort();
          expect([declared.name, held]).toEqual([declared.name, wanted]);
        }
      }, 120_000);

      it("adds the practice's supply lines with its sample, once Inventory's own sample is in: the six lines of the flu jab, and nothing off the shelf", async () => {
        await sampleIn("/api/v1/add-ons/inventory/sample-data", "Inventory's sample to be added");
        const levelsBefore = await rows("inventory_levels");
        const movementsBefore = (await rows("inventory_movements")).length;
        await sampleIn("/api/v1/apps/clinic/sample-data", "the practice's sample to be added");
        // Its rows for Inventory go in after its own, in a save of their own.
        const lines = await until(async () => {
          const found = await rows("clinic_appointment_supplies");
          return found.length >= FLU_LINES.length ? found : undefined;
        }, "the practice's supply lines to be added");
        const [visits, items, batches, kits, places] = [
          await rows("clinic_appointments"),
          await rows("inventory_items"),
          await rows("inventory_batches"),
          await rows("inventory_kits"),
          await rows("inventory_places"),
        ];
        const sku = (line: Row) => String(items.find((item) => Number(item.id) === Number(line["item_id"]))?.["sku"]);
        const batch = (line: Row) => (line["batch_id"] === null ? null : String(batches.find((b) => Number(b.id) === Number(line["batch_id"]))?.["code"]));
        expect(lines.map((line) => [sku(line), Number(line["qty"]), batch(line), line["not_used_at"] !== null])).toEqual(
          FLU_LINES.map((line) => [line.sku, line.qty, line.batch === undefined ? null : line.batch.replace(/^batch:/, ""), line.notUsed === true]),
        );
        // One visit: the seen flu jab; one kit; one place.
        const visit = visits.find((v) => Number(v.id) === Number(lines[0]!["appointment_id"]))!;
        expect([new Set(lines.map((line) => Number(line["appointment_id"]))).size, visit["status"], visit["ref"]]).toEqual([1, "seen", "RH-SPCR"]);
        expect([...new Set(lines.map((line) => String(kits.find((kit) => Number(kit.id) === Number(line["kit_id"]))?.["name"])))]).toEqual(["Flu vaccination"]);
        expect([...new Set(lines.map((line) => String(places.find((place) => Number(place.id) === Number(line["place_id"]))?.["name"])))]).toEqual(["Treatment room"]);
        expect([...new Set(lines.map((line) => line["recorded_by"]))]).toEqual([SUPPLIES_VISIT.by]);
        // A sample row is history: nothing was taken for it, so every count is the one Inventory's sample gave.
        expect(await rows("inventory_levels")).toEqual(levelsBefore);
        expect((await rows("inventory_movements")).length).toBe(movementsBefore);
      }, 300_000);

      it("removes the practice's supply lines with its sample, and leaves Inventory's own rows alone", async () => {
        const itemsBefore = (await rows("inventory_items")).length;
        const removed = await staff.post<{ removed: number }>("/api/v1/apps/clinic/sample-data/remove", { keepChanged: true });
        expect(removed.status, JSON.stringify(removed.body).slice(0, 800)).toBe(200);
        expect((await rows("clinic_appointment_supplies")).length).toBe(0);
        expect((await rows("inventory_items")).length).toBe(itemsBefore);
      }, 180_000);
    });
  });
});
