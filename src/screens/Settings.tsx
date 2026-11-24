/**
 * Desk settings: the no-show window, the cancellation window, whether
 * reminders go and whether patients may book online — each saved to the
 * practice's settings the moment it is changed.
 *
 * Only a clinic manager may change them (the server refuses anyone else); for
 * everyone else the screen shows them as they are, with a line saying who can
 * change them. A control shows its new value once the server has saved it.
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { Check, Clock } from "lucide-react";

import type { Settings as Row } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { today } from "../lib/clock.ts";
import { visitsOn } from "../lib/desk.ts";
import { useNow } from "../lib/useNow.ts";
import { saveSettings } from "../state/actions.ts";
import { deskReads, useCan, useDesk } from "../state/desk.ts";
import { useDeskPay } from "../state/deskPay.ts";
import { SuppliesGone } from "../data/supplies.ts";
import { SUPPLIES } from "../lib/features.ts";
import { forgetAddOn, useFeature } from "../state/features.ts";
import { suppliesPort } from "../state/supplies.ts";
import { go, toast } from "../state/ui.ts";
import { Btn, Chip, Skeleton, Switch, btnGhostSm, fieldStyle } from "../components/ui.tsx";
import { counted } from "./deskwork/dates.ts";
import { Screen, ScreenHead, cardStyle } from "./deskwork/parts.tsx";

const NO_SHOW = [10, 15, 20, 30];
const CANCEL = [12, 24, 48];
/** How long a time is held while a patient pays for it as they book. */
const HOLD = [10, 15, 20, 30];

type Patch = Partial<Omit<Row, "id">>;

export default function Settings() {
  const { t } = useI18n();
  const now = useNow();
  const settings = useDesk((s) => s.settings);
  const desk = useDesk();
  const manager = useCan("settings", "update");
  // Paying online: shown only while the practice takes payments; until then the screen reads as it always has.
  const payOn = useDeskPay((s) => s.on);
  // The refund switch still governs a visit paid ahead that is yet to come, even once payments are off.
  const aheadToCome = Object.values(desk.visits).some((v) => (v.paid_online ?? 0) > 0 && v.status !== "seen" && v.status !== "cancelled" && v.status !== "no_show" && v.status !== "lapsed");
  const [saving, setSaving] = useState<string | null>(null);
  // The shelves supplies can come off: Inventory's places, read only where Inventory is connected.
  const supplies = useFeature(SUPPLIES);
  const [places, setPlaces] = useState<{ id: number; name: string }[] | null>(null);
  useEffect(() => {
    const port = suppliesPort();
    if (!supplies || port === null) return;
    let live = true;
    port
      .places()
      .then((found) => live && setPlaces(found))
      .catch((error: unknown) => {
        if (error instanceof SuppliesGone) forgetAddOn("inventory");
      });
    return () => {
      live = false;
    };
  }, [supplies]);

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
        {supplies && places !== null && (
          <Part id="st-sp" title={t("settings.suppliesPlace")} body={t("settings.suppliesPlace.hint")}>
            <div role="group" aria-labelledby="st-sp" style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBlockStart: 11 }}>
              <Chip on={settings.supplies_place_id === null} disabled={!manager || saving !== null} onClick={() => void save("sp", { supplies_place_id: null })}>
                {t("settings.suppliesPlace.default")}
              </Chip>
              {places.map((place) => (
                <Chip
                  key={place.id}
                  on={settings.supplies_place_id === place.id}
                  disabled={!manager || saving !== null}
                  onClick={() =>
                    void save("sp", { supplies_place_id: place.id }).then(() => {
                      if (useDesk.getState().settings?.supplies_place_id === place.id) toast(t("settings.suppliesPlace.saved", { place: place.name }), { icon: "circle-check" });
                    })
                  }
                >
                  {place.name}
                </Chip>
              ))}
            </div>
          </Part>
        )}
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
          {payOn && (
            <Toggle
              label={t("settings.payAhead")}
              body={t("settings.payAheadBody")}
              on={settings.pay_ahead}
              busy={saving === "pa"}
              disabled={!manager || saving !== null}
              onChange={(next) => void save("pa", { pay_ahead: next })}
            />
          )}
          {(payOn || aheadToCome) && (
            <Toggle
              label={t("settings.autoRefund")}
              body={t("settings.autoRefundBody")}
              on={settings.auto_refund}
              busy={saving === "ar"}
              disabled={!manager || saving !== null}
              onChange={(next) => void save("ar", { auto_refund: next })}
            />
          )}
        </div>
        <TextsPart settings={settings} manager={manager} saving={saving} save={save} />
        {payOn && settings.pay_ahead && (
          <Part id="st-hold" title={t("settings.hold")} body={t("settings.holdBody")}>
            <div role="group" aria-labelledby="st-hold" style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBlockStart: 11 }}>
              {HOLD.map((n) => (
                <Chip key={n} on={settings.pay_hold_minutes === n} disabled={!manager || saving !== null} onClick={() => void save("hold", { pay_hold_minutes: n })}>
                  {t("settings.minutes", counted(n), n)}
                </Chip>
              ))}
            </div>
          </Part>
        )}
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
  // The line under the name says what the switch does: read out with it.
  const bodyId = useId();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }} aria-busy={busy || undefined}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" }}>{label}</span>
        <span id={bodyId} style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{body}</span>
      </span>
      <Switch on={on} onChange={onChange} label={label} disabled={disabled} describedBy={bodyId} />
    </div>
  );
}

/**
 * Visit texts: whether the practice sends them, and the name they use. The
 * texts go through the provider set up in Adminium (Studio → Texts), to
 * patients who ticked the box for them; replies are not read.
 *
 * The name is the practice's own unless it says what the practice treats:
 * then a plain one, with the same plain sender name in Adminium. Without a
 * name, no text goes, so the switch cannot be turned on with none.
 */
function TextsPart({ settings, manager, saving, save }: { settings: Row; manager: boolean; saving: string | null; save: (id: string, patch: Patch) => Promise<void> }) {
  const { t } = useI18n();
  const nameId = useId();
  const helpId = useId();
  const [name, setName] = useState(settings.text_name ?? settings.practice_name);
  // Whether Adminium can send a text at all (a provider and a sender set up in Studio → Texts).
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    deskReads()
      .textsReady()
      .then((answer) => live && setReady(answer))
      .catch(() => live && setReady(false));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => setName(settings.text_name ?? settings.practice_name), [settings.text_name, settings.practice_name]);
  const typed = name.trim();
  const saved = (settings.text_name ?? "").trim();
  const dirty = typed !== saved;
  return (
    <div data-part="settings-texts" style={{ display: "flex", flexDirection: "column", gap: 14, paddingBlockStart: 18, borderBlockStart: "1px solid var(--border)" }}>
      <Toggle
        label={t("texts.settings.title")}
        body={t("texts.settings.body")}
        on={settings.texts_on}
        busy={saving === "tx"}
        // A name first: with none, no text could go.
        disabled={!manager || saving !== null || (!settings.texts_on && saved === "")}
        onChange={(next) => void save("tx", { texts_on: next })}
      />
      <div>
        <label htmlFor={nameId} style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" }}>
          {t("texts.settings.name")}
        </label>
        <p id={helpId} style={{ margin: "5px 0 0", fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>
          {t("texts.settings.nameBody")}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manager || !dirty || typed === "") return;
            void save("txn", { text_name: typed }).then(() => {
              if ((useDesk.getState().settings?.text_name ?? "") === typed) toast(t("texts.settings.saved", { name: typed }), { icon: "circle-check" });
            });
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBlockStart: 11 }}
        >
          <input
            id={nameId}
            className="rh-fld"
            value={name}
            maxLength={40}
            readOnly={!manager}
            aria-describedby={helpId}
            onChange={(e) => setName(e.target.value)}
            style={{ ...fieldStyle(), flex: "1 1 220px", minWidth: 0 }}
          />
          {manager && (
            <Btn kind="ghostSm" type="submit" icon={Check} busy={saving === "txn"} disabled={!dirty || typed === "" || saving !== null} style={{ height: 40 }}>
              {t("texts.settings.save")}
            </Btn>
          )}
        </form>
        {saved === "" && <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: "var(--warn)" }}>{t("texts.settings.empty")}</p>}
      </div>
      {ready === false && (
        <p role="note" data-part="settings-texts-not-ready" style={{ margin: 0, fontSize: 12, fontWeight: 700, lineHeight: 1.55, color: "var(--warn)", textWrap: "pretty" }}>
          {t("texts.settings.notReady")}
        </p>
      )}
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-subtle)", textWrap: "pretty" }}>{t("texts.settings.replies")}</p>
    </div>
  );
}
