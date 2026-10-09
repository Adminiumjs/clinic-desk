/**
 * The Supplies tab of a visit: what the visit used.
 *
 * WHO DOES WHAT. The clinician records it — they saw it used — from the
 * moment the patient is with them until the visit is seen: a kit pressed (one
 * line for each thing in it), a line marked not used, an item added by hand,
 * how many, and for an item kept in batches which batch, confirmed by them and
 * never for them. Reception reads the same list and changes none of it. Once
 * the visit is seen the list is closed for everyone: the supplies have left
 * the shelf. A manager can still add what was forgotten, or take the visit
 * back to put the list right ("Correct supplies"), after which it is seen
 * again and the shelf is counted again.
 *
 * Nothing here waits on stock. A line the books cannot cover says so quietly
 * and the visit goes on; a save that fails keeps the list as it was, says so
 * under it, and never touches the visit's own buttons.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CircleAlert, ClipboardList, HandHeart, Lock, PackagePlus, Plus, Undo2 } from "lucide-react";

import type { KitOffer, StockItem } from "../data/supplies.ts";
import { SuppliesGone } from "../data/supplies.ts";
import type { Appointment, Id } from "../data/types.ts";
import { useI18n } from "../i18n/index.tsx";
import { clinicianOf } from "../lib/desk.ts";
import { dayOf, dayShort, num, time } from "../lib/format.ts";
import { actionKey } from "../lib/keys.ts";
import { mayCorrectSupplies } from "../screens/daysheet/model.ts";
import { addKit, addSupply, confirmBatch, removeSupply, setNotUsed, setStatus, setSupplyQty, type Outcome } from "../state/actions.ts";
import { useCan, useDesk } from "../state/desk.ts";
import { forgetAddOn } from "../state/features.ts";
import { holdSupplies, isBehind, loadSupplies, setCorrecting, suppliesPort, useSupplies } from "../state/supplies.ts";
import { openSheet, toast } from "../state/ui.ts";
import { Note, labelText, monoText } from "../sheets/bits/ui.tsx";
import SuppliesList, { type SupplyEdits } from "./SuppliesList.tsx";
import { Btn, btnGhost, btnGhostSm, btnPrimary, chipStyle, fieldStyle, kicker, pill, Skeleton } from "./ui.tsx";

const WAIT_MS = 200;

/** Read a visit's supplies while a screen shows them. */
export function useVisitSupplies(visitId: Id) {
  useEffect(() => holdSupplies(visitId), [visitId]);
  return useSupplies((s) => s.byVisit[visitId]);
}

export default function SuppliesTab({ visit, name }: { visit: Appointment; name: string }) {
  const { t } = useI18n();
  const entry = useVisitSupplies(visit.id);
  const role = useDesk((s) => s.me.role);
  const clinician = useDesk((s) => clinicianOf(s, visit.clinician_id));
  const records = useCan("appointment_supplies", "create");
  const moves = useCan("appointments", "update");
  const correcting = useSupplies((s) => s.correcting[visit.id] === true);
  // Who may put a seen visit's supplies right is decided by what they may do, not by a role's name.
  const manager = mayCorrectSupplies({ role, update: moves, supplies: records });
  const seen = visit.status === "seen";
  // The clinician's own list while the patient is with them; a manager's too.
  const editable = records && (visit.status === "with_clinician" || visit.status === "ready");
  // After seen, a manager may still add what was forgotten.
  const mayAdd = editable || (records && manager && seen);

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<{ retry: () => void; words: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const running = useRef(false);
  const correctButton = useRef<HTMLDivElement>(null);
  const question = useRef<HTMLDivElement>(null);
  // The question takes the focus when it opens, and gives it back to the button that asked.
  useEffect(() => {
    if (asking) question.current?.querySelector<HTMLElement>("button")?.focus();
  }, [asking]);
  const stopAsking = () => {
    setAsking(false);
    setTimeout(() => correctButton.current?.querySelector<HTMLElement>("button")?.focus(), 0);
  };
  // A save can take away the very button that was pressed (a batch confirmed, the question
  // answered, "Done"): the focus then stays in the list, on the line it was on, not on the page.
  const section = useRef<HTMLElement>(null);
  const focusWas = useRef<{ line: string | null } | null>(null);
  useEffect(() => {
    const was = focusWas.current;
    const at = document.activeElement;
    if (busy || was === null || (at !== null && at !== document.body)) return;
    const row = was.line === null ? null : section.current?.querySelector(`[data-line="${was.line}"]`);
    (row?.querySelector<HTMLElement>("button:not(:disabled)") ?? section.current)?.focus();
  }, [busy]);

  /** One save at a time; a refusal is said under the list, with the way to try again. */
  const save = (work: () => Promise<Outcome<unknown>>, unsaved: string = t("supplies.failed")) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFailed(null);
    void work()
      .then((out) => {
        if (!out.ok) setFailed({ retry: () => save(work, unsaved), words: out.reason === "supplies-closed" || out.reason === "supplies" || out.reason === "not-allowed" || out.reason === "signed-out" ? t(`refusal.${out.reason}`) : unsaved });
      })
      .finally(() => {
        running.current = false;
        setBusy(false);
      });
  };

  const edits: SupplyEdits = {
    qty: (lineId, qty) => save(() => setSupplyQty({ visitId: visit.id, lineId, qty })),
    notUsed: (lineId, on) => save(() => setNotUsed({ visitId: visit.id, lineId, notUsed: on })),
    confirm: (lineId, batchId) => save(() => confirmBatch({ visitId: visit.id, lineId, batchId })),
    remove: (lineId) => save(() => removeSupply({ visitId: visit.id, lineId })),
  };
  const pressKit = (kit: KitOffer) => {
    const key = actionKey();
    // A kit is a line per item: stopped midway, part of it is saved, and the same press finishes it.
    save(() => addKit({ visitId: visit.id, kitId: kit.id, lines: kit.lines, key }), t("supplies.kitFailed"));
  };
  const pickItem = (item: StockItem) => {
    const key = actionKey();
    save(() => addSupply({ visitId: visit.id, itemId: item.id, key }));
  };

  const view = entry?.view ?? null;
  const headId = useId();

  if (entry === undefined || (entry.state === "loading" && view === null)) {
    return (
      <div aria-busy="true" aria-label={t("supplies.loading")} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton height={14} width={120} radius={6} />
        <Skeleton height={132} radius={13} />
      </div>
    );
  }
  if (view === null) {
    return (
      <Note tone="danger" icon={CircleAlert} role="alert">
        {t("supplies.unread")}{" "}
        <button type="button" className="rh-gi" onClick={() => void loadSupplies(visit.id)} style={{ ...btnGhostSm, height: 28, marginInlineStart: 6 }}>
          {t("common.tryAgain")}
        </button>
      </Note>
    );
  }

  const offered = view.kits.filter((kit) => kit.linked || kit.added);
  const others = view.kits.filter((kit) => !kit.linked && !kit.added);
  const recordedBy = view.lines.find((shown) => shown.line.recorded_by !== null)?.line.recorded_by ?? null;
  const takeBack = () => {
    setAsking(false);
    save(async () => {
      const out = await setStatus(visit.id, "ready");
      if (out.ok) setCorrecting(visit.id, true);
      return out;
    });
  };
  const finish = () =>
    save(async () => {
      const out = await setStatus(visit.id, "seen");
      if (out.ok) {
        setCorrecting(visit.id, false);
        toast(t("supplies.correct.toast", { name }), { icon: "circle-check" });
      }
      return out;
    });

  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-labelledby={headId}
      onFocus={(event) => {
        focusWas.current = { line: (event.target as HTMLElement).closest("[data-line]")?.getAttribute("data-line") ?? null };
      }}
      onBlur={(event) => {
        // Focus taken somewhere else on purpose is not ours to bring back.
        if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget)) focusWas.current = null;
      }}
      style={{ display: "flex", flexDirection: "column", gap: 10, outline: "none" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <h3 id={headId} style={{ ...kicker, margin: 0 }}>
          {t("supplies.heading")}
        </h3>
        {!editable &&
          view.kits
            .filter((kit) => kit.added)
            .map((kit) => (
              <span key={kit.id} style={pill("var(--accent-soft)", "var(--accent)")}>
                {kit.name}
              </span>
            ))}
        {!editable && view.kits.length === 0 && [...new Set(view.lines.map((shown) => shown.kitName).filter((kit): kit is string => kit !== null))].map((kit) => <span key={kit} style={pill("var(--accent-soft)", "var(--accent)")}>{kit}</span>)}
      </div>

      {editable && offered.length > 0 && (
        <div role="group" aria-label={t("supplies.kits")} style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {offered.map((kit) => (
            <button
              key={kit.id}
              type="button"
              className="rh-chip rh-touch"
              aria-pressed={kit.added}
              aria-label={kit.added ? t("supplies.kitAdded", { name: kit.name }) : t("supplies.addKit", { name: kit.name })}
              disabled={busy || kit.added}
              onClick={() => pressKit(kit)}
              style={{ ...chipStyle(kit.added), ...(kit.added ? { cursor: "default" } : {}) }}
            >
              {!kit.added && <PackagePlus size={14} aria-hidden="true" />}
              {kit.name}
            </button>
          ))}
        </div>
      )}

      {view.lines.length === 0 ? (
        <p style={{ margin: 0, padding: "14px 12px", borderRadius: 13, border: "1px dashed var(--border-strong)", fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>{t("supplies.empty")}</p>
      ) : (
        <SuppliesList views={view.lines} edits={editable ? edits : undefined} busy={busy} />
      )}

      {mayAdd && <Picker kits={editable ? others : []} taken={view.lines.filter((shown) => shown.line.kit_id === null).map((shown) => shown.line.item_id)} busy={busy} onKit={pressKit} onItem={pickItem} />}

      {isBehind(entry) && (
        <Note tone="danger" icon={CircleAlert} role="alert">
          {t("supplies.behind")}{" "}
          <button type="button" className="rh-gi" onClick={() => void loadSupplies(visit.id)} style={{ ...btnGhostSm, height: 28, marginInlineStart: 6 }}>
            {t("supplies.readAgain")}
          </button>
        </Note>
      )}

      {failed !== null && (
        <Note tone="danger" icon={CircleAlert} role="alert">
          {failed.words}{" "}
          <button type="button" className="rh-gi" onClick={failed.retry} style={{ ...btnGhostSm, height: 28, marginInlineStart: 6 }}>
            {t("common.tryAgain")}
          </button>
        </Note>
      )}

      {seen && recordedBy !== null && (
        <Note tone="info" icon={Lock} style={{ background: "var(--surface-2)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}>
          {visit.seen_at === null ? t("supplies.recordedBy", { name: recordedBy }) : t("supplies.recorded", { name: recordedBy, day: dayShort(dayOf(visit.seen_at)), time: time(visit.seen_at) })}
        </Note>
      )}
      {!seen && !records && (
        <Note tone="info" icon={ClipboardList} style={{ background: "var(--surface-2)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}>
          {clinician === undefined ? t("supplies.readOnly") : t("supplies.readOnlyDesk", { name: clinician.short_name })}
        </Note>
      )}

      {visit.status === "ready" && moves && role !== "clinician" && !correcting && (
        <Btn icon={HandHeart} disabled={busy} style={{ ...btnPrimary, width: "100%", marginBlockStart: 4 }} onClick={() => openSheet({ kind: "sendOff", visitId: visit.id })}>
          {t("waiting.step.sendOff")}
        </Btn>
      )}
      {visit.status === "ready" && manager && records && correcting && (
        <Btn busy={busy} style={{ ...btnPrimary, width: "100%", marginBlockStart: 4 }} onClick={finish}>
          {t("supplies.correct.done")}
        </Btn>
      )}
      {seen && manager && records && moves && !asking && (
        <div ref={correctButton} style={{ display: "flex" }}>
          <Btn kind="ghost" icon={Undo2} disabled={busy} style={{ ...btnGhost, width: "100%", marginBlockStart: 4 }} onClick={() => setAsking(true)}>
            {t("supplies.correct")}
          </Btn>
        </div>
      )}
      {asking && (
        <div
          ref={question}
          role="alertdialog"
          aria-label={t("supplies.correct.title")}
          data-keeps-escape
          onKeyDown={(event) => {
            // Escape answers the question, not the whole panel.
            if (event.key !== "Escape") return;
            event.stopPropagation();
            stopAsking();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <strong style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.02em" }}>{t("supplies.correct.title")}</strong>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("supplies.correct.body", { name })}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn busy={busy} style={{ ...btnPrimary, height: 36 }} onClick={takeBack}>
              {t("supplies.correct.confirm")}
            </Btn>
            <Btn kind="ghost" disabled={busy} style={{ ...btnGhost, height: 36 }} onClick={stopAsking}>
              {t("common.cancel")}
            </Btn>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * "Supplies used" on the send-off sheet: what the clinician recorded, for the
 * person at the desk to see before they send the patient off. Read-only, and
 * silent while it loads or when it cannot be read: the sheet is about money
 * and the recall, and nothing about supplies may stand in its way.
 */
export function SuppliesSection({ visit }: { visit: Appointment }) {
  const { t } = useI18n();
  const entry = useVisitSupplies(visit.id);
  const headId = useId();
  const view = entry?.view ?? null;
  if (view === null) return null;
  const kits = [...new Set(view.lines.map((shown) => shown.kitName).filter((kit): kit is string => kit !== null))];
  return (
    <section aria-labelledby={headId} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <h3 id={headId} style={{ ...kicker, margin: 0 }}>
          {t("supplies.heading")}
        </h3>
        {kits.map((kit) => (
          <span key={kit} style={pill("var(--accent-soft)", "var(--accent)")}>
            {kit}
          </span>
        ))}
      </div>
      {view.lines.length === 0 ? (
        <p style={{ margin: 0, padding: "14px 12px", borderRadius: 13, border: "1px dashed var(--border-strong)", fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>{t("supplies.empty")}</p>
      ) : (
        <SuppliesList views={view.lines} />
      )}
    </section>
  );
}

/**
 * "Add an item": a search of the stock list (and of the kits not offered for
 * this visit's type). A real list of buttons under the field: Down moves into
 * it, Up and Down through it, Escape back to the field; a line only screen
 * readers hear says how many were found.
 */
function Picker({ kits, taken, busy, onKit, onItem }: { kits: readonly KitOffer[]; taken: readonly (Id | null)[]; busy: boolean; onKit: (kit: KitOffer) => void; onItem: (item: StockItem) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StockItem[] | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const listId = useId();
  const typed = q.trim();
  // Closed again (a pick, Cancel, Escape): the focus goes back to "Add an item", never out of the panel.
  useEffect(() => {
    if (wasOpen.current && !open) opener.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => {
      const port = suppliesPort();
      if (port === null) return;
      port
        .searchItems(typed)
        .then((found) => live && setHits(found))
        .catch((error: unknown) => {
          if (error instanceof SuppliesGone) forgetAddOn("inventory");
          else if (live) setHits([]);
        });
    }, WAIT_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, typed]);

  if (!open) {
    return (
      <button
        ref={opener}
        type="button"
        className="rh-gi"
        disabled={busy}
        onClick={() => {
          setOpen(true);
          setTimeout(() => field.current?.focus(), 0);
        }}
        style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 36, paddingInline: 14, borderRadius: 10, border: "1.5px dashed var(--border-strong)", background: "var(--surface)", color: "var(--fg)", fontSize: 12.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        <Plus size={15} aria-hidden="true" />
        {t("supplies.addItem")}
      </button>
    );
  }

  const close = () => {
    setOpen(false);
    setQ("");
    setHits(null);
  };
  const fits = (name: string) => typed === "" || name.toLowerCase().includes(typed.toLowerCase());
  const kitHits = kits.filter((kit) => fits(kit.name));
  const itemHits = (hits ?? []).filter((item) => !taken.includes(item.id));
  const total = kitHits.length + itemHits.length;
  const buttons = () => [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
  const onKey = (event: KeyboardEvent) => {
    const all = buttons();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      // Back to the field first; from the field, it closes the picker — never the whole panel.
      event.stopPropagation();
      if (at >= 0) field.current?.focus();
      else close();
    } else if (event.key === "ArrowDown" && all.length > 0) {
      event.preventDefault();
      all[Math.min(at + 1, all.length - 1)]?.focus();
    } else if (event.key === "ArrowUp" && at >= 0) {
      event.preventDefault();
      if (at === 0) field.current?.focus();
      else all[at - 1]?.focus();
    }
  };
  const row = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", border: "none", background: "var(--surface)", cursor: "pointer", textAlign: "start" } as const;

  return (
    <div data-keeps-escape onKeyDown={onKey} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelText}>{t("supplies.addItem")}</span>
        <input ref={field} className="rh-fld" value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("supplies.search")} aria-controls={listId} autoComplete="off" style={fieldStyle()} />
      </label>
      <span role="status" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
        {hits === null ? "" : total === 0 ? t("supplies.noMatch") : t("supplies.matches", { n: num(total) })}
      </span>
      {total > 0 && (
        <div ref={list} id={listId} style={{ display: "flex", flexDirection: "column", borderRadius: 11, border: "1px solid var(--border)", background: "var(--surface)", overflow: "hidden", maxHeight: 264, overflowY: "auto" }}>
          {kitHits.map((kit, index) => (
            <button
              key={`kit-${String(kit.id)}`}
              type="button"
              className="rh-row"
              disabled={busy}
              aria-label={t("supplies.addKit", { name: kit.name })}
              onClick={() => {
                onKit(kit);
                close();
              }}
              style={{ ...row, ...(index === 0 ? {} : { borderBlockStart: "1px solid var(--border)" }) }}
            >
              <PackagePlus size={14} aria-hidden="true" style={{ flexShrink: 0, color: "var(--accent)" }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, letterSpacing: "-.015em", color: "var(--fg)" }}>{kit.name}</span>
              <span style={{ ...monoText(11.5, "var(--fg-subtle)"), whiteSpace: "nowrap" }}>{num(kit.lines.length)}</span>
            </button>
          ))}
          {itemHits.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="rh-row"
              disabled={busy}
              onClick={() => {
                onItem(item);
                close();
              }}
              style={{ ...row, ...(index === 0 && kitHits.length === 0 ? {} : { borderBlockStart: "1px solid var(--border)" }) }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, letterSpacing: "-.015em", color: "var(--fg)" }}>{item.name}</span>
              <span style={{ ...monoText(11.5, "var(--fg-subtle)"), whiteSpace: "nowrap" }}>{t("supplies.qty", { qty: num(1), unit: item.unit }).trim()}</span>
            </button>
          ))}
        </div>
      )}
      {hits !== null && total === 0 && <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)", textWrap: "pretty" }}>{t("supplies.noMatch")}</p>}
      <button type="button" className="rh-gi" onClick={close} style={{ ...btnGhostSm, alignSelf: "flex-start", height: 36 }}>
        {t("common.cancel")}
      </button>
    </div>
  );
}
