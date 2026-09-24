/**
 * The way into a patient's own visits and details: find yourself by mobile
 * and date of birth, then the code we email you. My visits and Reminders &
 * my details both go through it; neither shows anything until the server
 * says the session is `verified`.
 *
 * A miss reads the same whatever was wrong (nobody, two people sharing the
 * details), so the page never tells which detail to change. A session that
 * ends — signed out, timed out after its half hour, or ended by an address
 * change — brings both pages back here, with what was typed kept.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { PortError } from "../../data/ports.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Btn } from "../../components/ui.tsx";
import { findMe, patientsPort, sendCode, signOutPatient, usePatients } from "../../state/patients.ts";
import { useDemoSignal } from "../../state/demoSignal.ts";
import { CodeStep, codeMessage } from "./CodeStep.tsx";
import { forgetSession, setLookup, useFlow, type FindProblem, type LookupSide } from "./flow.ts";
import { codeProblem, lookupProblem, type CodeProblem } from "./logic.ts";
import { Notice, TextInput, cardStyle } from "./parts.tsx";

/** Whether this page may show the person's own rows: the server has said `verified`. */
export function useVerified(): boolean {
  return usePatients((s) => s.level === "verified" && s.found !== null);
}

/** End the session on this side too: the server's is already gone (timed out, or ended by the change). */
export async function endSession(keep: boolean, why: "timeout" | "emailChanged" | null): Promise<void> {
  await signOutPatient();
  forgetSession(keep, why);
}

/**
 * While a verified page is showing, look every 15 seconds whether the
 * session still holds; the client drops it when its half hour is up. Gone →
 * back to step one with the fields kept.
 */
export function useSessionWatch(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (patientsPort().level() === null) void endSession(true, "timeout");
    }, 15_000);
    return () => clearInterval(timer);
  }, [active]);
}

/** Step one's words for what went wrong. */
function findMessage(t: ReturnType<typeof useI18n>["t"], problem: FindProblem, phone: string): string {
  switch (problem) {
    case "needBoth":
      return t("code.needBoth");
    case "notFound":
      return t("code.notFound", { phone });
    case "tooMany":
      return t("code.tooMany");
    case "proof":
      return t("code.proof", { phone });
    case "closed":
      return t("code.closed", { phone });
    default:
      return codeMessage(t, problem as CodeProblem, phone);
  }
}

export { findMessage };

/** Find the person, then email them a code; each miss lands on step one in words. */
async function findAndSend(side: LookupSide, mobile: string, bornOn: string): Promise<void> {
  try {
    const found = await findMe(mobile, bornOn);
    if (found === null) {
      setLookup(side, { problem: "notFound", ended: null });
      return;
    }
  } catch (error) {
    setLookup(side, { problem: lookupProblem(error instanceof PortError ? error.code : ""), ended: null });
    return;
  }
  try {
    const sent = await sendCode({ purpose: "verify" });
    setLookup(side, { step: "code", sent, sentAt: performance.now(), problem: null, ended: null });
  } catch (error) {
    // No code could go out: nothing is left open behind step one.
    await signOutPatient();
    setLookup(side, { problem: codeProblem(error instanceof PortError ? error.code : ""), ended: null });
  }
}

/**
 * Step one and the code step for one side. `children` is what shows once the
 * person is verified.
 */
export function VerifyFlow({ side, findLabel, phone, children }: { side: LookupSide; findLabel: string; phone: string; children: ReactNode }) {
  const { t } = useI18n();
  const lookup = useFlow((s) => s[side]);
  const verified = useVerified();
  const [busy, setBusy] = useState(false);
  useSessionWatch(verified);

  // The demo card's "Fill Leila Farsi" / "Fill a shared number".
  useDemoSignal(side === "visits" ? "visits.fill" : "prefs.fill", (p) => {
    setLookup(side, { mobile: p["mobile"] ?? "", bornOn: p["bornOn"] ?? "", problem: null, step: "find", sent: null, ended: null });
  });

  if (verified) return <>{children}</>;

  const find = async () => {
    const mobile = lookup.mobile.trim();
    const bornOn = lookup.bornOn.trim();
    if (mobile === "" || bornOn === "") {
      setLookup(side, { problem: "needBoth" });
      return;
    }
    setBusy(true);
    try {
      await findAndSend(side, mobile, bornOn);
    } finally {
      setBusy(false);
    }
  };

  if (lookup.step === "code" && lookup.sent !== null && usePatients.getState().found !== null) {
    return (
      <CodeStep
        prefix={side === "visits" ? "mv" : "pr"}
        sent={lookup.sent}
        sentAt={lookup.sentAt}
        phone={phone}
        onVerified={() => setLookup(side, { step: "in", sent: null })}
        onResent={(sent) => setLookup(side, { sent, sentAt: performance.now() })}
        onBack={() => {
          void signOutPatient();
          setLookup(side, { step: "find", sent: null, problem: null });
        }}
        onSessionEnded={() => void endSession(true, "timeout")}
      />
    );
  }

  const errId = `${side}-find-err`;
  const invalid = lookup.problem === "notFound";
  return (
    <section style={cardStyle}>
      {lookup.ended !== null && (
        <Notice style={{ marginBlockEnd: 12 }}>{lookup.ended === "emailChanged" ? t("code.endedEmail") : t("code.ended")}</Notice>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
          <TextInput
            id={`${side}-mobile`}
            label={t("code.mobile")}
            value={lookup.mobile}
            onChange={(v) => setLookup(side, { mobile: v, problem: null })}
            placeholder="07700 900000"
            isMono
            type="tel"
            autoComplete="tel"
            invalid={invalid}
            describedBy={lookup.problem !== null ? errId : undefined}
          />
          <TextInput
            id={`${side}-born`}
            label={t("code.bornOn")}
            value={lookup.bornOn}
            onChange={(v) => setLookup(side, { bornOn: v, problem: null })}
            placeholder="2001-09-27"
            isMono
            autoComplete="bday"
            inputMode="numeric"
            invalid={invalid}
            describedBy={lookup.problem !== null ? errId : undefined}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBlockStart: 12 }}>
          <Btn kind="ghostSm" type="submit" icon={Search} busy={busy}>
            {findLabel}
          </Btn>
        </div>
      </form>
      {lookup.problem !== null && (
        <Notice id={errId} style={{ marginBlockStart: 12 }}>
          {findMessage(t, lookup.problem, phone)}
        </Notice>
      )}
    </section>
  );
}
