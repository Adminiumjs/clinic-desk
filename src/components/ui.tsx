/**
 * The design's building blocks, drawn exactly as Rowan Health draws them.
 *
 * The design styles everything inline through a handful of helpers — a
 * primary button is 44 px high with a 12 px radius and 13.5/800 type, a chip
 * is 33 px, a field 40 px — and every screen builds from those. They are here
 * once, as style functions with the design's own names (`btnPrimary`,
 * `chipStyle`, `pill`, `tile` …) and as the few components that carry
 * behaviour (a button that shows it is saving, a switch, the side sheet and
 * the dialog with their focus and Escape handling, the toast). A screen that
 * needs a new look adds it here rather than re-typing a style.
 *
 * The `rh-*` classes (`styles/rh.css`) add the hover, press and focus states
 * an inline style cannot say.
 */
import { useEffect, useId, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, CheckCheck, Circle, CircleX, DoorOpen, Loader2, LogIn, UserRoundCheck, UserRoundX, X } from "lucide-react";

import type { AppointmentStatus } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { initials, rgba, soft, tileBg, tint } from "../lib/color.ts";
import { useUi } from "../state/ui.ts";

export const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** Whether the dark theme is showing (the colour helpers need to know). */
export const useDark = (): boolean => useUi((s) => s.theme === "dark");

// ── style helpers (the design's own) ────────────────────────────────────────

export const mono = (size = 12.5, weight = 600, color = "var(--fg)"): CSSProperties => ({
  fontFamily: MONO,
  fontSize: size,
  fontWeight: weight,
  color,
  letterSpacing: "-.01em",
  whiteSpace: "nowrap",
});
export const pill = (bg: string, fg: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 800,
  padding: "4px 9px",
  borderRadius: 999,
  background: bg,
  color: fg,
  whiteSpace: "nowrap",
});
export const monoPill = (bg: string, fg: string): CSSProperties => ({ ...pill(bg, fg), fontFamily: MONO, fontSize: 11.5, fontWeight: 600 });
export const dotStyle = (hex: string, dark: boolean, size = 8): CSSProperties => ({ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: tint(hex, dark) });
export const tileStyle = (hex: string, dark: boolean, size = 32): CSSProperties => ({
  width: size,
  height: size,
  flexShrink: 0,
  borderRadius: Math.round(size * 0.32),
  background: tileBg(hex, dark),
  border: `1px solid ${rgba(hex, dark ? 0.28 : 0.2)}`,
  color: tint(hex, dark),
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: Math.max(10, Math.round(size * 0.36)),
  fontWeight: 800,
  letterSpacing: "-.02em",
});
export const navStyle = (on: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  height: 37,
  paddingInline: 11,
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "-.01em",
  textAlign: "start",
  background: on ? "var(--accent-soft)" : "transparent",
  color: on ? "var(--accent)" : "var(--fg-muted)",
});
export const segStyle = (on: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 28,
  paddingInline: 11,
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
  background: on ? "var(--accent)" : "transparent",
  color: on ? "var(--accent-fg)" : "var(--fg-subtle)",
});
export const segWide = (on: boolean): CSSProperties => ({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 34,
  paddingInline: 12,
  borderRadius: 9,
  border: "none",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 700,
  textAlign: "center",
  background: on ? "var(--accent)" : "transparent",
  color: on ? "var(--accent-fg)" : "var(--fg-subtle)",
});
/** The track a segmented control sits in. */
export const segTrack: CSSProperties = { display: "flex", gap: 3, padding: 3, borderRadius: 11, border: "1px solid var(--border)", background: "var(--surface-2)" };
export const chipStyle = (on: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 33,
  paddingInline: 13,
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
  border: `1px solid ${on ? "transparent" : "var(--border-strong)"}`,
  background: on ? "var(--accent)" : "var(--surface)",
  color: on ? "var(--accent-fg)" : "var(--fg-muted)",
});
export const cardStyle: CSSProperties = { padding: 18, borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)" };
export const fieldStyle = (isMono = false): CSSProperties => ({
  width: "100%",
  height: 40,
  paddingInline: 12,
  borderRadius: 11,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  color: "var(--fg)",
  fontSize: 13,
  fontWeight: isMono ? 600 : 700,
  ...(isMono ? { fontFamily: MONO } : {}),
});
export const btnPrimary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 44,
  paddingInline: 18,
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "var(--accent-fg)",
  fontSize: 13.5,
  fontWeight: 800,
  letterSpacing: "-.01em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
export const btnGhost: CSSProperties = { ...btnPrimary, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg)" };
export const btnGhostSm: CSSProperties = {
  ...btnGhost,
  gap: 7,
  height: 36,
  paddingInline: 14,
  borderRadius: 10,
  fontSize: 12.5,
};
export const iconBtnStyle: CSSProperties = {
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: 9,
  border: "1px solid var(--border-strong)",
  background: "var(--surface)",
  color: "var(--fg-muted)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
export const stepBadge = (on: boolean): CSSProperties => ({
  width: 24,
  height: 24,
  flexShrink: 0,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: MONO,
  fontSize: 11.5,
  fontWeight: 700,
  background: on ? "var(--accent)" : "var(--surface-3)",
  color: on ? "var(--accent-fg)" : "var(--fg-subtle)",
});
/** A section's small upper-case label ("1 · Who"). */
export const kicker: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-subtle)" };
/** A screen's title and the line under it. */
export const screenTitle: CSSProperties = { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.035em", lineHeight: "normal", textWrap: "pretty" };
export const screenSub: CSSProperties = { margin: "6px 0 0", fontSize: 14, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" };

// ── a visit's status ────────────────────────────────────────────────────────

/** The design's colours and icon for each status (`statusMeta`). */
export const STATUS_META: Record<AppointmentStatus, { bg: string; fg: string; icon: LucideIcon }> = {
  booked: { bg: "var(--surface-3)", fg: "var(--fg-subtle)", icon: Circle },
  checked_in: { bg: "var(--info-soft)", fg: "var(--info)", icon: LogIn },
  roomed: { bg: "var(--info-soft)", fg: "var(--info)", icon: DoorOpen },
  with_clinician: { bg: "var(--pos-soft)", fg: "var(--pos)", icon: UserRoundCheck },
  ready: { bg: "var(--pos-soft)", fg: "var(--pos)", icon: CheckCheck },
  seen: { bg: "var(--surface-3)", fg: "var(--fg-subtle)", icon: Check },
  no_show: { bg: "var(--danger-soft)", fg: "var(--danger)", icon: UserRoundX },
  cancelled: { bg: "var(--surface-3)", fg: "var(--fg-subtle)", icon: CircleX },
};

export function StatusPill({ status }: { status: AppointmentStatus }) {
  const { t } = useI18n();
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span style={pill(meta.bg, meta.fg)}>
      <Icon size={11} strokeWidth={2.4} aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}

// ── components ──────────────────────────────────────────────────────────────

type BtnKind = "primary" | "ghost" | "ghostSm" | "danger";
const BTN: Record<BtnKind, CSSProperties> = {
  primary: btnPrimary,
  ghost: btnGhost,
  ghostSm: btnGhostSm,
  // The ink on a solid fill is the theme's: white on light, dark on dark mode's paler red.
  danger: { ...btnPrimary, background: "var(--danger)", color: "var(--accent-fg)" },
};

/**
 * A button. `busy` shows it is saving (spinner, disabled) — nothing on the
 * desk pretends a save is done before the server has answered.
 */
export function Btn({
  kind = "primary",
  icon: Icon,
  busy = false,
  disabled = false,
  onClick,
  children,
  style,
  type = "button",
  label,
}: {
  kind?: BtnKind;
  icon?: LucideIcon;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  style?: CSSProperties;
  type?: "button" | "submit";
  /** The accessible name, when the button's text alone does not say it. */
  label?: string;
}) {
  const size = kind === "ghostSm" ? 14 : 16;
  return (
    <button
      type={type}
      className="rh-btn"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={label}
      style={{ ...BTN[kind], ...style }}
    >
      {busy ? <Loader2 size={size} aria-hidden="true" style={{ animation: "rh-spin 0.9s linear infinite" }} /> : Icon !== undefined ? <Icon size={size} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/** A 32 px icon button; its name is required (it has no text). */
export function IconBtn({ icon: Icon, label, onClick, style, pressed }: { icon: LucideIcon; label: string; onClick?: () => void; style?: CSSProperties; pressed?: boolean }) {
  return (
    <button type="button" className="rh-gi" onClick={onClick} aria-label={label} title={label} aria-pressed={pressed} style={{ ...iconBtnStyle, ...style }}>
      <Icon size={15} aria-hidden="true" />
    </button>
  );
}

/** A choice chip: pressed or not. */
export function Chip({ on, onClick, children, icon: Icon, style, disabled }: { on: boolean; onClick: () => void; children: ReactNode; icon?: LucideIcon; style?: CSSProperties; disabled?: boolean }) {
  return (
    <button type="button" className="rh-chip" onClick={onClick} aria-pressed={on} disabled={disabled} style={{ ...chipStyle(on), ...(disabled ? { opacity: 0.5, cursor: "not-allowed" } : {}), ...style }}>
      {Icon !== undefined && <Icon size={14} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** The design's switch (52 × 30), a real `role="switch"` with its state. */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className="rh-gi"
      onClick={() => onChange(!on)}
      style={{
        position: "relative",
        width: 52,
        height: 30,
        flexShrink: 0,
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background .16s ease",
        background: on ? "var(--accent)" : "var(--surface-3)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          insetBlockStart: 4,
          insetInlineStart: on ? 26 : 4,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: on ? "var(--accent-fg)" : "var(--fg-subtle)",
          transition: "inset-inline-start .16s ease",
        }}
      />
    </button>
  );
}

/** A labelled field: the label above, the input, an optional hint or error below. */
export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>
        {label}
      </label>
      {children}
      {error !== undefined && error !== null && error !== false ? (
        <div role="alert" style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>
          {error}
        </div>
      ) : hint !== undefined ? (
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)", lineHeight: 1.5 }}>{hint}</div>
      ) : null}
    </div>
  );
}

/** A person's or a clinician's initials in their colour's tile. */
export function Tile({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  const dark = useDark();
  return (
    <span aria-hidden="true" style={tileStyle(color, dark, size)}>
      {initials(name)}
    </span>
  );
}

/** An icon in a coloured tile (a visit type's). */
export function IconTile({ icon: Icon, color, size = 32 }: { icon: LucideIcon; color: string; size?: number }) {
  const dark = useDark();
  return (
    <span aria-hidden="true" style={tileStyle(color, dark, size)}>
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  const dark = useDark();
  return <span aria-hidden="true" style={dotStyle(color, dark, size)} />;
}

/** A colour's soft pill (a visit type, a clinician). */
export function ColorPill({ color, children }: { color: string; children: ReactNode }) {
  const dark = useDark();
  return <span style={pill(soft(color, dark), tint(color, dark))}>{children}</span>;
}

export function Skeleton({ height, width = "100%", radius = 12 }: { height: number; width?: number | string; radius?: number }) {
  return <div className="rh-skel" aria-hidden="true" style={{ height, width, borderRadius: radius }} />;
}

const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])";

/**
 * What every layer over the page does with the keyboard: focus moves into it
 * when it opens, Tab stays inside it, Escape closes it, and focus goes back to
 * whatever opened it when it closes. The sheets and dialogs below use it, and
 * so do the layers drawn differently (the visit panel, the phone menu).
 */
export function useModal(root: RefObject<HTMLElement | null>, onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = root.current?.querySelector<HTMLElement>("input, textarea, select, button:not([data-close]):not(:disabled)") ?? root.current;
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || root.current === null) return;
      const focusable = [...root.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const firstEl = focusable[0]!;
      const lastEl = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      before?.focus?.({ preventScroll: true });
    };
    // Mount-only: the layer's own lifetime is the modal's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export type Tone = "accent" | "neutral" | "danger" | "warn" | "pos";
/** A tone's tile: its soft background and its ink. `neutral` is a question with nothing wrong in it. */
export const toneTile = (tone: Tone): [string, string] =>
  tone === "accent" ? ["var(--accent-soft)", "var(--accent)"] : tone === "neutral" ? ["var(--surface-3)", "var(--fg-muted)"] : [`var(--${tone}-soft)`, `var(--${tone})`];

/**
 * The design's side sheet: a scrim, and a 460 px panel at the inline end
 * with an icon tile, a title, a line under it, a close button, then the body.
 */
export function Sheet({
  icon: Icon,
  title,
  sub,
  onClose,
  children,
  width = 460,
  tone = "accent",
  lead,
  titleSize = 16.5,
  subStyle,
}: {
  icon: LucideIcon;
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  tone?: Tone;
  /** Drawn in place of the icon tile (a person's initials). */
  lead?: ReactNode;
  titleSize?: number;
  /** The line under the title, restyled (a reference in mono). */
  subStyle?: CSSProperties;
}) {
  const { t } = useI18n();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useModal(root, onClose);
  const [toneBg, toneFg] = toneTile(tone);
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 700, background: "var(--scrim)", backdropFilter: "blur(3px)", animation: "rh-scrim .16s ease", display: "flex", alignItems: "stretch", justifyContent: "flex-end", padding: 14 }}
    >
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="rh-scroll"
        style={{
          position: "relative",
          width: `min(${String(width)}px, 100%)`,
          maxHeight: "100%",
          overflowY: "auto",
          padding: 20,
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: "0 40px 90px -30px rgba(10,10,25,.6)",
          animation: "rh-sheet .2s cubic-bezier(.2,.7,.3,1)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          outline: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {lead ?? (
            <span aria-hidden="true" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: toneBg, color: toneFg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={18} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={id} style={{ margin: 0, fontSize: titleSize, fontWeight: 800, letterSpacing: "-.026em", lineHeight: "normal", textWrap: "pretty" }}>
              {title}
            </h2>
            {sub !== undefined && <div style={{ marginBlockStart: 4, fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty", ...subStyle }}>{sub}</div>}
          </div>
          <button type="button" data-close className="rh-gi" onClick={onClose} aria-label={t("common.close")} style={iconBtnStyle}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * The design's centred dialog (the cancel dialog, the move confirm): an icon
 * tile in the dialog's tone, a title, a line or two under it, then whatever
 * it asks.
 */
export function Dialog({
  icon: Icon,
  title,
  body,
  onClose,
  children,
  tone = "accent",
  width = 460,
  closeButton = false,
  alert = false,
}: {
  icon: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  tone?: Tone;
  width?: number;
  /** A close button in the corner (the move confirm has one; the cancel dialog does not). */
  closeButton?: boolean;
  /** Something the person must answer before carrying on (read out at once). */
  alert?: boolean;
}) {
  const { t } = useI18n();
  const titleId = useId();
  const bodyId = useId();
  const root = useRef<HTMLDivElement>(null);
  useModal(root, onClose);
  const [bg, fg] = toneTile(tone);
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 760, background: "var(--scrim)", backdropFilter: "blur(3px)", animation: "rh-scrim .16s ease", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}
    >
      <div
        ref={root}
        role={alert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={body === undefined ? undefined : bodyId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ width: `min(${String(width)}px, 100%)`, boxSizing: "border-box", padding: 22, borderRadius: 18, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "0 40px 90px -30px rgba(10,10,25,.6)", animation: "rh-pop .18s cubic-bezier(.2,.7,.3,1)", outline: "none" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span aria-hidden="true" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: "-.024em", lineHeight: "normal", textWrap: "pretty" }}>
              {title}
            </h2>
            {body !== undefined && (
              <p id={bodyId} style={{ margin: `${closeButton ? 4 : 6}px 0 0`, fontSize: closeButton ? 12.5 : 13, fontWeight: 600, lineHeight: closeButton ? 1.55 : 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
                {body}
              </p>
            )}
          </div>
          {closeButton && (
            <button type="button" data-close className="rh-gi" onClick={onClose} aria-label={t("common.close")} style={iconBtnStyle}>
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * A centred dialog drawn by its caller (the money dialogs, the receipt): the
 * scrim and a card of the dialog's own width, with `Dialog`'s keyboard. Pair
 * it with `ModalHead`, labelled by the head's title id.
 */
export function Modal({
  width,
  onClose,
  labelledBy,
  label,
  children,
  bare = false,
  zIndex = 750,
  padding = 22,
  gap = 15,
}: {
  width: number;
  onClose: () => void;
  labelledBy?: string;
  label?: string;
  children: ReactNode;
  /** No card of its own (the receipt draws its paper and buttons itself). */
  bare?: boolean;
  zIndex?: number;
  padding?: number;
  /** The space between the dialog's blocks; 0 when each block carries its own margin. */
  gap?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useModal(root, onClose);
  const card: CSSProperties = bare
    ? { width: `min(${String(width)}px, 100%)`, display: "flex", flexDirection: "column", gap: 12 }
    : { width: `min(${String(width)}px, 100%)`, padding, borderRadius: 18, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "0 40px 90px -30px rgba(10,10,25,.6)", display: "flex", flexDirection: "column", gap };
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex, background: "var(--scrim)", backdropFilter: "blur(3px)", animation: "rh-scrim .16s ease", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}
    >
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ ...card, margin: "auto", outline: "none", animation: "rh-pop .18s cubic-bezier(.2,.7,.3,1)" }}
      >
        {children}
      </div>
    </div>
  );
}

/** A `Modal`'s header: icon tile, title (with the id the dialog is labelled by), the line under it, close. */
export function ModalHead({
  icon: Icon,
  tone = "accent",
  title,
  sub,
  subStyle,
  onClose,
  titleId,
  small = false,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  sub?: ReactNode;
  subStyle?: CSSProperties;
  onClose: () => void;
  titleId: string;
  /** The payment dialog's smaller head: a 34 px tile and a 15.5 px title. */
  small?: boolean;
}) {
  const { t } = useI18n();
  const [bg, fg] = toneTile(tone);
  const tile = small ? 34 : 38;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: small ? 11 : 12 }}>
      <span aria-hidden="true" style={{ width: tile, height: tile, flexShrink: 0, borderRadius: small ? 10 : 11, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={small ? 16 : 18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 id={titleId} style={{ margin: 0, fontSize: small ? 15.5 : 16.5, fontWeight: 800, letterSpacing: small ? "-.024em" : "-.026em", lineHeight: "normal", textWrap: "pretty" }}>
          {title}
        </h2>
        {sub !== undefined && <div style={{ marginBlockStart: 4, fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty", ...subStyle }}>{sub}</div>}
      </div>
      <button type="button" data-close className="rh-gi" onClick={onClose} aria-label={t("common.close")} style={iconBtnStyle}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

const TOAST_COLORS: Record<string, [string, string]> = {
  fg: ["var(--fg)", "var(--bg)"],
  // Solid fills take the theme's ink on solid (see `Btn`'s danger).
  pos: ["var(--pos)", "var(--accent-fg)"],
  warn: ["var(--warn)", "var(--accent-fg)"],
  danger: ["var(--danger)", "var(--accent-fg)"],
};

/** The toasts: a polite live region, so a screen reader hears "Saved" too. */
export function Toasts({ icons }: { icons: (name: string) => LucideIcon }) {
  const toasts = useUi((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: "fixed", insetInline: 0, insetBlockEnd: 92, zIndex: 800, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", paddingInline: 16 }}
    >
      {toasts.map((toast) => {
        const [bg, fg] = TOAST_COLORS[toast.tone] ?? TOAST_COLORS["fg"]!;
        const Icon = icons(toast.icon);
        return (
          <div
            key={toast.id}
            style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "11px 16px", borderRadius: 999, background: bg, color: fg, fontSize: 13, fontWeight: 700, boxShadow: "0 18px 36px -18px rgba(10,10,25,.5)", animation: "rh-pop .2s cubic-bezier(.2,.7,.3,1)", pointerEvents: "auto", maxWidth: "min(92vw,520px)", textWrap: "pretty" }}
          >
            <Icon size={16} aria-hidden="true" />
            {toast.text}
          </div>
        );
      })}
    </div>
  );
}

/** An empty list's message: an icon, a line, a quieter line. */
export function Empty({ icon: Icon, title, body }: { icon: LucideIcon; title: ReactNode; body?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 16px", textAlign: "center" }}>
      <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: "var(--surface-3)", color: "var(--fg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} />
      </span>
      <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.02em" }}>{title}</div>
      {body !== undefined && <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)", lineHeight: 1.55, maxWidth: 360 }}>{body}</div>}
    </div>
  );
}
