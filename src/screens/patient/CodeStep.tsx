/**
 * The emailed code: six boxes, "Check the code", "Send it again" with its
 * countdown, and every answer the server can give — wrong with the tries
 * left, run out, too many tries, too many today, too soon — in the design's
 * words. Shared by My visits and Reminders & my details; the boxes alone also
 * serve the new-address panel on Reminders.
 *
 * The code is typed and sent, never kept: it lives in these boxes until the
 * server answers, and is cleared on success, on "Use different details" and
 * on a resend. The address shown is the one the server masked.
 */
import { useEffect, useRef, useState } from "react";
import { KeyRound, Mail, RotateCw } from "lucide-react";

import type { CodeSent } from "../../data/ports.ts";
import { PortError } from "../../data/ports.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Btn, MONO } from "../../components/ui.tsx";
import { now } from "../../lib/clock.ts";
import { checkCode, sendCode } from "../../state/patients.ts";
import { useDemoSignal } from "../../state/demoSignal.ts";
import { toast } from "../../state/ui.ts";
import { codeProblem, type CodeProblem } from "./logic.ts";
import { Notice, WithPhone, cardStyle, quietBtn } from "./parts.tsx";

export const EMPTY_CODE = ["", "", "", "", "", ""];

/**
 * Seconds until another code may be asked for. Timed on `performance.now()`:
 * "wait 30 seconds" is elapsed time, which neither the practice's clock (the
 * demo's is pinned) nor the device's wall clock (it can jump) measures.
 */
export function useCountdown(sentAt: number, seconds: number): number {
  const left = () => Math.max(0, Math.ceil(seconds - (performance.now() - sentAt) / 1000));
  const [value, setValue] = useState(left);
  useEffect(() => {
    setValue(left());
    if (left() <= 0) return;
    const timer = setInterval(() => {
      const next = left();
      setValue(next);
      if (next <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
    // `left` reads only these two.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentAt, seconds]);
  return value;
}

/** `0:29` */
export const countdownLabel = (seconds: number): string => `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`;

/** The code's lifetime in minutes, as the server set it (10 unless it says otherwise). */
export const codeMinutes = (sent: CodeSent): number => {
  const mins = Math.round((sent.expiresAt - now()) / 60_000);
  return mins >= 1 && mins <= 60 ? mins : 10;
};

/** The six boxes: one digit each, a pasted code fills them all, Backspace and the arrows move between them. */
export function CodeBoxes({
  prefix,
  digits,
  onDigits,
  onEnter,
  invalid,
  errorId,
}: {
  prefix: string;
  digits: string[];
  onDigits: (next: string[]) => void;
  onEnter: () => void;
  invalid: boolean;
  errorId: string;
}) {
  const { t } = useI18n();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(5, i))];
    el?.focus();
    el?.select();
  };
  // The demo card's "Fill the code" types the demo's code into whichever boxes are showing.
  useDemoSignal("code.fill", (p) => {
    const code = (p["code"] ?? "").replace(/\D/g, "").slice(0, 6);
    if (code.length === 6) onDigits(code.split(""));
  });

  const change = (i: number, raw: string) => {
    let d = raw.replace(/\D/g, "");
    const next = digits.slice();
    // Typing over a filled box: keep the new digit.
    if (d.length === 2 && digits[i] !== "" && d.charAt(0) === digits[i]) d = d.charAt(1);
    if (d.length > 1) {
      for (let j = 0; j < d.length && i + j < 6; j += 1) next[i + j] = d.charAt(j);
      onDigits(next);
      focus(Math.min(5, i + d.length));
      return;
    }
    next[i] = d;
    onDigits(next);
    if (d !== "" && i < 5) focus(i + 1);
  };

  return (
    <div role="group" aria-label={t("code.group")} dir="ltr" style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 8, maxWidth: 372 }}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="rh-fld"
          data-code={`${prefix}-${String(i)}`}
          value={digit}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={t("code.digit", { n: i + 1 })}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          onFocus={(e) => e.target.select()}
          onChange={(e) => change(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && digit === "" && i > 0) {
              e.preventDefault();
              const next = digits.slice();
              next[i - 1] = "";
              onDigits(next);
              focus(i - 1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              onEnter();
            } else if (e.key === "ArrowLeft" && i > 0) focus(i - 1);
            else if (e.key === "ArrowRight" && i < 5) focus(i + 1);
          }}
          style={{
            width: "100%",
            minWidth: 0,
            height: 52,
            padding: 0,
            borderRadius: 12,
            border: `1px solid ${invalid ? "var(--danger)" : "var(--border-strong)"}`,
            background: "var(--surface-2)",
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 20,
            fontWeight: 600,
            color: "var(--fg)",
            letterSpacing: "-.01em",
          }}
        />
      ))}
    </div>
  );
}

/** A code answer in words. */
export function codeMessage(t: ReturnType<typeof useI18n>["t"], problem: CodeProblem | "short" | "wrong", phone: string, tries = 0): string {
  switch (problem) {
    case "short":
      return t("code.short");
    case "wrong":
      return t("code.wrong", undefined, tries);
    case "locked":
      return t("code.locked");
    case "dayLocked":
      return t("code.dayLocked", { phone });
    case "expired":
      return t("code.expired");
    case "tooSoon":
      return t("code.tooSoon");
    case "limit":
      return t("code.limit", { phone });
    case "noEmail":
      return t("code.noEmail");
    case "stepUp":
      return t("prefs.stepUp");
    case "changeLimit":
      return t("prefs.changeLimit", { phone });
    case "sessionEnded":
      return t("code.ended");
    case "offline":
      return t("pShell.offline");
  }
}

/** The whole code step (P4c): what was sent where, the boxes, check, resend, and the way back. */
export function CodeStep({
  prefix,
  sent,
  sentAt,
  phone,
  onVerified,
  onResent,
  onBack,
  onSessionEnded,
}: {
  prefix: string;
  sent: CodeSent;
  sentAt: number;
  phone: string;
  onVerified: () => void;
  onResent: (sent: CodeSent) => void;
  onBack: () => void;
  onSessionEnded: () => void;
}) {
  const { t } = useI18n();
  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  const [problem, setProblem] = useState<{ kind: CodeProblem | "short" | "wrong"; tries?: number } | null>(null);
  const [busy, setBusy] = useState<"check" | "resend" | null>(null);
  const left = useCountdown(sentAt, sent.resendAfter);
  const locked = problem?.kind === "locked" || problem?.kind === "dayLocked" || problem?.kind === "limit";
  const errorId = `${prefix}-code-err`;
  const headingId = `${prefix}-code-h`;
  const boxesRoot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxesRoot.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [sentAt]);

  const check = async () => {
    const code = digits.join("");
    if (code.length < 6) {
      setProblem({ kind: "short" });
      boxesRoot.current?.querySelectorAll<HTMLInputElement>("input")[code.length]?.focus();
      return;
    }
    setBusy("check");
    try {
      const result = await checkCode(code, "verify");
      if (result.ok) {
        setDigits(EMPTY_CODE);
        setProblem(null);
        onVerified();
        return;
      }
      setProblem(result.triesLeft > 0 ? { kind: "wrong", tries: result.triesLeft } : { kind: "locked" });
    } catch (error) {
      const kind = codeProblem(error instanceof PortError ? error.code : "");
      if (kind === "sessionEnded") {
        onSessionEnded();
        return;
      }
      setProblem({ kind });
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    if (left > 0 || locked) return;
    setBusy("resend");
    try {
      const next = await sendCode({ purpose: "verify" });
      setDigits(EMPTY_CODE);
      setProblem(null);
      onResent(next);
      toast(t("code.resent"), { icon: "mail", tone: "fg" });
    } catch (error) {
      const kind = codeProblem(error instanceof PortError ? error.code : "");
      if (kind === "sessionEnded") onSessionEnded();
      else setProblem({ kind });
    } finally {
      setBusy(null);
    }
  };

  const off = left > 0 || locked;
  return (
    <section aria-labelledby={headingId} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span aria-hidden="true" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Mail size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id={headingId} style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: "-.022em", lineHeight: "normal" }}>
            {t("code.title")}
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
            {t("code.sentTo", { to: sent.sentTo, minutes: codeMinutes(sent) })}
          </p>
        </div>
      </div>
      <div ref={boxesRoot}>
        <CodeBoxes prefix={prefix} digits={digits} onDigits={(d) => { setDigits(d); if (problem?.kind === "short" || problem?.kind === "wrong") setProblem(null); }} onEnter={() => void check()} invalid={problem !== null} errorId={errorId} />
      </div>
      {problem !== null && (
        <Notice tone="danger" id={errorId}>
          {codeMessage(t, problem.kind, phone, problem.tries)}
        </Notice>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Btn icon={KeyRound} busy={busy === "check"} onClick={() => void check()}>
          {t("code.check")}
        </Btn>
        <Btn kind="ghost" icon={RotateCw} busy={busy === "resend"} disabled={off} onClick={() => void resend()} style={off ? { background: "var(--surface-2)", color: "var(--fg-subtle)", opacity: 1 } : undefined}>
          {left > 0 ? t("code.resendIn", { time: countdownLabel(left) }) : t("code.resend")}
        </Btn>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingBlockStart: 12, borderBlockStart: "1px solid var(--border)" }}>
        <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>
          <WithPhone text={t("code.wrongEmail")} phone={phone} />
        </span>
        <button type="button" className="rh-gi" onClick={onBack} style={quietBtn}>
          {t("code.back")}
        </button>
      </div>
    </section>
  );
}
