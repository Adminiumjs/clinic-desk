/**
 * The contract's Adminium: the BUILT server of an Adminium checkout
 * (`ADMINIUM_REPO`), booted by its own e2e script on one engine, with the two
 * add-ons this app offers — Invoices & Receipts and Holiday calendars — packed
 * from an add-ons checkout (`ADD_ONS_REPO`) as their release packs them, and
 * this repo's own `manifest.json` and sample packed as an operator would
 * upload them (or the released 0.2.0's, read from git, for the update).
 *
 * Everything is spoken over HTTP, as the dashboard and the desk speak it:
 * nothing here reaches into the server's modules.
 *
 * Tests only; nothing that ships imports it.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

export type Engine = "sqlite" | "postgres" | "mysql";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");

// ── what the contract needs, and whether it is here ─────────────────────────

export const ADMINIUM_REPO = process.env["ADMINIUM_REPO"] ?? "";
export const ADD_ONS_REPO = process.env["ADD_ONS_REPO"] ?? join(REPO, "..", "add-ons");
const E2E_SERVER = join(ADMINIUM_REPO, "apps", "e2e", "scripts", "e2e-server.mjs");
const ADD_ON_DIRS = { invoices: "invoices", "holiday-calendars": "holiday-calendars" } as const;
export type AddOnKey = keyof typeof ADD_ON_DIRS;
const addOnDir = (key: AddOnKey) => join(ADD_ONS_REPO, "packages", ADD_ON_DIRS[key]);

/**
 * The released 0.2.0 an update starts from: its tag's commit, which a clone
 * with history has whether or not it fetched the tag.
 */
export const RELEASED = process.env["CONTRACT_FROM_REF"] ?? "54d81639dfd35da54d2dea1698e84183db8661fa";

/** Why the contract cannot run here, or null when it can. */
export function missing(): string | null {
  if (ADMINIUM_REPO === "") return "ADMINIUM_REPO is not set";
  if (!existsSync(join(ADMINIUM_REPO, "apps", "server", "dist", "app.js"))) return `no built server in ${ADMINIUM_REPO} (pnpm turbo run build --filter=@adminium/e2e...)`;
  if (!existsSync(join(ADMINIUM_REPO, "apps", "dashboard", "dist", "index.html"))) return `no built dashboard in ${ADMINIUM_REPO}`;
  if (!existsSync(E2E_SERVER)) return `no e2e server script in ${ADMINIUM_REPO}`;
  if (!existsSync(join(addOnDir("invoices"), "dist", "server.js"))) return `no built Invoices & Receipts in ${ADD_ONS_REPO}`;
  if (!existsSync(join(addOnDir("holiday-calendars"), "dist", "client.js"))) return `no built Holiday calendars in ${ADD_ONS_REPO}`;
  return null;
}

/** Whether the released 0.2.0 can be read from this clone's history (a shallow clone cannot). */
export function releasedReadable(): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${RELEASED}:manifest.json`], { cwd: REPO, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** The engines this run can reach: SQLite always, the others with their URLs. */
export const ENGINES: [Engine, boolean][] = [
  ["sqlite", true],
  ["postgres", (process.env["TEST_POSTGRES_URL"] ?? "") !== ""],
  ["mysql", (process.env["TEST_MYSQL_URL"] ?? "") !== ""],
];

// ── the packages, as an operator uploads them ───────────────────────────────

const BLOCK = 512;

/** An npm-shaped tarball (`package/…` members), which is what the server's hardened unpacker reads. */
function tarball(files: Record<string, Buffer>): Buffer {
  const members: Buffer[] = [];
  const put = (block: Buffer, at: number, length: number, value: string) => Buffer.from(value, "latin1").subarray(0, length).copy(block, at);
  for (const [path, body] of Object.entries(files)) {
    const header = Buffer.alloc(BLOCK);
    put(header, 0, 100, `package/${path}`);
    put(header, 100, 8, "0000644\0");
    put(header, 124, 12, `${body.length.toString(8).padStart(11, "0")}\0`);
    put(header, 136, 12, "00000000000\0");
    put(header, 156, 1, "0");
    put(header, 257, 6, "ustar\0");
    put(header, 263, 2, "00");
    header.fill(0x20, 148, 156);
    let sum = 0;
    for (const byte of header) sum += byte;
    put(header, 148, 8, `${sum.toString(8).padStart(6, "0")}\0 `);
    members.push(header, body, Buffer.alloc((BLOCK - (body.length % BLOCK)) % BLOCK));
  }
  members.push(Buffer.alloc(BLOCK * 2));
  return gzipSync(Buffer.concat(members), { mtime: 0 } as never);
}

export interface Bundle {
  buffer: Buffer;
  integrity: string;
  key: string;
  version: string;
}

const bundle = (files: Record<string, Buffer>, key: string, version: string): Bundle => {
  const buffer = tarball(files);
  return { buffer, integrity: `sha512-${createHash("sha512").update(buffer).digest("base64")}`, key, version };
};

const newer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i += 1) if (x![i] !== y![i]) return x![i]! > y![i]!;
  return false;
};

/**
 * The version an add-on is packed as. The checkout is the add-on's next
 * release BEFORE that release stamps its number, so when this app already
 * asks for the next number (`addOns.suggests[].range` `>=x.y.z`), the checkout
 * is packed as it — a rehearsal of the release, said in the test's name —
 * rather than refused for a number nobody has stamped yet.
 */
export function packedVersion(key: AddOnKey): { version: string; checkout: string; rehearsed: boolean } {
  const app = JSON.parse(read(join(REPO, "manifest.json"))) as { addOns?: { suggests?: { key: string; range: string }[] } };
  const range = app.addOns?.suggests?.find((s) => s.key === key)?.range ?? "";
  const floor = /^>=\s*(\d+\.\d+\.\d+)$/.exec(range.trim())?.[1] ?? null;
  const checkout = (JSON.parse(read(join(addOnDir(key), "manifest.json"))) as { version: string }).version;
  if (floor !== null && newer(floor, checkout)) return { version: floor, checkout, rehearsed: true };
  return { version: checkout, checkout, rehearsed: false };
}

/** An add-on, packed as its release packs it: `files[]`, the name rewritten, no dev-only fields. */
export function addOnBundle(key: AddOnKey): Bundle {
  const dir = addOnDir(key);
  const pkg = JSON.parse(read(join(dir, "package.json"))) as Record<string, unknown> & { name: string; files: string[] };
  const files: Record<string, Buffer> = {};
  const add = (path: string) => {
    const absolute = join(dir, path);
    if (!existsSync(absolute)) return;
    if (statSync(absolute).isDirectory()) {
      for (const name of readdirSync(absolute)) add(join(path, name));
      return;
    }
    files[relative(dir, absolute).split("\\").join("/")] = readFileSync(absolute);
  };
  for (const entry of pkg.files) add(entry);
  const { version } = packedVersion(key);
  const { devDependencies: _dev, scripts: _scripts, ...shipped } = pkg;
  files["package.json"] = Buffer.from(JSON.stringify({ ...shipped, name: pkg.name.replace(/^@adminium\//, "@adminiumjs/"), version }));
  const manifest = JSON.parse(read(join(dir, "manifest.json"))) as { key: string };
  files["manifest.json"] = Buffer.from(JSON.stringify({ ...manifest, version }));
  return bundle(files, manifest.key, version);
}

/** The version the Adminium checkout's server says it is. */
export function serverVersion(): string {
  return (JSON.parse(read(join(ADMINIUM_REPO, "apps", "server", "package.json"))) as { version: string }).version;
}

/**
 * The floor this app is packed with. The Adminium checkout is the next release
 * BEFORE that release stamps its number, so when this app already asks for the
 * next number, the app is packed with the checkout's own — a rehearsal of the
 * release, said in the test's name — rather than refused as too new for it.
 */
export function packedFloor(): { floor: string; asked: string; rehearsed: boolean } {
  const asked = (JSON.parse(read(join(REPO, "manifest.json"))) as { compatibility: { minAdminiumVersion: string } }).compatibility.minAdminiumVersion;
  const server = serverVersion();
  return newer(asked, server) ? { floor: server, asked, rehearsed: true } : { floor: asked, asked, rehearsed: false };
}

/**
 * This repo's app — or, with a git ref, that commit's — its manifest, its
 * sample, and a page for each side: a stand-in, or with `surfaces` the sides
 * `npm run build:surface` built (for a person to open in a browser).
 */
export function appBundle(ref?: string, options: { surfaces?: boolean } = {}): Bundle {
  const at = (path: string): Buffer => (ref === undefined ? readFileSync(join(REPO, path)) : execFileSync("git", ["show", `${ref}:${path}`], { cwd: REPO, maxBuffer: 64 << 20 }));
  let text = at("manifest.json");
  const manifest = JSON.parse(text.toString("utf8")) as { key: string; version: string; sampleData?: { file: string }; compatibility: { minAdminiumVersion: string } };
  if (ref === undefined && packedFloor().rehearsed) {
    text = Buffer.from(`${JSON.stringify({ ...manifest, compatibility: { ...manifest.compatibility, minAdminiumVersion: packedFloor().floor } }, null, 2)}\n`);
  }
  const files: Record<string, Buffer> = {
    "package.json": Buffer.from(JSON.stringify({ name: `@adminiumjs/app-${manifest.key}`, version: manifest.version })),
    "manifest.json": text,
    "staff/index.html": Buffer.from('<!doctype html><html><body data-app="clinic-staff"></body></html>'),
    "customer/index.html": Buffer.from('<!doctype html><html><body data-app="clinic-customer"></body></html>'),
  };
  if (manifest.sampleData !== undefined) files[manifest.sampleData.file] = at(manifest.sampleData.file);
  if (options.surfaces === true && ref === undefined) {
    for (const side of ["staff", "customer"]) {
      const root = join(REPO, "dist-surface", manifest.key, side);
      if (!existsSync(join(root, "index.html"))) throw new Error(`no built ${side} side: run \`npm run build:surface\` first`);
      const add = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const path = join(dir, name);
          if (statSync(path).isDirectory()) add(path);
          else files[`${side}/${relative(root, path).split("\\").join("/")}`] = readFileSync(path);
        }
      };
      add(root);
    }
  }
  return bundle(files, manifest.key, manifest.version);
}

// ── the server ──────────────────────────────────────────────────────────────

export interface Server {
  base: string;
  sink: string;
  /** What the server has said so far (its log), for a failure to show. */
  log(): string;
  stop(): Promise<void>;
}

/**
 * Boot the built Adminium on one engine, its clock starting at `now`; resolves
 * once it serves. It takes four ports from `port`: the server, the SMTP sink,
 * the sink's reader and the scripted model — so a run stays inside the ports it
 * was given.
 */
export async function boot(engine: Engine, port: number, now: number, database: string): Promise<Server> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2E_ENGINE: engine,
    E2E_PORT: String(port),
    E2E_SMTP_PORT: String(port + 1),
    E2E_SINK_PORT: String(port + 2),
    E2E_FAKE_LLM_PORT: String(port + 3),
    // Its own database, so a contract never meets another run's rows.
    E2E_DATABASE: database,
    CONTRACT_NOW: String(now),
    NODE_OPTIONS: `${process.env["NODE_OPTIONS"] ?? ""} --import=${pathToFileURL(fileURLToPath(new URL("./clock.mjs", import.meta.url))).href}`.trim(),
  };
  const child: ChildProcess = spawn(process.execPath, [E2E_SERVER], { cwd: join(ADMINIUM_REPO, "apps", "e2e"), env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout?.on("data", (chunk: Buffer) => (log += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (log += chunk.toString()));
  const base = `http://127.0.0.1:${String(port)}`;
  const deadline = Date.now() + 180_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`the ${engine} server exited:\n${log.slice(-4000)}`);
    try {
      const res = await fetch(`${base}/api/v1/healthz`);
      if (res.ok) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      child.kill("SIGKILL");
      throw new Error(`the ${engine} server never answered:\n${log.slice(-4000)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return {
    base,
    sink: `http://127.0.0.1:${String(port + 2)}`,
    log: () => log,
    stop: () =>
      new Promise<void>((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 5_000);
      }),
  };
}

// ── speaking to it ──────────────────────────────────────────────────────────

export interface Reply<T = unknown> {
  status: number;
  body: T;
  code: string | undefined;
  details: Record<string, unknown>;
  headers: Headers;
}

/** A caller: the operator (a session cookie) or a patient's page (a browser key). */
export class Caller {
  private cookie = "";
  private csrf = "";
  readonly base: string;
  private readonly headers: Record<string, string>;
  constructor(base: string, headers: Record<string, string> = {}) {
    this.base = base;
    this.headers = headers;
  }

  async send<T = unknown>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Reply<T>> {
    for (let attempt = 0; ; attempt += 1) {
      const res = await fetch(`${this.base}${path}`, {
        method,
        headers: {
          ...this.headers,
          ...(this.cookie === "" ? {} : { cookie: this.cookie }),
          // Node's fetch says `sec-fetch-mode`, so the server asks what a browser page is asked: the session's token.
          ...(this.csrf === "" || method === "GET" ? {} : { "x-adminium-csrf": this.csrf }),
          ...(body === undefined ? {} : Buffer.isBuffer(body) ? { "content-type": "application/octet-stream" } : { "content-type": "application/json" }),
          ...extra,
        },
        ...(body === undefined ? {} : { body: Buffer.isBuffer(body) ? new Uint8Array(body) : JSON.stringify(body) }),
      });
      const set = res.headers.getSetCookie?.() ?? [];
      if (set.length > 0) this.cookie = set.map((c) => c.split(";")[0]).join("; ");
      // A burst the rate limit refused is the limit's, not the contract's: wait it out.
      if (res.status === 429 && attempt < 6) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      const bytes = Buffer.from(await res.arrayBuffer());
      let parsed: unknown = bytes;
      if (!type.includes("application/pdf")) {
        const text = bytes.toString("utf8");
        parsed = text;
        try {
          parsed = text === "" ? null : JSON.parse(text);
        } catch {
          // not JSON
        }
      }
      const error = (parsed as { error?: { code?: string; details?: Record<string, unknown> } } | null)?.error;
      return { status: res.status, body: parsed as T, code: error?.code, details: error?.details ?? {}, headers: res.headers };
    }
  }

  /** Sign in as the operator, and take the session's write token as the dashboard does. */
  async signIn(email: string, password: string): Promise<void> {
    ok(await this.post("/api/v1/auth/login", { email, password }));
    this.csrf = ok(await this.get<{ data: { csrfToken: string } }>("/api/v1/bootstrap")).data.csrfToken;
  }

  get = <T = unknown>(path: string, extra?: Record<string, string>) => this.send<T>("GET", path, undefined, extra);
  post = <T = unknown>(path: string, body?: unknown, extra?: Record<string, string>) => this.send<T>("POST", path, body ?? {}, extra);
  patch = <T = unknown>(path: string, body: unknown, extra?: Record<string, string>) => this.send<T>("PATCH", path, body, extra);
  put = <T = unknown>(path: string, body: unknown, extra?: Record<string, string>) => this.send<T>("PUT", path, body, extra);
}

/** Expect a status, and hand back the body. */
export function ok<T>(reply: Reply<T>, status = 200): T {
  if (reply.status !== status) throw new Error(`expected ${String(status)}, got ${String(reply.status)}: ${JSON.stringify(reply.body).slice(0, 1500)}`);
  return reply.body;
}

export const until = async <T>(read: () => Promise<T | undefined>, label: string, ms = 120_000): Promise<T> => {
  const deadline = Date.now() + ms;
  for (;;) {
    const found = await read();
    if (found !== undefined) return found;
    if (Date.now() > deadline) throw new Error(`waited ${String(ms / 1000)} s for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
};
