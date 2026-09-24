/**
 * The pieces the desk's sheets share that the kit does not draw: the small
 * upper-case section label, a field label in the sheets' own size, the
 * coloured note boxes (an error, a warning, a line of information), a
 * textarea, a search hit, a checkbox row, and the saving guard every sheet's
 * main button goes through.
 */
import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";

import { useI18n } from "../../i18n/index.tsx";
import type { Outcome, Refusal } from "../../state/actions.ts";
import { MONO, Tile, kicker, mono } from "../../components/ui.tsx";

/** A field's label inside a sheet (the design's `labelStyle`). */
export const labelText: CSSProperties = { fontSize: 11.5, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" };

/** The design's textarea. */
export const areaStyle: CSSProperties = {
  width: "100%",
  minHeight: 72,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  color: "var(--fg)",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.55,
  fontFamily: "inherit",
  resize: "vertical",
};

/** A section's upper-case label ("1 · Who"). */
export function SectionLabel({ children, id, as = "div" }: { children: ReactNode; id?: string; as?: "div" | "h3" }) {
  const Tag = as;
  return (
    <Tag id={id} style={{ ...kicker, margin: 0 }}>
      {children}
    </Tag>
  );
}

const TONES = {
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  info: { bg: "var(--info-soft)", fg: "var(--info)" },
  pos: { bg: "var(--pos-soft)", fg: "var(--pos)" },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
} as const;

/** A coloured note: an error (`alert`), a warning, a line of information, a result (`status`). */
export function Note({
  tone,
  icon: Icon,
  children,
  role,
  id,
  style,
  strong = false,
}: {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  children: ReactNode;
  role?: "alert" | "status";
  id?: string;
  style?: CSSProperties;
  /** The heavier weight the design gives a result line (13 px / 800). */
  strong?: boolean;
}) {
  const c = TONES[tone];
  return (
    <div
      id={id}
      role={role}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: strong ? "12px 13px" : "11px 12px",
        borderRadius: 12,
        background: c.bg,
        color: c.fg,
        fontSize: strong ? 13 : 12.5,
        fontWeight: strong ? 800 : 700,
        lineHeight: 1.5,
        ...style,
      }}
    >
      <Icon size={strong ? 16 : 14} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: strong ? 1 : 2 }} />
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

/** A search hit: a tile, the name, a mono line under it. */
export function HitRow({ name, meta, color, onClick, pressed }: { name: string; meta: string; color: string; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      type="button"
      className="rh-row"
      onClick={onClick}
      aria-pressed={pressed}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: 9, borderRadius: 11, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "start" }}
    >
      <Tile name={name} color={color} size={32} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--fg)" }}>{name}</span>
        <span style={{ ...mono(11, 600, "var(--fg-subtle)"), whiteSpace: "normal", alignSelf: "flex-start" }}>{meta}</span>
      </span>
    </button>
  );
}

/** The design's tick box (22 px, or 20 px in Send them off). */
export function TickBox({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size > 20 ? 7 : 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...(on ? { background: "var(--accent)", color: "var(--accent-fg)" } : { border: "1.5px solid var(--border-strong)", color: "transparent" }),
      }}
    >
      <Check size={13} />
    </span>
  );
}

/** A mono pill's text style, for the few pills the kit's helpers do not cover. */
export const monoText = (size: number, color: string): CSSProperties => ({ fontFamily: MONO, fontSize: size, fontWeight: 600, color, letterSpacing: "-.01em" });

/**
 * The saving guard: `run` does nothing while a save is running (a second
 * click before the button has re-drawn as busy), and `busy` spins the button.
 */
export function useSaving(): { busy: boolean; run: <T>(work: () => Promise<Outcome<T>>) => Promise<Outcome<T> | null> } {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = useCallback(async <T,>(work: () => Promise<Outcome<T>>): Promise<Outcome<T> | null> => {
    if (running.current) return null;
    running.current = true;
    setBusy(true);
    try {
      return await work();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

/** A refusal in the desk's words. */
export function useRefusal(): (reason: Refusal) => string {
  const { t } = useI18n();
  return (reason) => t(`refusal.${reason}`);
}
