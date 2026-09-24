/**
 * The kiosk switched off in the practice's settings. Patients read this, so it
 * says only what to do instead — never where the switch is.
 */
import { PowerOff } from "lucide-react";

import { useI18n } from "../../i18n/index.tsx";

export function Off() {
  const { t } = useI18n();
  return (
    <section
      className="rh-screen"
      aria-labelledby="k-off"
      style={{ width: "min(520px, 100%)", boxSizing: "border-box", padding: "30px 22px", borderRadius: 18, border: "1px dashed var(--border-strong)", background: "var(--surface-2)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
    >
      <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 15, background: "var(--surface-3)", color: "var(--fg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PowerOff size={22} />
      </span>
      <h1 id="k-off" style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: "-.026em", lineHeight: "normal" }}>
        {t("kiosk.offTitle")}
      </h1>
      <p style={{ margin: 0, maxWidth: "40ch", fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("kiosk.offBody")}</p>
    </section>
  );
}
