/**
 * A visit's steps through the day, as the waiting room, the "hasn't arrived"
 * list and the visit panel all take them: check in, into a room, in with the
 * clinician, ready to go, or never came. Each saves, then says what happened
 * in a toast — or, when the practice refuses, why.
 */
import type { Appointment } from "../../data/types.ts";
import type { TFunction } from "../../i18n/index.tsx";
import { time } from "../../lib/format.ts";
import { now } from "../../lib/clock.ts";
import { setStatus, type Outcome } from "../../state/actions.ts";
import { closePanel, toast } from "../../state/ui.ts";
import { NEXT } from "../../screens/daysheet/model.ts";

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

function refused(out: Outcome<unknown>, t: TFunction): boolean {
  if (out.ok) return false;
  toast(t(`refusal.${out.reason}`), { icon: out.reason === "offline" ? "wifi-off" : "circle-alert", tone: "danger" });
  return true;
}

export async function checkInVisit(visit: Appointment, name: string, t: TFunction): Promise<boolean> {
  const out = await setStatus(visit.id, "checked_in");
  if (refused(out, t)) return false;
  closePanel();
  toast(t("move.toast.checkedIn", { name: firstName(name), time: time(now()) }), { icon: "log-in", tone: "pos" });
  return true;
}

/** One step on: checked in → roomed → with the clinician → ready. */
export async function advanceVisit(visit: Appointment, name: string, t: TFunction): Promise<boolean> {
  const to = NEXT[visit.status];
  if (to === undefined || to === "seen") return false;
  if (to === "checked_in") return checkInVisit(visit, name, t);
  if (to !== "roomed" && to !== "with_clinician" && to !== "ready") return false;
  const out = await setStatus(visit.id, to);
  if (refused(out, t)) return false;
  const words = { roomed: "move.toast.roomed", with_clinician: "move.toast.with", ready: "move.toast.ready" } as const;
  const icons = { roomed: "door-open", with_clinician: "user-round-check", ready: "check-check" } as const;
  toast(t(words[to], { name: firstName(name) }), { icon: icons[to] });
  return true;
}

export async function noShowVisit(visit: Appointment, name: string, t: TFunction): Promise<boolean> {
  const out = await setStatus(visit.id, "no_show");
  if (refused(out, t)) return false;
  closePanel();
  toast(t("move.toast.noShow", { name, ref: visit.ref }), { icon: "user-round-x", tone: "warn" });
  return true;
}
