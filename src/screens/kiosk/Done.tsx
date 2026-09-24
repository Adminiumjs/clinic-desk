/**
 * The thank-you after a check-in: the person's first name, when and with whom,
 * and a ten-second countdown back to the start for the next person (or "Next
 * person" at once).
 *
 * The countdown runs on the tablet's own elapsed time, not the practice's
 * clock: it measures how long the thank-you has been showing, which is the
 * same everywhere and is not moved by the demo's pinned morning.
 */
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Btn, mono } from "../../components/ui.tsx";
import type { KioskOutcome } from "../../data/kiosk.ts";
import { useI18n } from "../../i18n/index.tsx";
import { time } from "../../lib/format.ts";
import { DONE_SECONDS, doneLine } from "./logic.ts";

export function Done({ done, onNext }: { done: Extract<KioskOutcome, { kind: "done" }>; onNext: () => void }) {
  const { t, number } = useI18n();
  const [left, setLeft] = useState(DONE_SECONDS);
  const next = useRef<HTMLButtonElement | null>(null);
  const finish = useRef(onNext);
  finish.current = onNext;

  useEffect(() => {
    const started = performance.now();
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil(DONE_SECONDS - (performance.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        clearInterval(tick);
        finish.current();
      }
    }, 250);
    return () => clearInterval(tick);
  }, []);

  // The start's button is gone: the keyboard lands on the one thing left to press.
  useEffect(() => {
    next.current?.querySelector("button")?.focus({ preventScroll: true });
  }, []);

  const line = doneLine(done);
  const lineText =
    line.key === "kiosk.doneWith"
      ? t("kiosk.doneWith", { clinician: done.clinician ?? "", time: time(done.at ?? "") })
      : line.key === "kiosk.doneAt"
        ? t("kiosk.doneAt", { time: time(done.at ?? "") })
        : t("kiosk.donePlain");

  return (
    <section
      className="rh-screen"
      style={{ width: "min(560px, 100%)", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16, padding: "36px 24px", borderRadius: 22, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)" }}
    >
      {/* Read out once, as it appears; the countdown below is not. */}
      <div role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <span aria-hidden="true" style={{ width: 72, height: 72, borderRadius: 24, background: "var(--pos-soft)", color: "var(--pos)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={36} />
        </span>
        <h1 style={{ margin: 0, fontSize: "clamp(25px, 3.8vw, 33px)", fontWeight: 800, letterSpacing: "-.036em", lineHeight: 1.12 }}>
          {done.firstName === "" ? t("kiosk.thanksPlain") : t("kiosk.thanks", { name: done.firstName })}
        </h1>
        <p style={{ margin: 0, maxWidth: "38ch", fontSize: 16, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{lineText}</p>
      </div>
      <div aria-hidden="true" style={{ width: "min(260px, 100%)", display: "flex", flexDirection: "column", gap: 7, marginBlockStart: 4 }}>
        <span style={{ height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", borderRadius: 3, background: "var(--pos)", width: `${String(Math.round((left / DONE_SECONDS) * 100))}%`, transition: "width 1s linear" }} />
        </span>
        <span style={{ ...mono(12.5, 600, "var(--fg-subtle)"), whiteSpace: "normal" }}>{t("kiosk.countdown", { count: number(left) })}</span>
      </div>
      <span ref={next} style={{ display: "contents" }}>
        <Btn kind="ghost" onClick={onNext} style={{ height: 52, paddingInline: 24, fontSize: 15 }}>
          {t("kiosk.next")}
        </Btn>
      </span>
    </section>
  );
}
