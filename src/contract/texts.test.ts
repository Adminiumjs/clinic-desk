/**
 * CLINIC DESK'S TEXTS WITH A BUILT ADMINIUM, ON EVERY ENGINE, through a
 * provider that answers like Telnyx (`sms-stub.mjs`, preloaded into the
 * server): the practice connects it as an owner does, and every text the
 * practice's Adminium sends stops at the stub, which keeps it.
 *
 * What this proves, end to end:
 *   - texts set up: the patients' pages draw the box (`textsReady`);
 *   - a verified patient's "Remind me by text" is their yes, kept by Adminium;
 *   - a patient who answers a reminder with a symptom gets the one fixed
 *     "not read" answer, naming the practice by its NAME FOR TEXTS ("RH Desk"),
 *     never the name its emails are signed with ("Rowan Health"), and nothing
 *     of what they wrote is said back;
 *   - a STOP gets one confirmation, by the same name for texts; their Prefs
 *     then read "stopped, lifted by START", and their own fresh yes does not
 *     lift it.
 *
 * MOCKED, AND SAID SO: the provider (the stub), and the server's public https
 * address (a name stored for it; the provider's calls are made here, to the
 * server's own port, signed with the key the account was connected with).
 */
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createPublicClient } from "@adminiumjs/public-client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PatientsPort } from "../data/ports.ts";
import { publicPatientsPort } from "../data/publicPatients.ts";
import { DEMO_START, DEMO_ZONE } from "../lib/clock.ts";
import { resolveSurfaceConfig } from "../publicConfig.ts";
import { appBundle, boot, Caller, ENGINES, missing, ok, until, type Engine, type Server } from "./harness.ts";

const why = missing();
if (why !== null && process.env["ADMINIUM_REQUIRE_CONTRACT"] === "1") throw new Error(`the texts contract must run here, and cannot: ${why}`);
/** After the other contracts' ports. */
const PORT_BASE = Number(process.env["CONTRACT_TEXTS_PORT_BASE"] ?? Number(process.env["CONTRACT_PORT_BASE"] ?? 4941) + 70);
const ADMIN = { email: process.env["E2E_ADMIN_EMAIL"] ?? "e2e@adminium.local", password: process.env["E2E_ADMIN_PASSWORD"] ?? "adminium-e2e-password" };
const STUB = fileURLToPath(new URL("./sms-stub.mjs", import.meta.url));
/** The contract's own provider values: a profile and a number of the stub's, never a real account. */
const PROFILE = "40017c8e-0000-4000-8000-c11c1c000001";
/** libphonenumber's own example of a UK mobile, and the next one: Adminium refuses Ofcom's 07700 900 drama range as no number. */
const NUMBER = "+447400123456";
const PATIENT_MOBILE = "07400 123457";
const INBOX = "texts-patient@rowan-contract.dev";

type Row = Record<string, unknown> & { id: number };
interface Sent {
  to: string;
  from: string | null;
  text: string;
}

const realNow = () => performance.timeOrigin + performance.now();

describe.skipIf(why !== null)("visit texts with a built Adminium and a provider that answers like Telnyx", () => {
  ENGINES.forEach(([engine, available], index) => {
    describe.skipIf(!available)(`on ${engine}`, () => {
      let server: Server;
      let staff: Caller;
      let connectionId = "";
      let startedAt = 0;
      const tableIds: Record<string, string> = {};
      const log = join(mkdtempSync(join(tmpdir(), "clinic-texts-")), "sent.jsonl");
      const keys = generateKeyPairSync("ed25519");
      const serverNow = () => DEMO_START + (realNow() - startedAt);
      const data = (ref: string) => `/api/v1/data/${connectionId}/${encodeURIComponent(tableIds[ref]!)}`;
      const rows = async (ref: string): Promise<Row[]> => ok(await staff.get<{ data: Row[] }>(`${data(ref)}?limit=200`)).data;
      const sent = (): Sent[] => (existsSync(log) ? readFileSync(log, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as Sent) : []);
      let patient: Row;
      let own: PatientsPort;
      let e164 = "";

      beforeAll(async () => {
        process.env["CLINIC_SMS_LOG"] = log;
        process.env["CLINIC_SMS_PROFILE"] = PROFILE;
        process.env["CLINIC_SMS_NUMBER"] = NUMBER;
        startedAt = realNow();
        server = await boot(engine as Engine, PORT_BASE + index * 4, DEMO_START, `cd_texts_${engine}${process.env["CONTRACT_DB_SUFFIX"] ?? ""}`, { preload: [STUB] });
        staff = new Caller(server.base, { origin: server.base });
        await staff.signIn(ADMIN.email, ADMIN.password);
        connectionId = ok(await staff.get<{ connections: { id: string; name: string }[] }>("/api/v1/connections")).connections.find((c) => c.name === "northwind")!.id;
        ok(await staff.patch(`/api/v1/connections/${connectionId}`, { timezone: DEMO_ZONE, currency: "GBP" }));
      }, 240_000);
      afterAll(async () => {
        vi.useRealTimers();
        await server?.stop();
      });

      /** A patients' page as a browser opens it, on the practice's clock. */
      const patientPort = async (): Promise<PatientsPort> => {
        const config = await resolveSurfaceConfig({ baked: {}, hostedCustomer: true, base: `${server.base}/apps/clinic/customer/`, origin: server.base });
        if (config === null) throw new Error("the patients' pages were served no key");
        const asBrowser: typeof fetch = (input, init) => fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), origin: server.base } });
        const client = createPublicClient({ baseUrl: config.baseUrl, publishableKey: config.publishableKey, humanCheck: true, fetch: asBrowser });
        return publicPatientsPort(client!, config.tables ?? {}, { baseUrl: config.baseUrl, publishableKey: config.publishableKey, fetch: asBrowser });
      };

      /** A message the provider hands the practice's Adminium, signed as Telnyx signs it. */
      const fromProvider = async (path: string, text: string): Promise<number> => {
        const body = JSON.stringify({
          data: {
            id: randomUUID(),
            event_type: "message.received",
            occurred_at: new Date(serverNow()).toISOString(),
            payload: { id: randomUUID(), messaging_profile_id: PROFILE, from: { phone_number: e164 }, to: [{ phone_number: NUMBER }], text },
          },
        });
        const timestamp = String(Math.floor(serverNow() / 1000));
        const signature = sign(null, Buffer.from(`${timestamp}|${body}`, "utf8"), keys.privateKey).toString("base64");
        const res = await fetch(`${server.base}${path}`, { method: "POST", headers: { "content-type": "application/json", "telnyx-signature-ed25519": signature, "telnyx-timestamp": timestamp }, body });
        return res.status;
      };

      it("installs the app with its sample, and the practice sends texts under a plain name", async () => {
        const app = appBundle();
        const up = await staff.post(`/api/v1/apps/upload?expectedSha512=${encodeURIComponent(app.integrity)}`, app.buffer);
        expect([200, 201], JSON.stringify(up.body).slice(0, 400)).toContain(up.status);
        const plan = ok(await staff.post<{ plan: { installable: boolean; checksum: string } }>("/api/v1/apps/plan", { key: app.key, version: app.version, connectionId })).plan;
        expect(plan.installable).toBe(true);
        ok(await staff.post("/api/v1/apps/install", { key: app.key, version: app.version, connectionId, planChecksum: plan.checksum, addOns: [] }));
        const schema = ok(await staff.get<{ model: { tables: { id: string; name: string }[] } }>(`/api/v1/connections/${connectionId}/schema`));
        for (const t of schema.model.tables.filter((one) => one.name.startsWith("clinic_"))) tableIds[t.name.slice("clinic_".length)] = t.id;
        ok(await staff.put("/api/v1/public-api", { enabled: true }));
        ok(await staff.post("/api/v1/apps/clinic/sample-data"));
        await until(async () => (ok(await staff.get<{ loaded: boolean }>("/api/v1/apps/clinic/sample-data")).loaded ? true : undefined), "the sample to be added");
        const settings = (await rows("settings"))[0]!;
        expect(settings["practice_name"]).toBe("Rowan Health");
        ok(await staff.patch(`${data("settings")}/${String(settings.id)}`, { values: { texts_on: true, text_name: "RH Desk" } }));
      }, 300_000);

      it("is set up for texts as an owner sets it up: the box shows on the patients' pages", async () => {
        // Not yet: no provider.
        expect(ok(await staff.get<{ data: { ready: boolean } }>("/api/v1/texts/ready")).data.ready).toBe(false);
        expect((await (await patientPort()).catalogue()).textsReady).toBe(false);
        ok(await staff.put("/api/v1/settings/email", { publicOrigin: "https://rowan-contract.dev" }));
        const publicKey = Buffer.from(keys.publicKey.export({ format: "jwk" }).x!, "base64url").toString("base64");
        ok(await staff.put("/api/v1/sms/account", { provider: "telnyx", apiKey: "clinic-contract-sms-key", publicKey, messagingProfileId: PROFILE }));
        ok(await staff.put("/api/v1/sms/sending", { sender: { kind: "number", value: NUMBER }, defaultCountry: "GB" }));
        expect(ok(await staff.get<{ data: { ready: boolean } }>("/api/v1/texts/ready")).data.ready).toBe(true);
        expect((await (await patientPort()).catalogue()).textsReady).toBe(true);
      }, 120_000);

      it("keeps a verified patient's yes from their Reminders page", async () => {
        const patients = await rows("patients");
        patient = patients.find((p) => patients.filter((q) => q["mobile"] === p["mobile"] && q["born_on"] === p["born_on"]).length === 1)!;
        // The sample's numbers are Ofcom's drama range, which no text can reach: the desk gives this patient a real-looking one.
        ok(await staff.patch(`${data("patients")}/${String(patient.id)}`, { values: { email: INBOX, mobile: PATIENT_MOBILE } }));
        patient = { ...patient, mobile: PATIENT_MOBILE };
        e164 = "+447400123457";
        vi.useFakeTimers({ now: serverNow(), toFake: ["Date"], shouldAdvanceTime: true });
        own = await patientPort();
        expect(await own.find(String(patient["mobile"]), String(patient["born_on"]))).not.toBeNull();
        await own.requestCode({ purpose: "verify" });
        const mail = await until(async () => {
          const all = (await (await fetch(`${server.sink}/messages`)).json()) as { to: string[]; subject: string; text: string }[];
          return all.find((m) => m.to.some((to) => to.toLowerCase() === INBOX));
        }, "the code email");
        const code = /\b(\d{6})\b/.exec(`${mail.subject} ${mail.text}`)![1]!;
        expect(await own.verifyCode(code)).toMatchObject({ ok: true, level: "verified" });
        expect((await own.myTextStanding()).service.state).toBe("not-asked");
        await own.setTexts(true);
        const standing = await own.myTextStanding();
        expect([standing.ready, standing.service.state, standing.service.answer?.source, standing.stopped]).toEqual([true, "yes", "form", null]);
      }, 180_000);

      it("sends the visit reminder text: only the practice's name for texts, the date and the time, and the way to stop", async () => {
        const visits = (await rows("appointments")).filter((v) => v["status"] === "booked");
        const visit = visits.find((v) => v["patient_id"] === patient.id) ?? visits[0]!;
        const clinician = (await rows("clinicians")).find((c) => c.id === visit["clinician_id"]);
        // Queued as the reminder scan queues it, for this patient and that visit.
        ok(await staff.post(data("messages"), { values: { kind: "reminder_text", patient_id: patient.id, appointment_id: visit.id, status: "queued", language: "en-US", due_at: visit["starts_at"], client_key: `texts-${engine}-reminder` } }), 201);
        const text = await until(async () => sent().find((m) => m.to === e164), "the reminder text at the provider");
        expect(text.from).toBe(NUMBER);
        expect(text.text.startsWith("RH Desk: your visit is on ")).toBe(true);
        // The way to stop that works for this sender now: until a signed reply has reached the server, the desk's phone
        // (Adminium cannot yet promise a STOP reply would be heard); "Reply STOP to opt out." once one has.
        expect(text.text.endsWith("To stop these texts, contact 0117 496 0142.") || text.text.endsWith("Reply STOP to opt out.")).toBe(true);
        for (const never of ["Rowan Health", String(clinician?.["name"] ?? "—"), String(clinician?.["short_name"] ?? "—"), String(visit["reason"] ?? "—")]) expect(text.text).not.toContain(never);
        // The row says how it went, as Adminium's code.
        const row = await until(async () => (await rows("messages")).find((m) => m["client_key"] === `texts-${engine}-reminder` && m["status"] === "sent"), "the reminder row sent");
        expect(row["text_reason"]).toBe("sent");
      }, 180_000);

      it("answers a symptom texted back with the one fixed answer, by the practice's name for texts, and never says it back", async () => {
        const address = ok(await staff.get<{ data: { inbound: string | null } }>("/api/v1/sms/reply-address")).data.inbound;
        expect(address, "the reply address").not.toBeNull();
        const path = new URL(address!).pathname;
        const before = sent().filter((m) => m.to === e164).length;
        expect(await fromProvider(path, "I have had a fever since Monday")).toBe(200);
        const answer = await until(async () => sent().filter((m) => m.to === e164)[before], "the not-read answer");
        expect(answer.text).toContain("RH Desk");
        expect(answer.text).not.toContain("Rowan Health");
        expect(answer.text.toLowerCase()).not.toContain("fever");
      }, 120_000);

      it("confirms a STOP once, by the same name; Prefs then say it is lifted by START, and their own yes does not lift it", async () => {
        const address = ok(await staff.get<{ data: { inbound: string | null } }>("/api/v1/sms/reply-address")).data.inbound!;
        const before = sent().length;
        expect(await fromProvider(new URL(address).pathname, "STOP PLEASE")).toBe(200);
        // Watched as the desk sees it (a staff read), then read once as their Prefs read it.
        const query = new URLSearchParams({ connection: connectionId, table: tableIds["patients"]!, row: String(patient.id), column: "mobile" });
        await until(async () => (ok(await staff.get<{ data: { stopped: unknown } }>(`/api/v1/texts/consent?${query.toString()}`)).data.stopped !== null ? true : undefined), "the STOP on the stop list");
        const standing = await own.myTextStanding();
        expect([standing.service.state, standing.stopped?.liftBy]).toEqual(["stopped", "start"]);
        const confirmation = await until(async () => sent().slice(before).find((m) => m.to === e164), "the STOP's confirmation");
        // Adminium's confirmation names no business at all ("You are unsubscribed …"): never the name the emails are signed with.
        expect(confirmation.text).not.toContain("Rowan Health");
        expect(confirmation.text.toLowerCase()).toContain("unsubscribed");
        // Their own fresh yes never lifts a STOP: only their START does.
        await own.setTexts(true);
        expect((await own.myTextStanding()).service.state).toBe("stopped");
      }, 180_000);
    });
  });
});
