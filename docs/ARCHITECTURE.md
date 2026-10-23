# Exam Room — Architecture

> Status: **approved plan, v1** (2026-10-22). Milestones M0–M8 are built (2026-10-23); the
> real-device checks in §15 are still to do. Update this file whenever a decision below changes.

Exam Room is a small mobile-first web app. A teacher uploads a test paper (PDF), shares a link, and
students read the paper on their phones inside the website — with a timer and exit detection. Expected scale: **one teacher, 5–10 students per test.**

---

## 1. Principles

1. **The server decides everything.** Timer, lock and "submitted" status live on the server. The
   phone only displays and reports. Refreshing, clearing storage or reopening the link cannot bypass it.
2. **One app, one process.** Express serves both the API and the built React app from the same
   origin — no CORS, one thing to deploy.
3. **Stateless server, all data in the database.** The server keeps nothing on its own disk, so the
   host can restart it at any time (even mid-exam) without losing anything.
4. **Business rules are pure functions with tests.** Lock threshold, time expiry and unlock are the
   rules that must never break, so they are isolated and unit-tested.
5. **No speculative features — but clean seams.** Only what the spec asks for, organised so future
   features slot into a module without restructuring.

## 2. System overview

```
  Student phones                 Teacher (laptop or phone)
        │                                  │  PDF → images happens HERE (pdf.js),
        │                                  │  only images are uploaded
        └───────────── HTTPS ──────────────┘
                         │
          ┌──────────────▼───────────────┐
          │  Render (free web service)   │
          │  Node + Express, one process │
          │   /api/*  → JSON API         │
          │   /*      → React app        │
          └──────────────┬───────────────┘
                         │ libSQL protocol
          ┌──────────────▼───────────────┐
          │  Turso (free, hosted SQLite) │
          │  all tables + page images    │
          └──────────────────────────────┘
```

Locally, the same code uses a plain SQLite file (`data/exam-room.db`) — no accounts needed to develop.

## 3. Tech stack

| Layer        | Choice                                                         | Why                                                                             |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Language     | TypeScript (strict) everywhere                                 | Catches bugs early; shared API types between client and server                  |
| Frontend     | React + Vite + React Router                                    | Simple, fast, standard                                                          |
| Server state | TanStack Query                                                 | Caching + polling for the live results table                                    |
| Styling      | CSS Modules + theme tokens (CSS variables), light and dark     | No framework to learn; black and white design (D33)                             |
| PDF viewer   | Page images + `react-zoom-pan-pinch`                           | Same pinch/zoom on iPhone and Android; native pinch would also zoom the top bar |
| PDF → images | `pdfjs-dist` **in the teacher's browser**                      | Free server has little CPU; the PDF never reaches the server at all             |
| Backend      | Express 5, zod, helmet, express-rate-limit, multer             | Mature, minimal, well understood                                                |
| Database     | SQLite via `@libsql/client` (local file in dev, Turso in prod) | Same SQL everywhere; switching is one env var                                   |
| Tests        | Vitest + supertest (server), Vitest (web pure functions)       | Unit tests for rules, integration tests for the API                             |
| Repo         | npm workspaces: `shared`, `server`, `web`                      | One repo, one install, shared types                                             |
| Hosting      | Render (free) + Turso (free)                                   | $0, deploy on `git push` — see §10                                              |

Runtime: **Node 22 LTS** (pinned in `.nvmrc` and `engines`).

## 4. Repository layout

```
exam-room/
├─ package.json                 workspaces + root scripts (dev, build, start, check)
├─ render.yaml                  Render blueprint (added in M7)
├─ .env.example
├─ docs/ARCHITECTURE.md         this file
├─ shared/src/                  API contract TYPES only, one file per feature (auth.ts, …)
├─ server/
│  ├─ src/
│  │  ├─ index.ts               boot: load .env + config, open DB, run migrations, listen
│  │  ├─ app.ts                 builds the Express app (tests use it without listening)
│  │  ├─ app-dependencies.ts    { config, database, clock } passed to every module
│  │  ├─ api-router.ts          the ONE place where feature routers are mounted under /api
│  │  ├─ config.ts              env vars parsed with zod; boot fails fast if invalid
│  │  ├─ database/              connection, migrations list, migration runner
│  │  ├─ modules/<feature>/     one folder per feature: <feature>-router.ts + its logic
│  │  │  ├─ health/
│  │  │  ├─ auth/               login/logout/session, session token, requireTeacher
│  │  │  ├─ subjects/  tests/  attempts/   (M2–M6)
│  │  └─ lib/                   framework-level helpers: http-errors, parse-input, crypto, …
│  └─ test/                     Vitest + supertest; support/test-context.ts builds an app
│                               with an in-memory DB and a fake clock
└─ web/src/
   ├─ main.tsx
   ├─ app/                      App (routes), AppProviders, query-client
   ├─ api/http-client.ts        getJson/postJson + ApiError
   ├─ components/               shared UI: Button, TextField, FormError, Page, LoadingScreen
   ├─ lib/                      tiny helpers (classNames)
   ├─ features/
   │  ├─ home/
   │  ├─ teacher/               TeacherArea (session gate + routes), TeacherLayout,
   │  │                         auth/, dashboard/, … (create test, results)
   │  └─ student/               join, exam screen, viewer, warning/locked/submitted screens
   └─ styles/global.css         design tokens (CSS variables)
```

**Adding a feature** (e.g. "export results"):

1. Types for its requests/responses → `shared/src/<feature>.ts`, re-exported from `index.ts`.
2. Server → `server/src/modules/<feature>/` with a `create<Feature>Router(dependencies)`;
   mount it with one line in `api-router.ts`. Schema changes → a new migration.
3. Web → `web/src/features/<feature>/` with its pages and `use-<feature>.ts` query hooks;
   add its route in `app/App.tsx` (or inside `TeacherArea`).
4. Tests next to the others in `server/test/`.

Each feature owns its routes, data access and UI; `lib/` and `components/` hold only genuinely
shared code.

## 5. Data model

All timestamps are **UTC epoch milliseconds (INTEGER)** — no timezone bugs. Formatting to local time
happens only in the browser.

```sql
subjects   (id PK, name UNIQUE COLLATE NOCASE, created_at)

tests      (id PK, code UNIQUE,            -- 6-char share code, e.g. K7M2QX (no 0/O/1/I)
            subject_id → subjects, title, duration_minutes,
            allowed_exits CHECK (0..2), page_count, created_at,
            opens_at NULL, closes_at NULL)   -- NULL opens_at = not open yet (see 6.8)

test_pages (test_id → tests ON DELETE CASCADE, page_no,
            image BLOB, width, height,
            PRIMARY KEY (test_id, page_no))

attempts   (id PK, test_id → tests, student_name, roll_no, roll_no_key,  -- key = trimmed + lowercased
            token_hash UNIQUE,              -- sha256 of the student's secret token
            status CHECK IN ('in_progress','submitted','locked'),
            finish_reason CHECK IN ('student','time_up') NULL,
            started_at, deadline_at, finished_at NULL,
            exit_count DEFAULT 0, forgiven_exits DEFAULT 0,
            version DEFAULT 0,              -- optimistic locking for concurrent updates
            UNIQUE (test_id, roll_no_key))  -- one attempt per roll number per test

exits      (id PK, attempt_id → attempts, client_exit_id UNIQUE,   -- idempotency key from the phone
            reason CHECK IN ('hidden','blur','fullscreen','device_change'),
            left_at, returned_at NULL, away_ms NULL)
```

Migrations live in `server/src/database/migrations.ts`, run on boot, and are tracked in a
`schema_migrations` table. Each migration runs atomically (its statements + bookkeeping row in one
batch). **Migrations are append-only:** once one has run in production, never edit it — add a new
one with the next id.

Size check: a page is ~150–250 KB as WebP, so Turso's 5 GB free storage holds 20,000+ pages.

## 6. Core flows

### 6.1 Creating a test (teacher)

1. Teacher picks a PDF, subject, title, time limit, allowed exits.
2. **In the browser**, pdf.js renders each page to a canvas (~1600 px wide) and encodes it as an image.
   The PDF file itself is never uploaded.
3. Images are uploaded with the form (multipart). Limits: max 50 pages, max 5 MB per image.
4. Server validates every image with `sharp` (and normalises it to WebP), then inserts the test row
   and all page rows **in one transaction** — a failed upload never leaves a half-made test.
5. Server returns the share code; the UI shows the link `https://<site>/t/<code>` with Copy and
   WhatsApp buttons.

### 6.2 Starting / resuming (student)

1. Student opens `/t/<code>`, sees title + subject + time limit, enters name and roll number.
   If the test is not open, a waiting or closed screen shows instead (see 6.8).
2. Tapping **Start Test** requests fullscreen _first_ (browsers only allow it inside a tap), then
   calls the server.
3. For a new roll number the server first checks that the test is open (6.8). It creates the
   attempt: `deadline_at = now + duration`, generates a random secret token,
   stores only its hash, returns the token. The phone keeps it in `localStorage` (per test code)
   and sends it as `Authorization: Bearer <token>`.
4. **Same roll number again:**
   - attempt submitted or locked → show the final screen (never the paper);
   - attempt in progress and the name matches → resume on the new device, **count it as an exit**
     (`device_change`) and rotate the token so the old device is logged out.

### 6.3 Time limit

Every student request goes through one function, `loadAttempt()`, which first applies the time rule:
if `now > deadline_at` and the attempt is still in progress, it is marked `submitted / time_up`.
No background jobs. Every response includes `serverNow`, so the phone's countdown is corrected for a
wrong phone clock.

### 6.4 Showing pages

- `GET /api/attempt/pages/:n` returns a page **only while the attempt is in progress**.
- The server sends the stored WebP as it is (`Cache-Control: no-store`) — no image work at exam
  time.
- A transparent layer covers the image, so a long-press never reaches the `<img>` and cannot
  offer "Save image". There is no watermark (removed, see D5).
- The phone fetches images with JS and shows them via `blob:` URLs — there is no image link to copy
  or open in another app. **Every page is loaded when the exam opens**, one after another, so a
  weak connection later in the exam does not stop the student; a page that failed loads again when
  it is opened. All page images are dropped (and their `blob:` URLs revoked) as soon as the paper
  closes.
- The viewer shows one page at a time (Back / Next, "Page X of Y") with pinch and double-tap zoom
  from `react-zoom-pan-pinch`; zoom resets on page change.
- After submit/lock the server refuses every page request (`410 paper_closed`), so the paper is
  gone for good.

### 6.5 Exit detection

- Signals: `visibilitychange` (hidden), `window blur`, `pagehide`, and `fullscreenchange` (only if
  fullscreen was entered). They often fire together, so the phone merges them: the **first** signal
  moves the client from `present` to `away`; further signals are ignored until the student returns
  (page visible again, and focused when the exit was a blur). This lives in
  `web/src/features/student/exit-detection/exit-tracker.ts`, free of React and API code.
- The open exit is also saved in `localStorage` with the token, so after a refresh the new page
  reports the return of the exit the old page started.
- On leaving, the phone sends `POST /api/attempt/exits` immediately using `fetch(..., { keepalive: true })`
  so the request survives the page going to the background. It carries a random `client_exit_id`,
  so retries never double-count.
- On return, the phone calls `POST /api/attempt/return` (retried every 3 s while the network is
  down). The server closes the open exit and computes `away_ms` **from its own clock**. If the
  "left" request was lost (e.g. no network), the server records the exit from the return call
  instead, using the phone's `awayMsClient` to estimate when the student left.
- The phone remembers how many exits the student has already seen (`acknowledgedExits` in
  `localStorage`); the warning screen shows whenever the server's `exitsUsed` is higher.
- The server applies the rule (see 6.6) and replies with the new state; the phone shows either the
  red warning screen ("You left the test (X of Y allowed)…" → **Continue**) or the locked screen.
- The Finish confirmation is a custom in-page modal, never `window.confirm()` — native dialogs can
  fire `blur` and would count as a false exit.
- **The screen stays on.** While the attempt is in progress the page holds a Screen Wake Lock
  (`web/src/features/student/use-screen-wake-lock.ts`). Without it the phone screen turns off after
  30–60 s without a touch, the page becomes hidden, and that counts as an exit. Phones drop the lock
  whenever the page is hidden, so it is requested again when the page is visible, and on the next
  touch if the phone refused (for example in battery saver). It needs HTTPS.

### 6.6 The rules (pure functions in `attempts/rules.ts`)

- **Leaving too often:** when `exit_count > allowed_exits + forgiven_exits` the test's leave rule
  applies (D28): `lock` makes the attempt `locked`; `finish` submits it with
  `finish_reason = 'left_test'`, which can never be unlocked. With 0 allowed exits this happens on
  the first exit (no warning screen).
- **Unlock (teacher):** `forgiven_exits += 1`, status back to `in_progress`. The exit stays in the
  log; the timer was never paused, so no time is added.
- **End (teacher):** a running attempt is submitted with `finish_reason = 'teacher'`; if its time
  had already run out it is recorded as `time_up` instead. Locked attempts stay locked.
- **Exits while locked or finished** are ignored.
- **Refreshing the page counts as an exit** — a browser cannot tell a refresh from leaving.

### 6.7 Teacher results

`GET /api/tests/:id/attempts` returns, per student: name, roll number, start, finish, exits (and
forgiven exits), total time away (including a still-open exit), status. The time rule is applied
for display only, so a student whose time ran out shows as submitted even before their phone asks
again (pure `summarizeAttempt` in `attempts/attempt-results.ts`). The page polls every 5 s
(TanStack Query). Status labels: `in_progress → In progress` (or `Away now` while an exit is open),
`submitted → Submitted` / `Time up` / `Ended by you` / `Left · finished` (red),
`locked → Left the test` (row in red, with an **Unlock** button). No WebSockets — not needed at
this scale. Each row has an **Exit history**: when the student left, when they came back (or
"still away"), why, and for how long.

- **End test** (one student) and **End exam for everyone** ask first. Ending for everyone also
  closes the test, so nobody new can start.
- **Download CSV** and **Print** are built in the browser from the results already on the page
  (D31). Students are sorted by roll number (numeric-aware, so 2 comes before 10). The CSV starts
  with a byte order mark (Excel reads Urdu names), quotes cells that need it, and puts `'` before
  cells that start like a formula (`= + - @`), so a name can never run as a spreadsheet formula.
  The print page (`/teacher/tests/:id/print`) has no teacher header and hides its toolbar when
  printing.
- **Edit** opens the test settings. Title and subject can change any time; the time limit, exits,
  leave rule and the paper only while no student has started (`409 test_already_started`), because
  they decide how running attempts are judged. Replacing the paper checks "nobody started" again
  inside the write transaction.

The teacher can also **Remove** one student (their attempt and exits are deleted, so the roll
number can start again with full time) or **Delete** the whole test. Both ask first in a custom
confirm dialog.

### 6.8 Opening and closing a test

- A test has `opens_at` and `closes_at`; both may be NULL. The pure rule `availabilityAt` in
  `tests/test-availability.ts` gives `not_open` (no opening time), `scheduled` (before
  `opens_at`), `open`, or `closed` (from `closes_at`). It always uses the server clock, and every
  test response includes the result as `availability`.
- **New tests start closed** (`opens_at` NULL), so the link can be shared early without anyone
  seeing the paper. Tests created before this change got `opens_at = created_at` (migration 3).
- **Open now** sets `opens_at = now` and keeps a closing time that is still ahead. **Close now**
  sets `closes_at = now`; on a scheduled test it cancels the opening instead. **Set times** saves
  both times; the closing time must be after the opening time.
- **Closing only stops new students.** A new roll number gets `403 test_not_open` or
  `403 test_closed`. Students who already started keep their full time, can still load pages, and
  can resume on another phone with the same name and roll number.
- A student on the start page while the test is not open sees a waiting screen that asks the server
  again every 5 s, so it turns into the start form as soon as the test opens. The teacher's test
  page checks again every 10 s while a scheduled change is coming.

## 7. API

Teacher (session cookie required, except login):

```
POST   /api/auth/login            { password }
POST   /api/auth/logout
GET    /api/auth/session
GET    /api/subjects
POST   /api/subjects              { name }
GET    /api/tests?subjectId=
POST   /api/tests                 multipart: subjectId, title, durationMinutes, allowedExits,
                                  leaveRule, pages[]
GET    /api/tests/:id
PATCH  /api/tests/:id                 { subjectId?, title?, durationMinutes?, allowedExits?, leaveRule? }
PUT    /api/tests/:id/pages           multipart: pages[] (only before any student starts)
GET    /api/tests/:id/attempts        → results with exit history
POST   /api/tests/:id/attempts/end    → ends every running attempt and closes the test
POST   /api/attempts/:id/unlock
POST   /api/attempts/:id/end
POST   /api/tests/:id/open
POST   /api/tests/:id/close
PUT    /api/tests/:id/schedule        { opensAt, closesAt | null }
DELETE /api/tests/:id                 → test, pages, attempts and exits
DELETE /api/attempts/:id              → one attempt and its exits (frees the roll number)
```

Student (public by test code, then `Authorization: Bearer <token>`):

```
GET    /api/public/tests/:code             → title, subject, durationMinutes, pageCount, allowedExits,
                                              availability, opensAt, closesAt
POST   /api/public/tests/:code/attempts    { name, rollNo }  → token + state
GET    /api/attempt                        → state (status, deadlineAt, serverNow, exits, pageCount…)
GET    /api/attempt/pages/:n               → page image (in progress only)
POST   /api/attempt/exits                  { clientExitId, reason }
POST   /api/attempt/return                 { clientExitId, reason, awayMsClient }
POST   /api/attempt/finish
```

Other: `GET /api/health`. Errors always use one JSON shape: `{ error: { code, message } }`.

## 8. Security

- **Teacher auth:** one password (`TEACHER_PASSWORD`), compared in constant time. Success sets an
  HMAC-signed session cookie (`httpOnly`, `SameSite=Strict`, `Secure` in production, 12 h expiry).
  Login is rate-limited.
- **Student auth:** random 256-bit token per attempt; only its SHA-256 hash is stored.
- **Validation:** every request body/param is parsed with zod at the route boundary.
- **Uploads:** size/count limits; every image decoded and re-encoded by `sharp` (never stored as-is).
- **Headers:** helmet with a strict CSP (`default-src 'self'`, `img-src 'self' blob: data:`,
  `script-src 'self' 'wasm-unsafe-eval'` for the pdf.js image decoders — see D19).
- **Proxy:** `trust proxy` enabled so rate limiting sees real IPs behind Render.
- **Client deterrents:** no text selection, copy, cut, right-click, drag or long-press save
  (`-webkit-touch-callout: none` + a transparent layer over the images); `@media print` hides the
  page; no download/print buttons anywhere.

## 9. What a browser cannot do (honest limits)

- It cannot block screenshots or a second phone photographing the screen. Without a watermark
  (removed, D5) a leaked screenshot cannot be traced back to a student.
- It cannot block switching apps → it detects it and makes leaving costly.
- Some exits are accidents (incoming call, notification shade, low-battery popup) → **Unlock**.
- iPhone Safari does not support the Fullscreen API for web pages → on iPhone, detection uses
  visibility + blur only.

## 10. Hosting and deployment

**Production: Render (free web service) + Turso (free database).**

| Service | Free allowance (Oct 2026 — verify before relying on it)                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Render  | 750 instance-hours/month, HTTPS, deploy on `git push`; **no persistent disk** (files lost on restart), sleeps after 15 min idle |
| Turso   | 5 GB storage, 100 databases, 500 M row reads / 10 M row writes per month, no credit card                                        |

- Because the server is stateless (§1.3), Render's restarts and lack of disk don't matter.

**Free-tier budget** — the design keeps every resource far below the free limits:

| Resource         | Free limit        | Our usage (approx.)                                                          |
| ---------------- | ----------------- | ---------------------------------------------------------------------------- |
| Render memory    | 512 MB            | Node ~80 MB + worst-case upload (30 pages × 3 MB) + sharp one page at a time |
| Render CPU       | ~0.1 vCPU         | PDF rendering happens in the teacher's browser; server only re-encodes pages |
| Turso storage    | 5 GB              | ~250 KB per page → ~20,000 pages                                             |
| Turso row writes | 10 M / month      | One test ≈ pages + 1 rows; one exam of 10 students ≈ < 100 rows              |
| Turso row reads  | 500 M / month     | One read per page view; each phone keeps its pages in memory during the exam |
| Render bandwidth | monthly allowance | One exam ≈ 10 students × 10 pages × ~250 KB ≈ 25 MB                          |

Rules that protect the budget: sharp runs only at upload, with its cache off and one thread
(`configureImageProcessingForSmallServers`), pages are processed one at a time, uploads are capped
(30 pages, 3 MB each), pages are served at exam time without any image work, and pdf.js is
loaded only on the teacher's "New test" screen.

- **Cold start:** after 15 min with no traffic the app sleeps and the next visit takes ~1 minute.
  Open the site 2–3 minutes before an exam; during the exam, student traffic keeps it awake.
- Render may sometimes ask for a card to verify the account (a $1 hold that is cancelled).
- Deploy is described in `render.yaml` + README: push to GitHub → create Turso DB → connect repo on
  Render → set `TEACHER_PASSWORD`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (`SESSION_SECRET` is generated).
- `render.yaml` uses the Singapore region (the closest Render region to Pakistan) and
  `npm ci --include=dev`, because the build needs dev tools while `NODE_ENV=production`.

**Rejected (Oct 2026):** Render disk / free Postgres (paid / expires after 30 days), Fly.io (no free
tier for new accounts), Koyeb (free tier closed / no volumes), Oracle Always Free (card + server
admin + idle instances get reclaimed). **Fallback:** run on the teacher's own PC with a Cloudflare
Tunnel — same code, `DATABASE_URL=file:...`.

### Environment variables

| Name                  | Required | Example / default                                                |
| --------------------- | -------- | ---------------------------------------------------------------- |
| `PORT`                | no       | `3000`                                                           |
| `TEACHER_PASSWORD`    | yes      | —                                                                |
| `SESSION_SECRET`      | yes      | 32+ random characters                                            |
| `DATABASE_URL`        | no       | `file:data/exam-room.db` (dev) / `libsql://<db>.turso.io` (prod) |
| `DATABASE_AUTH_TOKEN` | prod     | Turso token                                                      |

## 11. Quality and workflow

- **Tests:** unit tests for pure logic (rules, tokens, config); integration tests (supertest +
  in-memory SQLite + fake clock) for the full journeys: create test → start → exit → lock → unlock
  → finish → page refused. Manual checklist on real devices (Android Chrome, iPhone Safari) before
  every release.
- **Tooling:** TypeScript strict, ESLint, Prettier. `npm run check` = typecheck + lint + format
  check + tests, and must be green before every commit.
- **Git:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`), small
  focused commits on `main`, pushed to GitHub (`origin`). No AI co-author/attribution lines.

### Code conventions

- **No comments in code.** Code explains itself through names and small functions; the "why"
  lives in this document and in commit messages.
- **Human-readable names, no abbreviations:** `database` not `db`, `request`/`response` not
  `req`/`res`, `environmentVariables` not `env`. Magic numbers become named constants
  (`SESSION_DURATION_MS`, `MAX_FAILED_LOGINS_PER_WINDOW`).
- **Files:** kebab-case for modules (`session-token.ts`), PascalCase for React components
  (`LoginPage.tsx`) with a matching `*.module.css`.
- **Server modules** receive `AppDependencies` instead of importing globals, so everything is
  testable with an in-memory database and a fake clock.
- **Errors:** throw `HttpError` (or a helper like `notFound()`); the error handler turns it into
  `{ error: { code, message } }`. Validate every input with `parseInput(schema, input)`.
- **Shared types only** in `shared/` — always imported with `import type`.

## 12. Build milestones

| #   | Milestone                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------ |
| M0  | Scaffold: workspaces, TypeScript, lint/format, Express health check, Vite app, `npm run dev` runs both |
| M1  | Server foundation: config, DB + migrations, error handling, teacher login                              |
| M2  | Subjects + create test (pdf.js in browser → upload → store pages)                                      |
| M3  | Teacher dashboard: tests grouped by subject, filter, share link (Copy / WhatsApp)                      |
| M4  | Student exam: join/resume, fullscreen, viewer (Page X of Y, zoom), watermark, timer, finish            |
| M5  | Anti-cheating: exit detection, warning/lock screens, server rules, copy/select/long-press blocking     |
| M6  | Live results table (red rows) + Unlock                                                                 |
| M7  | Hardening, real-device testing, `render.yaml`, README run + deploy guide                               |
| M8  | Exam-day safety: screen stays on, open/close/schedule tests, delete tests and attempts, no watermark   |
| M9  | Quick wins: all pages load at start, exit history, end exam now, leave rule, edit test, export results |
| M10 | Student accounts: classes, students with roll number + PIN, student login and home page                |
| M11 | Waiting room: the teacher starts everyone at the same time                                             |
| M12 | MCQ answer sheet with automatic marking                                                                |
| M13 | Photo answers after finishing                                                                          |
| M14 | Marks and results: written marks, release settings, student and teacher profiles                       |

Status (2026-10-24): M0–M9 are built and tested (unit tests, API tests and a smoke test of the
production build). Still to do by hand: the real-device checks in §15. M10–M14 are planned in §16.

## 13. Decision log

| #   | Decision                                                                                                                                              | Reason                                                                                                        | Revisit when                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1  | Single process serves API + SPA                                                                                                                       | Same origin, one deploy unit                                                                                  | Never at this scale                                                    |
| D2  | SQLite via libSQL (file locally, Turso in prod)                                                                                                       | Free, simple, same SQL in both places                                                                         | > hundreds of concurrent users                                         |
| D3  | Page images stored in the DB                                                                                                                          | Host has no persistent disk; tiny data volume                                                                 | Storage > ~3 GB → move to object storage (R2)                          |
| D4  | PDF → images in the teacher's browser                                                                                                                 | Free server CPU is tiny; PDF never leaves the teacher's device                                                | Never                                                                  |
| D5  | No watermark (changed 2026-10-23; was: an SVG overlay drawn by the browser, and before that burned in with sharp)                                     | The project owner decided it is not needed                                                                    | Papers leak → bring back the browser overlay                           |
| D6  | Server-authoritative timer and status                                                                                                                 | Client can't be trusted                                                                                       | —                                                                      |
| D7  | Refresh counts as an exit                                                                                                                             | Browser can't distinguish refresh from leaving                                                                | Teacher feedback                                                       |
| D8  | Timer never pauses (away, locked, unlocked)                                                                                                           | Simple and fair                                                                                               | Teacher feedback                                                       |
| D9  | Resume on another device allowed but counts as an exit                                                                                                | Dead-battery case without a free pass                                                                         | Teacher feedback                                                       |
| D10 | Teacher results by 5 s polling, no WebSockets                                                                                                         | Simpler; enough for 10 students                                                                               | Many concurrent tests                                                  |
| D11 | Single teacher password, no user table                                                                                                                | Spec: one teacher                                                                                             | Multiple teachers needed → add `teachers` table behind the auth module |
| D12 | Original PDF never stored                                                                                                                             | Can't leak what we don't keep                                                                                 | —                                                                      |
| D13 | TypeScript pinned to 6.0                                                                                                                              | typescript-eslint does not support TS 7 yet                                                                   | typescript-eslint supports TS 7                                        |
| D14 | Server bundled with esbuild; `tsc` only type-checks                                                                                                   | One output file, no `rootDir`/workspace build issues                                                          | —                                                                      |
| D15 | `shared/` is types-only                                                                                                                               | Erased at build → nothing to build or deploy for it                                                           | Runtime sharing needed (e.g. zod schemas on both sides)                |
| D16 | Stateless HMAC session cookie (no sessions table)                                                                                                     | One teacher; nothing to store                                                                                 | Need to revoke sessions → rotate `SESSION_SECRET` or add a table       |
| D17 | A return can record a lost exit; exits are idempotent by `clientExitId`                                                                               | Phones often drop the request sent while the page goes to the background                                      | —                                                                      |
| D18 | Teacher results apply the time rule for display, without writing                                                                                      | Reads stay cheap; the student's next request writes it                                                        | —                                                                      |
| D19 | pdf.js wasm decoders, fonts and CMaps are shipped as static files (`web/public/pdfjs`, copied at build start) and the CSP allows `'wasm-unsafe-eval'` | Scanned PDFs often use JBIG2 / JPEG 2000 images, which pdf.js can only decode with these files                | pdf.js stops needing them                                              |
| D20 | One page at a time in the viewer                                                                                                                      | Zoom and pan stay simple and "Page X of Y" is exact                                                           | Teacher feedback                                                       |
| D21 | Unlock forgives exactly one exit, so the next exit locks again                                                                                        | Simple and fair; the teacher decides each time                                                                | Teacher feedback                                                       |
| D22 | Hold a Screen Wake Lock during the exam                                                                                                               | A screen that turns off makes the page hidden, which would count as an exit                                   | Browsers change the API                                                |
| D23 | New tests start closed; `opens_at` / `closes_at` on `tests` serve both the buttons and the schedule                                                   | The link can be shared early without showing the paper; one pair of columns, one pure rule                    | —                                                                      |
| D24 | Closing only stops new students; students who started keep their full time                                                                            | "Who may start" and "end everyone's exam" are different actions                                               | An "end the exam now" feature is added                                 |
| D25 | Deletes remove dependent rows explicitly in one batch                                                                                                 | libSQL turns `PRAGMA foreign_keys` on, but plain SQLite does not; explicit deletes work with both             | —                                                                      |
| D26 | Students log in with class + roll number + a 6-digit PIN the teacher hands out; PINs stored as scrypt hashes; the phone stays logged in for 60 days   | Owner's choice: easy on phones, no email needed                                                               | Students forget PINs often                                             |
| D27 | Classes own subjects; a test is given to one class                                                                                                    | Owner's choice: matches how a school works                                                                    | One test for several classes                                           |
| D28 | Leave rule per test: `lock` (teacher can unlock) or `finish` (submitted, no way back)                                                                 | Owner's choice                                                                                                | —                                                                      |
| D29 | Only registered students can open a test once accounts exist                                                                                          | Owner's choice: full control over who joins                                                                   | —                                                                      |
| D30 | Answer photos are shrunk on the phone; the server checks them with `sharp` metadata but never re-encodes them                                         | ~0.1 vCPU cannot re-encode many photos when a whole class finishes at once                                    | Bad files get through                                                  |
| D31 | CSV export and the print page are built in the browser from the results data                                                                          | No extra server work or endpoint                                                                              | Results get too big for the browser                                    |
| D32 | New finish reasons (`teacher`, `left_test`) come from rebuilding `attempts`, backing up `exits` first                                                 | libSQL enforces foreign keys, so dropping `attempts` would cascade-delete every exit                          | —                                                                      |
| D33 | Black and white theme: light and dark token sets on `:root`, chosen by `data-theme`; `web/public/theme.js` sets it before the first paint             | Owner's request; no white flash for dark users, and the CSP allows a same-origin script but not an inline one | —                                                                      |
| D34 | Web pure functions get Vitest tests (`web/vitest.config.ts` without the pdf.js copy plugin)                                                           | Business logic such as the CSV export must be tested like the server rules                                    | —                                                                      |

## 14. Future extension points (not built now)

- Multiple teachers → `teachers` table + `teacher_id` on subjects/tests; only the auth module changes.
- Archive tests → small addition to the `tests` module.
- Larger storage → swap page storage to Cloudflare R2 behind the same `tests` module interface.

## 15. Release checklist (to verify before first deploy)

Follow [DEVICE-CHECKS.md](DEVICE-CHECKS.md) on a real Android phone (Chrome) and a real iPhone
(Safari), on the HTTPS site, before the first real exam and after big changes. It also covers the
production build + CSP check: pdf.js must render a scanned PDF and a Word-exported PDF.

## 16. Plan for M9–M14 (approved 2026-10-24)

The owner's choices: students log in with roll number + PIN (D26), students are grouped in classes
(D27), the leave rule is chosen per test (D28), and only registered students can open a test (D29).
Each milestone is finished, tested and usable before the next one starts. Details may be refined
when a milestone starts; the decision log records every change.

### M9 Quick wins (built 2026-10-24)

- All pages load when the exam starts, one after another, so neither the phone nor the server is
  flooded. A weak connection later in the exam no longer stops the student.
- Exit history per student on the results page: when they left, for how long, and why (the data is
  already in `exits`).
- **End the exam now** for one student or for everyone. Ending for everyone also closes the test.
  The attempt becomes `submitted` with `finish_reason = 'teacher'`.
- **Leave rule** per test: `lock` (as today, the teacher can unlock) or `finish` (the attempt is
  submitted with `finish_reason = 'left_test'` and cannot be unlocked).
- **Edit a test**: the title and subject at any time; the time limit, exits, leave rule and the paper
  only while no student has started.
- **Export results**: a CSV download and a printable page, both built in the browser (D31).

### M10 Student accounts

- Tables: `classes`, `class_subjects`, and `students` (`class_id`, `name`, `roll_no`,
  `roll_no_key`, `pin_hash`, `session_version`) with UNIQUE (`class_id`, `roll_no_key`).
- The teacher creates classes, gives them subjects, and adds students one by one or by pasting a
  list (one "roll number, name" per line). Each new PIN is shown once; the teacher can reset a PIN
  or remove a student.
- Student login: class + roll number + PIN → a signed `httpOnly` cookie for 60 days. Resetting the
  PIN bumps `session_version`, which logs out the old phone.
- Tests get `class_id`. A student's home page lists their subjects and tests. Starting a test uses
  the account (no typing of names); `attempts.student_id` with UNIQUE (`test_id`, `student_id`).
  Attempts made before accounts keep their name and roll number.

### M11 Waiting room

- A student who taps Start on a test with a waiting room gets status `waiting`. The teacher sees who
  is waiting and taps **Start for everyone**: every waiting attempt gets the same `started_at` and
  `deadline_at`. Waiting phones check every 3 s and open the paper.

### M12 MCQ answer sheet

- Per test: number of questions, options (A–D or A–E) and the answer key (`answer_keys`). Students
  tap answers on a sheet under the paper. Answers are saved in small batches (`mcq_answers`), so a
  dead phone loses nothing. The sheet is marked automatically when the attempt finishes.

### M13 Photo answers

- A per-test switch. After Finish the student takes up to 10 photos (the camera would count as
  leaving, so only after Finish). The phone shrinks each photo to about 1600 px JPEG
  (~200–300 KB); the server checks the type, size and dimensions but never re-encodes (D30).
  Stored in `answer_photos`. Upload window: 30 minutes after finishing.

### M14 Marks and results

- The teacher enters written marks and a comment per attempt; the total adds the MCQ marks.
- Per test **Release results**, choosing what students can see: marks, the MCQ correct answers,
  their photos with comments.
- Student profile: class, subjects and every test with released marks. Teacher view of a student:
  all subjects and scores.

### Free-tier budget for M9–M14

| Resource         | Use                                                          | Limit / plan                                   |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Turso storage    | Photos ≈ 15 MB per exam of 10 students (10 photos × ~250 KB) | 5 GB ≈ 300 exams; past ~3 GB move photos to R2 |
| Turso row writes | MCQ ≈ 500 per exam (batched), accounts and marks are tiny    | 10 M / month                                   |
| Render CPU       | PIN hashing only at login; photos are never re-encoded       | ~0.1 vCPU                                      |
| Render memory    | Photo uploads one at a time, max 3 MB each                   | 512 MB                                         |
