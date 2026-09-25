/**
 * CLINIC DESK'S CONTRACT WITH ADMINIUM, ON EVERY ENGINE.
 *
 * This repo's own `manifest.json` and sample, installed on a BUILT Adminium
 * with the two add-ons it offers, on SQLite, Postgres and MySQL:
 *
 *   1. install — both add-ons ticked, installed and connected first, then the
 *      app; the desk's config names them, the patients' pages' config only
 *      says they are there;
 *   2. the sample, added at the demo's moment (09:20 on Tuesday 28 July 2026
 *      in London): every payment carries its visit's patient and kind of
 *      visit, as the demo's own loader copies them;
 *   3. a payment taken at the desk copies them too, whatever the desk sent;
 *   4. the receipt for an insurer, from the desk's door: the practice's
 *      letterhead, the patient's name and address, the kind of visit, the
 *      amount — and never the reason typed for the visit; drawn again while the
 *      payment is unchanged, the same document;
 *   5. the receipt emailed: the outbox sends it with the receipt attached;
 *   6. Invoices & Receipts switched off for the app: the door says the feature
 *      is off, the desk's config drops it, and a queued receipt email fails
 *      with the reason instead of going without its receipt; switched on
 *      again, it all comes back;
 *   7. nothing anonymous reaches it: no patients'-page door opens payments or
 *      documents, and a document's print copy needs a session;
 *   8. the sample removed.
 *
 * And the update a practice on 0.2.0 makes: the released 0.2.0 installed with
 * its sample, then updated to this version with Holiday calendars — the new
 * links added to tables that already hold rows, on every engine — then
 * Invoices & Receipts connected afterwards, which switches the receipt on,
 * and a receipt drawn and emailed for a payment taken before and after.
 *
 * It runs where an Adminium checkout with its built server and dashboard is
 * (`ADMINIUM_REPO`) and the add-ons checkout beside it (`ADD_ONS_REPO`), and
 * says why it skipped when they are not; `ADMINIUM_REQUIRE_CONTRACT=1` makes
 * that a failure. Postgres and MySQL run with `TEST_POSTGRES_URL` /
 * `TEST_MYSQL_URL`. It takes eight ports from `CONTRACT_PORT_BASE` (4941).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import bundleJson from "../../seeds/clinic.sample.json";
import { normalise } from "../data/rows.ts";
import { resolveSample } from "../data/sampleRows.ts";
import type { TableRef } from "../data/types.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { addOnBundle, appBundle, boot, Caller, ENGINES, missing, ok, packedFloor, packedVersion, RELEASED, releasedReadable, until, type Engine, type Reply, type Server } from "./harness.ts";

type Row = Record<string, unknown> & { id: number };
interface SinkMessage {
  to: string[];
  subject: string;
  text: string;
  attachments: { filename: string; contentType: string; size: number; related?: boolean }[];
}

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the contract must run here, and cannot: ${why}`);
const PORT_BASE = Number(process.env["CONTRACT_PORT_BASE"] ?? 4941);
const ADMIN = { email: process.env["E2E_ADMIN_EMAIL"] ?? "e2e@adminium.local", password: process.env["E2E_ADMIN_PASSWORD"] ?? "adminium-e2e-password" };
const LETTERHEAD = { business_name: "Rowan Health", business_lines: ["14 Rowan Street", "Leeds LS2 7AB"] };
/** A patient's address that is not reserved for examples, so the sender really sends to it. */
const INBOX = "cormac.byrne@rowan-contract.dev";

const REHEARSAL = (() => {
  if (why !== null) return "";
  const invoices = packedVersion("invoices");
  const floor = packedFloor();
  return [
    invoices.rehearsed ? ` (the add-ons checkout's Invoices & Receipts, ${invoices.checkout}, packed as ${invoices.version}: its release not yet stamped)` : "",
    floor.rehearsed ? ` (this app's floor, ${floor.asked}, packed as the Adminium checkout's ${floor.floor}: its release not yet stamped)` : "",
  ].join("");
})();

/** What one install on one engine needs to be driven. */
interface Install {
  server: Server;
  staff: Caller;
  connectionId: string;
  tableIds: Record<string, string>;
}

async function start(engine: Engine, port: number, database: string): Promise<Install> {
  const server = await boot(engine, port, DEMO_START, database);
  const staff = new Caller(server.base, { origin: server.base });
  await staff.signIn(ADMIN.email, ADMIN.password);
  const connections = ok(await staff.get<{ connections: { id: string; name: string }[] }>("/api/v1/connections"));
  const connectionId = connections.connections.find((c) => c.name === "northwind")!.id;
  // The practice's clock and currency, as the sample practice keeps them.
  ok(await staff.patch(`/api/v1/connections/${connectionId}`, { timezone: DEMO_ZONE, currency: "GBP" }));
  return { server, staff, connectionId, tableIds: {} };
}

async function upload(staff: Caller, kind: "add-ons" | "apps", bundle: { buffer: Buffer; integrity: string; key: string; version: string }): Promise<void> {
  const reply = await staff.post<{ key?: string; version?: string }>(`/api/v1/${kind}/upload?expectedSha512=${encodeURIComponent(bundle.integrity)}`, bundle.buffer);
  expect([200, 201], JSON.stringify(reply.body).slice(0, 800)).toContain(reply.status);
}

/** The app's tables' ids on the connection, by the manifest's refs. */
async function tablesOf(at: Install): Promise<void> {
  const schema = ok(await at.staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${at.connectionId}/schema`));
  at.tableIds = Object.fromEntries(schema.model.tables.filter((t) => t.name.startsWith("clinic_")).map((t) => [t.name.slice("clinic_".length), t.id]));
}

const data = (at: Install, ref: string) => `/api/v1/data/${at.connectionId}/${encodeURIComponent(at.tableIds[ref]!)}`;

/** Every row of one of the app's tables, in the app's spelling. */
async function rows(at: Install, ref: TableRef): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = ok(await at.staff.get<{ data: Record<string, unknown>[] }>(`${data(at, ref)}?limit=200&offset=${String(offset)}`)).data;
    out.push(...page.map((raw) => ({ ...raw, ...normalise(ref, raw) }) as unknown as Row));
    if (page.length < 200) return out;
  }
}

async function addSample(at: Install): Promise<void> {
  ok(await at.staff.post("/api/v1/apps/clinic/sample-data"));
  await until(async () => (ok(await at.staff.get<{ loaded: boolean }>("/api/v1/apps/clinic/sample-data")).loaded ? true : undefined), "the sample to be added");
}

/** The letterhead the receipt prints: Invoices & Receipts' own settings. */
async function letterhead(at: Install): Promise<void> {
  ok(await at.staff.put("/api/v1/add-ons/invoices/settings", { values: LETTERHEAD }));
}

const render = (at: Install, id: number, extra: Record<string, unknown> = {}) =>
  at.staff.post<{ id: string; printUrl: string; contentUrl: string; reused: boolean }>("/api/v1/apps/clinic/documents/render", { kind: "receipt", ref: "payments", pk: { id }, locale: "en-US", ...extra });

/** The print copy's text, tags and styles taken out. */
async function printed(at: Install, printUrl: string): Promise<string> {
  const reply = await at.staff.get<string>(printUrl);
  expect(reply.status).toBe(200);
  return String(reply.body)
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;|&rsquo;/g, "’")
    .replace(/\s+/g, " ");
}

/** Queue a receipt email for a payment, as the desk's "Email it" does. */
async function queueReceipt(at: Install, payment: Row, visit: Row, to: string, key: string): Promise<Row> {
  return ok(
    await at.staff.post<{ data: Row }>(data(at, "messages"), {
      values: { kind: "receipt", payment_id: payment.id, patient_id: visit["patient_id"], appointment_id: payment["appointment_id"], to_address: to, language: "en-US", status: "queued", client_key: key },
    }),
    201,
  ).data;
}

async function messageRow(at: Install, id: number): Promise<Row | undefined> {
  return (await rows(at, "messages")).find((m) => m.id === id);
}

async function sinkFor(at: Install, to: string): Promise<SinkMessage[]> {
  const all = (await (await fetch(`${at.server.sink}/messages`)).json()) as SinkMessage[];
  return all.filter((m) => m.to.some((address) => address.toLowerCase() === to.toLowerCase()));
}

/** A seen visit of a patient on file, with a payment that stands, and the payment. */
function paidVisit(visits: Row[], payments: Row[]): { visit: Row; payment: Row } {
  for (const payment of payments) {
    if (payment["voided"] === true) continue;
    const visit = visits.find((v) => v.id === payment["appointment_id"]);
    if (visit !== undefined && visit["patient_id"] !== null && visit["status"] === "seen") return { visit, payment };
  }
  throw new Error("the sample has no paid visit of a patient on file");
}

describe.skipIf(why !== null)(`the contract with a built Adminium${why === null ? REHEARSAL : ` — skipped: ${why}`}`, () => {
  ENGINES.forEach(([engine, available]) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      describe("a fresh install with both add-ons", () => {
        let at: Install;
        const sample = resolveSample(bundleJson as never, { now: DEMO_START, zone: DEMO_ZONE, locale: "en-US" });

        beforeAll(async () => {
          at = await start(engine, PORT_BASE, `cd_contract_${engine}`);
        }, 240_000);
        afterAll(async () => {
          await at?.server.stop();
        });

        it("installs Holiday calendars and Invoices & Receipts first, when ticked, then the app", async () => {
          await upload(at.staff, "add-ons", addOnBundle("invoices"));
          await upload(at.staff, "add-ons", addOnBundle("holiday-calendars"));
          const app = appBundle();
          await upload(at.staff, "apps", app);
          const body = { key: app.key, version: app.version, connectionId: at.connectionId };
          const plan = ok(
            await at.staff.post<{ plan: { installable: boolean; checksum: string; addOns: { key: string; need: string; checked: boolean; action: string | null; reason: Record<string, string>; features: { id: string }[] }[] } }>("/api/v1/apps/plan", body),
          ).plan;
          expect(plan.installable).toBe(true);
          expect(plan.addOns.map((a) => [a.key, a.need, a.checked, a.action]).sort()).toEqual([
            ["holiday-calendars", "suggests", true, "install"],
            ["invoices", "feature", false, "install"],
          ]);
          const invoices = plan.addOns.find((a) => a.key === "invoices")!;
          expect(invoices.reason["en-US"]).toBe("Email or print a receipt a patient can claim with");
          expect(invoices.features.map((f) => f.id)).toEqual(["insurer-receipts"]);
          const installed = ok(
            await at.staff.post<{ rules: { skipped: unknown[] }; schema: { created: string[] }; outbox: { defined: boolean }; addOns?: { installed: { key: string }[]; attached: { key: string }[] } }>("/api/v1/apps/install", {
              ...body,
              planChecksum: plan.checksum,
              addOns: [
                { key: "invoices", version: packedVersion("invoices").version },
                { key: "holiday-calendars", version: packedVersion("holiday-calendars").version },
              ],
            }),
          );
          expect(JSON.stringify(installed.rules.skipped)).toBe("[]");
          expect(installed.outbox.defined).toBe(true);
          expect(installed.addOns?.installed.map((a) => a.key).sort()).toEqual(["holiday-calendars", "invoices"]);
          await tablesOf(at);
          expect(Object.keys(at.tableIds).length).toBe(18);
          await letterhead(at);
        }, 180_000);

        it("tells the desk which add-ons are connected, and the patients' pages only that they are there", async () => {
          const desk = ok(await at.staff.get<{ addOns?: Record<string, { version: string; settings: Record<string, unknown> }> }>("/apps/clinic/staff/surface-config.json"));
          expect(Object.keys(desk.addOns ?? {}).sort()).toEqual(["holiday-calendars", "invoices"]);
          expect(desk.addOns!["invoices"]!.settings["business_name"]).toBe("Rowan Health");
          expect(desk.addOns!["holiday-calendars"]!.settings).toHaveProperty("days");
          const open = await new Caller(at.server.base).get<Record<string, unknown>>("/apps/clinic/customer/surface-config.json");
          expect(open.status).toBe(200);
          expect((open.body as { addOns?: unknown }).addOns).toEqual({ "holiday-calendars": { present: true }, invoices: { present: true } });
          expect(JSON.stringify(open.body)).not.toContain("Rowan Health");
        }, 60_000);

        it("adds the sample: every payment carries its visit's patient and kind of visit, as the demo's loader copies them", async () => {
          await addSample(at);
          const [visits, payments] = [await rows(at, "appointments"), await rows(at, "payments")];
          expect(payments.length).toBe(sample["payments"]!.length);
          for (const payment of payments) {
            const visit = visits.find((v) => v.id === payment["appointment_id"])!;
            expect([payment["patient_id"], payment["visit_type_id"]], `payment ${String(payment.id)}`).toEqual([visit["patient_id"], visit["visit_type_id"]]);
          }
          const copied = (list: Record<string, unknown>[]) => list.map((p) => [p["appointment_id"], p["patient_id"], p["visit_type_id"], Number(p["amount"])]);
          expect(copied(payments)).toEqual(copied(sample["payments"]!));
        }, 240_000);

        it("copies them onto a payment the desk takes, whatever the desk sent", async () => {
          const visits = await rows(at, "appointments");
          const owing = visits.find((v) => v["status"] === "seen" && Number(v["balance"]) > 0 && v["patient_id"] !== null)!;
          const other = visits.find((v) => v["patient_id"] !== null && v["patient_id"] !== owing["patient_id"] && v["clinician_id"] !== owing["clinician_id"])!;
          const made = ok(
            await at.staff.post<{ data: Row }>(data(at, "payments"), {
              values: { appointment_id: owing.id, amount: "1.00", method: "transfer", patient_id: other["patient_id"], visit_type_id: other["visit_type_id"], clinician_id: other["clinician_id"] },
            }),
            201,
          ).data;
          expect([made["patient_id"], made["visit_type_id"], made["clinician_id"]].map(Number)).toEqual([owing["patient_id"], owing["visit_type_id"], owing["clinician_id"]]);
          // Paid by transfer, the receipt says so in its own words.
          const drawn = await render(at, Number(made.id));
          expect(drawn.status).toBe(201);
          expect(await printed(at, drawn.body.printUrl)).toContain("Bank transfer");
        }, 60_000);

        it("draws the receipt for an insurer from the desk's door: the letterhead, the patient, the visit, who saw them, the policy, the amount — never the reason", async () => {
          const [visits, payments, patients, types, clinicians] = [await rows(at, "appointments"), await rows(at, "payments"), await rows(at, "patients"), await rows(at, "visit_types"), await rows(at, "clinicians")];
          const { visit, payment } = paidVisit(visits.filter((v) => typeof v["reason"] === "string" && v["reason"] !== "" && v["clinician_id"] !== null), payments);
          const patient = patients.find((p) => p.id === visit["patient_id"])!;
          const kind = types.find((t) => t.id === visit["visit_type_id"])!;
          const clinician = clinicians.find((c) => c.id === visit["clinician_id"])!;
          ok(await at.staff.patch(`${data(at, "patients")}/${String(patient.id)}`, { values: { policy_ref: "HM-40371102" } }));
          const first = await render(at, payment.id);
          expect(first.status, JSON.stringify(first.body).slice(0, 600)).toBe(201);
          const text = await printed(at, first.body.printUrl);
          expect(text).toContain("Rowan Health");
          expect(text).toContain("14 Rowan Street");
          expect(text).toContain(String(patient["name"]));
          expect(text).toContain(String(kind["name"]));
          expect(text).toContain(`£${Number(payment["amount"]).toFixed(2)}`);
          // The day of the visit, on the practice's clock; who saw them; the policy their insurer asks for.
          expect(text).toContain(new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: DEMO_ZONE }).format(new Date(String(visit["starts_at"]))));
          expect(text).toContain(String(clinician["name"]));
          expect(text).toContain("HM-40371102");
          // Numbered by the register, printed in the receipt series.
          expect(text).toMatch(/REC-\d+/);
          expect(text).not.toContain(String(visit["reason"]));
          // Drawn again while the payment is unchanged: the same document.
          const again = ok(await render(at, payment.id));
          expect([again.id, again.reused]).toEqual([first.body.id, true]);
          // Its file is a PDF: the text is Latin.
          const file = await at.staff.get<Buffer>(first.body.contentUrl);
          expect(file.status).toBe(200);
          expect(file.headers.get("content-type")).toContain("application/pdf");
        }, 120_000);

        it("refuses what is not this app's to draw: another kind, another table, a row that is not there", async () => {
          const payment = (await rows(at, "payments"))[0]!;
          expect((await render(at, payment.id, { kind: "invoice" })).status).toBe(404);
          expect((await render(at, payment.id, { ref: "appointments" })).status).toBe(404);
          expect((await render(at, 999_999)).status).toBe(404);
          expect((await at.staff.post("/api/v1/apps/not-an-app/documents/render", { kind: "receipt", ref: "payments", pk: { id: payment.id } })).status).toBe(404);
        }, 60_000);

        it("emails the receipt: the outbox sends it with the receipt attached", async () => {
          const [visits, payments] = [await rows(at, "appointments"), await rows(at, "payments")];
          const { visit, payment } = paidVisit(visits, payments);
          ok(await at.staff.patch(`${data(at, "patients")}/${String(visit["patient_id"])}`, { values: { email: INBOX } }));
          const queued = await queueReceipt(at, payment, visit, INBOX, "11111111-1111-4111-8111-111111111111");
          const sent = await until(async () => {
            const row = await messageRow(at, queued.id);
            return row?.["status"] === "queued" ? undefined : row;
          }, "the receipt email to be sent");
          expect([sent["status"], sent["error"]]).toEqual(["sent", null]);
          const mail = await until(async () => (await sinkFor(at, INBOX))[0], "the receipt email in the sink");
          expect(mail.subject).toBe("Your receipt from Rowan Health");
          // The receipt, as a file — beside whatever the email's own layout draws inline.
          const files = mail.attachments.filter((a) => a.related !== true);
          expect(files.map((a) => a.contentType.split(";")[0]), JSON.stringify(mail.attachments)).toEqual(["application/pdf"]);
          expect(files[0]!.size).toBeGreaterThan(1000);
        }, 180_000);

        it("switches the feature off with the add-on, and on again", async () => {
          const [visits, payments] = [await rows(at, "appointments"), await rows(at, "payments")];
          const { visit, payment } = paidVisit(visits, payments);
          const off = ok(await at.staff.patch<{ features?: { app: string; features: string[] }[] }>("/api/v1/add-ons/invoices", { attachedTo: "clinic", enabled: false }));
          expect(JSON.stringify(off.features ?? [])).toContain("insurer-receipts");
          const refused: Reply = await render(at, payment.id);
          expect([refused.status, refused.code, refused.details["addOn"]]).toEqual([409, "FEATURE_OFF", "invoices"]);
          const desk = ok(await at.staff.get<{ addOns?: Record<string, unknown> }>("/apps/clinic/staff/surface-config.json"));
          expect(Object.keys(desk.addOns ?? {})).toEqual(["holiday-calendars"]);
          // An email queued while it is off fails with the reason; it never goes without its receipt.
          const before = (await sinkFor(at, INBOX)).length;
          const queued = await queueReceipt(at, payment, visit, INBOX, "22222222-2222-4222-8222-222222222222");
          const failed = await until(async () => {
            const row = await messageRow(at, queued.id);
            return row?.["status"] === "queued" ? undefined : row;
          }, "the receipt email to fail");
          expect(failed["status"]).toBe("failed");
          expect(String(failed["error"])).toMatch(/receipt is not available/i);
          expect((await sinkFor(at, INBOX)).length).toBe(before);
          // Back on: drawn again, and the failed email goes when queued again.
          ok(await at.staff.patch("/api/v1/add-ons/invoices", { attachedTo: "clinic", enabled: true }));
          expect((await render(at, payment.id)).status).toBeLessThan(300);
          // Queued again as the desk's "Send again" does: the status alone — why it failed is Adminium's to write.
          ok(await at.staff.patch(`${data(at, "messages")}/${String(queued.id)}`, { values: { status: "queued" } }));
          const resent = await until(async () => {
            const row = await messageRow(at, queued.id);
            return row?.["status"] === "queued" ? undefined : row;
          }, "the receipt email to go once queued again");
          expect(resent["status"]).toBe("sent");
        }, 240_000);

        it("lets nothing anonymous reach a receipt: no patients'-page door opens payments or documents, and a print copy needs a session", async () => {
          ok(await at.staff.put("/api/v1/public-api", { enabled: true }));
          const config = ok(await new Caller(at.server.base).get<{ publishableKey: string }>("/apps/clinic/customer/surface-config.json"));
          const guest = new Caller(at.server.base, { authorization: `Bearer ${config.publishableKey}`, origin: at.server.base });
          const refs = ok(await guest.get<{ data: { refs: Record<string, unknown> } }>("/api/v1/public/config")).data.refs;
          const opened = Object.keys(refs);
          expect(opened.length).toBeGreaterThan(0);
          expect(opened.filter((ref) => ref.includes("payments") || ref.includes("messages"))).toEqual([]);
          expect(JSON.stringify(refs)).not.toContain('"documents"');
          const payment = (await rows(at, "payments"))[0]!;
          const reply = await render(at, payment.id);
          expect(reply.status).toBeLessThan(300);
          const drawn = reply.body;
          const stranger = new Caller(at.server.base);
          expect((await stranger.get(drawn.printUrl)).status).toBe(401);
          expect((await stranger.get(drawn.contentUrl)).status).toBe(401);
          expect((await guest.get(drawn.printUrl)).status).toBe(401);
          expect((await stranger.post("/api/v1/apps/clinic/documents/render", { kind: "receipt", ref: "payments", pk: { id: payment.id } })).status).toBe(401);
        }, 120_000);

        it("removes the sample, keeping the payment the desk took and the emails it sent", async () => {
          const plan = ok(await at.staff.post<{ total: number }>("/api/v1/apps/clinic/sample-data/remove-plan"));
          expect(plan.total).toBeGreaterThan(0);
          const removed = await at.staff.post<{ removed: number; kept: number }>("/api/v1/apps/clinic/sample-data/remove", { keepChanged: true });
          expect(removed.status, JSON.stringify(removed.body).slice(0, 800)).toBe(200);
          expect(removed.body.removed).toBeGreaterThan(0);
          expect((await rows(at, "messages")).filter((m) => m["kind"] === "receipt").length).toBe(2);
          expect(ok(await at.staff.get<{ loaded: boolean }>("/api/v1/apps/clinic/sample-data")).loaded).toBe(false);
        }, 180_000);
      });

      describe.skipIf(!releasedReadable())("the update a practice on 0.2.0 makes", () => {
        let at: Install;

        beforeAll(async () => {
          at = await start(engine, PORT_BASE + 4, `cd_contract_up_${engine}`);
        }, 240_000);
        afterAll(async () => {
          await at?.server.stop();
        });

        it("installs the released 0.2.0 with its sample, then updates it with Holiday calendars: the links added to tables that hold rows", async () => {
          const released = appBundle(RELEASED);
          expect(released.version).toBe("0.2.0");
          await upload(at.staff, "apps", released);
          const body = { key: "clinic", version: "0.2.0", connectionId: at.connectionId };
          const plan = ok(await at.staff.post<{ plan: { installable: boolean; checksum: string } }>("/api/v1/apps/plan", body)).plan;
          ok(await at.staff.post("/api/v1/apps/install", { ...body, planChecksum: plan.checksum }));
          await tablesOf(at);
          await addSample(at);
          const before = await rows(at, "payments");
          expect(before.length).toBeGreaterThan(0);
          expect(before[0]).not.toHaveProperty("patient_id");

          await upload(at.staff, "add-ons", addOnBundle("invoices"));
          await upload(at.staff, "add-ons", addOnBundle("holiday-calendars"));
          const next = appBundle();
          await upload(at.staff, "apps", next);
          // Invoices & Receipts left out for now: the practice connects it later.
          const updated = await at.staff.post<{ from: string; to: string; app: { addOns?: { installed: { key: string }[] } } }>("/api/v1/apps/clinic/update", {
            addOns: [{ key: "holiday-calendars", version: packedVersion("holiday-calendars").version }],
          });
          // On every engine, SQLite included: the tables with a unique column are rebuilt in place.
          expect(updated.status, JSON.stringify(updated.body).slice(0, 1500)).toBe(200);
          expect([updated.body.from, updated.body.to]).toEqual(["0.2.0", next.version]);
          expect(updated.body.app.addOns?.installed.map((a) => a.key)).toEqual(["holiday-calendars"]);
          await tablesOf(at);
          // The rows 0.2.0 wrote: the new links are there, empty — nothing fills an old row.
          const after = await rows(at, "payments");
          expect(after.length).toBe(before.length);
          expect(after.every((p) => p["patient_id"] === null && p["visit_type_id"] === null)).toBe(true);
        }, 360_000);

        it("switches the receipt on when Invoices & Receipts is connected after the update", async () => {
          const payment = (await rows(at, "payments"))[0]!;
          expect([(await render(at, payment.id)).status, (await render(at, payment.id)).code]).toEqual([409, "FEATURE_OFF"]);
          ok(await at.staff.post("/api/v1/add-ons", { key: "invoices", version: packedVersion("invoices").version, attachTo: ["clinic"] }));
          await letterhead(at);
          const desk = ok(await at.staff.get<{ addOns?: Record<string, unknown> }>("/apps/clinic/staff/surface-config.json"));
          expect(Object.keys(desk.addOns ?? {}).sort()).toEqual(["holiday-calendars", "invoices"]);
          expect((await render(at, payment.id)).status).toBe(201);
        }, 120_000);

        it("draws a receipt for a payment taken before the update, without the patient it does not name, and one taken after, with it", async () => {
          const [visits, payments, patients] = [await rows(at, "appointments"), await rows(at, "payments"), await rows(at, "patients")];
          const { visit, payment } = paidVisit(visits, payments);
          const patient = patients.find((p) => p.id === visit["patient_id"])!;
          const old = await render(at, payment.id);
          expect(old.status, JSON.stringify(old.body).slice(0, 600)).toBeLessThan(300);
          const oldText = await printed(at, old.body.printUrl);
          expect(oldText).toContain(`£${Number(payment["amount"]).toFixed(2)}`);
          // Taken before the payment carried its patient: the receipt names nobody.
          expect(oldText).not.toContain(String(patient["name"]));

          const owing = visits.find((v) => v["status"] === "seen" && Number(v["balance"]) > 0 && v["patient_id"] !== null)!;
          const owner = patients.find((p) => p.id === owing["patient_id"])!;
          const taken = ok(await at.staff.post<{ data: Row }>(data(at, "payments"), { values: { appointment_id: owing.id, amount: "1.00", method: "card" } }), 201).data;
          expect(Number(taken["patient_id"])).toBe(owing["patient_id"]);
          const fresh = await render(at, Number(taken.id));
          expect(fresh.status).toBe(201);
          expect(await printed(at, fresh.body.printUrl)).toContain(String(owner["name"]));
        }, 120_000);

        it("emails the receipt of a payment taken after the update, with the receipt attached", async () => {
          const [visits, payments] = [await rows(at, "appointments"), await rows(at, "payments")];
          const payment = payments.filter((p) => p["patient_id"] !== null).at(-1)!;
          const visit = visits.find((v) => v.id === payment["appointment_id"])!;
          ok(await at.staff.patch(`${data(at, "patients")}/${String(visit["patient_id"])}`, { values: { email: INBOX } }));
          const queued = await queueReceipt(at, payment, visit, INBOX, "33333333-3333-4333-8333-333333333333");
          const sent = await until(async () => {
            const row = await messageRow(at, queued.id);
            return row?.["status"] === "queued" ? undefined : row;
          }, "the receipt email to be sent");
          expect([sent["status"], sent["error"]]).toEqual(["sent", null]);
          const mail = await until(async () => (await sinkFor(at, INBOX))[0], "the receipt email in the sink");
          expect(mail.attachments.filter((a) => a.related !== true).map((a) => a.contentType.split(";")[0]), JSON.stringify(mail.attachments)).toEqual(["application/pdf"]);
        }, 180_000);
      });
    });
  });
});
