/**
 * Desk settings: the no-show window, the cancellation window, whether
 * reminders go and whether patients may book online — each saved to the
 * practice's settings the moment it is changed.
 *
 * Only a clinic manager may change them (the server refuses anyone else); for
 * everyone else the screen shows them as they are, with a line saying who can
 * change them. A control shows its new value once the server has saved it.
 */
import { useState, type ReactNode } from "react";
import { Clock } from "lucide-react";

import type { Settings as Row } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { today } from "../lib/clock.ts";
import { visitsOn } from "../lib/desk.ts";
import { useNow } from "../lib/useNow.ts";
import { saveSettings } from "../state/actions.ts";
import { useCan, useDesk } from "../state/desk.ts";
import { go, toast } from "../state/ui.ts";
import { Chip, Skeleton, Switch, btnGhostSm } from "../components/ui.tsx";
import { counted } from "./deskwork/dates.ts";
import { Screen, ScreenHead, cardStyle } from "./deskwork/parts.tsx";

const NO_SHOW = [10, 15, 20, 30];
const CANCEL = [12, 24, 48];

type Patch = Partial<Omit<Row, "id">>;

export default function Settings() {
  const { t } = useI18n();
  const now = useNow();
  const settings = useDesk((s) => s.settings);
  const desk = useDesk();
  const manager = useCan("settings", "update");
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (id: string, patch: Patch) => {
    if (!manager || saving !== null) return;
    setSaving(id);
    const outcome = await saveSettings(patch);
    setSaving(null);
    if (!outcome.ok) toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
  };

  if (settings === null) {
    return (
      <Screen name="Settings" style={{ maxWidth: 720 }}>
        <ScreenHead kicker={t("nav.settings")} title={t("settings.title")} />
        <Skeleton height={420} radius={16} />
      </Screen>
    );
  }

  const noShowWindow = settings.no_show_minutes;
  const past = visitsOn(desk, today()).filter((v) => v.status === "booked" && now - Date.parse(v.starts_at) > noShowWindow * 60_000).length;

  return (
    <Screen name="Settings" style={{ maxWidth: 720 }}>
      <ScreenHead kicker={t("nav.settings")} title={t("settings.title")} lede={t("settings.lede")} ledeWidth="54ch" />
      <section aria-label={t("nav.settings")} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 20 }}>
        {!manager && (
          <p role="note" style={{ margin: 0, padding: "11px 13px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>
            {t("settings.readOnly")}
          </p>
        )}
        <Part id="st-ns" title={t("settings.noShow")} body={t("settings.noShowBody")} first>
          <div role="group" aria-labelledby="st-ns" style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBlockStart: 11 }}>
            {NO_SHOW.map((n) => (
              <Chip key={n} on={settings.no_show_minutes === n} disabled={!manager || saving !== null} onClick={() => void save("ns", { no_show_minutes: n })}>
                {t("settings.minutes", counted(n), n)}
              </Chip>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: "var(--fg-subtle)", textWrap: "pretty" }} aria-live="polite">
            {past === 0 ? t("settings.noShowNone") : t("settings.noShowNote", counted(past), past)}
          </p>
        </Part>
        <Part id="st-cw" title={t("settings.cancel")} body={t("settings.cancelBody")}>
          <div role="group" aria-labelledby="st-cw" style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBlockStart: 11 }}>
            {CANCEL.map((n) => (
              <Chip key={n} on={settings.cancel_hours === n} disabled={!manager || saving !== null} onClick={() => void save("cw", { cancel_hours: n })}>
                {t("settings.hours", counted(n), n)}
              </Chip>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: "var(--fg-subtle)", textWrap: "pretty" }}>{t("settings.cancelNote", counted(settings.cancel_hours), settings.cancel_hours)}</p>
        </Part>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBlockStart: 18, borderBlockStart: "1px solid var(--border)" }}>
          <Toggle
            label={t("settings.reminders")}
            body={t("settings.remindersBody")}
            on={settings.reminders_on}
            busy={saving === "rem"}
            disabled={!manager || saving !== null}
            onChange={(next) => void save("rem", { reminders_on: next })}
          />
          <Toggle
            label={t("settings.kiosk")}
            body={t("settings.kioskBody")}
            on={settings.kiosk_on}
            busy={saving === "kio"}
            disabled={!manager || saving !== null}
            onChange={(next) => void save("kio", { kiosk_on: next })}
          />
          <Toggle
            label={t("settings.booking")}
            body={t("settings.bookingBody")}
            on={settings.online_booking_on}
            busy={saving === "bk"}
            disabled={!manager || saving !== null}
            onChange={(next) => void save("bk", { online_booking_on: next })}
          />
        </div>
        <div style={{ paddingBlockStart: 18, borderBlockStart: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("settings.hoursLine")}</span>
          <button type="button" className="rh-btn" onClick={() => go("hours")} style={{ ...btnGhostSm, height: 38 }}>
            <Clock size={15} aria-hidden="true" />
            {t("nav.hours")}
          </button>
        </div>
      </section>
    </Screen>
  );
}

function Part({ id, title, body, first = false, children }: { id: string; title: string; body: string; first?: boolean; children: ReactNode }) {
  return (
    <div style={first ? undefined : { paddingBlockStart: 18, borderBlockStart: "1px solid var(--border)" }}>
      <h2 id={id} style={{ margin: 0, fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" }}>
        {title}
      </h2>
      <p style={{ margin: "5px 0 0", fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{body}</p>
      {children}
    </div>
  );
}

function Toggle({ label, body, on, busy, disabled, onChange }: { label: string; body: string; on: boolean; busy: boolean; disabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }} aria-busy={busy || undefined}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{body}</span>
      </span>
      <Switch on={on} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}
