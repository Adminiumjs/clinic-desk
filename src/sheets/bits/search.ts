/**
 * The server's patient search as someone types, for the sheets that pick a
 * patient on file (Book a visit, "Same person as…").
 */
import { useEffect, useState } from "react";

import type { Patient } from "../../data/types.ts";
import { deskReads } from "../../state/desk.ts";

/** The server's patient search as someone types: nothing under two letters, a short pause, the first five. */
export function usePatientSearch(q: string, today: string): { state: "idle" | "hits" | "none"; rows: Patient[] } {
  const [result, setResult] = useState<{ q: string; rows: Patient[] }>({ q: "", rows: [] });
  const text = q.trim();
  useEffect(() => {
    if (text.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      deskReads()
        .search({ q: text, limit: 5, offset: 0 }, today)
        .then((r) => {
          if (live) setResult({ q: text, rows: r.rows });
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text, today]);
  if (text.length < 2 || result.q !== text) return { state: "idle", rows: [] };
  return { state: result.rows.length > 0 ? "hits" : "none", rows: result.rows };
}
