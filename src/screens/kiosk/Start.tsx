/**
 * The kiosk's start: a welcome, the date of birth in three boxes and the
 * mobile, what the last "Check in" found, and the button.
 *
 * Built for a tablet with an on-screen keyboard: every box asks for the number
 * pad, a full box moves on to the next one, Enter checks in from any of them,
 * and nothing is ever filled in from the browser's memory — the last person's
 * number must never be offered to the next.
 */
import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import { LogIn } from "lucide-react";

import { Btn, mono } from "../../components/ui.tsx";
import { useI18n } from "../../i18n/index.tsx";
import { time } from "../../lib/format.ts";
import { digitsOf, noteLook, type KioskNote } from "./logic.ts";

export interface Fields {
  day: string;
  month: string;
  year: string;
  mobile: string;
}

const box: CSSProperties = {
  ...mono(18, 600, "var(--fg)"),
  width: "100%",
  minWidth: 0,
  height: 56,
  boxSizing: "border-box",
  borderRadius: 14,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  paddingInline: 12,
  textAlign: "center",
};
const label: CSSProperties = { fontSize: 13, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" };

const MSG_ID = "k-msg";

export function Start({
  fields,
  onField,
  note,
  busy,
  onCheck,
  refs,
}: {
  fields: Fields;
  onField: (next: Partial<Fields>) => void;
  note: KioskNote | null;
  busy: boolean;
  onCheck: () => void;
  /** The four boxes in order (day, month, year, mobile), for moving on and for focus. */
  refs: RefObject<(HTMLInputElement | null)[]>;
}) {
  const { t } = useI18n();
  const look = note === null ? null : noteLook(note);
  const described = look === null ? undefined : MSG_ID;
  const invalid = look?.invalid === true ? true : undefined;

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCheck();
    }
  };
  /** A date box keeps its digits (at most `max`), and a full one hands on to the next box. */
  const dateBox = (index: 0 | 1 | 2, name: "day" | "month" | "year", max: number) => ({
    ref: (el: HTMLInputElement | null) => {
      refs.current[index] = el;
    },
    value: fields[name],
    onChange: (e: { target: { value: string } }) => {
      const value = digitsOf(e.target.value).slice(0, max);
      onField({ [name]: value });
      if (value.length === max) refs.current[index + 1]?.focus();
    },
  });

  return (
    <section
      className="rh-screen"
      aria-labelledby="k-h"
      style={{ width: "min(560px, 100%)", boxSizing: "border-box", padding: "clamp(22px, 4vw, 36px)", borderRadius: 22, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 id="k-h" style={{ margin: 0, fontSize: "clamp(25px, 3.8vw, 33px)", fontWeight: 800, letterSpacing: "-.036em", lineHeight: 1.12, textWrap: "pretty" }}>
          {t("kiosk.title")}
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 15.5, fontWeight: 500, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("kiosk.lede")}</p>
      </div>

      <div role="group" aria-labelledby="k-dob-l" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span id="k-dob-l" style={label}>
          {t("kiosk.dob")}
        </span>
        {/* Day, month, year read left to right in every language, as a date of birth is written on a form. */}
        <div dir="ltr" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.6fr", gap: 10 }}>
          {(
            [
              [0, "day", 2, "kiosk.day", "kiosk.dayHint"],
              [1, "month", 2, "kiosk.month", "kiosk.monthHint"],
              [2, "year", 4, "kiosk.year", "kiosk.yearHint"],
            ] as const
          ).map(([index, name, max, aria, hint]) => (
            <input
              key={name}
              {...dateBox(index, name, max)}
              className="rh-fld"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="next"
              maxLength={max + 2}
              placeholder={t(hint)}
              aria-label={t(aria)}
              aria-invalid={invalid}
              aria-describedby={described}
              onKeyDown={onKey}
              style={box}
            />
          ))}
        </div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={label}>{t("kiosk.mobile")}</span>
        {/* A phone number's digit groups keep their order in a right-to-left page. */}
        <input
          ref={(el) => {
            refs.current[3] = el;
          }}
          className="rh-fld"
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="off"
          enterKeyHint="go"
          value={fields.mobile}
          onChange={(e) => onField({ mobile: e.target.value })}
          onKeyDown={onKey}
          placeholder={t("kiosk.mobileHint")}
          aria-invalid={invalid}
          aria-describedby={described}
          style={{ ...box, textAlign: "start", paddingInline: 16 }}
        />
      </label>

      {note !== null && look !== null && (
        <div
          id={MSG_ID}
          role="alert"
          style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 16px", borderRadius: 14, fontSize: 15, fontWeight: 700, lineHeight: 1.55, textWrap: "pretty", background: `var(--${look.tone}-soft)`, color: `var(--${look.tone})` }}
        >
          <look.icon size={18} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 2 }} />
          <span>{note.kind === "early" ? t("kiosk.msg.early", { at: time(note.at), from: time(note.from) }) : t(look.key)}</span>
        </div>
      )}

      {/* The design's 19 px icon (the kit's is 16); the kit's spinner takes its place while it runs. */}
      <Btn busy={busy} onClick={onCheck} style={{ width: "100%", height: 56, fontSize: 16, borderRadius: 14 }}>
        {!busy && <LogIn size={19} aria-hidden="true" />}
        {t("kiosk.checkIn")}
      </Btn>
    </section>
  );
}
