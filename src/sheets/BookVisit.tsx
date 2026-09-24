/**
 * Book a visit at the desk: a phone call, somebody at the desk, or a walk-in.
 *
 * Who (someone on file, found by the server's search, or someone new typed
 * here), what, with whom, how they reached the desk, and when — the next
 * open times the server offers, or for a walk-in the slot holding now. "Book
 * it" saves; "Place it on the day sheet" hands the choice of time to the day
 * sheet instead.
 *
 * Someone new is saved as a PATIENT first and then booked in their name: a
 * desk booking is never a first visit to check (those are for people who
 * booked themselves online). Both rows carry the action's key, kept until the
 * booking succeeds, so a retry after "that time has just gone" books the
 * patient it already saved rather than making a second. (The demo's "Next
 * booking loses the race" needs nothing of its own here: the next save is
 * refused, and reads as "just gone" with the nearest times.)
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, CalendarDays, CalendarPlus, CircleAlert, ClockAlert, Footprints, Info, Phone, Search, Store, UserPlus, type LucideIcon } from "lucide-react";

import type { Channel, Id } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { actionKey, stepKey } from "../lib/keys.ts";
import { ageOn, dayOf, dayShort, money, time } from "../lib/format.ts";
import { useNow } from "../lib/useNow.ts";
import { cliniciansFor, visitsOn } from "../lib/desk.ts";
import { bookVisit, type BookInput, type Refusal } from "../state/actions.ts";
import { ensurePatients, upsert, useDesk } from "../state/desk.ts";
import { startPlacing, stopPlacing, toast, type Sheet as SheetKind } from "../state/ui.ts";
import { Btn, Sheet, Skeleton, Tile, btnPrimary, chipStyle, fieldStyle, mono, segTrack, segWide } from "../components/ui.tsx";
import { walkInNow } from "./bits/logic.ts";
import { typeIcon } from "./bits/typeIcon.ts";
import { HitRow, Note, SectionLabel, labelText, useRefusal, useSaving } from "./bits/ui.tsx";
import { useNextTimes, type OpenTime } from "./book/nextTimes.ts";
import { usePatientSearch } from "./bits/search.ts";
import { patientColor } from "./registration/shared.ts";

type How = Extract<Channel, "phone" | "desk" | "walk_in">;
type Pick = OpenTime & { now?: boolean };
interface NewDetails {
  name: string;
  dob: string;
  mobile: string;
  email: string;
}

const HOWS: { id: How; icon: LucideIcon }[] = [
  { id: "phone", icon: Phone },
  { id: "desk", icon: Store },
  { id: "walk_in", icon: Footprints },
];

export default function BookVisit({ sheet, onClose }: { sheet: Extract<SheetKind, { kind: "book" }>; onClose: () => void }) {
  const { t, locale } = useI18n();
  const nowMs = useNow();
  const today = dayOf(nowMs);
  const desk = useDesk();
  const refusal = useRefusal();
  const { busy, run } = useSaving();
  const prefill = sheet.prefill ?? {};

  const types = useMemo(() => desk.visitTypes.filter((x) => x.active).sort((a, b) => a.position - b.position || a.id - b.id), [desk.visitTypes]);
  const defaultType = prefill.typeId ?? (types.find((x) => !x.new_patients_only) ?? types[0])?.id ?? null;

  const [q, setQ] = useState("");
  const [patientId, setPatientId] = useState<Id | null>(prefill.patientId ?? null);
  const [isNew, setIsNew] = useState(false);
  const [details, setDetails] = useState<NewDetails>({ name: "", dob: "", mobile: "", email: "" });
  const [typeId, setTypeId] = useState<Id | null>(defaultType);
  const [clinicianId, setClinicianId] = useState<Id | null>(prefill.clinicianId ?? null);
  const [how, setHow] = useState<How>("phone");
  const [pick, setPick] = useState<Pick | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  // The booking's key: made once, kept through every retry until it saves.
  const [key, setKey] = useState(actionKey);

  useEffect(() => {
    if (prefill.patientId !== undefined) void ensurePatients([prefill.patientId]).catch(() => undefined);
  }, [prefill.patientId]);

  const from = prefill.day !== undefined && prefill.day > today ? prefill.day : today;
  const times = useNextTimes(typeId, clinicianId, from, reload);
  const hits = usePatientSearch(patientId === null && !isNew ? q : "", today);

  const patient = patientId === null ? undefined : desk.patients[patientId];
  const type = types.find((x) => x.id === typeId);
  const color = patientColor(desk.visitTypes);
  const eligible = typeId === null ? [] : cliniciansFor(desk, typeId);
  const shortName = (id: Id | null) => desk.clinicians.find((c) => c.id === id)?.short_name ?? "";

  // "Ewan already has 09:30 today": today's visits for them that still stand.
  const todays = patient === undefined ? [] : visitsOn(desk, today).filter((v) => v.patient_id === patient.id && v.status !== "cancelled" && v.status !== "no_show");
  const list = new Intl.ListFormat(locale, { type: "conjunction" });

  // A walk-in: the slot holding now, first, when someone is in and not busy.
  const walkIn = how === "walk_in" && typeId !== null ? walkInNow(desk, typeId, clinicianId, nowMs) : null;
  const ready = times.state === "ready" ? times.times : [];
  const offered: Pick[] = [...(walkIn === null ? [] : [{ day: today, time: time(walkIn.startsAt), startsAt: walkIn.startsAt, clinicianId: walkIn.clinicianId, now: true }]), ...ready].slice(0, 6);
  const nowMessage =
    how === "walk_in" && walkIn === null && times.state === "ready"
      ? ready[0] === undefined
        ? t("book.nobodyNowFar")
        : t("book.nobodyNow", { when: ready[0].day === today ? time(ready[0].startsAt) : `${dayShort(ready[0].day)} ${time(ready[0].startsAt)}` })
      : null;

  const digits = details.mobile.replace(/\D/g, "");
  const emailOk = details.email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim());
  const newOk = isNew && details.name.trim().length > 2 && /^\d{4}-\d{2}-\d{2}$/.test(details.dob.trim()) && digits.length >= 7 && emailOk;
  const whoOk = patient !== undefined || newOk;
  const name = patient?.name ?? details.name.trim();
  const canBook = whoOk && pick !== null && typeId !== null && !busy;
  const hint = !whoOk ? (isNew ? (emailOk ? t("book.hint.newNeeds") : t("book.hint.email")) : t("book.hint.who")) : pick === null ? t("book.hint.time") : null;

  const change = (next: () => void) => {
    next();
    setPick(null);
    setGone(false);
    setError(null);
  };

  const who = (): BookInput["patient"] =>
    patient !== undefined
      ? { id: patient.id }
      : { details: { name: details.name.trim(), born_on: details.dob.trim(), mobile: details.mobile.trim(), email: details.email.trim() === "" ? null : details.email.trim() } };

  /** A refused booking: someone new may already be saved — carry on with them, so nothing is made twice. */
  const afterRefusal = (reason: Refusal) => {
    // Read the store as it is now: the refused try may have saved the patient a moment ago.
    const held = Object.values(useDesk.getState().patients).find((p) => p.client_key === stepKey(key, "a"));
    if (held !== undefined) {
      setPatientId(held.id);
      setIsNew(false);
    }
    setPick(null);
    if (reason === "taken") {
      setGone(true);
      setError(null);
    } else setError(refusal(reason));
    setReload((n) => n + 1);
  };

  const book = async () => {
    if (!canBook || pick === null || typeId === null) return;
    const outcome = await run(() =>
      bookVisit({ patient: who(), visitTypeId: typeId, clinicianId: pick.clinicianId, startsAt: pick.startsAt, channel: how, reason: null, deskNote: null, walkIn: pick.now === true, key }),
    );
    if (outcome === null) return;
    if (!outcome.ok) return afterRefusal(outcome.reason);
    const visit = outcome.value;
    const whoShort = shortName(visit.clinician_id);
    toast(
      pick.now === true
        ? t("book.toast.walkIn", { name, who: whoShort, ref: visit.ref })
        : t("book.toast.booked", { name, who: whoShort, day: dayShort(dayOf(visit.starts_at)), time: time(visit.starts_at), ref: visit.ref }),
      { icon: "calendar-check", tone: "pos" },
    );
    setKey(actionKey());
    onClose();
  };

  const place = () => {
    if (!whoOk || typeId === null || type === undefined) return;
    const patientInput = who();
    const placingKey = key;
    startPlacing({
      what: "booking",
      patientName: name,
      typeId,
      minutes: type.minutes,
      clinicianId,
      day: from,
      place: (at) => {
        void bookVisit({ patient: patientInput, visitTypeId: typeId, clinicianId: at.clinicianId, startsAt: at.startsAt, channel: how, reason: null, deskNote: null, key: placingKey }).then((outcome) => {
          if (!outcome.ok) {
            toast(t(`refusal.${outcome.reason}`), { icon: "circle-alert", tone: "warn" });
            return;
          }
          stopPlacing();
          toast(t("book.toast.booked", { name, who: shortName(outcome.value.clinician_id), day: dayShort(dayOf(outcome.value.starts_at)), time: time(outcome.value.starts_at), ref: outcome.value.ref }), {
            icon: "calendar-check",
            tone: "pos",
          });
        });
      },
    });
  };

  const howWord = { phone: t("book.how.byPhone"), desk: t("book.how.atDesk"), walk_in: t("book.how.walkInWord") }[how];
  const summary =
    whoOk && pick !== null && type !== undefined
      ? t("book.summary", {
          name,
          type: type.name,
          when: pick.now === true ? t("book.summaryNow", { time: time(pick.startsAt) }) : `${dayShort(pick.day)} ${time(pick.startsAt)}`,
          who: shortName(pick.clinicianId),
          how: howWord,
        })
      : null;

  return (
    <Sheet icon={CalendarPlus} title={t("book.title")} sub={t("book.sub")} onClose={onClose}>
      {/* 1 · Who */}
      <section aria-labelledby="bk-who" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionLabel as="h3" id="bk-who">
          {t("book.who")}
        </SectionLabel>
        {patient === undefined && !isNew && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative" }}>
              <Search size={15} aria-hidden="true" style={{ position: "absolute", insetInlineStart: 11, insetBlockStart: 12, color: "var(--fg-subtle)" }} />
              <input
                className="rh-fld"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t("book.search")}
                placeholder={t("book.searchPlaceholder")}
                style={{ ...fieldStyle(false), paddingInlineStart: 34 }}
              />
            </div>
            {hits.state === "hits" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {hits.rows.map((p) => (
                  <HitRow
                    key={p.id}
                    name={p.name}
                    meta={`${p.born_on} · ${p.mobile}`}
                    color={color}
                    onClick={() => {
                      upsert("patients", p);
                      change(() => {
                        setPatientId(p.id);
                        setQ("");
                      });
                    }}
                  />
                ))}
              </div>
            )}
            {hits.state === "none" && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{t("book.noHits")}</span>}
            <button
              type="button"
              className="rh-gi"
              onClick={() =>
                change(() => {
                  const hasDigits = /\d/.test(q);
                  setIsNew(true);
                  setDetails((d) => ({ ...d, name: hasDigits ? d.name : q, mobile: hasDigits ? q : d.mobile }));
                })
              }
              style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, height: 34, paddingInline: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--accent)", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
            >
              <UserPlus size={14} aria-hidden="true" />
              {t("book.newPatient")}
            </button>
          </div>
        )}
        {patient !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: 11, borderRadius: 13, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <Tile name={patient.name} color={color} size={38} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em" }}>{patient.name}</span>
              <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), whiteSpace: "normal", alignSelf: "flex-start" }}>{t("registrations.meta", { born: patient.born_on, age: ageOn(patient.born_on, today), mobile: patient.mobile })}</span>
            </span>
            <button
              type="button"
              className="rh-gi"
              onClick={() => change(() => setPatientId(null))}
              aria-label={t("book.changeWho", { name: patient.name })}
              style={{ height: 30, paddingInline: 10, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {t("book.change")}
            </button>
          </div>
        )}
        {patient !== undefined && todays.length > 0 && (
          <Note tone="warn" icon={CalendarClock} role="alert">
            {t("book.alreadyToday", { name: patient.name.split(/\s+/)[0] ?? patient.name, times: list.format(todays.map((v) => time(v.starts_at))) })}
          </Note>
        )}
        {patient === undefined && isNew && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
            <NewField label={t("book.new.name")} value={details.name} onChange={(v) => setDetails((d) => ({ ...d, name: v }))} placeholder={t("book.new.namePlaceholder")} autoComplete="off" />
            <NewField label={t("book.new.dob")} value={details.dob} onChange={(v) => setDetails((d) => ({ ...d, dob: v }))} placeholder="1990-04-21" mono inputMode="numeric" />
            <NewField label={t("book.new.mobile")} value={details.mobile} onChange={(v) => setDetails((d) => ({ ...d, mobile: v }))} placeholder="07700 900000" mono inputMode="tel" />
            <NewField label={t("book.new.email")} value={details.email} onChange={(v) => setDetails((d) => ({ ...d, email: v }))} placeholder="name@example.com" type="email" />
            <button
              type="button"
              className="rh-gi"
              onClick={() => change(() => setIsNew(false))}
              style={{ gridColumn: "1/-1", justifySelf: "start", height: 32, paddingInline: 11, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {t("book.backToSearch")}
            </button>
          </div>
        )}
      </section>

      {/* 2 · What */}
      <section aria-labelledby="bk-what" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionLabel as="h3" id="bk-what">
          {t("book.what")}
        </SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 7 }}>
          {types.map((x) => {
            const on = x.id === typeId;
            const Icon = typeIcon(x.icon);
            return (
              <button
                key={x.id}
                type="button"
                className="rh-btn"
                aria-pressed={on}
                onClick={() =>
                  change(() => {
                    setTypeId(x.id);
                    setClinicianId(null);
                  })
                }
                style={{ display: "flex", alignItems: "center", gap: 9, padding: 9, borderRadius: 12, cursor: "pointer", textAlign: "start", border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, background: on ? "var(--accent-soft)" : "var(--surface)", color: on ? "var(--accent)" : "var(--fg)" }}
              >
                <span aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--accent-soft)" : "var(--surface-3)", color: on ? "var(--accent)" : "var(--fg-muted)" }}>
                  <Icon size={14} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "-.015em", textWrap: "pretty" }}>{x.name}</span>
                  <span style={{ ...mono(11, 600, on ? "var(--accent)" : "var(--fg-subtle)"), alignSelf: "flex-start" }}>{t("book.typeMeta", { minutes: x.minutes, fee: money(x.fee) })}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3 · With */}
      <section aria-labelledby="bk-with" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionLabel as="h3" id="bk-with">
          {t("book.with")}
        </SectionLabel>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {[{ id: null as Id | null, label: t("book.anyone") }, ...eligible.map((c) => ({ id: c.id as Id | null, label: c.short_name }))].map((c) => (
            <button key={String(c.id)} type="button" className="rh-chip" aria-pressed={clinicianId === c.id} onClick={() => change(() => setClinicianId(c.id))} style={chipStyle(clinicianId === c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* 4 · How */}
      <section aria-labelledby="bk-how" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionLabel as="h3" id="bk-how">
          {t("book.howTitle")}
        </SectionLabel>
        <div role="group" aria-labelledby="bk-how" style={segTrack}>
          {HOWS.map((h) => (
            <button key={h.id} type="button" className="rh-chip" aria-pressed={how === h.id} onClick={() => change(() => setHow(h.id))} style={{ ...segWide(how === h.id), height: 36 }}>
              <h.icon size={13} aria-hidden="true" />
              {t(`book.how.${h.id}`)}
            </button>
          ))}
        </div>
      </section>

      {/* 5 · When */}
      <section aria-labelledby="bk-when" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionLabel as="h3" id="bk-when">
          {t("book.when")}
        </SectionLabel>
        {gone && (
          <Note tone="warn" icon={ClockAlert} role="alert">
            {t("book.gone")}
          </Note>
        )}
        {nowMessage !== null && (
          <Note tone="info" icon={Info} role="status" style={{ alignItems: "center", padding: "10px 12px", borderRadius: 11 }}>
            {nowMessage}
          </Note>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 }}>
          {times.state === "loading"
            ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={42} radius={11} />)
            : offered.map((x) => {
                const on = pick !== null && pick.startsAt === x.startsAt && pick.clinicianId === x.clinicianId;
                return (
                  <button
                    key={`${x.startsAt}-${String(x.clinicianId)}`}
                    type="button"
                    className="rh-slot"
                    aria-pressed={on}
                    onClick={() => {
                      setPick(x);
                      setGone(false);
                      setError(null);
                    }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 42, padding: "6px 10px", borderRadius: 11, cursor: "pointer", textAlign: "center", lineHeight: 1.35, border: `1px solid ${on ? "transparent" : "var(--border-strong)"}`, background: on ? "var(--accent)" : "var(--surface)", ...mono(11.5, 600, on ? "var(--accent-fg)" : "var(--fg)"), whiteSpace: "normal" }}
                  >
                    {x.now === true ? t("book.nowChip", { time: time(x.startsAt), who: shortName(x.clinicianId) }) : t("book.timeChip", { day: dayShort(x.day), time: time(x.startsAt), who: shortName(x.clinicianId) })}
                  </button>
                );
              })}
        </div>
        {times.state === "ready" && offered.length === 0 && nowMessage === null && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{t("book.noTimes")}</span>}
        {times.state === "failed" && (
          <Note tone="danger" icon={CircleAlert} role="alert">
            {t("book.timesFailed")}
          </Note>
        )}
        <button
          type="button"
          className="rh-gi"
          onClick={place}
          disabled={!whoOk}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, alignSelf: "flex-start", height: 34, paddingInline: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: whoOk ? "var(--accent)" : "var(--fg-subtle)", fontSize: 12.5, fontWeight: 800, cursor: whoOk ? "pointer" : "not-allowed" }}
        >
          <CalendarDays size={14} aria-hidden="true" />
          {t("book.place")}
        </button>
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingBlockStart: 14, borderBlockStart: "1px solid var(--border)" }}>
        {summary !== null && <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.55, color: "var(--fg)", textWrap: "pretty" }}>{summary}</span>}
        {error !== null && (
          <Note tone="danger" icon={CircleAlert} role="alert">
            {error}
          </Note>
        )}
        <Btn icon={CalendarCheck} busy={busy} disabled={!canBook} onClick={() => void book()} style={{ ...btnPrimary, width: "100%", ...(!canBook && !busy ? { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 } : {}) }}>
          {t("book.bookIt")}
        </Btn>
        {hint !== null && <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{hint}</span>}
      </div>
    </Sheet>
  );
}

function NewField({
  label,
  value,
  onChange,
  placeholder,
  mono: isMono = false,
  type = "text",
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  mono?: boolean;
  type?: "text" | "email";
  inputMode?: "numeric" | "tel";
  autoComplete?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={labelText}>{label}</span>
      <input className="rh-fld" type={type} inputMode={inputMode} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={fieldStyle(isMono)} />
    </label>
  );
}
