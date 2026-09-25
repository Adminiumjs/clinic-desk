/**
 * The add-ons Adminium says are connected to this app and switched on, as the
 * desk's config document lists them (`addOns` in `surface-config.json`, the
 * staff side): each one's version and the settings it makes public — for
 * Invoices & Receipts, the letterhead's name among them.
 *
 * It is how the desk decides what to SHOW (`lib/features.ts`). It is not what
 * decides what HAPPENS: a document the server will not draw is refused
 * `FEATURE_OFF` whatever this said at boot, and the desk then takes the
 * feature away (`state/features.ts`).
 *
 * Read beside the staff config rather than inside it: `staffConnection.ts` is
 * the fleet's shared copy, and this is the one thing only this app asks of the
 * document so far. An older server sends no `addOns`: nothing is connected.
 */
import { HOSTED, SURFACE_SIDE } from "../surface.ts";
import { configBase } from "../staffConnection.ts";

export interface ConnectedAddOn {
  version: string;
  /** The settings the add-on makes public (never a secret). */
  settings: Record<string, unknown>;
}

export type ConnectedAddOns = Record<string, ConnectedAddOn>;

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** The `addOns` of a staff config document; anything malformed is left out. */
export function connectedAddOnsOf(doc: unknown): ConnectedAddOns {
  const listed = record(record(doc)?.["addOns"]);
  if (listed === null) return {};
  const out: ConnectedAddOns = {};
  for (const [key, entry] of Object.entries(listed)) {
    const e = record(entry);
    if (e === null || !/^[a-z][a-z0-9-]{1,79}$/.test(key)) continue;
    out[key] = { version: typeof e["version"] === "string" ? e["version"] : "", settings: record(e["settings"]) ?? {} };
  }
  return out;
}

/** The connected add-ons, read from the desk's config; none outside a hosted desk or when nothing answers. */
export async function loadConnectedAddOns(
  opts: { hostedStaff?: boolean; base?: string; pathname?: string; fetchImpl?: typeof fetch } = {},
): Promise<ConnectedAddOns> {
  const hostedStaff = opts.hostedStaff ?? (HOSTED && SURFACE_SIDE === "staff");
  if (!hostedStaff) return {};
  const base = opts.base ?? configBase(import.meta.env.BASE_URL, opts.pathname ?? window.location.pathname);
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${base}surface-config.json`, { cache: "no-store" });
    if (!res.ok) return {};
    return connectedAddOnsOf(await res.json());
  } catch {
    return {};
  }
}
