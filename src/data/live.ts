/**
 * Live updates: what another desk, a clinician's screen or a patient online
 * changes, arriving on this desk as it happens.
 *
 * One EventSource on Adminium's event stream, following every table the desk
 * holds. Each `record.create` / `record.update` / `record.delete` frame is
 * handed on with the table it came from, by the app's short name, and its key.
 *
 * The frame's copy of the row is NOT handed on: Adminium blanks the personal
 * columns of every row it streams (a patient's name, mobile and email arrive
 * as null), so the store reads the row again by its key (`state/live.ts`).
 *
 * The hub keeps no history, so a frame missed while the connection was down
 * is gone. After a reconnect `onReconnect` fires, and the caller reads the
 * desk again rather than trusting what it has.
 *
 * Hosted staff builds only: the stream is the signed-in person's, on
 * Adminium's own origin.
 */
import type { SessionTransport } from "./sessionSource.ts";
import type { TableRef } from "./types.ts";

export type LiveKind = "record.create" | "record.update" | "record.delete";

export interface LiveFrame {
  table: TableRef;
  kind: LiveKind;
  /** The row's key; null when the frame carried none. */
  id: number | null;
}

/**
 * Every table the desk holds. More than the day's busy tables: a payment or a
 * write-off changes its visit's balance without a frame for the visit, and a
 * manager changing Tuesday's hours on another computer moves this desk's
 * free times.
 */
export const LIVE_TABLES: readonly TableRef[] = [
  "appointments",
  "payments",
  "write_offs",
  "waiting_list",
  "registrations",
  "check_notes",
  "messages",
  "closures",
  "recalls",
  "day_closes",
  "patients",
  "settings",
  "opening_hours",
  "clinicians",
  "visit_types",
  "clinician_visit_types",
  "clinician_hours",
  "faqs",
];

/** Adminium's per-stream cap. */
const MAX_CHANNELS = 64;

interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  onerror: ((event: Event) => void) | null;
  onopen: ((event: Event) => void) | null;
  close(): void;
}

export interface LiveOptions {
  transport: Pick<SessionTransport, "connection" | "tableId">;
  /** Short name → the real table an install made. */
  tables: Readonly<Record<TableRef, string>>;
  /** Tables the person may read: the stream refuses a channel they may not. */
  readable?: (ref: TableRef) => boolean;
  onFrame: (frame: LiveFrame) => void;
  onReconnect: () => void;
  /** Test seam. */
  createSource?: (url: string) => EventSourceLike;
}

/** Start following; resolves with the function that stops. */
export async function startLive(opts: LiveOptions): Promise<() => void> {
  const conn = await opts.transport.connection();
  const byChannel = new Map<string, TableRef>();
  for (const short of LIVE_TABLES.filter((ref) => opts.readable?.(ref) ?? true)) {
    const id = await opts.transport.tableId(opts.tables[short] ?? short);
    byChannel.set(`widget-data:${conn}:${id}`, short);
  }
  const channels = [...byChannel.keys()].slice(0, MAX_CHANNELS);
  const url = `/api/v1/events?channels=${encodeURIComponent(channels.join(","))}`;
  const source = opts.createSource?.(url) ?? (new EventSource(url, { withCredentials: true }) as unknown as EventSourceLike);

  let dropped = false;
  source.onerror = () => {
    // The browser reconnects on its own; what it missed meanwhile is gone.
    dropped = true;
  };
  source.onopen = () => {
    if (!dropped) return;
    dropped = false;
    opts.onReconnect();
  };
  const handle = (kind: LiveKind) => (event: MessageEvent) => {
    let frame: { channel?: string; data?: { pk?: Record<string, unknown> | null } };
    try {
      frame = JSON.parse(String(event.data)) as typeof frame;
    } catch {
      return;
    }
    const table = frame.channel === undefined ? undefined : byChannel.get(frame.channel);
    if (table === undefined) return;
    const key = Number(Object.values(frame.data?.pk ?? {})[0]);
    opts.onFrame({ table, kind, id: Number.isInteger(key) ? key : null });
  };
  for (const kind of ["record.create", "record.update", "record.delete"] as const) {
    source.addEventListener(kind, handle(kind));
  }
  return () => source.close();
}
