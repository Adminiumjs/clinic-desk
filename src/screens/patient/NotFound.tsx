/** The patients' 404 (P12): the page is not here; start again from booking or My visits. */
import { CalendarCheck } from "lucide-react";

import { useI18n } from "../../i18n/index.tsx";
import { Btn, mono } from "../../components/ui.tsx";
import { go } from "../../state/ui.ts";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="rh-screen" data-screen="NotFound" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, paddingBlock: "clamp(20px,6vw,60px)", maxWidth: 520 }}>
      <span style={{ padding: "6px 12px", borderRadius: 10, background: "var(--surface-3)", ...mono(20, 700, "var(--fg-subtle)") }}>404</span>
      <h1 style={{ margin: 0, fontSize: "clamp(25px,3.6vw,33px)", fontWeight: 800, letterSpacing: "-.036em", lineHeight: 1.14 }}>{t("pNotFound.title")}</h1>
      <p style={{ margin: 0, fontSize: 14.5, fontWeight: 500, lineHeight: 1.65, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("pNotFound.body")}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn icon={CalendarCheck} onClick={() => go("find")}>
          {t("findUs.findTime")}
        </Btn>
        <Btn kind="ghost" onClick={() => go("visits")}>
          {t("nav.visits")}
        </Btn>
      </div>
    </div>
  );
}
