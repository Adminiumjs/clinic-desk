/**
 * The desk's "no such screen": an address that names no screen of the desk
 * lands here, with the one way back that matters — the day sheet.
 */
import { CalendarDays } from "lucide-react";

import { useI18n } from "../i18n/index.tsx";
import { go } from "../state/ui.ts";
import { Btn, mono } from "../components/ui.tsx";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <section
      className="rh-screen"
      data-screen="NotFound"
      aria-labelledby="desk-404"
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, paddingBlock: "clamp(20px,6vw,60px)", maxWidth: 520 }}
    >
      <span style={{ padding: "6px 12px", borderRadius: 10, background: "var(--surface-3)", ...mono(20, 700, "var(--fg-subtle)") }}>404</span>
      <h1 id="desk-404" style={{ margin: 0, fontSize: "clamp(23px,3.2vw,30px)", fontWeight: 800, letterSpacing: "-.034em", lineHeight: 1.14 }}>
        {t("deskNotFound.title")}
      </h1>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.65, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("deskNotFound.body")}</p>
      <Btn icon={CalendarDays} onClick={() => go("daysheet")}>
        {t("deskNotFound.action")}
      </Btn>
    </section>
  );
}
