/**
 * Accounts: what came in today, what is still owed and how old it is, what
 * was written off this month, and what each kind of visit costs.
 *
 * Every figure is the server's: payments as saved (voided ones left out),
 * balances as the server settled them after each payment or write-off. The
 * desk holds the seen visits still owing, oldest first; when there are more
 * than it read, the screen says so rather than passing the partial sum off as
 * the total.
 */
import { useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Banknote, ClockAlert, Receipt, UserRoundX } from "lucide-react";

import type { Appointment } from "../data/types.ts";
import { addDays } from "../data/venueTime.ts";
import { useI18n } from "../i18n/index.tsx";
import { today } from "../lib/clock.ts";
import { dayOf, daysBetween, num } from "../lib/format.ts";
import { typeOf, visitName, weekdayOf } from "../lib/desk.ts";
import { ensureDays, useCan, useDesk } from "../state/desk.ts";
import { useDemoSignal } from "../state/demoSignal.ts";
import { openSheet } from "../state/ui.ts";
import { Dot, Tile, btnGhostSm, mono, monoPill, pill } from "../components/ui.tsx";
import { amountText, half } from "../sheets/deskwork/money.ts";
import { METHODS } from "../sheets/RecordPayment.tsx";
import { counted, dayMonthNear } from "./deskwork/dates.ts";
import { Screen, ScreenHead, cardStyle, sectionTitle } from "./deskwork/parts.tsx";
import { useNarrow } from "./deskwork/useNarrow.ts";

const TONES = { pos: ["var(--pos-soft)", "var(--pos)"], warn: ["var(--warn-soft)", "var(--warn)"], fg: ["var(--surface-3)", "var(--fg-muted)"] } as const;
const BUCKETS = [
  { id: "week", key: "accounts.bucket.week", lo: 0, hi: 7 },
  { id: "month", key: "accounts.bucket.month", lo: 8, hi: 30 },
  { id: "older", key: "accounts.bucket.older", lo: 31, hi: Infinity },
] as const;

/** The Monday of a day's week. */
function mondayOf(day: string): string {
  const back = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }[weekdayOf(day)];
  return addDays(day, -back);
}

export default function Accounts() {
  const { t } = useI18n();
  const day = today();
  const desk = useDesk();
  const narrow = useNarrow();
  const canPay = useCan("payments", "create");
  const canWriteOff = useCan("write_offs", "create");
  const monday = mondayOf(day);

  // This week's no-shows need this week's days read (the desk opens with today's).
  useEffect(() => {
    void ensureDays(monday, daysBetween(monday, day) + 1).catch(() => undefined);
  }, [monday, day]);

  const bills = useMemo(
    () => Object.values(desk.visits).filter((v) => v.status === "seen" && v.balance > 0).sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id - b.id),
    [desk.visits],
  );
  const paidToday = Object.values(desk.payments).filter((p) => !p.voided && dayOf(p.paid_at) === day);
  const taken = paidToday.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = bills.reduce((sum, v) => sum + v.balance, 0);
  const noShows = Object.values(desk.visits).filter((v) => v.status === "no_show" && dayOf(v.starts_at) >= monday && dayOf(v.starts_at) <= day).length;
  const month = day.slice(0, 7);
  const writtenOff = Object.values(desk.writeOffs)
    .filter((w) => dayOf(w.written_at).slice(0, 7) === month)
    .reduce((sum, w) => sum + w.amount, 0);
  const byMethod = METHODS.map((m) => ({ ...m, amount: paidToday.filter((p) => p.method === m.id).reduce((sum, p) => sum + p.amount, 0) }));
  const methodTotal = byMethod.reduce((sum, m) => sum + m.amount, 0);
  const fees = [...desk.visitTypes].filter((v) => v.active).sort((a, b) => a.position - b.position);

  // The card's "Part payment": the oldest bill, half of it, in cash.
  useDemoSignal("accounts.partPayment", () => {
    const oldest = bills[0];
    // INTEGRATOR: `method` joins the payment sheet's shape (state/ui.ts); RecordPayment reads it already.
    if (oldest !== undefined) openSheet({ kind: "payment", visitId: oldest.id, amount: half(oldest.balance), ...({ method: "cash" } as object) });
  });

  const kpis: { id: string; icon: LucideIcon; label: string; value: string; tone: keyof typeof TONES }[] = [
    { id: "t", icon: Banknote, label: t("accounts.kpi.taken"), value: amountText(taken), tone: "pos" },
    { id: "o", icon: ClockAlert, label: t("accounts.kpi.outstanding"), value: desk.owingMore ? t("accounts.atLeast", { amount: amountText(outstanding) }) : amountText(outstanding), tone: "warn" },
    { id: "n", icon: UserRoundX, label: t("accounts.kpi.noShows"), value: num(noShows), tone: "fg" },
  ];

  return (
    <Screen name="Accounts">
      <ScreenHead kicker={t("nav.accounts")} title={t("accounts.title")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 11 }}>
        {kpis.map((k) => (
          <div key={k.id} style={{ padding: 15, borderRadius: 15, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true" style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: TONES[k.tone][0], color: TONES[k.tone][1] }}>
                <k.icon size={14} />
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".02em", color: "var(--fg-subtle)" }}>{k.label}</span>
            </div>
            <div style={{ marginBlockStart: 10, ...mono(23, 600, "var(--fg)") }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
        <section aria-labelledby="ac-owed" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <h2 id="ac-owed" style={sectionTitle}>
              {t("accounts.outstanding")}
            </h2>
            <span style={pill("var(--surface-3)", "var(--fg-subtle)")}>{t("accounts.oldest")}</span>
          </div>
          <ul style={{ listStyle: "none", margin: "13px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            {bills.map((b) => (
              <li key={b.id}>
                <Bill visit={b} canPay={canPay} canWriteOff={canWriteOff} />
              </li>
            ))}
          </ul>
          {bills.length === 0 && (
            <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, padding: 18, borderRadius: 13, background: "var(--pos-soft)", color: "var(--pos)", fontSize: 13.5, fontWeight: 800 }}>
              <BadgeCheck size={17} aria-hidden="true" />
              {t("accounts.clear")}
            </div>
          )}
          {desk.owingMore && <p style={{ margin: "12px 0 0", fontSize: 12.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-muted)" }}>{t("accounts.more")}</p>}
        </section>

        <section style={{ ...cardStyle, alignSelf: "start", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <h2 style={sectionTitle}>{t("accounts.byMethod")}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBlockStart: 13 }}>
              {byMethod.map((m) => {
                const pct = methodTotal > 0 ? Math.round((m.amount / methodTotal) * 100) : 0;
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <m.icon size={14} aria-hidden="true" style={{ color: "var(--fg-subtle)", flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 58 }}>{t(m.key)}</span>
                    <span aria-hidden="true" style={{ flex: 1, minWidth: 60, height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${String(pct)}%`, borderRadius: 3, background: "var(--accent)" }} />
                    </span>
                    <span style={mono(13.5, 600, "var(--fg)")}>{amountText(m.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ paddingBlockStart: 16, borderBlockStart: "1px solid var(--border)" }}>
            <h2 style={sectionTitle}>{t("accounts.howOld")}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBlockStart: 13 }}>
              {BUCKETS.map((bucket) => {
                const inIt = bills.filter((v) => {
                  const age = Math.abs(daysBetween(dayOf(v.starts_at), day));
                  return age >= bucket.lo && age <= bucket.hi;
                });
                const sum = inIt.reduce((s, v) => s + v.balance, 0);
                return (
                  <div key={bucket.id} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)", textWrap: "pretty" }}>{t(bucket.key)}</span>
                    <span style={mono(11, 600, "var(--fg-subtle)")}>{t("accounts.visits", counted(inIt.length), inIt.length)}</span>
                    <span style={mono(15, 600, bucket.id === "older" && sum > 0 ? "var(--danger)" : "var(--fg)")}>{amountText(sum)}</span>
                  </div>
                );
              })}
              {writtenOff > 0 && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, paddingBlockStart: 10, borderBlockStart: "1px solid var(--border)" }}>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "var(--fg-muted)" }}>{t("accounts.writtenOff")}</span>
                  <span style={mono(15, 600, "var(--fg)")}>{amountText(writtenOff)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, alignSelf: "start" }}>
          <h2 style={sectionTitle}>{t("accounts.fees")}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBlockStart: 13 }}>
            {fees.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingBlockEnd: 9, borderBlockEnd: "1px solid var(--border)" }}>
                <Dot color={f.color} size={9} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, letterSpacing: "-.015em", textWrap: "pretty" }}>{f.name}</span>
                <span style={mono(11.5, 600, "var(--fg-subtle)")}>{t("accounts.minutes", counted(f.minutes), f.minutes)}</span>
                <span style={mono(13.5, 600, "var(--fg)")}>{amountText(f.fee)}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: "13px 0 0", fontSize: 11.5, fontWeight: 600, lineHeight: 1.55, color: "var(--fg-subtle)", textWrap: "pretty" }}>{t("accounts.payNote")}</p>
        </section>
      </div>
    </Screen>
  );
}

function Bill({ visit: b, canPay, canWriteOff }: { visit: Appointment; canPay: boolean; canWriteOff: boolean }) {
  const { t } = useI18n();
  const desk = useDesk();
  const day = today();
  const name = visitName(desk, b);
  const type = typeOf(desk, b.visit_type_id);
  const age = Math.abs(daysBetween(dayOf(b.starts_at), day));
  const old = age >= 30;
  return (
    <div className="rh-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "13px 14px", borderRadius: 13, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
      <Tile name={name} color={type?.color ?? "#0369a1"} size={34} />
      <span style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-.022em" }}>{name}</span>
        <span style={{ ...mono(11.5, 600, "var(--fg-subtle)"), whiteSpace: "normal" }}>{[b.reason ?? type?.name, dayMonthNear(dayOf(b.starts_at), day), b.ref].filter(Boolean).join(" · ")}</span>
      </span>
      <span style={monoPill(old ? "var(--danger-soft)" : "var(--surface-3)", old ? "var(--danger)" : "var(--fg-muted)")}>{t("accounts.days", counted(age), age)}</span>
      <span style={mono(14, 600, "var(--fg)")}>{amountText(b.balance)}</span>
      {canPay && (
        <button type="button" className="rh-btn" onClick={() => openSheet({ kind: "payment", visitId: b.id })} aria-label={t("accounts.recordFor", { name })} style={{ ...btnGhostSm, height: 36 }}>
          <Receipt size={14} aria-hidden="true" />
          {t("accounts.record")}
        </button>
      )}
      {canWriteOff && (
        <button type="button" className="rh-btn" onClick={() => openSheet({ kind: "writeOff", visitId: b.id })} aria-label={t("accounts.writeOffFor", { name })} style={{ ...btnGhostSm, height: 36, color: "var(--fg-muted)" }}>
          {t("accounts.writeOff")}
        </button>
      )}
    </div>
  );
}
