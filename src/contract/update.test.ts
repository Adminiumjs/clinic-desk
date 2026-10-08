/**
 * CLINIC DESK'S UPDATE CONTRACT: THE RELEASED 0.2.3, UPDATED IN PLACE.
 *
 * On SQLite, Postgres and MySQL, along the path a practice takes:
 *
 *   1. install the RELEASED 0.2.3 — the published package's own bytes
 *      (`CONTRACT_FROM_TARBALL`), refused unless they hash to what
 *      RELEASES.json recorded — on the Adminium it was released for
 *      (`CONTRACT_FROM_ADMINIUM`, 0.3.9);
 *   2. its own sample, added at the demo's moment (09:20 on Tuesday 28 July
 *      2026 in London);
 *   3. a desk at work in 0.2.3, through 0.2.3's own doors: a payment taken, a
 *      visit walked from booked to seen with a recall, a note written;
 *   4. ADMINIUM UPGRADED IN PLACE: that Adminium stopped, and the one this
 *      build needs (`ADMINIUM_REPO`) started on the same data directory,
 *      secret and database — the app still 0.2.3, and nothing in its tables
 *      moved by the upgrade;
 *   5. every table of the app read straight from the database (each value as
 *      the engine spells it, each column as the engine declares it) and over
 *      HTTP: the snapshot;
 *   6. THIS build uploaded. The practice has Holiday calendars, as nearly
 *      every practice does (it is ticked at install), in the release of its
 *      day, which says it works with this app's 0.2: the update is refused by
 *      name, with nothing moved, until Holiday calendars is updated — and
 *      then the plan is exactly one new table (the supplies a visit used) and
 *      one new column (where supplies are taken from), nothing dropped,
 *      renamed or rewritten, and it applies;
 *   7. every row that was there is unchanged, byte for byte, and every column
 *      declaration too; the new table exists, with the manifest's columns,
 *      and is empty; the new column is empty on the row that was there;
 *   8. ONE WRITE ON AN OLD ROW: a visit seen under 0.2.3 is taken back and
 *      sent off again, and its money is what it was; a payment on a visit made
 *      under 0.2.3 moves its balance by exactly that payment, and one beyond
 *      the balance is refused;
 *   9. THE SAMPLE ON UPDATE: the update adds no sample rows; removing the
 *      sample afterwards keeps what the desk itself wrote.
 *
 * It runs twice on each engine: as above, and once more with Inventory
 * installed, connected to the app and its own sample added BEFORE the update,
 * as a practice that set up its stock first would have it. Then the same must
 * hold — connecting Inventory writes nothing into the practice's rows, and no
 * visit seen long ago takes anything off the shelf — and the links the update
 * adds work at once: a supply recorded on a visit made under 0.2.3 leaves the
 * shelf when that visit is seen, and comes back when it is taken back.
 *
 * It runs where the plain contract runs (`contract.test.ts`), with the
 * published package of the release it updates and a built checkout of the
 * Adminium that release was made for; `ADMINIUM_REQUIRE_CONTRACT=1` makes a
 * missing one a failure. It takes eighteen ports from
 * `CONTRACT_UPDATE_PORT_BASE` (after the plain contract's by default).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { TABLES } from "../manifest/tables.ts";
import { addOnBundle, appBundle, boot, Caller, ENGINES, FROM_ADMINIUM, missing, ok, packedVersion, rawTables, releasedBundle, releasedMissing, until, type Engine, type RawTable, type Server } from "./harness.ts";

type Row = Record<string, unknown> & { id: number };

const REQUIRED = ["1", "true"].includes(process.env["ADMINIUM_REQUIRE_CONTRACT"] ?? "");
const why = missing() ?? releasedMissing();
if (why !== null && REQUIRED) throw new Error(`the update contract must run here, and cannot: ${why}`);
/** After the plain contract's eight ports (or `CONTRACT_UPDATE_PORT_BASE`): its own servers and databases, so the files run side by side. */
const PORT_BASE = Number(process.env["CONTRACT_UPDATE_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4941) + 12);
const PORTS_PER_RUN = 3;
const ADMIN = { email: process.env["E2E_ADMIN_EMAIL"] ?? "e2e@adminium.local", password: process.env["E2E_ADMIN_PASSWORD"] ?? "adminium-e2e-password" };
const PREFIX = "clinic_";

/**
 * What 0.3.0 adds to 0.2.3's tables, from the manifest: the update's plan must
 * be exactly this. Where a supply line is taken from is filled from the
 * practice's setting by a rule, and a rule is no column: it adds nothing here.
 */
const NEW_TABLES = ["appointment_supplies"];
const NEW_COLUMNS: Record<string, string[]> = { settings: ["supplies_place_id"] };

/** The yes/no columns of a table, as the manifest being installed declares them. */
const yesNoColumns = (ref: string): string[] => (TABLES.find((t) => t.ref === ref)?.columns ?? []).filter((c) => c.type === "bool").map((c) => c.ref);

/** The real clock, whatever the server's is made to say. */
const realNow = () => performance.timeOrigin + performance.now();

const released = why === null ? releasedBundle() : null;
const FROM = released?.version ?? "0.2.3";
const TO = why === null ? appBundle().version : "0.3.0";

const RUNS = [
  { id: "plain", inventory: false, title: "" },
  { id: "stock", inventory: true, title: ", with Inventory connected before the update" },
] as const;

describe.skipIf(why !== null)(`the update of a live ${FROM} practice to ${TO}${why === null ? "" : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available], index) => {
    RUNS.forEach((run, r) => {
      describe.skipIf(!available)(`on ${engine}${run.title}`, () => {
        const port = PORT_BASE + (index * RUNS.length + r) * PORTS_PER_RUN;
        const database = `cd_update_${run.id}_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`;
        let server: Server;
        let staff: Caller;
        let connectionId = "";
        /** Every table of the connection, by its real name: the app's and, once it is in, Inventory's. */
        let tableIds: Record<string, string> = {};
        let before: Record<string, RawTable> = {};
        let beforeHttp: Record<string, Row[]> = {};
        let sampleBefore = { loaded: false, total: 0 };
        /** What the desk did in 0.2.3: the rows the later steps come back to. */
        const made = { seen: 0, owing: 0, note: 0, payment: 0 };
        const startedAt = realNow();
        const practice = mkdtempSync(join(tmpdir(), `cd-update-${run.id}-${engine}-`));
        const ran = { from: "", to: "" };

        const signIn = async () => {
          staff = new Caller(server.base, { origin: server.base });
          await staff.signIn(ADMIN.email, ADMIN.password);
          const connections = ok(await staff.get<{ connections: { id: string; name: string }[] }>("/api/v1/connections"));
          connectionId = connections.connections.find((c) => c.name === "northwind")!.id;
          return ok(await staff.get<{ version: string }>("/api/v1/healthz")).version;
        };
        const learnTables = async () => {
          const schema = ok(await staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${connectionId}/schema`));
          tableIds = Object.fromEntries(schema.model.tables.map((t) => [t.name, t.id]));
        };
        const dataOf = (table: string) => `/api/v1/data/${connectionId}/${encodeURIComponent(tableIds[table]!)}`;
        const data = (ref: string) => dataOf(`${PREFIX}${ref}`);
        const rowsOf = async (table: string): Promise<Row[]> => {
          const out: Row[] = [];
          for (let offset = 0; ; offset += 200) {
            const page = ok(await staff.get<{ data: Row[] }>(`${dataOf(table)}?limit=200&offset=${String(offset)}`)).data;
            out.push(...page);
            if (page.length < 200) return out.sort((a, b) => Number(a.id) - Number(b.id));
          }
        };
        const rows = (ref: string) => rowsOf(`${PREFIX}${ref}`);
        const row = async (ref: string, id: number) => (await rows(ref)).find((found) => Number(found.id) === id)!;
        const appRefs = () => Object.keys(tableIds).filter((name) => name.startsWith(PREFIX) && name !== `${PREFIX}sample_data`).map((name) => name.slice(PREFIX.length));
        const all = async () => Object.fromEntries(await Promise.all(appRefs().map(async (ref) => [ref, await rows(ref)] as const)));
        const raw = () => rawTables(engine as Engine, port, database, PREFIX);
        const sample = async () => ok(await staff.get<{ loaded: boolean; total: number }>("/api/v1/apps/clinic/sample-data"));
        const upload = async (kind: "add-ons" | "apps", bundle: { buffer: Buffer; integrity: string }) => {
          const reply = await staff.post(`/api/v1/${kind}/upload?expectedSha512=${encodeURIComponent(bundle.integrity)}`, bundle.buffer);
          expect([200, 201], JSON.stringify(reply.body).slice(0, 800)).toContain(reply.status);
        };
        /** The money of a visit, as Adminium keeps it. */
        const money = (visit: Row) => [Number(visit["fee"]), Number(visit["paid"] ?? 0), Number(visit["waived"] ?? 0), Number(visit["balance"])];

        beforeAll(async () => {
          server = await boot(engine as Engine, port, DEMO_START, database, { adminium: FROM_ADMINIUM, keep: practice });
          ran.from = await signIn();
          ok(await staff.patch(`/api/v1/connections/${connectionId}`, { timezone: DEMO_ZONE, currency: "GBP" }));
        }, 240_000);

        afterAll(async () => {
          await server?.stop();
          rmSync(practice, { recursive: true, force: true });
          rmSync(join(tmpdir(), `adminium-e2e-source-sqlite-${String(port)}.db`), { force: true });
        });

        // ── 0.2.3, released, at work ──────────────────────────────────────────

        it(`installs the RELEASED ${FROM} — the published package, byte for byte — on the Adminium it was released for`, async () => {
          const app = released!;
          // Holiday calendars is ticked when the app is installed, so a practice has it: the release of its day.
          const calendars = addOnBundle("holiday-calendars", { released: true });
          await upload("add-ons", calendars);
          await upload("apps", app);
          const body = { key: app.key, version: app.version, connectionId };
          const plan = ok(await staff.post<{ plan: { installable: boolean; checksum: string } }>("/api/v1/apps/plan", body)).plan;
          expect(plan.installable).toBe(true);
          const installed = ok(await staff.post<{ addOns?: { installed: { key: string }[] } }>("/api/v1/apps/install", { ...body, planChecksum: plan.checksum, addOns: [{ key: calendars.key, version: calendars.version }] }));
          expect(installed.addOns?.installed.map((a) => a.key)).toEqual(["holiday-calendars"]);
          await learnTables();
          expect(appRefs().sort()).toEqual(TABLES.map((t) => t.ref).filter((ref) => !NEW_TABLES.includes(ref)).sort());
        }, 180_000);

        it(`adds ${FROM}'s own sample at the demo's moment`, async () => {
          ok(await staff.post("/api/v1/apps/clinic/sample-data"));
          await until(async () => ((await sample()).loaded ? true : undefined), "the sample to be added");
          expect((await rows("appointments")).length).toBeGreaterThan(50);
        }, 240_000);

        it(`lets the desk work in ${FROM}, through its own doors: a payment, a visit walked to seen, a note`, async () => {
          const visits = await rows("appointments");
          // A payment on a seen visit that still owes.
          const owing = visits.find((v) => v["status"] === "seen" && Number(v["balance"]) > 0 && v["patient_id"] !== null)!;
          made.owing = Number(owing.id);
          const taken = ok(await staff.post<{ data: Row }>(data("payments"), { values: { appointment_id: owing.id, amount: "1.00", method: "cash", client_key: "44444444-4444-4444-8444-444444444441" } }), 201).data;
          made.payment = Number(taken.id);
          expect(Number((await row("appointments", made.owing))["balance"])).toBe(Number(owing["balance"]) - 1);
          // A booked visit of a patient on file, walked along the day and sent off with a recall.
          const booked = visits.find((v) => v["status"] === "booked" && v["patient_id"] !== null && v["clinician_id"] !== null)!;
          made.seen = Number(booked.id);
          for (const status of ["checked_in", "roomed", "with_clinician", "ready"]) ok(await staff.patch(`${data("appointments")}/${String(booked.id)}`, { values: { status } }));
          ok(await staff.patch(`${data("appointments")}/${String(booked.id)}`, { values: { status: "seen", recall_weeks: 6 } }));
          const seen = await row("appointments", made.seen);
          expect([seen["status"], seen["recall_weeks"], seen["seen_at"] !== null]).toEqual(["seen", 6, true]);
          const note = ok(await staff.post<{ data: Row }>(data("check_notes"), { values: { appointment_id: booked.id, note: "Rang to confirm the address.", client_key: "44444444-4444-4444-8444-444444444442" } }), 201).data;
          made.note = Number(note.id);
        }, 120_000);

        // ── Adminium upgraded ─────────────────────────────────────────────────

        it("upgrades Adminium in place to the one this build needs, on the same data, the app still at its release", async () => {
          const rawUnder = await raw();
          await server.stop();
          server = await boot(engine as Engine, port, Math.round(DEMO_START + (realNow() - startedAt)), database, { keep: practice });
          ran.to = await signIn();
          console.info(`[upgrade, ${engine}${run.title}] Adminium ${ran.from} → ${ran.to}`);
          expect(ran.to).not.toBe(ran.from);
          const apps = ok(await staff.get<{ apps: { key: string; version: string; connectionId: string }[] }>("/api/v1/apps"));
          expect(apps.apps.filter((a) => a.key === "clinic").map((a) => [a.version, a.connectionId])).toEqual([[FROM, connectionId]]);
          // The upgrade itself writes nothing into the app's tables.
          expect(await raw()).toEqual(rawUnder);
        }, 300_000);

        it.skipIf(!run.inventory)("installs Inventory beside the practice, with its own sample, and writes nothing into the practice's rows", async () => {
          const rawUnder = await raw();
          await upload("add-ons", addOnBundle("inventory"));
          const installed = await staff.post("/api/v1/add-ons", { key: "inventory", version: packedVersion("inventory").version, attachTo: [] });
          expect(installed.status, JSON.stringify(installed.body).slice(0, 1200)).toBeLessThan(300);
          ok(await staff.post("/api/v1/add-ons/inventory/sample-data"));
          await until(async () => (ok(await staff.get<{ loaded: boolean }>("/api/v1/add-ons/inventory/sample-data")).loaded ? true : undefined), "Inventory's sample to be added");
          expect(await raw()).toEqual(rawUnder);
        }, 300_000);

        it("reads every table of the app, straight from the database and over HTTP, once nothing is moving", async () => {
          await until(
            async () => {
              const a = await raw();
              await new Promise((resolve) => setTimeout(resolve, 3_000));
              const b = await raw();
              return JSON.stringify(a) === JSON.stringify(b) ? (before = b) : undefined;
            },
            "the database to be still",
            120_000,
          );
          await learnTables();
          beforeHttp = await all();
          expect(Object.keys(beforeHttp).sort()).toEqual(TABLES.map((t) => t.ref).filter((ref) => !NEW_TABLES.includes(ref)).sort());
          sampleBefore = await sample();
          expect(sampleBefore.loaded).toBe(true);
        }, 180_000);

        // ── the update ────────────────────────────────────────────────────────

        let plan: {
          installable: boolean;
          checksum: string;
          problems: unknown[];
          tables: { ref: string; table: string; class: string; action: string; edits: { kind: string; column: string; values?: string[] }[]; blocked: unknown[]; renameExistingTo?: string }[];
          addOns?: { key: string; need: string; action: string | null }[];
        };

        it(`plans the update to ${TO}: one new table and one new column, nothing dropped, renamed or rewritten`, async () => {
          const app = appBundle();
          await upload("apps", app);
          /*
           * The Holiday calendars the practice has was released for this app's
           * 0.2 and says so. Adminium will not let an update leave an add-on
           * behind: the plan names it, and the update is refused by name, with
           * nothing moved, until Holiday calendars itself is updated.
           */
          type AddOnLine = { key: string; state: string; installedVersion: string | null; problems: { code: string }[] };
          const alone = ok(await staff.post<{ plan: { addOns: AddOnLine[] } }>("/api/v1/apps/plan", { key: app.key, version: app.version, connectionId })).plan;
          const calendars = alone.addOns.find((a) => a.key === "holiday-calendars")!;
          expect([calendars.state, calendars.installedVersion, calendars.problems.map((p) => p.code).sort()]).toEqual(["outdated", "1.0.7", ["ADD_ON_OUT_OF_RANGE", "ADD_ON_RANGE"]]);
          const early = await staff.post("/api/v1/apps/clinic/update", {});
          expect([early.status, early.code, early.details["addOn"]]).toEqual([409, "ADD_ON_RANGE", "holiday-calendars"]);
          expect(await raw()).toEqual(before);
          const next = addOnBundle("holiday-calendars");
          await upload("add-ons", next);
          const moved = await staff.post<{ from: string; to: string }>("/api/v1/add-ons/holiday-calendars/update", { to: next.version });
          expect(moved.status, JSON.stringify(moved.body).slice(0, 1200)).toBe(200);
          expect([moved.body.from, moved.body.to]).toEqual(["1.0.7", next.version]);
          // Updating the add-on writes nothing into the practice's rows either.
          expect(await raw()).toEqual(before);
          plan = ok(await staff.post<{ plan: typeof plan }>("/api/v1/apps/plan", { key: app.key, version: app.version, connectionId })).plan;
          console.info(
            `[update plan, ${engine}${run.title}] ` +
              JSON.stringify({
                installable: plan.installable,
                problems: plan.problems,
                changed: plan.tables.filter((t) => t.action !== "reuse" || t.edits.length > 0 || t.blocked.length > 0).map((t) => ({ ref: t.ref, table: t.table, class: t.class, action: t.action, edits: t.edits, blocked: t.blocked })),
                addOns: plan.addOns?.map((a) => ({ key: a.key, need: a.need, action: a.action })),
              }),
          );
          expect([plan.installable, plan.problems]).toEqual([true, []]);
          const byRef = Object.fromEntries(plan.tables.map((t) => [t.ref, t]));
          expect(Object.keys(byRef).sort()).toEqual(TABLES.map((t) => t.ref).sort());
          for (const ref of NEW_TABLES) expect([ref, byRef[ref]!.action, byRef[ref]!.table, byRef[ref]!.class]).toEqual([ref, "create", `${PREFIX}${ref}`, "new"]);
          for (const ref of Object.keys(beforeHttp)) {
            const planned = byRef[ref]!;
            // The app's own table, kept where it is, under its name.
            expect([ref, planned.action, planned.class, planned.table, planned.renameExistingTo, planned.blocked]).toEqual([ref, "reuse", "own-leftover", `${PREFIX}${ref}`, undefined, []]);
            // Only an addition: a column added; never a column changed in type or width, never an enum touched.
            expect([ref, planned.edits.filter((e) => e.kind === "add-column").map((e) => e.column).sort()]).toEqual([ref, NEW_COLUMNS[ref] ?? []]);
            expect([ref, planned.edits.filter((e) => e.kind !== "add-column")]).toEqual([ref, []]);
          }
        }, 120_000);

        it(`updates in place to ${TO}, as planned`, async () => {
          const reply = await staff.post<{ from: string; to: string; app: { version: string; schema?: { created: string[]; reused: string[] }; rules?: { skipped: unknown[] } } }>("/api/v1/apps/clinic/update", {
            planChecksum: plan.checksum,
            // The practice that set up its stock first connects it as it updates.
            ...(run.inventory ? { addOns: [{ key: "inventory", version: packedVersion("inventory").version }] } : {}),
          });
          expect(reply.status, JSON.stringify(reply.body).slice(0, 1500)).toBe(200);
          const updated = reply.body;
          console.info(`[update reply, ${engine}${run.title}] ${JSON.stringify({ from: updated.from, to: updated.to, schema: updated.app.schema, rulesSkipped: updated.app.rules?.skipped })}`);
          expect([updated.from, updated.to, updated.app.version]).toEqual([FROM, TO, TO]);
          expect([...(updated.app.schema?.created ?? [])].sort()).toEqual(NEW_TABLES.map((t) => `${PREFIX}${t}`));
          expect(JSON.stringify(updated.app.rules?.skipped ?? [])).toBe("[]");
          const apps = ok(await staff.get<{ apps: { key: string; version: string }[] }>("/api/v1/apps"));
          expect(apps.apps.find((a) => a.key === "clinic")?.version).toBe(TO);
          await learnTables();
          const desk = ok(await staff.get<{ addOns?: Record<string, unknown> }>("/apps/clinic/staff/surface-config.json"));
          expect(Object.keys(desk.addOns ?? {}).sort()).toEqual(run.inventory ? ["holiday-calendars", "inventory"] : ["holiday-calendars"]);
        }, 240_000);

        it("keeps every row that was there, byte for byte, and every column as it was — but for the one the plan adds", async () => {
          const after = await raw();
          const added: Record<string, string[]> = {};
          const redeclared: string[] = [];
          for (const [name, was] of Object.entries(before)) {
            const now = after[name];
            expect(now, `${name} is still there`).toBeDefined();
            expect([name, now!.key]).toEqual([name, was.key]);
            added[name] = Object.keys(now!.columns).filter((c) => !(c in was.columns)).sort();
            for (const [column, declared] of Object.entries(was.columns)) {
              expect(now!.columns[column], `${name}.${column} is still there`).toBeDefined();
              if (now!.columns[column] !== declared) redeclared.push(`${name}.${column}: ${declared} → ${now!.columns[column]!}`);
            }
            // Every row: the same key, the same values as the engine spells them, in the same order.
            expect([name, now!.rows.length]).toEqual([name, was.rows.length]);
            const kept = now!.rows.map((found) => Object.fromEntries(Object.keys(was.columns).map((c) => [c, found[c]])));
            expect(kept, `the rows of ${name}`).toEqual(was.rows);
            // A column the update adds holds nothing on a row that was there.
            for (const column of added[name]!) expect([name, column, now!.rows.filter((found) => found[column] !== null).length]).toEqual([name, column, 0]);
            // Every index, foreign key and check that was there is still there, and none came.
            expect([name, now!.constraints], `the constraints of ${name}`).toEqual([name, was.constraints]);
          }
          console.info(`[redeclared, ${engine}${run.title}] ${JSON.stringify(redeclared)}`);
          expect(redeclared).toEqual([]);
          // Only the column the plan said.
          expect(Object.fromEntries(Object.entries(added).filter(([, list]) => list.length > 0))).toEqual(Object.fromEntries(Object.entries(NEW_COLUMNS).map(([ref, list]) => [`${PREFIX}${ref}`, list])));
          // And over HTTP: every row Adminium hands out is the one it handed out before.
          const nowHttp = await all();
          for (const [ref, list] of Object.entries(beforeHttp)) {
            const extra = NEW_COLUMNS[ref] ?? [];
            const trimmed = nowHttp[ref]!.map((found) => Object.fromEntries(Object.entries(found).filter(([column]) => !extra.includes(column))));
            // A yes/no: SQLite may answer 1 or 0 until an update marks the column, and true or false after.
            const bools = yesNoColumns(ref);
            const said = (list2: Record<string, unknown>[]) => list2.map((found) => Object.fromEntries(Object.entries(found).map(([column, value]) => [column, bools.includes(column) && (value === 1 || value === 0) ? value === 1 : value])));
            expect(said(trimmed), `${ref} over HTTP`).toEqual(said(list));
          }
          // The new table, with the manifest's columns, and nothing in it: no visit of the past gains a supply line.
          for (const ref of NEW_TABLES) {
            const table = after[`${PREFIX}${ref}`];
            expect(table, `${PREFIX}${ref} exists`).toBeDefined();
            expect([ref, Object.keys(table!.columns).sort()]).toEqual([ref, TABLES.find((t) => t.ref === ref)!.columns.map((c) => c.ref).sort()]);
            expect([ref, table!.rows.length]).toEqual([ref, 0]);
          }
        }, 120_000);

        // ── one write on an old row ───────────────────────────────────────────

        it(`takes a visit seen under ${FROM} back and sends it off again: its money is what it was`, async () => {
          const was = await row("appointments", made.seen);
          const back = await staff.patch<{ data: Row; postings?: unknown[] }>(`${data("appointments")}/${String(made.seen)}`, { values: { status: "ready" } });
          expect(back.status, JSON.stringify(back.body).slice(0, 800)).toBe(200);
          expect((await row("appointments", made.seen))["status"]).toBe("ready");
          const again = await staff.patch<{ data: Row; postings?: unknown[] }>(`${data("appointments")}/${String(made.seen)}`, { values: { status: "seen", recall_weeks: 6 } });
          expect(again.status, JSON.stringify(again.body).slice(0, 800)).toBe(200);
          const now = await row("appointments", made.seen);
          expect([now["status"], now["recall_weeks"]]).toEqual(["seen", 6]);
          expect(money(now)).toEqual(money(was));
          // It had no supply lines, so nothing was handed to Inventory either time.
          expect((await rows("appointment_supplies")).length).toBe(0);
        }, 120_000);

        it(`settles money on a visit made under ${FROM}: a payment moves its balance by exactly that much, and one beyond it is refused`, async () => {
          const was = await row("appointments", made.owing);
          const [fee, paid, waived, balance] = money(was);
          expect(balance).toBeGreaterThan(1);
          ok(await staff.post(data("payments"), { values: { appointment_id: made.owing, amount: "1.00", method: "card", client_key: "44444444-4444-4444-8444-444444444443" } }), 201);
          expect(money(await row("appointments", made.owing))).toEqual([fee, paid! + 1, waived, balance! - 1]);
          const over = await staff.post(data("payments"), { values: { appointment_id: made.owing, amount: String(balance), method: "card", client_key: "44444444-4444-4444-8444-444444444444" } });
          expect([over.status, over.code]).toEqual([409, "BALANCE_EXCEEDED"]);
          expect(money(await row("appointments", made.owing))).toEqual([fee, paid! + 1, waived, balance! - 1]);
        }, 120_000);

        it.skipIf(!run.inventory)(`takes a supply off the shelf for a visit made under ${FROM}, and puts it back when the visit is taken back`, async () => {
          const items = await rowsOf("inventory_items");
          const places = await rowsOf("inventory_places");
          const swab = items.find((item) => item["sku"] === "SWAB-ALC")!;
          const room = places.find((place) => place["name"] === "Treatment room")!;
          const left = async () => Number((await rowsOf("inventory_stock_points")).find((point) => Number(point["item_id"]) === Number(swab.id) && Number(point["place_id"]) === Number(room.id))!["available"]);
          const start = await left();
          ok(await staff.patch(`${data("appointments")}/${String(made.seen)}`, { values: { status: "ready" } }));
          // The column the update added holds nothing yet; a manager says where supplies are taken from, once.
          const [settings] = await rows("settings");
          expect(settings!["supplies_place_id"]).toBeNull();
          ok(await staff.patch(`${data("settings")}/${String(settings!.id)}`, { values: { supplies_place_id: room.id } }));
          // The first line recorded after the update names no place: the server writes the practice's on it.
          const line = ok(await staff.post<{ data: Row }>(data("appointment_supplies"), { values: { appointment_id: made.seen, item_id: swab.id, qty: "2", client_key: "44444444-4444-4444-8444-444444444445" } }), 201).data;
          expect(Number(line["place_id"])).toBe(Number(room.id));
          // Recording it moves nothing: the shelf is counted when the visit is seen.
          expect(await left()).toBe(start);
          const seen = await staff.patch<{ postings?: { ledger: string; state: string }[] }>(`${data("appointments")}/${String(made.seen)}`, { values: { status: "seen", recall_weeks: 6 } });
          expect(seen.status, JSON.stringify(seen.body).slice(0, 1200)).toBe(200);
          expect((seen.body.postings ?? []).map((p) => [p.ledger, p.state])).toEqual([["stock", "ok"]]);
          expect(await left()).toBe(start - 2);
          ok(await staff.patch(`${data("appointments")}/${String(made.seen)}`, { values: { status: "ready" } }));
          expect(await left()).toBe(start);
        }, 180_000);

        // ── the sample on update ──────────────────────────────────────────────

        it(`leaves the sample as ${FROM} added it: the update adds no sample rows`, async () => {
          const now = await sample();
          expect([now.loaded, now.total]).toEqual([sampleBefore.loaded, sampleBefore.total]);
        }, 60_000);

        it("removes the sample afterwards, keeping what the desk itself wrote", async () => {
          const removed = await staff.post<{ removed: number; kept: number }>("/api/v1/apps/clinic/sample-data/remove", { keepChanged: true });
          expect(removed.status, JSON.stringify(removed.body).slice(0, 800)).toBe(200);
          expect(removed.body.removed).toBeGreaterThan(0);
          expect((await sample()).loaded).toBe(false);
          // The desk's own rows: the note it wrote, the payments it took, and the visits they stand on.
          expect((await rows("check_notes")).map((note) => Number(note.id))).toContain(made.note);
          expect((await rows("payments")).map((payment) => Number(payment.id))).toContain(made.payment);
          const visits = (await rows("appointments")).map((visit) => Number(visit.id));
          expect(visits).toContain(made.seen);
          expect(visits).toContain(made.owing);
        }, 180_000);
      });
    });
  });
});
