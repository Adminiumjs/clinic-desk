/**
 * Our clinicians (P5): who works here, what they do, their next open time
 * and how many times they still have today, the first three open times to
 * tap, and "Book with them".
 *
 * "N times left today" counts OPEN times (from the same public grid a
 * patient books from), never how many visits someone has booked — that is
 * the practice's business, not a visitor's. Each card asks the server for
 * its strip of days once, then for at most two days' times.
 */
import { useEffect, useState } from "react";
import { CalendarCheck, Clock } from "lucide-react";

import type { Catalogue } from "../../data/ports.ts";
import type { Clinician, Day, Hhmm, VisitType } from "../../data/types.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Btn, cardStyle, mono, monoPill } from "../../components/ui.tsx";
import { dayMonth, dayShort, num } from "../../lib/format.ts";
import { patientsPort, usePatients } from "../../state/patients.ts";
import { go } from "../../state/ui.ts";
import { windowSpan } from "./logic.ts";
import { ClinicianTile, PageHead, timeChip, useCatalogue } from "./parts.tsx";
import { useTodayDay } from "./useToday.ts";
import { clockLabel } from "./when.ts";

/** The type a clinician is booked for from here: their first by position that anyone may book (a returning patient's). */
export function mainType(cat: Catalogue, clinician: Clinician): VisitType | null {
  const theirs = new Set(cat.links.filter((l) => l.clinician_id === clinician.id).map((l) => l.visit_type_id));
  const types = cat.visitTypes.filter((t) => theirs.has(t.id) && t.active && t.bookable_online);
  return types.find((t) => !t.new_patients_only) ?? types[0] ?? null;
}

interface Openings {
  leftToday: number;
  next: { day: Day; time: Hhmm } | null;
  three: { day: Day; time: Hhmm }[];
}

/** One clinician's openings: a strip of days, today's times, and the first open day's times. */
async function openingsOf(cat: Catalogue, clinician: Clinician, type: VisitType, today: Day): Promise<Openings> {
  const port = patientsPort();
  const settings = cat.settings!;
  const days = await port.days({ kind: type.id, resource: clinician.id, from: today, days: windowSpan(cat.hours, cat.closures, today, settings.booking_days) });
  const open = days.filter((d) => d.state === "open");
  const todays = open.some((d) => d.date === today) ? await port.times({ kind: type.id, resource: clinician.id, date: today }) : [];
  const leftToday = todays.filter((x) => x.state === "free").length;
  const three: { day: Day; time: Hhmm }[] = todays.filter((x) => x.state === "free").map((x) => ({ day: today, time: x.time }));
  for (const d of open) {
    if (three.length >= 3) break;
    if (d.date === today) continue;
    const times = await port.times({ kind: type.id, resource: clinician.id, date: d.date });
    for (const x of times) if (x.state === "free") three.push({ day: d.date, time: x.time });
    break;
  }
  return { leftToday, next: three[0] ?? null, three: three.slice(0, 3) };
}

export default function Team() {
  const { t } = useI18n();
  const cat = useCatalogue();
  if (cat === null) return null;
  const people = [...cat.clinicians].filter((c) => c.active && c.bookable_online).sort((a, b) => a.position - b.position || a.id - b.id);
  return (
    <div className="rh-screen" data-screen="Team" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHead title={t("team.title")} lede={t("team.lede")} ledeWidth="54ch" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 13 }}>
        {people.map((c) => (
          <Card key={c.id} cat={cat} c={c} />
        ))}
      </div>
    </div>
  );
}

function Card({ cat, c }: { cat: Catalogue; c: Clinician }) {
  const { t } = useI18n();
  const today = useTodayDay();
  const type = mainType(cat, c);
  const [openings, setOpenings] = useState<Openings | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (type === null) return;
    let live = true;
    setOpenings(null);
    openingsOf(cat, c, type, today)
      .then((o) => live && setOpenings(o))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [cat, c, type, today]);

  const does = cat.links
    .filter((l) => l.clinician_id === c.id)
    .map((l) => cat.visitTypes.find((x) => x.id === l.visit_type_id))
    .filter((x): x is VisitType => x !== undefined)
    .sort((a, b) => a.position - b.position)
    .map((x) => x.name)
    .join(" · ");
  const book = (at: { day: Day; time: Hhmm | null }) => {
    if (type === null) return;
    usePatients.setState({ typeId: type.id, clinicianId: c.id, day: at.day, time: at.time, moving: null });
    go("find");
  };

  return (
    <section className="rh-card" aria-labelledby={`team-${String(c.id)}`} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <ClinicianTile name={c.name} color={c.color} size={54} />
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <h2 id={`team-${String(c.id)}`} style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: "-.028em", textWrap: "pretty", lineHeight: "normal" }}>
            {c.name}
          </h2>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{c.role_label}</span>
        </span>
      </div>
      {c.bio !== null && c.bio !== "" && <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{c.bio}</p>}
      {does !== "" && <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), whiteSpace: "normal", lineHeight: 1.55 }}>{does}</span>}
      {failed ? (
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)" }}>{t("pShell.offline")}</span>
      ) : openings === null ? (
        <div className="rh-skel" style={{ height: 60 }} />
      ) : (
        <>
          <span style={{ alignSelf: "flex-start", ...monoPill(openings.next !== null ? "var(--pos-soft)" : "var(--warn-soft)", openings.next !== null ? "var(--pos)" : "var(--warn)"), whiteSpace: "normal" }}>
            <Clock size={12} aria-hidden="true" />
            {openings.next !== null
              ? t("team.nextOpen", { day: dayShort(openings.next.day), time: clockLabel(openings.next.day, openings.next.time) })
              : t("team.nothingOpen", { n: num(cat.settings?.booking_days ?? 10) })}
          </span>
          <span style={mono(11.5, 600, "var(--fg-subtle)")}>{openings.leftToday > 0 ? t("team.leftToday", { n: num(openings.leftToday) }, openings.leftToday) : t("team.noneToday")}</span>
          {openings.three.length > 0 && (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {openings.three.map((s) => {
                const label = `${dayMonth(s.day)} ${clockLabel(s.day, s.time)}`;
                return (
                  <button
                    key={`${s.day}${s.time}`}
                    type="button"
                    className="rh-slot"
                    onClick={() => book(s)}
                    aria-label={t("team.takeTime", { when: label, name: c.short_name })}
                    style={{ ...timeChip, display: "inline-flex", alignItems: "center", height: 34, paddingInline: 11, background: "var(--surface-2)", fontSize: 11.5 }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      <Btn kind="ghostSm" icon={CalendarCheck} onClick={() => book({ day: openings?.next?.day ?? today, time: null })} style={{ height: 40 }} label={t("team.bookWithName", { name: c.short_name })}>
        {t("team.book")}
      </Btn>
    </section>
  );
}
