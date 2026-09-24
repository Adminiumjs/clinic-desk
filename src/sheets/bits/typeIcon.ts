/**
 * A visit type's icon, by the lucide name its row carries ("stethoscope").
 *
 * Named one by one rather than importing lucide's whole set, which would put
 * some fifteen hundred icons into the desk's bundle for the handful a
 * practice's visit types use. A name not listed draws a plain calendar.
 */
import type { LucideIcon } from "lucide-react";
import { Activity, Baby, Bone, CalendarDays, Ear, Eye, HeartPulse, PersonStanding, Pill, Smile, Stethoscope, Syringe, UserPlus } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  baby: Baby,
  bone: Bone,
  ear: Ear,
  eye: Eye,
  "heart-pulse": HeartPulse,
  "person-standing": PersonStanding,
  pill: Pill,
  smile: Smile,
  stethoscope: Stethoscope,
  syringe: Syringe,
  "user-plus": UserPlus,
};

export const typeIcon = (name: string): LucideIcon => ICONS[name] ?? CalendarDays;
