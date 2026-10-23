# Prompt for the next session (Exam Room M10+)

Copy everything below the line into a new Claude Code session opened in this repository.

---

You are continuing **Exam Room**, a mobile-first exam web app for one teacher (the owner) and a
small class (today: 2 students with 8–9 subjects; design for about 40 students). M0–M9 are built:
PDF tests shown as page images, a server-side timer, exit detection with a per-test leave rule
(lock or finish), open/close/schedule, end exam, edit test, delete, CSV/print export, a screen wake
lock, and a black and white theme. Work like a principal engineer: scalable, optimized, clean
architecture, and pure business rules with tests.

## First steps (do these before writing any code)

1. Read `CLAUDE.md` and follow every rule in it (no comments in code, readable unabbreviated names,
   small Conventional Commits, `npm run check` green before every commit, no AI attribution,
   plan first, explain in simple English because the owner is not a native English speaker,
   free hosting only, TypeScript pinned to 6.0).
2. Read `docs/ARCHITECTURE.md` completely: the decision log D1–D34 and the plan in §16 (M10–M14).
   Run `git log --oneline -30` to see what is done.
3. The owner's new requirements below **extend and partly replace** the §16 plan (M10–M14).
   Re-plan the milestones from M10 on in §16, record every new decision in the decision log, and
   show the plan to the owner in simple English. Ask the open questions listed at the end with
   `AskUserQuestion` before building. Build one milestone at a time; each milestone ends usable,
   tested, documented and committed.

## Hard constraints (never break these)

- **Free hosting:** Render free web service (512 MB RAM, about 0.1 vCPU, no disk, sleeps after
  15 minutes without traffic, about 1 minute to wake up) and the Turso free database (5 GB storage,
  500 M row reads and 10 M row writes per month). The server is stateless; everything lives in the
  database. No paid services. Keep heavy work in the browser, not on the server.
- **Server-authoritative:** the server decides time, status and marks. The phone only shows and
  reports.
- **Migrations are append-only.** libSQL enforces foreign keys, so never `DROP` a parent table
  without moving its child rows first (see D32 and migration 4).
- **Existing data keeps working:** PDF tests and attempts made before accounts must still show in
  results.
- Keep everything that already works (exit detection, leave rule, wake lock, theme, export).

## What the owner wants

### 1. Full control for the teacher

- Add, rename and delete everything: classes, subjects, chapters, students, tests, quizzes,
  assignments and questions. Today subjects can only be added; add rename and delete.
- Deleting something that other things depend on must be safe: ask first, explain what will be
  removed, and refuse or offer to move dependents (for example a subject that still has tests).
- One clear "Manage" area for classes, subjects, chapters and students.

### 2. Student accounts, login and the installable app

- The teacher registers students (class + roll number + name) and the app gives each a PIN
  (decision D26: class + roll number + 6-digit PIN, stored as a scrypt hash, login kept for 60
  days, PIN reset logs out old phones). Only registered students can open tests (D29).
- **Fingerprint / face login:** after the first PIN login, offer "Use fingerprint next time" with
  WebAuthn passkeys (platform authenticator). Store only the public key per device. The PIN always
  stays as a fallback. A well-known, light library such as `@simplewebauthn/server` and
  `@simplewebauthn/browser` is fine; check the current version first. Passkeys are tied to the
  domain (the Render `onrender.com` address); if the domain changes later, students must set up
  the fingerprint again. Write this in the decision log.
- **PWA:** a web app manifest (name, short name, black and white icons including maskable ones,
  `display: standalone`, theme colours for light and dark), a service worker that caches only the
  app shell, an "Install app" button on Android and clear "Add to Home Screen" steps on iPhone.
  Never cache API responses or paper content in the service worker. Keep the Content Security
  Policy strict (the worker must be same-origin). Check that the wake lock and exit detection
  still work in the installed app, especially on iPhone (WebKit had a wake lock bug in home-screen
  apps).

### 3. Student home: dashboard, profile, subjects and progress

- A side drawer (or profile screen) with the student's profile: name, class, roll number.
- The front screen is a dashboard like other apps: statistics (tests done, average score, best
  subject, recent results, trend), and **upcoming tests sorted by the nearest opening time**. A
  card shows its state; when the test is open, tapping it starts the test.
- Each subject has its own page: chapters, tests, quizzes and assignments, scores, and progress
  over time. The teacher tags every assessment with a subject and chapter(s) (for example
  "Chapter 1"), so progress per chapter and per subject can be measured.
- Charts must be light (plain SVG or a very small library) and work in light and dark themes.

### 4. Locking the phone during a test

- The owner wants students not to open anything else while the test is open. Be honest: a website
  or PWA cannot block other apps (ARCHITECTURE §9). Keep detecting and enforcing the leave rule,
  open fullscreen where the browser allows it, and before the test show short steps for the
  phone's own lock features: Android **App pinning** (screen pinning) and iPhone **Guided
  Access**. Explain this limit to the owner in simple English.

### 5. Typed papers from JSON or plain text (saves storage)

- Besides PDF tests, the teacher can paste or upload a paper as **JSON** or **simple text**: MCQs
  and written questions, with or without answers. Design both formats (a zod schema for JSON and a
  small, forgiving text parser, for example `Q1. ... [2 marks]`, `a) ... b) ...`,
  `Answer: b`), show a preview with clear error messages and line numbers, then save.
- Show the paper like a real exam paper: title, sections, numbered questions, marks on the
  right, MCQ options as large tap targets. Support Urdu (right-to-left) text. Optional small
  images per question are stored compressed. Ask the owner for a real sample and test the parser
  with it.
- Keep the anti-copy measures (no text selection, no copy, exit detection).
- Assessment types: test, quiz and assignment (ask the owner what an assignment is: done online,
  or offline with marks entered by the teacher).

### 6. Answers, marking and results

- Students answer MCQs on the phone. Every answer is saved on the phone at once and sent to the
  server in small batches (see section 7).
- The MCQ answer key can be in the paper or uploaded later. MCQs are marked automatically when
  the attempt finishes, and marked again if the key changes later.
- The teacher enters marks for written questions (per question). Total = MCQ marks + written
  marks; also show the percentage.
- **Release results** per assessment. Nothing is visible to students before release. The teacher
  chooses what is shown: marks, correct MCQ answers, teacher comments.
- Students see their full history. After release they also see the **top scorer of the class**
  for each test (the teacher can turn this off).
- **Bounties:** the teacher can set a reward on a test (for example "Top scorer gets a prize");
  after release the app shows who won. Ask the owner exactly how bounties should work.
- The teacher sees each student's profile with all subjects, scores and progress.

### 7. Never lose an answer or a submission (needs real engineering)

The owner's example: a 3-hour test, the free server goes to sleep or restarts, and when the
student submits, the server needs about a minute to wake up. Results must never be lost.

- **Outbox on the phone:** every answer and the final submit go into a durable local queue
  (IndexedDB, with a localStorage fallback) before any network call. A sender retries with
  exponential backoff and jitter until the server confirms, also after the app is closed and
  opened again. Show the state clearly: "Saved", "Saving…", "Offline – your answers are safe on
  this phone".
- **Idempotent writes:** every answer batch and every submit carries a client-generated id. The
  server stores each id once, so retries never double-count or overwrite newer answers (keep the
  latest answer per question by a per-attempt sequence number).
- **Deadline rule:** the server stays the judge of time. Answers the phone recorded before the
  deadline (using the server clock offset the app already uses) are accepted when they arrive
  within a short grace window after the deadline (for example 10 minutes). Put this rule in a
  pure, tested function and write the trade-off in the decision log (a long grace window would
  let a student look up answers offline).
- **Keep the server awake during exams:** phones already check the attempt every 30 seconds while
  a test is running, which keeps Render awake. Also tell the owner how to use a free uptime
  pinger during school hours, and that one service running all month (about 744 hours) fits in
  Render's 750 free hours.
- **Database hiccups:** retry short, transient Turso errors on the server. Never report success to
  the phone before the data is stored.
- **Tests:** cover cold start (server unavailable, then back), duplicate batches, out-of-order
  batches, submits after the deadline inside and outside the grace window, and a phone that was
  closed and opened again. Use the in-memory database and the fake clock that the server tests
  already use.

### 8. Still planned from §16

- Waiting room: the teacher starts everyone at the same time (old M11; the `waiting` attempt
  status already exists since migration 4).
- Photo answers after finishing (old M13: shrunk on the phone, never re-encoded on the server).

## Engineering expectations

- Feature modules on both sides (`server/src/modules/<feature>/`, `web/src/features/<feature>/`),
  API types in `shared/` only, business rules as pure functions with Vitest tests (server and web),
  API journeys with supertest.
- Keep server work cheap: few queries per request, no image work at exam time, index the columns
  you filter on, and avoid N+1 queries on dashboards (one query per list).
- Update `docs/ARCHITECTURE.md` (data model, flows, API, decision log, milestones) and
  `docs/DEVICE-CHECKS.md` (new phone checks) with every milestone.
- Before pushing, run `npm run build` and a smoke test of the production build. On the owner's
  computer, ask before pushing. In a cloud session, push only the session branch, never `main`.

## Questions to ask the owner before building

1. Please share a real sample paper (MCQs and written questions) in the JSON or text form you
   want to use.
2. Written answers: typed on the phone, or written on paper and photographed after finishing?
3. Assignments: done inside the app, or done offline with marks entered by you?
4. Bounties: only a reward note with the winner shown after release, or a points system?
5. Top scorer: show only the top scorer's name and score, or a full class ranking?
6. How long may answers arrive after the deadline when the server was asleep (suggested: 10
   minutes)?
7. Will you keep the `onrender.com` address, or move to your own domain soon? (Fingerprint
   logins are tied to the address.)
