/**
 * The small pieces every patients' page is built from, drawn as the design
 * draws them: the page's heading and line, a card, a labelled field, a
 * warning, the practice's phone number in its mono type, a visit type's
 * icon, a clinician's tile, "that time has just gone" with the nearest
 * times, and the loading shimmer.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Baby,
  Bandage,
  Bone,
  Brain,
  CalendarCheck,
  CircleAlert,
  ClipboardList,
  ClockAlert,
  Ear,
  Eye,
  Footprints,
  Hand,
  HeartPulse,
  PersonStanding,
  Pill,
  Smile,
  Stethoscope,
  Syringe,
  Thermometer,
  UserPlus,
} from "lucide-react";

import type { Catalogue } from "../../data/ports.ts";
import type { Hhmm, Id } from "../../data/types.ts";
import { useI18n } from "../../i18n/index.tsx";
import { MONO, cardStyle, fieldStyle, mono, tileStyle, useDark } from "../../components/ui.tsx";
import { initials } from "../../lib/color.ts";
import { usePatients } from "../../state/patients.ts";

export const labelStyle: CSSProperties = { fontSize: 11.5, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" };
export const sectionLabel: CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--fg-subtle)" };
export const ledeStyle: CSSProperties = { margin: "9px 0 0", maxWidth: "52ch", fontSize: 14.5, fontWeight: 500, lineHeight: 1.65, color: "var(--fg-muted)", textWrap: "pretty" };
export const screenColumn: CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };
export { cardStyle };

/** The page's title and the line under it. `size` is the design's two title sizes. */
export function PageHead({ title, lede, size = "page", ledeWidth = "52ch" }: { title: ReactNode; lede?: ReactNode; size?: "find" | "page"; ledeWidth?: string }) {
  const h1: CSSProperties =
    size === "find"
      ? { margin: 0, fontSize: "clamp(27px,4vw,35px)", fontWeight: 800, letterSpacing: "-.038em", lineHeight: 1.1 }
      : { margin: 0, fontSize: "clamp(25px,3.6vw,33px)", fontWeight: 800, letterSpacing: "-.036em", lineHeight: 1.12 };
  return (
    <div>
      <h1 style={h1}>{title}</h1>
      {lede !== undefined && <p style={{ ...ledeStyle, maxWidth: ledeWidth }}>{lede}</p>}
    </div>
  );
}

/** A labelled text field, the design's 40 px field. */
export function TextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  isMono = false,
  invalid = false,
  describedBy,
  type = "text",
  readOnly = false,
  autoComplete,
  inputMode,
  wide = false,
  after,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  isMono?: boolean;
  invalid?: boolean;
  describedBy?: string;
  type?: "text" | "email" | "tel";
  readOnly?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  wide?: boolean;
  after?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...(wide ? { gridColumn: "1/-1" } : {}) }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        className="rh-fld"
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        autoComplete={autoComplete}
        inputMode={inputMode}
        dir={isMono ? "ltr" : undefined}
        style={{ ...fieldStyle(isMono), ...(readOnly ? { background: "var(--surface-3)", color: "var(--fg-muted)" } : {}), ...(isMono ? { textAlign: "start" } : {}) }}
      />
      {after}
    </div>
  );
}

/** A warning or an error in its tinted box, read out when it appears. */
export function Notice({ tone = "warn", id, children, style }: { tone?: "warn" | "danger"; id?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      id={id}
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: "12px 13px",
        borderRadius: 12,
        background: `var(--${tone}-soft)`,
        color: `var(--${tone})`,
        fontSize: 12.5,
        fontWeight: 700,
        lineHeight: 1.55,
        ...style,
      }}
    >
      <CircleAlert size={15} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 1 }} />
      <span>{children}</span>
    </div>
  );
}

/** The practice's phone number, in the design's mono. */
export function Phone({ value, size = 12.5 }: { value: string; size?: number }) {
  return <span style={mono(size, 600, "var(--fg)")}>{value}</span>;
}

/**
 * A sentence with one `{name}` drawn as its own element (a number in mono,
 * a link), wherever the language puts it in the sentence.
 */
export function Fill({ text, name, children }: { text: string; name: string; children: ReactNode }) {
  const at = text.indexOf(`{${name}}`);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      {children}
      {text.slice(at + name.length + 2)}
    </>
  );
}

/** A sentence with `{phone}` in it, the number drawn in mono. */
export function WithPhone({ text, phone }: { text: string; phone: string }) {
  return (
    <Fill text={text} name="phone">
      <Phone value={phone} />
    </Fill>
  );
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  "user-plus": UserPlus,
  "person-standing": PersonStanding,
  syringe: Syringe,
  "heart-pulse": HeartPulse,
  baby: Baby,
  bandage: Bandage,
  pill: Pill,
  eye: Eye,
  ear: Ear,
  brain: Brain,
  bone: Bone,
  activity: Activity,
  thermometer: Thermometer,
  hand: Hand,
  footprints: Footprints,
  smile: Smile,
  "clipboard-list": ClipboardList,
  "calendar-check": CalendarCheck,
};
/** A visit type's icon by its lucide name; the stethoscope when the name is not one the pages carry. */
export const typeIcon = (name: string): LucideIcon => TYPE_ICONS[name] ?? Stethoscope;

/** A clinician's initials in their colour's tile; "··" in a plain tile for "anyone". */
export function ClinicianTile({ name, color, size }: { name: string | null; color: string | null; size: number }) {
  const dark = useDark();
  if (name === null || color === null) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, flexShrink: 0, borderRadius: Math.round(size * 0.33), background: "var(--surface-3)", color: "var(--fg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}
      >
        ··
      </span>
    );
  }
  return (
    <span aria-hidden="true" style={tileStyle(color, dark, size)}>
      {initials(name)}
    </span>
  );
}

/** The catalogue: what the practice offers, read once a visit. */
export const useCatalogue = (): Catalogue | null => usePatients((s) => s.catalogue);

/** A clinician's name, whoever they are — bookable online or not (a visit's clinician may be desk-only, or have left). */
export function clinicianNamed(cat: Catalogue | null, id: Id | null): { name: string; short: string; role: string; color: string } | null {
  if (cat === null || id === null) return null;
  const c = cat.clinicians.find((x) => x.id === id) ?? cat.names.find((x) => x.id === id);
  return c === undefined ? null : { name: c.name, short: c.short_name, role: c.role_label, color: c.color };
}

/** The phone-width layout: below 900 px, as the design switches. */
export function useNarrow(): boolean {
  const query = "(max-width: 899px)";
  const [narrow, setNarrow] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const list = matchMedia(query);
    const on = () => setNarrow(list.matches);
    on();
    list.addEventListener("change", on);
    return () => list.removeEventListener("change", on);
  }, []);
  return narrow;
}

/** The design's loading shimmer: a title bar and two blocks. */
export function PageSkeleton() {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} role="status" aria-label={t("common.loading")}>
      <div className="rh-skel" style={{ height: 34, width: "52%" }} />
      <div className="rh-skel" style={{ height: 120 }} />
      <div className="rh-skel" style={{ height: 210 }} />
    </div>
  );
}

/** A time chip: the nearest times after one has gone, a clinician's next three. */
export const timeChip: CSSProperties = {
  height: 38,
  paddingInline: 13,
  borderRadius: 10,
  border: "1px solid var(--border-strong)",
  background: "var(--surface)",
  cursor: "pointer",
  fontFamily: MONO,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--fg)",
  letterSpacing: "-.01em",
  whiteSpace: "nowrap",
};

/**
 * "That time has just gone": the warning, and the nearest free times on the
 * same day to tap instead — or, when none is left, a line saying so.
 */
export function GoneBox({ near, dayLabel, onPick, timeLabel }: { near: Hhmm[]; dayLabel: string; onPick: (time: Hhmm) => void; timeLabel: (time: Hhmm) => string }) {
  const { t } = useI18n();
  return (
    <div role="alert" style={{ marginBlockStart: 14, display: "flex", flexDirection: "column", gap: 10, padding: 13, borderRadius: 13, background: "var(--warn-soft)", color: "var(--warn)" }}>
      <span style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, fontWeight: 800, lineHeight: 1.5, textWrap: "pretty" }}>
        <ClockAlert size={15} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 1 }} />
        <span>{near.length > 0 ? t("details.gone") : t("details.goneNone", { day: dayLabel })}</span>
      </span>
      {near.length > 0 && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {near.map((time) => (
            <button key={time} type="button" className="rh-slot" onClick={() => onPick(time)} style={timeChip}>
              {timeLabel(time)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A small bordered button, the design's "Not you? Sign out" / "Use different details". */
export const quietBtn: CSSProperties = {
  height: 32,
  paddingInline: 11,
  borderRadius: 9,
  border: "1px solid var(--border-strong)",
  background: "var(--surface)",
  color: "var(--fg-muted)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
