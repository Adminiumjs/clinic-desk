/**
 * The Overview page's layout: a dashboard of the practice's day, drawn by
 * Adminium's own widgets from the app's tables.
 *
 * Twenty-three cards on the dashboard's twelve-column grid (heights in 40 px
 * steps), read top to bottom as the desk reads its day:
 *
 *   - six numbers: visits, seen, taken, outstanding, no-shows this week and
 *     new patients this month;
 *   - visits per clinician, and who is here right now;
 *   - visits over the day, and the money: taken by method, and what is still
 *     owed by how old it is;
 *   - what is waiting on the desk, each card a link to where it is dealt with
 *     (three, then two: five cards do not fit one row at their smallest);
 *   - this week's cancellations and how its visits were booked.
 *
 * On a phone the cards stack in the order they are listed here.
 *
 * The day control above the cards (today, yesterday, this week, a picked
 * day) moves only the cards that follow it (`param: "day"`). Who is in the
 * building is always now, what is owed is always everything still owed, and
 * the week's cards are always this week — so their titles say which.
 *
 * A card's title is written here in every language the app speaks; the page
 * shows the reader's. A card has no subtitle: a subtitle is one string, and
 * an English line under a German title would be the only English on the page.
 * The names of statuses, payment methods and booking channels come from the
 * tables' own labels, in the reader's language, and money is shown in the
 * practice's currency.
 */
import type { Labels } from "./labels.ts";
import { TABLES } from "./tables.ts";
import { APP_KEY, SURFACE_NAV } from "../surface-nav.ts";

// ── where a card leads ───────────────────────────────────────────────────────

/**
 * A desk screen inside Adminium: the app's own staff side, at the path its
 * sidebar row uses, so a renamed path cannot leave a card pointing nowhere.
 */
function desk(id: (typeof SURFACE_NAV)[number]["id"]): string {
  const entry = SURFACE_NAV.find((e) => e.id === id && e.side === "staff");
  if (entry === undefined) throw new Error(`no desk screen "${id}" to link the Overview to`);
  return `/a/${APP_KEY}/${entry.path}`;
}

/** One of the app's pages in the Clinic section (its address is its ref). */
const page = (ref: "clinic-appointments" | "clinic-recalls" | "clinic-messages"): string => `/p/${ref}`;

// ── what a card reads ────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

/** A query over one of the app's tables, by the name the manifest gives it. */
const query = (table: string, rest: Json): Json => ({ kind: "table-query", source: { name: table, type: "table" }, ...rest });

/** One number, with no comparison: the day control already says which day. */
const metric = (table: string, aggregation: Json, rest: Json = {}): Json =>
  query(table, { shape: "metric+delta", aggregations: [aggregation], ...rest });

const count = (alias: string): Json => ({ fn: "count", alias });
const sum = (column: string, alias: string): Json => ({ fn: "sum", column, alias });

const eq = (column: string, value: unknown): Json => ({ column, op: "eq", value });
const oneOf = (column: string, value: string[]): Json => ({ column, op: "in", value });
const notCancelled: Json = { column: "status", op: "neq", value: "cancelled" };
/** A seen visit that still has money on it: what the practice is owed. */
const owed: Json[] = [eq("status", "seen"), { column: "balance", op: "gt", value: 0 }];

/** Whichever day the page's day control shows. */
const onTheDay = (column: string): Json => ({ column, last: 1, unit: "day", param: "day" });
/** Today on the practice's clock, whatever day the page shows. */
const today = (column: string): Json => ({ column, last: 1, unit: "day", calendar: true });
/** This week, Monday to Sunday on the practice's clock. */
const thisWeek = (column: string): Json => ({ column, last: 1, unit: "week", calendar: true });
/** Whole days on the practice's calendar, `span` days long, ending `back` days before today. */
const days = (column: string, span: number, back: number): Json => ({
  column,
  last: span,
  unit: "day",
  calendar: true,
  ...(back === 0 ? {} : { offset: back }),
});

// ── how a card looks ─────────────────────────────────────────────────────────

const COUNT = { metricFormat: "plain", deltaMode: "none", showSparkline: false };
const MONEY = { metricFormat: "currency", deltaMode: "none", showSparkline: false };

type Place = [x: number, y: number, w: number, h: number];

function card(i: string, widget: string, [x, y, w, h]: Place, titles: Labels, config: Json): Json {
  return { i, widget, x, y, w, h, config: { title: titles["en-US"], titles, ...config } };
}

/**
 * The waiting list's status pill: which statuses it shows, and their tones.
 * The words are not set here: Adminium sends the appointments table's own
 * status words with the rows, in the reader's language, and a card column
 * that names none takes them.
 */
function waitingStatuses(values: string[]): Json {
  const column = TABLES.find((t) => t.ref === "appointments")?.columns.find((c) => c.ref === "status");
  const rules = column?.rules?.["enumLabels"] as { tones?: Record<string, string> } | undefined;
  if (rules?.tones === undefined) throw new Error("the appointments table has no status tones for the Overview's waiting list");
  return { enumValues: values, enumTones: Object.fromEntries(values.flatMap((v) => (rules.tones?.[v] === undefined ? [] : [[v, rules.tones[v]]]))) };
}

/** Here, and not yet with the clinician: the people the desk is keeping waiting. */
const WAITING = ["checked_in", "roomed"];
/** Everyone in the building: waiting, in a room, with the clinician, or ready to go. */
const IN_THE_BUILDING = ["checked_in", "roomed", "with_clinician", "ready"];

// ── the cards ────────────────────────────────────────────────────────────────

const ITEMS: Json[] = [
  // The day's numbers, in two rows of three.
  card("kpi-visits", "kpi-stat-card", [0, 0, 4, 3], {
    "en-US": "Visits", "de-DE": "Besuche", "fr-FR": "Consultations", "da-DK": "Besøg",
    "cs-CZ": "Návštěvy", "ar-EG": "الزيارات", "zh-CN": "就诊", "zh-TW": "看診",
  }, {
    iconName: "calendar-check", ...COUNT,
    // Every visit that holds its time, no-shows included.
    binding: metric("appointments", count("visits"), { filters: [notCancelled], window: onTheDay("starts_at") }),
  }),
  card("kpi-seen", "kpi-stat-card", [4, 0, 4, 3], {
    "en-US": "Seen", "de-DE": "Behandelt", "fr-FR": "Patients vus", "da-DK": "Behandlet",
    "cs-CZ": "Ošetřeno", "ar-EG": "تمّ الكشف", "zh-CN": "已就诊", "zh-TW": "已看診",
  }, {
    iconName: "user-check", ...COUNT,
    binding: metric("appointments", count("seen"), { filters: [eq("status", "seen")], window: onTheDay("starts_at") }),
  }),
  card("kpi-taken", "kpi-stat-card", [8, 0, 4, 3], {
    "en-US": "Taken", "de-DE": "Eingenommen", "fr-FR": "Encaissé", "da-DK": "Indbetalt",
    "cs-CZ": "Přijato", "ar-EG": "المحصَّل", "zh-CN": "已收款", "zh-TW": "已收款",
  }, {
    iconName: "banknote", ...MONEY,
    binding: metric("payments", sum("amount", "taken"), { filters: [eq("voided", false)], window: onTheDay("paid_at") }),
  }),
  card("kpi-outstanding", "kpi-stat-card", [0, 3, 4, 3], {
    "en-US": "Outstanding", "de-DE": "Noch offen", "fr-FR": "Reste à payer", "da-DK": "Udestående",
    "cs-CZ": "Zbývá zaplatit", "ar-EG": "المبلغ المتبقي", "zh-CN": "尚欠金额", "zh-TW": "尚欠金額",
  }, {
    // Everything still owed, whichever day the page shows.
    iconName: "receipt", ...MONEY,
    binding: metric("appointments", sum("balance", "owed"), { filters: owed }),
  }),
  card("kpi-no-shows", "kpi-stat-card", [4, 3, 4, 3], {
    "en-US": "No-shows this week", "de-DE": "Nicht erschienen diese Woche", "fr-FR": "Absences cette semaine",
    "da-DK": "Udeblivelser i denne uge", "cs-CZ": "Nedostavení tento týden", "ar-EG": "حالات عدم الحضور هذا الأسبوع",
    "zh-CN": "本周未到", "zh-TW": "本週未到",
  }, {
    iconName: "user-x", ...COUNT,
    binding: metric("appointments", count("no_shows"), { filters: [eq("status", "no_show")], window: thisWeek("starts_at") }),
  }),
  card("kpi-new-patients", "kpi-stat-card", [8, 3, 4, 3], {
    "en-US": "New patients this month", "de-DE": "Neue Patienten diesen Monat", "fr-FR": "Nouveaux patients ce mois-ci",
    "da-DK": "Nye patienter denne måned", "cs-CZ": "Noví pacienti tento měsíc", "ar-EG": "مرضى جدد هذا الشهر",
    "zh-CN": "本月新患者", "zh-TW": "本月新病患",
  }, {
    iconName: "user-plus", ...COUNT,
    binding: metric("patients", count("patients"), { window: { column: "created_at", last: 1, unit: "month", calendar: true } }),
  }),

  // Visits per clinician, by the name the desk calls them.
  card("by-clinician", "chart-ranking-bars", [0, 6, 6, 9], {
    "en-US": "Visits by clinician", "de-DE": "Besuche je Behandler", "fr-FR": "Consultations par praticien",
    "da-DK": "Besøg pr. behandler", "cs-CZ": "Návštěvy podle zdravotníka", "ar-EG": "الزيارات حسب مقدّم الرعاية",
    "zh-CN": "各医护人员的就诊", "zh-TW": "各醫護人員的看診",
  }, {
    n: 12, metricFormat: "plain",
    binding: query("appointments", {
      shape: "categorical",
      aggregations: [count("visits")],
      groupBy: ["clinician_id"],
      groupLabel: "clinician_id.short_name",
      filters: [notCancelled],
      window: onTheDay("starts_at"),
      limit: 12,
    }),
  }),

  // Right now: always today, whatever day the page shows.
  card("now-in", "kpi-stat-tile-compact", [6, 6, 3, 3], {
    "en-US": "In the building", "de-DE": "Im Haus", "fr-FR": "Sur place", "da-DK": "I huset",
    "cs-CZ": "V ordinaci", "ar-EG": "داخل العيادة", "zh-CN": "在诊所内", "zh-TW": "在診所內",
  }, {
    ...COUNT,
    binding: metric("appointments", count("here"), { filters: [oneOf("status", IN_THE_BUILDING)], window: today("starts_at") }),
  }),
  card("now-not-arrived", "kpi-stat-tile-compact", [9, 6, 3, 3], {
    "en-US": "Not arrived", "de-DE": "Noch nicht da", "fr-FR": "Pas encore arrivés", "da-DK": "Ikke ankommet",
    "cs-CZ": "Ještě nedorazili", "ar-EG": "لم يصلوا بعد", "zh-CN": "尚未到达", "zh-TW": "尚未抵達",
  }, {
    ...COUNT,
    // Still booked, and their time has come: a window that ends now. Twelve
    // hours back keeps yesterday's out; the desk's no-show marking clears them.
    binding: metric("appointments", count("late"), { filters: [eq("status", "booked")], window: { column: "starts_at", last: 12, unit: "hour" } }),
  }),
  card("now-waiting", "mini-table", [6, 9, 6, 6], {
    "en-US": "Waiting longest", "de-DE": "Am längsten wartend", "fr-FR": "Attendent depuis le plus longtemps",
    "da-DK": "Har ventet længst", "cs-CZ": "Čekají nejdéle", "ar-EG": "الأطول انتظارًا", "zh-CN": "等候最久", "zh-TW": "等候最久",
  }, {
    limit: 4,
    viewAllHref: page("clinic-appointments"),
    // A row shows three columns: who, where they are, and how long since they
    // checked in. The visit's id stays hidden and opens the visit.
    columns: [
      { name: "id", label: "Visit", logicalType: "integer", primaryKey: true, hidden: true },
      { name: "patient", label: "Patient", logicalType: "text" },
      { name: "status", label: "Status", logicalType: "enum", semantic: "status-workflow", ...waitingStatuses(WAITING) },
      { name: "checked_in_at", label: "Waiting", logicalType: "timestamptz" },
    ],
    binding: query("appointments", {
      shape: "record-list",
      select: ["id", "status", "checked_in_at"],
      lookups: ["patient:patient_id.name"],
      filters: [oneOf("status", WAITING)],
      window: today("starts_at"),
      orderBy: [{ column: "checked_in_at", dir: "asc" }],
      limit: 4,
    }),
  }),

  // Visits through the day (by the day, for a week).
  card("visits", "chart-bar", [0, 15, 6, 9], {
    "en-US": "Visits by hour or day", "de-DE": "Besuche nach Stunde oder Tag", "fr-FR": "Consultations par heure ou par jour",
    "da-DK": "Besøg pr. time eller dag", "cs-CZ": "Návštěvy po hodinách či dnech", "ar-EG": "الزيارات حسب الساعة أو اليوم",
    "zh-CN": "按小时或按天的就诊", "zh-TW": "按小時或按天的看診",
  }, {
    highlight: "none",
    binding: query("appointments", {
      shape: "timeseries",
      aggregations: [count("visits")],
      bucket: { column: "starts_at", unit: "hour" },
      filters: [notCancelled],
      window: onTheDay("starts_at"),
    }),
  }),

  // Money: what came in, by method, and what is still owed, by age.
  card("money-method", "chart-stacked-bar-100", [6, 15, 6, 5], {
    "en-US": "Money taken by method", "de-DE": "Einnahmen nach Zahlungsart", "fr-FR": "Encaissements par moyen de paiement",
    "da-DK": "Indbetalinger pr. betalingsmåde", "cs-CZ": "Přijaté platby podle způsobu", "ar-EG": "المبالغ المحصَّلة حسب طريقة الدفع",
    "zh-CN": "按支付方式的收款", "zh-TW": "按付款方式的收款",
  }, {
    metricFormat: "currency", legendColumns: 3,
    binding: query("payments", {
      shape: "categorical",
      aggregations: [sum("amount", "taken")],
      groupBy: ["method"],
      filters: [eq("voided", false)],
      window: onTheDay("paid_at"),
    }),
  }),
  // By the visit's day: this week, one to four weeks back, and older. A
  // "month" here is four weeks, so the three meet with no gap.
  card("owed-week", "kpi-stat-tile-compact", [6, 20, 2, 4], {
    "en-US": "Owed · up to a week", "de-DE": "Offen · bis zu einer Woche", "fr-FR": "Dû · jusqu’à une semaine",
    "da-DK": "Udestående · op til en uge", "cs-CZ": "Dluh · do týdne", "ar-EG": "مستحق · حتى أسبوع",
    "zh-CN": "欠款 · 一周以内", "zh-TW": "欠款 · 一週以內",
  }, {
    ...MONEY,
    binding: metric("appointments", sum("balance", "owed"), { filters: owed, window: days("starts_at", 7, 0) }),
  }),
  card("owed-month", "kpi-stat-tile-compact", [8, 20, 2, 4], {
    "en-US": "Owed · 1–4 weeks", "de-DE": "Offen · 1–4 Wochen", "fr-FR": "Dû · 1 à 4 semaines",
    "da-DK": "Udestående · 1–4 uger", "cs-CZ": "Dluh · 1–4 týdny", "ar-EG": "مستحق · 1–4 أسابيع",
    "zh-CN": "欠款 · 1–4 周", "zh-TW": "欠款 · 1–4 週",
  }, {
    ...MONEY,
    binding: metric("appointments", sum("balance", "owed"), { filters: owed, window: days("starts_at", 21, 7) }),
  }),
  card("owed-older", "kpi-stat-tile-compact", [10, 20, 2, 4], {
    "en-US": "Owed · over a month", "de-DE": "Offen · über einen Monat", "fr-FR": "Dû · plus d’un mois",
    "da-DK": "Udestående · over en måned", "cs-CZ": "Dluh · přes měsíc", "ar-EG": "مستحق · أكثر من شهر",
    "zh-CN": "欠款 · 超过一个月", "zh-TW": "欠款 · 超過一個月",
  }, {
    ...MONEY,
    binding: metric("appointments", sum("balance", "owed"), { filters: owed, window: days("starts_at", 3650, 28) }),
  }),

  // Waiting on the desk: each card opens where the work is done.
  card("desk-registrations", "kpi-stat-card", [0, 24, 4, 3], {
    "en-US": "Registrations to check", "de-DE": "Anmeldungen zu prüfen", "fr-FR": "Inscriptions à vérifier",
    "da-DK": "Tilmeldinger til gennemsyn", "cs-CZ": "Registrace ke kontrole", "ar-EG": "طلبات تسجيل للمراجعة",
    "zh-CN": "待核对的登记", "zh-TW": "待核對的登記",
  }, {
    iconName: "clipboard-check", iconTone: "accent", ...COUNT,
    href: desk("registrations"),
    binding: metric("registrations", count("to_check"), { filters: [eq("status", "new")] }),
  }),
  // A first visit booked online is checked on the same screen as a
  // registration, but lives on the appointments table: its own count.
  card("desk-first-visits", "kpi-stat-card", [4, 24, 4, 3], {
    "en-US": "First visits to check", "de-DE": "Erstbesuche zu prüfen", "fr-FR": "Premières consultations à vérifier",
    "da-DK": "Første besøg til gennemsyn", "cs-CZ": "První návštěvy ke kontrole", "ar-EG": "زيارات أولى للمراجعة",
    "zh-CN": "待核对的初诊", "zh-TW": "待核對的初診",
  }, {
    iconName: "clipboard-check", iconTone: "accent", ...COUNT,
    href: desk("registrations"),
    binding: metric("appointments", count("to_check"), { filters: [eq("check_status", "to_check")] }),
  }),
  card("desk-recalls", "kpi-stat-card", [8, 24, 4, 3], {
    "en-US": "Recalls overdue", "de-DE": "Überfällige Wiedervorstellungen", "fr-FR": "Rappels de suivi en retard",
    "da-DK": "Forsinkede genindkaldelser", "cs-CZ": "Pozvánky na kontrolu po termínu", "ar-EG": "دعوات متابعة متأخرة",
    "zh-CN": "逾期的复诊通知", "zh-TW": "逾期的回診通知",
  }, {
    iconName: "bell-ring", iconTone: "warn", ...COUNT,
    href: page("clinic-recalls"),
    // Still to do, and due before today (any day in the last ten years).
    binding: metric("recalls", count("overdue"), { filters: [oneOf("status", ["due", "noted"])], window: days("due_on", 3650, 1) }),
  }),
  // Waiting for an earlier time: the desk's waiting list, where a free time is offered to them.
  card("desk-waiting-list", "kpi-stat-card", [0, 27, 6, 3], {
    "en-US": "On the waiting list", "de-DE": "Auf der Warteliste", "fr-FR": "Sur la liste d’attente", "da-DK": "På ventelisten",
    "cs-CZ": "Na čekací listině", "ar-EG": "على قائمة الانتظار", "zh-CN": "候补名单上", "zh-TW": "候補名單上",
  }, {
    // The KPI card draws a fixed set of icons; "users" (people waiting) stands in for the list.
    iconName: "users", iconTone: "neutral", ...COUNT,
    href: desk("waitlist"),
    binding: metric("waiting_list", count("waiting"), { filters: [eq("status", "waiting")] }),
  }),
  card("desk-reminders", "kpi-stat-card", [6, 27, 6, 3], {
    "en-US": "Reminders failed", "de-DE": "Erinnerungen fehlgeschlagen", "fr-FR": "Rappels non envoyés",
    "da-DK": "Påmindelser der ikke blev sendt", "cs-CZ": "Neodeslané připomínky", "ar-EG": "تذكيرات تعذّر إرسالها",
    "zh-CN": "发送失败的提醒", "zh-TW": "寄送失敗的提醒",
  }, {
    iconName: "message-square-warning", iconTone: "danger", ...COUNT,
    href: page("clinic-messages"),
    // A reminder not sent for want of an email address is not a failure.
    binding: metric("messages", count("failed"), { filters: [eq("kind", "reminder"), eq("status", "failed")] }),
  }),

  // This week, whatever day the page shows.
  card("week-cancelled", "kpi-stat-tile-compact", [0, 30, 3, 4], {
    "en-US": "Cancellations this week", "de-DE": "Absagen diese Woche", "fr-FR": "Annulations cette semaine",
    "da-DK": "Aflysninger i denne uge", "cs-CZ": "Zrušení tento týden", "ar-EG": "الإلغاءات هذا الأسبوع",
    "zh-CN": "本周取消", "zh-TW": "本週取消",
  }, {
    ...COUNT,
    binding: metric("appointments", count("cancelled"), { filters: [eq("status", "cancelled")], window: thisWeek("starts_at") }),
  }),
  card("week-late", "kpi-stat-tile-compact", [3, 30, 3, 4], {
    "en-US": "Late cancellations this week", "de-DE": "Kurzfristige Absagen diese Woche", "fr-FR": "Annulations tardives cette semaine",
    "da-DK": "Sene afbud i denne uge", "cs-CZ": "Pozdní zrušení tento týden", "ar-EG": "الإلغاءات المتأخرة هذا الأسبوع",
    "zh-CN": "本周逾时取消", "zh-TW": "本週逾時取消",
  }, {
    ...COUNT,
    binding: metric("appointments", count("late"), { filters: [eq("status", "cancelled"), eq("late_cancel", true)], window: thisWeek("starts_at") }),
  }),
  card("week-channels", "chart-stacked-bar-100", [6, 30, 6, 4], {
    "en-US": "How this week's visits were booked", "de-DE": "Wie die Besuche dieser Woche gebucht wurden",
    "fr-FR": "Comment les consultations de la semaine ont été prises", "da-DK": "Sådan blev ugens besøg booket",
    "cs-CZ": "Jak byly objednány návštěvy tohoto týdne", "ar-EG": "كيف حُجزت زيارات هذا الأسبوع",
    "zh-CN": "本周就诊的预约方式", "zh-TW": "本週看診的預約方式",
  }, {
    metricFormat: "plain", legendColumns: 3,
    binding: query("appointments", {
      shape: "categorical",
      aggregations: [count("visits")],
      groupBy: ["channel"],
      filters: [notCancelled],
      window: thisWeek("starts_at"),
    }),
  }),
];

export const OVERVIEW_LAYOUT = {
  version: 1,
  toolbar: {
    day: true,
    // The desk itself is one step away: its day sheet.
    link: {
      label: "Open the desk",
      labels: {
        "en-US": "Open the desk", "de-DE": "Empfang öffnen", "fr-FR": "Ouvrir l’accueil", "da-DK": "Åbn receptionen",
        "cs-CZ": "Otevřít recepci", "ar-EG": "افتح الاستقبال", "zh-CN": "打开前台", "zh-TW": "開啟櫃檯",
      } satisfies Labels,
      href: desk("daysheet"),
      icon: "arrow-right",
    },
  },
  items: ITEMS,
};
