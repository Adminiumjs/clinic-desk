/**
 * Find us (P6): the address, the desk's number, the opening hours, the
 * entrance photo and a maps link, how to get here — and the days ahead the
 * practice is shut, with its note for patients.
 *
 * Everything comes from the practice's settings; what the practice has not
 * filled in (a photo, directions, a maps link) is left out, not faked.
 */
import { CalendarCheck, CalendarX, Clock, ExternalLink, MapPin, Phone as PhoneIcon } from "lucide-react";

import type { OpeningHours } from "../../data/types.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Btn, btnGhostSm, cardStyle, mono } from "../../components/ui.tsx";
import { dayShort } from "../../lib/format.ts";
import { go } from "../../state/ui.ts";
import { hoursRows, type HoursRow } from "./logic.ts";
import { PageHead, useCatalogue } from "./parts.tsx";
import { useTodayDay } from "./useToday.ts";
import { clockLabel } from "./when.ts";

const WEEKDAY_KEY = {
  mon: "findUs.mon",
  tue: "findUs.tue",
  wed: "findUs.wed",
  thu: "findUs.thu",
  fri: "findUs.fri",
  sat: "findUs.sat",
  sun: "findUs.sun",
} as const;

/** The practice's hours as the design lists them ("Monday to Friday 08:30 – 17:30"). */
export function HoursList({ hours }: { hours: OpeningHours[] }) {
  const { t } = useI18n();
  const today = useTodayDay();
  const range = (a: string, b: string) => `${clockLabel(today, a)} – ${clockLabel(today, b)}`;
  const line = (r: HoursRow): { label: string; val: string } => {
    switch (r.kind) {
      case "weekdays":
        return { label: t("findUs.weekdays"), val: range(r.opens, r.closes) };
      case "deskClosed":
        return { label: t("findUs.deskClosed"), val: range(r.from, r.to) };
      case "day":
        return {
          label: t(WEEKDAY_KEY[r.weekday]),
          val: r.breakFrom !== null && r.breakTo !== null ? t("findUs.dayWithBreak", { hours: range(r.opens, r.closes), closed: range(r.breakFrom, r.breakTo) }) : range(r.opens, r.closes),
        };
      case "dayClosed":
        return { label: t(WEEKDAY_KEY[r.weekday]), val: t("findUs.closed") };
      case "weekendClosed":
        return { label: t("findUs.weekend"), val: t("findUs.closed") };
    }
  };
  return (
    <dl style={{ display: "flex", flexDirection: "column", gap: 6, margin: "6px 0 0" }}>
      {hoursRows(hours).map((r, i) => {
        const { label, val } = line(r);
        return (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <dt style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>{label}</dt>
            <dd style={{ margin: 0, marginInlineStart: "auto", ...mono(12.5, 600, "var(--fg)"), whiteSpace: "normal", textAlign: "end" }}>{val}</dd>
          </div>
        );
      })}
    </dl>
  );
}

const iconTile = (accent: boolean) =>
  ({ width: 32, height: 32, flexShrink: 0, borderRadius: 10, background: accent ? "var(--accent-soft)" : "var(--surface-3)", color: accent ? "var(--accent)" : "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }) as const;
const rowLabel = { fontSize: 11.5, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" } as const;

export default function FindUs() {
  const { t } = useI18n();
  const cat = useCatalogue();
  const today = useTodayDay();
  const settings = cat?.settings ?? null;
  if (cat === null || settings === null) return null;
  const maps = settings.map_link ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;
  const shut = cat.closures.filter((c) => c.active && c.clinician_id === null && c.to_date >= today).sort((a, b) => a.from_date.localeCompare(b.from_date));

  return (
    <div className="rh-screen" data-screen="FindUs" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHead title={t("findUs.title")} lede={settings.intro !== null && settings.intro !== "" ? settings.intro : undefined} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        <section aria-label={t("findUs.title")} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span aria-hidden="true" style={iconTile(true)}>
              <MapPin size={16} />
            </span>
            <div>
              <div style={rowLabel}>{t("findUs.address")}</div>
              <div style={{ marginBlockStart: 3, fontSize: 14, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.5 }}>{settings.address}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span aria-hidden="true" style={iconTile(false)}>
              <PhoneIcon size={16} />
            </span>
            <div>
              <div style={rowLabel}>{t("findUs.desk")}</div>
              <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} style={{ display: "inline-block", marginBlockStart: 3, ...mono(14, 600, "var(--fg)") }}>
                {settings.phone}
              </a>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <span aria-hidden="true" style={iconTile(false)}>
              <Clock size={16} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={rowLabel}>{t("findUs.open")}</div>
              <HoursList hours={cat.hours} />
            </div>
          </div>
          {shut.length > 0 && (
            <div style={{ display: "flex", gap: 12 }}>
              <span aria-hidden="true" style={iconTile(false)}>
                <CalendarX size={16} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rowLabel}>{t("findUs.closedDays")}</div>
                <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {shut.map((c) => (
                    <li key={c.id} style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-muted)" }}>
                      <span style={mono(12.5, 600, "var(--fg)")}>{c.from_date === c.to_date ? dayShort(c.from_date) : `${dayShort(c.from_date)} – ${dayShort(c.to_date)}`}</span>
                      {` · ${c.label}`}
                      {c.note !== null && c.note !== "" ? ` — ${c.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <Btn icon={CalendarCheck} onClick={() => go("find")} style={{ alignSelf: "flex-start" }}>
            {t("findUs.findTime")}
          </Btn>
        </section>
        <section aria-label={t("findUs.getting")} style={{ ...cardStyle, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {settings.entrance_photo !== null && settings.entrance_photo !== "" && (
            <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", background: "var(--surface-3)" }}>
              <img src={settings.entrance_photo} alt={t("findUs.photo")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...mono(12, 600, "var(--fg-muted)"), whiteSpace: "normal", flex: 1, minWidth: 180, lineHeight: 1.5 }}>{settings.address}</span>
            <a className="rh-btn" href={maps} target="_blank" rel="noopener noreferrer" style={{ ...btnGhostSm, height: 38, textDecoration: "none" }}>
              <ExternalLink size={14} aria-hidden="true" />
              {t("findUs.maps")}
            </a>
          </div>
          {settings.directions !== null && settings.directions !== "" && (
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{settings.directions}</p>
          )}
        </section>
      </div>
    </div>
  );
}
