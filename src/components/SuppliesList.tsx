/**
 * The supplies of one visit, as a list: what was used, how many, from which
 * batch — the design's rows, in its two modes.
 *
 *   view   what was recorded, for someone who reads it: reception's copy, the
 *          send-off sheet, and everyone once the visit is seen;
 *   edit   the clinician's (and the manager's) own list while the patient is
 *          with them: − / +, "Not used", the batch to confirm, remove.
 *
 * Every figure on a row is one the port handed over: what is left and the low
 * mark are Inventory's stock point, the expiry warning its own word. A row
 * disables nothing for stock — a visit is never held up by a count.
 */
import { CalendarClock, Check, X } from "lucide-react";

import type { Batch, SupplyView } from "../data/supplies.ts";
import type { Id } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { dayShortYear, num } from "../lib/format.ts";
import { Note, monoText } from "../sheets/bits/ui.tsx";
import { btnGhostSm, chipStyle, iconBtnStyle, pill, Stepper } from "./ui.tsx";

export interface SupplyEdits {
  qty(lineId: Id, qty: number): void;
  notUsed(lineId: Id, on: boolean): void;
  confirm(lineId: Id, batchId: Id): void;
  remove(lineId: Id): void;
}

const meta = monoText(11.5, "var(--fg-muted)");

export default function SuppliesList({ views, edits, busy = false }: { views: readonly SupplyView[]; edits?: SupplyEdits | undefined; busy?: boolean }) {
  const { t } = useI18n();
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, borderRadius: 13, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden" }}>
      {views.map((view, index) => (
        <Row key={view.line.id} view={view} first={index === 0} edits={edits} busy={busy} t={t} />
      ))}
    </ul>
  );
}

function Row({ view, first, edits, busy, t }: { view: SupplyView; first: boolean; edits: SupplyEdits | undefined; busy: boolean; t: ReturnType<typeof useI18n>["t"] }) {
  const { line, notUsed } = view;
  const name = view.name === "" ? t("supplies.itemGone") : view.name;
  const added = line.kit_id === null;
  const editing = edits !== undefined;
  // The batch this line shows: the one confirmed, else the one that would be proposed first.
  const shown: Batch | null = view.batch ?? view.proposals[0] ?? null;
  const unknown = view.tracksBatches && view.batch === null && !notUsed && !(editing && view.proposals.length > 0);
  const dim = notUsed ? "var(--fg-subtle)" : undefined;
  const short = view.left !== null && view.left <= 0;
  return (
    <li style={{ padding: "11px 12px", display: "flex", flexDirection: "column", gap: 8, ...(first ? {} : { borderBlockStart: "1px solid var(--border)" }) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 120px", minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-.015em", lineHeight: 1.35, textWrap: "pretty", ...(notUsed ? { color: "var(--fg-subtle)", textDecoration: "line-through" } : { color: "var(--fg)" }) }}>{name}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ ...meta, ...(dim === undefined ? {} : { color: dim }) }}>{t("supplies.qty", { qty: num(line.qty), unit: view.unit }).trim()}</span>
            {view.batch !== null && (
              <span style={{ ...meta, display: "inline-flex", alignItems: "center", gap: 4, ...(dim === undefined ? {} : { color: dim }) }}>
                {editing && !notUsed && <Check size={12} aria-hidden="true" />}
                {t("supplies.batch", { code: view.batch.code })}
              </span>
            )}
            {unknown && <span style={meta}>{t("supplies.batchUnknown")}</span>}
            {!notUsed && short && <span style={{ ...meta, color: "var(--warn)" }}>{t("supplies.leftNone")}</span>}
            {!notUsed && !short && view.low && view.left !== null && <span style={{ ...meta, color: "var(--warn)" }}>{t("supplies.left", { n: num(view.left) })}</span>}
            {added && <span style={{ ...pill("var(--accent-soft)", "var(--accent)"), fontSize: 10.5, padding: "2px 7px", gap: 0 }}>{t("supplies.added")}</span>}
          </span>
        </div>
        {editing && !notUsed && (
          <Stepper
            fewer={t("supplies.fewer", { name })}
            more={t("supplies.more", { name })}
            canFewer={line.qty > 1}
            disabled={busy}
            onFewer={() => edits.qty(line.id, line.qty - 1)}
            onMore={() => edits.qty(line.id, line.qty + 1)}
          />
        )}
        {editing && !added && (
          <button
            type="button"
            className="rh-chip rh-touch"
            aria-pressed={notUsed}
            aria-label={t("supplies.markNotUsed", { name })}
            disabled={busy}
            onClick={() => edits.notUsed(line.id, !notUsed)}
            style={{ ...chipStyle(notUsed), height: 30, paddingInline: 11, fontSize: 11.5 }}
          >
            {t("supplies.notUsed")}
          </button>
        )}
        {editing && added && (
          <button type="button" className="rh-gi rh-touch" aria-label={t("supplies.remove", { name })} title={t("supplies.remove", { name })} disabled={busy} onClick={() => edits.remove(line.id)} style={{ ...iconBtnStyle, width: 30, height: 30 }}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
        {!editing && notUsed && <span style={pill("var(--surface-3)", "var(--fg-subtle)")}>{t("supplies.notUsed")}</span>}
      </div>
      {editing && !notUsed && view.proposals.length === 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={meta}>{t("supplies.batch", { code: view.proposals[0]!.code })}</span>
          <button type="button" className="rh-gi rh-touch" disabled={busy} aria-label={t("supplies.confirmBatch", { code: view.proposals[0]!.code, name })} onClick={() => edits.confirm(line.id, view.proposals[0]!.id)} style={{ ...btnGhostSm, height: 30 }}>
            <Check size={13} aria-hidden="true" />
            {t("supplies.confirm")}
          </button>
        </div>
      )}
      {editing && !notUsed && view.proposals.length > 1 && (
        <div role="group" aria-label={t("supplies.whichBatch")} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" }}>{t("supplies.whichBatch")}</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {view.proposals.map((batch) => (
              <button
                key={batch.id}
                type="button"
                className="rh-gi rh-touch"
                disabled={busy}
                aria-label={t("supplies.confirmBatch", { code: batch.code, name })}
                onClick={() => edits.confirm(line.id, batch.id)}
                style={{ ...btnGhostSm, height: 30, fontFamily: meta.fontFamily, fontWeight: 600 }}
              >
                {batch.expiresOn === null ? t("supplies.batchExpiresNoDate", { code: batch.code }) : t("supplies.batchChoice", { code: batch.code, date: dayShortYear(batch.expiresOn) })}
              </button>
            ))}
          </div>
        </div>
      )}
      {view.expiresSoon && shown !== null && shown.expiresOn !== null && (
        <Note tone="warn" icon={CalendarClock} style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8 }}>
          {t("supplies.batchExpires", { code: shown.code, date: dayShortYear(shown.expiresOn) })}
        </Note>
      )}
    </li>
  );
}
