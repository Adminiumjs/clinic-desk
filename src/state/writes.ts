/**
 * The desk's write seam: every action saves through the one sink set here.
 *
 * The hosted desk sets Adminium's session sink at boot; the demo sets the
 * demo practice's. There is no default: a write before boot has chosen one is
 * a bug, and it says so rather than saving into nowhere.
 */
import type { DataSink } from "../data/sink.ts";

let current: DataSink | null = null;

export function setSink(sink: DataSink): void {
  current = sink;
}

export function sink(): DataSink {
  if (current === null) throw new Error("no sink: boot sets one before the desk can save");
  return current;
}
