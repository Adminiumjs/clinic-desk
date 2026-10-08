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
 *   8. a patient's booking, through the patients' pages' own port and the
 *      real public client: the free times and days exactly as the demo's own
 *      rule answers them on the same rows; a first visit booked by someone
 *      not on file, and a taken time, a time outside the hours, a closed day
 *      and a clinician who does not offer the visit each refused with the
 *      code and reason the page words; the claim by mobile and date of
 *      birth, the emailed code, and the found patient's own visits; a
 *      booking, a move and a cancel within the rules (the limit of two, too
 *      late to move, a late cancel flagged); and the stop on someone who
 *      keeps guessing;
 *   9. the sample removed;
 *  10. Inventory, which this practice never installed: a visit is seen as
 *      ever and a supply line that names an item is refused, with Inventory
 *      absent and again with it installed and not connected to the app; then
 *      connected afterwards, with nothing of the app changed, a supply leaves
 *      the shelf when its visit is seen.
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
import { createPublicClient, PUBLIC_ERROR_CODES } from "@adminiumjs/public-client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import bundleJson from "../../seeds/clinic.sample.json";
import { PortError, type PatientsPort, type SlotTime } from "../data/ports.ts";
import { instantOf, publicPatientsPort } from "../data/publicPatients.ts";
import { normalise } from "../data/rows.ts";
import { resolveSample } from "../data/sampleRows.ts";
import type { Appointment, TableRef } from "../data/types.ts";
import { addDays, venueDay, venueTime } from "../data/venueTime.ts";
import { days as demoDays, slots as demoSlots, type Practice } from "../demo/booking.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { resolveSurfaceConfig } from "../publicConfig.ts";
import { addOnBundle, appBundle, boot, Caller, ENGINES, missing, ok, packedFloor, packedVersion, rehearsedAttach, RELEASED, releasedReadable, until, type Engine, type Reply, type Server } from "./harness.ts";

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
  const calendars = packedVersion("holiday-calendars");
  const attach = rehearsedAttach("holiday-calendars");
  return [
    calendars.rehearsed || attach !== null
      ? ` (the add-ons checkout's Holiday calendars, ${calendars.checkout}, packed as ${calendars.version}${attach === null ? "" : `, working with clinic ${attach.range} where it says ${attach.asked}`}: its release not yet stamped)`
      : "",
    invoices.rehearsed ? ` (the add-ons checkout's Invoices & Receipts, ${invoices.checkout}, packed as ${invoices.version}: its release not yet stamped)` : "",
    floor.rehearsed ? ` (this app's floor, ${floor.asked}, packed as the Adminium checkout's ${floor.floor}: its release not yet stamped)` : "",
  ].join("");
})();

/** The real clock, whatever `Date` is made to say. */
const realNow = () => performance.timeOrigin + performance.now();

/** What one install on one engine needs to be driven. */
interface Install {
  server: Server;
  staff: Caller;
  connectionId: string;
  tableIds: Record<string, string>;
  /** When its server's clock was set to the demo's moment (real epoch ms), to read the server's "now". */
  startedAt: number;
}

async function start(engine: Engine, port: number, database: string): Promise<Install> {
  const startedAt = realNow();
  const server = await boot(engine, port, DEMO_START, database);
  const staff = new Caller(server.base, { origin: server.base });
  await staff.signIn(ADMIN.email, ADMIN.password);
  const connections = ok(await staff.get<{ connections: { id: string; name: string }[] }>("/api/v1/connections"));
  const connectionId = connections.connections.find((c) => c.name === "northwind")!.id;
  // The practice's clock and currency, as the sample practice keeps them.
  ok(await staff.patch(`/api/v1/connections/${connectionId}`, { timezone: DEMO_ZONE, currency: "GBP" }));
  return { server, staff, connectionId, tableIds: {}, startedAt };
}

/** The server's "now": the demo's moment, run on since its clock was set. */
const serverNow = (at: Install) => DEMO_START + (realNow() - at.startedAt);
/**
 * A patient's browser on the practice's clock, as a real one shares the real
 * server's: the public client keeps its claim session by `Date.now()`, and a
 * session the server set to expire in July would read as long ended in a
 * process on today's date. `Date` alone is moved, and it runs on.
 */
const onPracticeClock = (at: Install) => vi.useFakeTimers({ now: serverNow(at), toFake: ["Date"], shouldAdvanceTime: true });

/** The refusal a patient's action met, as the patients' pages hold it. */
async function refusal(run: () => Promise<unknown>): Promise<PortError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof PortError) return error;
    throw error;
  }
  throw new Error("expected a refusal, and it went through");
}

/** A patient's time as the page shows it: the server's desk-only `resource` is not the page's. */
const shown = (list: SlotTime[]) => list.map((s) => ({ time: s.time, state: s.state }));

/** The practice as the demo's booking rule reads it, from the rows the install holds. */
async function practiceOf(at: Install): Promise<Practice> {
  const [settings, hours, clinicians, links, clinicianHours, closures, appointments] = await Promise.all([
    rows(at, "settings"),
    rows(at, "opening_hours"),
    rows(at, "clinicians"),
    rows(at, "clinician_visit_types"),
    rows(at, "clinician_hours"),
    rows(at, "closures"),
    rows(at, "appointments"),
  ]);
  return { settings: (settings[0] ?? null) as never, hours: hours as never, clinicians: clinicians as never, links: links as never, clinicianHours: clinicianHours as never, closures: closures as never, appointments: appointments as never };
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
            // Offered, and not on this server: the practice runs without it, and nothing of it shows.
            ["inventory", "feature", false, null],
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
          expect(Object.keys(at.tableIds).length).toBe(19);
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

        // ── a patient's booking, through the patients' pages' own port ──────────
        // `publicPatientsPort` over the real public client, with the key and the
        // table names the customer surface serves, and the human check solved as
        // the page asks for it: what a patient's browser does. Every refusal is
        // checked as the server's code (and what it named), which the released
        // page turns into words; every code heard must be one the released
        // client knows, or the page reads it as "offline".
        const heard: string[] = [];
        const patientPort = async (): Promise<PatientsPort> => {
          const config = await resolveSurfaceConfig({ baked: {}, hostedCustomer: true, base: `${at.server.base}/apps/clinic/customer/`, origin: at.server.base });
          if (config === null) throw new Error("the patients' pages were served no key");
          const asBrowser: typeof fetch = async (input, init) => {
            const res = await fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), origin: at.server.base } });
            if (!res.ok) heard.push(((await res.clone().json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code ?? `HTTP ${String(res.status)}`);
            return res;
          };
          const client = createPublicClient({ baseUrl: config.baseUrl, publishableKey: config.publishableKey, humanCheck: true, fetch: asBrowser });
          return publicPatientsPort(client!, config.tables ?? {});
        };
        /** The practice's next working days after today, on its own clock. */
        const workingDays = (from: string, n: number): string[] => {
          const out: string[] = [];
          for (let day = addDays(from, 1); out.length < n; day = addDays(day, 1)) {
            if (![0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())) out.push(day);
          }
          return out;
        };
        const firstFree = (list: SlotTime[], after = "00:00"): string => {
          const found = list.find((s) => s.state === "free" && s.time > after);
          if (found === undefined) throw new Error(`no free time after ${after}`);
          return found.time;
        };
        let anon: PatientsPort;
        let today = "";
        let tomorrow = "";
        let later = "";

        afterAll(() => {
          vi.useRealTimers();
        });

        it("answers a patient's free times and days exactly as the demo's own booking rule does, on the same rows", async () => {
          onPracticeClock(at);
          ok(await at.staff.put("/api/v1/public-api", { enabled: true }));
          anon = await patientPort();
          expect(anon.timeZone()).toBe(DEMO_ZONE);
          const catalogue = await anon.catalogue();
          expect(catalogue.settings?.practice_name).toBe("Rowan Health");
          expect(catalogue.visitTypes.map((t) => t.id).sort()).toEqual([1, 2, 3, 4]);
          const practice = await practiceOf(at);
          today = venueDay(serverNow(at), DEMO_ZONE);
          [tomorrow, later] = workingDays(today, 2) as [string, string];
          const ask = () => ({ zone: DEMO_ZONE, now: serverNow(at), isPublic: true });
          // Each kind of visit, with anyone and with each clinician who offers it, tomorrow and the day after.
          const asks: { kind: number; resource: number | "any" }[] = [
            ...practice.links.map((l) => ({ kind: l.visit_type_id, resource: l.clinician_id })),
            ...[...new Set(practice.links.map((l) => l.visit_type_id))].map((kind) => ({ kind, resource: "any" as const })),
          ];
          let full = 0;
          for (const day of [tomorrow, later]) {
            for (const q of asks) {
              const minutes = catalogue.visitTypes.find((t) => t.id === q.kind)!.minutes;
              const served = await anon.times({ kind: q.kind, ...(q.resource === "any" ? {} : { resource: q.resource }), date: day });
              expect(shown(served), `${day} kind ${String(q.kind)} with ${String(q.resource)}`).toEqual(shown(demoSlots(practice, q.kind, minutes, day, q.resource, ask())));
              expect(served.length).toBeGreaterThan(0);
              full += served.filter((s) => s.state === "full").length;
            }
          }
          // The sample's own bookings fill some of them: the answer is not all free.
          expect(full).toBeGreaterThan(0);
          // A strip of days from today: weekends closed, the window's end closed, and each day's free count.
          for (const q of [{ kind: 1, resource: "any" as const }, { kind: 3, resource: 3 }]) {
            const minutes = catalogue.visitTypes.find((t) => t.id === q.kind)!.minutes;
            const strip = await anon.days({ kind: q.kind, ...(q.resource === "any" ? {} : { resource: q.resource }), from: today, days: 21 });
            expect(strip, `days of kind ${String(q.kind)}`).toEqual(demoDays(practice, q.kind, minutes, today, 21, q.resource, ask()));
            expect(strip.filter((d) => [0, 6].includes(new Date(`${d.date}T12:00:00Z`).getUTCDay())).every((d) => d.state === "closed")).toBe(true);
            expect(strip.at(-1)!.state).toBe("closed");
          }
          // Physiotherapy on the day Nadia is away (a closure of her own): nothing to book.
          const away = practice.closures.find((c) => c.clinician_id === 3)!.from_date;
          expect(await anon.times({ kind: 3, date: away })).toEqual([]);
        }, 120_000);

        let booked: { ref: string; starts_at: string; clinician_id: number | null };
        it("books a first visit for someone not on file: its reference, time, length and clinician, and the desk has it to check", async () => {
          const time = firstFree(await anon.times({ kind: 2, date: tomorrow }), "09:00");
          const startsAt = instantOf(tomorrow, time, DEMO_ZONE);
          const made = await anon.book({
            visit_type_id: 2,
            clinician_id: null,
            starts_at: startsAt,
            reason: "Knee pain after running",
            desk_note: null,
            language: "en-US",
            newPatient: { name: `Ada Quill ${engine}`, born_on: "1990-04-12", mobile: "07700 900601", email: null },
          });
          expect(Object.keys(made).sort()).toEqual(["clinician_id", "minutes", "ref", "starts_at", "status"]);
          expect(made).toMatchObject({ minutes: 30, status: "booked" });
          expect(Date.parse(made.starts_at)).toBe(Date.parse(startsAt));
          expect([1, 2]).toContain(made.clinician_id);
          expect(made.ref).not.toBe("");
          booked = made as typeof booked;
          // The desk's row: booked online, to check, with the details typed and no patient yet.
          const row = (await rows(at, "appointments")).find((a) => a["ref"] === made.ref)!;
          expect([row["channel"], row["check_status"], row["status"], row["patient_id"], row["new_name"], row["new_mobile"]]).toEqual(["online", "to_check", "booked", null, `Ada Quill ${engine}`, "07700 900601"]);
          // That clinician is now taken then.
          const after = await anon.times({ kind: 2, resource: made.clinician_id!, date: tomorrow });
          expect(after.find((s) => s.time === time)?.state).toBe("full");
        }, 120_000);

        it("refuses a taken time, a time outside the hours, a closed day and a clinician who does not offer the visit, as the page words them", async () => {
          const newcomer = { name: `Bo Reyes ${engine}`, born_on: "1985-09-30", mobile: "07700 900602", email: null };
          const visit = (over: Partial<{ visit_type_id: number; clinician_id: number | null; starts_at: string }>) =>
            anon.book({ visit_type_id: 2, clinician_id: booked.clinician_id, starts_at: booked.starts_at, reason: null, desk_note: null, language: "en-US", newPatient: newcomer, ...over });
          const taken = await refusal(() => visit({}));
          expect(taken.code).toBe("PUBLIC_SLOT_FULL");
          const late = await refusal(() => visit({ starts_at: instantOf(tomorrow, "18:00", DEMO_ZONE) }));
          expect([late.code, late.params["column"], late.params["reason"]]).toEqual(["PUBLIC_WRITE_REFUSED", "starts_at", "out-of-hours"]);
          const saturday = [1, 2, 3, 4, 5, 6, 7].map((n) => addDays(today, n)).find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 6)!;
          const weekend = await refusal(() => visit({ starts_at: instantOf(saturday, "10:00", DEMO_ZONE) }));
          expect([weekend.code, weekend.params["column"], weekend.params["reason"]]).toEqual(["PUBLIC_WRITE_REFUSED", "starts_at", "out-of-hours"]);
          const notOffered = await refusal(() => visit({ visit_type_id: 3, clinician_id: 1, starts_at: instantOf(later, "10:00", DEMO_ZONE) }));
          expect([notOffered.code, notOffered.params["column"], notOffered.params["reason"]]).toEqual(["PUBLIC_WRITE_REFUSED", "clinician_id", "not-offered"]);
          // None of them wrote a row.
          expect((await rows(at, "appointments")).filter((a) => a["new_name"] === newcomer.name)).toEqual([]);
          expect(heard.filter((code) => !(PUBLIC_ERROR_CODES as readonly string[]).includes(code))).toEqual([]);
        }, 120_000);

        // A patient on file with one visit booked, later today: inside the day's cancellation window.
        let patient: Row;
        let soon: Appointment;
        let own: PatientsPort;
        const CLAIM_INBOX = `claim-${engine}@rowan-contract.dev`;
        it("finds a patient by mobile and date of birth, emails a code, and shows their own visits once it is typed back", async () => {
          const [patients, visits] = [await rows(at, "patients"), (await rows(at, "appointments")) as unknown as (Appointment & Row)[]];
          const now = serverNow(at);
          const upcoming = (id: number) => visits.filter((v) => v.patient_id === id && v.status === "booked" && Date.parse(v.starts_at) > now);
          patient = patients.find((p) => {
            const mine = upcoming(p.id);
            const twin = patients.filter((q) => q["mobile"] === p["mobile"] && q["born_on"] === p["born_on"]).length > 1;
            return !twin && mine.length === 1 && Date.parse(mine[0]!.starts_at) - now > 2 * 3_600_000 && Date.parse(mine[0]!.starts_at) - now < 20 * 3_600_000;
          })!;
          expect(patient, "the sample has a patient with one visit booked later today").toBeDefined();
          soon = upcoming(patient.id)[0]!;
          ok(await at.staff.patch(`${data(at, "patients")}/${String(patient.id)}`, { values: { email: CLAIM_INBOX } }));

          own = await patientPort();
          // A wrong date of birth finds nobody, and says no more than that.
          expect(await own.find(String(patient["mobile"]), "1901-01-01")).toBeNull();
          expect(own.level()).toBeNull();
          expect(await own.find(String(patient["mobile"]), String(patient["born_on"]))).toEqual({ name: patient["name"] });
          expect(own.level()).toBe("lookup");
          // Found is not proved: their visits wait for the emailed code.
          expect((await refusal(() => own.myVisits())).code).toBe("PUBLIC_CLAIM_LEVEL");
          const sent = await own.requestCode({ purpose: "verify" });
          expect(sent.sentTo).not.toContain(CLAIM_INBOX);
          expect(sent.sentTo.charAt(0)).toBe("c");
          expect(sent.resendAfter).toBeGreaterThan(0);
          expect(sent.expiresAt).toBeGreaterThan(serverNow(at));
          expect((await refusal(() => own.requestCode({ purpose: "verify" }))).code).toBe("PUBLIC_CODE_TOO_SOON");
          const mail = await until(async () => (await sinkFor(at, CLAIM_INBOX))[0], "the code email");
          const code = /\b(\d{6})\b/.exec(`${mail.subject} ${mail.text}`)?.[1];
          expect(code, mail.text).toBeDefined();
          const wrong = await own.verifyCode(code === "000000" ? "111111" : "000000");
          expect(wrong.ok).toBe(false);
          expect(wrong.ok === false && wrong.triesLeft).toBeGreaterThan(0);
          expect(await own.verifyCode(code!)).toEqual({ ok: true, level: "verified", ended: false });
          expect(own.level()).toBe("verified");
          // Their own visits, newest first, and only theirs.
          const mine = await own.myVisits();
          expect(mine.map((v) => v.id).sort((a, b) => a - b)).toEqual(visits.filter((v) => v.patient_id === patient.id).map((v) => v.id).sort((a, b) => a - b));
          expect(Object.keys(mine[0]!).sort()).toEqual(["balance", "clinician_id", "id", "late_cancel", "minutes", "reason", "ref", "starts_at", "status", "visit_type_id"]);
          expect(await own.myDetails()).toMatchObject({ name: patient["name"], email: CLAIM_INBOX, mobile: patient["mobile"] });
        }, 180_000);

        it("books, moves and cancels as the found patient, within the rules: two at most, too late to move, a late cancel flagged", async () => {
          const time = firstFree(await own.times({ kind: 1, resource: 2, date: later }), "09:00");
          const made = await own.book({ visit_type_id: 1, clinician_id: 2, starts_at: instantOf(later, time, DEMO_ZONE), reason: null, desk_note: null, language: "en-US" });
          expect(made).toMatchObject({ minutes: 15, clinician_id: 2, status: "booked" });
          const row = (await rows(at, "appointments")).find((a) => a["ref"] === made.ref)!;
          expect([row["patient_id"], row["channel"], row["check_status"], row["new_name"]]).toEqual([patient.id, "online", null, null]);
          // Two booked ahead is the most a patient may hold online.
          const third = await refusal(async () =>
            own.book({ visit_type_id: 1, clinician_id: 2, starts_at: instantOf(later, firstFree(await own.times({ kind: 1, resource: 2, date: later }), time), DEMO_ZONE), reason: null, desk_note: null, language: "en-US" }),
          );
          expect(third.code).toBe("PUBLIC_LIMIT_REACHED");
          // Moved to another time that day: the room follows it.
          const to = firstFree(await own.times({ kind: 1, resource: 2, date: later, exclude: row.id }), time);
          const moved = await own.reschedule(row.id, instantOf(later, to, DEMO_ZONE));
          expect([venueTime(Date.parse(moved.starts_at), DEMO_ZONE), moved.status]).toEqual([to, "booked"]);
          const stranger = await (await patientPort()).times({ kind: 1, resource: 2, date: later });
          expect([stranger.find((s) => s.time === time)?.state, stranger.find((s) => s.time === to)?.state]).toEqual(["free", "full"]);
          // Its own time is not counted against the patient moving it.
          expect((await own.times({ kind: 1, resource: 2, date: later, exclude: row.id })).find((s) => s.time === to)?.state).toBe("free");
          // The visit later today is inside the window: moving it is refused, and it stands.
          const tooLate = await refusal(() => own.reschedule(soon.id, instantOf(later, time, DEMO_ZONE)));
          expect(tooLate.code).toBe("PUBLIC_TOO_LATE");
          expect((await rows(at, "appointments")).find((a) => a.id === soon.id)!["starts_at"]).toBe(soon.starts_at);
          // Cancelled inside the window: never refused, flagged late. Outside it: not.
          const lateCancel = await own.cancel(soon.id);
          expect([lateCancel.status, lateCancel.late_cancel]).toEqual(["cancelled", true]);
          const onTime = await own.cancel(row.id);
          expect([onTime.status, onTime.late_cancel]).toEqual(["cancelled", false]);
          // Signed out: nothing of theirs is shown any more — their visits' door is, to this page, not there.
          await own.signOut();
          expect(own.level()).toBeNull();
          expect((await refusal(() => own.myVisits())).code).toBe("PUBLIC_REF_NOT_FOUND");
        }, 180_000);

        it("stops someone who keeps guessing at a patient, and says so in a code the page knows", async () => {
          const guesser = await patientPort();
          let stopped: PortError | undefined;
          for (let tries = 0; tries < 12 && stopped === undefined; tries += 1) {
            try {
              expect(await guesser.find(String(patient["mobile"]), `1950-01-${String(10 + tries)}`)).toBeNull();
            } catch (error) {
              if (!(error instanceof PortError)) throw error;
              stopped = error;
            }
          }
          expect(stopped, "a guesser is stopped within a dozen wrong guesses").toBeDefined();
          // The finding door's own limit: the page tells them to wait, not that they are unknown.
          expect(stopped!.code).toBe("PUBLIC_RATE_LIMITED");
          expect(heard.filter((code) => !(PUBLIC_ERROR_CODES as readonly string[]).includes(code))).toEqual([]);
          vi.useRealTimers();
        }, 180_000);

        it("removes the sample, keeping the payment the desk took and the emails it sent", async () => {
          const plan = ok(await at.staff.post<{ total: number }>("/api/v1/apps/clinic/sample-data/remove-plan"));
          expect(plan.total).toBeGreaterThan(0);
          const removed = await at.staff.post<{ removed: number; kept: number }>("/api/v1/apps/clinic/sample-data/remove", { keepChanged: true });
          expect(removed.status, JSON.stringify(removed.body).slice(0, 800)).toBe(200);
          expect(removed.body.removed).toBeGreaterThan(0);
          expect((await rows(at, "messages")).filter((m) => m["kind"] === "receipt").length).toBe(2);
          expect(ok(await at.staff.get<{ loaded: boolean }>("/api/v1/apps/clinic/sample-data")).loaded).toBe(false);
        }, 180_000);

        /*
         * INVENTORY, WHICH THIS PRACTICE NEVER INSTALLED. Everything above ran
         * without it: the desk is the desk it was. What is left to say is what
         * the server does with the new table while its add-on is not there —
         * and that connecting Inventory later needs nothing of the app.
         */
        type Line = { data: Row; postings?: { ledger: string; state: string }[] };
        let kept: Row;
        const lines = () => `/api/v1/data/${at.connectionId}/${encodeURIComponent(at.tableIds["appointment_supplies"]!)}`;
        const moveTo = (status: string) => at.staff.patch<Line>(`${data(at, "appointments")}/${String(kept.id)}`, { values: { status } });
        const inert = async (itemId: number) => {
          // A line always says what was used: one with no item is no line.
          const empty = await at.staff.post(lines(), { values: { appointment_id: kept.id, qty: "1" } });
          expect([empty.status, empty.code]).toEqual([422, "VALIDATION_FAILED"]);
          // A row can never name an item of an add-on that is not here for this app.
          const dead = await at.staff.post(lines(), { values: { appointment_id: kept.id, item_id: itemId, qty: "1" } });
          expect([dead.status, dead.code, dead.details["reason"]]).toEqual([409, "POSTING_REFUSED", "add-on-unavailable"]);
          // A visit is seen as it always was: nothing is asked, nothing refused, nothing posted.
          ok(await moveTo("ready"));
          const sent = await moveTo("seen");
          expect([sent.status, sent.body.postings ?? []], JSON.stringify(sent.body).slice(0, 600)).toEqual([200, []]);
        };

        it("without Inventory on the server: a visit is seen as ever, and a supply line that names an item is refused", async () => {
          await tablesOf(at);
          kept = (await rows(at, "appointments")).find((v) => v["status"] === "seen")!;
          expect(kept).toBeDefined();
          await inert(1);
          const desk = ok(await at.staff.get<{ addOns?: Record<string, unknown> }>("/apps/clinic/staff/surface-config.json"));
          expect(Object.keys(desk.addOns ?? {})).not.toContain("inventory");
        }, 120_000);

        it("with Inventory installed and not connected to this app: the same, to the letter", async () => {
          await upload(at.staff, "add-ons", addOnBundle("inventory"));
          const installed = await at.staff.post("/api/v1/add-ons", { key: "inventory", version: packedVersion("inventory").version, attachTo: [] });
          expect(installed.status, JSON.stringify(installed.body).slice(0, 1200)).toBeLessThan(300);
          ok(await at.staff.post("/api/v1/add-ons/inventory/sample-data"));
          await until(async () => (ok(await at.staff.get<{ loaded: boolean }>("/api/v1/add-ons/inventory/sample-data")).loaded ? true : undefined), "Inventory's sample to be added");
          const schema = ok(await at.staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${at.connectionId}/schema`));
          const items = ok(await at.staff.get<{ data: Row[] }>(`/api/v1/data/${at.connectionId}/${encodeURIComponent(schema.model.tables.find((t) => t.name === "inventory_items")!.id)}?limit=200`)).data;
          // A real item of an Inventory that is on the server — and still not this app's to name.
          await inert(Number(items.find((item) => item["sku"] === "SWAB-ALC")!.id));
          const desk = ok(await at.staff.get<{ addOns?: Record<string, unknown> }>("/apps/clinic/staff/surface-config.json"));
          expect(Object.keys(desk.addOns ?? {})).not.toContain("inventory");
        }, 300_000);

        it("connects Inventory to the app afterwards, with nothing of the app changed: the desk is told, and a supply leaves the shelf when its visit is seen", async () => {
          // Nothing could be recorded while it was away, so nothing waits to trip the first visit seen with it.
          expect((await rows(at, "appointment_supplies")).length).toBe(0);
          const attached = await at.staff.post("/api/v1/add-ons/inventory/attachments", { app: "clinic", connectionId: at.connectionId });
          expect(attached.status, JSON.stringify(attached.body).slice(0, 1200)).toBe(200);
          const desk = ok(await at.staff.get<{ addOns?: Record<string, unknown> }>("/apps/clinic/staff/surface-config.json"));
          expect(Object.keys(desk.addOns ?? {})).toContain("inventory");
          const schema = ok(await at.staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${at.connectionId}/schema`));
          const read = async (name: string) => ok(await at.staff.get<{ data: Row[] }>(`/api/v1/data/${at.connectionId}/${encodeURIComponent(schema.model.tables.find((t) => t.name === name)!.id)}?limit=200`)).data;
          const swab = (await read("inventory_items")).find((item) => item["sku"] === "SWAB-ALC")!;
          const room = (await read("inventory_places")).find((place) => place["name"] === "Treatment room")!;
          const left = async () => Number((await read("inventory_stock_points")).find((point) => Number(point["item_id"]) === Number(swab.id) && Number(point["place_id"]) === Number(room.id))!["available"]);
          const was = await left();
          ok(await moveTo("ready"));
          ok(await at.staff.post(lines(), { values: { appointment_id: kept.id, item_id: swab.id, qty: "2", place_id: room.id } }), 201);
          const sent = await moveTo("seen");
          expect(sent.status, JSON.stringify(sent.body).slice(0, 1200)).toBe(200);
          expect((sent.body.postings ?? []).map((posting) => [posting.ledger, posting.state])).toEqual([["stock", "ok"]]);
          expect(await left()).toBe(was - 2);
        }, 300_000);
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
