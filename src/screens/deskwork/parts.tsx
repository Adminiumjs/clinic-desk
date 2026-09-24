/**
 * The pieces every desk-work screen is drawn from, as the design draws them:
 * the small upper-case kicker over a screen's title, the title itself, a
 * section card and its heading, and a list row's frame.
 */
import type { CSSProperties, ReactNode } from "react";

export const kickerStyle: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-subtle)" };
export const titleStyle: CSSProperties = { margin: "5px 0 0", fontSize: "clamp(21px, 2.8vw, 27px)", fontWeight: 800, letterSpacing: "-.032em", lineHeight: "normal", textWrap: "pretty" };
export const ledeStyle: CSSProperties = { margin: "8px 0 0", fontSize: 13.5, fontWeight: 500, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" };
export const cardStyle: CSSProperties = { padding: 18, borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)" };
export const sectionTitle: CSSProperties = { margin: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: "-.024em", lineHeight: "normal" };
/** A group's small heading ("OVERDUE", "CLOSURES AHEAD"). */
export const groupLabel: CSSProperties = { margin: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--fg-muted)" };
/** A list row's frame. */
export const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 15px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" };
export const nameStyle: CSSProperties = { fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" };
export const dashedNote: CSSProperties = { padding: 20, borderRadius: 14, border: "1px dashed var(--border-strong)", background: "var(--surface-2)", fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" };
export const footNote: CSSProperties = { margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" };

/** A screen's head: the kicker, the title (the page's one h1), an optional line and whatever sits at its end. */
export function ScreenHead({ kicker, title, lede, ledeWidth = "52ch", end }: { kicker: ReactNode; title: ReactNode; lede?: ReactNode; ledeWidth?: string; end?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={kickerStyle}>{kicker}</div>
        <h1 style={titleStyle}>{title}</h1>
        {lede !== undefined && <p style={{ ...ledeStyle, maxWidth: ledeWidth }}>{lede}</p>}
      </div>
      {end !== undefined && <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{end}</div>}
    </div>
  );
}

/** The screen's column. */
export function Screen({ name, children, style }: { name: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section className="rh-screen" data-screen={name} style={{ display: "flex", flexDirection: "column", gap: 14, ...style }}>
      {children}
    </section>
  );
}
