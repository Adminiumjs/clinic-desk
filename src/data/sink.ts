/**
 * Where the desk's writes go — the other half of the data seam (reads are
 * `adminiumSource.ts` and the demo's database).
 *
 *   sessionSink   Adminium's data API, as the signed-in staff member: every
 *                 row lands in the real table, under the person's grants and
 *                 the audit trail, with the rules Adminium keeps applied on
 *                 the way in (a visit's fee and length, its reference, the
 *                 stamps, the capped balance, the booking rule).
 *   the demo      the same three calls against an in-memory database
 *                 (`demo/db.ts`), so the demo runs the code the real desk runs.
 *
 * A write that fails throws a `SinkError` whose `kind` says what the caller
 * should DO:
 *
 *   signed-out   401 — sign in again; nothing more is saved until then
 *   saved        a create that carried this action's key (`client_key`) was
 *                already saved by an earlier try: the sink finds that row and
 *                answers with it, so the action carries on from there
 *   refused      every other 4xx, and every other 409 — the slot was taken
 *                (`BOOKING_TAKEN`), the payment is more than the balance
 *                (`BALANCE_EXCEEDED`), the day is already closed (a unique
 *                day): this will never be accepted as it is
 *   offline      no answer, or 5xx, or a lock the server asks to retry — keep
 *                it and try again later
 *
 * Point of Sale reads every 409 but its booking guard's as "already there",
 * because its only duplicate is a retried payment. Here a 409 is usually a
 * refusal the desk must show, so only a found action key counts as saved.
 */
import { APP_KEY } from "../surface-nav.ts";
import type { SessionTransport } from "./sessionSource.ts";
import { normalise } from "./rows.ts";
import type { TableRef } from "./types.ts";

export type RowId = number | string;
export type SinkRow = Record<string, unknown>;

export interface DataSink {
  insert(ref: TableRef, values: SinkRow): Promise<SinkRow>;
  update(ref: TableRef, id: RowId, patch: SinkRow): Promise<SinkRow>;
  remove(ref: TableRef, id: RowId): Promise<void>;
  /**
   * Draw one of the documents this app ships (`documents` in the manifest) for
   * one of its rows, or hand back the one already drawn while the row is
   * unchanged: where its print copy and its file are. Only the hosted desk has
   * it — Adminium draws documents with an add-on, and the demo has neither.
   */
  renderDocument?(input: DocumentAsk): Promise<DrawnDocument>;
}

/** A document of the app's, asked for by its kind and the row it is for. */
export interface DocumentAsk {
  kind: string;
  ref: TableRef;
  id: RowId;
  /** The document's language; the add-on's default when left out. */
  locale?: string;
}

export interface DrawnDocument {
  id: string;
  /** Same-origin paths: the print copy (HTML) and the file (a PDF where the text allows it). */
  printUrl: string;
  contentUrl: string;
}

export type SinkErrorKind = "signed-out" | "saved" | "refused" | "offline";

export class SinkError extends Error {
  readonly kind: SinkErrorKind;
  readonly status: number;
  readonly code: string;
  /** The column the server refused, when it named one. */
  readonly field: string | null;
  /** The refusal's own details (`reason`, `balance`…), when it gave any. */
  readonly details: Record<string, unknown>;

  constructor(message: string, kind: SinkErrorKind, status: number, code: string, field: string | null = null, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "SinkError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.field = field;
    this.details = details;
  }
}

/** What an answer means for the desk, before any action key is looked up. */
export function kindOfStatus(status: number, code = ""): SinkErrorKind {
  if (status === 401) return "signed-out";
  // A lost lock race or a busy database: the server says try again.
  if (status === 0 || status >= 500 || code === "WRITE_CONFLICT" || code === "BOOKING_BUSY") return "offline";
  return "refused";
}

interface ErrorLike {
  status?: number;
  code?: string;
  message?: string;
  details?: unknown;
}

function detailsOf(error: ErrorLike): Record<string, unknown> {
  return typeof error.details === "object" && error.details !== null ? (error.details as Record<string, unknown>) : {};
}

/** The first column a refused write names (`details.fields` on a 422, `details.column` on a 409). */
function fieldOf(error: ErrorLike): string | null {
  const details = detailsOf(error);
  const fields = details["fields"];
  if (typeof fields === "object" && fields !== null) return Object.keys(fields)[0] ?? null;
  return typeof details["column"] === "string" ? details["column"] : null;
}

export function asSinkError(error: unknown): SinkError {
  if (error instanceof SinkError) return error;
  const e = (error ?? {}) as ErrorLike;
  const status = typeof e.status === "number" ? e.status : 0;
  const code = e.code ?? (status === 0 ? "NETWORK" : "INTERNAL");
  return new SinkError(e.message ?? "The change could not be saved.", kindOfStatus(status, code), status, code, fieldOf(e), detailsOf(e));
}

/** A key the desk holds as a number, as the URL wants it. */
const keyOf = (id: RowId): string => encodeURIComponent(String(id));

export function sessionSink(transport: SessionTransport, tableOf: Readonly<Record<TableRef, string>>, appKey: string = APP_KEY): DataSink {
  const path = async (ref: TableRef, id?: RowId): Promise<string> => {
    const conn = await transport.connection();
    const base = `/api/v1/data/${encodeURIComponent(conn)}/${encodeURIComponent(tableOf[ref])}`;
    return id === undefined ? base : `${base}/${keyOf(id)}`;
  };
  /** One retry with a fresh token when the session's has rotated. */
  const send = async <T>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> => {
    try {
      return await transport.mutate<T>(url, method, body);
    } catch (error) {
      if ((error as ErrorLike).code !== "CSRF_FAILED") throw asSinkError(error);
      await transport.refresh().catch(() => undefined);
      try {
        return await transport.mutate<T>(url, method, body);
      } catch (again) {
        throw asSinkError(again);
      }
    }
  };
  /** The row an earlier try of this action saved, found by its key. */
  const byClientKey = async (ref: TableRef, key: string): Promise<SinkRow | null> => {
    const found = await transport.port.list<SinkRow>(ref, { limit: 1, offset: 0, where: { column: "client_key", op: "eq", value: key } });
    return found.data[0] ?? null;
  };

  return {
    async insert(ref, values) {
      try {
        const reply = await send<{ data?: SinkRow }>(await path(ref), "POST", { values });
        return normalise(ref, reply.data ?? {}) as unknown as SinkRow;
      } catch (error) {
        const refused = asSinkError(error);
        const key = values["client_key"];
        if (refused.status === 409 && refused.code === "UNIQUE_VIOLATION" && typeof key === "string") {
          const earlier = await byClientKey(ref, key).catch(() => null);
          if (earlier !== null) return normalise(ref, earlier) as unknown as SinkRow;
        }
        throw refused;
      }
    },
    async update(ref, id, patch) {
      const reply = await send<{ data?: SinkRow }>(await path(ref, id), "PATCH", { values: patch });
      return normalise(ref, reply.data ?? {}) as unknown as SinkRow;
    },
    async remove(ref, id) {
      await send<unknown>(`${await path(ref, id)}?confirm=true`, "DELETE");
    },
    /*
     * The app's own door to its documents: by the manifest's names (`payments`,
     * not the real table), under the signed-in person's grants — they must be
     * able to read every table the document reads. A feature switched off is
     * `409 FEATURE_OFF`; a document the add-on could not draw, `422`.
     */
    async renderDocument(input) {
      const reply = await send<{ id?: string; printUrl?: string; contentUrl?: string }>(`/api/v1/apps/${encodeURIComponent(appKey)}/documents/render`, "POST", {
        kind: input.kind,
        ref: input.ref,
        pk: { id: input.id },
        ...(input.locale === undefined ? {} : { locale: input.locale }),
      });
      if (typeof reply.id !== "string" || typeof reply.printUrl !== "string" || typeof reply.contentUrl !== "string") {
        throw new SinkError("The document came back without its address.", "refused", 502, "DOCUMENT_REPLY");
      }
      return { id: reply.id, printUrl: reply.printUrl, contentUrl: reply.contentUrl };
    },
  };
}
