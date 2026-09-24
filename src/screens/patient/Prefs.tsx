/**
 * Reminders & my details (P10): after the code, the patient's mobile (shown,
 * not changed here — no step confirms a new number, so the desk changes it),
 * their email, whether and when to be reminded, and "Save how we contact
 * you".
 *
 * A new email is confirmed by a code sent to the NEW address; the old one is
 * told about the change. The reminder choices are saved first, so a changed
 * address never loses them. Once the address changes, the server ends every
 * session of that person — this one too — and the page asks them to find
 * themselves again.
 */
import { useEffect, useState } from "react";
import { Check, KeyRound, Mail, RotateCw } from "lucide-react";

import type { CodeSent, OwnDetails } from "../../data/ports.ts";
import { PortError } from "../../data/ports.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Btn, Chip, Switch, cardStyle, mono } from "../../components/ui.tsx";
import { ageOn, num } from "../../lib/format.ts";
import { checkCode, loadMyDetails, savePrefs, sendCode, usePatients } from "../../state/patients.ts";
import { toast } from "../../state/ui.ts";
import { CodeBoxes, CodeStep, EMPTY_CODE, codeMessage, countdownLabel, useCountdown } from "./CodeStep.tsx";
import { forgetSession } from "./flow.ts";
import { codeProblem, isEmail, sessionEnded, type CodeProblem } from "./logic.ts";
import { signOutHere } from "./MyVisits.tsx";
import { ClinicianTile, Notice, PageHead, TextInput, labelStyle, quietBtn, useCatalogue } from "./parts.tsx";
import { useTodayDay } from "./useToday.ts";
import { VerifyFlow, endSession } from "./VerifyFlow.tsx";

const LEADS = [12, 24, 48] as const;
const LEAD_KEY = { 12: "prefs.lead12", 24: "prefs.lead24", 48: "prefs.lead48" } as const;
const SAVED_KEY = { 12: "prefs.saved12", 24: "prefs.saved24", 48: "prefs.saved48" } as const;

export default function Prefs() {
  const { t } = useI18n();
  const cat = useCatalogue();
  return (
    <div className="rh-screen" data-screen="Prefs" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 660 }}>
      <PageHead title={t("prefs.title")} lede={t("prefs.lede")} />
      <VerifyFlow side="prefs" findLabel={t("prefs.find")} phone={cat?.settings?.phone ?? ""}>
        <Found />
      </VerifyFlow>
    </div>
  );
}

function Found() {
  const { t } = useI18n();
  const cat = useCatalogue();
  const found = usePatients((s) => s.found);
  const details = usePatients((s) => s.details);
  const today = useTodayDay();
  const [failed, setFailed] = useState(false);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    setFailed(false);
    loadMyDetails().catch(async (error: unknown) => {
      if (error instanceof PortError && sessionEnded(error.code)) await endSession(true, "timeout");
      else setFailed(true);
    });
  }, [again]);

  if (found === null || cat === null) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <ClinicianTile name={found.name} color={cat.visitTypes[0]?.color ?? "#3b6fbd"} size={44} />
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.026em" }}>{found.name}</span>
          <span style={mono(12, 600, "var(--fg-subtle)")}>{`${found.bornOn} · ${t("visits.age", { n: num(ageOn(found.bornOn, today)) })}`}</span>
        </span>
        <button type="button" className="rh-gi" onClick={() => void signOutHere()} style={{ ...quietBtn, marginInlineStart: "auto" }}>
          {t("visits.signOut")}
        </button>
      </div>
      {failed ? (
        <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>{t("pShell.offline")}</span>
          <Btn kind="ghostSm" icon={RotateCw} onClick={() => setAgain((n) => n + 1)}>
            {t("common.tryAgain")}
          </Btn>
        </div>
      ) : details === null ? (
        <div className="rh-skel" style={{ height: 320, borderRadius: 16 }} />
      ) : (
        <Form details={details} phone={cat.settings?.phone ?? ""} />
      )}
    </div>
  );
}

function Form({ details, phone }: { details: OwnDetails; phone: string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState(details.email ?? "");
  const [remind, setRemind] = useState(details.remind_email);
  const [lead, setLead] = useState(details.remind_lead_hours);
  const [badEmail, setBadEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<CodeProblem | null>(null);
  const [panel, setPanel] = useState<{ to: string; sent: CodeSent; sentAt: number } | null>(null);
  const [stepUp, setStepUp] = useState<{ sent: CodeSent; sentAt: number } | null>(null);
  const leads: number[] = LEADS.includes(lead as 12) ? [...LEADS] : [...LEADS, lead].sort((a, b) => a - b);

  const failedWith = async (error: unknown): Promise<void> => {
    const code = error instanceof PortError ? error.code : "";
    if (sessionEnded(code)) {
      await endSession(true, "timeout");
      return;
    }
    const kind = codeProblem(code);
    if (kind === "stepUp") {
      // The change needs a code confirmed in the last few minutes: confirm it is them again, then carry on.
      try {
        const sent = await sendCode({ purpose: "verify" });
        setStepUp({ sent, sentAt: performance.now() });
      } catch (again) {
        setProblem(codeProblem(again instanceof PortError ? again.code : ""));
      }
      return;
    }
    setProblem(kind);
  };

  const save = async () => {
    const next = email.trim();
    const changed = next !== (details.email ?? "");
    if (changed && !isEmail(next)) {
      setBadEmail(true);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      if (remind !== details.remind_email || lead !== details.remind_lead_hours || !changed) {
        await savePrefs({ remind_email: remind, remind_lead_hours: lead });
      }
      if (changed) {
        const sent = await sendCode({ purpose: "email-change", email: next });
        setPanel({ to: next, sent, sentAt: performance.now() });
      } else {
        const key = remind ? (lead in SAVED_KEY ? SAVED_KEY[lead as keyof typeof SAVED_KEY] : null) : "prefs.savedOff";
        toast(key === null ? t("prefs.savedN", { n: num(lead) }) : t(key), { icon: "check", tone: "pos" });
      }
    } catch (error) {
      await failedWith(error);
    } finally {
      setBusy(false);
    }
  };

  if (stepUp !== null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Notice>{t("prefs.stepUp")}</Notice>
        <CodeStep
          prefix="su"
          sent={stepUp.sent}
          sentAt={stepUp.sentAt}
          phone={phone}
          onVerified={() => {
            setStepUp(null);
            void save();
          }}
          onResent={(sent) => setStepUp({ sent, sentAt: performance.now() })}
          onBack={() => setStepUp(null)}
          onSessionEnded={() => void endSession(true, "timeout")}
        />
      </div>
    );
  }

  return (
    <section style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
        <TextInput
          id="pr-mobile"
          label={t("code.mobile")}
          value={details.mobile}
          readOnly
          isMono
          describedBy="pr-mobile-help"
          after={
            <span id="pr-mobile-help" style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-subtle)" }}>
              {t("prefs.mobileHelp")}
            </span>
          }
        />
        <TextInput
          id="pr-email"
          label={t("details.email")}
          value={email}
          type="email"
          autoComplete="email"
          onChange={(v) => {
            setEmail(v);
            setBadEmail(false);
          }}
          invalid={badEmail}
          describedBy={badEmail ? "pr-email-err pr-email-help" : "pr-email-help"}
          after={
            <>
              {badEmail && (
                <span id="pr-email-err" role="alert" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--danger)" }}>
                  {t("details.badEmail")}
                </span>
              )}
              <span id="pr-email-help" style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-subtle)" }}>
                {t("prefs.emailHelp")}
              </span>
            </>
          }
        />
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span id="pr-remind" style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" }}>
            {t("prefs.remind")}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("prefs.remindBody")}</span>
        </span>
        <Switch on={remind} onChange={setRemind} label={t("prefs.remind")} />
      </div>
      <div role="group" aria-labelledby="pr-when">
        <span id="pr-when" style={labelStyle}>
          {t("prefs.when")}
        </span>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBlockStart: 9 }}>
          {leads.map((h) => (
            <Chip key={h} on={lead === h} onClick={() => setLead(h)}>
              {h in LEAD_KEY ? t(LEAD_KEY[h as keyof typeof LEAD_KEY]) : t("prefs.leadN", { n: num(h) })}
            </Chip>
          ))}
        </div>
      </div>
      <Btn icon={Check} busy={busy} onClick={() => void save()}>
        {t("prefs.save")}
      </Btn>
      {problem !== null && <Notice>{codeMessage(t, problem, phone)}</Notice>}
      {panel !== null && (
        <NewAddress
          panel={panel}
          old={details.email}
          phone={phone}
          onResent={(sent) => setPanel({ ...panel, sent, sentAt: performance.now() })}
          onCancel={() => {
            setPanel(null);
            setEmail(details.email ?? "");
          }}
          onFailed={(error) => void failedWith(error)}
        />
      )}
    </section>
  );
}

/** The new-address panel: the code sent to the new address, confirm it, or keep the old one. */
function NewAddress({
  panel,
  old,
  phone,
  onResent,
  onCancel,
  onFailed,
}: {
  panel: { to: string; sent: CodeSent; sentAt: number };
  old: string | null;
  phone: string;
  onResent: (sent: CodeSent) => void;
  onCancel: () => void;
  onFailed: (error: unknown) => void;
}) {
  const { t } = useI18n();
  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  const [problem, setProblem] = useState<{ kind: CodeProblem | "short" | "wrong"; tries?: number } | null>(null);
  const [busy, setBusy] = useState<"check" | "resend" | null>(null);
  const left = useCountdown(panel.sentAt, panel.sent.resendAfter);

  const confirm = async () => {
    const code = digits.join("");
    if (code.length < 6) {
      setProblem({ kind: "short" });
      return;
    }
    setBusy("check");
    try {
      const result = await checkCode(code, "email-change");
      if (!result.ok) {
        setProblem(result.triesLeft > 0 ? { kind: "wrong", tries: result.triesLeft } : { kind: "locked" });
        return;
      }
      toast(t("prefs.changed", { email: panel.to }), { icon: "mail-check", tone: "pos" });
      // Every session of this person has ended (the server's rule after an address change): find yourself again.
      if (result.ended) forgetSession(true, "emailChanged");
      else await loadMyDetails();
    } catch (error) {
      const kind = codeProblem(error instanceof PortError ? error.code : "");
      if (kind === "sessionEnded" || kind === "stepUp") onFailed(error);
      else setProblem({ kind });
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    if (left > 0) return;
    setBusy("resend");
    try {
      onResent(await sendCode({ purpose: "email-change", email: panel.to }));
      setDigits(EMPTY_CODE);
      setProblem(null);
    } catch (error) {
      setProblem({ kind: codeProblem(error instanceof PortError ? error.code : "") });
    } finally {
      setBusy(null);
    }
  };

  const message = problem === null ? null : problem.kind === "wrong" ? t("prefs.newWrong", { email: panel.to }) : codeMessage(t, problem.kind, phone, problem.tries);
  return (
    <div role="region" aria-labelledby="prn-h" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 15, borderRadius: 14, border: "1px solid var(--accent)", background: "var(--accent-soft)" }}>
      <h2 id="prn-h" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em", color: "var(--accent)", lineHeight: "normal" }}>
        <Mail size={15} aria-hidden="true" />
        {t("prefs.newSent")}
      </h2>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>
        {old === null || old === "" ? t("prefs.newToNoOld", { email: panel.to }) : t("prefs.newTo", { email: panel.to, old })}
      </p>
      <CodeBoxes prefix="prn" digits={digits} onDigits={(d) => { setDigits(d); setProblem(null); }} onEnter={() => void confirm()} invalid={problem !== null} errorId="prn-code-err" />
      {message !== null && (
        // Over the panel's accent wash a translucent red loses contrast in the dark theme: lay it on the surface.
        <Notice tone="danger" id="prn-code-err" style={{ padding: "11px 12px", borderRadius: 11, background: "linear-gradient(var(--danger-soft), var(--danger-soft)), var(--surface)" }}>
          {message}
        </Notice>
      )}
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
        <Btn icon={KeyRound} busy={busy === "check"} onClick={() => void confirm()} style={{ height: 40 }}>
          {t("prefs.confirmNew")}
        </Btn>
        <Btn kind="ghost" busy={busy === "resend"} disabled={left > 0} onClick={() => void resend()} style={{ height: 40, ...(left > 0 ? { background: "var(--surface-2)", color: "var(--fg-subtle)", opacity: 1 } : {}) }}>
          {left > 0 ? t("code.resendIn", { time: countdownLabel(left) }) : t("code.resend")}
        </Btn>
        <button type="button" className="rh-gi" onClick={onCancel} style={{ height: 40, paddingInline: 12, borderRadius: 10, border: "none", background: "transparent", color: "var(--fg-muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          {t("prefs.keepOld")}
        </button>
      </div>
    </div>
  );
}
