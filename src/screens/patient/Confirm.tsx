/**
 * The confirmation (P3): booked — or moved — with the reference, the visit
 * in five rows, the fee, "Add to calendar" and what happens by email.
 *
 * The calendar file is built here, in the browser, from what the server
 * answered: the start and end as UTC instants, so a phone in any zone puts
 * it at the practice's own time. A first visit is not "emailed": the desk
 * rings or emails once it has checked the new patient.
 */
import { useState } from "react";
import { Calendar, CalendarCheck, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Mail, MapPin, NotebookPen, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useI18n } from "../../i18n/index.tsx";
import { locale } from "../../i18n/ambient.ts";
import { Btn, cardStyle, chipStyle, mono, monoPill } from "../../components/ui.tsx";
import { now } from "../../lib/clock.ts";
import { dayLong, dayOf, money, num, timeRange } from "../../lib/format.ts";
import { bookVisit, findMe, patientsPort, usePatients } from "../../state/patients.ts";
import { useDemoSignal } from "../../state/demoSignal.ts";
import { go } from "../../state/ui.ts";
import { firstOpenTime } from "./FindDay.tsx";
import { typesOffered } from "./Find.tsx";
import { buildIcs, slugOf } from "./logic.ts";
import { Fill, clinicianNamed, useCatalogue } from "./parts.tsx";
import { useTodayDay } from "./useToday.ts";
import { atInstant } from "./when.ts";

/** Hand the visit to the person as a `.ics` file. */
function download(name: string, body: string): void {
  const url = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Confirm() {
  const { t, dir } = useI18n();
  const cat = useCatalogue();
  const booked = usePatients((s) => s.booked);
  const today = useTodayDay();
  const [busy, setBusy] = useState(false);

  // The demo card's "Book a sample visit": the demo's returning patient, the first open time.
  useDemoSignal("confirm.sampleVisit", (p) => {
    if (cat === null || booked !== null) return;
    const type = typesOffered(cat, false)[0];
    if (type === undefined) return;
    void (async () => {
      setBusy(true);
      try {
        if (p["mobile"] !== undefined && p["bornOn"] !== undefined) await findMe(p["mobile"], p["bornOn"]);
        const found = usePatients.getState().found;
        if (found === null || patientsPort().level() === null) return;
        const first = await firstOpenTime(cat, type.id, "any", undefined, today);
        if (first === null) return;
        await bookVisit(
          { visit_type_id: type.id, clinician_id: null, starts_at: atInstant(first.day, first.time), reason: null, desk_note: null, language: locale() },
          { firstName: found.name.split(/\s+/)[0] ?? "", email: null },
        );
      } catch {
        // The demo's sample: nothing to say if the practice has no time left.
      } finally {
        setBusy(false);
      }
    })();
  });

  const settings = cat?.settings ?? null;
  if (cat === null || settings === null) return null;
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;

  if (booked === null) {
    return (
      <div className="rh-screen" data-screen="Confirm" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640, marginInline: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, paddingBlockStart: 10 }}>
          <span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 22, background: "var(--surface-3)", color: "var(--fg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Calendar size={30} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(25px,3.6vw,33px)", fontWeight: 800, letterSpacing: "-.036em", lineHeight: 1.14 }}>{t("confirm.nothingTitle")}</h1>
            <p style={{ margin: "9px 0 0", fontSize: 14, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("confirm.nothingBody")}</p>
          </div>
          <span style={monoPill("var(--surface-3)", "var(--fg-subtle)")}>—</span>
          <Btn icon={CalendarCheck} busy={busy} onClick={() => go("find")}>
            {t("findUs.findTime")}
          </Btn>
        </div>
      </div>
    );
  }

  const type = cat.visitTypes.find((x) => x.id === booked.typeId);
  const who = clinicianNamed(cat, booked.clinician_id);
  const day = dayOf(booked.starts_at);
  const first = booked.firstName.trim() === "" ? null : booked.firstName.trim();
  const title = booked.moved
    ? first === null
      ? t("confirm.movedTitleAnon")
      : t("confirm.movedTitle", { name: first })
    : first === null
      ? t("confirm.titleAnon")
      : t("confirm.title", { name: first });
  const whatFor = booked.reason !== null && booked.reason !== "" ? booked.reason : (type?.name ?? "");
  const rows: { id: string; icon: LucideIcon; label: string; val: string; isMono?: boolean }[] = [
    { id: "who", icon: UserRound, label: t("confirm.clinician"), val: who === null ? "—" : `${who.name} · ${who.role}` },
    { id: "when", icon: Calendar, label: t("confirm.when"), val: dayLong(day) },
    { id: "time", icon: Clock, label: t("confirm.time"), val: `${timeRange(booked.starts_at, booked.minutes)}  (${t("find.minShort", { n: num(booked.minutes) })})`, isMono: true },
    { id: "why", icon: NotebookPen, label: t("confirm.whatFor"), val: whatFor },
    { id: "where", icon: MapPin, label: t("confirm.where"), val: settings.address },
  ];
  const email = booked.firstVisit ? t("confirm.deskWillRing") : booked.email !== null && booked.email !== "" ? t("confirm.emailedTo", { email: booked.email }) : t("confirm.emailed");

  const addToCalendar = () => {
    const summary = `${type?.name ?? ""}${who === null ? "" : ` · ${who.short}`}`;
    download(
      `${slugOf(settings.practice_name)}-${booked.ref}.ics`,
      buildIcs({
        ref: booked.ref,
        startsAt: booked.starts_at,
        minutes: booked.minutes,
        summary,
        location: settings.address,
        description: t("confirm.icsDescription", { ref: booked.ref, phone: settings.phone }),
        practice: settings.practice_name,
        stampedAt: now(),
      }),
    );
  };

  return (
    <div className="rh-screen" data-screen="Confirm" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640, marginInline: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, paddingBlockStart: 10 }}>
        <span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 22, background: "var(--pos-soft)", color: "var(--pos)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={34} />
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(25px,3.6vw,33px)", fontWeight: 800, letterSpacing: "-.036em", lineHeight: 1.14 }}>{title}</h1>
          <p style={{ margin: "9px 0 0", fontSize: 14, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
            {booked.moved
              ? t("confirm.movedSub", { ref: booked.ref })
              : t("confirm.sub", { n: num(booked.minutes), who: who?.short ?? t("find.whoever") })}
          </p>
        </div>
        <span style={{ ...monoPill("var(--accent-soft)", "var(--accent)"), fontSize: 14, padding: "7px 14px" }} aria-label={t("confirm.refLabel", { ref: booked.ref })}>
          {booked.ref}
        </span>
      </div>
      <section style={{ ...cardStyle, padding: "6px 18px" }}>
        <div>
          {rows.map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", ...(i > 0 ? { borderBlockStart: "1px solid var(--border)" } : {}) }}>
                <span aria-hidden="true" style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: "var(--surface-3)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".02em", color: "var(--fg-subtle)" }}>{r.label}</span>
                  <span style={{ ...(r.isMono ? mono(13.5, 600, "var(--fg)") : { fontSize: 13.5, fontWeight: 700, letterSpacing: "-.015em", color: "var(--fg)", textWrap: "pretty" }) }}>{r.val}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>
      {type !== undefined && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>
          <Fill text={t("confirm.fee")} name="fee">
            <span style={mono(13, 600, "var(--fg)")}>{money(type.fee, settings.currency)}</span>
          </Fill>
        </p>
      )}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="rh-chip" onClick={addToCalendar} style={chipStyle(false)}>
          <CalendarPlus size={13} aria-hidden="true" />
          {t("confirm.addToCalendar")}
        </button>
        {!booked.moved && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)", textWrap: "pretty" }}>
            <Mail size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
            {email}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("confirm.cancelLine", { hours: num(settings.cancel_hours) })}</p>
      <button
        type="button"
        className="rh-gi"
        onClick={() => go("visits")}
        style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, height: 34, paddingInline: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--accent)", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
      >
        {t("confirm.seeVisits")}
        <Chevron size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
