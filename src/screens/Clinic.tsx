/**
 * The clinic side: the day sheet, the waiting board, the patient list, the
 * accounts view and the recall list.
 *
 * The day sheet is the heart of it, and it is where house layout rule 4 bites.
 * The "now" line and every status marker are absolutely positioned over a time
 * grid, so each row RESERVES a gutter for them: the clock column on the inline
 * start of the grid, and an 18px inset on every appointment block for its own
 * status dot. Nothing floats over appointment text at any width, in either
 * writing direction.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  UserRound,
  Users,
  X,
} from "lucide-react";

import type { Appointment, PayMethod, QueueStatus } from "../data/types.ts";
import type { MessageKey } from "../i18n/messages/index.ts";
import { useI18n } from "../i18n/index.tsx";
import { ClinicianLegend } from "../components/Overlays.tsx";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  Field,
  Honest,
  Kpi,
  Mono,
  Panel,
} from "../components/Primitives.tsx";
import {
  ageLabel,
  clock,
  dateFull,
  dateLong,
  dateShort,
  duration,
  label,
  money,
  relativeDay,
  statusLabel,
  waitLabel,
} from "../lib/format.ts";
import {
  OPEN,
  QUEUE_ORDER,
  SLOT,
  addDays,
  ageOn,
  awaitingArrival,
  balanceOf,
  daySheet,
  gridRows,
  isBreakRow,
  isWorkingDay,
  lastVisit,
  minutesLate,
  nextStatus,
  noShowsThisWeek,
  nowOffset,
  outstanding,
  recalls,
  seenCount,
  takenOn,
  totalOutstanding,
  visitTypeById,
  visitsForPatient,
  waitTone,
  waitingBoard,
  waitingMinutes,
} from "../lib/schedule.ts";
import {
  CLINICIANS,
  PATIENTS,
  VISIT_TYPES,
  clinicianById,
  patientById,
  patientName,
  useStore,
} from "../state/store.ts";

/** Every block is a whole number of quarter-hour rows tall. */
const ROW_PX = 34;

/*
 * Written out rather than assembled from a template, so the compiler still
 * checks every key. A column or a method added without its wording is a build
 * error here instead of a dotted key on the screen.
 */
const COLUMN_KEY: Record<QueueStatus, MessageKey> = {
  checked_in: "waiting.col.checked_in",
  roomed: "waiting.col.roomed",
  with_clinician: "waiting.col.with_clinician",
  ready: "waiting.col.ready",
};

const METHOD_KEY: Record<PayMethod, MessageKey> = {
  card: "pay.method.card",
  cash: "pay.method.cash",
  transfer: "pay.method.transfer",
};

/* ---------------------------------------------------------- 5. day sheet */

export function DaySheet() {
  const { t } = useI18n();
  const appts = useStore((s) => s.appts);
  const now = useStore((s) => s.now);
  const sheetDay = useStore((s) => s.sheetDay);
  const setSheetDay = useStore((s) => s.setSheetDay);
  const openPanel = useStore((s) => s.openPanel);
  const walkIns = useStore((s) => s.walkIns);
  const prefill = useStore((s) => s.prefill);
  const clearPrefill = useStore((s) => s.clearPrefill);

  const columns = useMemo(
    () => daySheet(appts, CLINICIANS, sheetDay),
    [appts, sheetDay],
  );
  const rows = useMemo(() => gridRows(), []);
  const offset = nowOffset(now, sheetDay);
  const todayCount = appts.filter((a) => a.date === sheetDay).length;

  return (
    <div className="rh-screen">
      <header className="rh-head rh-head--row">
        <div>
          <h1 className="rh-head__title">{t("daysheet.title")}</h1>
          <p className="rh-head__sub">{dateFull(sheetDay)}</p>
        </div>
        <div className="rh-daynav">
          <button
            type="button"
            className="rh-iconbtn rh-btn"
            onClick={() => setSheetDay(addDays(sheetDay, -1))}
            aria-label={t("daysheet.prev")}
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <Button
            size="sm"
            tone={sheetDay === now.date ? "accent" : "ghost"}
            onClick={() => setSheetDay(now.date)}
          >
            {t("daysheet.today")}
          </Button>
          <button
            type="button"
            className="rh-iconbtn rh-btn"
            onClick={() => setSheetDay(addDays(sheetDay, 1))}
            aria-label={t("daysheet.next")}
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <p className="rh-head__sub" style={{ marginBlockEnd: 12 }}>
        {t(
          "daysheet.sub",
          { count: todayCount, seen: seenCount(appts, { date: sheetDay, minutes: now.minutes }) },
          todayCount,
        )}
      </p>

      {prefill !== null && (
        <div className="rh-prefill">
          <CalendarPlus size={16} aria-hidden="true" />
          <span>
            {t("daysheet.prefill", {
              name: patientName(prefill.patient, walkIns[prefill.patient] ?? null),
              reason: label(prefill.reason),
            })}
          </span>
          <button
            type="button"
            className="rh-prefill__x"
            onClick={clearPrefill}
            aria-label={t("daysheet.prefill.clear")}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <ClinicianLegend />

      {!isWorkingDay(sheetDay) ? (
        <Empty
          icon={<Clock3 size={22} aria-hidden="true" />}
          title={t("daysheet.closed", { date: dateLong(sheetDay) })}
          action={<Button onClick={() => setSheetDay(now.date)}>{t("daysheet.today")}</Button>}
        />
      ) : (
        <>
          <p className="rh-note rh-narrow-only">{t("daysheet.scrollHint")}</p>
          <div className="rh-sheetscroll rh-scroll">
            <div className="rh-sheetgrid">
              <div className="rh-sheetgrid__head">
                <span className="rh-sheetgrid__corner" />
                {columns.map((col) => (
                  <span
                    key={col.clinician.id}
                    className="rh-colhead"
                    style={{ borderBlockEndColor: col.clinician.tint }}
                  >
                    <Avatar
                      name={col.clinician.name}
                      tint={col.clinician.tint}
                      ini={col.clinician.ini}
                    />
                    <span>
                      <span className="rh-colhead__name">{col.clinician.name}</span>
                      <span className="rh-colhead__role">{label(col.clinician.role)}</span>
                    </span>
                  </span>
                ))}
              </div>

              <div
                className="rh-sheetgrid__body"
                style={{ height: rows.length * ROW_PX }}
              >
                {/* The reserved clock gutter. The now-line's time sits in here,
                    which is why it can never land on top of a visit. */}
                <div className="rh-times">
                  {rows.map((m) => (
                    <span key={m} className="rh-times__t rh-mono" style={{ height: ROW_PX }}>
                      {m % 60 === 0 || m % 60 === 30 ? clock(m) : ""}
                    </span>
                  ))}
                </div>

                {columns.map((col) => (
                  <div key={col.clinician.id} className="rh-col">
                    {rows.map((m) => (
                      <div
                        key={m}
                        className={`rh-colrow${isBreakRow(m) ? " rh-colrow--break" : ""}`}
                        style={{ height: ROW_PX }}
                      />
                    ))}

                    {col.appts.map((a) => {
                      const type = visitTypeById(VISIT_TYPES, a.type);
                      const top = ((a.start - OPEN) / SLOT) * ROW_PX;
                      const height = (type.minutes / SLOT) * ROW_PX - 3;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={`rh-block rh-card rh-block--${a.status}`}
                          style={{
                            insetBlockStart: top,
                            height,
                            background: `color-mix(in srgb, ${type.tint} 12%, var(--surface))`,
                            borderInlineStartColor: type.tint,
                          }}
                          onClick={() => openPanel(a.id)}
                          aria-label={t("daysheet.openVisit", {
                            name: patientName(a.patient, walkIns[a.patient] ?? null),
                            time: clock(a.start),
                          })}
                        >
                          <span
                            className="rh-block__dot"
                            style={{ background: type.tint }}
                            aria-hidden="true"
                          />
                          <span className="rh-block__name">
                            {patientName(a.patient, walkIns[a.patient] ?? null)}
                          </span>
                          {type.minutes > 15 && (
                            <span className="rh-block__reason">{label(a.reason)}</span>
                          )}
                        </button>
                      );
                    })}

                    {col.appts.length === 0 && (
                      <span className="rh-col__empty">{t("daysheet.empty")}</span>
                    )}
                  </div>
                ))}

                {offset !== null && (
                  <div
                    className="rh-nowline"
                    style={{ insetBlockStart: `${offset * 100}%` }}
                    aria-hidden="true"
                  >
                    <span className="rh-nowline__t rh-mono">{clock(now.minutes)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------- 6. waiting room */

function WaitingCard({ appt }: { appt: Appointment }) {
  const { t } = useI18n();
  const now = useStore((s) => s.now);
  const walkIns = useStore((s) => s.walkIns);
  const advanceVisit = useStore((s) => s.advanceVisit);
  const openPanel = useStore((s) => s.openPanel);

  const waited = waitingMinutes(appt, now);
  const tone = waitTone(waited);
  const clinician = clinicianById(appt.clinician);
  const onward = nextStatus(appt.status);

  return (
    <div className="rh-wcard rh-card">
      <div className="rh-wcard__top">
        {clinician !== null && (
          <Avatar name={clinician.name} tint={clinician.tint} ini={clinician.ini} />
        )}
        <span className="rh-wcard__name">
          {patientName(appt.patient, walkIns[appt.patient] ?? null)}
        </span>
        <span className="rh-wcard__time rh-mono">{clock(appt.start)}</span>
      </div>

      <div className="rh-wcard__mid">
        <Chip tone={tone === "ok" ? undefined : tone === "warn" ? "warn" : "danger"}>
          <Clock3 size={12} aria-hidden="true" />
          <span className="rh-mono">{waitLabel(waited)}</span>
        </Chip>
        <button type="button" className="rh-linkish" onClick={() => openPanel(appt.id)}>
          {label(appt.reason)}
        </button>
      </div>

      <Button className="rh-full" onClick={() => advanceVisit(appt.id)}>
        {appt.status === "ready" ? t("waiting.finish") : t("waiting.advance", { status: statusLabel(onward) })}
      </Button>
    </div>
  );
}

export function Waiting() {
  const { t } = useI18n();
  const appts = useStore((s) => s.appts);
  const now = useStore((s) => s.now);
  const walkIns = useStore((s) => s.walkIns);
  const checkIn = useStore((s) => s.checkIn);
  const markNoShow = useStore((s) => s.markNoShow);

  const board = useMemo(() => waitingBoard(appts, now), [appts, now]);
  const late = useMemo(() => awaitingArrival(appts, now), [appts, now]);

  return (
    <div className="rh-screen">
      <header className="rh-head">
        <h1 className="rh-head__title">{t("waiting.title")}</h1>
        <p className="rh-head__sub">{t("waiting.sub")}</p>
      </header>

      <div className="rh-waitlayout">
        <div className="rh-board">
          {QUEUE_ORDER.map((col: QueueStatus) => (
            <section key={col} className="rh-boardcol">
              <h2 className="rh-boardcol__head">
                {t(COLUMN_KEY[col])}
                <span className="rh-boardcol__n rh-mono">{board[col].length}</span>
              </h2>
              {board[col].length === 0 && (
                <p className="rh-boardcol__empty">{t("waiting.empty")}</p>
              )}
              {board[col].map((a) => (
                <WaitingCard key={a.id} appt={a} />
              ))}
            </section>
          ))}
        </div>

        <aside className="rh-lateStrip">
          <Panel title={t("waiting.late.title")} subtitle={t("waiting.late.sub")}>
            {late.length === 0 && <p className="rh-note">{t("waiting.late.none")}</p>}
            {late.map((a) => (
              <div key={a.id} className="rh-laterow">
                <div style={{ minWidth: 0 }}>
                  <span className="rh-laterow__name">
                    {patientName(a.patient, walkIns[a.patient] ?? null)}
                  </span>
                  <span className="rh-laterow__meta">
                    <Mono>{clock(a.start)}</Mono> · {label(a.reason)}
                  </span>
                </div>
                <Chip tone="danger">
                  <span className="rh-mono">
                    {t("waiting.late.chip", { count: minutesLate(a, now) }, minutesLate(a, now))}
                  </span>
                </Chip>
                <div className="rh-laterow__actions">
                  <Button size="sm" onClick={() => checkIn(a.id)}>
                    {t("waiting.late.arrived")}
                  </Button>
                  <Button size="sm" tone="ghost" onClick={() => markNoShow(a.id)}>
                    {t("waiting.late.noShow")}
                  </Button>
                </div>
              </div>
            ))}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- 7. patients */

function PatientProfile({ id }: { id: string }) {
  const { t } = useI18n();
  const appts = useStore((s) => s.appts);
  const charges = useStore((s) => s.charges);
  const payments = useStore((s) => s.payments);
  const now = useStore((s) => s.now);
  const openPanel = useStore((s) => s.openPanel);
  const closePatient = useStore((s) => s.closePatient);
  const openCard = useStore((s) => s.openCard);

  const patient = patientById(id);
  const visits = useMemo(
    () => (patient === null ? null : visitsForPatient(appts, patient.id, now)),
    [patient, appts, now],
  );
  const owedRows = useMemo(
    () =>
      charges
        .filter((c) => c.patient === id)
        .map((c) => ({ charge: c, balance: balanceOf(c, payments) }))
        .filter((r) => r.balance > 0),
    [charges, payments, id],
  );
  const recall = useMemo(
    () => recalls(appts, now).find((r) => r.patient === id) ?? null,
    [appts, now, id],
  );

  if (patient === null || visits === null) return null;

  return (
    <div className="rh-screen">
      <button type="button" className="rh-backlink" onClick={closePatient}>
        <ArrowLeft size={15} aria-hidden="true" />
        {t("patient.back")}
      </button>

      <header className="rh-profile">
        <Avatar name={patient.name} tint={CLINICIANS[0].tint} ini={patient.ini} large />
        <div>
          <h1 className="rh-head__title">{patient.name}</h1>
          <p className="rh-head__sub">
            <Mono>{ageOn(patient.dob, now.date)}</Mono> · {t("patient.dob")}{" "}
            <Mono>{patient.dob}</Mono> · {t("patient.mobile")} <Mono>{patient.mobile}</Mono>
          </p>
        </div>
        {patient.allergies !== null && (
          <Chip tone="warn" title={t("patients.allergies")}>
            <CircleAlert size={12} aria-hidden="true" />
            {t("patients.allergies")}: {label(patient.allergies)}
          </Chip>
        )}
      </header>

      <div className="rh-twocol">
        <div className="rh-twocol__main">
          <Panel title={t("patient.history")}>
            {visits.past.length === 0 && <p className="rh-note">{t("patient.noHistory")}</p>}
            <div className="rh-timeline">
              {visits.past.map((a) => (
                <div key={a.id} className="rh-tl-row">
                  <span className="rh-tl-dot">
                    <UserRound size={14} aria-hidden="true" />
                  </span>
                  <div className="rh-tl-body">
                    <div className="rh-tl-head">
                      <span className="rh-tl-type">{label(a.reason)}</span>
                      <span className="rh-tl-when rh-mono">
                        {dateShort(a.date)} {clock(a.start)}
                      </span>
                      <Chip>{statusLabel(a.status)}</Chip>
                    </div>
                    <p className="rh-tl-text">
                      {clinicianById(a.clinician)?.name} ·{" "}
                      {label(visitTypeById(VISIT_TYPES, a.type).label)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="rh-rail">
          <Panel title={t("patient.upcoming")}>
            {visits.upcoming.length === 0 && <p className="rh-note">{t("patient.none")}</p>}
            {visits.upcoming.map((a) => (
              <button
                key={a.id}
                type="button"
                className="rh-miniRow"
                onClick={() => openPanel(a.id)}
              >
                <span className="rh-mono">{dateShort(a.date)}</span>
                <span className="rh-mono">{clock(a.start)}</span>
                <span className="rh-miniRow__t">{label(a.reason)}</span>
              </button>
            ))}
          </Panel>

          <Panel title={t("patient.outstanding")}>
            {owedRows.length === 0 && <p className="rh-note">{t("patient.settled")}</p>}
            {owedRows.map((r) => (
              <div key={r.charge.id} className="rh-miniRow">
                <span className="rh-mono">{r.charge.appt}</span>
                <span className="rh-mono rh-amount">{money(r.balance)}</span>
                <Button size="sm" onClick={() => openCard(r.charge.id)}>
                  {t("chrome.action.pay")}
                </Button>
              </div>
            ))}
          </Panel>

          <Panel title={t("patient.recall")}>
            {recall === null ? (
              <p className="rh-note">{t("patient.recall.none")}</p>
            ) : (
              <p className="rh-note">
                {t("recalls.dueOn", { date: dateLong(recall.due) })} ·{" "}
                {t("recalls.every", { count: recall.weeks }, recall.weeks)}
              </p>
            )}
          </Panel>

          <Honest>{t("patient.honest")}</Honest>
        </aside>
      </div>
    </div>
  );
}

export function Patients() {
  const { t } = useI18n();
  const query = useStore((s) => s.patientQuery);
  const setQuery = useStore((s) => s.setPatientQuery);
  const openPatientId = useStore((s) => s.openPatientId);
  const openPatient = useStore((s) => s.openPatient);
  const appts = useStore((s) => s.appts);
  const now = useStore((s) => s.now);

  if (openPatientId !== null) {
    return <PatientProfile id={openPatientId} />;
  }

  const q = query.trim().toLowerCase();
  const list = PATIENTS.filter((p) => q.length === 0 || p.name.toLowerCase().includes(q));

  return (
    <div className="rh-screen">
      <header className="rh-head">
        <h1 className="rh-head__title">{t("patients.title")}</h1>
        <p className="rh-head__sub">
          {t("patients.sub", { count: PATIENTS.length }, PATIENTS.length)}
        </p>
      </header>

      <div style={{ maxWidth: 380, marginBlockEnd: 14 }}>
        <Field label={t("patients.search")}>
          <input
            className="rh-input rh-fld"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
      </div>

      {list.length === 0 ? (
        <Empty icon={<Users size={22} aria-hidden="true" />} title={t("patients.empty")} />
      ) : (
        <div className="rh-plist">
          {list.map((p) => {
            const seen = lastVisit(appts, p.id, now);
            return (
              <button
                key={p.id}
                type="button"
                className="rh-prow rh-card"
                onClick={() => openPatient(p.id)}
                aria-label={t("patients.open", { name: p.name })}
              >
                <Avatar name={p.name} tint={CLINICIANS[0].tint} ini={p.ini} />
                <span className="rh-prow__name">{p.name}</span>
                <span className="rh-prow__age rh-mono">{ageOn(p.dob, now.date)}</span>
                <span className="rh-prow__last">
                  {seen === null ? t("patients.never") : relativeDay(seen.date, now.date)}
                </span>
                {p.allergies !== null && (
                  <Chip tone="warn">
                    <CircleAlert size={12} aria-hidden="true" />
                    {label(p.allergies)}
                  </Chip>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- 8. accounts */

/**
 * The record-payment popover. Anchored to its own row rather than opened in the
 * middle of the screen, because it belongs to one amount and one person.
 *
 * The engine refuses an overpayment and hands back the maximum, which is what
 * lets this say what the limit is instead of quietly taking less than the
 * receptionist typed.
 */
function PaymentPopover({ chargeId, max }: { chargeId: string; max: number }) {
  const { t } = useI18n();
  const recordPayment = useStore((s) => s.recordPayment);
  const openPayPopover = useStore((s) => s.openPayPopover);
  const [amount, setAmount] = useState(String(max));
  const [method, setMethod] = useState<PayMethod>("card");

  const value = Number(amount.replace(/[^\d.]/g, ""));
  const tooMuch = Number.isFinite(value) && value > max;

  return (
    <div className="rh-popover rh-paypop">
      <div className="rh-popover__title">{t("pay.title")}</div>

      <Field label={t("pay.amount")}>
        <input
          className="rh-input rh-fld rh-mono"
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>

      <div className="rh-seg rh-seg--full" role="group" aria-label={t("pay.method")}>
        {(["card", "cash", "transfer"] as PayMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            className="rh-seg__btn"
            aria-pressed={method === m}
            onClick={() => setMethod(m)}
          >
            {t(METHOD_KEY[m])}
          </button>
        ))}
      </div>

      <Chip onClick={() => setAmount(String(max))}>
        {t("pay.full", { amount: money(max) })}
      </Chip>

      {tooMuch && <p className="rh-badline">{t("pay.overpay", { amount: money(max) })}</p>}

      <div className="rh-paypop__actions">
        <Button size="sm" tone="ghost" onClick={() => openPayPopover(null)}>
          {t("chrome.action.cancel")}
        </Button>
        <Button size="sm" onClick={() => recordPayment(chargeId, value, method)}>
          {t("pay.take")}
        </Button>
      </div>
    </div>
  );
}

export function Accounts() {
  const { t } = useI18n();
  const charges = useStore((s) => s.charges);
  const payments = useStore((s) => s.payments);
  const appts = useStore((s) => s.appts);
  const now = useStore((s) => s.now);
  const walkIns = useStore((s) => s.walkIns);
  const payChargeId = useStore((s) => s.payChargeId);
  const openPayPopover = useStore((s) => s.openPayPopover);

  const rows = useMemo(() => outstanding(charges, payments, now), [charges, payments, now]);
  const taken = takenOn(payments, now.date);
  const owed = totalOutstanding(charges, payments);
  const noShows = noShowsThisWeek(appts, now).length;

  return (
    <div className="rh-screen">
      <header className="rh-head">
        <h1 className="rh-head__title">{t("accounts.title")}</h1>
        <p className="rh-head__sub">{t("accounts.sub")}</p>
      </header>

      <div className="rh-kpis">
        <Kpi label={t("accounts.kpi.taken")} value={money(taken)} tone="pos" />
        <Kpi label={t("accounts.kpi.outstanding")} value={money(owed)} tone={owed > 0 ? "warn" : undefined} />
        <Kpi label={t("accounts.kpi.noshow")} value={noShows} tone={noShows > 0 ? "danger" : undefined} />
      </div>

      <div className="rh-twocol" style={{ marginBlockStart: 16 }}>
        <div className="rh-twocol__main">
          <Panel title={t("accounts.open")} subtitle={t("accounts.open.sub")}>
            {rows.length === 0 && <p className="rh-note">{t("accounts.open.none")}</p>}
            {rows.length > 0 && (
              <div className="rh-table">
                <div className="rh-table__head">
                  <span>{t("accounts.col.patient")}</span>
                  <span>{t("accounts.col.visit")}</span>
                  <span>{t("accounts.col.since")}</span>
                  <span className="rh-amount">{t("accounts.col.amount")}</span>
                  <span />
                </div>
                {rows.map((r) => {
                  const partial = r.balance < r.charge.amount;
                  return (
                    <div key={r.charge.id} className="rh-table__row">
                      <span className="rh-table__name">
                        {patientName(r.charge.patient, walkIns[r.charge.patient] ?? null)}
                      </span>
                      <span className="rh-mono">{r.charge.appt}</span>
                      <span>
                        <Chip tone={r.ageDays > 30 ? "danger" : r.ageDays > 14 ? "warn" : undefined}>
                          <span className="rh-mono">{ageLabel(r.ageDays)}</span>
                        </Chip>
                        {partial && <Chip tone="info">{t("accounts.partial")}</Chip>}
                      </span>
                      <span className="rh-mono rh-amount">{money(r.balance)}</span>
                      <span className="rh-table__act">
                        <Button
                          size="sm"
                          tone="ghost"
                          onClick={() =>
                            openPayPopover(payChargeId === r.charge.id ? null : r.charge.id)
                          }
                        >
                          {t("accounts.record")}
                        </Button>
                        {payChargeId === r.charge.id && (
                          <PaymentPopover chargeId={r.charge.id} max={r.balance} />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <aside className="rh-rail">
          <Panel title={t("accounts.fees")} subtitle={t("accounts.fees.sub")}>
            {VISIT_TYPES.map((v) => (
              <div key={v.id} className="rh-feerow">
                <span className="rh-feerow__dot" style={{ background: v.tint }} aria-hidden="true" />
                <span className="rh-feerow__name">{label(v.label)}</span>
                <span className="rh-feerow__len rh-mono">{duration(v.minutes)}</span>
                <span className="rh-mono rh-amount">{money(v.fee)}</span>
              </div>
            ))}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 9. recalls */

export function Recalls() {
  const { t } = useI18n();
  const appts = useStore((s) => s.appts);
  const now = useStore((s) => s.now);
  const walkIns = useStore((s) => s.walkIns);
  const bookThemIn = useStore((s) => s.bookThemIn);

  const rows = useMemo(() => recalls(appts, now), [appts, now]);
  const overdue = rows.filter((r) => r.overdue);
  const due = rows.filter((r) => !r.overdue);

  const row = (r: (typeof rows)[number]) => {
    const from = appts.find((a) => a.id === r.appt);
    return (
      <div key={r.appt} className={`rh-recall rh-card${r.overdue ? " rh-recall--late" : ""}`}>
        <div style={{ minWidth: 0 }}>
          <span className="rh-recall__name">
            {patientName(r.patient, walkIns[r.patient] ?? null)}
          </span>
          <span className="rh-recall__meta">
            {t("recalls.from", {
              reason: label(r.reason),
              date: from ? dateShort(from.date) : "",
            })}
          </span>
        </div>
        <span className="rh-recall__due">
          <Chip tone={r.overdue ? "danger" : undefined}>
            <span className="rh-mono">
              {r.overdue
                ? t("recalls.late", { count: r.overdueDays }, r.overdueDays)
                : t("recalls.dueOn", { date: dateShort(r.due) })}
            </span>
          </Chip>
        </span>
        <Button size="sm" onClick={() => bookThemIn(r.patient, r.reason)}>
          {t("recalls.book")}
        </Button>
      </div>
    );
  };

  return (
    <div className="rh-screen">
      <header className="rh-head">
        <h1 className="rh-head__title">{t("recalls.title")}</h1>
        <p className="rh-head__sub">{t("recalls.sub")}</p>
      </header>

      {rows.length === 0 ? (
        <Empty icon={<CalendarPlus size={22} aria-hidden="true" />} title={t("recalls.none")} />
      ) : (
        <>
          {overdue.length > 0 && (
            <Panel title={t("recalls.overdue")}>{overdue.map(row)}</Panel>
          )}
          {due.length > 0 && <Panel title={t("recalls.due")}>{due.map(row)}</Panel>}
        </>
      )}
    </div>
  );
}
