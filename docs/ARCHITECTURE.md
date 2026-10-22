# Exam Room — Architecture

> Status: **approved plan, v1** (2026-10-22). Update this file whenever a decision below changes.

Exam Room is a small mobile-first web app. A teacher uploads a test paper (PDF), shares a link, and
students read the paper on their phones inside the website — with a timer, exit detection and a
traceable watermark. Expected scale: **one teacher, 5–10 students per test.**

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
| Styling      | CSS Modules + a small set of CSS variables                     | No framework to learn; simple white design                                      |
| PDF viewer   | Page images + `react-zoom-pan-pinch`                           | Same pinch/zoom on iPhone and Android; native pinch would also zoom the top bar |
| PDF → images | `pdfjs-dist` **in the teacher's browser**                      | Free server has little CPU; the PDF never reaches the server at all             |
| Backend      | Express 5, zod, helmet, express-rate-limit, multer             | Mature, minimal, well understood                                                |
| Database     | SQLite via `@libsql/client` (local file in dev, Turso in prod) | Same SQL everywhere; switching is one env var                                   |
| Watermark    | `sharp`, burned into each image on the server per student      | The image bytes themselves carry the name — removing a CSS overlay does nothing |
| Tests        | Vitest + supertest                                             | Unit tests for rules, integration tests for the API                             |
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
            allowed_exits CHECK (0..2), page_count, created_at)

test_pages (test_id → tests ON DELETE CASCADE, page_no,
            image BLOB, width, height,
            PRIMARY KEY (test_id, page_no))

attempts   (id PK, test_id → tests, student_name, roll_no, roll_no_key,  -- key = trimmed + lowercased
            token_hash UNIQUE,              -- sha256 of the student's secret token
            status CHECK IN ('in_progress','submitted','locked'),
            finish_reason CHECK IN ('student','time_up') NULL,
            started_at, deadline_at, finished_at NULL,
            exit_count DEFAULT 0, forgiven_exits DEFAULT 0,
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
2. Tapping **Start Test** requests fullscreen _first_ (browsers only allow it inside a tap), then
   calls the server.
3. Server creates the attempt: `deadline_at = now + duration`, generates a random secret token,
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
- The server burns a light diagonal watermark (name + roll number) into the image with `sharp`,
  using a **font bundled in the repo** (no dependence on fonts installed on the host).
- Response headers: `Cache-Control: no-store`. Watermarked images are kept in a small in-memory
  LRU cache — cache only, never the source of truth.
- The phone fetches images with JS and shows them via `blob:` URLs — there is no image link to copy
  or open in another app.
- After submit/lock the server refuses every page request, so the paper is gone for good.

### 6.5 Exit detection

- Signals: `visibilitychange` (hidden), `window blur`, and `fullscreenchange` (only if fullscreen was
  entered). They often fire together, so the phone merges them: the **first** signal moves the
  client from `present` to `away`; further signals are ignored until the student returns.
- On leaving, the phone sends `POST /api/attempt/exits` immediately using `fetch(..., { keepalive: true })`
  so the request survives the page going to the background. It carries a random `client_exit_id`,
  so retries never double-count.
- On return, the phone calls `POST /api/attempt/return`. The server closes the open exit and
  computes `away_ms` **from its own clock**. If the "left" request was lost (e.g. no network), the
  server records the exit from the return call instead.
- The server applies the rule (see 6.6) and replies with the new state; the phone shows either the
  red warning screen ("You left the test (X of Y allowed)…" → **Continue**) or the locked screen.
- The Finish confirmation is a custom in-page modal, never `window.confirm()` — native dialogs can
  fire `blur` and would count as a false exit.

### 6.6 The rules (pure functions in `attempts/rules.ts`)

- **Lock:** an attempt locks when `exit_count > allowed_exits + forgiven_exits`.
  With 0 allowed exits, the first exit locks immediately (no warning screen).
- **Unlock (teacher):** `forgiven_exits += 1`, status back to `in_progress`. The exit stays in the
  log; the timer was never paused, so no time is added.
- **Exits while locked or finished** are ignored.
- **Refreshing the page counts as an exit** — a browser cannot tell a refresh from leaving.

### 6.7 Teacher results

`GET /api/tests/:id/attempts` returns, per student: name, roll number, start, finish, exits, total time
away (including a still-open exit), status. The page polls every 5 s (TanStack Query). Status labels:
`in_progress → In progress`, `submitted → Submitted`, `locked → Left the test` (row in red, with an
**Unlock** button). No WebSockets — not needed at this scale.

## 7. API

Teacher (session cookie required, except login):

```
POST   /api/auth/login            { password }
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/subjects
POST   /api/subjects              { name }
GET    /api/tests?subjectId=
POST   /api/tests                 multipart: subjectId, title, durationMinutes, allowedExits, pages[]
GET    /api/tests/:id
GET    /api/tests/:id/attempts
POST   /api/attempts/:id/unlock
```

Student (public by test code, then `Authorization: Bearer <token>`):

```
GET    /api/public/tests/:code             → title, subject, durationMinutes, pageCount, allowedExits
POST   /api/public/tests/:code/attempts    { name, rollNo }  → token + state
GET    /api/attempt                        → state (status, deadlineAt, serverNow, exits, pageCount…)
GET    /api/attempt/pages/:n               → watermarked image (in progress only)
POST   /api/attempt/exits                  { clientExitId, reason }
POST   /api/attempt/return                 { clientExitId, awayMsClient }
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
- **Headers:** helmet with a strict CSP (`default-src 'self'`, `img-src 'self' blob: data:`).
- **Proxy:** `trust proxy` enabled so rate limiting sees real IPs behind Render.
- **Client deterrents:** no text selection, copy, cut, right-click, drag or long-press save
  (`-webkit-touch-callout: none` + a transparent layer over the images); `@media print` hides the
  page; no download/print buttons anywhere.

## 9. What a browser cannot do (honest limits)

- It cannot block screenshots or a second phone photographing the screen → the watermark makes any
  leak traceable.
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
| Turso row reads  | 500 M / month     | One read per page view; watermarked pages cached in memory                   |
| Render bandwidth | monthly allowance | One exam ≈ 10 students × 10 pages × ~250 KB ≈ 25 MB                          |

Rules that protect the budget: sharp runs with its cache off and one thread
(`configureImageProcessingForSmallServers`), pages are processed one at a time, uploads are capped
(30 pages, 3 MB each), and pdf.js is loaded only on the teacher's "New test" screen.

- **Cold start:** after 15 min with no traffic the app sleeps and the next visit takes ~1 minute.
  Open the site 2–3 minutes before an exam; during the exam, student traffic keeps it awake.
- Render may sometimes ask for a card to verify the account (a $1 hold that is cancelled).
- Deploy is described in `render.yaml` + README: push to GitHub → create Turso DB → connect repo on
  Render → set `TEACHER_PASSWORD`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (`SESSION_SECRET` is generated).

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

## 13. Decision log

| #   | Decision                                               | Reason                                                         | Revisit when                                                           |
| --- | ------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| D1  | Single process serves API + SPA                        | Same origin, one deploy unit                                   | Never at this scale                                                    |
| D2  | SQLite via libSQL (file locally, Turso in prod)        | Free, simple, same SQL in both places                          | > hundreds of concurrent users                                         |
| D3  | Page images stored in the DB                           | Host has no persistent disk; tiny data volume                  | Storage > ~3 GB → move to object storage (R2)                          |
| D4  | PDF → images in the teacher's browser                  | Free server CPU is tiny; PDF never leaves the teacher's device | Never                                                                  |
| D5  | Watermark burned in on the server                      | Removing an overlay can't strip it                             | —                                                                      |
| D6  | Server-authoritative timer and status                  | Client can't be trusted                                        | —                                                                      |
| D7  | Refresh counts as an exit                              | Browser can't distinguish refresh from leaving                 | Teacher feedback                                                       |
| D8  | Timer never pauses (away, locked, unlocked)            | Simple and fair                                                | Teacher feedback                                                       |
| D9  | Resume on another device allowed but counts as an exit | Dead-battery case without a free pass                          | Teacher feedback                                                       |
| D10 | Teacher results by 5 s polling, no WebSockets          | Simpler; enough for 10 students                                | Many concurrent tests                                                  |
| D11 | Single teacher password, no user table                 | Spec: one teacher                                              | Multiple teachers needed → add `teachers` table behind the auth module |
| D12 | Original PDF never stored                              | Can't leak what we don't keep                                  | —                                                                      |
| D13 | TypeScript pinned to 6.0                               | typescript-eslint does not support TS 7 yet                    | typescript-eslint supports TS 7                                        |
| D14 | Server bundled with esbuild; `tsc` only type-checks    | One output file, no `rootDir`/workspace build issues           | —                                                                      |
| D15 | `shared/` is types-only                                | Erased at build → nothing to build or deploy for it            | Runtime sharing needed (e.g. zod schemas on both sides)                |
| D16 | Stateless HMAC session cookie (no sessions table)      | One teacher; nothing to store                                  | Need to revoke sessions → rotate `SESSION_SECRET` or add a table       |

## 14. Future extension points (not built now)

- Multiple teachers → `teachers` table + `teacher_id` on subjects/tests; only the auth module changes.
- Delete/archive tests, CSV export of results → small additions to `tests` / `attempts` modules.
- Larger storage → swap page storage to Cloudflare R2 behind the same `tests` module interface.
- Urdu-script names in the watermark → bundle a second font (e.g. Noto Naskh Arabic).

## 15. Release checklist (to verify before first deploy)

- Production build + CSP: create a test from a scanned PDF and from a Word-exported PDF; confirm
  pdf.js renders both (worker, fonts, and image decoders allowed by the Content Security Policy).
- Real devices: Android Chrome and iPhone Safari for every student screen.
