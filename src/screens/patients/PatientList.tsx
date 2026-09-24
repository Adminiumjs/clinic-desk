/**
 * The patient list: the server searches name and mobile and pages the
 * answer; the count is the server's total, and each row's "last seen" and
 * "owing" come from one read for the rows on screen. Nothing reads the whole
 * patients table.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, ShieldAlert } from "lucide-react";

import type { PatientFilter } from "../../data/ports.ts";
import type { Id, Instant, Patient } from "../../data/types.ts";
import { useI18n } from "../../i18n/index.tsx";
import { today } from "../../lib/clock.ts";
import { ageOn, dayMonth, dayOf } from "../../lib/format.ts";
import { deskReads, useDesk } from "../../state/desk.ts";
import { useUi } from "../../state/ui.ts";
import { Btn, Chip, Skeleton, Tile, fieldStyle, mono, monoPill, pill } from "../../components/ui.tsx";
import { amountText } from "../../sheets/deskwork/money.ts";
import { counted, dayYear } from "../deskwork/dates.ts";
import { Screen, dashedNote, kickerStyle, nameStyle, titleStyle } from "../deskwork/parts.tsx";

const PAGE = 30;
const FILTERS: { id: PatientFilter; key: "patients.filter.all" | "patients.filter.owing" | "patients.filter.allergies" | "patients.filter.recall" }[] = [
  { id: "all", key: "patients.filter.all" },
  { id: "owing", key: "patients.filter.owing" },
  { id: "allergies", key: "patients.filter.allergies" },
  { id: "recall", key: "patients.filter.recall" },
];

interface Found {
  rows: Patient[];
  total: number | null;
  glance: Map<Id, { lastSeen: Instant | null; owing: number }>;
}

export default function PatientList() {
  const { t, dir } = useI18n();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<PatientFilter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [found, setFound] = useState<Found | null>(null);
  const [failed, setFailed] = useState(false);
  const [again, setAgain] = useState(0);
  const asked = useRef(0);
  const tint = useDesk((s) => [...s.visitTypes].sort((a, b) => a.position - b.position)[0]?.color ?? "#0369a1");

  useEffect(() => {
    const seq = ++asked.current;
    setFailed(false);
    // Typing waits a moment before asking; a filter or "Show more" asks at once.
    const timer = setTimeout(
      () => {
        void (async () => {
          try {
            const { rows, total } = await deskReads().search({ q, filter, limit, offset: 0 }, today());
            const glance = rows.length === 0 ? new Map() : await deskReads().glance(rows.map((p) => p.id));
            // Only the latest question's answer lands: an older, slower one never overwrites it.
            if (seq === asked.current) setFound({ rows, total, glance });
          } catch {
            if (seq === asked.current) setFailed(true);
          }
        })();
      },
      q.trim() === "" ? 0 : 250,
    );
    return () => clearTimeout(timer);
  }, [q, filter, limit, again]);

  const count = found === null ? null : (found.total ?? found.rows.length);
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <Screen name="Patients">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={kickerStyle}>{t("nav.patients")}</div>
          <h1 style={titleStyle} aria-live="polite">
            {count === null ? t("patients.reading") : t("patients.count", { count })}
          </h1>
        </div>
        <div style={{ marginInlineStart: "auto", width: "min(280px, 100%)", position: "relative" }}>
          <Search size={15} aria-hidden="true" style={{ position: "absolute", insetInlineStart: 11, insetBlockStart: 13.5, color: "var(--fg-subtle)" }} />
          <input
            className="rh-fld"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={t("patients.search")}
            aria-label={t("patients.searchLabel")}
            style={{ ...fieldStyle(false), paddingInlineStart: 34, height: 42 }}
          />
        </div>
      </div>

      <div role="group" aria-label={t("patients.filters")} style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            on={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setLimit(PAGE);
            }}
          >
            {t(f.key)}
          </Chip>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {failed ? (
          <div role="alert" style={{ ...dashedNote, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 180 }}>{t("patients.failed")}</span>
            <Btn kind="ghostSm" onClick={() => setAgain((n) => n + 1)}>
              {t("common.tryAgain")}
            </Btn>
          </div>
        ) : found === null ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={64} radius={14} />)
        ) : found.rows.length === 0 ? (
          <div style={dashedNote}>{q.trim() === "" ? t("patients.noneMatch") : t("patients.none")}</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            {found.rows.map((p) => (
              <li key={p.id}>
                <PatientRow patient={p} glance={found.glance.get(p.id)} tint={tint} chevron={<Chevron size={16} aria-hidden="true" style={{ color: "var(--fg-subtle)", flexShrink: 0 }} />} />
              </li>
            ))}
          </ul>
        )}
        {found !== null && count !== null && found.rows.length < count && (
          <Btn kind="ghostSm" style={{ alignSelf: "flex-start", marginBlockStart: 4 }} onClick={() => setLimit((n) => n + PAGE)}>
            {t("patients.more")}
          </Btn>
        )}
      </div>
    </Screen>
  );
}

function PatientRow({ patient: p, glance, tint, chevron }: { patient: Patient; glance: { lastSeen: Instant | null; owing: number } | undefined; tint: string; chevron: React.ReactNode }) {
  const { t } = useI18n();
  const day = today();
  const allergy = (p.allergies_note ?? "").trim();
  const owing = glance?.owing ?? 0;
  return (
    <button
      type="button"
      className="rh-row"
      onClick={() => useUi.setState({ patientId: p.id })}
      style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap", width: "100%", padding: "13px 15px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "start" }}
    >
      <Tile name={p.name} color={tint} size={36} />
      <span style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...nameStyle, color: "var(--fg)" }}>{p.name}</span>
          {allergy !== "" && (
            <span style={pill("var(--warn-soft)", "var(--warn)")}>
              <ShieldAlert size={11} aria-hidden="true" />
              {allergy}
            </span>
          )}
        </span>
        <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), whiteSpace: "normal" }}>
          {t("patients.meta", { born: dayYear(p.born_on), age: t("patients.age", counted(ageOn(p.born_on, day)), ageOn(p.born_on, day)), mobile: p.mobile })}
        </span>
      </span>
      <span style={mono(11.5, 600, "var(--fg-subtle)")}>
        {glance?.lastSeen ? t("patients.lastSeen", { date: dayMonth(dayOf(glance.lastSeen)) }) : t("patients.noVisits")}
      </span>
      {owing > 0 && <span style={monoPill("var(--warn-soft)", "var(--warn)")}>{t("patients.owing", { amount: amountText(owing) })}</span>}
      {chevron}
    </button>
  );
}
