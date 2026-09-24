/**
 * The waiting room: who is in the building, by where they are — checked in,
 * in a room, with their clinician, ready to go — with how long each has
 * waited since they checked in, and beside them everyone who has not arrived
 * more than the no-show window after their start.
 *
 * Each card moves its visit one step on (the server stamps the time); "Send
 * them off" opens the send-off sheet, which takes the payment and the recall.
 */
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Armchair, CheckCheck, ChevronsUpDown, DoorOpen, Gauge, HandHeart, Hourglass, TriangleAlert, UserRoundCheck } from "lucide-react";

import type { Appointment, AppointmentStatus } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { today } from "../lib/clock.ts";
import { clinicianOf, visitName, visitsOn } from "../lib/desk.ts";
import { num, time } from "../lib/format.ts";
import { useNow } from "../lib/useNow.ts";
import { useCan, useDesk } from "../state/desk.ts";
import { openPanel, openSheet } from "../state/ui.ts";
import { Btn, iconBtnStyle, kicker, mono, monoPill, Tile } from "../components/ui.tsx";
import { useNarrow } from "../components/desk/useNarrow.ts";
import { advanceVisit, checkInVisit, noShowVisit } from "../components/desk/moves.ts";
import { board, mayAdvance, notArrived, minutesLate, standing, waitMinutes, waits, waitTone } from "./daysheet/model.ts";

const COLUMNS: { status: AppointmentStatus; tone: string }[] = [
  { status: "checked_in", tone: "var(--info)" },
  { status: "roomed", tone: "var(--info)" },
  { status: "with_clinician", tone: "var(--pos)" },
  { status: "ready", tone: "var(--pos)" },
];

/** The next step's button, per status, as the design words it. */
const STEP: Partial<Record<AppointmentStatus, { key: "waiting.step.room" | "waiting.step.with" | "waiting.step.ready" | "waiting.step.sendOff"; icon: LucideIcon }>> = {
  checked_in: { key: "waiting.step.room", icon: DoorOpen },
  roomed: { key: "waiting.step.with", icon: UserRoundCheck },
  with_clinician: { key: "waiting.step.ready", icon: CheckCheck },
  ready: { key: "waiting.step.sendOff", icon: HandHeart },
};

const TONES = { fg: ["var(--surface-3)", "var(--fg-muted)"], warn: ["var(--warn-soft)", "var(--warn)"], danger: ["var(--danger-soft)", "var(--danger)"] } as const;

function Stat({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: keyof typeof TONES }) {
  return (
    <span style={{ ...monoPill(TONES[tone][0], TONES[tone][1]), direction: "inherit" }}>
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

function Card({ visit, now }: { visit: Appointment; now: number }) {
  const { t } = useI18n();
  const name = useDesk((s) => visitName(s, visit));
  const clinician = useDesk((s) => clinicianOf(s, visit.clinician_id));
  const role = useDesk((s) => s.me.role);
  const canMove = useCan("appointments", "update");
  const [busy, setBusy] = useState(false);
  const wait = waitMinutes(visit, now);
  const tone = TONES[waitTone(wait)];
  const step = STEP[visit.status];
  const allowed = canMove && step !== undefined && (visit.status === "ready" ? role !== "clinician" : mayAdvance(role, visit.status));
  const onStep = async () => {
    if (visit.status === "ready") {
      openSheet({ kind: "sendOff", visitId: visit.id });
      return;
    }
    setBusy(true);
    await advanceVisit(visit, name, t);
    setBusy(false);
  };
  return (
    <div className="rh-card" style={{ padding: 14, borderRadius: 15, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Tile name={clinician?.name ?? ""} color={clinician?.color ?? "#3b6fbd"} size={34} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em", textWrap: "pretty" }}>{name}</span>
          <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), direction: "inherit" }}>{t("waiting.meta", { clinician: clinician?.short_name ?? "", time: time(visit.starts_at) })}</span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...monoPill(tone[0], tone[1]), direction: "inherit" }}>
          <Hourglass size={12} aria-hidden="true" />
          {t("waiting.minutes", { n: num(wait) }, wait)}
        </span>
        {visit.reason !== null && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{visit.reason}</span>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {allowed && step !== undefined ? (
          <Btn icon={step.icon} busy={busy} onClick={() => void onStep()} style={{ flex: 1, height: 44, fontSize: 13 }}>
            {t(step.key)}
          </Btn>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <button type="button" className="rh-gi" onClick={() => openPanel(visit.id)} aria-label={t("waiting.open", { name })} title={t("waiting.open", { name })} style={{ ...iconBtnStyle, height: 44, width: 44 }}>
          <ChevronsUpDown size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Missing({ visit, now }: { visit: Appointment; now: number }) {
  const { t } = useI18n();
  const name = useDesk((s) => visitName(s, visit));
  const clinician = useDesk((s) => clinicianOf(s, visit.clinician_id));
  const role = useDesk((s) => s.me.role);
  const canMove = useCan("appointments", "update") && role !== "clinician";
  const [busy, setBusy] = useState<"in" | "no" | null>(null);
  const late = minutesLate(visit, now);
  return (
    <div style={{ padding: 14, borderRadius: 15, border: "1px solid var(--border)", borderInlineStart: "3px solid var(--warn)", background: "var(--surface)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Tile name={clinician?.name ?? ""} color={clinician?.color ?? "#3b6fbd"} size={34} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" }}>{name}</span>
          <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), direction: "inherit" }}>{t("waiting.wasDue", { clinician: clinician?.short_name ?? "", time: time(visit.starts_at) })}</span>
        </span>
      </div>
      <span style={{ ...monoPill("var(--warn-soft)", "var(--warn)"), direction: "inherit", alignSelf: "flex-start", whiteSpace: "normal" }}>
        <TriangleAlert size={12} aria-hidden="true" />
        {t("waiting.late", { n: num(late) }, late)}
      </span>
      {canMove && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn
            busy={busy === "in"}
            disabled={busy !== null}
            onClick={() => {
              setBusy("in");
              void checkInVisit(visit, name, t).finally(() => setBusy(null));
            }}
            style={{ height: 40, fontSize: 12.5, flex: 1 }}
          >
            {t("waiting.arrived")}
          </Btn>
          <Btn
            kind="ghostSm"
            busy={busy === "no"}
            disabled={busy !== null}
            onClick={() => {
              setBusy("no");
              void noShowVisit(visit, name, t).finally(() => setBusy(null));
            }}
            style={{ height: 40, color: "var(--danger)" }}
          >
            {t("waiting.noShow")}
          </Btn>
        </div>
      )}
    </div>
  );
}

export default function Waiting() {
  const { t } = useI18n();
  const narrow = useNarrow();
  const now = useNow();
  const desk = useDesk();
  const noShowMinutes = desk.settings?.no_show_minutes ?? 15;
  const visits = standing(visitsOn(desk, today()));
  const here = board(visits);
  const missing = notArrived(visits, now, noShowMinutes);
  const { longest, average } = waits(here, now);

  return (
    <section className="rh-screen" data-screen="Waiting" aria-labelledby="waiting-title" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={kicker}>{t("nav.waiting")}</div>
        <h1 id="waiting-title" style={{ margin: "5px 0 0", fontSize: "clamp(21px,2.8vw,27px)", fontWeight: 800, letterSpacing: "-.032em", lineHeight: "normal" }}>
          {t("waiting.title")}
        </h1>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Stat icon={Armchair} tone="fg" label={t("waiting.stat.inside", { n: num(here.length) }, here.length)} />
        <Stat icon={Hourglass} tone={waitTone(longest)} label={t("waiting.stat.longest", { n: num(longest) }, longest)} />
        <Stat icon={Gauge} tone="fg" label={t("waiting.stat.average", { n: num(average) }, average)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) 290px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 11, alignItems: "start" }}>
          {COLUMNS.map((col) => {
            const list = here.filter((v) => v.status === col.status);
            return (
              <section key={col.status} aria-labelledby={`waiting-${col.status}`} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingInline: 2 }}>
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: col.tone }} />
                  <h2 id={`waiting-${col.status}`} style={{ margin: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--fg-muted)" }}>
                    {t(`status.${col.status}`)}
                  </h2>
                  <span style={{ ...mono(10.5, 600, "var(--fg-subtle)"), padding: "2px 7px", borderRadius: 999, background: "var(--surface-3)" }}>{num(list.length)}</span>
                </div>
                {list.map((v) => (
                  <Card key={v.id} visit={v} now={now} />
                ))}
                {list.length === 0 && (
                  <div style={{ padding: 15, borderRadius: 13, border: "1px dashed var(--border-strong)", background: "var(--surface-2)", fontSize: 12, fontWeight: 600, color: "var(--fg-subtle)", textWrap: "pretty" }}>
                    {t(`waiting.empty.${col.status as "checked_in" | "roomed" | "with_clinician" | "ready"}`)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <aside aria-labelledby="waiting-missing" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 id="waiting-missing" style={{ margin: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--fg-muted)" }}>
              {t("waiting.missing")}
            </h2>
            <span style={{ ...mono(10.5, 600, missing.length > 0 ? "var(--warn)" : "var(--fg-subtle)"), padding: "2px 7px", borderRadius: 999, background: missing.length > 0 ? "var(--warn-soft)" : "var(--surface-3)" }}>
              {num(missing.length)}
            </span>
          </div>
          {missing.map((v) => (
            <Missing key={v.id} visit={v} now={now} />
          ))}
          {missing.length === 0 && (
            <div style={{ padding: 16, borderRadius: 14, border: "1px dashed var(--border-strong)", background: "var(--surface-2)", fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-subtle)", textWrap: "pretty" }}>
              {t("waiting.missingNone")}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
