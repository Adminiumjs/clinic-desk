/**
 * What opens over the desk's pages: the visit panel, the cancel dialog, the
 * toasts, and the notice that the session has ended.
 *
 * The visit panel shows one visit — who, when, what for, what it costs, where
 * the patient is in their visit — and the moves open to it now, as the person
 * looking may make them: a clinician sees only the steps into a room, in with
 * them and ready to go; the front desk checks in, moves, cancels and sends
 * people off. Buttons follow what the server lets the person do.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarSync, CalendarX, Check, CheckCheck, Circle, DoorOpen, HandHeart, LogIn, Receipt, ShieldAlert, TriangleAlert, UserRound, UserRoundCheck, UserRoundX, X } from "lucide-react";

import type { Appointment, AppointmentStatus } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { now } from "../lib/clock.ts";
import { clinicianOf, patientOf, typeOf, visitName } from "../lib/desk.ts";
import { dayOf, dayShort, money, num, timeRange } from "../lib/format.ts";
import { cancelVisit, onSignedOut } from "../state/actions.ts";
import { useCan, useDesk } from "../state/desk.ts";
import { closePanel, go, openSheet, startPlacing, toast, useUi, type Sheet } from "../state/ui.ts";
import { Btn, btnGhost, btnPrimary, iconBtnStyle, kicker, mono, monoPill, pill, STATUS_META, Tile, Toasts, Dialog, useModal } from "./ui.tsx";
import { toastIcon } from "./desk/icons.ts";
import { advanceVisit, checkInVisit, noShowVisit } from "./desk/moves.ts";
import { insideWindow, panelActions, type PanelAction } from "../screens/daysheet/model.ts";

const CHAIN: AppointmentStatus[] = ["booked", "checked_in", "roomed", "with_clinician", "ready", "seen"];
const CHAIN_ICON: Record<string, LucideIcon> = { booked: Circle, checked_in: LogIn, roomed: DoorOpen, with_clinician: UserRoundCheck, ready: CheckCheck, seen: Check };
const ADVANCE: Partial<Record<AppointmentStatus, { key: "waiting.step.room" | "waiting.step.with" | "waiting.step.ready"; icon: LucideIcon }>> = {
  checked_in: { key: "waiting.step.room", icon: DoorOpen },
  roomed: { key: "waiting.step.with", icon: UserRoundCheck },
  with_clinician: { key: "waiting.step.ready", icon: CheckCheck },
};

/** Start moving a visit: the day sheet opens on its day, showing where it could go. */
function startMove(visit: Appointment, name: string, minutes: number): void {
  startPlacing({
    what: "moving",
    patientName: name,
    typeId: visit.visit_type_id,
    minutes,
    clinicianId: null,
    exclude: visit.id,
    ref: visit.ref,
    day: dayOf(visit.starts_at),
    place: (at) => openSheet({ kind: "move", visitId: visit.id, to: at }),
  });
}

function Chain({ status }: { status: AppointmentStatus }) {
  const { t } = useI18n();
  const at = CHAIN.indexOf(status);
  return (
    <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
      {CHAIN.map((step, i) => {
        const meta = STATUS_META[step];
        const done = at >= 0 && i <= at;
        const current = i === at;
        const Icon = CHAIN_ICON[step]!;
        return (
          <li key={step} aria-current={current ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              aria-hidden="true"
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...(current ? { background: meta.fg, color: "var(--surface)" } : done ? { background: meta.bg, color: meta.fg } : { background: "var(--surface-3)", color: "var(--fg-subtle)" }),
              }}
            >
              <Icon size={13} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: current ? 800 : 700, color: current ? "var(--fg)" : done ? "var(--fg-muted)" : "var(--fg-subtle)" }}>{t(`status.${step}`)}</span>
            {i < CHAIN.length - 1 && <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: done ? "var(--border-strong)" : "var(--border)" }} />}
          </li>
        );
      })}
    </ol>
  );
}

function VisitPanel({ visit }: { visit: Appointment }) {
  const { t } = useI18n();
  const titleId = useId();
  const root = useRef<HTMLDivElement>(null);
  useModal(root, closePanel);
  const name = useDesk((s) => visitName(s, visit));
  const clinician = useDesk((s) => clinicianOf(s, visit.clinician_id));
  const type = useDesk((s) => typeOf(s, visit.visit_type_id));
  const allergies = useDesk((s) => patientOf(s, visit.patient_id)?.allergies_note ?? null);
  const role = useDesk((s) => s.me.role);
  const update = useCan("appointments", "update");
  const pay = useCan("payments", "create");
  const seePatients = useCan("patients", "read");
  const [busy, setBusy] = useState<PanelAction | null>(null);

  const fee = visit.fee ?? type?.fee ?? 0;
  const note = visit.status === "seen" ? (visit.balance > 0 ? t("panel.owing", { amount: money(visit.balance) }) : t("panel.settled")) : t("panel.atDesk");
  const actions = panelActions(visit, { role, update, pay, seePatients });

  const run = (action: PanelAction, work: () => Promise<unknown>) => {
    setBusy(action);
    void work().finally(() => setBusy(null));
  };
  const button = (action: PanelAction) => {
    const ghost = { ...btnGhost, width: "100%" } as const;
    const primary = { ...btnPrimary, width: "100%" } as const;
    switch (action) {
      case "checkIn":
        return (
          <Btn key={action} icon={LogIn} busy={busy === action} disabled={busy !== null} style={primary} onClick={() => run(action, () => checkInVisit(visit, name, t))}>
            {t("panel.checkIn")}
          </Btn>
        );
      case "advance": {
        const step = ADVANCE[visit.status];
        if (step === undefined) return null;
        return (
          <Btn key={action} icon={step.icon} busy={busy === action} disabled={busy !== null} style={primary} onClick={() => run(action, () => advanceVisit(visit, name, t))}>
            {t(step.key)}
          </Btn>
        );
      }
      case "sendOff":
        return (
          <Btn key={action} icon={HandHeart} style={primary} onClick={() => openSheet({ kind: "sendOff", visitId: visit.id })}>
            {t("waiting.step.sendOff")}
          </Btn>
        );
      case "move":
        return (
          <Btn key={action} kind="ghost" icon={CalendarSync} disabled={busy !== null} style={ghost} onClick={() => startMove(visit, name, visit.minutes)}>
            {t("panel.move")}
          </Btn>
        );
      case "noShow":
        return (
          <Btn key={action} kind="ghost" icon={UserRoundX} busy={busy === action} disabled={busy !== null} style={{ ...ghost, color: "var(--danger)" }} onClick={() => run(action, () => noShowVisit(visit, name, t))}>
            {t("waiting.noShow")}
          </Btn>
        );
      case "cancel":
        return (
          <Btn key={action} kind="ghost" icon={CalendarX} disabled={busy !== null} style={{ ...ghost, color: "var(--danger)" }} onClick={() => openSheet({ kind: "cancel", visitId: visit.id })}>
            {t("panel.cancel")}
          </Btn>
        );
      case "patient":
        return (
          <Btn
            key={action}
            kind="ghost"
            icon={UserRound}
            disabled={busy !== null}
            style={ghost}
            onClick={() => {
              go("patients");
              useUi.setState({ patientId: visit.patient_id });
            }}
          >
            {t("panel.patient")}
          </Btn>
        );
      case "payment":
        return (
          <Btn key={action} kind="ghost" icon={Receipt} disabled={busy !== null} style={ghost} onClick={() => openSheet({ kind: "payment", visitId: visit.id, amount: visit.balance })}>
            {t("panel.payment")}
          </Btn>
        );
    }
  };

  return (
    <div onClick={closePanel} style={{ position: "fixed", inset: 0, zIndex: 700, background: "var(--scrim)", backdropFilter: "blur(3px)", animation: "rh-scrim .16s ease", display: "flex", alignItems: "stretch", justifyContent: "flex-end", padding: 14 }}>
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="rh-scroll"
        style={{ position: "relative", width: "min(420px,100%)", boxSizing: "border-box", maxHeight: "100%", overflowY: "auto", padding: 20, borderRadius: 18, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "0 40px 90px -30px rgba(10,10,25,.6)", animation: "rh-sheet .2s cubic-bezier(.2,.7,.3,1)", outline: "none" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Tile name={clinician?.name ?? name} color={clinician?.color ?? "#3b6fbd"} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-.028em", lineHeight: "normal", textWrap: "pretty" }}>
              {name}
            </h2>
            <div style={{ ...mono(12, 600, "var(--fg-subtle)"), direction: "inherit", whiteSpace: "normal" }}>{clinician === undefined ? "" : `${clinician.short_name} · ${clinician.role_label}`}</div>
          </div>
          <button type="button" data-close className="rh-gi" onClick={closePanel} aria-label={t("common.close")} style={iconBtnStyle}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBlockStart: 13 }}>
          <span style={monoPill("var(--surface-3)", "var(--fg-subtle)")}>{visit.ref}</span>
          {allergies !== null && allergies.trim() !== "" && (
            <span style={pill("var(--warn-soft)", "var(--warn)")}>
              <ShieldAlert size={11} aria-hidden="true" />
              {t("panel.allergies", { what: allergies })}
            </span>
          )}
        </div>
        <div style={{ marginBlockStart: 14, padding: 14, borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={{ ...mono(12.5, 600, "var(--fg)"), direction: "inherit", whiteSpace: "normal" }}>
            {t("panel.when", { day: dayShort(dayOf(visit.starts_at)), range: timeRange(visit.starts_at, visit.minutes), minutes: num(visit.minutes) })}
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-.02em", color: "var(--fg)", textWrap: "pretty" }}>{visit.reason ?? type?.name ?? ""}</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 9, marginBlockStart: 4 }}>
            <span style={mono(13.5, 600, "var(--fg)")}>{money(fee)}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{note}</span>
          </span>
        </div>
        <div style={{ marginBlockStart: 18 }}>
          <h3 style={{ ...kicker, margin: 0 }}>{t("panel.where")}</h3>
          <Chain status={visit.status} />
        </div>
        {actions.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBlockStart: 18 }}>{actions.map(button)}</div>}
      </div>
    </div>
  );
}

/**
 * Cancel a visit, as the desk: outside the cancellation window it is a plain
 * question; inside it the dialog says the cancellation is logged as late.
 * Either way the time goes back on the board. It speaks as the desk, not to
 * the patient.
 */
export function CancelDialog({ sheet, onClose }: { sheet: Extract<Sheet, { kind: "cancel" }>; onClose: () => void }) {
  const { t } = useI18n();
  const visit = useDesk((s) => s.visits[sheet.visitId]);
  const name = useDesk((s) => (visit === undefined ? "" : visitName(s, visit)));
  const clinician = useDesk((s) => clinicianOf(s, visit?.clinician_id ?? null));
  const hours = useDesk((s) => s.settings?.cancel_hours ?? 24);
  const [busy, setBusy] = useState(false);
  if (visit === undefined) return null;
  const late = insideWindow(visit.starts_at, now(), hours);
  const confirm = async () => {
    setBusy(true);
    const out = await cancelVisit(visit.id);
    setBusy(false);
    if (!out.ok) {
      toast(t(`refusal.${out.reason}`), { icon: "circle-alert", tone: "danger" });
      return;
    }
    onClose();
    if (late) toast(t("cancel.toast.late", { ref: visit.ref }), { icon: "triangle-alert", tone: "warn" });
    else toast(t("cancel.toast.done", { ref: visit.ref }), { icon: "circle-check" });
  };
  return (
    <Dialog
      icon={late ? TriangleAlert : CalendarX}
      tone={late ? "warn" : "neutral"}
      onClose={onClose}
      title={late ? t("cancel.lateTitle", { n: num(hours) }, hours) : t("cancel.title")}
      body={late ? t("cancel.lateBody", { n: num(hours) }, hours) : t("cancel.body")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBlockStart: 15, padding: 13, borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <Tile name={clinician?.name ?? name} color={clinician?.color ?? "#3b6fbd"} size={36} />
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em" }}>{clinician === undefined ? name : t("cancel.who", { name, clinician: clinician.short_name })}</span>
          <span style={{ ...mono(12, 600, "var(--fg-muted)"), direction: "inherit", whiteSpace: "normal" }}>
            {t("cancel.when", { day: dayShort(dayOf(visit.starts_at)), range: timeRange(visit.starts_at, visit.minutes), ref: visit.ref })}
          </span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, marginBlockStart: 16 }}>
        <Btn kind="ghost" onClick={onClose} style={{ flex: 1 }}>
          {t("cancel.keep")}
        </Btn>
        <Btn busy={busy} onClick={() => void confirm()} style={{ flex: 1, background: late ? "var(--warn)" : "var(--danger)", color: "var(--accent-fg)" }}>
          {late ? t("cancel.anyway") : t("cancel.confirm")}
        </Btn>
      </div>
    </Dialog>
  );
}

/** The session ended: nothing more saves until the person signs in again. */
function SignedOut() {
  const { t } = useI18n();
  const close = () => useUi.setState({ signedOut: false });
  return (
    <Dialog icon={LogIn} tone="warn" alert onClose={close} title={t("signedOut.title")} body={t("signedOut.body")}>
      <div style={{ display: "flex", gap: 10, marginBlockStart: 16 }}>
        <Btn kind="ghost" onClick={close} style={{ flex: 1 }}>
          {t("common.close")}
        </Btn>
        <Btn icon={LogIn} onClick={() => window.location.reload()} style={{ flex: 1 }}>
          {t("signedOut.action")}
        </Btn>
      </div>
    </Dialog>
  );
}

export function DeskOverlays() {
  const panel = useUi((s) => s.panel);
  const visit = useDesk((s) => (panel === null ? undefined : s.visits[panel]));
  const signedOut = useUi((s) => s.signedOut);
  const sheet = useUi((s) => s.sheet);
  // A save that finds the session ended says so once, here, whichever screen made it.
  useEffect(() => onSignedOut(() => useUi.setState({ signedOut: true })), []);
  return (
    <>
      {visit !== undefined && <VisitPanel key={visit.id} visit={visit} />}
      {signedOut && sheet === null && <SignedOut />}
      <Toasts icons={toastIcon} />
    </>
  );
}
