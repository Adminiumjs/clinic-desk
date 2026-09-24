# Clinic Desk

An appointment desk for a small practice, installed into
[Adminium](https://adminium.dev): the front desk's day, the patients' own
booking pages, an arrivals tablet at the door, and emailed reminders — all
running on your own database, as the people signed in to Adminium.

It is **not** a medical record system, and it is never a source of health
guidance. What it knows is who is coming, when, with which clinician, for how
long, whether they have arrived, how long they have waited, what they owe and
when they should be seen again. The reason for a visit is one short plain line
— "annual check", "knee follow-up", "dressing change" — and there is nothing
behind it; the one clinical-looking field is a short allergies note the front
desk needs to see. That boundary is in the tables, not just in this paragraph.

The sample practice is **Rowan Health**, a fictional four-clinician
neighbourhood practice, so the day reads like a real Tuesday morning.

**Live demo → [adminium.dev/demo/clinic-desk](https://adminium.dev/demo/clinic-desk)**

## What it is

- **The desk**, inside Adminium's Clinic section: the day sheet (one column
  per clinician, the time grid, the now line), the waiting room with its
  waits, patients, the week diary, the waiting list, registrations to check,
  accounts, recalls, hours & closures, the reminders outbox, end of day and
  the desk's settings. Every save is the signed-in person's, under their role
  and Adminium's audit trail. Another desk's changes arrive within a second.
- **The patients' pages**, at their own address: find a time (only times that
  are really free — the same booking rule the server applies when it saves),
  book as a returning patient (found by mobile number and date of birth) or as
  a first visit, a confirmation with an `.ics` file, My visits (after a code
  emailed to the address on file) to move or cancel, reminders & details, the
  earlier-time list, the clinicians, what a visit costs, find us, questions,
  and a register-with-us form. They use a browser key Adminium makes at
  install, which opens only those doors.
- **The arrivals kiosk**, on a tablet at the door: date of birth and mobile,
  "Thank you, Cormac — you're checked in", and back to the start. Nobody's name
  is ever listed.
- **The Overview**, the Clinic section's first page: the day's numbers, who is
  in the building, visits by clinician and hour, money taken and owed, what is
  waiting on the desk, and the week — drawn by Adminium's own dashboard widgets
  from your tables.
- **Emails**: a confirmation, a reminder at each patient's own lead time, a
  missed-visit note, a recall and a closure's cancellation, each in the
  patient's language (eight languages). Adminium sends them from the app's
  outbox table; the desk shows what went, what failed and what is coming.
- **Eight languages**, including Arabic right to left: English, German, French,
  Danish, Czech, Egyptian Arabic, Simplified and Traditional Chinese. Light and
  dark, desktop and phone width.

## Install

Clinic Desk needs **Adminium 0.3.0 or later** and a database Adminium is
connected to (Postgres, MySQL or SQLite).

1. In Adminium, open **Studio → Hosted apps** and install **Clinic Desk**
   ([Installing apps](https://docs.adminium.dev/self-hosting/installing-apps/)).
   It creates its eighteen `clinic_*` tables, the Clinic section's pages, four
   roles and two browser keys, and asks nothing.
2. Optionally tick **Add sample data** (or add it later from the app's settings
   page) — Rowan Health's clinicians, patients and a busy day, with statuses
   that match the clock when you add it, on working days (added on a Saturday,
   "today" is Monday). Removing it takes out only what it added; a sample
   clinician you have booked your own visit with is kept
   ([Sample data](https://docs.adminium.dev/guides/apps/sample-data/)).
3. Fill in **Practice settings** (Manage): the practice's name, address, phone,
   opening hours, the booking window and notice, the cancellation window,
   reminders, the currency.
4. Give people their roles (below), and set up email in Adminium so reminders
   can go out ([Emails](https://docs.adminium.dev/guides/apps/emails/)).
5. To open the patients' pages to the public, give them an address and switch
   them on on the app's settings page
   ([App addresses](https://docs.adminium.dev/self-hosting/app-domains/),
   [Public access](https://docs.adminium.dev/guides/apps/public-access/)).
   **Online booking** in the desk settings switches booking off without taking
   the pages down.

## Roles

| Role | What it may do |
| --- | --- |
| **Clinic reception** | The desk and the Records pages: book, move, check in, send off, take payments, registrations, recalls, the waiting list, closures, the outbox, end of day. Not: void a payment, write off, change opening hours or the desk settings. |
| **Clinic clinician** | The day sheet, the waiting room and patients (reading), and moving a visit along: in the room, with them, ready to go. |
| **Clinic manager** | Everything, the Manage pages included: voiding, write-offs, hours, settings. |
| **Clinic kiosk** | The arrivals kiosk and nothing else — no table at all. |

The desk shows each person the buttons their role allows, but the server is
what refuses: a hidden button is not a lock.

## The arrivals kiosk

1. Make a user for the tablet and give it only the **Clinic kiosk** role.
2. Sign that user in on the tablet, at the desk's address. It opens straight
   on the kiosk; there is no other screen to reach. **Staff** signs it out.
3. Switch **Arrivals kiosk** on in the desk settings.

A patient types their date of birth and mobile and is checked in for today's
visit, from an hour before it; earlier, the screen says when to come back.
The tablet's key answers only beside the kiosk sign-in, so a key copied off
the tablet opens nothing elsewhere. If a tablet goes missing, suspend its user
or switch the kiosk off.

## Reminders and the outbox

Reminders go by email at each patient's chosen lead (12, 24 or 48 hours; the
practice's default otherwise), once per visit time — a moved visit gets a fresh
one. The desk's **Send now** sends one early, and the automatic one does not
follow. Switching reminders off in the desk settings stops reminders and
missed-visit notes, not booking confirmations. A first visit booked online is
confirmed only once the desk has checked it (an address nobody has proved gets
no mail). Sample rows never produce a message, and addresses on reserved
domains (`example.com`) are never sent to.

## The demo

The demo is the same screens on an in-browser copy of the sample practice,
pinned to Tuesday 28 July 2026, 09:20 in London. On the website it is driven
by the demo card: the **Patient** / **Clinic** switch, a screen for each page,
shortcuts that fill a form or make something happen, **+15 min** and back to
the start. Book a time as a patient, switch to Clinic, and it is on the day
sheet.

Locally:

```bash
npm install
```

```bash
npm run dev
```

Open the address Vite prints. One screen directly:
`?persona=clinic&view=waiting&theme=dark&lang=ar-EG`.

## Development

| Script | What it does |
| --- | --- |
| `npm run dev` | The demo, on Vite's dev server. |
| `npm test` | The unit, manifest and build tests. |
| `npm run build:surface` | The two sides Adminium serves: `dist-surface/clinic/staff` and `…/customer`. |
| `npm run build:demo` | The website's demo, at base `/demo/clinic-desk/app/`. |
| `npm run manifest` | Write `manifest.json` from `src/manifest/` (never edit it by hand). |
| `npm run sample` | Write the sample bundle, `db/schema.sql` and `db/seed.sql` from `src/data/sample.ts`. |

`manifest.json` — the tables and their rules (the booking rule, stamps, the
capped balance), pages, roles, public access, the outbox and the email
templates — is generated from typed modules in `src/manifest/`, with every
label in eight languages; the drift test fails when the two disagree.

## Self-host stack

[`docker-compose.yml`](docker-compose.yml) brings up Postgres seeded with the
sample practice (the design's Tuesday, fixed), an Adminium instance pointed at
it, and the demo on <http://localhost:8080>:

```bash
cp .env.example .env      # then set ADMINIUM_SECRET — e.g. openssl rand -hex 32
docker compose up
```

Adminium is on <http://localhost:4600>. `DEMO_DATA=0` in `.env` boots with the
schema and no rows; `npm run demo:status | demo:import | demo:wipe |
demo:reset` move the seeded rows in and out afterwards
([db/README.md](db/README.md)).

## Out of scope

- **Anything clinical**: no diagnoses, codes, medicines, results or notes.
- **Taking card payments**: the desk records what was taken, by card, cash or
  transfer; it does not charge anyone.
- **Text messages**: reminders are email only.

## License

[AGPL-3.0](LICENSE) © 2026 Clinic Desk. An example app for Adminium.
