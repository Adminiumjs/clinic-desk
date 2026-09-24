/**
 * Online booking is closed for now (P13): the whole patients' side is this
 * one page while the desk has switched online booking off — the practice's
 * number to ring and its address. The server refuses every patients' write
 * meanwhile; this only says so before anyone tries.
 */
import { CalendarOff, MapPin } from "lucide-react";

import { useI18n } from "../../i18n/index.tsx";
import { mono } from "../../components/ui.tsx";
import { BrandMark } from "../../components/PatientShell.tsx";
import { usePatients } from "../../state/patients.ts";
import { WithPhone } from "./parts.tsx";

export default function BookingClosed() {
  const { t } = useI18n();
  const settings = usePatients((s) => s.catalogue?.settings ?? null);
  if (settings === null) return null;
  return (
    <main id="main" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(20px,5vw,48px) 16px", background: "var(--bg)" }}>
      <section
        className="rh-screen"
        data-screen="BookingClosed"
        aria-labelledby="closed-h"
        style={{ width: "min(480px,100%)", padding: "clamp(22px,4vw,32px)", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <BrandMark mark={settings.mark} name={settings.practice_name} />
        </span>
        <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 15, background: "var(--surface-3)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CalendarOff size={22} />
        </span>
        <div>
          <h1 id="closed-h" style={{ margin: 0, fontSize: "clamp(23px,3.4vw,29px)", fontWeight: 800, letterSpacing: "-.034em", lineHeight: 1.14, textWrap: "pretty" }}>
            {t("closed.title")}
          </h1>
          <p style={{ margin: "9px 0 0", fontSize: 14.5, fontWeight: 500, lineHeight: 1.65, color: "var(--fg-muted)", textWrap: "pretty" }}>
            <WithPhone text={t("closed.body")} phone={settings.phone} />
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11, width: "100%", paddingBlockStart: 16, borderBlockStart: "1px solid var(--border)" }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: "var(--surface-3)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={15} />
          </span>
          <span style={{ ...mono(12, 600, "var(--fg-muted)"), whiteSpace: "normal", lineHeight: 1.5 }}>{settings.address}</span>
        </div>
      </section>
    </main>
  );
}
