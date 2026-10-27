# Exam Room — Architecture

> Status: **approved plan, v1** (2026-10-22). Milestones M0–M19 are all built (2026-10-25), and the
> owner's feedback rounds M20 to M22 (2026-10-24, §17) are done; the real-device checks in §15 are
> still to do. M23 (new question kinds) is built (2026-10-27, §17); M24 (AI marking) is planned in
> §18 and not started. Colours and their roles: `docs/DESIGN.md`. Update this file whenever a decision
> below changes.

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
classes    (id PK, name UNIQUE COLLATE NOCASE, created_at)

subjects   (id PK, class_id → classes, name, created_at,
            UNIQUE (class_id, name COLLATE NOCASE))      -- a subject belongs to one class (D36)

chapters   (id PK, subject_id → subjects, name, position, created_at,
            UNIQUE (subject_id, name COLLATE NOCASE))    -- position orders the chapters

students   (id PK, class_id → classes, name, roll_no, roll_no_key,   -- key = trimmed + lowercased
            pin_hash,                       -- scrypt hash of the 6-digit PIN (D26)
            session_version DEFAULT 0,      -- Reset PIN increases it (D39)
            created_at, UNIQUE (class_id, roll_no_key))

tests      (id PK, code UNIQUE,            -- 6-char share code, e.g. K7M2QX (no 0/O/1/I)
            subject_id → subjects, kind CHECK IN ('test','quiz','assignment'), title,
            duration_minutes, allowed_exits CHECK (0..2), leave_rule,
            paper_kind CHECK IN ('pages','typed'), page_count >= 0,
            paper JSON NULL,               -- typed paper, or the answer sheet of a PDF test (D44)
            answer_key JSON DEFAULT '{}',  -- never sent to students before release
            question_count, max_marks NULL, -- stored when the paper is saved, for cheap lists
            written_answers CHECK IN ('on_paper','typed','photos','typed_and_photos'),
            created_at, opens_at NULL, closes_at NULL)   -- NULL opens_at = not open yet (6.8)

paper_images (test_id → tests, image_no, image BLOB (WebP, max 1000 px wide), width, height,
            UNIQUE (test_id, image_no))

answers    (attempt_id → attempts, question_id, choice NULL, text NULL,
            sequence,                      -- grows with every change on the phone; newest wins (D45)
            answered_at, received_at,      -- server-clock time on the phone, and arrival time
            PRIMARY KEY (attempt_id, question_id)) WITHOUT ROWID

question_marks (attempt_id → attempts, question_id, marks NULL, comment,
            PRIMARY KEY (attempt_id, question_id)) WITHOUT ROWID   -- teacher marks overrule auto marks

attempts   + auto_marks (MCQ and exact answers, renamed in migration 16, D77), written_marks,
             total_marks (D48), teacher_comment
tests      + results_released_at, show_correct_answers, show_comments, show_top_scorer (D49, D50),
             bounty_note, bounty_points (D51); paper_kind may be 'none' for an offline
             assignment (rebuilt in migration 12), waiting_room 0/1 (migration 13, D58),
             instant_result 0/1 (migration 14, renamed in 16, D61, D77), shuffle_questions 0/1
             (migration 15, D70), answer_count (migration 16, D78)

points     (id PK, student_id → students, test_id NULL → tests, points, reason, created_at)
             -- test_id set: a bounty, replaced on every release; NULL: given by hand

answer_photos (id PK, attempt_id → attempts, photo_no, client_photo_id, image BLOB (as sent),
            media_type, width, height, created_at,
            UNIQUE (attempt_id, photo_no), UNIQUE (attempt_id, client_photo_id))

test_chapters (test_id → tests, chapter_id → chapters, PRIMARY KEY (test_id, chapter_id))

student_passkeys (id PK, student_id → students, credential_id UNIQUE, public_key BLOB,
            sign_count, transports, created_at, last_used_at)   -- fingerprint login (D42)

test_pages (test_id → tests ON DELETE CASCADE, page_no,
            image BLOB, width, height,
            PRIMARY KEY (test_id, page_no))

attempts   (id PK, test_id → tests, student_name, roll_no, roll_no_key,
            token_hash UNIQUE,              -- sha256 of the student's secret token
            status CHECK IN ('waiting','in_progress','submitted','locked'),
            finish_reason CHECK IN ('student','time_up','teacher','left_test') NULL,
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

1. Student opens `/t/<code>` (or taps the test on the student home), sees title + subject + time
   limit. A student who is not logged in is sent to `/login?next=/t/<code>` first (class, roll
   number, PIN). If the test is not open, a waiting or closed screen shows instead (see 6.8).
2. Tapping **Start Test** requests fullscreen _first_ (browsers only allow it inside a tap), then
   calls the server with the student session cookie.
3. The server checks that the student belongs to the test's class (`403 other_class`). For a
   student without an attempt it checks that the test is open (6.8) and creates the attempt with
   `student_id`, a copy of the name and roll number, and `deadline_at = now + duration`. It
   generates a random secret token, stores only its hash and returns the token. The phone keeps it
   in `localStorage` (per test code) and sends it as `Authorization: Bearer <token>` (D41).
4. **Same student again** (another phone, or the token was lost):
   - attempt submitted or locked → show the final screen (never the paper);
   - attempt in progress → resume on the new device, **count it as an exit** (`device_change`)
     and rotate the token so the old device is logged out.

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
GET    /api/classes                   → classes with subjects, chapters and counts (3 queries)
POST   /api/classes                   { name }
PATCH  /api/classes/:id               { name }
DELETE /api/classes/:id               → only when it has no subjects and no students
DELETE /api/classes/:id?withContents=true → the class with its subjects, chapters, tests
                                       (all results) and students, in one batch (D64)
POST   /api/classes/:id/subjects      { name }
GET    /api/classes/:id/students
POST   /api/classes/:id/students      { students: [{ rollNumber, name }] } → each with a new PIN
POST   /api/classes/:id/students/move { toClassId }
PATCH  /api/subjects/:id              { name?, classId? }
DELETE /api/subjects/:id              → only without tests; its chapters go with it
POST   /api/subjects/:id/move-tests   { toSubjectId } (any class; chapter tags are removed)
POST   /api/subjects/:id/chapters     { name }
PUT    /api/subjects/:id/chapters/order { chapterIds }
PATCH  /api/chapters/:id              { name }
DELETE /api/chapters/:id              → removes only its tags from tests
PATCH  /api/students/:id              { name?, rollNumber?, classId? }
POST   /api/students/:id/reset-pin    → a new PIN, shown once; old phones are logged out
POST   /api/classes/:id/students/reset-pins → a new PIN for every student of the class (D60)
DELETE /api/students/:id              → old results stay by name and roll number
GET    /api/tests?subjectId=
POST   /api/tests                 multipart: subjectId, kind, chapterIds, title, durationMinutes,
                                  allowedExits, leaveRule, writtenAnswers, paperKind, and
                                  pages[] (PDF) or paper + answerKey + paperImages[] (typed)
GET    /api/tests/:id
PATCH  /api/tests/:id                 { subjectId?, kind?, chapterIds?, title?, durationMinutes?,
                                        allowedExits?, leaveRule? }
PUT    /api/tests/:id/pages           multipart: pages[] (only before any student starts)
GET    /api/tests/:id/paper           → { paper, answerKey, imageCount }
PUT    /api/tests/:id/paper           multipart: paper, answerKey, paperImages[] (before any start)
PUT    /api/tests/:id/answer-key      { answerKey } (any time)
GET    /api/tests/:id/paper-images/:n
GET    /api/tests/:id/attempts        → results with exit history
POST   /api/tests/:id/attempts/start  → starts every waiting student at the same moment (D58)
POST   /api/tests/:id/attempts/end    → ends every running or waiting attempt and closes the test
POST   /api/attempts/:id/unlock
POST   /api/attempts/:id/end
POST   /api/tests/:id/open
POST   /api/tests/:id/close
PUT    /api/tests/:id/schedule        { opensAt, closesAt | null }
DELETE /api/tests/:id                 → test, pages, attempts and exits
DELETE /api/attempts/:id              → one attempt and its exits (frees the roll number)
GET    /api/tests/:id/marking         → paper, key and every attempt's answers, marks and score
PUT    /api/attempts/:id/marks        { questionMarks: { q3: { marks, comment } }, comment }
PUT    /api/tests/:id/release         { showCorrectAnswers, showComments, showTopScorer }
DELETE /api/tests/:id/release         → hides the results again (and takes the bounty back)
GET    /api/tests/:id/offline-marks   → the class list with the entered marks
PUT    /api/tests/:id/offline-marks   { marks: [{ studentId, marks | null }] }
GET    /api/classes/:id/points        → every student's points
GET    /api/students/:id/points       → one student's points history
GET    /api/students/:id/progress     → every marked result of one student (released or not)
POST   /api/students/:id/points       { points, reason }
GET    /api/attempts/:id/photos       → the student's answer photos
GET    /api/attempts/:id/photos/:n
```

Student account (student session cookie, D39):

```
GET    /api/student-auth/classes           → class names for the login form (public)
POST   /api/student-auth/login             { classId, rollNumber, pin } → profile + cookie
GET    /api/student-auth/session           → profile or null
POST   /api/student-auth/logout
GET    /api/student/home                   → profile + tests of the class with the own attempt state
                                              and the released marks
GET    /api/student/results/:code          → the own released result; before release the MCQ
                                              result once finished if the test allows it (D61),
                                              else 403
GET    /api/student/progress               → released results with chapters, and the class subjects
POST   /api/student-auth/passkeys/registration-options   (student cookie) → WebAuthn options
POST   /api/student-auth/passkeys/registrations          (student cookie) the phone's answer
POST   /api/student-auth/passkeys/login-options          → WebAuthn options (public)
POST   /api/student-auth/passkeys/login                  the phone's answer → profile + cookie
```

The passkey request and response bodies are the standard WebAuthn JSON shapes from
`@simplewebauthn` (browser and server), so they are not repeated in `shared/`.

Student exam (public by test code, then `Authorization: Bearer <token>`):

```
GET    /api/public/tests/:code             → title, subject, durationMinutes, pageCount, allowedExits,
                                              availability, opensAt, closesAt
POST   /api/public/tests/:code/attempts    (student cookie) → token + state
GET    /api/attempt                        → state (status, deadlineAt, serverNow, exits, pageCount…)
GET    /api/attempt/pages/:n               → page image (in progress only)
GET    /api/attempt/paper                  → the typed paper without answers and the attempt's
                                              mixing number when the order is mixed (D70)
                                              (in progress only)
GET    /api/attempt/paper-images/:n        → a picture of the typed paper (in progress only)
GET    /api/attempt/answers                → the saved answers (in progress only)
POST   /api/attempt/answers                { answers: [{ questionId, choice, text, sequence,
                                              answeredAt }] } → { savedCount, tooLateCount }
GET    /api/attempt/photos                 → saved photos and photosOpenUntil
PUT    /api/attempt/photos/:clientPhotoId  raw image body (after finishing, 30 minutes, max 10)
DELETE /api/attempt/photos/:clientPhotoId
POST   /api/attempt/exits                  { clientExitId, reason }
POST   /api/attempt/return                 { clientExitId, reason, awayMsClient }
POST   /api/attempt/finish
```

Other: `GET /api/health`. Errors always use one JSON shape: `{ error: { code, message } }`.

## 8. Security

- **Teacher auth:** one password (`TEACHER_PASSWORD`), compared in constant time. Success sets an
  HMAC-signed session cookie (`httpOnly`, `SameSite=Strict`, `Secure` in production, 12 h expiry).
  Login is rate-limited.
- **Student login:** class + roll number + 6-digit PIN (scrypt hash, D26). Success sets an
  HMAC-signed cookie with the student id, the session version and the expiry (60 days, D39);
  Reset PIN raises the version, which logs out every phone. Wrong PINs: 10 per account per 15
  minutes (in memory) and 100 failed logins per network per 15 minutes (D40). An unknown roll
  number gets the same answer and takes as long as a wrong PIN.
- **Student exam auth:** random 256-bit token per attempt; only its SHA-256 hash is stored.
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

| Name                  | Required | Example / default                                                                            |
| --------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `PORT`                | no       | `3000`                                                                                       |
| `TEACHER_PASSWORD`    | yes      | —                                                                                            |
| `SESSION_SECRET`      | yes      | 32+ random characters                                                                        |
| `DATABASE_URL`        | no       | `file:data/exam-room.db` (dev) / `libsql://<db>.turso.io` (prod)                             |
| `DATABASE_AUTH_TOKEN` | prod     | Turso token                                                                                  |
| `PUBLIC_ORIGIN`       | no       | Site address for passkeys; else Render's `RENDER_EXTERNAL_URL`, else `http://localhost:5173` |

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
| M10 | Manage: classes, subjects, chapters and students; rename and safe delete; test type and chapter tags   |
| M11 | Student login (class + roll number + PIN) and student home                                             |
| M12 | Installable app (PWA), fingerprint login (passkeys), phone-lock steps                                  |
| M13 | Typed papers from JSON or text, answer sheets for PDF tests                                            |
| M14 | Answering on the phone with an outbox that never loses an answer                                       |
| M15 | Photo answers after finishing                                                                          |
| M16 | Marking and results: MCQ auto-marking, written marks, release, top scorer                              |
| M17 | Assignments, bounties and points                                                                       |
| M18 | Dashboard and progress for students and the teacher                                                    |
| M19 | Waiting room: the teacher starts everyone at the same time                                             |
| M23 | Question kinds: parts, short answers and blanks checked exactly; English and tenses papers             |
| M24 | AI marking of written answers and photos with Claude, GPT, Gemini or any OpenAI-compatible service     |

Status (2026-10-25): M0–M19 are built and tested (unit tests, API tests and a smoke test of the
production build), and M20, the owner's first feedback round, is done (§17). Still to do by hand:
the real-device checks in §15.

## 13. Decision log

| #   | Decision                                                                                                                                                                                                                                                                                                                                                | Reason                                                                                                                                                            | Revisit when                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1  | Single process serves API + SPA                                                                                                                                                                                                                                                                                                                         | Same origin, one deploy unit                                                                                                                                      | Never at this scale                                                    |
| D2  | SQLite via libSQL (file locally, Turso in prod)                                                                                                                                                                                                                                                                                                         | Free, simple, same SQL in both places                                                                                                                             | > hundreds of concurrent users                                         |
| D3  | Page images stored in the DB                                                                                                                                                                                                                                                                                                                            | Host has no persistent disk; tiny data volume                                                                                                                     | Storage > ~3 GB → move to object storage (R2)                          |
| D4  | PDF → images in the teacher's browser                                                                                                                                                                                                                                                                                                                   | Free server CPU is tiny; PDF never leaves the teacher's device                                                                                                    | Never                                                                  |
| D5  | No watermark (changed 2026-10-23; was: an SVG overlay drawn by the browser, and before that burned in with sharp)                                                                                                                                                                                                                                       | The project owner decided it is not needed                                                                                                                        | Papers leak → bring back the browser overlay                           |
| D6  | Server-authoritative timer and status                                                                                                                                                                                                                                                                                                                   | Client can't be trusted                                                                                                                                           | —                                                                      |
| D7  | Refresh counts as an exit                                                                                                                                                                                                                                                                                                                               | Browser can't distinguish refresh from leaving                                                                                                                    | Teacher feedback                                                       |
| D8  | Timer never pauses (away, locked, unlocked)                                                                                                                                                                                                                                                                                                             | Simple and fair                                                                                                                                                   | Teacher feedback                                                       |
| D9  | Resume on another device allowed but counts as an exit                                                                                                                                                                                                                                                                                                  | Dead-battery case without a free pass                                                                                                                             | Teacher feedback                                                       |
| D10 | Teacher results by 5 s polling, no WebSockets                                                                                                                                                                                                                                                                                                           | Simpler; enough for 10 students                                                                                                                                   | Many concurrent tests                                                  |
| D11 | Single teacher password, no user table                                                                                                                                                                                                                                                                                                                  | Spec: one teacher                                                                                                                                                 | Multiple teachers needed → add `teachers` table behind the auth module |
| D12 | Original PDF never stored                                                                                                                                                                                                                                                                                                                               | Can't leak what we don't keep                                                                                                                                     | —                                                                      |
| D13 | TypeScript pinned to 6.0                                                                                                                                                                                                                                                                                                                                | typescript-eslint does not support TS 7 yet                                                                                                                       | typescript-eslint supports TS 7                                        |
| D14 | Server bundled with esbuild; `tsc` only type-checks                                                                                                                                                                                                                                                                                                     | One output file, no `rootDir`/workspace build issues                                                                                                              | —                                                                      |
| D15 | `shared/` holds the API types plus one runtime module, `@exam-room/shared/paper-rules` (the paper zod schema and pure paper functions); `server/build.mjs` bundles it and keeps only real dependencies external (changed 2026-10-25, was: types only)                                                                                                   | The browser preview and the server must judge a paper by the same rules                                                                                           | More runtime code needs sharing                                        |
| D16 | Stateless HMAC session cookie (no sessions table)                                                                                                                                                                                                                                                                                                       | One teacher; nothing to store                                                                                                                                     | Need to revoke sessions → rotate `SESSION_SECRET` or add a table       |
| D17 | A return can record a lost exit; exits are idempotent by `clientExitId`                                                                                                                                                                                                                                                                                 | Phones often drop the request sent while the page goes to the background                                                                                          | —                                                                      |
| D18 | Teacher results apply the time rule for display, without writing                                                                                                                                                                                                                                                                                        | Reads stay cheap; the student's next request writes it                                                                                                            | —                                                                      |
| D19 | pdf.js wasm decoders, fonts and CMaps are shipped as static files (`web/public/pdfjs`, copied at build start) and the CSP allows `'wasm-unsafe-eval'`                                                                                                                                                                                                   | Scanned PDFs often use JBIG2 / JPEG 2000 images, which pdf.js can only decode with these files                                                                    | pdf.js stops needing them                                              |
| D20 | One page at a time in the viewer                                                                                                                                                                                                                                                                                                                        | Zoom and pan stay simple and "Page X of Y" is exact                                                                                                               | Teacher feedback                                                       |
| D21 | Unlock forgives exactly one exit, so the next exit locks again                                                                                                                                                                                                                                                                                          | Simple and fair; the teacher decides each time                                                                                                                    | Teacher feedback                                                       |
| D22 | Hold a Screen Wake Lock during the exam                                                                                                                                                                                                                                                                                                                 | A screen that turns off makes the page hidden, which would count as an exit                                                                                       | Browsers change the API                                                |
| D23 | New tests start closed; `opens_at` / `closes_at` on `tests` serve both the buttons and the schedule                                                                                                                                                                                                                                                     | The link can be shared early without showing the paper; one pair of columns, one pure rule                                                                        | —                                                                      |
| D24 | Closing only stops new students; students who started keep their full time                                                                                                                                                                                                                                                                              | "Who may start" and "end everyone's exam" are different actions                                                                                                   | An "end the exam now" feature is added                                 |
| D25 | Deletes remove dependent rows explicitly in one batch                                                                                                                                                                                                                                                                                                   | libSQL turns `PRAGMA foreign_keys` on, but plain SQLite does not; explicit deletes work with both                                                                 | —                                                                      |
| D26 | Students log in with class + roll number + a 6-digit PIN the teacher hands out; PINs stored as scrypt hashes; the phone stays logged in for 60 days                                                                                                                                                                                                     | Owner's choice: easy on phones, no email needed                                                                                                                   | Students forget PINs often                                             |
| D27 | Classes own subjects; a test is given to one class                                                                                                                                                                                                                                                                                                      | Owner's choice: matches how a school works                                                                                                                        | One test for several classes                                           |
| D28 | Leave rule per test: `lock` (teacher can unlock) or `finish` (submitted, no way back)                                                                                                                                                                                                                                                                   | Owner's choice                                                                                                                                                    | —                                                                      |
| D29 | Only registered students can open a test once accounts exist                                                                                                                                                                                                                                                                                            | Owner's choice: full control over who joins                                                                                                                       | —                                                                      |
| D30 | Answer photos are shrunk on the phone; the server checks them with `sharp` metadata but never re-encodes them                                                                                                                                                                                                                                           | ~0.1 vCPU cannot re-encode many photos when a whole class finishes at once                                                                                        | Bad files get through                                                  |
| D31 | CSV export and the print page are built in the browser from the results data                                                                                                                                                                                                                                                                            | No extra server work or endpoint                                                                                                                                  | Results get too big for the browser                                    |
| D32 | New finish reasons (`teacher`, `left_test`) come from rebuilding `attempts`, backing up `exits` first                                                                                                                                                                                                                                                   | libSQL enforces foreign keys, so dropping `attempts` would cascade-delete every exit                                                                              | —                                                                      |
| D33 | Black and white theme: light and dark token sets on `:root`, chosen by `data-theme`; `web/public/theme.js` sets it before the first paint                                                                                                                                                                                                               | Owner's request; no white flash for dark users, and the CSP allows a same-origin script but not an inline one                                                     | —                                                                      |
| D34 | Web pure functions get Vitest tests (`web/vitest.config.ts` without the pdf.js copy plugin)                                                                                                                                                                                                                                                             | Business logic such as the CSV export must be tested like the server rules                                                                                        | —                                                                      |
| D35 | A migration that changes a table's constraints rebuilds it with `database.migrate()` (foreign keys off for that one batch) and ends with a check that aborts the batch if any row points nowhere                                                                                                                                                        | Child rows stay untouched (D32 had to copy them); `migrate()` works on a local file and on Turso                                                                  | —                                                                      |
| D36 | Subjects belong to one class (name unique per class) and chapters to one subject; a test's class is its subject's class                                                                                                                                                                                                                                 | Each class has its own book per subject with its own chapters; replaces the planned `class_subjects` table; no class column on tests that could disagree          | One subject shared by several classes                                  |
| D37 | The M10 migration puts every existing subject into a new class called "My class"                                                                                                                                                                                                                                                                        | Old tests and results keep working; the teacher only renames the class                                                                                            | —                                                                      |
| D38 | Safe delete: a class with subjects or students and a subject with tests cannot be deleted (the app offers to move them); a chapter takes only its tags; a deleted student's old results stay by name and roll number                                                                                                                                    | Nothing is lost by accident, and every delete is explained before it happens                                                                                      | Teacher feedback                                                       |
| D39 | Student session: an HMAC-signed cookie with the student id, a session version and the expiry (60 days); each request checks the version with one indexed read                                                                                                                                                                                           | Resetting the PIN logs out old phones without a sessions table                                                                                                    | —                                                                      |
| D40 | Wrong PINs are limited per account (10 per 15 minutes) and per network, in memory                                                                                                                                                                                                                                                                       | A 6-digit PIN is easy to guess without a limit; counting per account means one school Wi-Fi does not block the whole class                                        | Restarts are used for guessing → keep the counters in the database     |
| D41 | An attempt keeps its own token per device; the student account only decides who may start                                                                                                                                                                                                                                                               | The proven exam flow (exits, leave rule, unlock, another phone) stays unchanged                                                                                   | —                                                                      |
| D42 | Fingerprint and face login use WebAuthn passkeys (`@simplewebauthn`), discoverable, on the Render address (`RENDER_EXTERNAL_URL`); the challenge lives in a 5-minute signed cookie                                                                                                                                                                      | No database write for challenges; the PIN always stays as a fallback                                                                                              | The address changes → students set the fingerprint up again            |
| D43 | A small hand-written service worker: hashed `/assets` from the cache, pages from the network with the saved `index.html` when offline, never `/api` or paper content                                                                                                                                                                                    | The app reopens without network, the CSP stays strict (same-origin worker), and the paper never stays on the phone                                                | The paper must work offline                                            |
| D44 | A typed paper, or a PDF test's answer sheet, is one JSON question list on the test; the answer key is a separate column that is never sent before release; the paper schema and text parser are shared runtime code                                                                                                                                     | One row read shows the whole paper; marking is the same for both kinds of paper                                                                                   | A paper grows past ~200 KB                                             |
| D45 | Answers: one row per attempt and question; the newest wins by a sequence number the phone increases with every change                                                                                                                                                                                                                                   | Repeated or out-of-order batches can never overwrite a newer answer, without storing batch ids (fewer writes)                                                     | —                                                                      |
| D46 | An answer counts if the phone recorded it before the attempt ended (server clock offset, 2 s tolerance) and it arrives within 10 minutes after the end                                                                                                                                                                                                  | Owner's choice; covers a ~1 minute cold start and short internet cuts. Trade-off: a student who goes offline and changes the phone clock gains at most 10 minutes | Cheating is seen                                                       |
| D47 | Outbox on the phone: IndexedDB (localStorage fallback), first in first out, retries with exponential backoff and jitter (1 s up to 60 s), also on app start, on `online` and when the page is visible                                                                                                                                                   | Answers and the finish survive a sleeping server, no network or a closed app                                                                                      | —                                                                      |
| D48 | Scores (MCQ, written, total) are stored on the attempt and computed by one pure function (`scoreAttempt`) when the teacher opens the marking page, saves marks or changes the answer key, when results are released, and for late answers after release; nothing is computed while students write (changed 2026-10-25, was: recomputed on every answer) | Exam time stays cheap on 0.1 vCPU; results, CSV and dashboards read one stored row per attempt                                                                    | The teacher needs live scores during the exam                          |
| D49 | Results stay hidden until the teacher releases them; the release chooses what students see (marks, correct answers, comments, top scorer)                                                                                                                                                                                                               | Owner's request                                                                                                                                                   | —                                                                      |
| D50 | Students see only the top scorer (ties together), and the teacher can switch it off per test                                                                                                                                                                                                                                                            | Owner's choice: no full ranking                                                                                                                                   | Teacher feedback                                                       |
| D51 | Bounties: a reward note and points per test; after release the top scorer(s) get the points; the teacher can add points by hand; students see their own points and the class leader                                                                                                                                                                     | Owner chose both the note and points; consistent with D50                                                                                                         | Teacher feedback                                                       |
| D52 | Assignments are offline (the teacher enters marks, saved as a finished attempt without a device token) or done in the app (open for days, no timer, no exit detection)                                                                                                                                                                                  | Owner chose both; every score lives in one table                                                                                                                  | —                                                                      |
| D53 | Written answers are chosen per test: typed, photos after finishing, both, or on paper                                                                                                                                                                                                                                                                   | Owner's choice                                                                                                                                                    | —                                                                      |
| D54 | Charts are small SVG components with the theme colours                                                                                                                                                                                                                                                                                                  | No chart library to download on phones                                                                                                                            | Complex charts are needed                                              |
| D55 | Progress statistics are computed in the browser from the student's released results (pure functions)                                                                                                                                                                                                                                                    | No server CPU; the data is small                                                                                                                                  | Hundreds of results per student                                        |
| D56 | Short, transient database errors are retried (3 tries within about 1 s) around idempotent writes only; the phone hears "saved" only after the commit                                                                                                                                                                                                    | A Turso hiccup must not lose an answer or count it twice                                                                                                          | —                                                                      |
| D57 | Before a test the app shows how to lock the phone to the app (Android App pinning, iPhone Guided Access)                                                                                                                                                                                                                                                | A website cannot block other apps (§9)                                                                                                                            | Browsers offer a lock API                                              |

| D58 | Waiting room: **Start for everyone** is one `UPDATE` of all waiting attempts of the test with the same `started_at` and `deadline_at`. A student who arrives after it waits for the next tap; ending the exam also submits anyone still waiting. Only tests and quizzes use it, and the switch is fixed once a student has started | One write, exactly equal times for everyone, nothing runs on the server while students wait (phones ask every 3 s); the teacher decides about late students | Teacher wants late students to join at once with the shared deadline |

| D59 | Local exam data (saved test tokens, answer outbox, photo outbox) belongs to the student logged in on the phone. Another student's login clears it; logout clears it but waits until every answer and photo is sent. Logout removes only the other cached queries, never the session query the page watches | A shared phone must never open or answer another student's test, and logout must show the login page at once | Students get one phone each and logout is never used |
| D60 | **New PINs for everyone** in a class: one batch write, PINs shown once with Copy all PINs; it logs the students out like a single reset | PINs are stored only as scrypt hashes and can never be shown again | — |
| D61 | Per-test switch (on for new tests): a finished student sees the MCQ result and the correct options at once, computed on request from the stored answers (no work during the exam) and saved on the attempt; written marks, comments and the top scorer wait for release | The owner wants instant MCQ feedback kept in the portal | Early finishers leak answers to students still writing → switch it off for that test |
| D62 | The plain text reader accepts an FBISE paper as written (options on one line, `Section A:` headings, parts without marks, fill-in lines dropped); paper text supports tables (`\|` rows) and `^{}`/`_{}` superscripts and subscripts, rendered by one pure `rich-text.ts` | Teachers paste their own papers; truth tables, K-maps and formulas are common in Class 11 | Papers need real maths layout → add KaTeX, loaded only for papers that use it |
| D63 | Warm design system from the owner's reference: cream page, white cards, orange actions, green good news, red danger, serif page titles; every colour has one role (`docs/DESIGN.md`) | One clear meaning per colour; looks friendly and calm | Owner feedback |

| D64 | Deleting a class can take everything with it (subjects, chapters, tests with all results and photos, students with PINs and points) in one batch write, but only after the teacher types the class name; shared `testDeletionStatements` and `studentDeletionStatements` keep single deletes the same | Removing contents one by one made delete look broken; typing the name prevents an accident | — |
| D65 | Model answers of written questions reach students only after release, and only while "Show the correct MCQ answers and the model answers" is on; in a section called Short, Long or Detailed answers, `a)` lines are parts | The owner wants students to learn from the model answers without leaking them during the test | — |
| D66 | The teacher's test list shows a stage per test (Not open, Opens later, Running, Finished · to mark, Results out) with a coloured edge, finished and still-writing counts and the average after release, from three small counts in the list query | The owner could not see which tests were finished or how they went | Many tests → add paging |
| D67 | Student cards show one pill for what to do or how it went (Start, Continue, Waiting, Locked, Marking, MCQ result, score coloured by percent); the finished screen shows the MCQ score at once | One look tells the student what matters | Owner feedback |

| D68 | Every request waits for a sleeping or restarting server: it tries again every 1 to 5 s for up to 2 minutes on 502/503 (the request never reached the app), and after a broken connection only when repeating is safe (GET, PUT, PATCH, DELETE and POSTs marked repeatable, or the phone was offline); a banner says the app is waiting. The exam outboxes opt out and keep their own retry | The free server sleeps; the teacher's action must finish by itself without making anything twice | Paid server that never sleeps |
| D69 | Students see tests that are not open yet under Coming up (Not open yet, or the opening date and time), with the type, subject and chapters on every card and on the start page | Students should know what is coming and what each test covers | — |
| D70 | Per-test mixed order for typed papers (on for new tests): the server gives each attempt a mixing number (its id); the phone mixes the questions inside each section and the MCQ options with a seeded shuffle, keeping options like All of the above in place, and stores answers in the teacher's order. Paste, drop, laptop shortcuts and printing are blocked during the test | Stops neighbours copying "5 is c" with no extra server work; a website still cannot block other apps (§9), so leaving is detected and counted | Shared figures between questions → teacher picks Same for everyone |
| D71 | A Marks and results panel near the top of every test page with students, and a Mark button per finished student that opens that student on the marking page; answer photos sit inside each student's marking form | The owner could not find where to mark or see photos | — |
| D72 | Tapping a Coming up card shows a popup (Not open yet, or the opening date and time) and the student stays on the dashboard; only open, started and finished tests open a page | The not-open page had no way back and looked blank to students; the dashboard refreshes every 30 s, so a test that just opened shows Start soon after | Shared test links still open the not-open page, which opens the test by itself |

| D73 | A question may have parts (`kind: 'parts'`, part ids `q27a`); a markable unit is a question without parts or one part, and marks, teacher marks, AI marks and the answer key are per unit | Federal Board and grammar papers number one question with parts a), b), c), each with its own answer and marks | — |
| D74 | Plain text: `Answer:` under a part or a blanks question is checked exactly; `Model answer:` is a guide for the teacher or the AI; `Answer:` under a written question without parts stays a model answer; `\|` separates right answers and `;` the answers of the blanks | Old papers keep their meaning; one keyword per idea, easy to write by hand | Teachers mix them up → a per-question choice in the preview |
| D75 | Exact checking compares words only: capitals, spaces, punctuation and curly quotes do not count, and short forms count as the long ones (don't = do not, won't = will not, can't = cannot, I'm, you're, we've, they'll …); `'s` and `'d` stay as written because each has two meanings | Grammar answers are about the words, not commas or full stops; one pure shared function, tested | A punctuation exercise is needed → per-question strict checking |
| D76 | Every input box is one stored answer (answer slot): `q5`, `q27a`, `q32.3` for blank 3; the API field keeps the name `questionId` | The outbox, the sequence rule and the late-answer rule stay unchanged, and answers waiting in phone outboxes during a deploy still arrive | — |
| D77 | MCQ marks become automatic marks (`auto_marks`: MCQ and exact answers) and the instant MCQ result becomes the instant result (`instant_result`), both renamed in migration 16 | Exact answers are marked the same moment and the same way as MCQs | — |
| D78 | `answer_count` (markable units) is stored with the paper next to `question_count` | "Answered N of M" counts units while the paper still says 32 questions; lists stay one query | — |
| D79 | AI connections live in the database: provider, model, an optional web address and the API key encrypted with AES-256-GCM under a key derived from `SESSION_SECRET`; only the last 4 characters are ever shown | The owner adds and changes AIs on a page without touching Render; a copy of the database alone does not reveal the keys | A new `SESSION_SECRET` → the keys must be typed again |
| D80 | Providers are called with plain `fetch`, one small adapter each (OpenAI, Anthropic, Google Gemini, OpenAI-compatible) that returns the reply text; no provider SDKs | No new dependencies on the small server, one fake `fetch` in tests, and the OpenAI-compatible adapter adds most other services without code | A provider needs streaming or files → use its SDK in that adapter only |
| D81 | AI marking is chosen per test (`tests.ai_connection_id`, NULL = off) and only marks the units the app cannot check itself; one request per student carries every such question, its model answer, the typed answers and the answer photos, and asks for JSON | Owner's choice; one request is cheaper than one per question and lets the AI read the photos once | Papers too large for one request → split by section |
| D82 | AI marking jobs: one `ai_marking_jobs` row per attempt with a status, a lease and tries; requests (the student's finished screen, the teacher's marking page) start due jobs, which run after the response, at most 2 at a time; rate limits and server errors retry with growing waits up to 5 tries | No scheduler and nothing lost on a restart (the lease runs out and the next request takes the job); a whole class finishing at once stays within 512 MB | Many classes at once → a real queue |
| D83 | A teacher mark overrules the automatic mark, which overrules the AI mark; AI marks count in the score and are shown with the AI's feedback, and students see them right after finishing only when the instant result is on | The teacher stays the judge; the AI only fills in what nobody marked yet | — |
| D84 | Typed answers go to the AI once the phone has sent everything after Finish; photo answers when the student taps Check my answers or when the 30-minute photo time is over; a late answer or Check again with AI puts the job back to waiting | The AI must see the complete answers, and photos arrive after Finish | — |

## 14. Future extension points (not built now)

- Multiple teachers → `teachers` table + `teacher_id` on subjects/tests; only the auth module changes.
- Archive tests → small addition to the `tests` module.
- Larger storage → swap page storage to Cloudflare R2 behind the same `tests` module interface.

## 15. Release checklist (to verify before first deploy)

Follow [DEVICE-CHECKS.md](DEVICE-CHECKS.md) on a real Android phone (Chrome) and a real iPhone
(Safari), on the HTTPS site, before the first real exam and after big changes. It also covers the
production build + CSP check: pdf.js must render a scanned PDF and a Word-exported PDF.

## 16. Plan for M10–M19 (re-planned 2026-10-24)

On 2026-10-24 the owner asked for much more: full teacher control (rename and delete
everything), PIN and fingerprint login, an installable app, typed papers from JSON or text,
answers that are never lost when the free server sleeps, marking and releasing results, the top
scorer, bounties, and a student dashboard with progress per subject and chapter. This plan
replaces the earlier M10–M14 plan. Each milestone ends usable, tested, documented and committed
before the next one starts. Details may be refined when a milestone starts; the decision log
records every change.

### The owner's answers (2026-10-24)

| Question                       | Answer                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Sample paper                   | The app designs the JSON and text formats and gives the owner a sample to copy (`docs/PAPER-FORMAT.md`, M13) |
| Written answers                | Chosen per test: typed on the phone, photos after finishing, both, or on paper only                          |
| Assignments                    | Chosen per assignment: offline (the teacher enters marks) or done in the app                                 |
| Bounties                       | Both: a reward note with the winner shown, and points that add up                                            |
| What students see about others | Only the top scorer (ties shown together); the teacher can switch it off per test                            |
| Late answers                   | Accepted up to 10 minutes after the end, if the phone saved them before the end                              |
| Web address                    | Keep the `onrender.com` address                                                                              |

### Order and why

| #   | Milestone                                                     | Needs    |
| --- | ------------------------------------------------------------- | -------- |
| M10 | Manage: classes, subjects, chapters, students; rename, delete | —        |
| M11 | Student login (class + roll number + PIN) and student home    | M10      |
| M12 | Installable app, fingerprint login, phone-lock steps          | M11      |
| M13 | Typed papers (JSON or text) and answer sheets for PDF tests   | M10      |
| M14 | Answering on the phone, never losing an answer                | M12, M13 |
| M15 | Photo answers after finishing                                 | M14      |
| M16 | Marking and results: MCQ marks, written marks, release        | M14      |
| M17 | Assignments, bounties and points                              | M16      |
| M18 | Dashboard and progress (student and teacher)                  | M16      |
| M19 | Waiting room: start everyone at the same time                 | M11      |

Accounts come first because everything else (history, marks, progress, "only registered students")
needs to know who the student is. The installable app comes before answering, because a phone
that was closed without network can only reopen the app from the service worker's saved copy.

### Data model at the end of M19

```sql
classes          (id, name UNIQUE NOCASE, created_at)
subjects         (id, class_id → classes, name, created_at, UNIQUE (class_id, name))  -- rebuilt in M10
chapters         (id, subject_id → subjects, name, position, created_at, UNIQUE (subject_id, name))
students         (id, class_id → classes, name, roll_no, roll_no_key, pin_hash,
                  session_version, created_at, UNIQUE (class_id, roll_no_key))
student_passkeys (id, student_id → students, credential_id UNIQUE, public_key, sign_count,
                  transports, created_at, last_used_at)                                  -- M12
tests            + kind ('test' | 'quiz' | 'assignment'), paper_kind ('pages' | 'typed' | 'none'),
                   page_count >= 0, paper JSON, answer_key JSON, max_marks, written_answers,
                   results_released_at, release settings, bounty_note, bounty_points, waiting_room
test_chapters    (test_id → tests, chapter_id → chapters, PRIMARY KEY (test_id, chapter_id))
paper_images     (test_id → tests, image_no, image, width, height)                      -- M13
attempts         + student_id → students (NULL before accounts), token_hash NULL for offline
                   assignments, mcq_marks, written_marks, total_marks                    -- rebuilt in M11
answers          (attempt_id, question_id, choice, text, sequence, answered_at, received_at,
                  PRIMARY KEY (attempt_id, question_id))                                 -- M14
answer_photos    (id, attempt_id, photo_no, image, width, height, created_at)            -- M15
question_marks   (attempt_id, question_id, marks, comment, PRIMARY KEY (attempt_id, question_id))
points           (id, student_id, test_id NULL, points, reason, created_at)              -- M17
```

Tables that must change a constraint are rebuilt with `database.migrate()` (D35).

### M10 Manage: classes, subjects, chapters and students

- One **Manage** area for the teacher: classes → subjects → chapters, and the students of each
  class. Add, rename and delete each of them. Chapters can be put in order.
- Subjects belong to one class and chapters to one subject (D36). The migration puts every
  existing subject into a class called "My class" (D37), so old tests and results keep working.
- **Students:** add one, or paste a list (one "roll number, name" per line). Each new student gets
  a random 6-digit PIN, shown once with a "Copy all PINs" button; it is stored only as a scrypt
  hash (D26). Edit the name, roll number or class; **Reset PIN**; delete.
- **Safe deleting** (D38). The app always asks first and says what goes with it:
  - a class with subjects or students cannot be deleted: move its students to another class, or
    delete them first;
  - a subject with tests cannot be deleted: **Move its tests** to another subject (of any class;
    their chapter tags are removed) or delete the tests first; its chapters go with it;
  - deleting a chapter removes only its tags from tests;
  - deleting a student keeps their old results in each test by name and roll number.
- Tests get a **type** (test or quiz) and **chapter tags**. The test list is grouped by class and
  subject, with a filter for type.
- API: `GET /api/classes` returns the whole tree (classes with their subjects and chapters, and
  counts of students and tests) from three queries; plus create, rename, delete and move
  endpoints for classes, subjects, chapters and students.

### M11 Student login and home

- Login: choose the class, type the roll number and the PIN. A signed cookie keeps the phone
  logged in for 60 days; **Reset PIN** logs out the old phone (D39). Wrong PINs are limited per
  account (D40).
- `/` shows the student home when logged in: profile (name, class, roll number), tests that are
  **open now**, **upcoming tests sorted by the nearest opening time**, and finished tests. Tapping
  an open test starts it, with no typing of names.
- Only registered students of the test's class can start it (D29). The old `/t/<code>` link still
  works: it asks the student to log in first, then opens the test.
- An attempt still gets its own token per device (D41), so exits, the leave rule, unlock and
  "continue on another phone" stay exactly as they are.
- `attempts` is rebuilt: `student_id` (NULL for attempts made before accounts), one attempt per
  student per test, and `token_hash` may be NULL (needed for offline assignments in M17).
- The teacher's results also list the students of the class who have **not started** yet.

### M12 Installable app, fingerprint login and phone-lock steps

- **Installable app (PWA):** a web app manifest (name, short name, black and white icons
  including maskable ones, `display: standalone`, light and dark theme colours) and a small
  hand-written service worker that keeps only the app shell (D43). Android gets an **Install
  app** button; iPhone gets clear "Share → Add to Home Screen" steps.
- **Fingerprint or face login** with passkeys (D42): after a PIN login the app offers "Use
  fingerprint next time". Only the public key is stored, per device. The PIN always works. A
  passkey belongs to the `onrender.com` address; a new address means setting it up again.
- **Locking the phone:** a website cannot block other apps (§9). Before the test the app shows
  short steps for Android **App pinning** and iPhone **Guided Access**, opens fullscreen where the
  browser allows it, and keeps detecting exits with the leave rule (D57).
- Check that the screen stays on and exits are detected in the installed app, especially on
  iPhone (older iOS versions had a wake lock bug in home screen apps).

### M13 Typed papers and answer sheets

- Besides PDF papers, the teacher can paste or upload a paper as **JSON** or **plain text**:
  sections, MCQs and written questions, marks, with or without answers. `docs/PAPER-FORMAT.md`
  gives both formats with a full sample paper for the owner to copy.
- The text format is forgiving (`Q1. ... [2 marks]`, `a) ... b) ...`, `Answer: b`). The app shows
  a **preview** and clear error messages with line numbers before saving.
- The paper looks like a real exam paper: title, sections, numbered questions, marks on the
  right, MCQ options as large tap targets. Urdu (right to left) works in every text. Optional
  small images per question are shrunk in the browser and stored in `paper_images`.
- A typed paper is one JSON document on the test; the **answer key** is kept apart and never sent
  to a student before release (D44). It can come with the paper or be added later.
- A **PDF test can get an answer sheet**: "MCQs 1–20 with options A–D, 1 mark each; written
  questions 21–25 with their marks". It uses the same question list, so marking is the same for
  both kinds of paper.
- Per test: how written questions are answered (D53).
- The paper schema and the text parser become shared runtime code used by the browser and the
  server (this changes D15).
- A typed paper takes about 10–50 KB instead of a few MB for a PDF.

### M14 Answering, and never losing an answer

- Students tap MCQ answers on the paper (or on the answer sheet under a PDF), and type written
  answers when the test allows it.
- **Outbox on the phone** (D47): every answer and the final Finish are saved on the phone
  (IndexedDB, with a localStorage fallback) before any network call. A sender retries with
  growing waits and some randomness until the server confirms, also after the app was closed and
  opened again. The screen shows **Saved**, **Saving…** or **Not sent yet – your answers are safe on
  this phone**.
- **Never twice, never older** (D45): each answer carries a sequence number that grows with every
  change; the server keeps only the newest answer per question, so repeated or out-of-order
  batches change nothing.
- **Deadline rule** (D46): the server stays the judge of time. Answers the phone recorded before
  the end count when they arrive within 10 minutes after it. Pure, tested function.
- **Keeping the server awake:** phones already ask every 30 seconds during a test, which keeps
  Render awake. The deploy guide explains a free uptime pinger for school hours; one service
  running all month (about 744 hours) fits in Render's 750 free hours.
- **Database hiccups:** short Turso errors are retried on the server, and the phone hears
  "saved" only after the data is stored (D56).
- Tests: server asleep then back, repeated batches, out-of-order batches, answers after the
  deadline inside and outside the 10 minutes, and a phone closed and opened again (in-memory
  database and fake clock on the server; a fake network and timers for the outbox).

### M15 Photo answers

- For tests with photo answers: after Finish the student takes up to 10 photos within 30
  minutes. The phone shrinks each photo to about 1600 px JPEG (~200–300 KB) and sends it
  through the outbox; the server checks type, size and dimensions but never re-encodes (D30).

### M16 Marking and results

- MCQs are marked automatically, and again whenever the answer key changes. The teacher enters
  marks per written question (seeing the typed answers or photos) and a comment. Total = MCQ
  marks + written marks, with the percentage. Scores are stored on the attempt (D48).
- **Release results** per test, choosing what students see: marks, the correct MCQ answers,
  comments, the top scorer (D49, D50). Nothing is visible before release.
- Students see each released result and their full history. CSV and print include the marks.

### M17 Assignments, bounties and points

- **Assignments** (D52): offline (no paper, a due date, the teacher enters marks for the class
  list) or in the app (a paper that is open for days, without a timer or exit detection).
- **Bounties** (D51): a reward note and points on a test, for example "Top scorer gets a prize,
  10 points". After release the app shows the winner(s) and gives them the points. The teacher
  can also add or remove points by hand, with a reason. Students see their own points and the
  class leader; the teacher sees the full points table.

### M18 Dashboard and progress

- **Student dashboard:** statistics (tests done, average score, best subject, recent results,
  trend), upcoming tests sorted by the nearest opening time with their state, and a side drawer
  with the profile.
- **Subject page:** its chapters, tests, quizzes and assignments, scores, and progress over time;
  progress per chapter from the tests tagged with it.
- **Teacher's student profile:** every subject, score and progress of one student.
- Charts are small SVG components that follow the light and dark theme (D54). Statistics are
  computed in the browser from the student's released results (D55).

### M19 Waiting room

- A per-test switch. A student who taps Start gets status `waiting` (exists since migration 4).
  The teacher sees who is waiting and taps **Start for everyone**: every waiting attempt gets the
  same `started_at` and `deadline_at`. Waiting phones check every 3 s and open the paper.

### Free-tier budget for M10–M19

| Resource         | Use                                                                   | Limit / plan                       |
| ---------------- | --------------------------------------------------------------------- | ---------------------------------- |
| Turso storage    | Typed paper ≈ 10–50 KB; photos ≈ 15 MB per exam of 10 students        | 5 GB; past ~3 GB move photos to R2 |
| Turso row writes | Answers ≈ 40 students × 50 questions × 2 changes = 4,000 per exam     | 10 M / month                       |
| Turso row reads  | Student home and dashboard: a few queries, one row per result         | 500 M / month                      |
| Render CPU       | PIN hashing only at login; scores computed once per change; no images | ~0.1 vCPU                          |
| Render memory    | Photo uploads one at a time, max 3 MB each                            | 512 MB                             |
| Render hours     | One service awake all month ≈ 744 hours                               | 750 hours / month                  |

## 17. Built milestones

### M23 New question kinds checked by the app (built 2026-10-27)

- **Question kinds** (D73): `short`, `blanks` and `parts` next to `mcq` and `written`. A markable
  unit is a question without parts or one part (`q27a`); the answer key gains `accepted` and
  `blanks`. `markableUnitsOf`, `answerSlotsOf` and `checksAutomatically` live in
  `shared/src/paper-rules.ts`.
- **Exact checking** (D75): `shared/src/answer-checking.ts` (`normalizeAnswer`,
  `isAcceptedAnswer`, `checkUnit`), shared by the server scores and the marking page; `p.m.` and
  `pm` also count the same.
- **Answer slots** (D76): one stored answer per box (`q32.3` for a blank); the server checks each
  slot against the paper; "Answered N of M" counts units (`answer_count`, D78).
- **Scores** (D77): `scoreAttempt` adds automatic marks (MCQ and exact answers, a teacher mark
  overrules) and written marks; marks are rounded to 2 decimals because blanks share marks.
  Migration 16 renamed `mcq_marks` → `auto_marks` and `instant_mcq_result` → `instant_result` and
  added `answer_count`.
- **Student results** are per unit (`unitResultsOf`): the answer, ✓ or ✗ per blank, the right
  answers when allowed, the mark and who gave it. The finished screen shows "Your score for the
  answers the app checks" when the paper has more than MCQs.
- **Phone**: short answers in a one-line box, blanks as boxes inside the sentence or passage;
  paste, drop, spelling correction and auto-complete are off in every box.
- **Teacher**: the preview shows the right answers under each part and inside each blank, and
  counts how many typed answers the app checks; the marking page shows one row per unit with the
  automatic mark as the placeholder. Papers that plain text cannot hold (a top-level short
  question from JSON) open in the editor as JSON.
- **Formats** (D74): plain text and JSON as in `docs/PAPER-FORMAT.md`; the owner's 50-mark
  English tenses paper is the second sample paper (49 answer boxes).

### M22 Owner's third feedback round (built 2026-10-24)

- **Sleeping server**: every action waits and finishes by itself, with a waiting banner (D68).
- **Login switch**: the teacher login links to the student login.
- **Students see** type, subject, chapters, and tests not open yet with their date (D69).
- **Anti-cheating**: mixed question and option order per student, no paste, no shortcuts, no
  printing (D70).
- **Marking is easy to find**, with answer photos next to the marks (D71).
- **Coming up cards** show a popup instead of a page with no way back (D72).

### M21 Owner's second feedback round (built 2026-10-24)

- **Delete a class** with everything in it after typing its name (D64).
- **Model answers** for short and long questions, shown to students after release (D65).
- **Teacher dashboard**: stage, finished counts and average on every test card (D66).
- **Student dashboard**: tiles, clear cards with one pill each, Results with Show all; the
  **finished screen shows the MCQ score** with right, wrong and not answered counts (D67).

### M20 Owner's first feedback round (built 2026-10-24)

- **Logout fixed** (D59): the teacher saw the pages stay after logout and "Please log in first."
  everywhere; now the login page shows at once. An expired session shows the login page too.
  Shared phones keep each student's test data apart, and logout waits for unsent answers.
- **New PINs for everyone** in Manage → class → Students (D60).
- **MCQ result right after finishing**, also later in the portal; green and red answers (D61).
- **FBISE papers**: pasted as written, tables and formulas, model answers on the marking page,
  and a full HSSC-I Computer Science sample paper (D62, `docs/PAPER-FORMAT.md`).
- **New look**: warm colours with clear roles in light and dark (D63, `docs/DESIGN.md`).

### M19 Waiting room (built 2026-10-25)

- A test or quiz can be set to **Students start: Together, when I start everyone** (migration 13
  adds `tests.waiting_room`). A student who taps **Start test** gets status `waiting` and sees
  "Waiting for your teacher"; the phone asks the server every 3 s and keeps the screen on.
- While waiting there is no paper and no answers (409 `not_started`), and exits and Finish do
  nothing. The time has not started.
- The results show each waiting student and a **Start for everyone (N waiting)** button. One tap
  gives all of them the same start and deadline (D58); their phones open the paper within 3 s.
  Students who come later wait for the next tap. **End exam for everyone** also submits waiting
  students.

### M18 Dashboard and progress (built 2026-10-25)

- **Student dashboard** (`/`): open, upcoming and the last finished tests, then **Progress**
  (tests done, average, best subject, trend, a line chart of the scores) and **Subjects** with an
  average bar each. **Menu** opens a side drawer with the profile, points, class leader, theme
  and log out.
- **Subject page** (`/subjects/:id`): scores over time, progress per chapter from the tests
  tagged with it, and all tests, quizzes and assignments of the subject.
- **Teacher's student profile** (`/teacher/students/:id`, from the student's name in Manage):
  the same overview over every marked result (also before release), the results list and the
  points history.
- The server returns one list of results (D55); `progress-stats.ts` computes averages, the best
  subject, the trend (last three against the three before, 5 points apart) and chapter progress
  in the browser, with tests. Charts are two small SVG components that use the theme colours
  (D54).

### M17 Assignments, bounties and points (built 2026-10-25)

- **Assignments** (D52) are tests with the type **Assignment**. Done in the app (PDF or typed
  paper): no timer and no exit detection; the deadline is the closing time, or 30 days after the
  start when no closing time is set (`deadlineFor`, pure and tested). The server ignores exit
  reports for assignments. **No paper** makes an offline assignment: the teacher gives the total
  marks and later types each student's marks on **Enter marks and release**; they are stored as
  finished attempts without a device token (`token_hash` NULL since M11).
- **Bounties** (D51): any test can have a reward note and points. Releasing the results gives the
  points to the top scorer(s) (`points` rows with the `test_id`), replacing earlier ones, so a new
  release after a mark change moves the points; **Hide results** takes them back.
- **Points**: the class page has a **Points** tab with every student's points and **Give or take
  points** with a reason. Students see their own points and the class leader on their home.
- Migration 12 rebuilt `tests` (paper kind `none`, bounty columns, the CHECKs that tie them
  together) and added `points`.

### M16 Marking and results (built 2026-10-25)

- **Marks and release** (`/teacher/tests/:id/marking`): every student with the score so far and
  how far the marking is. Opening a student shows each question with the chosen option (and the
  correct one) or the typed answer, and the answer photos; the teacher enters marks (whole or
  half, up to the question's marks) and a comment per question, plus a comment for the student.
  Saving opens the next student. A teacher mark overrules the automatic MCQ mark.
- `scoreAttempt` (pure, tested) adds MCQ marks from the key and the teacher's written marks;
  scores are stored on the attempt as described in D48, so a new answer key re-marks every
  student at once.
- **Release** chooses what students see: the correct MCQ answers, the comments and the top scorer
  (D49, D50; ties are shown together and nobody is top with 0 marks). **Hide results** takes it
  back. Students see **Marks: 4.5 of 5** on their home and a result page with the paper, their
  answers, the marks and the comments.
- The results CSV and the print page get a **Marks** column when the test has marks.

### M15 Photo answers (built 2026-10-25)

- Tests whose written answers are **photos** (or **typed and photos**) show **Photos of your
  written answers** after Finish: up to 10 photos within 30 minutes (`photo-rules.ts`, pure and
  tested). The phone shrinks each photo to 1600 px JPEG (about 200–300 KB) and keeps it in a
  **photo outbox** (IndexedDB) that sends one photo at a time with the same backoff as answers,
  also after the app was closed.
- The server checks the type and the size with `sharp` metadata and stores the bytes as they came
  (D30). Each photo carries a random id from the phone, so a repeated upload is stored once.
  Counting and numbering happen in one `INSERT … SELECT … HAVING COUNT(*) < 10` statement.
- The teacher's results show **Photos N** and **See the answer photos**.

### M14 Answering and never losing an answer (built 2026-10-25)

- Students tap multiple choice answers (tap again to clear) on the typed paper or on the
  **Answer sheet** tab under a PDF, and type written answers when the test allows it (D53).
- **Outbox** (D47, `web/src/features/student/answers/`): every change is saved on the phone
  first (IndexedDB through `lib/durable-store.ts`, localStorage when IndexedDB fails), keeping
  only the newest unsent answer per question. A sender posts batches of up to 50 answers, then
  the Finish, in that order; it retries with exponential backoff and jitter from 1 s up to 60 s,
  and starts again on app start, on `online` and when the page becomes visible. Typed text waits
  1.5 s before sending. The top bar shows **Saved**, **Saving…** or **Not sent yet – your answers are
  safe on this phone**. While Finish waits for the network, exits are no longer reported.
- The store is a factory (`createOutboxStore`) with the network, storage, clock and randomness
  passed in, so tests run it with a fake server, memory storage and fake timers: the server
  asleep and back, a phone closed and opened again, an answer changed while it was being sent,
  Finish after the answers, and a logged-out phone.
- **Server** (D45, D46, D56): one upsert per answer in one batch, kept only when its sequence is
  higher, so repeated and out-of-order batches change nothing. `isAnswerInTime` (pure, tested)
  counts an answer when the phone recorded it before the end (2 s tolerance; a phone time later
  than the arrival is never trusted) and it arrives within 10 minutes after the end. Short Turso
  errors are retried up to 3 times within about 0.6 s around these idempotent writes and the
  finish. A new phone restores the saved answers from `GET /api/attempt/answers`.
- The teacher's results show **Answered N of M** per student.

### M13 Typed papers and answer sheets (built 2026-10-25)

- **New test → Paper → Type or paste**: the teacher pastes plain text or JSON
  (`docs/PAPER-FORMAT.md` has both formats with a full sample, and a test checks that the samples
  stay valid). The editor shows the problems with line numbers, warnings (missing marks count 1),
  a summary (questions, marks, answered MCQs) and a live preview with the correct options
  marked, where pictures are added per question (shrunk to 1000 px WebP in the browser).
- The text reader is forgiving: `# Section`, `1.` / `Q1.` / `1)`, `a)` / `(A)` / `A.`, marks as
  `[2]`, `[2 marks]` or `(2 marks)`, `Answer: b`, model answers over several lines, and written
  questions with parts that carry their own marks. `paperToText` writes a paper back in the same
  format, so editing an existing paper starts from its text.
- One `Paper` shape for both kinds (D44): typed tests store it as their paper; a PDF test can store
  it as its **answer sheet** (built from "N MCQs with options A–D, M marks each; K written
  questions"). The answer key is a separate column, changed any time on **Questions and
  answers** (letters in order like `BCAD?`, or tap per question), never sent to students.
  `question_count` and `max_marks` are stored with the paper so lists stay one query.
- Migration 8 rebuilt `tests` (page count may be 0, the duration has no upper limit in the
  database any more, and the new paper columns) and added `paper_images`.
- Students see the typed paper as a real exam paper: instructions, sections, numbered questions,
  marks on the right and large option buttons, right-to-left text where needed. The paper and its
  pictures load when the exam opens and are dropped from memory when it closes, like PDF pages.
- How written questions are answered is chosen per test (D53); answering itself comes in M14.

### M12 Installable app, fingerprint login and phone-lock steps (built 2026-10-25)

- **Installable app:** `manifest.webmanifest` with black and white icons (normal and maskable,
  plus an Apple touch icon) and `display: standalone`. `public/service-worker.js` (D43) keeps the
  app page and the hashed `/assets` files, takes pages from the network and the saved page when
  offline, and never touches `/api` (so the paper and answers are never cached). It is registered
  only in the production build. Android shows **Install app** (the `beforeinstallprompt` event is
  caught in `main.tsx`); iPhone shows the **Share → Add to Home Screen** steps.
- **Fingerprint or face login** (D42): after a PIN login the student home offers **Use
  fingerprint**. Only the public key is stored, with user verification required and a platform
  passkey that the phone keeps. The challenge lives in a signed 5-minute cookie that is cleared
  when it is used. **Reset PIN** and deleting a student also remove the student's passkeys, so a
  lost phone cannot log in any more. Tests use a small software authenticator
  (`test/support/software-authenticator.ts`) that signs real WebAuthn answers.
- **Locking the phone** (D57): the start page has a **Lock your phone to this test** section with
  Android App pinning and iPhone Guided Access steps for the student's phone.

### M11 Student login and home (built 2026-10-25)

- `/login`: class, roll number and PIN (the class is chosen for you when there is only one).
  `/` shows the student home when logged in: name, class and roll number, then **Open now**
  (open tests and unfinished attempts), **Upcoming** (sorted by the nearest opening time) and
  **Finished** (finished or missed). The grouping is a pure, tested function.
- The test link asks for the login first, then shows **Start test** with the student's name; no
  typing of names any more. A student of another class gets a clear message.
- Migration 6 rebuilt `attempts`: `student_id` (NULL for attempts made before accounts), one
  attempt per student per test, and a nullable `token_hash` for the offline assignments of M17.
  Deleting a student sets `student_id` to NULL, so old results stay by name and roll number.
- The teacher's results list **Not started yet** with the class's students who have no attempt.

### M10 Manage (built 2026-10-25)

- **Manage** tab for the teacher: `/teacher/manage` lists the classes; `/teacher/manage/classes/:id`
  has two tabs, **Subjects** (rename, move to another class, move its tests, delete; chapters with
  add, rename, up and down, delete) and **Students** (add one, paste a list with a preview and line
  numbers for problems, new PINs shown once with **Copy all PINs**, edit, Reset PIN, delete, move
  all students to another class).
- Every delete asks first and says what goes with it; a blocked delete explains why (D38). The
  explanations are pure functions in `manage/manage-rules.ts` with tests.
- The class tree (`GET /api/classes`) is the one source for the Manage pages, the test form's class
  and subject pickers and the test list's subject filter, so a change in Manage refreshes them all
  with one request.
- Tests have a type (test or quiz) and chapter tags; the test list is grouped by class and subject
  and can be filtered by subject and type.
- Migration 5 rebuilt `subjects` with `class_id` and added `classes`, `chapters`, `students`,
  `test_chapters` and `tests.kind`; existing subjects went into "My class" (D37).

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

## 18. Plan for M23 and M24 (2026-10-27)

On 2026-10-27 the owner asked for two things:

1. **More kinds of questions that students answer on the phone**, for English papers in the Federal
   Board pattern and for grammar tests (tenses): a reading passage with questions, change a sentence
   (negative, interrogative, another tense), correct the error, name the tense, fill in the blanks
   in sentences and in a whole passage, and translate from Urdu to English. When the teacher gives
   the right sentence, the app compares the student's sentence with it: right gives the marks, wrong
   gives 0 and shows the right sentence.
2. **AI marking**: the teacher saves an API key of Claude, GPT or Gemini (and later any other
   service with a small setting), decides per test whether the written (descriptive) answers go to
   the AI, and after a student finishes the AI marks the typed answers or the answer photos and
   explains each mark.

The Federal Board HSSC-I English paper (searched 2026-10-27; fbise.edu.pk itself could not be
reached from the cloud machine) has 20 MCQs (vocabulary, figures of speech, grammar), a reading
passage with five questions and a summary, a poetry stanza with questions, and writing tasks
(letter, report, paragraph). Every part of it fits the question kinds below.

### Question kinds after M23

| Kind      | The student                                    | Marked by                                       |
| --------- | ---------------------------------------------- | ----------------------------------------------- |
| `mcq`     | taps an option                                 | the app (answer key)                            |
| `short`   | types one sentence or a few words              | the app, when the key gives the right answer(s) |
| `blanks`  | types into boxes inside the text (`_____`)     | the app, blank by blank; marks shared equally   |
| `written` | types a long answer, or sends photos           | the teacher, or the AI when the test uses it    |
| `parts`   | answers parts a), b), c)… each of a kind above | per part                                        |

A question with parts keeps its stem ("Change into negative sentences.") and its number (27);
each part (27 a, 27 b) has its own answer box, marks, answer and mark (D73). Papers saved before
M23 do not change.

### M23 New question kinds and exact checking

- **Shared model** (`shared/src/paper.ts`, `paper-rules.ts`): `kind` gains `short`, `blanks` and
  `parts`; a `parts` question has `parts: [{ id, kind, text, marks, options }]` with ids `q27a`,
  `q27b`. A **markable unit** is a question without parts or one part; marks, teacher marks,
  AI marks and the answer key are per unit. The key gains `accepted` (right answers of a short
  unit) and `blanks` (right answers per blank).
- **Answer slots** (D76): every box on the phone is one stored answer: `q5`, `q27a`, and
  `q32.3` for blank 3 of question 32. The outbox, the sequence rule and the late-answer rule do
  not change.
- **Exact checking** (D75) is one pure shared function used by the server and the result pages.
- **Plain text format** (D74):
  - `a) ...` lines followed by their own `Answer: ...` line make a question with parts; the
    answer is checked exactly. `Model answer: ...` under a part makes it a written part that the
    teacher or the AI marks with that guide. Parts without marks share the question's marks
    equally.
  - A question or part with `_____` and `Answer: had run; is studying` becomes blanks; the
    answers are in order, separated by `;`.
  - Several right answers are separated by `|`:
    `Answer: He doesn't like cold weather. | He hates cold weather.`
  - `Answer:` under a written question without parts stays a model answer, as before.
- **JSON format**: `"type": "short" | "blanks" | "parts"`, `"answers": [...]` and `"parts": [...]`.
- **Phone**: one-line boxes for short answers, boxes inside the sentence or passage for blanks,
  the written box as before; spelling correction, auto-complete and paste are off in every box.
- **Scores**: MCQ marks become **auto marks** (MCQ + exact answers; D77). The switch "Students see
  their multiple choice result right after finishing" becomes "Students see the automatic marks
  right after finishing". The result shows each answer with ✓ or ✗ and the right answer when the
  release (or the instant result) allows it.
- **Marking page**: per unit, with the student's answer, ✓ or ✗ per blank, the right answers, and
  a marks box that overrules the automatic mark.
- **Sample paper**: the owner's 50-mark tenses paper as a second sample, with every answer.
- Migration 16: `answer_count` on tests (D78), `mcq_marks` → `auto_marks`, `instant_mcq_result` →
  `instant_result`.

### M24 AI marking

- **AI page** for the teacher (D79): add an AI with a provider (OpenAI GPT, Anthropic Claude,
  Google Gemini, or **Other, OpenAI-compatible** with its web address, which covers services such
  as DeepSeek, Groq, Mistral and OpenRouter), a model name (filled in with a suggestion) and the
  API key. **Check** sends a tiny request and shows the provider's answer or error. The key is
  stored encrypted and never shown again; only its last 4 characters are.
- **Per test** (D81): "Check written answers with AI: Off / <AI name>", changeable at any time.
  The AI marks the units the app cannot check by itself (written units, and short or blank units
  without an answer); it never changes MCQ or exact marks.
- **One request per student** with every AI-marked question, its marks, the model answer, the
  typed answers and the answer photos; the reply is JSON with marks (in half marks, never above
  the question's marks) and one or two sentences of feedback per question.
- **Jobs** (D82): `ai_marking_jobs` keeps one row per attempt (`waiting`, `working`, `done`,
  `failed`, a lease time, tries and the error). The student's finished screen and the teacher's
  marking page start waiting jobs; the work runs after the response, at most two at a time, so a
  whole class finishing together never fills the 512 MB. Rate limits, timeouts and server errors
  wait and try again (up to 5 tries); a wrong key or model fails at once with the provider's
  message. A restart mid-job loses nothing: the lease runs out and the next request takes the job
  again.
- **When** (D84): typed answers are marked as soon as the phone has sent everything after Finish;
  photo answers when the student taps **Check my answers** after sending the photos, or when the
  30-minute photo time is over. A late answer or **Check again with AI** puts the job back to
  waiting.
- **Marks** (D83): teacher mark > automatic mark > AI mark. The marking page shows the AI mark
  and feedback under each answer; a teacher mark overrules it. With the instant result on,
  students see the AI marks at once, marked "Checked by AI – your teacher may change it"; model
  answers still wait for the release (D65).
- API:

  ```
  GET    /api/ai-connections                 → the saved AIs (never the key)
  POST   /api/ai-connections                 { name, provider, model, baseUrl, apiKey }
  PATCH  /api/ai-connections/:id             { name?, model?, baseUrl?, apiKey? }
  DELETE /api/ai-connections/:id             → tests that used it switch AI marking off
  POST   /api/ai-connections/:id/check       → a tiny request to the provider
  GET    /api/tests/:id/ai-marking           → each attempt's AI marking state (starts due jobs)
  POST   /api/tests/:id/ai-marking           { attemptIds } → check these again with AI
  GET    /api/attempt/ai-marking             → the student's own AI marking state
  POST   /api/attempt/ai-marking             → my answers are complete, check them now
  ```

- Migration 17: `ai_connections`, `tests.ai_connection_id`, `ai_marks`, `ai_marking_jobs`.

### Free-tier budget for M23–M24

| Resource         | Use                                                                         | Limit / plan                                                             |
| ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Render CPU       | Exact checking is string work when marks are computed; AI is a network wait | ~0.1 vCPU                                                                |
| Render memory    | At most 2 AI requests at once, each up to ~15 MB with 10 photos             | 512 MB                                                                   |
| Turso row writes | Blanks add one row per filled blank; AI adds one row per marked unit        | 10 M / month                                                             |
| AI provider      | One request per student per test (more only on "Check again")               | Paid by the owner's API key; Gemini has a free tier with low rate limits |
