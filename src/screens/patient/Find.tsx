/**
 * Find a time (P1): what the visit is for, who with, a day and a time — then
 * "Continue" to say who is coming in. Moving a visit uses the same page,
 * locked to that visit's type and clinician, and saves the new time on the
 * same visit.
 *
 * Every free or taken time is the server's answer (the practice's booking
 * rule, through the availability endpoint); the page only lays it out.
 */
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, MoveRight } from "lucide-react";

import type { Catalogue } from "../../data/ports.ts";
import { PortError } from "../../data/ports.ts";
import type { Clinician, Id, VisitType } from "../../data/types.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Btn, cardStyle, mono, stepBadge } from "../../components/ui.tsx";
import { dayOf, dayShort, money, num, time as timeOf } from "../../lib/format.ts";
import { usePatients, moveMine } from "../../state/patients.ts";
import { useDemoSignal } from "../../state/demoSignal.ts";
import { go } from "../../state/ui.ts";
import { firstOpenTime, DayStep } from "./FindDay.tsx";
import { bookProblem, sessionEnded } from "./logic.ts";
import { ClinicianTile, GoneBox, Notice, PageHead, clinicianNamed, typeIcon, useCatalogue } from "./parts.tsx";
import { endSession } from "./VerifyFlow.tsx";
import { useFlow } from "./flow.ts";
import { atInstant, clockLabel, rangeLabel } from "./when.ts";
import { useTodayDay } from "./useToday.ts";
import { nearestFor } from "./nearest.ts";

/** The visit types a patient may pick now: new-patient ones only while a first visit is possible. */
export function typesOffered(cat: Catalogue, firstVisitPossible: boolean): VisitType[] {
  return cat.visitTypes.filter((t) => t.active && t.bookable_online && (!t.new_patients_only || firstVisitPossible));
}

/** The clinicians who do a type and can be booked online, in order. */
export function cliniciansFor(cat: Catalogue, type: Id): Clinician[] {
  const who = new Set(cat.links.filter((l) => l.visit_type_id === type).map((l) => l.clinician_id));
  return cat.clinicians.filter((c) => who.has(c.id) && c.active && c.bookable_online).sort((a, b) => a.position - b.position || a.id - b.id);
}

export default function Find() {
  const { t, dir } = useI18n();
  const cat = useCatalogue();
  const typeId = usePatients((s) => s.typeId);
  const clinicianId = usePatients((s) => s.clinicianId);
  const day = usePatients((s) => s.day);
  const time = usePatients((s) => s.time);
  const moving = usePatients((s) => s.moving);
  const found = usePatients((s) => s.found);
  const level = usePatients((s) => s.level);
  const carried = useFlow((s) => !s.booking.returning);
  const today = useTodayDay();
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveProblem, setMoveProblem] = useState<"tooLate" | "offline" | null>(null);
  const [gone, setGone] = useState<string[] | null>(null);

  const settings = cat?.settings ?? null;
  // A new-patient type shows only while a first visit is still possible here.
  const firstVisitPossible = settings?.new_patients_online === true && found === null && level === null && moving === null;
  const types = cat === null ? [] : typesOffered(cat, firstVisitPossible);
  const lockedType = moving === null ? null : (cat?.visitTypes.find((x) => x.id === moving.typeId) ?? null);
  const shownTypes = moving === null ? types : lockedType === null ? [] : [lockedType];
  const defaultType = types.find((x) => (carried ? x.new_patients_only : !x.new_patients_only)) ?? types[0] ?? null;
  const type = moving !== null ? lockedType : (types.find((x) => x.id === typeId) ?? defaultType);

  // Keep the store's choice valid: a type that is no longer offered falls back; so does a clinician.
  useEffect(() => {
    if (moving !== null || type === null) return;
    if (typeId !== type.id) usePatients.setState({ typeId: type.id, time: null });
  }, [moving, type, typeId]);
  const pool = cat === null || type === null ? [] : cliniciansFor(cat, type.id);
  useEffect(() => {
    if (moving !== null || clinicianId === "any" || cat === null) return;
    if (!pool.some((c) => c.id === clinicianId)) usePatients.setState({ clinicianId: "any", time: null });
  }, [moving, clinicianId, pool, cat]);
  useEffect(() => {
    if (day === null || day < today) usePatients.setState({ day: today, time: null });
  }, [day, today]);

  const resource: Id | "any" = moving !== null ? (moving.clinicianId ?? "any") : clinicianId;
  const exclude = moving?.id;

  useDemoSignal("find.firstOpen", () => {
    if (type === null || settings === null || cat === null) return;
    void firstOpenTime(cat, type.id, resource, exclude, today).then((first) => {
      if (first !== null) usePatients.setState({ day: first.day, time: first.time });
    });
  });

  if (cat === null || settings === null) return null;
  const chevron = dir === "rtl" ? ChevronLeft : ChevronRight;
  const shownDay = day === null || day < today ? today : day;

  const who = resource === "any" ? null : clinicianNamed(cat, resource);
  const minutes = type?.minutes ?? 0;

  const move = async () => {
    if (moving === null || time === null) return;
    setMoveBusy(true);
    setMoveProblem(null);
    try {
      await moveMine(atInstant(shownDay, time));
      setGone(null);
      go("confirm");
    } catch (error) {
      const code = error instanceof PortError ? error.code : "";
      if (sessionEnded(code)) {
        await endSession(true, "timeout");
        go("visits");
        return;
      }
      const problem = bookProblem(code, error instanceof PortError ? error.params : {});
      if (problem === "gone") setGone(await nearestFor(type?.id ?? moving.typeId, resource, exclude, shownDay, time));
      else setMoveProblem(problem === "tooLate" ? "tooLate" : "offline");
    } finally {
      setMoveBusy(false);
    }
  };

  const choices: { id: Id | "any"; name: string; role: string; person: Clinician | null }[] = [];
  if (moving !== null) {
    const named = clinicianNamed(cat, moving.clinicianId);
    choices.push({ id: moving.clinicianId ?? "any", name: named?.short ?? t("find.anyone"), role: named?.role ?? t("find.firstOpen"), person: cat.clinicians.find((c) => c.id === moving.clinicianId) ?? null });
  } else {
    if (pool.length > 1) choices.push({ id: "any", name: t("find.anyone"), role: t("find.firstOpen"), person: null });
    for (const c of pool) choices.push({ id: c.id, name: c.short_name, role: c.role_label, person: c });
  }
  const whoOn = (id: Id | "any") => resource === id || (choices.length === 1 && resource === "any");

  return (
    <div className="rh-screen" data-screen="Find" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHead size="find" title={t("find.title")} lede={t("find.lede")} ledeWidth="54ch" />

      {moving !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 15px", borderRadius: 14, border: "1px solid var(--accent)", background: "var(--accent-soft)" }}>
          <ClinicianTile name={who?.name ?? null} color={who?.color ?? null} size={34} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em", color: "var(--accent)" }}>
              {t("find.moving", { ref: moving.ref, when: `${dayShort(dayOf(moving.startsAt))} ${timeOf(moving.startsAt)}` })}
            </span>
            <span style={mono(11.5, 600, "var(--accent)")}>
              {t("find.movingSub", { type: lockedType?.name ?? "", n: num(minutes), who: who?.short ?? t("find.whoever") })}
            </span>
          </span>
          <button
            type="button"
            className="rh-gi"
            onClick={() => {
              usePatients.setState({ moving: null, time: null });
              go("visits");
            }}
            style={{ marginInlineStart: "auto", height: 32, paddingInline: 11, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {t("find.keepIt")}
          </button>
        </div>
      )}

      <section className="rh-card" aria-labelledby="find-q1" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden="true" style={stepBadge(true)}>
            {num(1)}
          </span>
          <h2 id="find-q1" style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: "-.022em", lineHeight: "normal" }}>
            {t("find.q1")}
          </h2>
          <span style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)" }}>{t("find.setsLength")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(216px,1fr))", gap: 9, marginBlockStart: 14 }}>
          {shownTypes.map((x) => {
            const on = type?.id === x.id;
            const Icon = typeIcon(x.icon);
            return (
              <button
                key={x.id}
                type="button"
                className="rh-btn"
                aria-pressed={on}
                disabled={moving !== null}
                onClick={() => usePatients.setState({ typeId: x.id, clinicianId: "any", time: null })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: 12,
                  borderRadius: 13,
                  cursor: moving !== null ? "default" : "pointer",
                  textAlign: "start",
                  border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
                  background: on ? "var(--accent-soft)" : "var(--surface)",
                  color: on ? "var(--accent)" : "var(--fg)",
                  opacity: 1,
                }}
              >
                <span aria-hidden="true" style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--accent-soft)" : "var(--surface-3)", color: on ? "var(--accent)" : "var(--fg-muted)" }}>
                  <Icon size={16} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.018em", textAlign: "start", textWrap: "pretty" }}>{x.name}</span>
                  <span style={{ ...mono(11.5, 600, on ? "var(--accent)" : "var(--fg-subtle)"), whiteSpace: "normal" }}>
                    {t("find.typeMeta", { n: num(x.minutes), fee: money(x.fee, settings.currency) })}
                    {x.new_patients_only ? ` · ${t("find.forNew")}` : ""}
                  </span>
                </span>
                {on && <Check size={15} aria-hidden="true" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rh-card" aria-labelledby="find-q2" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden="true" style={stepBadge(type !== null)}>
            {num(2)}
          </span>
          <h2 id="find-q2" style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: "-.022em", lineHeight: "normal" }}>
            {t("find.q2")}
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 9, marginBlockStart: 14 }}>
          {choices.map((c) => {
            const on = whoOn(c.id);
            return (
              <button
                key={String(c.id)}
                type="button"
                className="rh-btn"
                aria-pressed={on}
                disabled={moving !== null}
                onClick={() => usePatients.setState({ clinicianId: c.id, time: null })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: 11,
                  borderRadius: 13,
                  cursor: moving !== null ? "default" : "pointer",
                  textAlign: "start",
                  border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
                  background: on ? "var(--accent-soft)" : "var(--surface)",
                  color: on ? "var(--accent)" : "var(--fg)",
                  opacity: 1,
                }}
              >
                <ClinicianTile name={c.person?.name ?? null} color={c.person?.color ?? null} size={34} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.018em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{c.name}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? "var(--accent)" : "var(--fg-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{c.role}</span>
                </span>
                {on && <Check size={15} aria-hidden="true" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      </section>

      {type !== null && (
        <DayStep
          cat={cat}
          type={type}
          resource={resource}
          exclude={exclude}
          day={shownDay}
          today={today}
          time={time}
          whoShort={who?.short ?? null}
          onDay={(d) => {
            setGone(null);
            usePatients.setState({ day: d, time: null });
          }}
          onTime={(tm) => {
            setGone(null);
            setMoveProblem(null);
            usePatients.setState({ time: tm });
          }}
        />
      )}

      {time !== null && type !== null && (
        <div
          style={{
            position: "sticky",
            insetBlockEnd: 16,
            zIndex: 300,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid var(--border-strong)",
            background: "var(--surface)",
            boxShadow: "0 22px 44px -24px rgba(12,12,30,.34)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <ClinicianTile name={who?.name ?? null} color={who?.color ?? null} size={36} />
            <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em" }}>{who?.short ?? t("find.firstOpenClinician")}</span>
              <span style={{ ...mono(12, 600, "var(--fg-muted)"), whiteSpace: "normal" }}>
                {`${dayShort(shownDay)} · ${rangeLabel(shownDay, time, minutes)} · ${t("find.minShort", { n: num(minutes) })}`}
              </span>
            </span>
            {moving === null ? (
              <Btn onClick={() => go("details")} style={{ marginInlineStart: "auto" }}>
                {t("find.continue")}
                {(() => {
                  const Icon = chevron;
                  return <Icon size={16} aria-hidden="true" />;
                })()}
              </Btn>
            ) : (
              <Btn icon={MoveRight} busy={moveBusy} onClick={() => void move()} style={{ marginInlineStart: "auto" }}>
                {t("find.moveHere")}
              </Btn>
            )}
          </div>
          {gone !== null && (
            <GoneBox
              near={gone}
              dayLabel={dayShort(shownDay)}
              timeLabel={(tm) => clockLabel(shownDay, tm)}
              onPick={(tm) => {
                setGone(null);
                usePatients.setState({ time: tm });
              }}
            />
          )}
          {moveProblem !== null && (
            <Notice>{moveProblem === "tooLate" ? t("visits.tooLate", { phone: settings.phone }) : t("pShell.offline")}</Notice>
          )}
        </div>
      )}
    </div>
  );
}
