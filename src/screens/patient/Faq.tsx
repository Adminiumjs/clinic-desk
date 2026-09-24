/**
 * Questions (P11): the practice's own questions and answers, each opening in
 * place, with the practice's phone number, no-show grace and cancellation
 * window put in where an answer says `{phone}`, `{no_show_minutes}` or
 * `{cancel_hours}` — so the answers stay true when the desk changes them.
 */
import { useState } from "react";
import { CalendarCheck, Minus, Plus } from "lucide-react";

import { useI18n } from "../../i18n/index.tsx";
import { Btn, cardStyle } from "../../components/ui.tsx";
import { go } from "../../state/ui.ts";
import { fillPractice } from "./logic.ts";
import { PageHead, WithPhone, useCatalogue } from "./parts.tsx";

export default function Faq() {
  const { t } = useI18n();
  const cat = useCatalogue();
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const settings = cat?.settings ?? null;
  if (cat === null || settings === null) return null;
  const faqs = [...cat.faqs].filter((f) => f.active).sort((a, b) => a.position - b.position);

  return (
    <div className="rh-screen" data-screen="Faq" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 660 }}>
      <PageHead title={t("faq.title")} lede={<WithPhone text={t("faq.lede")} phone={settings.phone} />} />
      <section aria-label={t("faq.title")} style={{ ...cardStyle, padding: "2px 18px" }}>
        {faqs.map((f) => {
          const on = open.has(f.id);
          const panel = `faq-a-${String(f.id)}`;
          return (
            <div key={f.id} style={{ borderBlockEnd: "1px solid var(--border)" }}>
              <h2 style={{ margin: 0, fontSize: "inherit", lineHeight: "normal" }}>
                <button
                  type="button"
                  className="rh-nav"
                  aria-expanded={on}
                  aria-controls={panel}
                  onClick={() =>
                    setOpen((s) => {
                      const next = new Set(s);
                      if (on) next.delete(f.id);
                      else next.add(f.id);
                      return next;
                    })
                  }
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "16px 0", border: "none", background: "transparent", cursor: "pointer", textAlign: "start" }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: "-.022em", color: "var(--fg)", textWrap: "pretty" }}>{fillPractice(f.question, settings)}</span>
                  <span aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--accent-soft)" : "var(--surface-3)", color: on ? "var(--accent)" : "var(--fg-muted)" }}>
                    {on ? <Minus size={15} /> : <Plus size={15} />}
                  </span>
                </button>
              </h2>
              {on && (
                <p id={panel} style={{ margin: 0, padding: "0 0 18px", maxWidth: "56ch", fontSize: 13.5, fontWeight: 500, lineHeight: 1.65, color: "var(--fg-muted)", textWrap: "pretty" }}>
                  {fillPractice(f.answer, settings)}
                </p>
              )}
            </div>
          );
        })}
      </section>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn icon={CalendarCheck} onClick={() => go("find")}>
          {t("findUs.findTime")}
        </Btn>
        <Btn kind="ghost" onClick={() => go("findus")}>
          {t("nav.findus")}
        </Btn>
      </div>
    </div>
  );
}
