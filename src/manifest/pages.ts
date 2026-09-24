/**
 * The Clinic section in the dashboard: its pages, their forms and the two
 * groups they sit in.
 *
 * Records first, then Manage — the order, icons and titles of the Clinic
 * Overview design. The desk's own screens are listed after both by Adminium
 * (they are the app's staff side, not pages). The Overview sits above every
 * group with no heading of its own.
 *
 * Forms are v2 documents. Their sections carry no headings: a form's section
 * label is one untranslated string, and every field already carries its
 * column's label in all eight languages, so an English heading would be the
 * only English on a German screen.
 */
import { l, titles } from "./labels.ts";
import { OVERVIEW_LAYOUT } from "./overview.ts";

export const NAV_GROUPS = [
  { key: "records", label: l("Records"), order: 1 },
  { key: "manage", label: l("Manage"), order: 2 },
];

type Field = Record<string, unknown>;
const f = (column: string, more: Field = {}): Field => ({ column, ...more });
const title = (column: string): Field => ({ column, control: "title", span: 2 });
const wide = (column: string, control = "textarea"): Field => ({ column, control, span: 2 });
const toggle = (column: string): Field => ({ column, control: "toggle-row" });
const form = (...sections: Field[][]) => ({
  form: { v: 2, sections: sections.map((fields, i) => ({ id: `s${String(i + 1)}`, fields })) },
});

interface PageSpec {
  ref: string;
  template: string;
  title: string;
  group: string;
  icon: string;
  order: number;
  table?: string;
  config: Record<string, unknown>;
}

const SPECS: PageSpec[] = [
  {
    ref: "clinic-overview",
    template: "page-dashboard",
    title: "Overview",
    group: "overview",
    icon: "layout-dashboard",
    order: 0,
    config: { layout: OVERVIEW_LAYOUT },
  },

  // ── records ────────────────────────────────────────────────────────────────
  {
    ref: "clinic-appointments",
    template: "page-calendar",
    title: "Appointments",
    group: "records",
    icon: "calendar-check",
    order: 1,
    table: "appointments",
    config: {
      ...form([
        f("patient_id", { control: "reference" }),
        f("visit_type_id", { control: "reference" }),
        f("clinician_id", { control: "reference" }),
        // The calendar's taken-instants read knows nothing of lengths or hours:
        // the booking rule judges the time when the visit is saved.
        f("starts_at", { control: "datetime", span: 2, availability: { resource: "clinician_id" } }),
        wide("reason"),
        wide("desk_note"),
        f("channel", { control: "select" }),
        f("status", { control: "select" }),
      ]),
      // Plotted by the visit's time, titled with the patient's name, coloured by visit type.
      calendar: { start: "starts_at", title: "patient_id.name", category: "visit_type_id" },
    },
  },
  {
    ref: "clinic-patients",
    template: "page-master-detail",
    title: "Patients",
    group: "records",
    icon: "users-round",
    order: 2,
    table: "patients",
    config: form(
      [title("name"), f("born_on", { control: "date" }), f("mobile", { control: "phone" }), f("email", { control: "email" }), wide("address"), f("emergency_contact")],
      [f("allergies_note"), f("insurer"), f("policy_ref"), f("language")],
      [toggle("remind_email"), f("remind_lead_hours", { control: "segmented" }), f("status", { control: "select" })],
    ),
  },
  {
    ref: "clinic-payments",
    template: "page-crud",
    title: "Payments",
    group: "records",
    icon: "credit-card",
    order: 3,
    table: "payments",
    config: form([
      f("appointment_id", { control: "reference" }),
      f("amount", { control: "currency" }),
      f("method", { control: "segmented" }),
      f("paid_at", { control: "datetime" }),
      toggle("voided"),
      wide("void_reason", "text"),
    ]),
  },
  {
    ref: "clinic-recalls",
    template: "page-crud",
    title: "Recalls",
    group: "records",
    icon: "bell-ring",
    order: 4,
    table: "recalls",
    config: form([
      f("patient_id", { control: "reference" }),
      f("visit_type_id", { control: "reference" }),
      f("clinician_id", { control: "reference" }),
      f("weeks", { control: "number" }),
      f("due_on", { control: "date" }),
      f("status", { control: "select" }),
      wide("reason", "text"),
    ]),
  },
  {
    ref: "clinic-waiting-list",
    template: "page-crud",
    title: "Waiting list",
    group: "records",
    icon: "list-ordered",
    order: 5,
    table: "waiting_list",
    config: form([
      f("patient_id", { control: "reference" }),
      f("visit_type_id", { control: "reference" }),
      f("clinician_id", { control: "reference" }),
      f("part_of_day", { control: "segmented" }),
      f("status", { control: "select" }),
      wide("note"),
    ]),
  },
  {
    ref: "clinic-registrations",
    template: "page-queue-inbox",
    title: "Registrations",
    group: "records",
    icon: "clipboard-check",
    order: 6,
    table: "registrations",
    config: form(
      [title("name"), f("born_on", { control: "date" }), f("mobile", { control: "phone" }), f("email", { control: "email" }), wide("address"), f("emergency_contact"), f("language")],
      [f("status", { control: "segmented", span: 2 }), f("patient_id", { control: "reference" }), wide("outcome", "text"), wide("note")],
    ),
  },
  {
    ref: "clinic-messages",
    template: "page-crud",
    title: "Messages",
    group: "records",
    icon: "mail",
    order: 7,
    table: "messages",
    config: form([
      f("kind", { control: "select" }),
      f("status", { control: "select" }),
      f("patient_id", { control: "reference" }),
      f("appointment_id", { control: "reference" }),
      f("to_address", { control: "email" }),
      f("sent_at", { control: "datetime" }),
      wide("error", "text"),
    ]),
  },
  {
    ref: "clinic-day-closes",
    template: "page-crud",
    title: "Day closes",
    group: "records",
    icon: "notebook-pen",
    order: 8,
    table: "day_closes",
    config: form([
      f("day", { control: "date" }),
      f("no_shows_marked", { control: "number" }),
      f("cash_expected", { control: "currency" }),
      f("cash_counted", { control: "currency" }),
      wide("note"),
    ]),
  },

  // ── manage ─────────────────────────────────────────────────────────────────
  {
    ref: "clinic-clinicians",
    template: "page-crud",
    title: "Clinicians",
    group: "manage",
    icon: "stethoscope",
    order: 1,
    table: "clinicians",
    config: {
      form: {
        v: 2,
        sections: [
          {
            id: "s1",
            aside: "photo",
            fields: [
              title("name"),
              f("short_name"),
              f("role_label"),
              f("color"),
              f("photo", { control: "image" }),
              wide("bio"),
              toggle("active"),
              toggle("bookable_online"),
              f("position", { control: "stepper" }),
              f("staff_email", { control: "email" }),
            ],
          },
          { id: "s2", fields: [{ relation: "clinician_visit_types", control: "reference-chips", span: 2 }] },
          {
            id: "s3",
            fields: [
              {
                relation: "clinician_hours",
                control: "child-rows",
                span: 2,
                columns: [
                  { column: "weekday", control: "select", width: "1fr" },
                  { column: "opens", width: "90px" },
                  { column: "closes", width: "90px" },
                  { column: "break_start", width: "90px" },
                  { column: "break_end", width: "90px" },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    ref: "clinic-visit-types",
    template: "page-crud",
    title: "Visit types",
    group: "manage",
    icon: "list-checks",
    order: 2,
    table: "visit_types",
    config: form([
      title("name"),
      f("short_name"),
      f("minutes", { control: "segmented" }),
      f("fee", { control: "currency" }),
      f("color"),
      f("icon"),
      toggle("bookable_online"),
      toggle("new_patients_only"),
      toggle("active"),
      f("position", { control: "stepper" }),
    ]),
  },
  {
    ref: "clinic-hours",
    template: "page-crud",
    title: "Opening hours",
    group: "manage",
    icon: "clock",
    order: 3,
    table: "opening_hours",
    config: form([f("weekday", { control: "select" }), toggle("open"), f("opens"), f("closes"), f("break_start"), f("break_end")]),
  },
  {
    ref: "clinic-closures",
    template: "page-calendar",
    title: "Closures",
    group: "manage",
    icon: "calendar-off",
    order: 4,
    table: "closures",
    config: {
      ...form([
        f("clinician_id", { control: "reference", span: 2 }),
        f("from_date", { control: "date" }),
        f("to_date", { control: "date" }),
        title("label"),
        wide("note"),
        toggle("active"),
      ]),
      // A closure spans its days.
      calendar: { start: "from_date", end: "to_date", title: "label" },
    },
  },
  {
    ref: "clinic-faqs",
    template: "page-crud",
    title: "Questions",
    group: "manage",
    icon: "message-circle-question",
    order: 5,
    table: "faqs",
    config: form([wide("question", "title"), wide("answer"), f("position", { control: "stepper" }), toggle("active")]),
  },
  {
    ref: "clinic-settings",
    template: "page-crud",
    title: "Practice settings",
    group: "manage",
    icon: "settings",
    order: 6,
    table: "settings",
    config: form(
      [
        title("practice_name"),
        f("mark"),
        f("phone", { control: "phone" }),
        wide("address", "text"),
        f("email", { control: "email" }),
        f("map_link", { control: "url" }),
        wide("intro"),
        wide("directions"),
        f("entrance_photo", { control: "image" }),
      ],
      [
        f("slot_minutes", { control: "segmented" }),
        f("booking_days", { control: "stepper" }),
        f("min_notice_minutes", { control: "number" }),
        toggle("online_booking_on"),
        toggle("new_patients_online"),
      ],
      [f("no_show_minutes", { control: "segmented" }), f("cancel_hours", { control: "segmented" })],
      [toggle("reminders_on"), f("default_lead_hours", { control: "segmented" })],
      [toggle("kiosk_on")],
      [f("currency"), f("language"), wide("pay_note"), wide("insurer_note"), f("privacy_link", { control: "url" })],
    ),
  },
];

export function pages(): unknown[] {
  return SPECS.map((spec) => ({
    ref: spec.ref,
    template: spec.template,
    title: { key: `mft.${spec.ref.replaceAll("-", ".")}`, fallback: spec.title },
    titles: titles(spec.title),
    nav: { group: spec.group, icon: spec.icon, order: spec.order },
    ...(spec.table === undefined ? {} : { bindings: { rows: spec.table } }),
    config: spec.config,
  }));
}

/** Every page's ref, in order (the roles grant them by name). */
export const PAGE_REFS = SPECS.map((spec) => spec.ref);
