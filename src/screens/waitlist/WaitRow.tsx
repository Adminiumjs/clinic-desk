/**
 * One person on the waiting list: where they stand, what they asked for,
 * how long they have waited, the first time that fits, and the three things
 * the desk can do — take the fit (after ringing them), choose a time on the
 * day sheet, or take them off.
 *
 * "Choose a time" books the placed time and marks the entry booked as one
 * resumable action. Its key lives outside the row, per entry, until it
 * succeeds: the row is gone while the day sheet is open, and a try that
 * saved the visit but not the entry must finish with the same key rather
 * than book a second visit.
 */
import { useState } from "react";
import { CalendarCheck, CalendarPlus, Check, Hourglass } from "lucide-react";

import type { Id, WaitingEntry } from "../../data/types.ts";
import { venueStamp } from "../../data/venueTime.ts";
import { useI18n } from "../../i18n/index.tsx";
import { practiceZone } from "../../lib/clock.ts";
import { clinicianOf, typeOf } from "../../lib/desk.ts";
import { dayOf, daysBetween, dayShort, num, time } from "../../lib/format.ts";
import { actionKey } from "../../lib/keys.ts";
import type { Fit } from "../../lib/waitlist.ts";
import { takeOffWaiting, takeWaiting } from "../../state/actions.ts";
import { useCan, useDesk } from "../../state/desk.ts";
import { openSheet, startPlacing, stopPlacing, toast } from "../../state/ui.ts";
import { Btn, Skeleton, Tile, btnPrimary, mono, monoPill } from "../../components/ui.tsx";
import { counted } from "../deskwork/dates.ts";
import { nameStyle } from "../deskwork/parts.tsx";
import type { FitState } from "./useFits.ts";

/** "Choose a time"'s key per entry, kept until the booking succeeds. */
const chooseKeys = new Map<Id, string>();

/** A fit's instant, on the practice's clock. */
const fitInstant = (fit: Fit): string => new Date(venueStamp(fit.day, fit.time, practiceZone())).toISOString();

const PART_KEY = { any: "wlist.part.any", mornings: "wlist.part.mornings", afternoons: "wlist.part.afternoons" } as const;

export function WaitRow({ entry, position, fit, today }: { entry: WaitingEntry; position: number; fit: FitState | undefined; today: string }) {
  const { t } = useI18n();
  const desk = useDesk();
  const canCreate = useCan("appointments", "create");
  const canOff = useCan("waiting_list", "update");
  const canBook = canCreate && canOff;
  const [dropping, setDropping] = useState(false);

  const patient = desk.patients[entry.patient_id];
  const name = patient?.name ?? "";
  const type = typeOf(desk, entry.visit_type_id);
  const asked = clinicianOf(desk, entry.clinician_id);
  const hasEmail = (patient?.email ?? "").trim() !== "";
  // A row read from the live stream may come without its optional columns.
  const note = (entry.note ?? "").trim();

  const want = t("wlist.want", {
    type: type?.name ?? "",
    clinician: entry.clinician_id === null ? t("wlist.anyone") : (asked?.short_name ?? ""),
    part: t(PART_KEY[entry.part_of_day]),
  });
  const waited = entry.created_at == null ? 0 : Math.max(0, daysBetween(dayOf(entry.created_at), today));
  const long = waited >= 7;

  const found = fit?.state === "ready" ? fit.fit : null;
  const fitText =
    fit === undefined || fit.state === "loading"
      ? null
      : fit.state === "failed"
        ? t("wlist.fitFailed")
        : found === null
          ? t("wlist.noFit")
          : t("wlist.fit", { day: dayShort(found.day), time: time(fitInstant(found)), clinician: clinicianOf(desk, found.clinicianId)?.short_name ?? "" });

  const bookedLine = (visit: { starts_at: string; clinician_id: Id | null; ref: string }) => {
    const line = t("wlist.booked", {
      name,
      clinician: clinicianOf(desk, visit.clinician_id)?.short_name ?? "",
      time: time(visit.starts_at),
      day: dayShort(dayOf(visit.starts_at)),
      ref: visit.ref,
    });
    return hasEmail ? `${line} ${t("wlist.bookedEmail")}` : line;
  };

  const take = () => {
    if (found === null) return;
    openSheet({ kind: "waitAsk", entryId: entry.id, at: { startsAt: fitInstant(found), clinicianId: found.clinicianId } });
  };

  const choose = () => {
    if (type === undefined) return;
    const key = chooseKeys.get(entry.id) ?? actionKey();
    chooseKeys.set(entry.id, key);
    startPlacing({
      what: "booking",
      patientName: name,
      typeId: type.id,
      minutes: type.minutes,
      clinicianId: entry.clinician_id,
      day: found?.day ?? today,
      place: (at) => {
        void takeWaiting(entry, at, key).then((outcome) => {
          if (outcome.ok) {
            chooseKeys.delete(entry.id);
            stopPlacing();
            toast(bookedLine(outcome.value), { icon: "calendar-check", tone: "pos" });
          } else {
            toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
          }
        });
      },
    });
    toast(t("wlist.place", { name }), { icon: "calendar-plus" });
  };

  const drop = async () => {
    // Read the entry as it is now: a second press may come before the screen has redrawn.
    if (dropping || useDesk.getState().waiting[entry.id]?.status !== "waiting") return;
    setDropping(true);
    const outcome = await takeOffWaiting(entry);
    setDropping(false);
    if (outcome.ok) toast(t("wlist.offDone", { name }), { icon: "user-round-minus" });
    else toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "danger" });
  };

  const small = { height: 38, fontSize: 12.5 } as const;
  return (
    <div className="rh-row" style={{ display: "flex", flexDirection: "column", gap: 11, padding: "13px 15px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span aria-hidden="true" style={{ ...mono(12, 600, "var(--fg-subtle)"), width: 22 }}>
          {num(position)}
        </span>
        <Tile name={name} color={type?.color ?? "#0369a1"} size={36} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={nameStyle}>{name}</span>
          <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), whiteSpace: "normal", lineHeight: 1.55 }}>{want}</span>
          {note !== "" && (
            <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-muted)", textWrap: "pretty" }}>{note}</span>
          )}
        </span>
        <span style={monoPill(long ? "var(--warn-soft)" : "var(--surface-3)", long ? "var(--warn)" : "var(--fg-muted)")}>
          <Hourglass size={12} aria-hidden="true" />
          {waited === 0 ? t("wlist.addedToday") : t("wlist.days", counted(waited), waited)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {fitText === null ? (
          <Skeleton height={23} width={180} radius={999} />
        ) : (
          <span style={monoPill(found !== null ? "var(--pos-soft)" : "var(--surface-3)", found !== null ? "var(--pos)" : "var(--fg-subtle)")}>
            <CalendarCheck size={12} aria-hidden="true" />
            <span className="rh-sr-only">{`${t("wlist.fitLabel")}: `}</span>
            {fitText}
          </span>
        )}
        <span style={{ marginInlineStart: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canBook && found !== null && (
            <button type="button" className="rh-btn" onClick={take} style={{ ...btnPrimary, ...small }}>
              <Check size={15} aria-hidden="true" />
              {t("wlist.take")}
            </button>
          )}
          {canBook && (
            <button type="button" className="rh-btn" onClick={choose} style={{ ...btnPrimary, ...small }}>
              <CalendarPlus size={15} aria-hidden="true" />
              {t("wlist.choose")}
            </button>
          )}
          {canOff && (
            <Btn kind="ghostSm" busy={dropping} onClick={() => void drop()} style={{ height: 38, color: "var(--danger)" }}>
              {t("wlist.off")}
            </Btn>
          )}
        </span>
      </div>
    </div>
  );
}
