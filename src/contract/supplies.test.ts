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
 *      shelf for them, because a sample row is history. The nurse's kind of
 *      visit offers its two kits from the first minute.
 *
 *   3. the day's work, by the people who do it — a clinician, reception and
 *      a manager, each invited with one clinic role and signed in:
 *      - a flu vaccination recorded by the clinician and sent off by
 *        reception: five items leave the Treatment room, the vaccine from the
 *        batch the clinician confirmed, and the plaster marked not used stays;
 *      - where a line is taken from is the practice's setting, written on the
 *        line by the server when it is recorded: changed between two visits,
 *        each visit's stock leaves its own shelf; empty, a line names no place;
 *      - a clinician moves a visit into the room, in with them and ready to
 *        go, and cannot take a seen visit back; a manager can;
 *      - a visit is never stopped for stock: more than the books hold is taken
 *        anyway and marked for the stock manager;
 *      - a batch nobody confirmed stays not known on the visit's own line;
 *      - a seen visit taken back puts everything back, once; seen again, it is
 *        taken again; a visit that was never seen puts back nothing;
 *      - after seen a line is closed: no change, no "not used", no removal —
 *        but a line a manager adds then leaves the shelf at once, and comes
 *        back with the rest;
 *      - twenty visits marked seen at once on a few doses: every one is seen,
 *        the batch ends at nothing, never below, and the rest are marked;
 *      - a change of many visits at once is refused by name, and goes through
 *        when they are run one by one;
 *      - a clinician reads no cost and writes nothing of Inventory's;
 *        reception reads the lines and changes none; no stock role can tell
 *        which visit a movement was for;
 *   4. Inventory switched off for the app (it cannot answer): a visit still
 *      goes through, marked to be worked out later, and is caught up when it
 *      is back — unless one item is set to stop when there is none, which
 *      refuses the visit by name;
 *   5. Inventory removed: the lines stay readable, a new line that names an
 *      item is refused, and a visit seen then takes nothing.
 *
 * It runs where the plain contract runs (`contract.test.ts`), on four ports
 * after that file's eight.
 */
import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FLU_LINES, SUPPLIES_VISIT } from "../data/sample-supplies.ts";
import type { SessionTransport } from "../data/sessionSource.ts";
import { sessionStockReads, SuppliesGone, suppliesPort } from "../data/supplies.ts";
import type { Id } from "../data/types.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { ROLES } from "../manifest/roles.ts";
import { addOnBundle, appBundle, boot, Caller, ENGINES, missing, ok, packedVersion, until, type Engine, type Server } from "./harness.ts";

type Row = Record<string, unknown> & { id: number };
interface Posted {
  ledger: string;
  state: string;
  notes?: { line?: number; note: string }[];
}
interface Saved {
  data: Row;
  postings?: Posted[];
}

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
        // Which kits the nurse's kind of visit offers came with the practice's sample: two links, to that kind of visit and no other.
        const offered = (await rows("inventory_links")).filter((link) => link["kind"] === "kit");
        expect(offered.map((link) => [link["source_table"], link["source_row"], String(kits.find((kit) => Number(kit.id) === Number(link["kit_id"]))?.["name"])])).toEqual([
          ["clinic:visit_types", String(visit["visit_type_id"]), "Flu vaccination"],
          ["clinic:visit_types", String(visit["visit_type_id"]), "Dressing change"],
        ]);
        // A sample row is history: nothing was taken for it, so every count is the one Inventory's sample gave.
        expect(await rows("inventory_levels")).toEqual(levelsBefore);
        expect((await rows("inventory_movements")).length).toBe(movementsBefore);
      }, 300_000);

      // ── the people, and what they reach for ───────────────────────────────

      const people: Record<string, Caller> = {};
      /** Invite a person holding exactly one role; they set a password from the invitation and sign in. */
      const invite = async (roleName: string, as: string) => {
        const roles = ok(await staff.get<{ roles: { id: string; name: string }[] }>("/api/v1/roles")).roles;
        const role = roles.find((r) => r.name === roleName)!;
        const email = `${as}@rowan-supplies.dev`;
        const invited = ok(await staff.post<{ invite: { token: string } }>("/api/v1/users", { email, name: as, roleIds: [role.id] }), 201);
        const password = `${randomBytes(18).toString("base64url")}Aa1!`;
        ok(await new Caller(server.base, { origin: server.base }).post("/api/v1/auth/password/reset", { token: invited.invite.token, newPassword: password }));
        const caller = new Caller(server.base, { origin: server.base });
        // A clinic role signs in to the desk; a stock role, to the dashboard.
        if (roleName.startsWith("Clinic")) await caller.signInToDesk(email, password);
        else await caller.signIn(email, password);
        people[as] = caller;
      };
      const one = (table: string, rowId: number) => `${data(table)}/${String(rowId)}`;
      const visitsTable = "clinic_appointments";
      const linesTable = "clinic_appointment_supplies";
      /** The visit of the flu vaccination, once it is seen: what the desk's own reads are shown. */
      let fluVisit: Row;
      /**
       * The desk's session, as one person: the three calls the desk's supplies
       * reads make of it, answered by the real server under that person's grants.
       */
      const deskOf = (caller: Caller): SessionTransport =>
        ({
          connection: async () => connectionId,
          get: async (path: string) => {
            const reply = await caller.get(path);
            if (reply.status >= 400) throw Object.assign(new Error(`GET ${path} answered ${String(reply.status)}`), { status: reply.status });
            return reply.body;
          },
          port: {
            list: async (ref: string, opts: { limit: number; offset: number; where?: unknown; order?: string }) => {
              const query = `limit=${String(opts.limit)}&offset=${String(opts.offset)}${opts.where === undefined ? "" : `&where=${encodeURIComponent(JSON.stringify(opts.where))}`}${opts.order === undefined ? "" : `&order=${encodeURIComponent(opts.order)}`}`;
              return { data: ok(await caller.get<{ data: Row[] }>(`${data(`clinic_${ref}`)}?${query}`)).data };
            },
          },
        }) as unknown as SessionTransport;
      const today = () => new Date(DEMO_START).toISOString().slice(0, 10);
      let stock: { items: Row[]; batches: Row[]; places: Row[]; room: Row; flu: Row; fluBatch: Row; kit: Row; kitLines: Row[] };
      const item = (sku: string) => stock.items.find((found) => found["sku"] === sku)!;
      /** What Inventory says is left of an item in the Treatment room. */
      const left = async (sku: string) =>
        Number((await rows("inventory_stock_points")).find((point) => Number(point["item_id"]) === Number(item(sku).id) && Number(point["place_id"]) === Number(stock.room.id))!["available"]);
      const leftAll = async () => Object.fromEntries(await Promise.all(["VAC-FLU", "SYR-5", "NDL-23G", "SWAB-ALC", "PLST", "GLV-M"].map(async (sku) => [sku, await left(sku)] as const)));
      /** What is left in the vaccine's batch. */
      const inBatch = async () => Number((await rows("inventory_levels")).find((level) => Number(level["batch_id"]) === Number(stock.fluBatch.id))!["qty"]);
      /** Booked visits of patients on file nobody has touched yet, soonest first: each test takes its own. */
      let spare: Row[] = [];
      /** The nurse's kind of visit: the one the sample's flu jab was, and the one the practice's sample links its kits to. */
      let nurseType = 0;
      const takeVisit = async (status?: string, type?: number) => {
        const at = type === undefined ? 0 : spare.findIndex((found) => Number(found["visit_type_id"]) === type);
        const [visit] = at < 0 ? [] : spare.splice(at, 1);
        expect(visit, "a spare booked visit").toBeDefined();
        if (visit === undefined) throw new Error("no spare booked visit");
        if (status !== undefined) ok(await staff.patch(one(visitsTable, visit.id), { values: { status } }));
        return visit;
      };
      /** A line, as the clinician records it; the shelf it comes off is the practice's setting, which the server writes on the line. */
      const record = async (visit: Row, sku: string, more: { qty?: string; batch_id?: unknown } = {}, by = "clinician") => {
        const { batch_id: batch, ...given } = more;
        const line = ok(await people[by]!.post<Saved>(data(linesTable), { values: { appointment_id: visit.id, item_id: item(sku).id, client_key: randomBytes(18).toString("hex"), ...given } }), 201).data;
        // The batch is confirmed on the line, never given with it.
        if (batch !== undefined) ok(await people[by]!.patch(one(linesTable, line.id), { values: { batch_id: batch } }));
        return line;
      };
      /** "Where supplies are taken from", as a manager sets it on Desk settings: one row, the practice's. */
      const takeFrom = async (place: Row | null) => {
        const [settings] = await rows("clinic_settings");
        ok(await people["manager"]!.patch(one("clinic_settings", settings!.id), { values: { supplies_place_id: place === null ? null : place.id } }));
      };
      const leftAt = async (sku: string, place: Row) =>
        Number((await rows("inventory_stock_points")).find((point) => Number(point["item_id"]) === Number(item(sku).id) && Number(point["place_id"]) === Number(place.id))?.["available"] ?? 0);
      const lineNow = async (line: Row) => (await rows(linesTable)).find((found) => Number(found.id) === Number(line.id))!;
      /** A visit a test is done with, its lines removed, goes back among the spare ones: the sample holds only so many. */
      const spareAgain = async (visit: Row, ...lines: Row[]) => {
        for (const line of lines) expect((await people["manager"]!.send("DELETE", `${one(linesTable, line.id)}?confirm=true`)).status).toBe(200);
        spare.push(visit);
      };
      const seen = (visit: Row, by = "reception") => people[by]!.patch<Saved>(one(visitsTable, visit.id), { values: { status: "seen", recall_weeks: null } });
      const notesOf = (reply: { body: Saved }) => (reply.body.postings ?? []).flatMap((posting) => (posting.notes ?? []).map((note) => note.note)).sort();

      it("invites a clinician, reception and a manager, each with one clinic role, and finds the flu kit on Inventory's shelf", async () => {
        await invite("Clinic clinician", "clinician");
        await invite("Clinic reception", "reception");
        await invite("Clinic manager", "manager");
        const [items, batches, places, kits, kitLines] = [await rows("inventory_items"), await rows("inventory_batches"), await rows("inventory_places"), await rows("inventory_kits"), await rows("inventory_kit_lines")];
        const kit = kits.find((found) => found["name"] === "Flu vaccination")!;
        stock = {
          items,
          batches,
          places,
          room: places.find((place) => place["name"] === "Treatment room")!,
          flu: items.find((found) => found["sku"] === "VAC-FLU")!,
          fluBatch: batches.find((batch) => batch["code"] === "FV26A")!,
          kit,
          kitLines: kitLines.filter((line) => Number(line["kit_id"]) === Number(kit.id)),
        };
        expect(stock.kitLines.length).toBe(6);
        const visits = await rows(visitsTable);
        nurseType = Number(visits.find((visit) => visit["ref"] === "RH-SPCR")!["visit_type_id"]);
        spare = visits.filter((visit) => visit["status"] === "booked" && visit["patient_id"] !== null && visit["clinician_id"] !== null);
        expect(spare.length).toBeGreaterThanOrEqual(26);
        expect([await left("VAC-FLU"), await inBatch()]).toEqual([8, 8]);
        // Set once, by a manager: every line recorded from here on is taken from the Treatment room.
        await takeFrom(stock.room);
        expect(Number((await rows("clinic_settings"))[0]!["supplies_place_id"])).toBe(Number(stock.room.id));
      }, 240_000);

      it("posts a flu vaccination when the visit is seen: five items leave the Treatment room, the vaccine from FV26A, the unused plaster does not", async () => {
        // With the nurse, whose kind of visit offers the kit.
        const visit = await takeVisit("with_clinician", nurseType);
        const before = await leftAll();
        // The clinician presses the kit: one line for each thing in it.
        const lines: Row[] = [];
        for (const kitLine of stock.kitLines) {
          lines.push(ok(await people["clinician"]!.post<Saved>(data(linesTable), { values: { appointment_id: visit.id, kit_id: stock.kit.id, item_id: kitLine["item_id"], qty: kitLine["qty"], client_key: randomBytes(18).toString("hex") } }), 201).data);
        }
        // Where each is taken from, the clinician did not say: the server wrote the practice's setting on the line.
        expect(lines.map((line) => Number(line["place_id"]))).toEqual(lines.map(() => Number(stock.room.id)));
        // Pressed again, the kit adds nothing: a visit holds an item of a kit once.
        const again = await people["clinician"]!.post(data(linesTable), { values: { appointment_id: visit.id, kit_id: stock.kit.id, item_id: stock.flu.id, client_key: randomBytes(18).toString("hex") } });
        expect([again.status, again.code]).toEqual([409, "UNIQUE_VIOLATION"]);
        const of = (sku: string) => lines.find((line) => Number(line["item_id"]) === Number(item(sku).id))!;
        ok(await people["clinician"]!.patch(one(linesTable, of("PLST").id), { values: { not_used_at: new Date().toISOString() } }));
        ok(await people["clinician"]!.patch(one(linesTable, of("VAC-FLU").id), { values: { batch_id: stock.fluBatch.id } }));
        // Who recorded it is the server's to write.
        expect((await rows(linesTable)).find((line) => Number(line.id) === Number(of("VAC-FLU").id))!["recorded_by"]).toBe("clinician");
        // Nothing has left the shelf: recording is not taking.
        expect(await leftAll()).toEqual(before);
        ok(await people["clinician"]!.patch(one(visitsTable, visit.id), { values: { status: "ready" } }));
        const sent = await seen(visit);
        expect(sent.status, JSON.stringify(sent.body).slice(0, 1200)).toBe(200);
        expect((sent.body.postings ?? []).map((posting) => [posting.ledger, posting.state])).toEqual([["stock", "ok"]]);
        expect(notesOf(sent)).toEqual([]);
        expect(await leftAll()).toEqual({ ...before, "VAC-FLU": before["VAC-FLU"]! - 1, "SYR-5": before["SYR-5"]! - 1, "NDL-23G": before["NDL-23G"]! - 1, "SWAB-ALC": before["SWAB-ALC"]! - 2, "GLV-M": before["GLV-M"]! - 1 });
        expect(await inBatch()).toBe(7);
        fluVisit = visit;
      }, 240_000);

      it("shows the desk what Inventory says, through the desk's own reads: the clinician the whole of it, reception the names and no more", async () => {
        // The nurse's kind of visit offers both kits, as the practice's sample linked them: nobody made a link by hand.
        const visit = { id: Number(fluVisit.id) as Id, visitTypeId: Number(fluVisit["visit_type_id"]) as Id };
        const context = { today: today(), defaultPlaceId: Number(stock.room.id) as Id };
        const clinician = suppliesPort(sessionStockReads(deskOf(people["clinician"]!)));
        const seenByClinician = await clinician.load(visit, { ...context, records: true });
        expect(seenByClinician.lines.map((shown) => [shown.name, shown.line.qty, shown.unit, shown.kitName, shown.batch?.code ?? null, shown.notUsed])).toEqual([
          ["Flu vaccine, single dose", 1, "each", "Flu vaccination", "FV26A", false],
          ["Syringe 5 ml", 1, "each", "Flu vaccination", null, false],
          ["Needle 23G", 1, "each", "Flu vaccination", null, false],
          ["Alcohol swab", 2, "each", "Flu vaccination", null, false],
          ["Plaster strip", 1, "each", "Flu vaccination", null, true],
          ["Gloves, nitrile, M", 1, "pair", "Flu vaccination", null, false],
        ]);
        // What is left where the line was taken from, and Inventory's own low mark, as they stand after the visit.
        expect([seenByClinician.lines[0]!.left, seenByClinician.lines[0]!.low]).toEqual([await left("VAC-FLU"), true]);
        // The one who records is told the batch runs out soon: Inventory's own word for the vaccine, asked as the clinician.
        const word = ok(await people["clinician"]!.get<{ data: { id: string; batch?: string; soon?: boolean }[] }>(`/api/v1/words/inventory/item?table=${encodeURIComponent("inventory:items")}&ids=${String(stock.flu.id)}`)).data[0]!;
        expect([word.batch, word.soon]).toEqual(["FV26A", true]);
        expect(seenByClinician.lines.map((shown) => shown.expiresSoon)).toEqual([true, false, false, false, false, false]);
        const flu = seenByClinician.kits.find((kit) => kit.name === "Flu vaccination")!;
        expect([flu.linked, flu.added, flu.lines.length]).toEqual([true, true, 6]);
        expect(seenByClinician.kits.find((kit) => kit.name === "Dressing change")).toMatchObject({ linked: true, added: false });
        expect(seenByClinician.kits.find((kit) => kit.name === "Room turnover")).toMatchObject({ linked: false, added: false });
        expect((await clinician.searchItems("swab")).map((found) => found.name)).toEqual(["Alcohol swab"]);
        expect((await clinician.places()).map((place) => place.name)).toContain("Treatment room");
        // Reception: the same lines by name and what is left; no kit to press, no batch to propose.
        const reception = await suppliesPort(sessionStockReads(deskOf(people["reception"]!))).load(visit, { ...context, records: false });
        expect(reception.lines.map((shown) => [shown.name, shown.kitName, shown.left !== null])).toEqual(seenByClinician.lines.map((shown) => [shown.name, shown.kitName, true]));
        expect(reception.kits).toEqual([]);
        expect(reception.lines.map((shown) => shown.expiresSoon)).toEqual([true, false, false, false, false, false]);
        const manager = await suppliesPort(sessionStockReads(deskOf(people["manager"]!))).load(visit, { ...context, records: true });
        expect(manager.lines.map((shown) => [shown.name, shown.expiresSoon])).toEqual(seenByClinician.lines.map((shown) => [shown.name, shown.expiresSoon]));
        // Asked as if it recorded, reception is refused the reads that are not its own, and the view is the same.
        expect((await suppliesPort(sessionStockReads(deskOf(people["reception"]!))).load(visit, { ...context, records: true })).kits).toEqual([]);
      }, 240_000);

      it("with the setting empty a line names no place and is taken from the item's own shelf; lets no clinician mark a visit seen", async () => {
        const visit = await takeVisit("ready");
        await takeFrom(null);
        const line = await record(visit, "SWAB-ALC", { qty: "2" });
        expect(line["place_id"]).toBeNull();
        // The setting, given again, changes no line already recorded.
        await takeFrom(stock.room);
        expect((await lineNow(line))["place_id"]).toBeNull();
        const was = await left("SWAB-ALC");
        const tried = await people["clinician"]!.patch(one(visitsTable, visit.id), { values: { status: "seen" } });
        expect(tried.status, JSON.stringify(tried.body).slice(0, 300)).toBe(403);
        expect(await left("SWAB-ALC")).toBe(was);
        const sent = await seen(visit);
        expect(sent.status, JSON.stringify(sent.body).slice(0, 800)).toBe(200);
        expect(await left("SWAB-ALC")).toBe(was - 2);
      }, 180_000);

      it("the setting names the shelf stock leaves: changed between two visits, each visit's supplies leave their own shelf", async () => {
        // Two shelves hold gloves: ten pairs are moved from the Treatment room to the Back room, by Inventory's own transfer.
        const back = stock.places.find((place) => place["name"] === "Back room")!;
        const transfer = ok(await staff.post<Saved>(data("inventory_transfers"), { values: { from_place_id: stock.room.id, to_place_id: back.id } }), 201).data;
        const moved = ok(await staff.post<Saved>(data("inventory_transfer_lines"), { values: { transfer_id: transfer.id, item_id: item("GLV-M").id, qty: "10" } }), 201).data;
        ok(await staff.patch(one("inventory_transfers", transfer.id), { values: { status: "posting" } }));
        ok(await staff.patch(one("inventory_transfer_lines", moved.id), { values: { status: "posted" } }));
        ok(await staff.patch(one("inventory_transfers", transfer.id), { values: { status: "done" } }));
        const [room, shelf] = [await leftAt("GLV-M", stock.room), await leftAt("GLV-M", back)];
        expect(shelf).toBe(10);
        // The first visit is recorded while the practice takes its supplies from the Treatment room…
        const [first, second] = [await takeVisit("with_clinician"), await takeVisit("with_clinician")];
        const one_ = await record(first, "GLV-M", { qty: "2" });
        expect(Number(one_["place_id"])).toBe(Number(stock.room.id));
        // …the manager changes the setting, and the second is recorded after it.
        await takeFrom(back);
        const two = await record(second, "GLV-M", { qty: "3" });
        expect(Number(two["place_id"])).toBe(Number(back.id));
        // Recording moved nothing; a line keeps the shelf it was recorded under, whatever the setting says later.
        expect([await leftAt("GLV-M", stock.room), await leftAt("GLV-M", back)]).toEqual([room, shelf]);
        expect(Number((await lineNow(one_))["place_id"])).toBe(Number(stock.room.id));
        for (const visit of [first, second]) {
          ok(await people["clinician"]!.patch(one(visitsTable, visit.id), { values: { status: "ready" } }));
          expect((await seen(visit)).status).toBe(200);
        }
        expect([await leftAt("GLV-M", stock.room), await leftAt("GLV-M", back)]).toEqual([room - 2, shelf - 3]);
        // Taken back, each goes back where it came from.
        for (const visit of [first, second]) ok(await people["manager"]!.patch(one(visitsTable, visit.id), { values: { status: "ready" } }));
        expect([await leftAt("GLV-M", stock.room), await leftAt("GLV-M", back)]).toEqual([room, shelf]);
        await takeFrom(stock.room);
        await spareAgain(first, one_);
        await spareAgain(second, two);
      }, 240_000);

      it("lets a clinician move a visit into the room, in with them and ready to go, and never take a seen visit back; a manager can", async () => {
        const visit = await takeVisit("checked_in");
        for (const status of ["roomed", "with_clinician"]) expect([status, (await people["clinician"]!.patch(one(visitsTable, visit.id), { values: { status } })).status]).toEqual([status, 200]);
        const line = await record(visit, "SWAB-ALC", { qty: "2" });
        expect((await people["clinician"]!.patch(one(visitsTable, visit.id), { values: { status: "ready" } })).status).toBe(200);
        const was = await left("SWAB-ALC");
        expect((await seen(visit)).status).toBe(200);
        expect(await left("SWAB-ALC")).toBe(was - 2);
        // Leaving seen gives the stock back, so it is not a clinician's move: refused by where the visit stands, whatever it is moved to.
        for (const status of ["ready", "roomed"]) {
          const tried = await people["clinician"]!.patch(one(visitsTable, visit.id), { values: { status } });
          expect([status, tried.status, tried.code, tried.details["reason"], tried.details["column"]]).toEqual([status, 403, "COLUMN_FORBIDDEN", "update-from", "status"]);
        }
        expect([(await rows(visitsTable)).find((found) => Number(found.id) === Number(visit.id))!["status"], await left("SWAB-ALC")]).toEqual(["seen", was - 2]);
        // A manager takes it back, and the swabs are on the shelf again.
        expect((await people["manager"]!.patch(one(visitsTable, visit.id), { values: { status: "ready" } })).status).toBe(200);
        expect(await left("SWAB-ALC")).toBe(was);
        await spareAgain(visit, line);
      }, 240_000);

      it("leaves a batch nobody confirmed not known on the visit: nothing fills it in, and the dose still leaves the shelf", async () => {
        const visit = await takeVisit("ready");
        const line = await record(visit, "VAC-FLU");
        const was = await left("VAC-FLU");
        const sent = await seen(visit);
        expect(sent.status, JSON.stringify(sent.body).slice(0, 1200)).toBe(200);
        expect((sent.body.postings ?? []).map((posting) => posting.state)).toEqual(["ok"]);
        // The practice's own record never says a batch the clinician did not confirm.
        expect((await rows(linesTable)).find((found) => Number(found.id) === Number(line.id))!["batch_id"]).toBeNull();
        // Which batch the shelf gives it from is Inventory's to say (the one that expires first); the count is one less.
        expect(await left("VAC-FLU")).toBe(was - 1);
        // Put right, so the tests after this count from a whole shelf.
        ok(await people["manager"]!.patch(one(visitsTable, visit.id), { values: { status: "ready" } }));
        expect([await left("VAC-FLU"), await inBatch()]).toEqual([was, was]);
      }, 180_000);

      it("never stops a visit for stock: with more used than the books hold the visit is seen and the point is marked to check", async () => {
        const visit = await takeVisit("ready");
        const was = await left("VAC-FLU");
        await record(visit, "VAC-FLU", { qty: String(was + 5), batch_id: stock.fluBatch.id });
        const sent = await seen(visit);
        expect(sent.status, JSON.stringify(sent.body).slice(0, 1200)).toBe(200);
        expect((sent.body.postings ?? []).map((posting) => posting.state)).toEqual(["ok"]);
        expect(notesOf(sent)).toContain("short");
        expect((await rows(visitsTable)).find((found) => Number(found.id) === Number(visit.id))!["status"]).toBe("seen");
        // The batch gave what it had and no more; what could not be covered waits for a count.
        expect(await inBatch()).toBe(0);
        const point = (await rows("inventory_stock_points")).find((found) => Number(found["item_id"]) === Number(stock.flu.id) && Number(found["place_id"]) === Number(stock.room.id))!;
        expect([Number(point["available"]), Boolean(Number(point["needs_count"]))]).toEqual([-5, true]);
        ok(await people["manager"]!.patch(one(visitsTable, visit.id), { values: { status: "ready" } }));
        expect([await left("VAC-FLU"), await inBatch()]).toEqual([was, was]);
      }, 180_000);

      it("puts everything back once when a seen visit is taken back, and posts a second round when it is seen again; a visit never seen puts back nothing", async () => {
        const visit = await takeVisit("ready");
        await record(visit, "SWAB-ALC", { qty: "3" });
        const was = await left("SWAB-ALC");
        ok(await seen(visit));
        expect(await left("SWAB-ALC")).toBe(was - 3);
        const back = await people["manager"]!.patch<Saved>(one(visitsTable, visit.id), { values: { status: "ready" } });
        expect(back.status, JSON.stringify(back.body).slice(0, 800)).toBe(200);
        expect(await left("SWAB-ALC")).toBe(was);
        // Moved again without having been seen: nothing is open, so nothing is put back a second time.
        ok(await people["manager"]!.patch(one(visitsTable, visit.id), { values: { status: "with_clinician" } }));
        expect(await left("SWAB-ALC")).toBe(was);
        ok(await people["manager"]!.patch(one(visitsTable, visit.id), { values: { status: "ready" } }));
        ok(await seen(visit));
        expect(await left("SWAB-ALC")).toBe(was - 3);
        const movements = (await rows("inventory_movements")).length;
        // A booked visit with lines, cancelled: it was never seen, so there is nothing to give back.
        const never = await takeVisit();
        await record(never, "SWAB-ALC", { qty: "4" });
        ok(await people["reception"]!.patch(one(visitsTable, never.id), { values: { status: "cancelled" } }));
        expect([await left("SWAB-ALC"), (await rows("inventory_movements")).length]).toEqual([was - 3, movements]);
      }, 240_000);

      it("refuses a line changed or removed after the visit is seen, marking it not used included; a line added then is posted at once, and taking the visit back puts it back with the rest", async () => {
        const visit = await takeVisit("ready");
        const line = await record(visit, "GLV-M", { qty: "2" });
        const [gloves, syringes] = [await left("GLV-M"), await left("SYR-5")];
        ok(await seen(visit));
        const refusals = [
          await people["manager"]!.patch(one(linesTable, line.id), { values: { qty: "5" } }),
          await people["manager"]!.patch(one(linesTable, line.id), { values: { not_used_at: new Date().toISOString() } }),
          await people["manager"]!.patch(one(linesTable, line.id), { values: { batch_id: stock.fluBatch.id } }),
        ];
        expect(refusals.map((reply) => [reply.status, reply.code, reply.details["reason"]])).toEqual([
          [409, "POSTING_REFUSED", "mapped-changed"],
          [409, "POSTING_REFUSED", "mapped-changed"],
          [409, "POSTING_REFUSED", "mapped-changed"],
        ]);
        const removed = await people["manager"]!.send(`DELETE`, `${one(linesTable, line.id)}?confirm=true`);
        expect([removed.status, removed.code, removed.details["reason"]]).toEqual([409, "POSTING_REFUSED", "receipt-open"]);
        expect(await left("GLV-M")).toBe(gloves - 2);
        // The manager adds what was forgotten: it leaves the shelf in that same save.
        const late = await people["manager"]!.post<Saved>(data(linesTable), { values: { appointment_id: visit.id, item_id: item("SYR-5").id, qty: "1", place_id: stock.room.id, client_key: randomBytes(18).toString("hex") } });
        expect(late.status, JSON.stringify(late.body).slice(0, 1200)).toBe(201);
        expect((late.body.postings ?? []).map((posting) => [posting.ledger, posting.state])).toEqual([["stock", "ok"]]);
        expect(await left("SYR-5")).toBe(syringes - 1);
        ok(await people["manager"]!.patch(one(visitsTable, visit.id), { values: { status: "ready" } }));
        expect([await left("GLV-M"), await left("SYR-5")]).toEqual([gloves, syringes]);
        // Open again, the line changes freely.
        ok(await people["manager"]!.patch(one(linesTable, line.id), { values: { qty: "1" } }));
      }, 240_000);

      it("refuses a change of many visits to seen by name, and posts each visit when they are run one by one", async () => {
        const visits = [await takeVisit("ready"), await takeVisit("ready")];
        for (const visit of visits) await record(visit, "NDL-23G");
        const was = await left("NDL-23G");
        const ids = visits.map((visit) => visit.id);
        const bulk = await staff.post(`${data(visitsTable)}/bulk`, { action: "update", ids, values: { status: "seen" } });
        // Refused by name before anything moves: a visit holds a clinician's time, and such rows are written one at a time.
        expect([bulk.status, bulk.code, bulk.details["reason"]]).toEqual([409, "CONFLICT", "CAPACITY_ONE_AT_A_TIME"]);
        expect(await left("NDL-23G")).toBe(was);
        const each = ok(await staff.post<{ results: { id: unknown; ok: boolean; postings?: Posted[] }[] }>(`${data(visitsTable)}/one-by-one`, { ids, values: { status: "seen" } }));
        expect(each.results.map((result) => [result.ok, (result.postings ?? []).map((posting) => posting.state)])).toEqual([
          [true, ["ok"]],
          [true, ["ok"]],
        ]);
        expect(await left("NDL-23G")).toBe(was - 2);
      }, 240_000);

      it("marks twenty visits seen at once on the doses that are left: all twenty are seen, FV26A ends at 0, the rest are short", async () => {
        const doses = await inBatch();
        expect(doses).toBeGreaterThan(0);
        expect(doses).toBeLessThan(20);
        const visits: Row[] = [];
        for (let i = 0; i < 20; i += 1) {
          const visit = await takeVisit("ready");
          await record(visit, "VAC-FLU", { batch_id: stock.fluBatch.id });
          visits.push(visit);
        }
        // All at once, as twenty desks would: each its own save.
        const replies = await Promise.all(visits.map((visit) => staff.patch<Saved>(one(visitsTable, visit.id), { values: { status: "seen" } })));
        // A save that lost a lock is told to send again, never half done: sent again, one at a time.
        for (const [index, reply] of replies.entries()) {
          if (reply.status === 200) continue;
          expect(["WRITE_CONFLICT", "CAPACITY_BUSY"], JSON.stringify(reply.body).slice(0, 600)).toContain(reply.code);
          replies[index] = await until(async () => {
            const next = await staff.patch<Saved>(one(visitsTable, visits[index]!.id), { values: { status: "seen" } });
            return next.status === 200 ? next : undefined;
          }, "a visit that lost a lock to be seen");
        }
        const after = await rows(visitsTable);
        expect(visits.map((visit) => after.find((found) => Number(found.id) === Number(visit.id))!["status"])).toEqual(visits.map(() => "seen"));
        expect(await inBatch()).toBe(0);
        const short = replies.filter((reply) => notesOf(reply as { body: Saved }).includes("short")).length;
        expect(short).toBe(20 - doses);
        expect(await left("VAC-FLU")).toBe(doses - 20);
      }, 600_000);

      it("lets a clinician record supplies and read no cost; lets reception read and change nothing; shows no stock role which visit a movement was for", async () => {
        const COSTS = ["cost_avg", "supplier_cost", "value", "amount", "unit_cost"];
        for (const who of ["clinician", "reception", "manager"]) {
          for (const table of ["inventory_items", "inventory_stock_points"]) {
            const page = ok(await people[who]!.get<{ data: Row[] }>(`${data(table)}?limit=5`)).data;
            expect(page.length, `${who} reads ${table}`).toBeGreaterThan(0);
            expect(Object.keys(page[0]!).filter((column) => COSTS.includes(column)), `${who} ${table}`).toEqual([]);
          }
          // Nothing of Inventory's is theirs to write, and its history is not theirs to read.
          expect((await people[who]!.patch(one("inventory_items", stock.flu.id), { values: { name: "Flu" } })).status, who).toBe(403);
          for (const table of ["inventory_movements", "inventory_postings"]) expect((await people[who]!.get(`${data(table)}?limit=1`)).status, `${who} ${table}`).toBe(403);
        }
        // Reception sees what the clinician recorded, and records none of it.
        const visit = await takeVisit("ready");
        const line = await record(visit, "PLST");
        const shown = ok(await people["reception"]!.get<{ data: Row[] }>(`${data(linesTable)}?limit=200`)).data;
        expect(shown.some((found) => Number(found.id) === Number(line.id))).toBe(true);
        expect((await people["reception"]!.post(data(linesTable), { values: { appointment_id: visit.id, item_id: item("PLST").id } })).status).toBe(403);
        expect((await people["reception"]!.patch(one(linesTable, line.id), { values: { qty: "2" } })).status).toBe(403);
        // A clinician says which item and how many; where it comes from and who recorded it are not theirs to write.
        const placed = await people["clinician"]!.post(data(linesTable), { values: { appointment_id: visit.id, item_id: item("PLST").id, place_id: stock.room.id, client_key: randomBytes(18).toString("hex") } });
        expect(placed.status, JSON.stringify(placed.body).slice(0, 400)).toBe(403);
        // The stock roles: a movement says what moved, never for whom; the receipts that do are nobody's to read.
        for (const [roleName, as] of [["Inventory manager", "stock-manager"], ["Inventory clerk", "stock-clerk"], ["Inventory viewer", "stock-viewer"]] as const) {
          await invite(roleName, as);
          expect((await people[as]!.get(`${data("inventory_postings")}?limit=1`)).status, as).toBe(403);
          expect((await people[as]!.get(`${data(linesTable)}?limit=1`)).status, as).toBe(403);
          expect((await people[as]!.get(`${data(visitsTable)}?limit=1`)).status, as).toBe(403);
          const movement = await people[as]!.get<{ data: Row[] }>(`${data("inventory_movements")}?limit=1&order=id.desc`);
          expect(movement.status, as).toBe(200);
          expect(Object.keys(movement.body.data[0]!).filter((column) => /appointment|source|patient|visit/.test(column)), as).toEqual([]);
        }
      }, 300_000);

      // ── Inventory unable to answer, and Inventory gone ────────────────────

      it("goes on with a mark when Inventory cannot answer, and is caught up later; one item set to stop when out refuses the visit by name", async () => {
        const [going, stopped] = [await takeVisit("ready"), await takeVisit("ready")];
        await record(going, "SWAB-ALC", { qty: "2" });
        await record(stopped, "GLV-M");
        const [swabs, gloves] = [await left("SWAB-ALC"), await left("GLV-M")];
        // The practice says gloves stop a save when there is none; swabs go on.
        ok(await staff.patch(one("inventory_items", item("GLV-M").id), { values: { when_out: "stop" } }));
        const off = ok(await staff.patch<{ features?: { app: string; features: string[] }[] }>("/api/v1/add-ons/inventory", { attachedTo: "clinic", enabled: false }));
        expect(JSON.stringify(off.features ?? [])).toContain("supplies");
        // The desk is told the feature is off…
        const desk = ok(await staff.get<{ addOns?: Record<string, unknown> }>("/apps/clinic/staff/surface-config.json"));
        expect(Object.keys(desk.addOns ?? {})).toEqual([]);
        // …and the server does not pretend Inventory is not there: it cannot answer, which is not the same.
        const went = await seen(going);
        expect(went.status, JSON.stringify(went.body).slice(0, 1200)).toBe(200);
        expect((went.body.postings ?? []).map((posting) => [posting.ledger, posting.state])).toEqual([["stock", "unavailable"]]);
        expect(await left("SWAB-ALC")).toBe(swabs);
        const refused = await seen(stopped);
        expect([refused.status, refused.code, refused.details["reason"]]).toEqual([409, "POSTING_REFUSED", "add-on-unavailable"]);
        expect((await rows(visitsTable)).find((found) => Number(found.id) === Number(stopped.id))!["status"]).toBe("ready");
        // Back on: what waited is worked out, oldest first, and the visit that was stopped goes through.
        ok(await staff.patch("/api/v1/add-ons/inventory", { attachedTo: "clinic", enabled: true }));
        const caught = ok(await staff.post<{ planned: number; refused: unknown[] }>("/api/v1/ledgers/inventory/stock/catch-up", { connectionId }));
        expect([caught.planned, caught.refused]).toEqual([1, []]);
        expect(await left("SWAB-ALC")).toBe(swabs - 2);
        ok(await staff.patch(one("inventory_items", item("GLV-M").id), { values: { when_out: "default" } }));
        expect((await seen(stopped)).status).toBe(200);
        expect(await left("GLV-M")).toBe(gloves - 1);
      }, 300_000);

      it("removes the practice's supply lines with its sample, and leaves Inventory's own rows and the desk's own lines alone", async () => {
        const itemsBefore = (await rows("inventory_items")).length;
        const mine = (await rows(linesTable)).filter((line) => line["recorded_by"] !== SUPPLIES_VISIT.by).length;
        expect(mine).toBeGreaterThan(20);
        const removed = await staff.post<{ removed: number }>("/api/v1/apps/clinic/sample-data/remove", { keepChanged: true });
        expect(removed.status, JSON.stringify(removed.body).slice(0, 800)).toBe(200);
        const lines = await rows(linesTable);
        expect(lines.filter((line) => line["recorded_by"] === SUPPLIES_VISIT.by).length).toBe(0);
        expect(lines.length).toBe(mine);
        expect((await rows("inventory_items")).length).toBe(itemsBefore);
      }, 180_000);

      it("keeps the lines readable when Inventory is removed; a visit seen then takes nothing, and a new line that names an item is refused", async () => {
        const visit = (await rows(visitsTable)).find((found) => found["status"] === "ready")!;
        const lines = (await rows(linesTable)).length;
        // While the desk's supplies are on, Adminium will not take Inventory away from under them.
        const early = await staff.send("DELETE", "/api/v1/add-ons/inventory", {});
        expect([early.status, early.code]).toEqual([409, "ADD_ON_IN_USE"]);
        ok(await staff.patch("/api/v1/add-ons/inventory", { attachedTo: "clinic", enabled: false }));
        const gone = await staff.send("DELETE", "/api/v1/add-ons/inventory", {});
        expect(gone.status, JSON.stringify(gone.body).slice(0, 800)).toBe(200);
        const desk = ok(await staff.get<{ addOns?: Record<string, unknown> }>("/apps/clinic/staff/surface-config.json"));
        expect(Object.keys(desk.addOns ?? {})).toEqual([]);
        // What was recorded stays, for everyone who could read it.
        expect((await rows(linesTable)).length).toBe(lines);
        expect(ok(await people["reception"]!.get<{ data: Row[] }>(`${data(linesTable)}?limit=200`)).data.length).toBe(lines);
        // The roles' reads of Inventory went with it.
        expect([403, 404]).toContain((await people["clinician"]!.get(`${data("inventory_items")}?limit=1`)).status);
        // And the desk's own reads say so, which is what hides the tab on a desk left open.
        await expect(suppliesPort(sessionStockReads(deskOf(people["clinician"]!))).load({ id: Number(visit.id) as Id, visitTypeId: Number(visit["visit_type_id"]) as Id }, { today: today(), defaultPlaceId: null })).rejects.toBeInstanceOf(SuppliesGone);
        // A visit is seen as it always was: nothing asks an add-on that is not there.
        const sent = await people["reception"]!.patch<Saved>(one(visitsTable, visit.id), { values: { status: "seen" } });
        expect([sent.status, sent.body.postings ?? []]).toEqual([200, []]);
        // A row can never name something of an add-on that is not there for this app.
        const dead = await people["manager"]!.post(data(linesTable), { values: { appointment_id: visit.id, item_id: 1, client_key: randomBytes(18).toString("hex") } });
        expect([dead.status, dead.code, dead.details["reason"]]).toEqual([409, "POSTING_REFUSED", "add-on-unavailable"]);
      }, 240_000);
    });
  });
});
