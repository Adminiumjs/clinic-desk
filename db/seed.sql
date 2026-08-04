-- Clinic Desk — seed data.
--
-- Mirrors src/data/demo.ts one for one: the same four clinicians, the same
-- thirty patients aged 6 to 84, the same forty appointments, the same twenty
-- charges and fifteen payments. Run the app and the generated dashboard side by
-- side and they show the same practice, down to the forty-day-old balance and
-- the person who has not turned up.
--
-- The clock is pinned the same way the app pins it: "now" is Tuesday
-- 28 July 2026, 09:20. Every timestamp below carries an explicit +01 offset
-- because the practice keeps British summer time through this whole stretch, so
-- 09:15 in the app is 09:15 here rather than an hour adrift.
--
-- Read the morning off the seed and it is the same one the app opens on:
--   • RH-4001, RH-4002 and RH-4007 have been seen and have left;
--   • RH-4003, RH-4009, RH-4012 and RH-4016 are in the building, checked in at
--     08:33, 09:14, 08:58 and 08:46 — so at 09:20 they have been waiting 47, 6,
--     22 and 34 minutes, which is one calm card, two amber and one danger;
--   • RH-4008 was due at 09:00 and never arrived, which is the "hasn't arrived"
--     strip twenty minutes in;
--   • six charges are still open, the oldest raised on 18 June;
--   • five people are due to be seen again, two of them already overdue.
--
-- Ids are explicit so the fixture is stable and the foreign keys below are
-- readable; every sequence is reset at the bottom so the next row the desk
-- writes does not collide with one of these.
--
-- Everything here is invention. The clinicians, the patients, the reasons for
-- visiting and the amounts owed are props for a fictional neighbourhood
-- practice, and no real practice, person or insurer is named.

BEGIN;

-- Who works here -------------------------------------------------------------

-- Two GPs, a physiotherapist and a practice nurse. `role` is also the rule
-- about who takes what, which is why Nadia never appears in the chooser for a
-- routine check.
INSERT INTO clinicians (id, name, initials, role, color, active) VALUES
  (1, 'Dr Amara Osei',  'AO', 'gp',              '#0369a1', true),
  (2, 'Dr Piotr Nowak', 'PN', 'gp',              '#7c3aed', true),
  (3, 'Nadia Haddad',   'NH', 'physiotherapist', '#0d9488', true),
  (4, 'Tom Villasenor', 'TV', 'nurse',           '#b25e09', true);

-- Monday to Friday, 08:30 to 17:30, lunch 12:30 to 13:15. There is no Saturday
-- or Sunday row, which is the whole of why the practice shuts at the weekend —
-- no rule about weekends is stored anywhere.
INSERT INTO clinician_hours (id, clinician_id, weekday, opens, closes, break_start, break_end)
SELECT (c.id - 1) * 5 + w.n, c.id, w.day, '08:30', '17:30', '12:30', '13:15'
FROM clinicians c
CROSS JOIN (VALUES (1, 'mon'), (2, 'tue'), (3, 'wed'), (4, 'thu'), (5, 'fri')) AS w (n, day);

-- What can be booked, how long it runs and what it costs. The 45-minute
-- physiotherapy session is the one that makes the slot grid interesting: it
-- needs three consecutive quarter-hours, so it fits in far fewer places than
-- the 15-minute dressing change.
INSERT INTO visit_types (id, name, minutes, fee, color) VALUES
  (1, 'Routine check', 15, 45.00, '#0369a1'),
  (2, 'New patient',   30, 80.00, '#7c3aed'),
  (3, 'Physiotherapy', 45, 60.00, '#0d9488'),
  (4, 'Nurse',         15, 25.00, '#b25e09');

-- Who comes here -------------------------------------------------------------

-- Thirty patients. Ages are never stored — six to eighty-four is what these
-- dates of birth come to against 28 July 2026.
--
-- `created_at` is the day the practice's records were brought across, except
-- for the four people whose first visit is in this seed: their record was made
-- when they rang up, which is the day their new-patient booking was taken.
--
-- The desk keeps a mobile number and a date of birth, and that pair is the
-- returning-patient lookup. It keeps no email address for anyone, because
-- nothing it sends goes anywhere but a phone. Insurer and policy are the
-- practice's note about who settles the account; nobody in the seeded fiction
-- has one on file yet.
INSERT INTO patients (id, name, initials, born_on, phone, allergies_note, created_at) VALUES
  ( 1, 'Mira Ashworth',    'MA', '1987-03-14', '07700 900401', 'Latex',              '2026-01-05 09:00+00'),
  ( 2, 'Dev Ramchandani',  'DR', '1992-11-02', '07700 900402', '',                   '2026-01-05 09:00+00'),
  ( 3, 'Hazel Boone',      'HB', '1942-01-19', '07700 900403', '',                   '2026-01-05 09:00+00'),
  ( 4, 'Otis Delacroix',   'OD', '2020-05-08', '07700 900404', 'Peanuts',            '2026-01-05 09:00+00'),
  ( 5, 'June Kowalczyk',   'JK', '1968-07-30', '07700 900405', '',                   '2026-01-05 09:00+00'),
  ( 6, 'Felix Nwachukwu',  'FN', '1979-09-22', '07700 900406', '',                   '2026-01-05 09:00+00'),
  ( 7, 'Sana Rehman',      'SR', '2001-02-11', '07700 900407', '',                   '2026-07-15 08:55+01'),
  ( 8, 'Bram Vandenberg',  'BV', '1955-12-05', '07700 900408', 'Adhesive dressings', '2026-01-05 09:00+00'),
  ( 9, 'Ines Moreau',      'IM', '1996-06-17', '07700 900409', '',                   '2026-06-11 14:02+01'),
  (10, 'Teo Marchetti',    'TM', '2013-08-25', '07700 900410', '',                   '2026-01-05 09:00+00'),
  (11, 'Willa Okafor',     'WO', '1983-04-03', '07700 900411', '',                   '2026-01-05 09:00+00'),
  (12, 'Arjun Bhatt',      'AB', '1974-10-29', '07700 900412', '',                   '2026-01-05 09:00+00'),
  (13, 'Nell Fitzgerald',  'NF', '1949-02-27', '07700 900413', 'Shellfish',          '2026-01-05 09:00+00'),
  (14, 'Kofi Mensah',      'KM', '1990-12-13', '07700 900414', '',                   '2026-01-05 09:00+00'),
  (15, 'Lyra Petrov',      'LP', '2016-03-30', '07700 900415', 'Peanuts',            '2026-01-05 09:00+00'),
  (16, 'Hana Sorensen',    'HS', '1965-05-21', '07700 900416', '',                   '2026-01-05 09:00+00'),
  (17, 'Milo Ferreira',    'MF', '2008-11-07', '07700 900417', '',                   '2026-01-05 09:00+00'),
  (18, 'Rosa Iglesias',    'RI', '1971-01-08', '07700 900418', '',                   '2026-01-05 09:00+00'),
  (19, 'Yusuf Demir',      'YD', '1986-08-16', '07700 900419', '',                   '2026-01-05 09:00+00'),
  (20, 'Edith Blackwood',  'EB', '1946-06-04', '07700 900420', 'Latex',              '2026-01-05 09:00+00'),
  (21, 'Noor Al-Sayed',    'NA', '1998-09-09', '07700 900421', '',                   '2026-07-20 08:40+01'),
  (22, 'Gus Lindqvist',    'GL', '1961-04-15', '07700 900422', '',                   '2026-01-05 09:00+00'),
  (23, 'Priya Anand',      'PA', '1994-02-23', '07700 900423', '',                   '2026-01-05 09:00+00'),
  (24, 'Tam Nguyen',       'TN', '1977-07-12', '07700 900424', '',                   '2026-01-05 09:00+00'),
  (25, 'Iris Vaughan',     'IV', '2011-10-01', '07700 900425', 'Bee stings',         '2026-01-05 09:00+00'),
  (26, 'Omar Haddadi',     'OH', '1959-03-06', '07700 900426', '',                   '2026-01-05 09:00+00'),
  (27, 'Betty Ochoa',      'BO', '1952-08-19', '07700 900427', '',                   '2026-01-05 09:00+00'),
  (28, 'Jonah Kessler',    'JK', '2004-05-27', '07700 900428', '',                   '2026-07-16 10:05+01'),
  (29, 'Clem Aubrey',      'CA', '1981-12-30', '07700 900429', '',                   '2026-01-05 09:00+00'),
  (30, 'Saoirse Byrne',    'SB', '1969-11-11', '07700 900430', '',                   '2026-01-05 09:00+00');

-- The appointment book -------------------------------------------------------

-- References run in booking order, not visit order: RH-3981…RH-4000 are the
-- visits that have already happened, RH-4001…RH-4019 are today, and RH-4020 is
-- the one future booking. The next reference the desk mints is RH-4021, which
-- is what the confirmation screen shows.

-- The visits that have already happened. Two ended badly on purpose: RH-3998
-- was cancelled two days ahead, so it is not a late cancellation, and RH-3999
-- and RH-4000 are yesterday's no-shows — which is what the accounts view counts
-- when it says how the week has gone.
INSERT INTO appointments
  (id, ref, patient_id, clinician_id, visit_type_id, starts_at, minutes, reason, desk_note,
   status, checked_in_at, cancelled_at, late_cancel)
VALUES
  ( 1, 'RH-3981',  3, 1, 1, '2026-06-02 09:00+01', 15, 'Blood pressure check',     '', 'done',      '2026-06-02 08:52+01', NULL, false),
  ( 2, 'RH-3982', 10, 4, 4, '2026-06-09 10:30+01', 15, 'Travel vaccination',       '', 'done',      '2026-06-09 10:24+01', NULL, false),
  ( 3, 'RH-3983', 17, 3, 3, '2026-06-11 14:00+01', 45, 'Wrist follow-up',          '', 'done',      '2026-06-11 13:53+01', NULL, false),
  ( 4, 'RH-3984', 19, 2, 1, '2026-06-16 11:15+01', 15, 'Annual check',             '', 'done',      '2026-06-16 11:08+01', NULL, false),
  ( 5, 'RH-3985', 20, 1, 1, '2026-06-18 09:45+01', 15, 'Follow-up review',         '', 'done',      '2026-06-18 09:35+01', NULL, false),
  ( 6, 'RH-3986', 30, 4, 4, '2026-06-23 15:00+01', 15, 'Dressing change',          '', 'done',      '2026-06-23 14:54+01', NULL, false),
  ( 7, 'RH-3987',  8, 2, 1, '2026-06-25 10:00+01', 15, 'Blood pressure check',     '', 'done',      '2026-06-25 09:50+01', NULL, false),
  ( 8, 'RH-3988', 16, 3, 3, '2026-06-30 09:15+01', 45, 'Shoulder follow-up',       '', 'done',      '2026-06-30 09:08+01', NULL, false),
  ( 9, 'RH-3989',  5, 1, 1, '2026-07-01 14:15+01', 15, 'Annual check',             '', 'done',      '2026-07-01 14:07+01', NULL, false),
  (10, 'RH-3990',  9, 2, 2, '2026-07-02 09:00+01', 30, 'New patient registration', '', 'done',      '2026-07-02 08:48+01', NULL, false),
  (11, 'RH-3991',  4, 4, 4, '2026-07-07 11:00+01', 15, 'Child check',              '', 'done',      '2026-07-07 10:51+01', NULL, false),
  (12, 'RH-3992', 12, 3, 3, '2026-07-10 13:15+01', 45, 'Knee follow-up',           '', 'done',      '2026-07-10 13:08+01', NULL, false),
  (13, 'RH-3993',  6, 1, 1, '2026-07-14 16:00+01', 15, 'Follow-up review',         '', 'done',      '2026-07-14 15:51+01', NULL, false),
  (14, 'RH-3994', 27, 4, 4, '2026-07-15 09:30+01', 15, 'Dressing change',          '', 'done',      '2026-07-15 09:21+01', NULL, false),
  (15, 'RH-3995', 13, 2, 1, '2026-07-16 10:45+01', 15, 'Blood pressure check',     '', 'done',      '2026-07-16 10:34+01', NULL, false),
  (16, 'RH-3996', 11, 1, 1, '2026-07-17 09:15+01', 15, 'Ear check',                '', 'done',      '2026-07-17 09:09+01', NULL, false),
  (17, 'RH-3997', 14, 3, 3, '2026-07-20 11:15+01', 45, 'Back follow-up',           '', 'done',      '2026-07-20 11:07+01', NULL, false),
  (18, 'RH-3998', 23, 2, 1, '2026-07-22 15:15+01', 15, 'Follow-up review',         '', 'cancelled', NULL,                  '2026-07-20 11:05+01', false),
  (19, 'RH-3999', 22, 1, 1, '2026-07-27 09:30+01', 15, 'Blood pressure check',     '', 'no_show',   NULL,                  NULL, false),
  (20, 'RH-4000', 25, 4, 4, '2026-07-27 14:30+01', 15, 'Stitches out',             '', 'no_show',   NULL,                  NULL, false);

-- The app carries no booking timestamp, so these are set three weeks before
-- each visit: far enough back to be plausible, and ordered the same way the
-- references are.
UPDATE appointments SET created_at = starts_at - interval '21 days' WHERE id <= 20;

-- Today — Tuesday 28 July 2026, read at 09:20.
INSERT INTO appointments
  (id, ref, patient_id, clinician_id, visit_type_id, starts_at, minutes, reason, desk_note,
   status, checked_in_at, cancelled_at, late_cancel, created_at)
VALUES
  -- Dr Amara Osei
  (21, 'RH-4001',  1, 1, 1, '2026-07-28 08:30+01', 15, 'Blood pressure check',     '',
   'done',           '2026-07-28 08:25+01', NULL, false, '2026-07-14 09:12+01'),
  (22, 'RH-4002',  2, 1, 1, '2026-07-28 08:45+01', 15, 'Follow-up review',         '',
   'done',           '2026-07-28 08:40+01', NULL, false, '2026-07-14 11:40+01'),
  (23, 'RH-4003',  7, 1, 2, '2026-07-28 09:00+01', 30, 'New patient registration',
   'Coming straight from work, so may be a few minutes early.',
   'with_clinician', '2026-07-28 08:33+01', NULL, false, '2026-07-15 08:55+01'),
  (24, 'RH-4004',  5, 1, 1, '2026-07-28 09:45+01', 15, 'Annual check',             '',
   'booked',         NULL,                  NULL, false, '2026-07-15 14:20+01'),
  (25, 'RH-4005', 28, 1, 2, '2026-07-28 10:30+01', 30, 'New patient registration', '',
   'booked',         NULL,                  NULL, false, '2026-07-16 10:05+01'),
  (26, 'RH-4006', 26, 1, 1, '2026-07-28 14:00+01', 15, 'Blood pressure check',
   'Uses a wheelchair. Please keep the ground-floor room.',
   'booked',         NULL,                  NULL, false, '2026-07-16 15:48+01'),

  -- Dr Piotr Nowak
  (27, 'RH-4007', 14, 2, 1, '2026-07-28 08:45+01', 15, 'Follow-up review',         '',
   'done',           '2026-07-28 08:38+01', NULL, false, '2026-07-17 09:30+01'),
  -- Due at 09:00 and not here: at 09:20 this is the "hasn't arrived" strip.
  (28, 'RH-4008',  6, 2, 1, '2026-07-28 09:00+01', 15, 'Annual check',             '',
   'booked',         NULL,                  NULL, false, '2026-07-17 12:15+01'),
  (29, 'RH-4009', 21, 2, 2, '2026-07-28 09:30+01', 30, 'New patient registration', '',
   'checked_in',     '2026-07-28 09:14+01', NULL, false, '2026-07-20 08:40+01'),
  (30, 'RH-4010', 13, 2, 1, '2026-07-28 11:00+01', 15, 'Annual check',             '',
   'booked',         NULL,                  NULL, false, '2026-07-20 13:55+01'),
  (31, 'RH-4011', 18, 2, 1, '2026-07-28 16:00+01', 15, 'Follow-up review',         '',
   'booked',         NULL,                  NULL, false, '2026-07-21 10:25+01'),

  -- Nadia Haddad
  (32, 'RH-4012', 12, 3, 3, '2026-07-28 09:15+01', 45, 'Knee follow-up',           '',
   'checked_in',     '2026-07-28 08:58+01', NULL, false, '2026-07-21 16:10+01'),
  (33, 'RH-4013', 16, 3, 3, '2026-07-28 10:15+01', 45, 'Shoulder follow-up',       '',
   'booked',         NULL,                  NULL, false, '2026-07-22 09:05+01'),
  (34, 'RH-4014', 22, 3, 3, '2026-07-28 11:15+01', 45, 'Back follow-up',           '',
   'booked',         NULL,                  NULL, false, '2026-07-22 14:35+01'),
  (35, 'RH-4015', 24, 3, 3, '2026-07-28 13:15+01', 45, 'Ankle follow-up',          '',
   'booked',         NULL,                  NULL, false, '2026-07-23 11:20+01'),

  -- Tom Villasenor
  (36, 'RH-4016', 27, 4, 4, '2026-07-28 08:45+01', 15, 'Dressing change',          '',
   'roomed',         '2026-07-28 08:46+01', NULL, false, '2026-07-23 15:05+01'),
  (37, 'RH-4017', 10, 4, 4, '2026-07-28 09:15+01', 15, 'Flu vaccination',          '',
   'booked',         NULL,                  NULL, false, '2026-07-24 09:50+01'),
  (38, 'RH-4018', 15, 4, 4, '2026-07-28 10:00+01', 15, 'Child check',
   'Her father is bringing her.',
   'booked',         NULL,                  NULL, false, '2026-07-24 13:30+01'),
  (39, 'RH-4019', 25, 4, 4, '2026-07-28 11:30+01', 15, 'Stitches out',             '',
   'booked',         NULL,                  NULL, false, '2026-07-27 10:15+01'),

  -- The one booking beyond today.
  (40, 'RH-4020',  5, 1, 1, '2026-08-11 10:00+01', 15, 'Follow-up review',         '',
   'booked',         NULL,                  NULL, false, '2026-07-27 16:40+01');

-- Who is due back ------------------------------------------------------------

-- "See them again in N weeks", counted forward from the visit it came from.
-- Two are already overdue at the pinned date — Hazel by a fortnight, Hana by a
-- week — one is due today, and two fall later this week. None is marked booked,
-- which is exactly why the list has five rows on it.
INSERT INTO recalls (id, patient_id, from_appointment_id, due_on, reason, booked) VALUES
  (1,  3, 1, '2026-07-14', 'Blood pressure check', false),  -- six weeks from 2 June
  (2, 19, 4, '2026-07-28', 'Annual check',         false),  -- six weeks from 16 June
  (3,  8, 7, '2026-07-30', 'Blood pressure check', false),  -- five weeks from 25 June
  (4, 16, 8, '2026-07-21', 'Shoulder follow-up',   false),  -- three weeks from 30 June
  (5,  5, 9, '2026-07-29', 'Annual check',         false);  -- four weeks from 1 July

-- Money ----------------------------------------------------------------------

-- One charge per visit that happened, raised as the patient leaves — so the
-- timestamp is the end of the visit, not the start of it. Whole pounds: this is
-- a price list where everything ends in a five and pence would be noise.
INSERT INTO charges (id, appointment_id, amount, created_at) VALUES
  ( 1,  1, 45.00, '2026-06-02 09:15+01'),
  ( 2,  2, 25.00, '2026-06-09 10:45+01'),
  ( 3,  3, 60.00, '2026-06-11 14:45+01'),
  ( 4,  4, 45.00, '2026-06-16 11:30+01'),
  ( 5,  5, 45.00, '2026-06-18 10:00+01'),   -- Edith: still open, and the oldest
  ( 6,  6, 25.00, '2026-06-23 15:15+01'),
  ( 7,  7, 45.00, '2026-06-25 10:15+01'),
  ( 8,  8, 60.00, '2026-06-30 10:00+01'),
  ( 9,  9, 45.00, '2026-07-01 14:30+01'),   -- June: still open
  (10, 10, 80.00, '2026-07-02 09:30+01'),
  (11, 11, 25.00, '2026-07-07 11:15+01'),
  (12, 12, 60.00, '2026-07-10 14:00+01'),
  (13, 13, 45.00, '2026-07-14 16:15+01'),
  (14, 14, 25.00, '2026-07-15 09:45+01'),   -- Betty: still open
  (15, 15, 45.00, '2026-07-16 11:00+01'),   -- Nell: still open
  (16, 16, 45.00, '2026-07-17 09:30+01'),   -- Willa: part paid, 25 left
  (17, 17, 60.00, '2026-07-20 12:00+01'),   -- Kofi: still open
  (18, 21, 45.00, '2026-07-28 08:45+01'),
  (19, 22, 45.00, '2026-07-28 09:00+01'),
  (20, 27, 45.00, '2026-07-28 09:00+01');

-- What has actually been taken. Charge 16 carries a part payment on purpose, so
-- the outstanding list has one row that is neither open nor settled — the case
-- a payment check that clamped instead of refusing would quietly get wrong.
-- Six charges are left with something owing: 5, 9, 14, 15, 16 and 17.
INSERT INTO payments (id, charge_id, amount, method, paid_at) VALUES
  ( 1,  1, 45.00, 'card',     '2026-06-02 09:16+01'),
  ( 2,  2, 25.00, 'cash',     '2026-06-09 10:46+01'),
  ( 3,  3, 60.00, 'card',     '2026-06-11 14:46+01'),
  ( 4,  4, 45.00, 'card',     '2026-06-16 11:31+01'),
  ( 5,  6, 25.00, 'cash',     '2026-06-23 15:16+01'),
  ( 6,  7, 45.00, 'transfer', '2026-06-25 16:40+01'),
  ( 7,  8, 60.00, 'card',     '2026-06-30 10:01+01'),
  ( 8, 10, 80.00, 'card',     '2026-07-02 09:31+01'),
  ( 9, 11, 25.00, 'cash',     '2026-07-07 11:16+01'),
  (10, 12, 60.00, 'card',     '2026-07-10 14:01+01'),
  (11, 13, 45.00, 'card',     '2026-07-14 16:16+01'),
  (12, 16, 20.00, 'cash',     '2026-07-21 11:20+01'),   -- twenty of forty-five
  (13, 18, 45.00, 'card',     '2026-07-28 08:46+01'),
  (14, 19, 45.00, 'cash',     '2026-07-28 09:01+01'),
  (15, 20, 45.00, 'card',     '2026-07-28 09:01+01');

-- Days off -------------------------------------------------------------------

-- Deliberately empty. Nobody is away in the fortnight this seed covers, and a
-- closure the app does not know about would be a day the dashboard says is shut
-- while the booking screen carries on offering times on it.

-- Sequences ------------------------------------------------------------------

-- Every id above was written by hand, so the sequences have never moved. Reset
-- them to the highest id in each table — or to the start, for the table nobody
-- has written a row into yet — so the first row the desk saves does not land on
-- one of these.
SELECT setval(pg_get_serial_sequence('clinicians',      'id'), (SELECT max(id) FROM clinicians));
SELECT setval(pg_get_serial_sequence('clinician_hours', 'id'), (SELECT max(id) FROM clinician_hours));
SELECT setval(pg_get_serial_sequence('visit_types',     'id'), (SELECT max(id) FROM visit_types));
SELECT setval(pg_get_serial_sequence('patients',        'id'), (SELECT max(id) FROM patients));
SELECT setval(pg_get_serial_sequence('appointments',    'id'), (SELECT max(id) FROM appointments));
SELECT setval(pg_get_serial_sequence('recalls',         'id'), (SELECT max(id) FROM recalls));
SELECT setval(pg_get_serial_sequence('charges',         'id'), (SELECT max(id) FROM charges));
SELECT setval(pg_get_serial_sequence('payments',        'id'), (SELECT max(id) FROM payments));
SELECT setval(pg_get_serial_sequence('closures',        'id'), 1, false);

COMMIT;
