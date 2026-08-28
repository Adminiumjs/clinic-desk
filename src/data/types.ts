/**
 * The app's domain types.
 *
 * `View` is the routing union: `app/App.tsx` maps every member to a screen, so
 * adding a view here is a compile error until a screen exists for it. That is
 * what keeps every nav item, sheet link and footer link landing somewhere real.
 *
 * Times are MINUTES SINCE MIDNIGHT — plain integers — because every question
 * this app answers ("does a 45-minute visit fit before lunch?", "how long has
 * she been waiting?") is subtraction, and a `Date` would make it arithmetic
 * over timezones instead. Dates stay as `YYYY-MM-DD` strings for the same
 * reason: they are calendar days, not instants.
 *
 * Scope boundary, stated in the types themselves: an appointment carries a
 * reason as ONE short line and nothing else about why someone is here. There is
 * no field for a diagnosis, a code, a result or a note from a clinician,
 * because this is the front desk and the day, not the record.
 */

export type View =
  | "find"
  | "details"
  | "confirm"
  | "myvisits"
  | "daysheet"
  | "waiting"
  | "patients"
  | "accounts"
  | "recalls"
  | "settings"
  | "notfound";

export type Persona = "patient" | "clinic";

/** The four things someone can book, each with its own length and fee. */
export type VisitTypeId = "routine" | "newpatient" | "physio" | "nurse";

export interface VisitType {
  id: VisitTypeId;
  /** i18n key for the display name. */
  label: string;
  /** i18n key for the one-line description under it. */
  blurb: string;
  /** How long the visit runs. Always a multiple of the 15-minute grid. */
  minutes: number;
  /** What the visit costs, in whole currency units. */
  fee: number;
  tint: string;
}

export interface Clinician {
  id: string;
  /** A person's name — a proper noun, never translated. */
  name: string;
  ini: string;
  /** i18n key for the role line. */
  role: string;
  tint: string;
  /** Which visit types this clinician takes. A GP does not do physiotherapy. */
  offers: VisitTypeId[];
}

export interface Patient {
  id: string;
  /** A proper noun. */
  name: string;
  ini: string;
  /** `YYYY-MM-DD`. Age is DERIVED from this against the pinned date. */
  dob: string;
  mobile: string;
  /**
   * i18n key for an allergies chip, or null. This is the one clinical-adjacent
   * fact a real front desk carries, and it is deliberately the only one.
   */
  allergies: string | null;
}

/**
 * The visit state machine.
 *
 * `booked → checked_in → roomed → with_clinician → ready → done`, with
 * `no_show` and `cancelled` as the two ways out. `ready` is "ready to go" —
 * still in the building; `done` is seen and gone, which is why the waiting
 * board stops at `ready`.
 */
export type VisitStatus =
  | "booked"
  | "checked_in"
  | "roomed"
  | "with_clinician"
  | "ready"
  | "done"
  | "no_show"
  | "cancelled";

/** The four statuses that put someone on the waiting board. */
export type QueueStatus = "checked_in" | "roomed" | "with_clinician" | "ready";

export interface Appointment {
  /** The reference the patient is given, e.g. `RH-4013`. */
  id: string;
  patient: string;
  clinician: string;
  type: VisitTypeId;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Start, in minutes since midnight. The end is derived from the type. */
  start: number;
  status: VisitStatus;
  /** Minutes since midnight when they arrived at the desk, or null. */
  checkedInAt: number | null;
  /** i18n key for the one short plain line saying why they are coming. */
  reason: string;
  /** i18n key for what the patient told the desk, or null. */
  deskNote: string | null;
  /** "See them again in N weeks", or null when no recall was set. */
  recallWeeks: number | null;
  /** Set when the visit was cancelled inside 24 hours of its start. */
  lateCancel?: boolean;
}

/** What a visit costs, once it has happened. */
export interface Charge {
  id: string;
  /** The appointment reference this charge came from. */
  appt: string;
  patient: string;
  /** Whole currency units. */
  amount: number;
  /** `YYYY-MM-DD` the charge was raised — what the age chip counts from. */
  raised: string;
}

export type PayMethod = "card" | "cash" | "transfer";

export interface Payment {
  id: string;
  charge: string;
  amount: number;
  method: PayMethod;
  /** `YYYY-MM-DD`. "Taken today" sums the ones matching the pinned date. */
  date: string;
}

/**
 * A DAY THE PRACTICE DOES NOT WORK.
 *
 * `db/schema.sql` has held this table since the app was written and nothing in
 * `src/` read it: no type, no `DataSource` method, no engine function and no
 * screen. The seed inserts zero rows on purpose, and its comment names the
 * exact failure that made the table worth having — *"a closure the app does not
 * know about would be a day the dashboard says is shut while the booking screen
 * carries on offering times on it"*. That sentence is why `isWorkingDay` below
 * takes the list as an argument instead of reading a module-level one: a
 * default would let one screen pass closures and another forget, which is
 * precisely the two-screens-disagreeing failure it describes.
 *
 * ── THE TWO SHAPES OF CLOSURE, AND WHY ONE FIELD CARRIES BOTH ───────────────
 *
 * `clinician: null` is the whole practice shut — a bank holiday, a refit, a
 * training day. A clinician id is one person away while the practice is open,
 * which the schema states in the same words. Nothing may be booked against
 * either, and they are one table because they are one fact at two scopes; two
 * tables would mean two lists to merge and two chances to check only one.
 *
 * ── `from`, AND THE WORST BUG THIS APP COULD HAVE ──────────────────────────
 *
 * A practice shuts for reasons that are NOT public holidays. If an imported set
 * could overwrite, replace or outrank a day somebody here typed, a re-import
 * would silently delete "Refit — no clinicians on site" from the twenty-seventh
 * of December because a curated set happens to name that date too, and the
 * first anybody would know is a patient arriving at a locked door.
 *
 * So `from` is the add-on's KEY when a day arrived from one, and null when a
 * person here entered it — and every rule in this app is written against that
 * field rather than against the date. `closures.ts` merges by CONCATENATION,
 * so an imported day cannot displace anything; `closuresOn` returns the
 * practice's own rows first, so an imported name cannot be the one a reader
 * sees instead; and only a row with `from === null` can be deleted from the
 * settings screen, so the delete button cannot reach what an add-on supplied.
 *
 * It is a KEY and not a name because no file in this app but `add-ons/registry`
 * may name an add-on (24 AC5). The screen resolves the key to a display name
 * through the registry at render time, so what a reader sees is the add-on's
 * own name, arriving from the add-on.
 */
export interface Closure {
  /** `YYYY-MM-DD`. A calendar day, never an instant. */
  date: string;
  /**
   * Why the practice is shut, as a reader sees it. For a day somebody here
   * entered this is their own words; for an imported day it is the country's
   * own name for the holiday. Never a key: neither of those is translatable by
   * this app, and running one through `t()` would print a dotted key.
   */
  reason: string;
  /** null when the whole practice is shut; a clinician id when one is away. */
  clinician: string | null;
  /** The key of the add-on that supplied this day, or null for the practice's own. */
  from: string | null;
}

/** The pinned clock, passed into every engine function that needs a "now". */
export interface Now {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Minutes since midnight. */
  minutes: number;
}

export interface Toast {
  id: number;
  /** Already-resolved text — toasts are raised from the store, post-`t()`. */
  text: string;
  tone: "pos" | "danger" | "info";
}
