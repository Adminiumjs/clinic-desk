/**
 * One patient's page: who they are, a glance, their visit history (newest
 * first, a page at a time), what is coming up, what they owe and when they
 * are due back.
 *
 * The page reads the patient's own rows when it opens and folds the visits
 * into the desk, so a payment taken from here, a visit moved on the day sheet
 * or another desk's change shows here as it lands.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarPlus, ChevronLeft, ChevronRight, History, MessageSquare, MessageSquareOff, Receipt, ShieldAlert } from "lucide-react";

import type { PatientPage as Page, TextStanding } from "../../data/ports.ts";
import type { Appointment, Id, Recall } from "../../data/types.ts";
import { IN_THE_BUILDING } from "../../data/types.ts";
import { addDays } from "../../data/venueTime.ts";
import { useI18n } from "../../i18n/index.tsx";
import { today } from "../../lib/clock.ts";
import { ageOn, dayOf, daysBetween, dayShort, time, num } from "../../lib/format.ts";
import { clinicianOf, typeOf } from "../../lib/desk.ts";
import { useNow } from "../../lib/useNow.ts";
import { texts } from "../../i18n/strings/texts.ts";
import { TEXT_BOX_VERSION } from "../../manifest/texts.ts";
import { HOSTED } from "../../surface.ts";
import { isEmbedded } from "../../embed.ts";
import { deskReads, deskVisits, upsert, useCan, useDesk } from "../../state/desk.ts";
import { go, openPanel, openSheet, toast, useUi } from "../../state/ui.ts";
import { Btn, Chip, Dot, Skeleton, Tile, btnGhostSm, mono, monoPill, pill, useDark } from "../../components/ui.tsx";
import { tint } from "../../lib/color.ts";
import { amountText } from "../../sheets/deskwork/money.ts";
import { counted, dayMonthNear, dayYear, relativeDay } from "../deskwork/dates.ts";
import { Screen, cardStyle, dashedNote, kickerStyle, titleStyle } from "../deskwork/parts.tsx";
import { useNarrow } from "../deskwork/useNarrow.ts";

const HISTORY_PAGE = 10;
const asideCard = { padding: 16, borderRadius: 15, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)" } as const;

/**
 * The patient's record page in the dashboard.
 *
 * INTEGRATOR: move to a shared helper beside the manifest's page refs — the
 * dashboard's record route is `/p/<page>/r/<id>`.
 */
const recordHref = (id: Id): string => `/p/clinic-patients/r/${encodeURIComponent(String(id))}`;

export default function PatientPage({ id }: { id: Id }) {
  const { t, dir } = useI18n();
  const [page, setPage] = useState<Page | null>(null);
  const [failed, setFailed] = useState(false);
  const [again, setAgain] = useState(0);
  const [shown, setShown] = useState(HISTORY_PAGE);

  useEffect(() => {
    let live = true;
    setFailed(false);
    deskReads()
      .patientPage(id)
      .then((read) => {
        if (!live) return;
        // Into the desk, so this page follows every change to them from now on.
        upsert("patients", read.patient);
        for (const visit of read.visits) upsert("appointments", visit);
        for (const payment of read.payments) upsert("payments", payment);
        // A visit still being paid for online, or never paid for, is not on their record yet.
        setPage({ ...read, visits: deskVisits(read.visits) });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id, again]);

  const Back = dir === "rtl" ? ChevronRight : ChevronLeft;
  const back = (
    <button
      type="button"
      className="rh-gi"
      onClick={() => useUi.setState({ patientId: null })}
      style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, height: 32, paddingInline: 11, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
    >
      <Back size={14} aria-hidden="true" />
      {t("patients.back")}
    </button>
  );

  if (failed) {
    return (
      <Screen name="Patients" style={{ gap: 16 }}>
        {back}
        <div role="alert" style={{ ...dashedNote, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 180 }}>{t("patients.pageFailed")}</span>
          <Btn kind="ghostSm" onClick={() => setAgain((n) => n + 1)}>
            {t("common.tryAgain")}
          </Btn>
        </div>
      </Screen>
    );
  }
  if (page === null) {
    return (
      <Screen name="Patients" style={{ gap: 16 }}>
        {back}
        <Skeleton height={60} />
        <Skeleton height={70} />
        <Skeleton height={260} />
      </Screen>
    );
  }
  return (
    <Screen name="Patients" style={{ gap: 16 }}>
      {back}
      <Loaded id={id} page={page} shown={shown} onMore={() => setShown((n) => n + HISTORY_PAGE)} />
    </Screen>
  );
}

function Loaded({ id, page, shown, onMore }: { id: Id; page: Page; shown: number; onMore: () => void }) {
  const { t } = useI18n();
  const dark = useDark();
  const now = useNow();
  const day = today();
  const patient = useDesk((s) => s.patients[id]) ?? page.patient;
  const heldVisits = useDesk((s) => s.visits);
  const heldRecalls = useDesk((s) => s.recalls);
  const payments = useDesk((s) => s.payments);
  const desk = useDesk();
  const canBook = useCan("appointments", "create");
  const canPay = useCan("payments", "create");
  const narrow = useNarrow();

  const visits = useMemo(() => Object.values(heldVisits).filter((v) => v.patient_id === id), [heldVisits, id]);
  const upcoming = visits.filter((v) => v.status === "booked" && Date.parse(v.starts_at) >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const history = visits
    .filter((v) => v.status !== "cancelled" && !(v.status === "booked" && Date.parse(v.starts_at) >= now))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  // Visits beyond the ones read are older than every one read: all history.
  const unread = Math.max(0, page.visitsTotal - page.visits.length);
  const bills = history.filter((v) => v.status === "seen" && v.balance > 0).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const owed = bills.reduce((sum, v) => sum + v.balance, 0);
  const year = day.slice(0, 4);
  const thisYear = history.filter((v) => dayOf(v.starts_at).slice(0, 4) === year).length;
  const noShows = history.filter((v) => v.status === "no_show").length;
  const visitIds = new Set(visits.map((v) => v.id));
  const lastPaid = Object.values(payments)
    .filter((p) => visitIds.has(p.appointment_id) && !p.voided)
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at))[0];
  const recall = nextRecall(id, page.recalls, heldRecalls);
  const allergy = (patient.allergies_note ?? "").trim();
  const tintHex = [...desk.visitTypes].sort((a, b) => a.position - b.position)[0]?.color ?? "#0369a1";

  const glance = [
    { id: "y", label: t("patients.glance.year"), value: num(thisYear), warn: false },
    { id: "n", label: t("patients.glance.noShows"), value: num(noShows), warn: noShows > 0 },
    { id: "p", label: t("patients.glance.lastPayment"), value: lastPaid === undefined ? "—" : dayMonthNear(dayOf(lastPaid.paid_at), day), warn: false },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Tile name={patient.name} color={tintHex} size={52} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ ...titleStyle, margin: 0 }}>{patient.name}</h1>
          <div style={{ marginBlockStart: 5, ...mono(12.5, 600, "var(--fg-subtle)"), whiteSpace: "normal" }}>
            {t("patients.meta", { born: dayYear(patient.born_on), age: t("patients.age", counted(ageOn(patient.born_on, day)), ageOn(patient.born_on, day)), mobile: patient.mobile })}
          </div>
        </div>
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {allergy !== "" && (
            <span style={pill("var(--warn-soft)", "var(--warn)")}>
              <ShieldAlert size={12} aria-hidden="true" />
              {t("patients.allergies", { note: allergy })}
            </span>
          )}
          <span style={pill("var(--surface-3)", "var(--fg-muted)")}>
            <History size={12} aria-hidden="true" />
            {t("patients.visits", counted(history.length + unread), history.length + unread)}
          </span>
          {canBook && (
            <Btn icon={CalendarPlus} onClick={() => openSheet({ kind: "book", prefill: { patientId: id } })} style={{ height: 34, paddingInline: 13, fontSize: 12.5 }}>
              {t("patients.book")}
            </Btn>
          )}
          <EditDetails id={id} name={patient.name} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
        {glance.map((g) => (
          <div key={g.id} style={{ flex: 1, minWidth: 140, padding: "13px 15px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>{g.label}</div>
            <div style={{ marginBlockStart: 7, ...mono(15, 600, g.warn ? "var(--warn)" : "var(--fg)") }}>{g.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) 290px", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <section aria-labelledby="pd-history" style={cardStyle}>
            <h2 id="pd-history" style={{ ...kickerStyle, margin: 0 }}>
              {t("patients.history")}
            </h2>
            <ol style={{ listStyle: "none", margin: "13px 0 0", padding: 0, display: "flex", flexDirection: "column" }}>
              {history.slice(0, shown).map((v, i, list) => (
                <HistoryItem key={v.id} visit={v} line={i < list.length - 1} dark={dark} />
              ))}
            </ol>
            {history.length === 0 && unread === 0 && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-muted)" }}>{t("patients.noHistory")}</div>}
            {history.length > shown && (
              <button type="button" className="rh-btn" onClick={onMore} style={{ ...btnGhostSm, height: 34 }}>
                {t("patients.moreHistory")}
              </button>
            )}
            {history.length <= shown && unread > 0 && (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-muted)" }}>{t("patients.olderOnRecord", counted(unread), unread)}</div>
            )}
          </section>
          {!HOSTED && <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.6, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("patients.recordsLine")}</p>}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <section aria-labelledby="pd-up" style={asideCard}>
            <h2 id="pd-up" style={{ ...kickerStyle, margin: 0 }}>
              {t("patients.comingUp")}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBlockStart: 11 }}>
              {upcoming.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="rh-row"
                  onClick={() => {
                    go("daysheet");
                    useUi.setState({ sheetDay: dayOf(v.starts_at) });
                    openPanel(v.id);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: 11, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)", cursor: "pointer", textAlign: "start" }}
                >
                  <Dot color={typeOf(desk, v.visit_type_id)?.color ?? tintHex} size={9} />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={mono(12.5, 600, "var(--fg)")}>{`${dayShort(dayOf(v.starts_at))} · ${time(v.starts_at)}`}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-muted)" }}>
                      {[v.reason ?? typeOf(desk, v.visit_type_id)?.name, clinicianOf(desk, v.clinician_id)?.short_name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              ))}
              {upcoming.length === 0 && <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{t("patients.nothingBooked")}</div>}
            </div>
          </section>

          <section aria-labelledby="pd-owed" style={asideCard}>
            <h2 id="pd-owed" style={{ ...kickerStyle, margin: 0 }}>
              {t("patients.outstanding")}
            </h2>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBlockStart: 9, flexWrap: "wrap" }}>
              <span style={mono(owed > 0 ? 19 : 15, 600, owed > 0 ? "var(--warn)" : "var(--pos)")}>{owed > 0 ? amountText(owed) : t("patients.nothingOwing")}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)" }}>{owed > 0 ? t("patients.across", counted(bills.length), bills.length) : t("patients.settled")}</span>
            </div>
            {owed > 0 && canPay && (
              <button
                type="button"
                className="rh-btn"
                onClick={() => openSheet({ kind: "payment", visitId: bills[0]!.id, amount: bills[0]!.balance })}
                style={{ ...btnGhostSm, marginBlockStart: 12, width: "100%" }}
              >
                <Receipt size={15} aria-hidden="true" />
                {t("patients.record")}
              </button>
            )}
          </section>

          <section aria-labelledby="pd-recall" style={asideCard}>
            <h2 id="pd-recall" style={{ ...kickerStyle, margin: 0 }}>
              {t("patients.seenAgain")}
            </h2>
            <div style={{ marginBlockStart: 9, fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em" }}>{recall === undefined ? t("patients.nothingScheduled") : dayShort(recall.due_on)}</div>
            <RecallLine recall={recall} day={day} />
          </section>
          <TextsCard page={page} />
        </aside>
      </div>
    </>
  );
}

function RecallLine({ recall, day }: { recall: Recall | undefined; day: string }) {
  const { t } = useI18n();
  if (recall === undefined) return <div style={{ marginBlockStart: 4, ...mono(11.5, 600, "var(--fg-subtle)"), whiteSpace: "normal" }}>{t("patients.noRecall")}</div>;
  const last = dayMonthNear(addDays(recall.due_on, -recall.weeks * 7), day);
  const over = recall.due_on < day;
  const after = t("patients.weeksAfter", { date: last }, recall.weeks);
  const text = over
    ? `${t("patients.daysOverdue", counted(daysBetween(recall.due_on, day)), daysBetween(recall.due_on, day))} · ${after}`
    : `${t("patients.dueWhen", { when: relativeDay(recall.due_on, day) })} · ${after}`;
  return <div style={{ marginBlockStart: 4, ...mono(11.5, 600, over ? "var(--danger)" : "var(--fg-subtle)"), whiteSpace: "normal" }}>{text}</div>;
}

function HistoryItem({ visit: v, line, dark }: { visit: Appointment; line: boolean; dark: boolean }) {
  const { t } = useI18n();
  const desk = useDesk();
  const canSeeMoney = useCan("payments", "read");
  const type = typeOf(desk, v.visit_type_id);
  const clinician = clinicianOf(desk, v.clinician_id);
  const inBuilding = IN_THE_BUILDING.includes(v.status);
  // Each payment that stands opens its receipt again: to print it once more, or for their insurer.
  const paid = canSeeMoney
    ? Object.values(desk.payments)
        .filter((p) => p.appointment_id === v.id && !p.voided)
        .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
    : [];
  return (
    <li style={{ display: "flex", gap: 13 }}>
      <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 12 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", marginBlockStart: 4, flexShrink: 0, background: tint(type?.color ?? "#0369a1", dark) }} />
        {line && <span style={{ flex: 1, width: 1.5, background: "var(--border)" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBlockEnd: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
          <span style={mono(11.5, 600, "var(--fg-subtle)")}>{dayMonthNear(dayOf(v.starts_at), today())}</span>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-.02em" }}>{v.reason ?? type?.name ?? ""}</span>
          {v.status === "seen" && v.balance > 0 && <span style={monoPill("var(--warn-soft)", "var(--warn)")}>{t("patients.owing", { amount: amountText(v.balance) })}</span>}
          {inBuilding && <span style={monoPill("var(--info-soft)", "var(--info)")}>{t(`status.${v.status}`)}</span>}
          {v.status === "no_show" && <span style={monoPill("var(--danger-soft)", "var(--danger)")}>{t("status.no_show")}</span>}
        </div>
        <div style={{ marginBlockStart: 3, fontSize: 12, fontWeight: 700, color: "var(--fg-subtle)" }}>
          {[clinician?.short_name, clinician?.role_label, v.ref].filter(Boolean).join(" · ")}
        </div>
        {paid.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBlockStart: 8 }}>
            {paid.map((p) => (
              <button
                key={p.id}
                type="button"
                className="rh-gi"
                onClick={() => openSheet({ kind: "receipt", paymentId: p.id })}
                aria-label={t("patients.receiptLabel", { amount: amountText(p.amount), day: dayMonthNear(dayOf(p.paid_at), today()) })}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 30, paddingInline: 10, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--fg-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                <Receipt size={13} aria-hidden="true" />
                {t("patients.receipt", { amount: amountText(p.amount) })}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** "Edit details": the patient's record page in the dashboard (in the demo, what that would do). */
function EditDetails({ id, name }: { id: Id; name: string }) {
  const { t } = useI18n();
  const style = { display: "inline-flex", alignItems: "center", gap: 5, height: 34, paddingInline: 10, borderRadius: 10, border: "none", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 800, cursor: "pointer", textDecoration: "none" } as const;
  if (!HOSTED) {
    return (
      <button type="button" className="rh-gi" style={style} onClick={() => toast(t("patients.editOpening", { name }), { icon: "arrow-up-right" })}>
        {t("patients.edit")}
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    );
  }
  // Inside the dashboard it opens in place; on the desk's own address, in a new tab.
  const inPlace = isEmbedded();
  return (
    <a className="rh-gi" href={recordHref(id)} target={inPlace ? "_top" : "_blank"} rel="noopener" style={style}>
      {t("patients.edit")}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}

/** The next due or noted recall: the desk's copy is fresher than the page's. */
function nextRecall(id: Id, read: readonly Recall[], held: Record<Id, Recall>): Recall | undefined {
  const byId = new Map<Id, Recall>(read.map((r) => [r.id, r]));
  for (const r of Object.values(held)) if (r.patient_id === id) byId.set(r.id, r);
  return [...byId.values()].filter((r) => r.status === "due" || r.status === "noted").sort((a, b) => a.due_on.localeCompare(b.due_on))[0];
}

/** How the desk heard a yes or a no, in the order it asks. */
const HOWS = ["in-person", "phone", "paper"] as const;

/**
 * Where the patient stands on visit texts, as Adminium keeps it (its text
 * consent log and its stop list), with the last text logged for them. The
 * desk may record a yes the patient gave in person, by phone or on paper,
 * having read them the box's words (recorded with them and their version),
 * or their no: Adminium names who recorded it and audits it. Nothing here
 * lifts a STOP: only the patient's own START does. Not shown to whoever may
 * not change a patient (a clinician).
 */
function TextsCard({ page }: { page: Page }) {
  const { t, locale } = useI18n();
  const mayChange = useCan("patients", "update");
  const settings = useDesk((s) => s.settings);
  const patient = useDesk((s) => s.patients[page.patient.id]) ?? page.patient;
  const [standing, setStanding] = useState<TextStanding | null | undefined>(undefined);
  const [asking, setAsking] = useState<null | "yes">(null);
  const [how, setHow] = useState<(typeof HOWS)[number]>("in-person");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!mayChange) return;
    let live = true;
    deskReads()
      .textStanding(patient.id)
      .then((found) => live && setStanding(found))
      .catch(() => live && setStanding(null));
    return () => {
      live = false;
    };
  }, [patient.id, patient.mobile, mayChange]);
  if (!mayChange || settings?.texts_on !== true || standing === undefined) return null;

  // The box's words in the patient's language (the practice's otherwise): what they were read, and what is kept.
  const tag = (patient.language ?? settings.language ?? locale) as keyof typeof texts;
  const words = texts[tag] ?? texts["en-US"];
  const said = `${words["texts.box.label"]}. ${words["texts.box.sub"]} ${words["texts.box.optional"]}`;
  const record = async (state: "yes" | "no") => {
    setBusy(true);
    try {
      const found = await deskReads().recordText(patient.id, state === "yes" ? { state, how, wording: { text: said, version: `v${String(TEXT_BOX_VERSION)} ${tag in texts ? tag : "en-US"}` } } : { state, how });
      setStanding(found);
      setAsking(null);
      toast(state === "yes" ? t("texts.record.savedYes") : t("texts.record.savedNo"), { icon: state === "yes" ? "circle-check" : "bell-off", tone: "pos" });
    } catch {
      toast(t("texts.record.failed"), { icon: "circle-alert", tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const service = standing?.service ?? null;
  const day = (at: number) => dayShort(dayOf(new Date(at).toISOString()));
  const line =
    standing === null
      ? t("texts.standing.notReady")
      : !standing.ready
        ? t("texts.standing.notReady")
        : standing.stopped !== null
          ? standing.stopped.liftBy === "start"
            ? t("texts.standing.stoppedStart", { day: day(standing.stopped.since) })
            : t("texts.standing.stoppedOther", { day: day(standing.stopped.since) })
          : service?.state === "yes"
            ? service.answer?.by != null
              ? t("texts.standing.yesBy", { day: day(service.answer.at), name: service.answer.by.label })
              : t("texts.standing.yes", { day: service.answer === null ? "" : day(service.answer.at) })
            : service?.state === "no"
              ? t("texts.standing.no", { day: service.answer === null ? "" : day(service.answer.at) })
              : service?.state === "no-phone"
                ? t("texts.standing.noPhone")
                : t("texts.standing.notAsked");
  const last = page.texts[0] ?? null;
  const lastWhen = last === null ? null : (last.sent_at ?? last.created_at);
  const lastState = last === null ? null : last.status === "sent" ? t("texts.state.sent") : last.status === "queued" ? t("texts.state.queued") : t("texts.state.failed");
  const on = service?.state === "yes" && standing?.stopped === null;
  const Icon = on ? MessageSquare : MessageSquareOff;
  const canRecord = standing !== null && standing.stopped === null && service?.state !== "no-phone";
  return (
    <section aria-labelledby="pd-texts" data-part="patient-texts" style={asideCard}>
      <h2 id="pd-texts" style={{ ...kickerStyle, margin: 0 }}>
        {t("texts.standing.title")}
      </h2>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBlockStart: 9 }}>
        <span aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "var(--pos-soft)" : "var(--surface-3)", color: on ? "var(--pos)" : "var(--fg-muted)" }}>
          <Icon size={14} />
        </span>
        <span role="status" style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.5, color: "var(--fg)", textWrap: "pretty" }}>
          {line}
        </span>
      </div>
      {last !== null && lastWhen !== null && lastState !== null && (
        <div style={{ marginBlockStart: 7, fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-subtle)", textWrap: "pretty" }}>
          {t("texts.standing.last", { kind: t(last.kind === "missed_text" ? "outbox.kind.missed_text" : "outbox.kind.reminder_text"), state: lastState, day: dayShort(dayOf(lastWhen)) })}
        </div>
      )}
      {canRecord && asking === null && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBlockStart: 11 }}>
          {!on && (
            <button type="button" className="rh-btn" onClick={() => setAsking("yes")} style={{ ...btnGhostSm, height: 34 }}>
              {t("texts.record.yes")}
            </button>
          )}
          {on && (
            <button type="button" className="rh-btn" disabled={busy} onClick={() => void record("no")} style={{ ...btnGhostSm, height: 34 }}>
              {t("texts.record.no")}
            </button>
          )}
        </div>
      )}
      {asking === "yes" && (
        <div data-part="patient-texts-record" style={{ display: "flex", flexDirection: "column", gap: 9, marginBlockStart: 11, padding: 11, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: "var(--fg-muted)" }}>{t("texts.record.read")}</span>
          <blockquote lang={tag} style={{ margin: 0, paddingInlineStart: 10, borderInlineStart: "3px solid var(--accent)", fontSize: 12.5, fontWeight: 700, lineHeight: 1.5, textWrap: "pretty" }}>
            {said}
          </blockquote>
          <div role="group" aria-label={t("texts.record.read")} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {HOWS.map((h) => (
              <Chip key={h} on={how === h} onClick={() => setHow(h)}>
                {t(`texts.record.how.${h}`)}
              </Chip>
            ))}
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-subtle)", textWrap: "pretty" }}>{t("texts.record.noStart")}</span>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <Btn kind="ghostSm" busy={busy} onClick={() => void record("yes")} style={{ height: 34 }}>
              {t("texts.record.save")}
            </Btn>
            <button type="button" className="rh-gi" onClick={() => setAsking(null)} style={{ height: 34, paddingInline: 10, border: "none", background: "transparent", color: "var(--fg-muted)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {t("texts.record.cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
