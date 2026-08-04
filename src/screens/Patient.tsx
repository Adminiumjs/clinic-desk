/**
 * The patient side: find a time, give your details, get a confirmation, and
 * look up what you have booked.
 *
 * The whole point of the first screen is that the scheduling rules are VISIBLE.
 * A 45-minute physiotherapy session offers noticeably fewer starts than a
 * 15-minute dressing change, this morning's earlier times are drawn and struck
 * through rather than quietly removed, and a start that would run into lunch or
 * past the close is never offered at all. A reader should be able to work out
 * why the grid looks the way it does without being told.
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  CircleCheckBig,
  Clock3,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";

import type { Slot, SlotBlock } from "../lib/schedule.ts";
import type { VisitTypeId } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import {
  clock,
  dateLong,
  dateShort,
  dayNumber,
  duration,
  label,
  money,
  relativeDay,
  span,
  statusLabel,
  weekdayShort,
} from "../lib/format.ts";
import {
  balanceOf,
  cliniciansFor,
  dayStrip,
  endOf,
  isWorkingDay,
  nextDayWithRoom,
  slotsFor,
  visitTypeById,
  visitsForPatient,
} from "../lib/schedule.ts";
import {
  CLINICIANS,
  LOOKUP_HINT,
  PRACTICE_ADDRESS,
  VISIT_TYPES,
  clinicianById,
  patientById,
  useStore,
} from "../state/store.ts";
import { Avatar, Button, Chip, Empty, Field, Mono, Panel } from "../components/Primitives.tsx";

/* -------------------------------------------------------------- 1. find */

/** One merged start across whichever clinicians are in play. */
interface MergedSlot extends Slot {
  /** Index into the eligible list — who the booking would land with. */
  who: number | null;
}

/**
 * Merge each eligible clinician's grid into one. Every clinician shares the
 * same candidate starts — `fitsHours` does not depend on who you are seeing —
 * so merging is a question of who, if anyone, is open at each of them.
 */
function mergeSlots(grids: Slot[][]): MergedSlot[] {
  const first = grids[0] ?? [];
  return first.map((slot, i) => {
    const column = grids.map((g) => g[i]);
    const openAt = column.findIndex((s) => s?.available);
    const blocked: SlotBlock | null =
      openAt >= 0 ? null : column.some((s) => s?.blocked === "taken") ? "taken" : "past";
    return {
      start: slot.start,
      end: slot.end,
      available: openAt >= 0,
      blocked,
      who: openAt >= 0 ? openAt : null,
    };
  });
}

export function Find() {
  const { t } = useI18n();
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const pickSlot = useStore((s) => s.pickSlot);
  const appts = useStore((s) => s.appts);
  const now = useStore((s) => s.now);
  const go = useStore((s) => s.go);

  const eligible = useMemo(
    () =>
      draft.clinician === "any"
        ? cliniciansFor(CLINICIANS, draft.type)
        : CLINICIANS.filter((c) => c.id === draft.clinician && c.offers.includes(draft.type)),
    [draft.clinician, draft.type],
  );

  const type = visitTypeById(VISIT_TYPES, draft.type);
  const strip = useMemo(() => dayStrip(now.date, 10), [now.date]);

  const slots = useMemo(() => {
    if (!isWorkingDay(draft.day) || eligible.length === 0) return [];
    return mergeSlots(
      eligible.map((c) => slotsFor(appts, VISIT_TYPES, c.id, draft.day, draft.type, now)),
    );
  }, [appts, eligible, draft.day, draft.type, now]);

  const openCount = slots.filter((s) => s.available).length;
  const nextDay = useMemo(
    () =>
      openCount > 0
        ? null
        : nextDayWithRoom(appts, CLINICIANS, VISIT_TYPES, draft.clinician, draft.day, draft.type, now),
    [openCount, appts, draft.clinician, draft.day, draft.type, now],
  );

  const chosenClinician =
    draft.slotClinician !== null ? clinicianById(draft.slotClinician) : null;

  return (
    <div className="rh-screen rh-column">
      <header className="rh-head">
        <h1 className="rh-head__title">{t("find.title")}</h1>
        <p className="rh-head__sub">{t("find.sub")}</p>
      </header>

      {/* --- what the visit is for: this is what sets the length --- */}
      <Panel title={t("find.step.reason")}>
        <div className="rh-typegrid">
          {VISIT_TYPES.map((v) => (
            <button
              key={v.id}
              type="button"
              className="rh-typecard rh-card"
              aria-pressed={draft.type === v.id}
              onClick={() => setDraft({ type: v.id as VisitTypeId })}
            >
              <span className="rh-typecard__dot" style={{ background: v.tint }} aria-hidden="true" />
              <span className="rh-typecard__name">{label(v.label)}</span>
              <span className="rh-typecard__blurb">{label(v.blurb)}</span>
              <span className="rh-typecard__meta rh-mono">
                {t("find.feeLine", { fee: money(v.fee), length: duration(v.minutes) })}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      {/* --- who --- */}
      <Panel title={t("find.step.clinician")}>
        <div className="rh-whogrid">
          <button
            type="button"
            className="rh-who rh-card"
            aria-pressed={draft.clinician === "any"}
            onClick={() => setDraft({ clinician: "any" })}
          >
            <span className="rh-who__ini rh-who__ini--any" aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <span>
              <span className="rh-who__name">{t("find.any")}</span>
              <span className="rh-who__role">{t("find.any.role")}</span>
            </span>
          </button>

          {cliniciansFor(CLINICIANS, draft.type).map((c) => (
            <button
              key={c.id}
              type="button"
              className="rh-who rh-card"
              aria-pressed={draft.clinician === c.id}
              onClick={() => setDraft({ clinician: c.id })}
            >
              <Avatar name={c.name} tint={c.tint} ini={c.ini} large />
              <span>
                <span className="rh-who__name">{c.name}</span>
                <span className="rh-who__role">{label(c.role)}</span>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      {/* --- which day --- */}
      <Panel title={t("find.step.day")} subtitle={t("find.weekend")}>
        <div className="rh-strip rh-scroll">
          {strip.map((d) => (
            <button
              key={d.iso}
              type="button"
              className={`rh-day${d.working ? "" : " rh-day--off"}`}
              aria-pressed={draft.day === d.iso}
              disabled={!d.working}
              onClick={() => setDraft({ day: d.iso })}
            >
              <span className="rh-day__wd">{weekdayShort(d.iso)}</span>
              <span className="rh-day__n rh-mono">{dayNumber(d.iso)}</span>
              <span className="rh-day__note">
                {d.working ? relativeDay(d.iso, now.date) : t("find.closed")}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      {/* --- the grid, where the rules are visible --- */}
      <Panel
        title={t("find.step.slot", { date: dateLong(draft.day) })}
        subtitle={t("find.length", { length: duration(type.minutes) })}
        actions={
          openCount > 0 ? (
            <Chip tone="accent">{t("find.count", { count: openCount }, openCount)}</Chip>
          ) : undefined
        }
      >
        {type.minutes > 15 && <p className="rh-note">{t("find.longer")}</p>}
        {draft.day === now.date && (
          <p className="rh-note">{t("find.pastNote", { time: clock(now.minutes) })}</p>
        )}

        {openCount === 0 ? (
          <Empty
            icon={<Clock3 size={22} aria-hidden="true" />}
            title={t("find.empty.title", { date: dateShort(draft.day) })}
            body={
              nextDay === null
                ? t("find.empty.none")
                : t("find.empty.body", { next: dateLong(nextDay) })
            }
            action={
              nextDay === null ? undefined : (
                <Button onClick={() => setDraft({ day: nextDay })}>
                  {t("find.empty.action", { date: dateShort(nextDay) })}
                </Button>
              )
            }
          />
        ) : (
          <div className="rh-slots">
            {slots.map((s) => {
              const who = s.who === null ? null : eligible[s.who];
              const picked = draft.start === s.start && draft.slotClinician === who?.id;
              return (
                <button
                  key={s.start}
                  type="button"
                  className={`rh-slot rh-btn${s.available ? "" : ` rh-slot--${s.blocked}`}`}
                  disabled={!s.available}
                  aria-pressed={picked}
                  aria-label={
                    s.available && who
                      ? t("find.slotLabel", { time: clock(s.start), clinician: who.name })
                      : undefined
                  }
                  onClick={() => who && pickSlot(who.id, s.start)}
                >
                  <span className="rh-mono">{clock(s.start)}</span>
                  {s.available && who && draft.clinician === "any" && (
                    <span className="rh-slot__who" style={{ background: who.tint }} aria-hidden="true" />
                  )}
                  {!s.available && (
                    <span className="rh-slot__x">
                      {t(s.blocked === "past" ? "find.gone" : "find.taken")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Panel>

      {draft.start !== null && chosenClinician !== null && (
        <div className="rh-stickybar">
          <span className="rh-stickybar__text">
            <Mono>{clock(draft.start)}</Mono> ·{" "}
            {t("find.chosen", {
              time: clock(draft.start),
              clinician: chosenClinician.name,
              date: dateLong(draft.day),
            })}
          </span>
          <Button onClick={() => go("details")}>{t("find.continue")}</Button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- 2. details */

export function Details() {
  const { t } = useI18n();
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const lookupDraft = useStore((s) => s.lookupDraft);
  const fillDemoLookup = useStore((s) => s.fillDemoLookup);
  const book = useStore((s) => s.book);
  const go = useStore((s) => s.go);

  const type = visitTypeById(VISIT_TYPES, draft.type);
  const clinician = draft.slotClinician !== null ? clinicianById(draft.slotClinician) : null;
  const matched = draft.matched !== null ? patientById(draft.matched) : null;

  const ready = draft.returning
    ? matched !== null
    : draft.name.trim().length > 1 && draft.dob.length > 0 && draft.mobile.trim().length > 5;

  if (draft.start === null || clinician === null) {
    return (
      <div className="rh-screen rh-column">
        <Empty
          icon={<Clock3 size={22} aria-hidden="true" />}
          title={t("find.title")}
          body={t("find.sub")}
          action={<Button onClick={() => go("find")}>{t("details.back")}</Button>}
        />
      </div>
    );
  }

  return (
    <div className="rh-screen rh-column">
      <button type="button" className="rh-backlink" onClick={() => go("find")}>
        <ArrowLeft size={15} aria-hidden="true" />
        {t("details.back")}
      </button>

      <header className="rh-head">
        <h1 className="rh-head__title">{t("details.title")}</h1>
        <p className="rh-head__sub">{t("details.sub")}</p>
      </header>

      <div className="rh-twocol">
        <div className="rh-twocol__main">
          <Panel title={t("details.been")}>
            <div className="rh-seg rh-seg--full" role="group" aria-label={t("details.been")}>
              <button
                type="button"
                className="rh-seg__btn"
                aria-pressed={draft.returning}
                onClick={() => setDraft({ returning: true })}
              >
                {t("details.returning")}
              </button>
              <button
                type="button"
                className="rh-seg__btn"
                aria-pressed={!draft.returning}
                onClick={() => setDraft({ returning: false })}
              >
                {t("details.first")}
              </button>
            </div>

            {draft.returning ? (
              <div className="rh-form" style={{ marginBlockStart: 16 }}>
                <div className="rh-form__row">
                  <Field label={t("details.mobile")}>
                    <input
                      className="rh-input rh-fld rh-mono"
                      value={draft.mobile}
                      inputMode="tel"
                      onChange={(e) => setDraft({ mobile: e.target.value })}
                    />
                  </Field>
                  <Field label={t("details.dob")}>
                    <input
                      className="rh-input rh-fld rh-mono"
                      type="date"
                      value={draft.dob}
                      onChange={(e) => setDraft({ dob: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="rh-form__actions">
                  <Button size="sm" onClick={lookupDraft}>
                    <Search size={14} aria-hidden="true" />
                    {t("details.lookup.action")}
                  </Button>
                  <Chip onClick={fillDemoLookup}>
                    {t("details.lookup.hint", {
                      mobile: LOOKUP_HINT.mobile,
                      dob: LOOKUP_HINT.dob,
                    })}
                  </Chip>
                </div>

                {matched !== null && (
                  <p className="rh-goodline">
                    {t("details.lookup.found", { name: matched.name })}
                  </p>
                )}
                {draft.lookupMissed && matched === null && (
                  <p className="rh-badline">{t("details.lookup.miss")}</p>
                )}
              </div>
            ) : (
              <div className="rh-form" style={{ marginBlockStart: 16 }}>
                <Field label={t("details.name")}>
                  <input
                    className="rh-input rh-fld"
                    value={draft.name}
                    onChange={(e) => setDraft({ name: e.target.value })}
                  />
                </Field>
                <div className="rh-form__row">
                  <Field label={t("details.dob")}>
                    <input
                      className="rh-input rh-fld rh-mono"
                      type="date"
                      value={draft.dob}
                      onChange={(e) => setDraft({ dob: e.target.value })}
                    />
                  </Field>
                  <Field label={t("details.mobile")}>
                    <input
                      className="rh-input rh-fld rh-mono"
                      value={draft.mobile}
                      inputMode="tel"
                      onChange={(e) => setDraft({ mobile: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label={t("details.email")}>
                  <input
                    className="rh-input rh-fld"
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft({ email: e.target.value })}
                  />
                </Field>
              </div>
            )}
          </Panel>

          <Panel title={t("details.reason")} subtitle={t("details.reason.hint")}>
            <textarea
              className="rh-textarea rh-fld"
              value={draft.reason}
              maxLength={240}
              aria-label={t("details.reason")}
              onChange={(e) => setDraft({ reason: e.target.value })}
            />
            <div className="rh-counter rh-mono">
              {t("details.counter", { count: draft.reason.length })}
            </div>

            <div style={{ marginBlockStart: 14 }}>
              <Field label={t("details.desknote")} hint={t("details.desknote.hint")}>
                <input
                  className="rh-input rh-fld"
                  value={draft.deskNote}
                  onChange={(e) => setDraft({ deskNote: e.target.value })}
                />
              </Field>
            </div>
          </Panel>
        </div>

        {/* --- the summary rail --- */}
        <aside className="rh-rail">
          <Panel title={t("details.summary")}>
            <div className="rh-facts">
              <div className="rh-fact">
                <span className="rh-fact__k">{t("details.summary.clinician")}</span>
                <span className="rh-fact__v">
                  <Avatar name={clinician.name} tint={clinician.tint} ini={clinician.ini} />
                  {clinician.name}
                </span>
              </div>
              <div className="rh-fact">
                <span className="rh-fact__k">{t("details.summary.date")}</span>
                <span className="rh-fact__v">{dateLong(draft.day)}</span>
              </div>
              <div className="rh-fact">
                <span className="rh-fact__k">{t("details.summary.time")}</span>
                <span className="rh-fact__v rh-mono">
                  {span(draft.start, draft.start + type.minutes)}
                </span>
              </div>
              <div className="rh-fact">
                <span className="rh-fact__k">{t("details.summary.length")}</span>
                <span className="rh-fact__v rh-mono">{duration(type.minutes)}</span>
              </div>
              <div className="rh-fact">
                <span className="rh-fact__k">{t("details.summary.fee")}</span>
                <span className="rh-fact__v rh-mono">{money(type.fee)}</span>
              </div>
            </div>

            <p className="rh-payline">{t("details.summary.payline")}</p>

            <Button className="rh-full" disabled={!ready} onClick={book}>
              {t("details.confirm")}
            </Button>
            {!ready && <p className="rh-note">{t("details.blocked")}</p>}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- 3. confirmation */

export function Confirm() {
  const { t } = useI18n();
  const confirmedRef = useStore((s) => s.confirmedRef);
  const confirmedPaid = useStore((s) => s.confirmedPaid);
  const appts = useStore((s) => s.appts);
  const openCard = useStore((s) => s.openCard);
  const payAtDesk = useStore((s) => s.payAtDesk);
  const toast = useStore((s) => s.toast);
  const go = useStore((s) => s.go);
  const [deskChosen, setDeskChosen] = useState(false);

  const appt = appts.find((a) => a.id === confirmedRef);
  if (!appt) {
    return (
      <div className="rh-screen rh-column">
        <Empty
          icon={<CircleCheckBig size={22} aria-hidden="true" />}
          title={t("find.title")}
          action={<Button onClick={() => go("find")}>{t("notfound.actionPatient")}</Button>}
        />
      </div>
    );
  }

  const clinician = clinicianById(appt.clinician);
  const type = visitTypeById(VISIT_TYPES, appt.type);

  return (
    <div className="rh-screen rh-column rh-narrowcol">
      <div className="rh-done">
        <span className="rh-done__tick" aria-hidden="true">
          <CircleCheckBig size={38} />
        </span>
        <h1 className="rh-head__title">{t("confirm.title")}</h1>
        <p className="rh-head__sub">{t("confirm.sub")}</p>
      </div>

      <Panel>
        <div className="rh-facts">
          <div className="rh-fact">
            <span className="rh-fact__k">{t("confirm.ref")}</span>
            <span className="rh-fact__v rh-mono rh-ref">{appt.id}</span>
          </div>
          <div className="rh-fact">
            <span className="rh-fact__k">{t("confirm.clinician")}</span>
            <span className="rh-fact__v">
              {clinician !== null && (
                <Avatar name={clinician.name} tint={clinician.tint} ini={clinician.ini} />
              )}
              {clinician?.name}
            </span>
          </div>
          <div className="rh-fact">
            <span className="rh-fact__k">{t("confirm.when")}</span>
            <span className="rh-fact__v">
              {dateLong(appt.date)} ·{" "}
              <Mono>{span(appt.start, endOf(appt, VISIT_TYPES))}</Mono>
            </span>
          </div>
          <div className="rh-fact">
            <span className="rh-fact__k">{t("confirm.where")}</span>
            <span className="rh-fact__v">
              <MapPin size={14} aria-hidden="true" />
              {PRACTICE_ADDRESS}
            </span>
          </div>
        </div>

        <div className="rh-form__actions" style={{ marginBlockStart: 14 }}>
          <Chip onClick={() => toast(t("chrome.toast.calendar"), "info")}>
            <CalendarPlus size={13} aria-hidden="true" />
            {t("confirm.calendar")}
          </Chip>
        </div>
      </Panel>

      {confirmedPaid ? (
        <p className="rh-goodline">{t("confirm.paid")}</p>
      ) : (
        <div className="rh-payrow">
          <Button onClick={() => openCard("booking")}>
            {t("confirm.payNow")} · <Mono>{money(type.fee)}</Mono>
          </Button>
          <Button
            tone="ghost"
            onClick={() => {
              setDeskChosen(true);
              payAtDesk();
            }}
          >
            {t("confirm.payDesk")}
          </Button>
        </div>
      )}
      {deskChosen && !confirmedPaid && <p className="rh-note">{t("confirm.deskChosen")}</p>}

      <p className="rh-honest">{t("confirm.cancelLine")}</p>

      <Button tone="ghost" onClick={() => go("myvisits")}>
        {t("confirm.myvisits")}
      </Button>
    </div>
  );
}

/* --------------------------------------------------------- 4. my visits */

export function MyVisits() {
  const { t } = useI18n();
  const lookupMobile = useStore((s) => s.lookupMobile);
  const lookupDob = useStore((s) => s.lookupDob);
  const lookedUp = useStore((s) => s.lookedUp);
  const lookupMissed = useStore((s) => s.lookupMissed);
  const setLookup = useStore((s) => s.setLookup);
  const runLookup = useStore((s) => s.runLookup);
  const fillDemo = useStore((s) => s.fillDemoMyVisits);
  const clearLookup = useStore((s) => s.clearLookup);
  const appts = useStore((s) => s.appts);
  const charges = useStore((s) => s.charges);
  const payments = useStore((s) => s.payments);
  const now = useStore((s) => s.now);
  const askCancel = useStore((s) => s.askCancel);
  const reschedule = useStore((s) => s.reschedule);
  const openCard = useStore((s) => s.openCard);
  const go = useStore((s) => s.go);

  const patient = lookedUp !== null ? patientById(lookedUp) : null;
  const visits = useMemo(
    () => (patient === null ? null : visitsForPatient(appts, patient.id, now)),
    [patient, appts, now],
  );

  if (patient === null || visits === null) {
    return (
      <div className="rh-screen rh-column rh-narrowcol">
        <header className="rh-head">
          <h1 className="rh-head__title">{t("myvisits.title")}</h1>
          <p className="rh-head__sub">{t("myvisits.sub")}</p>
        </header>

        <Panel title={t("myvisits.lookup")}>
          <div className="rh-form">
            <div className="rh-form__row">
              <Field label={t("details.mobile")}>
                <input
                  className="rh-input rh-fld rh-mono"
                  value={lookupMobile}
                  inputMode="tel"
                  onChange={(e) => setLookup({ mobile: e.target.value })}
                />
              </Field>
              <Field label={t("details.dob")}>
                <input
                  className="rh-input rh-fld rh-mono"
                  type="date"
                  value={lookupDob}
                  onChange={(e) => setLookup({ dob: e.target.value })}
                />
              </Field>
            </div>
            <div className="rh-form__actions">
              <Button size="sm" onClick={runLookup}>
                <Search size={14} aria-hidden="true" />
                {t("details.lookup.action")}
              </Button>
              <Chip onClick={fillDemo}>
                {t("details.lookup.hint", {
                  mobile: LOOKUP_HINT.mobile,
                  dob: LOOKUP_HINT.dob,
                })}
              </Chip>
            </div>
            {lookupMissed && <p className="rh-badline">{t("details.lookup.miss")}</p>}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="rh-screen rh-column rh-narrowcol">
      <header className="rh-head">
        <h1 className="rh-head__title">{t("myvisits.title")}</h1>
        <p className="rh-head__sub">{patient.name}</p>
      </header>

      <Panel title={t("myvisits.upcoming")}>
        {visits.upcoming.length === 0 && <p className="rh-note">{t("myvisits.none")}</p>}
        {visits.upcoming.map((a) => {
          const clinician = clinicianById(a.clinician);
          return (
            <div key={a.id} className="rh-visit rh-card">
              <div className="rh-visit__when">
                <span className="rh-mono rh-visit__time">{clock(a.start)}</span>
                <span className="rh-visit__date">{dateLong(a.date)}</span>
              </div>
              <div className="rh-visit__body">
                <span className="rh-visit__reason">{label(a.reason)}</span>
                <span className="rh-visit__meta">
                  {t("myvisits.with", { clinician: clinician?.name ?? "" })} ·{" "}
                  <Mono>{span(a.start, endOf(a, VISIT_TYPES))}</Mono>
                </span>
              </div>
              <div className="rh-visit__actions">
                <Button size="sm" tone="ghost" onClick={() => reschedule(a.id)}>
                  {t("myvisits.reschedule")}
                </Button>
                <Button size="sm" tone="ghost" onClick={() => askCancel(a.id)}>
                  {t("myvisits.cancel")}
                </Button>
              </div>
            </div>
          );
        })}
      </Panel>

      <Panel title={t("myvisits.past")}>
        {visits.past.length === 0 && <p className="rh-note">{t("myvisits.nonePast")}</p>}
        {visits.past.map((a) => {
          const clinician = clinicianById(a.clinician);
          const charge = charges.find((c) => c.appt === a.id);
          const owed = charge ? balanceOf(charge, payments) : 0;
          return (
            <div key={a.id} className="rh-visit rh-card">
              <div className="rh-visit__when">
                <span className="rh-mono rh-visit__time">{clock(a.start)}</span>
                <span className="rh-visit__date">{relativeDay(a.date, now.date)}</span>
              </div>
              <div className="rh-visit__body">
                <span className="rh-visit__reason">{label(a.reason)}</span>
                <span className="rh-visit__meta">
                  {t("myvisits.with", { clinician: clinician?.name ?? "" })}
                </span>
                {(a.lateCancel === true || a.status === "cancelled" || a.status === "no_show") && (
                  <span style={{ marginBlockStart: 6, display: "inline-flex", gap: 6 }}>
                    <Chip>{statusLabel(a.status)}</Chip>
                    {a.lateCancel === true && <Chip>{t("chrome.status.late")}</Chip>}
                  </span>
                )}
              </div>
              <div className="rh-visit__actions">
                {/* A visit that never happened has no fee, so it gets no
                    "settled" chip either — that would be a claim about money
                    that was never owed. */}
                {charge !== undefined &&
                  (owed > 0 ? (
                    <>
                      <span className="rh-owed rh-mono">
                        {t("myvisits.owes", { amount: money(owed) })}
                      </span>
                      <Button size="sm" onClick={() => openCard(charge.id)}>
                        {t("chrome.action.pay")}
                      </Button>
                    </>
                  ) : (
                    <Chip tone="pos">{t("myvisits.settled")}</Chip>
                  ))}
              </div>
            </div>
          );
        })}
      </Panel>

      <div className="rh-payrow">
        <Button onClick={() => go("find")}>{t("myvisits.book")}</Button>
        <Button tone="ghost" onClick={clearLookup}>
          {t("myvisits.switch")}
        </Button>
      </div>
    </div>
  );
}
