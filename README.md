# Clinic Desk

A complete, production-shaped appointment desk — built with Vite + React +
TypeScript, no CSS framework, no backend required. It's an example app that
ships with [Adminium](https://adminium.dev): book a visit as a patient, then
switch to the desk and run the morning — check people in, watch the waiting
times climb, take a payment, chase the people who are due back.

It is **not** a medical record system, and it is never a source of health
guidance. What it knows is who is coming, when, with which clinician, for how
long, whether they have arrived, how long they have been waiting, what they owe
and when they should be seen again. The reason for a visit is one short plain
line — "annual check", "knee follow-up", "dressing change" — and there is
nothing behind it. That boundary is in the types, the seed and the copy, not
just in this paragraph.

The demo is dressed as **Rowan Health**, a fictional four-clinician
neighbourhood practice, so the day reads like a real Tuesday morning rather
than lorem ipsum: three people already seen, four in the building at different
waiting times, one who has not turned up, six accounts still open.

**Live demo → [adminium.dev/demo/clinic-desk](https://adminium.dev/demo/clinic-desk)**

## What it does

- **Two personas in one build.** The demo dock switches between the public
  booking site and the desk. The loop closes across the switch: book a time as
  a patient, switch to **Clinic**, and the new visit is already in the right
  column of the day sheet.

- **A real scheduling engine.**
  [`src/lib/schedule.ts`](src/lib/schedule.ts) is a pure, React-free module:
  slot generation from opening hours and appointment length, lunch and closing
  rules, double-book prevention, the visit state machine, waiting times from
  the check-in stamp, the no-show window, ages from dates of birth, the
  outstanding ledger with aging, and recall dates from "see them again in N
  weeks". Nothing is stored pre-computed, because a stored waiting time is
  wrong fifteen minutes later. 75 assertions in
  [`schedule.test.ts`](src/lib/schedule.test.ts) run against the shipped seed.

- **Scheduling rules you can see.** A 45-minute physiotherapy session offers
  visibly fewer starts than a 15-minute dressing change, because three
  consecutive quarter-hours have to be open. A start that would overrun the
  12:30 break or the 17:30 close is simply never offered. This morning's
  earlier times are drawn and struck through rather than quietly removed. A day
  with nothing left names the next day that works and offers it as a button.

- **A day sheet built on a time grid.** One column per clinician, quarter-hour
  rows, blocks sized to their own length and tinted by visit type, hatched
  lunch, and a "now" line drawn from the pinned clock. Under 900px it scrolls
  sideways one clinician at a time with scroll-snap.

- **Money that refuses to lie.** The record-payment popover takes partial
  amounts and **refuses** an overpayment rather than clamping it — silently
  taking £60 against a £45 balance and recording £45 is how a desk ends up
  owing someone money it has no record of. The balance updates live on the
  accounts view, the patient panel and the patient's own visit list.

- **Eight languages, including a right-to-left one.** English, German, French,
  Czech, Danish, Simplified and Traditional Chinese, and Egyptian Arabic.
  Plurals go through `Intl.PluralRules` in each locale's own CLDR order —
  Czech gets its three forms, Arabic its six. The seeded prose is stored as
  translation keys, so it moves with the chrome rather than leaving an English
  island inside a translated screen.

- **RTL by construction.** Every positional rule in the stylesheets is a CSS
  logical property, so stamping `dir="rtl"` on `<html>` mirrors the sidebar,
  the day sheet's gutter, the recall list's leading border and the demo dock
  with no second stylesheet. Times, amounts and references are isolated so the
  bidi algorithm cannot reorder their digits — "09:20" never becomes "20:09".

- **Light / dark themes** via CSS custom properties. The app follows your
  operating system on first load; the dock's sun/moon toggle latches it.

- **A pinned clock you crank by hand.** Nothing user-visible reads
  `Date.now()`. "Now" is Tuesday 28 July 2026, 09:20, so every machine opens on
  the same amber waiting chip and the same person who has not arrived. The
  dock's **+15 min** chip is the only thing that moves it.

- **No bitmaps, no external requests.** Clinicians and patients are initials on
  layered gradients derived from a per-record tint. Fonts are self-hosted
  woff2. The app works offline and behind a firewall.

## Local development

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

### Driving the demo

The dock in the corner is the demo. Everything else is the product.

| Control | What it does |
| --- | --- |
| **Patient / Clinic** | Switches persona. The loop closes across it — this is the thing to show. |
| **+15 min** | Moves the pinned clock on a quarter of an hour. Everything time-derived re-reads it. |
| **Language** | Eight locales, including Arabic, which flips the whole layout to RTL. |
| **Theme** | Latches light or dark over the OS preference. |
| **Reset** | Puts the seeded day back the way it started, clock included. |

A ninety-second tour: **Find a time** → pick *Physiotherapy* and notice the
grid thin out → take a slot → tap the demo hint chip on the lookup and confirm
→ switch to **Clinic** → the booking is on the day sheet under Dr Amara Osei →
**Waiting room** → Betty Ochoa has been waiting 34 minutes, and Felix Nwachukwu
is on the "hasn't arrived" strip → tap **+15 min** twice and watch both change
→ **Accounts** → take a part payment off the forty-day-old balance → **Recalls**
→ book Hazel Boone back in.

## Deploy

- **Vercel** — import the repo. Build command `npm run build`, output `dist`.
- **DigitalOcean App Platform** — import the repo; it builds with the same
  command.
- **Host anywhere** — `npm run build` produces a fully static `dist/` you can
  drop on any static host (Netlify, Cloudflare Pages, S3, GitHub Pages…). Or
  build the container:

  ```bash
  docker build -t clinic-desk .
  ```

### Build scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check + build to `dist/` at base `/` (root deploys). |
| `npm run build:demo` | Build to `dist/` at base `/demo/clinic-desk/` (Adminium demo). |
| `npm run preview` | Preview a production build locally. |
| `npm test` | Run the scheduling engine suite. |

## Full implementation (self-host)

There are two ways to run this practice.

**One click — the frontend on its own.** The deploy routes above put the
appointment desk up by itself, running on the bundled demo day. No database, no
dashboard — a fully static preview.

**One command — the whole stack.**
[`docker-compose.yml`](docker-compose.yml) stands up Postgres (seeded by
default with the *same* clinicians, patients, appointments, charges and
payments), an auto-generated Adminium dashboard that runs that real database,
and the desk:

```bash
cp .env.example .env      # then set ADMINIUM_SECRET — e.g. openssl rand -hex 32
docker compose up
```

- **Appointment desk** → http://localhost:8080
- **Adminium dashboard** → http://localhost:4600

On first boot, `clinic-db` applies [`db/schema.sql`](db/schema.sql), installs
the demo bookkeeping from [`db/demo-toolkit.sql`](db/demo-toolkit.sql), and then
[`db/init-demo.sh`](db/init-demo.sh) loads [`db/seed.sql`](db/seed.sql) unless
you set `DEMO_DATA=0`. Adminium imports the practice database (`rowan`) as its
first source connection, introspects the schema, and generates the back office.
Finish the ~1-minute first-run wizard at `:4600` — it's pre-pointed at the
practice DB. The install spec Adminium reads to configure itself is
[`manifest.json`](manifest.json).

The seed is the app's own day, not a second fiction: the same Tuesday morning
pinned to 28 July 2026, the same four clinicians, the same thirty patients, the
same forty appointments, the same forty-day-old balance. Open the dashboard and
Betty Ochoa is the row you were just looking at on the waiting board.

### Demo data

Rowan Health arrives seeded, so the desk and the dashboard both have a day in
them the moment they come up. For an empty database with the same full schema,
set `DEMO_DATA=0` in `.env` before the first `docker compose up`. Neither choice
is permanent — the demo rows go in and out afterwards with four commands:

| Command | What it does |
| --- | --- |
| `npm run demo:status` | What is loaded right now, table by table. |
| `npm run demo:import` | Load [`db/seed.sql`](db/seed.sql). |
| `npm run demo:wipe` | Remove the demo rows. The schema and your own rows stay. |
| `npm run demo:reset` | Wipe, then import a fresh copy. |

A wipe deletes only the rows the seed put there, so a patient you registered
yourself is still on the board afterwards, and a demo row your own data depends
on is kept rather than deleted under it. `ON DELETE CASCADE` is the exception:
a payment you recorded against a demo charge goes when that charge does,
because that is what [`db/schema.sql`](db/schema.sql) says should happen, and
those rows are counted separately as `cascaded` rather than folded into the
total. `wipe` and `reset` ask before they run; `npm run demo:wipe -- --yes`
skips the question. Set `DATABASE_URL` to point any of them at a Postgres
elsewhere — Neon, Supabase, RDS — instead of the compose container.
[db/README.md](db/README.md) has the rest.

## The split: the desk and the back office

The app you deploy is **the front desk and the day**. The dashboard Adminium
generates from your schema is **the back office**. That is the product story,
not a limitation:

| In this app | In the generated dashboard |
| --- | --- |
| Who is coming, and when | Every table as records, with full CRUD |
| Checking people in and moving them through | Registering, merging and archiving patients |
| What is owed, and taking it at the desk | Reporting across the whole history |
| Who is due to be seen again | Imports, exports and bulk edits |

The manifest scaffolds 9 tables, 6 dashboard pages, 2 access presets
(`front-desk`, `clinician`) and 7 settings into your connected database. The
record boundary holds on both sides of the split: there is no column anywhere in
[`db/schema.sql`](db/schema.sql) for a diagnosis, a code, a medicine or a
result, and there is no page in the manifest that would show one.

## Connecting to Adminium

All data access goes through a thin `DataSource` interface
([`src/data/source.ts`](src/data/source.ts)) with a single `demoSource`
implementation backed by the bundled seed. **Today the deployed demo is demo
data only — nothing is persisted, no card is charged and no message is sent.**
Once Adminium's browser-safe publishable key (`adm_pub_…`) ships, the frontend
will read and write live data through the Adminium records API via a second
`DataSource` implementation, without touching any of the screens or the store.
The seam is already in place; the key is the only missing piece.

### What is deliberately out of scope

- **Anything clinical.** No diagnoses, no codes, no medicines, no results, no
  notes from a clinician. An allergies chip is as far as it goes, because a
  real front desk carries one. This is the appointment book, not the record.
- **Sending the reminder text.** The confirmation says a text has gone out; the
  demo does not send one. Outbound messaging needs a job runner this version
  does not have.
- **Editing who works when.** Per-clinician availability is reference data the
  practice maintains in the generated dashboard.
- **Taking a real payment.** The card sheet says so in as many words before you
  type a digit.

## Project structure

```
src/
  app/         App shell + the exhaustive 10-view switch
  state/       Zustand store (persona, the pinned clock, appointments,
               charges, payments, the booking draft, toasts)
  data/        demo.ts (the seeded practice), types.ts, source.ts (DataSource seam)
  i18n/        8-locale runtime, locale registry, ambient bridge,
               strings/ (chrome, screens, seeded prose)
  lib/         schedule.ts (the engine) + tests, format.ts (locale-aware output)
  screens/     find, details, confirm, my visits, day sheet, waiting room,
               patients, accounts, recalls, 404
  components/  two shells, demo dock, overlays, primitives
  styles/      tokens.css (canonical design tokens), base.css, components.css,
               screens.css
db/            schema.sql + seed.sql + the demo-data toolkit (self-host stack)
public/fonts/  self-hosted Manrope + JetBrains Mono (woff2)
manifest.json  the Adminium install spec (9 tables, 6 pages, 2 roles)
```

## License

[AGPL-3.0](LICENSE) © 2026 Clinic Desk. A demo shipped with Adminium.
