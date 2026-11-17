/**
 * The pieces paying online adds to the patients' pages, drawn as the design
 * draws them: the two ways to pay, "Taking you to the secure payment page…",
 * "Checking your payment…", a payment that did not finish, and the test band
 * a staff member sees while rehearsing.
 *
 * Every status here is polite (`role="status"`): it says how things stand,
 * and the patient chooses what to do next.
 */
import { useRef, type KeyboardEvent } from "react";
import { CircleAlert, FlaskConical, Loader2 } from "lucide-react";

import { useI18n } from "../../i18n/index.tsx";
import { DEMO } from "../../surface.ts";
import { usePaying } from "./paying.ts";

export type PayChoice = "now" | "desk";

const spin = { animation: "rh-spin 0.9s linear infinite", flexShrink: 0 } as const;

/** "How to pay": Pay now, or pay at the desk on the day. Arrow keys move between the two, as in any radio group. */
export function PayChoices({ choice, onChoice }: { choice: PayChoice; onChoice: (next: PayChoice) => void }) {
  const { t } = useI18n();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const options: { id: PayChoice; title: string; sub: string }[] = [
    { id: "now", title: t("pay.now"), sub: t("pay.nowSub") },
    { id: "desk", title: t("pay.desk"), sub: t("pay.deskSub") },
  ];
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, at: number) => {
    const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (at + step + options.length) % options.length;
    onChoice(options[next]!.id);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={t("pay.howPay")} style={{ display: "flex", flexDirection: "column", gap: 8, marginBlockStart: 14 }}>
      {options.map((option, i) => {
        const on = option.id === choice;
        return (
          <button
            key={option.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className="rh-chip"
            onClick={() => onChoice(option.id)}
            onKeyDown={(event) => onKey(event, i)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 11,
              padding: "11px 12px",
              borderRadius: 12,
              border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
              background: on ? "var(--accent-soft)" : "var(--surface)",
              color: "var(--fg)",
              textAlign: "start",
              cursor: "pointer",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                flexShrink: 0,
                marginBlockStart: 2,
                borderRadius: "50%",
                border: `2px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
                boxShadow: on ? "inset 0 0 0 3px var(--surface), inset 0 0 0 8px var(--accent)" : "none",
              }}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.018em" }}>{option.title}</span>
              <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-muted)", textWrap: "pretty" }}>{option.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** "Taking you to the secure payment page…", with where they will pay. */
export function TakingBox({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div role="status" style={{ display: "flex", flexDirection: "column", gap: 9, marginBlockStart: compact ? 0 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: compact ? 0 : 44, padding: compact ? "10px 12px" : "8px 12px", borderRadius: compact ? 11 : 12, background: "var(--accent-soft)", color: "var(--fg)", fontSize: compact ? 12.5 : 13, fontWeight: 800, textAlign: "center" }}>
        <Loader2 size={16} aria-hidden="true" style={spin} />
        <span>{t("pay.taking")}</span>
      </div>
      {!compact && <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)" }}>{t("pay.nowSub")}</span>}
    </div>
  );
}

/** "Checking your payment…": back from the pay page, while the payment is written down. */
export function CheckingBox({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, marginBlockStart: compact ? 0 : 14, padding: "10px 12px", borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 12.5, fontWeight: 800, color: "var(--fg)" }}>
      <Loader2 size={15} aria-hidden="true" style={spin} />
      <span>{t("pay.checking")}</span>
    </div>
  );
}

/** "The payment didn't finish. Nothing was taken." — and what they can do. */
export function FailedBox({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div role="status" style={{ marginBlockStart: compact ? 0 : 14, display: "flex", flexDirection: "column", gap: 5, padding: compact ? "10px 12px" : "12px 13px", borderRadius: compact ? 11 : 12, background: "var(--warn-soft)" }}>
      <span style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, fontWeight: 800, lineHeight: 1.5, color: "var(--fg)", textWrap: "pretty" }}>
        <CircleAlert size={15} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 1, color: "var(--warn)" }} />
        {t("pay.failTitle")}
      </span>
      {!compact && <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", paddingInlineStart: 23, textWrap: "pretty" }}>{t("pay.failBody")}</span>}
    </div>
  );
}

/**
 * A staff member rehearsing the pages in test mode: once, across the top of
 * every page. In the website's demo, which takes payments with no money at
 * all, the line says so instead.
 */
export function TestBand() {
  const { t } = useI18n();
  const test = usePaying((s) => s.test);
  const online = usePaying((s) => s.online === true);
  if (DEMO && online) {
    return (
      <div role="note" style={{ display: "flex", alignItems: "center", gap: 9, marginBlockEnd: 16, padding: "9px 14px", borderRadius: 12, background: "var(--surface-2)", border: "1px dashed var(--border-strong)", color: "var(--fg-muted)", fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
        <FlaskConical size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>{t("pay.demoLine")}</span>
      </div>
    );
  }
  if (!test) return null;
  return (
    <div role="status" style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBlockEnd: 16, padding: "10px 14px", borderRadius: 12, background: "var(--warn-soft)", color: "var(--fg)", fontSize: 12.5, fontWeight: 700, lineHeight: 1.5, textWrap: "pretty" }}>
      <FlaskConical size={15} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 1, color: "var(--warn)" }} />
      <span>{t("pay.testBand")}</span>
    </div>
  );
}
