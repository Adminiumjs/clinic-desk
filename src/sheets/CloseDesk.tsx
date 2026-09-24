/**
 * Close the desk for today: mark the people who never came as no-shows,
 * count the cash against what the day's payments say was taken in cash, and
 * leave a note for the morning.
 *
 * Everyone booked today whose no-show window has passed is listed, ticked;
 * untick anyone who rang or is on their way. A day closes once: if another
 * desk closed it first, the sheet says so instead of saving a second close.
 */
import { useState } from "react";
import { Check, CircleAlert, Info, MoonStar } from "lucide-react";

import { useI18n } from "../i18n/index.tsx";
import { dayLong, dayOf, money, time } from "../lib/format.ts";
import { useNow } from "../lib/useNow.ts";
import { visitName, visitsOn } from "../lib/desk.ts";
import { closeDesk } from "../state/actions.ts";
import { useDesk } from "../state/desk.ts";
import { toast, type Sheet as SheetKind } from "../state/ui.ts";
import { Btn, Sheet, fieldStyle, mono, monoPill } from "../components/ui.tsx";
import { parseAmount } from "./bits/logic.ts";
import { Note, TickBox, areaStyle, labelText, useRefusal, useSaving } from "./bits/ui.tsx";

export default function CloseDesk({ onClose }: { sheet: Extract<SheetKind, { kind: "closeDesk" }>; onClose: () => void }) {
  const { t } = useI18n();
  const nowMs = useNow();
  const today = dayOf(nowMs);
  const desk = useDesk();
  const refusal = useRefusal();
  const { busy, run } = useSaving();

  const [unticked, setUnticked] = useState<Record<number, true>>({});
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const noShowWindow = (desk.settings?.no_show_minutes ?? 15) * 60_000;
  // Booked, and the no-show window after their start has passed: they never arrived.
  const never = visitsOn(desk, today).filter((v) => v.status === "booked" && Date.parse(v.starts_at) + noShowWindow < nowMs);
  const closed = Object.values(desk.dayCloses).find((c) => c.day === today);
  const cash = Object.values(desk.payments)
    .filter((p) => !p.voided && p.method === "cash" && dayOf(p.paid_at) === today)
    .reduce((sum, p) => sum + p.amount, 0);
  const count = parseAmount(counted);
  const diff = count === null ? null : Math.round((count - cash) * 100) / 100;

  const close = async () => {
    setError(null);
    const noShows = never.filter((v) => unticked[v.id] !== true).map((v) => v.id);
    const outcome = await run(() => closeDesk({ day: today, noShows, cashExpected: cash, cashCounted: count, note: note.trim() === "" ? null : note.trim() }));
    if (outcome === null) return;
    if (!outcome.ok) return setError(outcome.reason === "duplicate" ? t("closeDesk.already") : refusal(outcome.reason));
    const marked = noShows.length;
    toast(marked > 0 ? `${t("closeDesk.toast")} ${t("closeDesk.toastMarked", { count: marked }, marked)}` : t("closeDesk.toast"), { icon: "moon-star", tone: "pos" });
    onClose();
  };

  return (
    <Sheet icon={MoonStar} title={t("closeDesk.title")} sub={dayLong(today)} onClose={onClose}>
      {closed !== undefined ? (
        <Note tone="info" icon={Info} role="status">
          {t("closeDesk.alreadyAt", { time: time(closed.closed_at), who: closed.closed_by ?? "" })}
        </Note>
      ) : (
        <>
          <section aria-labelledby="eod-na" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {never.length > 0 ? (
              <>
                <h3 id="eod-na" style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: "-.02em" }}>
                  {t("closeDesk.never", { count: never.length }, never.length)}
                </h3>
                {never.map((v) => {
                  const on = unticked[v.id] !== true;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className="rh-row"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() =>
                        setUnticked((m) => {
                          const next = { ...m };
                          if (on) next[v.id] = true;
                          else delete next[v.id];
                          return next;
                        })
                      }
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: 9, borderRadius: 11, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "start" }}
                    >
                      <TickBox on={on} />
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--fg)" }}>{visitName(desk, v)}</span>
                        <span style={{ ...mono(11, 600, "var(--fg-subtle)"), whiteSpace: "normal", alignSelf: "flex-start" }}>
                          {[desk.clinicians.find((c) => c.id === v.clinician_id)?.short_name ?? "", time(v.starts_at), v.ref].filter((x) => x !== "").join(" · ")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                <h3 id="eod-na" className="rh-sr-only">
                  {t("closeDesk.noShowsTitle")}
                </h3>
                <Note tone="pos" icon={Check} style={{ alignItems: "center", fontWeight: 800 }}>
                  {t("closeDesk.everybody")}
                </Note>
              </>
            )}
          </section>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 13, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--fg-muted)" }}>{t("closeDesk.cashTaken")}</span>
              <span style={mono(15, 600, "var(--fg)")}>{money(cash)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <label style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={labelText}>{t("closeDesk.counted")}</span>
                <input className="rh-fld" value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" placeholder="0" aria-describedby={diff !== null ? "eod-diff" : undefined} style={fieldStyle(true)} />
              </label>
              {diff !== null && (
                <span id="eod-diff" role="status" style={{ ...monoPill(diff === 0 ? "var(--pos-soft)" : "var(--warn-soft)", diff === 0 ? "var(--pos)" : "var(--warn)"), height: 40 }}>
                  {diff === 0 ? t("closeDesk.matches") : diff > 0 ? t("closeDesk.over", { amount: money(diff) }) : t("closeDesk.short", { amount: money(-diff) })}
                </span>
              )}
            </div>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={labelText}>{t("closeDesk.note")}</span>
            <textarea className="rh-fld" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("closeDesk.notePlaceholder")} style={areaStyle} />
          </label>

          {error !== null && (
            <Note tone="danger" icon={CircleAlert} role="alert">
              {error}
            </Note>
          )}
          <Btn icon={MoonStar} busy={busy} onClick={() => void close()} style={{ width: "100%" }}>
            {t("closeDesk.title")}
          </Btn>
        </>
      )}
    </Sheet>
  );
}
