/**
 * One registration, or one first visit booked online, as the desk checks it:
 * who they say they are, anyone on file who looks like them, the notes of
 * earlier calls, and the four ways it ends — accepted as a new patient, the
 * same person as a patient already on file, rang (for now), or declined.
 *
 * "Same person" joins the item to the patient and copies NOTHING typed onto
 * their record: what differs is listed, and "Edit details" opens the record
 * for a person to change by hand. Accept writes the patient with a key made
 * from the item itself, so a retry — or a second desk accepting at the same
 * moment — finds the one patient rather than making two.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  Cake,
  CalendarCheck,
  CalendarX,
  CircleAlert,
  House,
  Mail,
  PhoneCall,
  Smartphone,
  UserCheck,
  UserRound,
  Users,
  UserX,
  type LucideIcon,
} from "lucide-react";

import type { Id, Patient } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { actionKey } from "../lib/keys.ts";
import { now } from "../lib/clock.ts";
import { ageOn, dayLong, dayOf, dayShort, time } from "../lib/format.ts";
import { useNow } from "../lib/useNow.ts";
import { acceptNewPatient, addCheckNote, decline, linkToPatient, type ToCheck } from "../state/actions.ts";
import { deskReads, useCan, useDesk } from "../state/desk.ts";
import { go, toast, useUi, type Sheet as SheetKind } from "../state/ui.ts";
import { Btn, Sheet, Tile, btnGhost, btnGhostSm, btnPrimary, fieldStyle, mono } from "../components/ui.tsx";
import { acceptKey, notesOf, registrationItems, type RegItem } from "./bits/logic.ts";
import { usePatientSearch } from "./bits/search.ts";
import { HitRow, Note, SectionLabel, areaStyle, labelText, useRefusal, useSaving } from "./bits/ui.tsx";
import { outcomeLine, patientColor, personOf, sourceLine } from "./registration/shared.ts";

type Mode = "none" | "same" | "rang" | "decline";

export default function Registration({ sheet, onClose }: { sheet: Extract<SheetKind, { kind: "registration" }>; onClose: () => void }) {
  const { t } = useI18n();
  const today = dayOf(useNow());
  const desk = useDesk();
  const item = useMemo(() => registrationItems(desk, today).find((i) => i.kind === sheet.item.kind && i.id === sheet.item.id), [desk, today, sheet.item.kind, sheet.item.id]);

  if (item === undefined) {
    return (
      <Sheet icon={UserRound} title={t("registration.gone.title")} onClose={onClose}>
        <Note tone="info" icon={CircleAlert} role="status">
          {t("registration.gone.body")}
        </Note>
      </Sheet>
    );
  }
  return <RegistrationSheet item={item} onClose={onClose} />;
}

function RegistrationSheet({ item, onClose }: { item: RegItem; onClose: () => void }) {
  const { t } = useI18n();
  const today = dayOf(useNow());
  const desk = useDesk();
  const refusal = useRefusal();
  const { busy, run } = useSaving();
  const person = personOf(item);
  const done = item.tab === "done";
  const isFirst = item.kind === "visit";
  const toCheck: ToCheck = item.kind === "registration" ? { kind: "registration", row: item.row } : { kind: "visit", row: item.row };

  const [mode, setMode] = useState<Mode>("none");
  const [picked, setPicked] = useState<Patient | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per note and per decline, made when that step starts and kept until it saves.
  const [noteKey, setNoteKey] = useState(actionKey);
  const [declineKey, setDeclineKey] = useState(actionKey);

  const mayAccept = useCan("patients", "create");
  const mayUpdate = useCan(item.kind === "registration" ? "registrations" : "appointments", "update");
  const mayNote = useCan("check_notes", "create");

  const matches = useMatches(person, done);
  const notes = notesOf(desk, item);
  const outcome = outcomeLine(t, desk, item);
  const first = person.name.split(/\s+/)[0] ?? person.name;

  const startMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setReasonError(false);
    if (next === "none") setPicked(null);
  };

  const accept = async () => {
    const outcome = await run(() => acceptNewPatient(toCheck, acceptKey(item)));
    if (outcome === null) return;
    if (!outcome.ok) return setError(refusal(outcome.reason));
    const email = person.email !== null && person.email.trim() !== "";
    const tail = isFirst ? ` ${t("registration.toast.firstStays")} ${email ? t("registration.toast.emailGoes") : t("registration.toast.noEmail")}` : "";
    toast(`${t("registration.toast.accepted", { name: person.name })}${tail}`, { icon: "user-check", tone: "pos" });
    onClose();
  };

  const join = async () => {
    if (picked === null) return;
    const outcome = await run(() => linkToPatient(toCheck, picked.id));
    if (outcome === null) return;
    if (!outcome.ok) return setError(refusal(outcome.reason));
    toast(isFirst ? t("registration.toast.bookingMoved", { name: picked.name }) : t("registration.toast.joined", { name: picked.name }), { icon: "arrow-right-left", tone: "pos" });
    onClose();
  };

  const saveNote = async () => {
    const text = note.trim() === "" ? t("registration.rang.default") : note.trim();
    const outcome = await run(() => addCheckNote(toCheck, text, noteKey, true));
    if (outcome === null) return;
    if (!outcome.ok) return setError(refusal(outcome.reason));
    toast(t("registration.toast.rang", { name: first, time: time(now()) }), { icon: "phone-call" });
    setNote("");
    setNoteKey(actionKey());
    startMode("none");
  };

  const doDecline = async () => {
    if (reason.trim() === "") return setReasonError(true);
    const outcome = await run(() => decline(toCheck, reason.trim(), declineKey));
    if (outcome === null) return;
    if (!outcome.ok) return setError(refusal(outcome.reason));
    setDeclineKey(actionKey());
    toast(isFirst ? `${t("registration.toast.declined")} ${t("registration.toast.timeOpen")}` : t("registration.toast.declined"), { icon: "user-x", tone: "warn" });
    onClose();
  };

  const details: { icon: LucideIcon; label: string; value: string; mono: boolean }[] = [
    { icon: Cake, label: t("registration.detail.born"), value: person.bornOn === null ? t("registration.detail.none") : t("registration.detail.bornValue", { born: person.bornOn, age: ageOn(person.bornOn, today) }), mono: true },
    { icon: Smartphone, label: t("registration.detail.mobile"), value: person.mobile, mono: true },
    { icon: Mail, label: t("registration.detail.email"), value: person.email ?? t("registration.detail.none"), mono: person.email !== null },
    { icon: House, label: t("registration.detail.address"), value: (item.kind === "registration" ? item.row.address : null) ?? t("registration.detail.none"), mono: false },
    { icon: PhoneCall, label: t("registration.detail.contact"), value: (item.kind === "registration" ? item.row.emergency_contact : null) ?? t("registration.detail.none"), mono: false },
  ];
  if (item.kind === "visit") {
    details.push({
      icon: CalendarCheck,
      label: t("registration.detail.firstVisit"),
      value: t("registration.detail.firstVisitValue", {
        day: dayLong(dayOf(item.row.starts_at)),
        time: time(item.row.starts_at),
        who: desk.clinicians.find((c) => c.id === item.row.clinician_id)?.name ?? "",
      }),
      mono: false,
    });
  }

  return (
    <Sheet
      icon={UserRound}
      // The person's initials in the new-patient visit's colour, as the design heads the sheet.
      lead={<Tile name={person.name} color={desk.visitTypes.find((v) => v.new_patients_only)?.color ?? "#0369a1"} size={44} />}
      titleSize={17}
      title={person.name}
      sub={<span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), whiteSpace: "normal", lineHeight: 1.5 }}>{sourceLine(t, desk, item)}</span>}
      onClose={onClose}
    >
      <dl style={{ margin: 0, padding: "4px 14px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
        {details.map((d, i) => (
          // A list's rows may hold only the term and its value, so the icon rides inside the term.
          <div key={d.label} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 2, padding: "10px 0", paddingInlineStart: 25, borderBlockEnd: i === details.length - 1 ? "none" : "1px solid var(--border)" }}>
            <dt style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" }}>
              <d.icon size={14} aria-hidden="true" style={{ position: "absolute", insetInlineStart: 0, insetBlockStart: 13, color: "var(--fg-subtle)" }} />
              {d.label}
            </dt>
            <dd style={{ margin: 0, ...(d.mono ? { ...mono(13, 600, "var(--fg)"), whiteSpace: "normal", alignSelf: "flex-start" } : { fontSize: 13, fontWeight: 700, lineHeight: 1.5, color: "var(--fg)", textWrap: "pretty" }) }}>{d.value}</dd>
          </div>
        ))}
      </dl>

      {!done && matches.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionLabel as="h3">{t("registration.matches")}</SectionLabel>
          {matches.map((m) => (
            <div key={m.patient.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "11px 12px", borderRadius: 12, background: "var(--warn-soft)", color: "var(--warn)" }}>
              <Users size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 160, fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
                {t(`registration.match.${m.why}`)} <strong style={{ fontWeight: 800 }}>{m.patient.name}</strong>
              </span>
              {mayUpdate && (
                <button
                  type="button"
                  className="rh-btn"
                  onClick={() => {
                    startMode("same");
                    setPicked(m.patient);
                  }}
                  style={{ ...btnGhostSm, height: 32 }}
                >
                  {t("registration.sameShort")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionLabel as="h3">{t("registration.notes")}</SectionLabel>
          {notes.map((n) => (
            <div key={n.id} style={{ display: "flex", flexDirection: "column", gap: 3, paddingBlockEnd: 8, borderBlockEnd: "1px solid var(--border)" }}>
              <span style={{ ...mono(11, 600, "var(--fg-subtle)"), alignSelf: "flex-start" }}>{n.created_at === null ? "" : `${dayShort(dayOf(n.created_at))} · ${time(n.created_at)}`}</span>
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: "var(--fg)" }}>{n.note}</span>
            </div>
          ))}
        </div>
      )}

      {done && outcome !== null && (
        <Note tone="pos" icon={BadgeCheck} role="status" strong>
          {outcome}
        </Note>
      )}

      {!done && mode === "none" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mayAccept && (
            <Btn icon={UserCheck} busy={busy} onClick={() => void accept()} style={{ width: "100%" }}>
              {t("registration.accept")}
            </Btn>
          )}
          {mayUpdate && (
            <Btn kind="ghost" icon={Users} onClick={() => startMode("same")} disabled={busy} style={{ width: "100%" }}>
              {t("registration.same")}
            </Btn>
          )}
          {mayNote && (
            <Btn kind="ghost" icon={PhoneCall} onClick={() => startMode("rang")} disabled={busy} style={{ width: "100%" }}>
              {t("registration.rang")}
            </Btn>
          )}
          {mayUpdate && (
            <Btn kind="ghost" icon={UserX} onClick={() => startMode("decline")} disabled={busy} style={{ width: "100%", color: "var(--danger)" }}>
              {t("registration.decline")}
            </Btn>
          )}
        </div>
      )}

      {!done && mode === "same" && (
        <SameMode item={item} picked={picked} onPick={setPicked} busy={busy} onBack={() => startMode("none")} onJoin={() => void join()} onClose={onClose} />
      )}

      {!done && mode === "rang" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={labelText}>{t("registration.rang.label")}</span>
            <textarea className="rh-fld" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("registration.rang.placeholder")} style={areaStyle} />
          </label>
          <div style={{ display: "flex", gap: 9 }}>
            <button type="button" className="rh-btn" onClick={() => startMode("none")} style={{ ...btnGhost, flex: 1 }}>
              {t("common.back")}
            </button>
            <Btn icon={PhoneCall} busy={busy} onClick={() => void saveNote()} style={{ flex: 1 }}>
              {t("registration.rang.save")}
            </Btn>
          </div>
        </div>
      )}

      {!done && mode === "decline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={labelText}>{t("registration.decline.label")}</span>
            <textarea
              className="rh-fld"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(false);
              }}
              placeholder={t("registration.decline.placeholder")}
              aria-invalid={reasonError}
              aria-describedby={reasonError ? "reg-err" : undefined}
              style={areaStyle}
            />
          </label>
          {reasonError && (
            <Note tone="danger" icon={CircleAlert} role="alert" id="reg-err">
              {t("registration.decline.needWhy")}
            </Note>
          )}
          {item.kind === "visit" && (
            <Note tone="warn" icon={CalendarX}>
              {t("registration.decline.firstLine", { day: dayShort(dayOf(item.row.starts_at)) })}
            </Note>
          )}
          <div style={{ display: "flex", gap: 9 }}>
            <button type="button" className="rh-btn" onClick={() => startMode("none")} style={{ ...btnGhost, flex: 1 }}>
              {t("common.back")}
            </button>
            {/* White on the dark theme's lighter red fails contrast; the accent's own text colour reads on both. */}
            <Btn kind="danger" busy={busy} onClick={() => void doDecline()} style={{ flex: 1, color: "var(--accent-fg)" }}>
              {t("registration.decline")}
            </Btn>
          </div>
        </div>
      )}

      {error !== null && (
        <Note tone="danger" icon={CircleAlert} role="alert">
          {error}
        </Note>
      )}
    </Sheet>
  );
}

/** "Same person as…": find the patient, see what differs, join the records. */
function SameMode({
  item,
  picked,
  onPick,
  busy,
  onBack,
  onJoin,
  onClose,
}: {
  item: RegItem;
  picked: Patient | null;
  onPick: (p: Patient | null) => void;
  busy: boolean;
  onBack: () => void;
  onJoin: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const desk = useDesk();
  const today = dayOf(useNow());
  const [q, setQ] = useState("");
  const hits = usePatientSearch(q, today);
  const color = patientColor(desk.visitTypes);
  const person = personOf(item);

  const differs = picked === null ? [] : differences(item, picked);
  const openRecord = (id: Id) => {
    onClose();
    go("patients");
    useUi.setState({ patientId: id });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLabel as="h3" id="reg-same-h">
        {t("registration.same")}
      </SectionLabel>
      <input
        className="rh-fld"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onPick(null);
        }}
        aria-label={t("registration.search")}
        placeholder={t("book.searchPlaceholder")}
        style={fieldStyle(false)}
      />
      {picked === null && hits.state === "hits" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {hits.rows.map((p) => (
            <HitRow key={p.id} name={p.name} meta={`${p.born_on} · ${p.mobile}`} color={color} onClick={() => onPick(p)} />
          ))}
        </div>
      )}
      {picked === null && hits.state === "none" && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-subtle)" }}>{t("book.noHits")}</span>}
      {picked !== null && (
        <>
          <Note tone="accent" icon={ArrowRightLeft} role="status" strong style={{ border: "1px solid var(--accent)" }}>
            {item.kind === "visit" ? t("registration.same.bookingMoves", { name: picked.name }) : t("registration.same.joins", { name: picked.name })}
          </Note>
          {differs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "11px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t("registration.same.differs", { name: person.name.split(/\s+/)[0] ?? person.name })}</span>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
                {differs.map((d) => (
                  <li key={d.field} style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, color: "var(--fg-muted)" }}>
                    <span style={{ fontWeight: 800, color: "var(--fg)" }}>{t(`registration.detail.${d.field}`)}</span>
                    {" · "}
                    {t("registration.same.typedVsFile", { typed: d.typed, file: d.file === "" ? t("registration.detail.none") : d.file })}
                  </li>
                ))}
              </ul>
              <button type="button" className="rh-gi" onClick={() => openRecord(picked.id)} style={{ ...btnGhostSm, height: 32, alignSelf: "flex-start" }}>
                {t("registration.same.editDetails")}
              </button>
            </div>
          )}
        </>
      )}
      <div style={{ display: "flex", gap: 9 }}>
        <button type="button" className="rh-btn" onClick={onBack} style={{ ...btnGhost, flex: 1 }}>
          {t("common.back")}
        </button>
        <Btn busy={busy} disabled={picked === null} onClick={onJoin} style={{ ...btnPrimary, flex: 1, ...(picked === null ? { background: "var(--surface-3)", color: "var(--fg-subtle)", opacity: 1 } : {}) }}>
          {t("registration.same.join")}
        </Btn>
      </div>
    </div>
  );
}

/** What the person typed that differs from the record they are joining (nothing is copied). */
function differences(item: RegItem, p: Patient): { field: "mobile" | "email" | "address" | "contact"; typed: string; file: string }[] {
  const person = personOf(item);
  const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
  const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
  const out: { field: "mobile" | "email" | "address" | "contact"; typed: string; file: string }[] = [];
  if (person.mobile !== "" && digits(person.mobile) !== digits(p.mobile)) out.push({ field: "mobile", typed: person.mobile, file: p.mobile });
  if (person.email !== null && person.email !== "" && !same(person.email, p.email)) out.push({ field: "email", typed: person.email, file: p.email ?? "" });
  if (item.kind === "registration") {
    if (item.row.address !== null && item.row.address !== "" && !same(item.row.address, p.address)) out.push({ field: "address", typed: item.row.address, file: p.address ?? "" });
    if (item.row.emergency_contact !== null && item.row.emergency_contact !== "" && !same(item.row.emergency_contact, p.emergency_contact)) {
      out.push({ field: "contact", typed: item.row.emergency_contact, file: p.emergency_contact ?? "" });
    }
  }
  return out;
}

type MatchWhy = "both" | "name" | "mobile";

/** Patients on file who look like this person: same mobile and birthday, then name and birthday, then mobile. */
function useMatches(person: { name: string; bornOn: string | null; mobile: string }, skip: boolean): { patient: Patient; why: MatchWhy }[] {
  const [found, setFound] = useState<{ patient: Patient; why: MatchWhy }[]>([]);
  useEffect(() => {
    if (skip || person.bornOn === null) return;
    let live = true;
    deskReads()
      .matches({ name: person.name, born_on: person.bornOn, mobile: person.mobile })
      .then((m) => {
        if (!live) return;
        setFound([...m.both.map((p) => ({ patient: p, why: "both" as const })), ...m.name.map((p) => ({ patient: p, why: "name" as const })), ...m.mobile.map((p) => ({ patient: p, why: "mobile" as const }))]);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [skip, person.name, person.bornOn, person.mobile]);
  return skip ? [] : found;
}
