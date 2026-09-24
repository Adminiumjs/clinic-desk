/**
 * The small pieces the money and recall dialogs share: their error box and the
 * label over a field, as the design draws them. (The dialog frame itself is
 * the kit's `Modal` and `ModalHead`.)
 */
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** The design's error box inside a dialog (circle-alert, danger-soft). */
export function ErrorBox({ id, children, icon: Icon }: { id?: string; children: ReactNode; icon: LucideIcon }) {
  return (
    <div
      id={id}
      role="alert"
      style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 12px", borderRadius: 12, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}
    >
      <Icon size={14} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 2 }} />
      <span>{children}</span>
    </div>
  );
}

/** The design's label over a field (`labelStyle`). */
export const labelStyle: CSSProperties = { fontSize: 11.5, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" };
