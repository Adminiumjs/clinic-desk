/**
 * What the patients' pages may do, through the browser key Adminium makes
 * at install. Nothing here is a password: every entry is a narrow door, and
 * the server keeps each one narrow whatever the page sends.
 *
 * The catalogue — the practice's settings, hours, clinicians, visit types,
 * questions and closures — is readable by anyone, and only the columns a
 * patient needs.
 *
 * A patient is FOUND by their mobile and date of birth (after the browser
 * proves it is not a script), which opens a short session showing only their
 * first name. That is enough to book in their own name. To see their visits
 * or change their reminders they confirm a code emailed to the address on
 * file, which raises the same session to "verified"; what it opens is only
 * their own rows.
 *
 * A first visit by someone not yet on file books with no session at all,
 * within limits per phone number, per address and per hour, and waits for
 * the desk to check it.
 *
 * No entry exposes payments, messages, notes, other people's details, the
 * desk's note on anyone else's visit, or allergies.
 */
const setting = (column: string) => ({ table: "settings", column });

/**
 * The arrivals kiosk's key. It is never given to the patients' pages: the
 * desk hands it only to someone signed in with the kiosk role, and every
 * request on it must carry that sign-in too, so a token copied off the
 * tablet opens nothing on its own. The desk settings' "Arrivals kiosk"
 * switch turns it off (the patients' pages being off does not).
 */
export const PUBLIC_KEYS = {
  kiosk: { requiresStaff: { role: "kiosk" }, enabledBy: setting("kiosk_on") },
};

export const PUBLIC_ACCESS = [
  // The practice: its name, contact details, words and booking rules.
  {
    table: "settings",
    methods: ["GET"],
    select: [
      "practice_name",
      "mark",
      "address",
      "phone",
      "email",
      "intro",
      "directions",
      "map_link",
      "entrance_photo",
      "pay_note",
      "insurer_note",
      "privacy_link",
      "currency",
      "language",
      "slot_minutes",
      "booking_days",
      "min_notice_minutes",
      "new_patients_online",
      "online_booking_on",
      "no_show_minutes",
      "cancel_hours",
    ],
  },
  { table: "opening_hours", methods: ["GET"], select: ["weekday", "open", "opens", "closes", "break_start", "break_end"] },
  // Who can be booked online, with what patients read about them.
  {
    table: "clinicians",
    methods: ["GET"],
    filters: [
      { column: "active", op: "eq", value: true },
      { column: "bookable_online", op: "eq", value: true },
    ],
    select: ["id", "name", "short_name", "role_label", "color", "photo", "bio", "position"],
  },
  // Names only, for every clinician: a visit with someone desk-only, or who has
  // left, still says who it was with.
  { table: "clinicians", methods: ["GET"], select: ["id", "name", "short_name", "role_label", "color"] },
  {
    table: "visit_types",
    methods: ["GET"],
    filters: [
      { column: "active", op: "eq", value: true },
      { column: "bookable_online", op: "eq", value: true },
    ],
    select: ["id", "name", "short_name", "minutes", "fee", "color", "icon", "new_patients_only", "position"],
  },
  { table: "clinician_visit_types", methods: ["GET"], select: ["id", "clinician_id", "visit_type_id"] },
  { table: "faqs", methods: ["GET"], filters: [{ column: "active", op: "eq", value: true }], select: ["id", "question", "answer", "position"] },
  // Closed days ahead, with the note written for patients.
  {
    table: "closures",
    methods: ["GET"],
    filters: [
      { column: "active", op: "eq", value: true },
      { column: "to_date", op: "from-today" },
    ],
    select: ["id", "from_date", "to_date", "label", "note", "clinician_id"],
  },
  // Free or taken, per time and per day: never who, never how many.
  { table: "appointments", kind: "availability", methods: ["GET"] },

  // The patient: found by mobile and date of birth; the name alone until the emailed code.
  {
    table: "patients",
    methods: ["GET"],
    select: ["name"],
    sensitive: true,
    claim: { match: ["mobile", "born_on"], verify: "email-code", email: "email" },
    humanCheck: true,
  },
  // Their details and reminder choices, once verified. The email changes only
  // through the code sent to the new address; the mobile is the desk's to change.
  {
    table: "patients",
    methods: ["GET", "PATCH"],
    select: ["id", "name", "email", "mobile", "remind_email", "remind_lead_hours"],
    writable: ["remind_email", "remind_lead_hours"],
    claimedBy: { table: "patients", column: "id" },
    level: "verified",
    sensitive: true,
    requireSetting: [setting("online_booking_on")],
  },
  // Booking: in their own name once found, or as a first visit by nobody yet.
  {
    table: "appointments",
    methods: ["POST"],
    select: ["ref", "starts_at", "minutes", "clinician_id", "status"],
    writable: [
      "visit_type_id",
      "clinician_id",
      "starts_at",
      "reason",
      "desk_note",
      "new_name",
      "new_born_on",
      "new_mobile",
      "new_email",
      "language",
    ],
    defaults: { status: "booked", channel: "online", check_status: "to_check" },
    claimedBy: { table: "patients", column: "patient_id", optional: true },
    onClaim: { clear: ["new_name", "new_born_on", "new_mobile", "new_email", "check_status"] },
    sensitive: false,
    reason: "the reply names only the booking just made: its reference, time, length and clinician",
    humanCheck: true,
    maxOpen: { column: "status", values: ["booked"], n: 2, upcoming: "starts_at" },
    anonymous: { perValue: { columns: ["new_mobile", "new_email"], n: 2 }, perKeyHour: 20, plainText: ["new_name"] },
    requireSetting: [setting("online_booking_on"), { ...setting("new_patients_online"), when: "anonymous" }],
  },
  // Their own visits, once verified: cancel a booked one, or move it while it is still ahead.
  {
    table: "appointments",
    methods: ["GET", "PATCH"],
    select: ["id", "ref", "clinician_id", "visit_type_id", "starts_at", "minutes", "status", "late_cancel", "reason", "balance"],
    writable: ["starts_at", "status"],
    writableValues: { status: ["cancelled"] },
    writableWhen: { status: ["booked"], starts_at: "from-now" },
    claimedBy: { table: "patients", column: "patient_id" },
    level: "verified",
    sensitive: true,
    requireSetting: [setting("online_booking_on")],
  },
  // The earlier-time list: someone already found asks to hear of an earlier
  // time. The reply says only where they stand; one place per person, and the
  // server refuses a second, so the page needs no read of its own to say so.
  {
    table: "waiting_list",
    methods: ["POST"],
    select: ["id", "status"],
    writable: ["visit_type_id", "clinician_id", "part_of_day"],
    defaults: { status: "waiting", channel: "online" },
    claimedBy: { table: "patients", column: "patient_id" },
    rank: { orderBy: "created_at", where: { column: "status", eq: "waiting" } },
    maxOpen: { column: "status", values: ["waiting"], n: 1 },
    sensitive: false,
    reason: "the reply says only where they stand on the list",
    requireSetting: [setting("online_booking_on")],
  },
  // Registering with the practice: the desk rings them back.
  {
    table: "registrations",
    methods: ["POST"],
    select: ["ref"],
    writable: ["name", "born_on", "mobile", "email", "address", "emergency_contact", "language"],
    humanCheck: true,
    anonymous: { perValue: { columns: ["mobile", "email"], n: 2 }, perKeyHour: 20, plainText: ["name"] },
    requireSetting: [setting("online_booking_on")],
  },
  // ── the arrivals kiosk (its own key, beside the kiosk sign-in) ──
  // Found by date of birth and mobile, as on the patients' pages, but at the
  // practice's own door: the first name to greet them, nothing more.
  {
    table: "patients",
    key: "kiosk",
    methods: ["GET"],
    select: ["name"],
    claim: { match: ["mobile", "born_on"] },
    sensitive: false,
    reason: "the screen greets the person standing at it by their first name",
  },
  // Today's visit of the person found: whether it is booked or already begun,
  // and checking it in — from an hour before its time (earlier, the refusal
  // says when to come back). Its time and clinician are not read here.
  {
    table: "appointments",
    key: "kiosk",
    methods: ["GET", "PATCH"],
    select: ["id", "status"],
    filters: [
      { column: "starts_at", op: "today" },
      { column: "status", op: "in", value: ["booked", "checked_in", "roomed", "with_clinician", "ready"] },
    ],
    writable: ["status"],
    writableValues: { status: ["checked_in"] },
    writableWhen: { status: ["booked"], starts_at: { within: 60 } },
    claimedBy: { table: "patients", column: "patient_id" },
    sensitive: false,
    reason: "the screen shows only whether today's visit is booked or already begun",
  },
  // Once they are checked in: the time and who they will see, for the thank-you.
  {
    table: "appointments",
    key: "kiosk",
    methods: ["GET"],
    select: ["id", "starts_at", "clinician_id"],
    filters: [
      { column: "starts_at", op: "today" },
      { column: "status", op: "in", value: ["checked_in", "roomed", "with_clinician", "ready"] },
    ],
    claimedBy: { table: "patients", column: "patient_id" },
    sensitive: false,
    reason: "after the check-in the screen says when and with whom, as the desk would",
  },
  // The practice's name and letters, for the screen's heading.
  { table: "settings", key: "kiosk", methods: ["GET"], select: ["practice_name", "mark"] },
  // Who they will see, for the thank-you: short names only.
  { table: "clinicians", key: "kiosk", methods: ["GET"], select: ["id", "short_name", "role_label", "color"] },
];
