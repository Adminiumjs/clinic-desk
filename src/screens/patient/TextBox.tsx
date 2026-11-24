/**
 * The box for visit texts, in every form that takes a mobile: a first
 * booking, registering, and the Prefs page once "Remind me by text" is on.
 *
 * It is its own box, never the email switch, and it starts unticked every
 * time it is drawn. Nothing waits on it: the form submits the same with it
 * empty, with no error, no nudge and no second question. Under the label it
 * says what a text holds (the practice's name, the date and the time) and how
 * to stop.
 *
 * Two numbers change its words, never the form: a mainland Chinese number
 * (+86), which no text ever goes to (the box is off, and the line says so; the
 * number still serves a phone call), and, with the box ticked, a number that
 * does not read as one ("Check this number so we can text you").
 *
 * These words are the ones Adminium's consent log keeps with a yes
 * (`manifest/texts.ts`): what the patient saw is what was recorded.
 */
import { useI18n } from "../../i18n/index.tsx";
import { boxState } from "../../lib/texts.ts";

export function TextBox({ id, phone, checked, onChange, style }: { id: string; phone: string; checked: boolean; onChange: (next: boolean) => void; style?: React.CSSProperties }) {
  const { t } = useI18n();
  const state = boxState(phone, checked);
  const china = state.kind === "china";
  const subId = `${id}-sub`;
  const hintId = `${id}-hint`;
  const checkId = `${id}-check`;
  return (
    <div
      data-part="text-box"
      style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "12px 13px", borderRadius: 13, border: "1px solid var(--border)", background: "var(--surface-2)", ...style }}
    >
      <input
        id={id}
        type="checkbox"
        // Off for a number no text can go to: whatever was ticked before, nothing is sent there.
        checked={checked && !china}
        disabled={china}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={[subId, hintId, state.kind === "check" ? checkId : ""].filter((x) => x !== "").join(" ")}
        style={{ width: 18, height: 18, margin: "1px 0 0", flexShrink: 0, accentColor: "var(--accent)", cursor: china ? "not-allowed" : "pointer" }}
      />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <label htmlFor={id} style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.4, color: china ? "var(--fg-subtle)" : "var(--fg)", cursor: china ? "not-allowed" : "pointer", textWrap: "pretty" }}>
          {t("texts.box.label")}
        </label>
        <span id={subId} style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: "var(--fg-muted)", textWrap: "pretty" }}>
          {t("texts.box.sub")}
        </span>
        <span id={hintId} aria-live="polite" style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.55, color: china ? "var(--warn)" : "var(--fg-subtle)", textWrap: "pretty" }}>
          {china ? t("texts.box.cn") : t("texts.box.optional")}
        </span>
        {state.kind === "check" && (
          <span id={checkId} role="status" style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.5, color: "var(--warn)", textWrap: "pretty" }}>
            {t("texts.box.check")}
          </span>
        )}
      </span>
    </div>
  );
}
