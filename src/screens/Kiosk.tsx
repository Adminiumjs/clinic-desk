/**
 * The arrivals kiosk: the tablet in the waiting room.
 *
 * A patient types their date of birth and mobile and presses "Check in"; the
 * kiosk finds them, checks in today's booked visit (from an hour before its
 * time) and thanks them by their first name, with when and with whom. Then,
 * after ten seconds or "Next person", it is back at the start with every box
 * empty and the person forgotten — nothing of one patient is left on the
 * screen, or in the page, for the next. No name is ever listed: a person sees
 * only their own first name, after typing their own details.
 *
 * Switched off in the practice's settings, it says so and sends everyone to
 * the desk; it looks again every twenty seconds, so switching it back on
 * brings it back without anyone touching the tablet.
 *
 * It has no desk around it: the tablet is signed in with the kiosk role, which
 * reaches nothing else. "Staff" in the corner leaves (see `kiosk/StaffDoor`).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { brandTile } from "../components/PatientShell.tsx";
import { kioskErrorOf, kioskPort, outcomeOfStop, runCheckIn, type KioskOutcome, type KioskPractice } from "../data/kiosk.ts";
import { appName } from "../i18n/ambient.ts";
import { now, today } from "../lib/clock.ts";
import { useDemoSignal } from "../state/demoSignal.ts";
import { go } from "../state/ui.ts";
import { Done } from "./kiosk/Done.tsx";
import { Off } from "./kiosk/Off.tsx";
import { Start, type Fields } from "./kiosk/Start.tsx";
import { StaffDoor } from "./kiosk/StaffDoor.tsx";
import { bornOnOf, boxesOf, mobileReady, type KioskNote } from "./kiosk/logic.ts";

const EMPTY: Fields = { day: "", month: "", year: "", mobile: "" };
/** How often a switched-off kiosk asks whether it is back on (the server looks at the switch every 15 s). */
const LOOK_AGAIN_MS = 20_000;

type Mode = "start" | "off";

export default function Kiosk() {
  const port = kioskPort();
  const [mode, setMode] = useState<Mode>("start");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [note, setNote] = useState<KioskNote | null>(port === null ? { kind: "gone" } : null);
  const [done, setDone] = useState<Extract<KioskOutcome, { kind: "done" }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [practice, setPractice] = useState<KioskPractice | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  /** Back to the start: every box empty, no message, the person forgotten, the first box ready. */
  const reset = useCallback(() => {
    port?.forget();
    setFields(EMPTY);
    setNote(null);
    setDone(null);
    setTimeout(() => boxes.current[0]?.focus({ preventScroll: true }), 20);
  }, [port]);

  /** Is the kiosk on? Anything else it hears is said on the start. */
  const look = useCallback(async () => {
    if (port === null) return;
    try {
      await port.probe();
      setMode("start");
      setNote((was) => (was?.kind === "signedOut" || was?.kind === "gone" || was?.kind === "offline" ? null : was));
    } catch (error) {
      const outcome = outcomeOfStop(kioskErrorOf(error));
      if (outcome.kind === "off") setMode("off");
      else if (outcome.kind !== "done") setNote(outcome.kind === "notfound" ? { kind: "gone" } : outcome);
    }
  }, [port]);

  useEffect(() => {
    void look();
    if (port === null) return;
    let alive = true;
    port
      .practice()
      .then((p) => alive && setPractice(p))
      .catch(() => undefined);
    return () => {
      alive = false;
      // Leaving the screen forgets whoever was found, as going back to the start does.
      port.forget();
    };
  }, [look, port]);

  useEffect(() => {
    if (mode !== "off") return;
    const again = setInterval(() => void look(), LOOK_AGAIN_MS);
    return () => clearInterval(again);
  }, [mode, look]);

  // The demo card's "A patient due now": their details typed in, ready to check in.
  useDemoSignal("kiosk.fill", (payload) => {
    const born = boxesOf(payload["bornOn"] ?? "");
    if (born === null || done !== null) return;
    setFields({ ...born, mobile: payload["mobile"] ?? "" });
    setNote(null);
  });

  const onField = (next: Partial<Fields>) => {
    setFields((f) => ({ ...f, ...next }));
    setNote(null);
  };

  const check = async () => {
    if (busy || port === null) return;
    const bornOn = bornOnOf(fields.day, fields.month, fields.year, today());
    if (bornOn === null || !mobileReady(fields.mobile)) {
      setNote({ kind: "empty" });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const outcome = await runCheckIn(port, { mobile: fields.mobile, bornOn }, now);
      if (outcome.kind === "done") setDone(outcome);
      else if (outcome.kind === "off") setMode("off");
      else setNote(outcome);
    } finally {
      setBusy(false);
    }
  };

  const name = practice?.name ?? appName() ?? "";
  const mark = practice?.mark ?? "";

  return (
    <div
      data-screen="Kiosk"
      style={{ position: "relative", minHeight: "100vh", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: "clamp(24px, 5vw, 56px) 20px 76px", background: "var(--bg)", color: "var(--fg)" }}
    >
      {name !== "" && (
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {mark !== "" && (
            <span aria-hidden="true" style={brandTile}>
              {mark.slice(0, 3)}
            </span>
          )}
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.035em" }}>{name}</span>
        </header>
      )}
      <main style={{ display: "contents" }}>
        {mode === "off" ? (
          <Off />
        ) : done !== null ? (
          <Done done={done} onNext={reset} />
        ) : (
          <Start fields={fields} onField={onField} note={note} busy={busy} onCheck={() => void check()} refs={boxes} />
        )}
      </main>
      {/* With no kiosk here at all (a desk sign-in that opened this address), "Staff" goes back to the desk. */}
      <footer style={{ display: "contents" }}>
        <StaffDoor onLeave={port === null ? async () => go("daysheet") : () => port.leave()} />
      </footer>
    </div>
  );
}
