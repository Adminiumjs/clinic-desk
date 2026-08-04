-- Clinic Desk — PostgreSQL schema (manifest §requiredSchema contract).
--
-- This is the real database behind the full self-host stack: the appointment
-- desk reads it (through Adminium's records API) and the auto-generated
-- Adminium dashboard is the back office that runs it. Applied automatically on
-- first boot of the `clinic-db` container via
-- /docker-entrypoint-initdb.d/01-schema.sql, then seeded by 02-seed.sql. The
-- seed mirrors src/data/demo.ts one for one — the same four clinicians, the
-- same thirty patients, the same Tuesday morning — so the desk and the
-- dashboard show the same practice.
--
-- Nine tables. The scope boundary the app states in its types is stated again
-- here, in the only place that could quietly break it: there is NO column
-- anywhere below for a diagnosis, a code, a medicine, a result or a note from a
-- clinician. A visit carries `reason` as one short plain line and nothing more,
-- and `patients.allergies_note` is the single clinical-adjacent field, because
-- a real front desk carries one. This is the appointment book, not the record.
--
-- Money is numeric(12, 2) — never a float, because a balance that drifts by a
-- hundredth is a balance nobody trusts. The demo practice trades in whole
-- pounds. Calendar days are `date`; anything that happened at a moment is
-- `timestamptz` and resolves against the practice's single configured zone.
--
-- Times of day that are opening hours rather than instants — `clinician_hours`
-- — are "HH:MM" text on purpose. They are a rule that repeats every week, not a
-- point on a timeline, and storing them as `time` would invite a reader to
-- subtract one from a timestamp and get an answer that is wrong twice a year.

DROP TABLE IF EXISTS closures CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS charges CASCADE;
DROP TABLE IF EXISTS recalls CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS visit_types CASCADE;
DROP TABLE IF EXISTS clinician_hours CASCADE;
DROP TABLE IF EXISTS clinicians CASCADE;

-- Who works here -------------------------------------------------------------

-- `initials` and `color` are what the desk draws when `avatar` is empty, so
-- both are required. The colour follows a clinician everywhere they appear —
-- the day-sheet column, the waiting card, the booking chooser — so a reader
-- learns it once.
--
-- `role` doubles as the rule about who takes what: a GP takes routine and
-- new-patient visits, the physiotherapist takes physiotherapy, the nurse takes
-- nurse visits. It is a small enough practice that the mapping needs no table
-- of its own; a bigger one would grow one here.
CREATE TABLE clinicians (
  id       serial PRIMARY KEY,
  name     text    NOT NULL,
  initials text    NOT NULL,
  avatar   text    NOT NULL DEFAULT '',
  role     text    NOT NULL CHECK (role IN ('gp', 'physiotherapist', 'nurse')),
  color    text    NOT NULL DEFAULT '#0369a1',
  active   boolean NOT NULL DEFAULT true
);

-- One row per clinician per day they work. A weekday with no row is a day that
-- clinician does not work — which is how the practice shuts at the weekend
-- without anyone storing a rule about weekends.
--
-- The break is a pair or it is nothing: half a lunch break would let a visit be
-- offered a start that overruns it.
CREATE TABLE clinician_hours (
  id           serial PRIMARY KEY,
  clinician_id integer NOT NULL REFERENCES clinicians (id) ON DELETE CASCADE,
  weekday      text    NOT NULL
                       CHECK (weekday IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  opens        text    NOT NULL CHECK (opens  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  closes       text    NOT NULL CHECK (closes ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  break_start  text             CHECK (break_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  break_end    text             CHECK (break_end   ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  UNIQUE (clinician_id, weekday),
  CONSTRAINT clinician_hours_day_runs_forward CHECK (closes > opens),
  CONSTRAINT clinician_hours_break_is_a_pair
    CHECK ((break_start IS NULL) = (break_end IS NULL)),
  CONSTRAINT clinician_hours_break_inside_day
    CHECK (break_start IS NULL OR (break_start >= opens AND break_end <= closes
                                   AND break_end > break_start))
);

-- What can be booked, how long it runs, and what it costs. `minutes` sits on
-- the quarter-hour grid because every start does: a 45-minute session only fits
-- where three consecutive quarter-hours are open, and that is the rule that
-- makes the physiotherapy grid visibly sparser than the routine one.
CREATE TABLE visit_types (
  id      serial PRIMARY KEY,
  name    text           NOT NULL,
  minutes integer        NOT NULL CHECK (minutes > 0 AND minutes % 15 = 0),
  fee     numeric(12, 2) NOT NULL CHECK (fee >= 0),
  color   text           NOT NULL DEFAULT '#0369a1'
);

-- Who comes here -------------------------------------------------------------

-- Age is NOT stored. It is derived from `born_on` against the day being asked
-- about, so nobody here has a birthday that fails to happen.
--
-- `phone` and `born_on` together are the returning-patient lookup: either alone
-- would match the wrong person eventually.
--
-- `insurer` and `policy_ref` are the practice's own note about who settles the
-- account. They are logistics, and there is nothing else about anybody in this
-- table by design.
CREATE TABLE patients (
  id             serial PRIMARY KEY,
  name           text NOT NULL,
  initials       text NOT NULL,
  born_on        date NOT NULL,
  phone          text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  allergies_note text NOT NULL DEFAULT '',
  insurer        text NOT NULL DEFAULT '',
  policy_ref     text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- The day --------------------------------------------------------------------

-- `minutes` is copied from the visit type when the appointment is made rather
-- than joined at read time, because a practice that shortens its routine check
-- next year must not silently reshape last year's day sheet.
--
-- The state machine: booked → checked_in → roomed → with_clinician → ready →
-- done, with no_show and cancelled as the two ways out. `ready` is "ready to
-- go" — still in the building, which is why the waiting board stops there and
-- `done` is seen and gone.
--
-- The three constraints at the bottom are the ones worth stating out loud:
-- a cancelled visit carries the moment it was cancelled and nothing else does;
-- a late cancellation is a fact about a cancellation, so it cannot be flagged
-- on a visit that still stands; and nobody can be anywhere past `booked` in the
-- building without the desk having stamped them in.
CREATE TABLE appointments (
  id            serial PRIMARY KEY,
  ref           text    NOT NULL UNIQUE,              -- 'RH-4013'
  patient_id    integer NOT NULL REFERENCES patients (id)    ON DELETE RESTRICT,
  clinician_id  integer NOT NULL REFERENCES clinicians (id)  ON DELETE RESTRICT,
  visit_type_id integer NOT NULL REFERENCES visit_types (id) ON DELETE RESTRICT,
  starts_at     timestamptz NOT NULL,
  minutes       integer NOT NULL CHECK (minutes > 0),
  -- One short plain line: 'annual check', 'knee follow-up', 'dressing change'.
  reason        text    NOT NULL DEFAULT '',
  -- What the patient told the desk. Logistics only — a lift, a wheelchair, a
  -- parent bringing them.
  desk_note     text    NOT NULL DEFAULT '',
  status        text    NOT NULL DEFAULT 'booked'
                        CHECK (status IN ('booked', 'checked_in', 'roomed', 'with_clinician',
                                          'ready', 'done', 'no_show', 'cancelled')),
  checked_in_at timestamptz,
  cancelled_at  timestamptz,
  late_cancel   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_cancelled_is_stamped
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CONSTRAINT appointments_late_cancel_needs_a_cancellation
    CHECK (NOT late_cancel OR status = 'cancelled'),
  CONSTRAINT appointments_in_the_building_means_checked_in
    CHECK (checked_in_at IS NOT NULL
           OR status IN ('booked', 'no_show', 'cancelled'))
);

-- "See them again in six weeks", turned into a date the desk can sort by.
-- `from_appointment_id` survives the visit being tidied away, which is why it
-- is nullable and set null rather than cascading: the person is still due back.
CREATE TABLE recalls (
  id                  serial PRIMARY KEY,
  patient_id          integer NOT NULL REFERENCES patients (id)     ON DELETE CASCADE,
  from_appointment_id integer          REFERENCES appointments (id) ON DELETE SET NULL,
  due_on              date    NOT NULL,
  reason              text    NOT NULL DEFAULT '',
  booked              boolean NOT NULL DEFAULT false
);

-- Money ----------------------------------------------------------------------

-- One charge per visit, enforced: a second row against the same appointment is
-- how a patient ends up asked for the same fee twice.
CREATE TABLE charges (
  id             serial PRIMARY KEY,
  appointment_id integer        NOT NULL UNIQUE REFERENCES appointments (id) ON DELETE RESTRICT,
  amount         numeric(12, 2) NOT NULL CHECK (amount >= 0),
  created_at     timestamptz    NOT NULL DEFAULT now()
);

-- Part payments are ordinary — people pay what they have on them — so a charge
-- takes many rows here and the balance is the difference. Overpayment is
-- refused at the desk rather than by a constraint: the check needs the sum of
-- the other rows, which no CHECK can see. The desk refuses it instead of
-- clamping, because silently taking 60 against a balance of 45 and recording 45
-- is how a practice ends up owing someone money it has no record of.
CREATE TABLE payments (
  id        serial PRIMARY KEY,
  charge_id integer        NOT NULL REFERENCES charges (id) ON DELETE CASCADE,
  amount    numeric(12, 2) NOT NULL CHECK (amount > 0),
  method    text           NOT NULL DEFAULT 'card'
                           CHECK (method IN ('card', 'cash', 'transfer')),
  paid_at   timestamptz    NOT NULL DEFAULT now()
);

-- Days off -------------------------------------------------------------------

-- A NULL clinician means the whole practice is shut that day; a set one means
-- only that person is away. Nothing may be booked against either. The unique
-- pair stops one clinician being booked off the same day twice; NULLs compare
-- as distinct, so a practice-wide closure is not covered by it and does not
-- need to be — two rows saying the building is shut say the same true thing.
CREATE TABLE closures (
  id           serial PRIMARY KEY,
  clinician_id integer REFERENCES clinicians (id) ON DELETE CASCADE,
  on_date      date    NOT NULL,
  reason       text    NOT NULL DEFAULT '',
  UNIQUE (clinician_id, on_date)
);

-- Indexes the desk and the dashboard lean on ---------------------------------

-- The day sheet: one clinician's column, in order.
CREATE INDEX ON appointments (clinician_id, starts_at);
-- A patient's visit history, newest first.
CREATE INDEX ON appointments (patient_id, starts_at DESC);
CREATE INDEX ON appointments (visit_type_id);
-- The waiting board: only the four statuses that put someone in the building.
CREATE INDEX ON appointments (checked_in_at)
  WHERE status IN ('checked_in', 'roomed', 'with_clinician', 'ready');
-- The "hasn't arrived" strip and the no-show count both start here.
CREATE INDEX ON appointments (status, starts_at);

-- The returning-patient lookup is this pair and nothing else.
CREATE INDEX ON patients (phone, born_on);
CREATE INDEX ON patients (name);

-- Recalls: overdue first, and the booked ones are not what the list is for.
CREATE INDEX ON recalls (due_on) WHERE NOT booked;
CREATE INDEX ON recalls (patient_id, due_on);

-- Accounts: oldest charge first, because a small amount that has sat for six
-- weeks is the one worth a phone call and sorting by size would bury it.
CREATE INDEX ON charges (created_at);
CREATE INDEX ON payments (charge_id, paid_at);
-- "Taken today", across every method.
CREATE INDEX ON payments (paid_at);

CREATE INDEX ON closures (on_date);
