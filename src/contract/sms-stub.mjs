/**
 * Preloaded into the contract's Adminium (`node --import`) when
 * `CLINIC_SMS_LOG` names a file: Telnyx's API, answered here, so a text the
 * practice's Adminium sends goes the whole way through its send path and stops
 * at a provider that is not real. Nothing leaves the machine and nothing is
 * billed.
 *
 * It answers the three calls Adminium makes to Telnyx — the messaging profile
 * (connecting the account), the number's profile (saving the sender) and a
 * message (a send) — and appends each message to the log file as one JSON
 * line (`to`, `from`, `text`). Every other address goes to the real `fetch`.
 *
 * Tests only. The key, the profile and the number are the contract's own
 * test values.
 */
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const LOG = process.env.CLINIC_SMS_LOG ?? "";
const PROFILE = process.env.CLINIC_SMS_PROFILE ?? "";
const NUMBER = process.env.CLINIC_SMS_NUMBER ?? "";

if (LOG !== "") {
  const real = globalThis.fetch;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async function stubbedFetch(input, init) {
    const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url);
    if (url.hostname !== "api.telnyx.com") return real(input, init);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === `/v2/messaging_profiles/${PROFILE}`) return json(200, { data: { id: PROFILE, name: "Clinic contract", enabled: true } });
    if (method === "GET" && url.pathname === "/v2/phone_numbers/messaging") return json(200, { data: [{ phone_number: NUMBER, messaging_profile_id: PROFILE }] });
    if (method === "POST" && url.pathname === "/v2/messages") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const id = randomUUID();
      appendFileSync(LOG, `${JSON.stringify({ id, to: body.to, from: body.from ?? null, text: body.text, at: new Date().toISOString() })}\n`);
      return json(200, { data: { id, to: [{ phone_number: body.to, status: "queued" }], parts: 1 } });
    }
    return json(404, { errors: [{ code: "10005", title: "Not found on the contract's stub" }] });
  };
  process.stderr.write("[contract sms] Telnyx is answered by the contract's stub\n");
}
