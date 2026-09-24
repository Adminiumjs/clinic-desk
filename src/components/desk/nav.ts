/**
 * The desk's sidebar: its twelve screens in the design's order, each with the
 * table it reads, its icon, and the count beside it.
 *
 * An item shows when the signed-in person may read what the screen shows
 * (their role's grants, as the server sent them). A clinician sees the day
 * sheet, the waiting room and the patients, and nothing else — the week,
 * money, recalls and the desk's own running are the front desk's. Desk
 * settings shows only to someone who may change them. The Arrivals kiosk is
 * not here at all: only the kiosk's own sign-in reaches it.
 */
import { outboxWaiting } from "../../lib/outbox.ts";
import type { LucideIcon } from "lucide-react";
import { Armchair, BellRing, CalendarDays, CalendarRange, Clock, Inbox, ListOrdered, MoonStar, Send, Settings2, Users, Wallet } from "lucide-react";

import type { Appointment, Day, DeskRole, DeskView, TableRef } from "../../data/types.ts";
import type { MessageKey } from "../../i18n/index.tsx";
import type { StaffAccess, TableAction } from "../../staffConnection.ts";
import type { DeskState } from "../../state/desk.ts";
import { dayOf } from "../../lib/format.ts";
import { owes } from "../../lib/desk.ts";
import { inBuilding, standing } from "../../screens/daysheet/model.ts";

export interface NavItem {
  view: Exclude<DeskView, "notfound">;
  labelKey: MessageKey;
  icon: LucideIcon;
  /** What the person must be allowed to do for the item to show. */
  needs: [TableRef, TableAction];
}

export const NAV: readonly NavItem[] = [
  { view: "daysheet", labelKey: "nav.daysheet", icon: CalendarDays, needs: ["appointments", "read"] },
  { view: "waiting", labelKey: "nav.waiting", icon: Armchair, needs: ["appointments", "read"] },
  { view: "patients", labelKey: "nav.patients", icon: Users, needs: ["patients", "read"] },
  { view: "registrations", labelKey: "nav.registrations", icon: Inbox, needs: ["registrations", "read"] },
  { view: "week", labelKey: "nav.week", icon: CalendarRange, needs: ["appointments", "read"] },
  { view: "waitlist", labelKey: "nav.waitlist", icon: ListOrdered, needs: ["waiting_list", "read"] },
  { view: "accounts", labelKey: "nav.accounts", icon: Wallet, needs: ["payments", "read"] },
  { view: "recalls", labelKey: "nav.recalls", icon: BellRing, needs: ["recalls", "read"] },
  { view: "hours", labelKey: "nav.hours", icon: Clock, needs: ["opening_hours", "read"] },
  { view: "outbox", labelKey: "nav.outbox", icon: Send, needs: ["messages", "read"] },
  { view: "endofday", labelKey: "nav.endofday", icon: MoonStar, needs: ["day_closes", "read"] },
  { view: "settings", labelKey: "nav.settings", icon: Settings2, needs: ["settings", "update"] },
];

/** The screens a clinician works from. */
const CLINICIAN_VIEWS: readonly DeskView[] = ["daysheet", "waiting", "patients"];

/** The items this person sees. With no word from the server on what they may do, every item shows. */
export function visibleNav(access: StaffAccess | null, role: DeskRole | null): NavItem[] {
  return NAV.filter((item) => {
    if (role === "clinician" && !CLINICIAN_VIEWS.includes(item.view)) return false;
    if (access === null) return true;
    const [table, action] = item.needs;
    return (access.tables[table] ?? []).includes(action);
  });
}

/** The count beside each item; an item without one shows none. */
export function navCounts(s: DeskState, today: Day, now: number): Partial<Record<DeskView, number>> {
  const all = Object.values(s.visits);
  const todays: Appointment[] = standing(all.filter((v) => dayOf(v.starts_at) === today));
  return {
    daysheet: todays.length,
    waiting: todays.filter(inBuilding).length,
    registrations:
      Object.values(s.registrations).filter((r) => r.status === "new").length + all.filter((v) => v.check_status === "to_check" && v.status !== "cancelled").length,
    waitlist: Object.values(s.waiting).filter((w) => w.status === "waiting").length,
    accounts: all.filter(owes).length,
    recalls: Object.values(s.recalls).filter((r) => (r.status === "due" || r.status === "noted") && r.due_on < today).length,
    outbox: outboxWaiting(s, now),
  };
}
