/**
 * What a visit costs (P7): each visit type with its length and fee, the
 * practice's cancellation window, and how to pay — at the desk, and through
 * an insurer when the practice says it takes one.
 */
import { CalendarCheck, FileText, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useI18n } from "../../i18n/index.tsx";
import { Btn, cardStyle, mono, useDark } from "../../components/ui.tsx";
import { soft, tint } from "../../lib/color.ts";
import { money, num } from "../../lib/format.ts";
import { go } from "../../state/ui.ts";
import { PageHead, typeIcon, useCatalogue } from "./parts.tsx";

export default function Prices() {
  const { t } = useI18n();
  const dark = useDark();
  const cat = useCatalogue();
  const settings = cat?.settings ?? null;
  if (cat === null || settings === null) return null;
  const ways: { id: string; icon: LucideIcon; label: string; body: string }[] = [
    { id: "desk", icon: Store, label: t("prices.atDesk"), body: settings.pay_note !== null && settings.pay_note !== "" ? settings.pay_note : t("prices.atDeskBody") },
  ];
  if (settings.insurer_note !== null && settings.insurer_note !== "") ways.push({ id: "insurer", icon: FileText, label: t("prices.insurer"), body: settings.insurer_note });

  return (
    <div className="rh-screen" data-screen="Prices" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHead title={t("prices.title")} lede={t("prices.lede")} ledeWidth="54ch" />
      <section aria-label={t("prices.title")} style={{ ...cardStyle, padding: "6px 18px" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {cat.visitTypes.map((x) => {
            const Icon = typeIcon(x.icon);
            return (
              <li key={x.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 0", borderBlockEnd: "1px solid var(--border)" }}>
                <span aria-hidden="true" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: soft(x.color, dark), color: tint(x.color, dark) }}>
                  <Icon size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.022em", textWrap: "pretty" }}>{x.name}</span>
                  <span style={mono(11.5, 600, "var(--fg-subtle)")}>{t("find.minShort", { n: num(x.minutes) })}</span>
                </span>
                <span style={mono(17, 600, "var(--fg)")}>{money(x.fee, settings.currency)}</span>
              </li>
            );
          })}
        </ul>
        <p style={{ margin: 0, padding: "15px 0", fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("prices.window", { hours: num(settings.cancel_hours) })}</p>
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
        {ways.map((w) => {
          const Icon = w.icon;
          return (
            <section key={w.id} aria-labelledby={`pay-${w.id}`} style={{ ...cardStyle, padding: 16, borderRadius: 15 }}>
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, background: "var(--surface-3)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={16} />
              </span>
              <h2 id={`pay-${w.id}`} style={{ margin: "11px 0 0", fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em", lineHeight: "normal" }}>
                {w.label}
              </h2>
              <p style={{ margin: "5px 0 0", fontSize: 12.5, fontWeight: 500, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{w.body}</p>
            </section>
          );
        })}
      </div>
      <Btn icon={CalendarCheck} onClick={() => go("find")} style={{ alignSelf: "flex-start" }}>
        {t("findUs.findTime")}
      </Btn>
    </div>
  );
}
