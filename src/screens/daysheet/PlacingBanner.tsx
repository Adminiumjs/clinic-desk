/**
 * The banner over the day sheet while the desk is placing a visit: who, what
 * and how long — "Booking Kofi Mensah in", or "Moving Delphine Auclair ·
 * RH-7Q2K" with where the visit is now — and "Never mind" to stop.
 */
import { useI18n } from "../../i18n/index.tsx";
import { initials } from "../../lib/color.ts";
import { dayOf, dayShort, num, time } from "../../lib/format.ts";
import { clinicianOf, typeOf } from "../../lib/desk.ts";
import { useDesk } from "../../state/desk.ts";
import { stopPlacing, type Placing } from "../../state/ui.ts";
import { mono, tileStyle, useDark } from "../../components/ui.tsx";

export default function PlacingBanner({ placing, day }: { placing: Placing; day: string }) {
  const { t } = useI18n();
  const dark = useDark();
  const type = useDesk((s) => typeOf(s, placing.typeId));
  const moved = useDesk((s) => (placing.exclude === undefined ? undefined : s.visits[placing.exclude]));
  const movedWith = useDesk((s) => clinicianOf(s, moved?.clinician_id ?? null));
  const typeName = type?.short_name ?? type?.name ?? "";
  const minutes = num(placing.minutes);

  let line: string;
  let sub: string;
  if (placing.what === "moving") {
    line = t("daysheet.placing.moving", { name: placing.patientName, ref: placing.ref ?? moved?.ref ?? "", type: typeName, minutes });
    sub = moved === undefined ? "" : t("daysheet.placing.now", { day: dayShort(dayOf(moved.starts_at)), time: time(moved.starts_at), clinician: movedWith?.short_name ?? "" });
  } else {
    line = t("daysheet.placing.booking", { name: placing.patientName });
    sub = t("daysheet.placing.bookingSub", { type: type?.name ?? typeName, minutes, day: dayShort(day) });
  }

  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 15px", borderRadius: 14, border: "1px solid var(--accent)", background: "var(--accent-soft)" }}>
      <span aria-hidden="true" style={tileStyle(type?.color ?? "#3b6fbd", dark, 34)}>
        {initials(placing.patientName)}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em", color: "var(--accent)" }}>{line}</span>
        {sub !== "" && <span style={{ ...mono(11.5, 600, "var(--accent)"), direction: "inherit", whiteSpace: "normal" }}>{sub}</span>}
      </span>
      <button
        type="button"
        className="rh-gi"
        onClick={stopPlacing}
        style={{ marginInlineStart: "auto", height: 32, paddingInline: 11, borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
      >
        {t("daysheet.placing.stop")}
      </button>
    </div>
  );
}
