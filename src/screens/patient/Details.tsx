/**
 * Who is coming in (P2): a returning patient finds their record by mobile and
 * date of birth ("Found you, Cormac E."); someone new gives their details;
 * both say what the visit is for. The rail sums the visit up and books it.
 *
 * A returning booking rides the lookup session, and the server puts it on
 * that patient's record. So a first visit never goes out while a session is
 * held (it would land on the found person), and a returning one never goes
 * out once the session has ended (it would go out with nobody's name).
 */
import { useState } from "react";
import { CalendarCheck, Check, ChevronLeft, ChevronRight, PhoneCall, Search } from "lucide-react";

import { PortError } from "../../data/ports.ts";
import { useI18n } from "../../i18n/index.tsx";
import { locale } from "../../i18n/ambient.ts";
import { Btn, cardStyle, mono, pill, segWide } from "../../components/ui.tsx";
import { dayShort, money, num } from "../../lib/format.ts";
import { bookVisit, findMe, loadCatalogue, patientsPort, signOutPatient, usePatients } from "../../state/patients.ts";
import { useDemoSignal } from "../../state/demoSignal.ts";
import { go } from "../../state/ui.ts";
import { findMessage } from "./VerifyFlow.tsx";
import { resetBooking, setBooking, useFlow, type FindProblem } from "./flow.ts";
import { bookProblem, firstAndInitial, firstName, isEmail, lookupProblem, personReady, type BookProblem } from "./logic.ts";
import { nearestFor } from "./nearest.ts";
import { ClinicianTile, GoneBox, Notice, TextInput, clinicianNamed, labelStyle, sectionLabel, useCatalogue, useNarrow } from "./parts.tsx";
import { useTodayDay } from "./useToday.ts";
import { atInstant, clockLabel, rangeLabel } from "./when.ts";

const REASON_MAX = 240;

const areaStyle = {
  width: "100%",
  minHeight: 84,
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid var(--border-strong)",
  background: "var(--surface-2)",
  color: "var(--fg)",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.55,
} as const;

export default function Details() {
  const { t, dir } = useI18n();
  const cat = useCatalogue();
  const narrow = useNarrow();
  const today = useTodayDay();
  const b = useFlow((s) => s.booking);
  const typeId = usePatients((s) => s.typeId);
  const clinicianId = usePatients((s) => s.clinicianId);
  const day = usePatients((s) => s.day);
  const time = usePatients((s) => s.time);
  const found = usePatients((s) => s.found);
  const [finding, setFinding] = useState(false);
  const [booking, setBookingBusy] = useState(false);
  const [problem, setProblem] = useState<BookProblem | null>(null);

  useDemoSignal("details.fill", (p) => {
    if (p["mode"] === "first") setBooking({ returning: false, foundName: null, name: p["name"] ?? "", bornOn: p["bornOn"] ?? "", mobile: p["mobile"] ?? "", email: p["email"] ?? "" });
    else setBooking({ returning: true, lkMobile: p["mobile"] ?? "", lkBornOn: p["bornOn"] ?? "", lkProblem: null, foundName: null });
  });

  const settings = cat?.settings ?? null;
  if (cat === null || settings === null) return null;
  const type = cat.visitTypes.find((x) => x.id === typeId) ?? null;
  const who = clinicianId === "any" ? null : clinicianNamed(cat, clinicianId);
  const newOnly = type?.new_patients_only === true;
  const firstAllowed = settings.new_patients_online;
  // A new-patient visit is a first visit; with first visits off online, only returning patients book here.
  const returning = newOnly ? false : !firstAllowed ? true : b.returning;
  const shownFound = returning && b.foundName !== null && found !== null ? b.foundName : null;
  const picked = type !== null && day !== null && time !== null;

  const person = { name: b.name, bornOn: b.bornOn, mobile: b.mobile };
  const emailOk = b.email.trim() === "" || isEmail(b.email);
  const ready = picked && (returning ? shownFound !== null : personReady(person, today) && emailOk);
  const hint = !picked ? t("details.hintPick") : returning ? t("details.hintFind") : !emailOk ? t("details.badEmail") : t("details.hintPerson");

  const lookup = async () => {
    const mobile = b.lkMobile.trim();
    const bornOn = b.lkBornOn.trim();
    if (mobile === "" || bornOn === "") {
      setBooking({ lkProblem: "needBoth", foundName: null });
      return;
    }
    setFinding(true);
    try {
      const hit = await findMe(mobile, bornOn);
      setBooking(hit === null ? { lkProblem: "notFound", foundName: null } : { lkProblem: null, foundName: hit.name });
    } catch (error) {
      setBooking({ lkProblem: lookupProblem(error instanceof PortError ? error.code : ""), foundName: null });
    } finally {
      setFinding(false);
    }
  };

  const book = async () => {
    if (!ready || type === null || day === null || time === null) return;
    setBookingBusy(true);
    setProblem(null);
    try {
      if (returning && patientsPort().level() === null) {
        // The half hour ran out since "Find my record": find it again rather than book with nobody's name.
        setBooking({ foundName: null, lkProblem: "sessionEnded" });
        return;
      }
      if (!returning && patientsPort().level() !== null) await signOutPatient();
      const visit = {
        visit_type_id: type.id,
        clinician_id: clinicianId === "any" ? null : clinicianId,
        starts_at: atInstant(day, time),
        reason: b.reason.trim() === "" ? null : b.reason.trim(),
        desk_note: b.deskNote.trim() === "" ? null : b.deskNote.trim(),
        language: locale(),
        ...(returning ? {} : { newPatient: { name: b.name.trim(), born_on: b.bornOn.trim(), mobile: b.mobile.trim(), email: b.email.trim() === "" ? null : b.email.trim() } }),
      };
      await bookVisit(visit, { firstName: firstName(returning ? (found?.name ?? "") : b.name), email: returning ? null : visit.newPatient?.email ?? null });
      resetBooking();
      usePatients.setState({ time: null });
      go("confirm");
    } catch (error) {
      const code = error instanceof PortError ? error.code : "";
      const kind = bookProblem(code, error instanceof PortError ? error.params : {});
      if (kind === "gone") {
        setBooking({ gone: await nearestFor(type.id, clinicianId, undefined, day, time) });
      } else if (kind === "sessionEnded") {
        await signOutPatient();
        setBooking({ foundName: null, lkProblem: "sessionEnded" });
      } else {
        if (kind === "switchedOff") void loadCatalogue();
        setProblem(kind);
      }
    } finally {
      setBookingBusy(false);
    }
  };

  const Chevron = dir === "rtl" ? ChevronRight : ChevronLeft;
  const rows = [
    { id: "day", label: t("details.day"), val: day === null ? "—" : dayShort(day) },
    { id: "time", label: t("details.time"), val: day !== null && time !== null && type !== null ? rangeLabel(day, time, type.minutes) : "—" },
    { id: "len", label: t("details.length"), val: type === null ? "—" : t("find.minShort", { n: num(type.minutes) }) },
    { id: "for", label: t("details.for"), val: type?.name ?? "—" },
  ];
  const lkErrId = "lk-err";

  return (
    <div className="rh-screen" data-screen="Details" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <button
          type="button"
          className="rh-gi"
          onClick={() => go("find")}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 31, paddingInline: 11, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
        >
          <Chevron size={14} aria-hidden="true" />
          {t("details.changeTime")}
        </button>
        <h1 style={{ margin: "14px 0 0", fontSize: "clamp(24px,3.4vw,31px)", fontWeight: 800, letterSpacing: "-.036em", lineHeight: 1.12 }}>{t("details.title")}</h1>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <section aria-labelledby="dt-before" style={cardStyle}>
            <h2 id="dt-before" style={{ margin: 0, fontSize: 14.5, fontWeight: 800, letterSpacing: "-.022em", lineHeight: "normal" }}>
              {newOnly ? t("details.firstTitle") : t("details.before")}
            </h2>
            {!newOnly && firstAllowed && (
              <div role="group" aria-labelledby="dt-before" style={{ display: "flex", gap: 3, marginBlockStart: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 11, padding: 3 }}>
                <button type="button" className="rh-chip" aria-pressed={returning} onClick={() => setBooking({ returning: true })} style={segWide(returning)}>
                  {t("details.yesReturning")}
                </button>
                <button type="button" className="rh-chip" aria-pressed={!returning} onClick={() => setBooking({ returning: false, foundName: null, lkProblem: null })} style={segWide(!returning)}>
                  {t("details.noFirst")}
                </button>
              </div>
            )}

            {returning ? (
              <div style={{ marginBlockStart: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void lookup();
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                    <TextInput id="lk-mobile" label={t("code.mobile")} value={b.lkMobile} onChange={(v) => setBooking({ lkMobile: v, lkProblem: null, foundName: null })} placeholder="07700 900000" isMono type="tel" autoComplete="tel" invalid={b.lkProblem === "notFound"} describedBy={b.lkProblem !== null ? lkErrId : undefined} />
                    <TextInput id="lk-born" label={t("code.bornOn")} value={b.lkBornOn} onChange={(v) => setBooking({ lkBornOn: v, lkProblem: null, foundName: null })} placeholder="1991-06-02" isMono inputMode="numeric" autoComplete="bday" invalid={b.lkProblem === "notFound"} describedBy={b.lkProblem !== null ? lkErrId : undefined} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <Btn kind="ghostSm" type="submit" icon={Search} busy={finding}>
                      {t("details.findRecord")}
                    </Btn>
                  </div>
                </form>
                {b.lkProblem !== null && <Notice id={lkErrId}>{lookupWords(t, b.lkProblem, settings.phone)}</Notice>}
                {shownFound !== null && (
                  <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, padding: 13, borderRadius: 13, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                    <ClinicianTile name={shownFound} color={cat.visitTypes[0]?.color ?? "#3b6fbd"} size={36} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.02em" }}>{firstAndInitial(shownFound)}</span>
                    </span>
                    <span style={{ marginInlineStart: "auto", ...pill("var(--pos-soft)", "var(--pos)") }}>
                      <Check size={12} aria-hidden="true" />
                      {t("details.foundYou")}
                    </span>
                  </div>
                )}
                {!firstAllowed && (
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)" }}>{t("details.newRing", { phone: settings.phone })}</p>
                )}
              </div>
            ) : (
              <div style={{ marginBlockStart: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
                <TextInput id="fv-name" label={t("details.name")} value={b.name} onChange={(v) => setBooking({ name: v })} placeholder={t("details.namePh")} autoComplete="name" />
                <TextInput id="fv-born" label={t("code.bornOn")} value={b.bornOn} onChange={(v) => setBooking({ bornOn: v })} placeholder="1990-04-21" isMono inputMode="numeric" autoComplete="bday" />
                <TextInput id="fv-mobile" label={t("code.mobile")} value={b.mobile} onChange={(v) => setBooking({ mobile: v })} placeholder="07700 900000" isMono type="tel" autoComplete="tel" />
                <TextInput id="fv-email" label={t("details.email")} value={b.email} onChange={(v) => setBooking({ email: v })} placeholder="you@example.com" type="email" autoComplete="email" invalid={!emailOk} />
                <p style={{ gridColumn: "1/-1", margin: "2px 0 0", display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>
                  <PhoneCall size={13} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 2 }} />
                  {t("details.mayRing")}
                </p>
              </div>
            )}
          </section>

          <section style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <label htmlFor="dt-reason" style={labelStyle}>
                  {t("details.reason")}
                </label>
                <span aria-live="polite" style={mono(11, 600, b.reason.length > 220 ? "var(--warn)" : "var(--fg-subtle)")}>{`${num(b.reason.length)} / ${num(REASON_MAX)}`}</span>
              </span>
              <textarea id="dt-reason" className="rh-fld" value={b.reason} maxLength={REASON_MAX} onChange={(e) => setBooking({ reason: e.target.value.slice(0, REASON_MAX) })} placeholder={t("details.reasonPh")} style={areaStyle} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label htmlFor="dt-desk" style={labelStyle}>
                {t("details.deskNote")}
              </label>
              <textarea id="dt-desk" className="rh-fld" value={b.deskNote} onChange={(e) => setBooking({ deskNote: e.target.value })} placeholder={t("details.deskNotePh")} aria-describedby="dt-desk-help" style={{ ...areaStyle, minHeight: 64 }} />
              <span id="dt-desk-help" style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-subtle)", textWrap: "pretty" }}>
                {t("details.deskNoteHelp")}
              </span>
            </div>
          </section>
        </div>

        <aside
          aria-labelledby="dt-rail"
          style={{ position: narrow ? "static" : "sticky", insetBlockStart: 88, padding: 18, borderRadius: 16, border: "1px solid var(--border-strong)", background: "var(--surface)", boxShadow: "var(--shadow)" }}
        >
          <h2 id="dt-rail" style={{ ...sectionLabel, margin: 0, lineHeight: "normal" }}>
            {t("details.yourVisit")}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBlockStart: 14 }}>
            <ClinicianTile name={who?.name ?? null} color={who?.color ?? null} size={36} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.02em" }}>{who?.short ?? t("find.firstOpenClinician")}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)" }}>{who?.role ?? t("find.whoeverOpen")}</span>
            </span>
          </div>
          <dl style={{ display: "flex", flexDirection: "column", gap: 9, margin: "16px 0 0", paddingBlock: 14, borderBlock: "1px solid var(--border)" }}>
            {rows.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <dt style={{ fontSize: 12.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{r.label}</dt>
                <dd style={{ margin: 0, marginInlineStart: "auto", ...mono(12.5, 600, "var(--fg)"), whiteSpace: "normal", textAlign: "end" }}>{r.val}</dd>
              </div>
            ))}
          </dl>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBlockStart: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{t("details.fee")}</span>
            <span style={mono(16, 600, "var(--fg)")}>{type === null ? "—" : money(type.fee, settings.currency)}</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)" }}>{t("details.payable")}</p>
          {b.gone === null ? (
            <Btn icon={CalendarCheck} busy={booking} disabled={!ready} onClick={() => void book()} style={{ width: "100%", marginBlockStart: 14, ...(ready ? {} : { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 }) }}>
              {t("details.book")}
            </Btn>
          ) : (
            <GoneBox
              near={b.gone}
              dayLabel={day === null ? "" : dayShort(day)}
              timeLabel={(tm) => (day === null ? tm : clockLabel(day, tm))}
              onPick={(tm) => {
                setBooking({ gone: null });
                usePatients.setState({ time: tm });
              }}
            />
          )}
          {problem !== null && <Notice style={{ marginBlockStart: 12 }}>{bookWords(t, problem, settings.phone)}</Notice>}
          {!ready && b.gone === null && <p style={{ margin: "9px 0 0", fontSize: 11.5, fontWeight: 700, lineHeight: 1.5, color: "var(--fg-subtle)", textWrap: "pretty" }}>{hint}</p>}
        </aside>
      </div>
    </div>
  );
}

/** Step one's words on this page: the shared ones, and "your session ended". */
function lookupWords(t: ReturnType<typeof useI18n>["t"], problem: FindProblem, phone: string): string {
  return problem === "sessionEnded" ? t("details.foundAgain") : findMessage(t, problem, phone);
}

/** A refused booking in words. */
export function bookWords(t: ReturnType<typeof useI18n>["t"], problem: BookProblem, phone: string): string {
  switch (problem) {
    case "limit":
      return t("details.limit", { phone });
    case "switchedOff":
      return t("code.closed", { phone });
    case "proof":
      return t("code.proof", { phone });
    case "tooLate":
      return t("visits.tooLate", { phone });
    case "invalid":
      return t("details.invalid", { phone });
    case "sessionEnded":
      return t("details.foundAgain");
    default:
      return t("pShell.offline");
  }
}
