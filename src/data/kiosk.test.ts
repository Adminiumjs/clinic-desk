/**
 * The kiosk's port: every refusal the server can answer becomes one plain
 * outcome and one sentence, and the whole check-in keeps its promises — a
 * fresh find for every press, a stale find renewed before the check-in, the
 * person forgotten afterwards, and a check-in that stands even when its
 * thank-you cannot read the time.
 */
import { PublicApiError, type PublicClient, type PublicConfig } from "@adminiumjs/public-client";
import { describe, expect, it, vi } from "vitest";

import { noteLook, type KioskNote } from "../screens/kiosk/logic.ts";
import {
  KioskError,
  REFIND_MARGIN_MS,
  firstNameOf,
  kioskErrorOf,
  kioskRefsOf,
  outcomeOfStop,
  publicKioskPort,
  runCheckIn,
  staffSignOut,
  unavailableKioskPort,
  type KioskPort,
  type KioskVisit,
} from "./kiosk.ts";

const AT = "2026-07-28T10:15:00.000Z";
const FROM = "2026-07-28T09:15:00.000Z";

describe("every refusal, as the kiosk says it", () => {
  const cases: [code: string, params: Record<string, unknown> | undefined, outcome: string, sentence: string | null][] = [
    ["PUBLIC_KEY_OFF", undefined, "off", null],
    ["PUBLIC_STAFF_REQUIRED", undefined, "signedOut", "kiosk.msg.signedOut"],
    ["PUBLIC_RATE_LIMITED", undefined, "busy", "kiosk.msg.busy"],
    ["PUBLIC_NETWORK_UNAVAILABLE", undefined, "offline", "kiosk.msg.offline"],
    ["PUBLIC_UPSTREAM_UNAVAILABLE", undefined, "offline", "kiosk.msg.offline"],
    ["PUBLIC_TOO_EARLY", { at: AT, from: FROM }, "early", "kiosk.msg.early"],
    // A refusal that names no time cannot say when to come back.
    ["PUBLIC_TOO_EARLY", undefined, "notfound", "kiosk.msg.notfound"],
    ["PUBLIC_REF_NOT_FOUND", undefined, "notfound", "kiosk.msg.notfound"],
    ["PUBLIC_KEY_INVALID", undefined, "gone", "kiosk.msg.gone"],
    ["PUBLIC_ORIGIN_REFUSED", undefined, "gone", "kiosk.msg.gone"],
    ["APP_DISABLED", undefined, "gone", "kiosk.msg.gone"],
    ["SURFACE_OFF", undefined, "gone", "kiosk.msg.gone"],
    ["PUBLIC_WRITE_REFUSED", undefined, "gone", "kiosk.msg.gone"],
    ["SOMETHING_NEW", undefined, "gone", "kiosk.msg.gone"],
  ];
  it.each(cases)("%s → %s", (code, params, outcome, sentence) => {
    const error = new PublicApiError(code as never, 400, "from the server", undefined, params);
    const result = outcomeOfStop(kioskErrorOf(error));
    expect(result.kind).toBe(outcome);
    if (sentence === null) return;
    expect(noteLook(result as KioskNote).key).toBe(sentence);
  });

  it("carries the visit's time and the window's opening on an early refusal", () => {
    const early = kioskErrorOf(new PublicApiError("PUBLIC_TOO_EARLY", 409, "early", undefined, { at: AT, from: FROM }));
    expect(early).toMatchObject({ stop: "tooEarly", at: AT, from: FROM });
    expect(outcomeOfStop(early)).toEqual({ kind: "early", at: AT, from: FROM });
  });

  it("reads a refusal by its shape, as the demo raises it", () => {
    expect(kioskErrorOf({ code: "PUBLIC_TOO_EARLY", params: { at: AT, from: FROM } })).toMatchObject({ stop: "tooEarly", at: AT });
    expect(kioskErrorOf({ code: "PUBLIC_KEY_OFF" }).stop).toBe("off");
    expect(kioskErrorOf(new TypeError("fetch failed")).stop).toBe("gone");
    expect(kioskErrorOf(null).stop).toBe("gone");
  });

  it("says the fields are wrong only when they are what is wrong", () => {
    expect(noteLook({ kind: "empty" })).toMatchObject({ key: "kiosk.msg.empty", invalid: true, tone: "warn" });
    expect(noteLook({ kind: "notfound" }).invalid).toBe(true);
    expect(noteLook({ kind: "already" })).toMatchObject({ invalid: false, tone: "info" });
    expect(noteLook({ kind: "early", at: AT, from: FROM })).toMatchObject({ invalid: false, tone: "info" });
    expect(noteLook({ kind: "signedOut" }).invalid).toBe(false);
  });
});

// ── the whole check-in, over a port that answers as told ─────────────────────

interface Script {
  found?: { name: string } | null;
  visits?: KioskVisit[][];
  checkIn?: (id: string) => void;
  begun?: () => { id: string; starts_at: string; clinician_id: string | null }[];
  expiresAt?: () => number | null;
}

function fakePort(script: Script) {
  const calls: string[] = [];
  let reads = 0;
  const port: KioskPort = {
    practice: async () => null,
    probe: async () => undefined,
    claim: async () => {
      calls.push("claim");
      return script.found === undefined ? { name: "Cormac Ellery" } : script.found;
    },
    expiresAt: () => (script.expiresAt ?? (() => NOW + 180_000))(),
    visits: async () => {
      calls.push("visits");
      const all = script.visits ?? [[{ id: "7", status: "booked" }]];
      return all[Math.min(reads++, all.length - 1)]!;
    },
    checkIn: async (id) => {
      calls.push(`checkIn ${id}`);
      script.checkIn?.(id);
    },
    begun: async () => (script.begun ?? (() => [{ id: "7", starts_at: "2026-07-28T08:00:00.000Z", clinician_id: "3" }]))(),
    clinicians: async () => [{ id: "3", short_name: "Nadia" }],
    forget: () => calls.push("forget"),
    leave: async () => undefined,
  };
  return { port, calls };
}

const NOW = Date.parse("2026-07-28T08:20:00.000Z");
const run = (port: KioskPort) => runCheckIn(port, { mobile: "07700 900164", bornOn: "1968-10-02" }, () => NOW);
const earlyAt = (at: string, from: string) => () => {
  throw new PublicApiError("PUBLIC_TOO_EARLY", 409, "early", undefined, { at, from });
};

describe("a check-in", () => {
  it("thanks the person by their first name, with the time and the clinician", async () => {
    const { port, calls } = fakePort({});
    expect(await run(port)).toEqual({ kind: "done", firstName: "Cormac", at: "2026-07-28T08:00:00.000Z", clinician: "Nadia" });
    expect(calls).toEqual(["forget", "claim", "visits", "checkIn 7", "forget"]);
  });

  it("finds nobody → not found, and forgets the attempt", async () => {
    const { port, calls } = fakePort({ found: null });
    expect(await run(port)).toEqual({ kind: "notfound" });
    expect(calls.at(-1)).toBe("forget");
  });

  it("no visit today (or only cancelled ones, which the read leaves out) → not found", async () => {
    const { port } = fakePort({ visits: [[]] });
    expect(await run(port)).toEqual({ kind: "notfound" });
  });

  it("every visit today already begun → already checked in", async () => {
    const { port, calls } = fakePort({ visits: [[{ id: "7", status: "checked_in" }, { id: "8", status: "ready" }]] });
    expect(await run(port)).toEqual({ kind: "already" });
    expect(calls.some((c) => c.startsWith("checkIn"))).toBe(false);
  });

  it("more than the window ahead → early, with the visit's time and from when", async () => {
    const { port } = fakePort({ checkIn: earlyAt(AT, FROM) });
    expect(await run(port)).toEqual({ kind: "early", at: AT, from: FROM });
  });

  it("two booked today: the later one early, the earlier one checks in", async () => {
    const { port, calls } = fakePort({
      visits: [[{ id: "9", status: "booked" }, { id: "7", status: "booked" }]],
      checkIn: (id) => (id === "9" ? earlyAt("2026-07-28T14:00:00.000Z", "2026-07-28T13:00:00.000Z")() : undefined),
    });
    expect((await run(port)).kind).toBe("done");
    expect(calls).toContain("checkIn 9");
    expect(calls).toContain("checkIn 7");
  });

  it("two booked, both early → the earlier time is the one said", async () => {
    const { port } = fakePort({
      visits: [[{ id: "9", status: "booked" }, { id: "7", status: "booked" }]],
      checkIn: (id) => (id === "9" ? earlyAt("2026-07-28T14:00:00.000Z", "2026-07-28T13:00:00.000Z")() : earlyAt(AT, FROM)()),
    });
    expect(await run(port)).toEqual({ kind: "early", at: AT, from: FROM });
  });

  it("another tablet was a second ahead: the miss re-reads and says already", async () => {
    const { port, calls } = fakePort({
      visits: [[{ id: "7", status: "booked" }], [{ id: "7", status: "checked_in" }]],
      checkIn: () => {
        throw new PublicApiError("PUBLIC_REF_NOT_FOUND", 404, "No such record.");
      },
    });
    expect(await run(port)).toEqual({ kind: "already" });
    expect(calls.filter((c) => c === "visits")).toHaveLength(2);
  });

  it("a miss whose re-read is empty → not found", async () => {
    const { port } = fakePort({
      visits: [[{ id: "7", status: "booked" }], []],
      checkIn: () => {
        throw new PublicApiError("PUBLIC_REF_NOT_FOUND", 404, "No such record.");
      },
    });
    expect(await run(port)).toEqual({ kind: "notfound" });
  });

  it("finds the person again when the find is about to end, before checking in", async () => {
    const { port, calls } = fakePort({ expiresAt: () => NOW + REFIND_MARGIN_MS - 1 });
    expect((await run(port)).kind).toBe("done");
    expect(calls).toEqual(["forget", "claim", "visits", "claim", "checkIn 7", "forget"]);
  });

  it("a fresh find is not repeated", async () => {
    const { port, calls } = fakePort({ expiresAt: () => NOW + REFIND_MARGIN_MS + 1 });
    await run(port);
    expect(calls.filter((c) => c === "claim")).toHaveLength(1);
  });

  it("switched off mid-way → off, and the person is still forgotten", async () => {
    const { port, calls } = fakePort({
      checkIn: () => {
        throw new PublicApiError("PUBLIC_KEY_OFF", 503, "off");
      },
    });
    expect(await run(port)).toEqual({ kind: "off" });
    expect(calls.at(-1)).toBe("forget");
  });

  it("the check-in stands when its thank-you cannot read the time", async () => {
    const { port } = fakePort({
      begun: () => {
        throw new Error("read failed");
      },
    });
    expect(await run(port)).toEqual({ kind: "done", firstName: "Cormac", at: null, clinician: null });
  });

  it("greets by the first word of the name", () => {
    expect(firstNameOf("  Cormac  Ellery ")).toBe("Cormac");
    expect(firstNameOf("王伟")).toBe("王伟");
    expect(firstNameOf("")).toBe("");
  });
});

// ── over the public client ──────────────────────────────────────────────────

const CONFIG: PublicConfig = {
  version: 1,
  side: "customer",
  timezone: "Europe/London",
  currency: null,
  claim: { strategy: "lookup", ref: "clinic_patients_claimed", match: ["mobile", "born_on"] },
  refs: {
    clinic_patients_claimed: { actions: ["read"], expose: ["name"], filterable: [], searchable: [], orderable: [], writable: [], limit: 50 },
    clinic_appointments_claimed: { actions: ["read", "update"], expose: ["id", "status"], filterable: [], searchable: [], orderable: [], writable: ["status"], limit: 50 },
    clinic_appointments_claimed_2: { actions: ["read"], expose: ["id", "starts_at", "clinician_id"], filterable: [], searchable: [], orderable: [], writable: [], limit: 50 },
    clinic_clinicians: { actions: ["read"], expose: ["id", "short_name", "role_label", "color"], filterable: [], searchable: [], orderable: [], writable: [], limit: 50 },
  },
};
const TABLES = { patients: "clinic_patients", appointments: "clinic_appointments", clinicians: "clinic_clinicians" };

function fakeClient(config: () => Promise<PublicConfig>) {
  const update = vi.fn(async () => ({}));
  const list = vi.fn(async (ref: string) => ({
    data: ref === "clinic_appointments_claimed" ? [{ id: 7, status: "booked" }] : ref === "clinic_patients_claimed" ? [{ name: "Cormac Ellery" }] : [{ id: 3, short_name: "Nadia" }],
  }));
  const client = { config, list, update, claim: vi.fn(async () => true), session: () => ({ level: "lookup", expiresAt: 1 }), isClaimed: () => true, signOut: vi.fn(async () => undefined) };
  return { client: client as unknown as PublicClient, update, list };
}

describe("the kiosk over the public client", () => {
  it("tells its doors apart by what they do, whatever the install named them", () => {
    expect(kioskRefsOf(CONFIG, TABLES)).toEqual({
      identity: "clinic_patients_claimed",
      visits: "clinic_appointments_claimed",
      begun: "clinic_appointments_claimed_2",
      clinicians: "clinic_clinicians",
      settings: null,
    });
  });

  it("says the key is not all there when a door is missing", () => {
    const { clinic_appointments_claimed_2: _gone, ...refs } = CONFIG.refs;
    expect(() => kioskRefsOf({ ...CONFIG, refs }, TABLES)).toThrow(KioskError);
  });

  it("checks in with the one value the key may write, and reads ids as text", async () => {
    const { client, update } = fakeClient(async () => CONFIG);
    const port = publicKioskPort(() => client, TABLES, async () => undefined);
    expect(await port.visits()).toEqual([{ id: "7", status: "booked" }]);
    await port.checkIn("7");
    expect(update).toHaveBeenCalledWith("clinic_appointments_claimed", "7", { status: "checked_in" });
  });

  it("started while switched off, it asks again on a new client once it is back on", async () => {
    let off = true;
    const made: number[] = [];
    const port = publicKioskPort(
      () => {
        made.push(made.length);
        const answer = off ? Promise.reject(new PublicApiError("PUBLIC_KEY_OFF", 503, "off")) : Promise.resolve(CONFIG);
        answer.catch(() => undefined);
        return fakeClient(() => answer).client;
      },
      TABLES,
      async () => undefined,
    );
    await expect(port.probe()).rejects.toMatchObject({ stop: "off" });
    off = false;
    await expect(port.probe()).resolves.toBeUndefined();
    expect(made.length).toBe(2);
  });

  it("a sign-in with no kiosk key: every door is gone, and Staff still leaves", async () => {
    const leave = vi.fn(async () => undefined);
    const port = unavailableKioskPort(leave);
    await expect(port.probe()).rejects.toMatchObject({ stop: "gone" });
    await port.leave();
    expect(leave).toHaveBeenCalled();
  });
});

describe("Staff leaves the kiosk", () => {
  it("signs out with the sign-in's token and opens the sign-in, back to this app", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const go = vi.fn();
    await staffSignOut({ csrfToken: "tok", next: "/apps/clinic/staff/", fetchImpl: fetchImpl as never, go });
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/auth/logout", expect.objectContaining({ method: "POST", headers: { "x-adminium-csrf": "tok" } }));
    expect(go).toHaveBeenCalledWith("/login?next=%2Fapps%2Fclinic%2Fstaff%2F");
  });

  it("still opens the sign-in when the sign-out could not be sent", async () => {
    const go = vi.fn();
    await staffSignOut({ csrfToken: null, next: "/", fetchImpl: (async () => Promise.reject(new TypeError("offline"))) as never, go });
    expect(go).toHaveBeenCalledWith("/login?next=%2F");
  });
});
