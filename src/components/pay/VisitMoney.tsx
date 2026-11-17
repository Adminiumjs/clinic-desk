/**
 * What the visit panel says of money paid online, once the practice takes
 * payments (or such money is still here to account for):
 *
 *   - "Paid ahead · Online · {service}" on a visit paid for as it was booked,
 *     "Online · {service}" on one paid online after it — the service as
 *     Adminium wrote it on the payment, never a name this app holds;
 *   - "Refund owed: {amount}" on a cancelled or missed visit still holding
 *     money paid online, with "Refund" for someone who may give it back
 *     (Adminium's own two steps, drawn by its kit); "Refunded" once it went;
 *   - "Copy pay link" on a seen visit with something still to pay.
 *
 * A visit paid ahead and cancelled in time is refunded by itself when the
 * practice says so; a no-show, a late cancel, or a cancel by someone who may
 * not refund leaves it owed, and a person decides. The panel shows whichever
 * is true, read from the visit's own totals.
 */
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CircleDollarSign, Globe, Undo2 } from "lucide-react";

import type { Appointment, Payment } from "../../data/types.ts";
import type { RefundTold } from "../../data/ports.ts";
import { useI18n } from "../../i18n/index.tsx";
import { dayOf, dayShort, money } from "../../lib/format.ts";
import { visitName } from "../../lib/desk.ts";
import { deskReads, upsert, useDesk } from "../../state/desk.ts";
import { useDeskPay } from "../../state/deskPay.ts";
import { openSheet } from "../../state/ui.ts";
import { Btn, btnGhost, mono, pill } from "../ui.tsx";
import { KitPart } from "./KitPart.tsx";

/** The visit's payments the desk holds, online ones first. */
export function useVisitPayments(visitId: number): Payment[] {
  const all = useDesk((s) => s.payments);
  return useMemo(() => Object.values(all).filter((p) => p.appointment_id === visitId), [all, visitId]);
}

/**
 * Read the visit's payments (the desk holds only today's): how each was paid,
 * and the online ones' service — only where online money may be in it, so a
 * desk that takes no payments online asks nothing new.
 */
export function useReadVisitPayments(visit: Pick<Appointment, "id" | "paid" | "refunded" | "paid_online">): void {
  const on = useDeskPay((s) => s.on);
  const { id, paid, refunded } = visit;
  const wanted = on || (visit.paid_online ?? 0) > 0 || (visit.refunded ?? 0) > 0;
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    void deskReads()
      .visitPayments([id])
      .then((rows) => {
        if (live) for (const row of rows) upsert("payments", row);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [id, paid, refunded, wanted]);
}

/** Money paid online and still held by a visit that will not happen: owed back, for a person to decide. */
export const owedBack = (visit: Pick<Appointment, "status" | "paid_online">): number =>
  (visit.status === "cancelled" || visit.status === "no_show") && (visit.paid_online ?? 0) > 0 ? visit.paid_online : 0;

/** "Paid ahead · Online · Stripe" / "Online · PayPal": what a visit's online money says of itself. */
export function OnlineChip({ visit, payments }: { visit: Pick<Appointment, "status">; payments: readonly Payment[] }) {
  const { t } = useI18n();
  const online = payments.filter((p) => p.method === "online" && !p.voided);
  if (online.length === 0) return null;
  const provider = online.find((p) => p.provider !== null && p.provider !== "")?.provider ?? null;
  // A visit not seen yet was paid before it: paid ahead.
  const ahead = visit.status !== "seen";
  const label = ahead ? (provider === null ? t("deskPay.paidAhead") : t("deskPay.paidAheadVia", { provider })) : provider === null ? t("deskPay.online") : t("deskPay.onlineVia", { provider });
  return (
    <span style={pill("var(--accent-soft)", "var(--accent)")}>
      <Globe size={11} aria-hidden="true" />
      {label}
    </span>
  );
}

/** "Refund owed: £45.00", or "Refunded" once it went. */
export function OwedBadge({ visit }: { visit: Pick<Appointment, "status" | "paid_online" | "refunded"> }) {
  const { t } = useI18n();
  const owed = owedBack(visit);
  if (owed > 0) {
    return (
      <span style={pill("var(--warn-soft)", "var(--warn)")}>
        <CircleDollarSign size={11} aria-hidden="true" />
        <span>
          {t("deskPay.refundOwed", { amount: "" }).trim()} <span style={mono(11.5, 600, "var(--warn)")}>{money(owed)}</span>
        </span>
      </span>
    );
  }
  if ((visit.status === "cancelled" || visit.status === "no_show") && (visit.refunded ?? 0) > 0) {
    return (
      <span style={pill("var(--pos-soft)", "var(--pos)")}>
        <BadgeCheck size={11} aria-hidden="true" />
        {t("deskPay.refunded")}
      </span>
    );
  }
  return null;
}

/** Why the money is owed: who cancelled it and when, or the no-show. */
export function OwedWhy({ visit }: { visit: Appointment }) {
  const { t } = useI18n();
  if (owedBack(visit) <= 0 && (visit.refunded ?? 0) <= 0) return null;
  const at = visit.cancelled_at ?? visit.starts_at;
  const day = dayShort(dayOf(at));
  const line =
    visit.status === "no_show" ? t("deskPay.noShowOn", { day }) : visit.cancelled_by === "patient" ? t("deskPay.cancelledByPatient", { day }) : visit.status === "cancelled" ? t("deskPay.cancelledByDesk", { day }) : null;
  if (line === null) return null;
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>{line}</span>;
}

/**
 * Who gave the money back, and why: "Refunded by Ruth Okonjo · Requested by
 * customer", or "Refunded automatically" — one line per refund that went
 * through, as Adminium's payment panel tells it to someone who may see it.
 * Nothing at all where it says nothing (a reader who may not see payments,
 * or the website's demo).
 */
export function RefundsTold({ visit }: { visit: Pick<Appointment, "id" | "refunded"> }) {
  const { t } = useI18n();
  const [told, setTold] = useState<RefundTold[]>([]);
  const refunded = visit.refunded ?? 0;
  useEffect(() => {
    const read = deskReads().refundsTold;
    if (refunded <= 0 || read === undefined) {
      setTold([]);
      return;
    }
    let live = true;
    void read(visit.id)
      .then((list) => {
        if (live) setTold(list);
      })
      .catch(() => {
        if (live) setTold([]);
      });
    return () => {
      live = false;
    };
  }, [visit.id, refunded]);
  if (told.length === 0) return null;
  return (
    <>
      {told.map((refund, i) => {
        const who = refund.by === null ? t("deskPay.refundedAuto") : t("deskPay.refundedBy", { name: refund.by });
        const line = refund.reason === null || refund.by === null ? who : `${who} · ${t(`deskPay.reason.${refund.reason}`)}`;
        return (
          <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--fg-subtle)" }}>
            {line}
          </span>
        );
      })}
    </>
  );
}

/** The panel's "Refund" (for someone who may) and "Copy pay link" (on a seen visit still owing, while patients can pay online). */
export function MoneyActions({ visit }: { visit: Appointment }) {
  const { t } = useI18n();
  const pay = useDeskPay();
  const payments = useVisitPayments(visit.id);
  const refundable = payments.some((p) => p.method === "online" && !p.voided && p.payment_ref !== null && (p.kept ?? p.amount) > 0);
  const owed = owedBack(visit);
  const out: React.ReactNode[] = [];
  if (owed > 0 && pay.refund && pay.kit !== null && refundable) {
    out.push(
      <Btn key="refund" kind="ghost" icon={Undo2} onClick={() => openSheet({ kind: "refund", visitId: visit.id })} style={{ ...btnGhost, width: "100%" }}>
        {t("deskPay.refund")}
      </Btn>,
    );
  }
  if (visit.status === "seen" && visit.balance > 0 && pay.online && pay.connectionId !== null && pay.visitsTable !== null) {
    out.push(
      <KitPart
        key="pay-link"
        part="pay-link"
        props={{ payable: { kind: "profile", connectionId: pay.connectionId, tableName: pay.visitsTable, rowKey: String(visit.id) } }}
      />,
    );
  }
  return <>{out}</>;
}

/** The refund itself: Adminium's two steps for each online payment the visit still holds. */
export function RefundSheet({ visitId, onClose }: { visitId: number; onClose: () => void }) {
  const { t } = useI18n();
  const visit = useDesk((s) => s.visits[visitId]);
  const name = useDesk((s) => (visit === undefined ? "" : visitName(s, visit)));
  const payments = useVisitPayments(visitId).filter((p) => p.method === "online" && !p.voided && p.payment_ref !== null && (p.kept ?? p.amount) > 0);
  if (visit === undefined) return null;
  const reread = async () => {
    for (const row of await deskReads().visits([visitId]).catch(() => [])) upsert("appointments", row);
    for (const row of await deskReads().visitPayments([visitId]).catch(() => [])) upsert("payments", row);
  };
  return (
    <RefundDialog title={t("deskPay.refundFor", { amount: money(owedBack(visit) || visit.paid_online), name })} onClose={onClose}>
      {payments.map((p) => (
        <div key={p.id} style={{ marginBlockStart: 14 }}>
          <KitPart part="refund" props={{ attemptId: p.payment_ref, onRefunded: () => void reread() }} />
        </div>
      ))}
    </RefundDialog>
  );
}

import { Dialog } from "../ui.tsx";

function RefundDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog icon={Undo2} tone="warn" title={title} onClose={onClose} closeButton width={480}>
      {children}
    </Dialog>
  );
}
