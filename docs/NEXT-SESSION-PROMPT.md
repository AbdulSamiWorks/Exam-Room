# Prompt for the next session (continue M10, then M11–M19)

The unfinished M10 work is on the branch **`wip/m10-manage`** (pushed to GitHub), not on `main`,
because its web part does not type-check yet. First run `git fetch` and
`git checkout wip/m10-manage`, finish M10 there, then merge it into `main` when
`npm run check` is green (in a cloud session: work on the session branch based on
`wip/m10-manage`). Paste this one line to start:

    Read docs/NEXT-SESSION-PROMPT.md and follow it.

---

You are continuing **Exam Room**. Work like a principal engineer and follow every rule in
`CLAUDE.md` (no comments in code, readable unabbreviated names, small Conventional Commits,
`npm run check` green before every commit, no AI attribution, simple English for the owner, free
hosting only, TypeScript pinned to 6.0). The owner said: build every milestone **one by one**.

## 0. Latest status (end of the second session, on `wip/m10-manage`)

Done since the first WIP commit, and `npm run check` was green before the last few files:
test form with class + subject picker (`ClassSubjectPicker`), test/quiz type, `ChapterPicker`,
`use-test-settings-form.ts`; dashboard grouped by class and subject with subject and type
filters (`group-tests-by-subject.ts`, `SubjectFilter.tsx`, shared `components/Chip.tsx`); test
card and test page show type, class and chapters; `Button` has `size="small"`;
`manage/student-list-parser.ts`, `manage/manage-rules.ts` (both with tests), `manage/NameForm.tsx`,
`manage/ManagePage.tsx` (classes list + add class), `manage/manage-paths.ts`, `lib/text.ts`,
`lib/natural-order.ts`.

Left for M10: `ManagePage` is not routed yet — add routes `manage` and
`manage/classes/:classId` in `TeacherArea.tsx` and "Tests | Manage" links (NavLink) in
`TeacherLayout`; move `describeClassContents` out of `ManagePage.tsx` into `manage-rules.ts`
(react-refresh lint); build `ClassPage` (rename/delete class with `classDeletionBlocker`, tabs
Subjects / Students), `SubjectCard` (rename, move to class, move tests with
`otherSubjectChoices`, delete with `subjectDeletionBlocker`, chapters list with up/down via
`chapterIdsAfterMove`, rename/delete chapter), `StudentsSection` (add one, paste a list with
`parseStudentList` preview, `NewPinsPanel` with "Copy all PINs" via `pinListText`, edit, reset
PIN, delete, move all students); a `TextAreaField` component; tests for `test-settings-form.ts`
helpers and `group-tests-by-subject.ts`; then the docs and commits listed in section 2.

Third session also did: `describeClassContents` moved into `manage-rules.ts`; "Tests | Manage" links in `TeacherLayout` (active by path); `components/TextAreaField.tsx`. Still left: the routes in `TeacherArea.tsx`, `ClassPage` and everything after it in the list above. Run `npm run check` first.

## 1. Read first

1. `CLAUDE.md`.
2. `docs/ARCHITECTURE.md`, especially **§16 (plan M10–M19, approved 2026-10-24)** with the
   owner's answers, and the decision log **D35–D57**.
3. `git log --oneline -10` and `git status`. The last commit is
   `docs: re-plan M10-M19 with the owner's new requirements and answers`.

## 2. M10 is half done on branch `wip/m10-manage`

The commit on `wip/m10-manage` holds the M10 work (ignore `.claude/worktrees/`, never commit
it).

**Done (server + shared), tested:** 248 server tests pass, ESLint and Prettier are clean for
`server/` and `shared/`.

- Migration 5 (`rebuildsTables: true`): `classes`, `subjects` rebuilt with `class_id` and
  UNIQUE (class_id, name), `chapters`, `students`, `tests.kind`, `test_chapters`. Existing
  subjects go into "My class" (D37). The runner uses `database.migrate()` plus a foreign-key
  guard for rebuilds (D35); tested.
- Modules: `classes/` (tree from 3 queries in one batch, rename, safe delete),
  `subjects/` (create under a class, rename, move to another class, delete only without tests,
  move tests to another subject), `chapters/` (create at the end, rename, reorder, delete =
  removes only tags), `students/` (add 1–100 with a new 6-digit PIN each shown once, scrypt hash
  N=8192, edit, reset PIN bumps `session_version`, move all to another class, delete).
- Tests get `kind` (test | quiz) and chapter tags (`chapterIds`, comma string in multipart, array
  in JSON); changing the subject clears the tags.
- New lib helpers: `lib/text.ts`, `lib/collections.ts`, `lib/input-fields.ts`;
  `query-helpers.ts` has `saveUnlessDuplicate`, `deleteUnlessStillUsed`, `placeholdersFor`.
- API routes are mounted in `server/src/api-router.ts` (see the list there).
  `GET /api/subjects` and `POST /api/subjects` are gone; the web must use `GET /api/classes`.

**Started on the web (does not type-check yet):**

- Done: `web/src/features/teacher/manage/use-classes.ts`, `use-students.ts`,
  `manage-limits.ts`; `lib/student-limits.ts` (moved); `http-client.ts` handles 204;
  `create-test/test-settings-form.ts` (classId, kind, chapterIds, helpers `withClass`,
  `withSubject`, `withChapterToggled`); `create-test-form.ts` sends kind and chapterIds;
  `test-limits.ts`.
- `create-test/ClassSubjectPicker.tsx` (+ `.module.css`) was only renamed from `SubjectPicker`;
  its content is still the old code. Rewrite it.
- `features/teacher/subjects/use-subjects.ts` was deleted.

**Still to do for M10:**

1. `ClassSubjectPicker`: class select (pick the only class automatically), subject select of
   that class, "+ Add a new subject" inline (`useCreateSubject(classId)`), and a link to Manage
   when there are no classes.
2. `ChapterPicker` (toggle chips for the chosen subject's chapters) and a test/quiz
   `ChoiceGroup` in `TestSettingsFields`; update `CreateTestPage` and `EditTestPage`.
3. Dashboard: subject filter from `useClassTree` (show the class name when there is more than
   one class), group tests by class and subject, show the type and chapters on `TestCard`.
4. **Manage area**: `/teacher/manage` (classes: add, rename, delete with a confirm that explains
   why it is blocked) and `/teacher/manage/classes/:classId` (subjects with chapters: add, rename,
   reorder, delete, "Move its tests"; students: add one, paste a list "roll number, name" per
   line with a pure, tested parser and preview, new PINs shown once with "Copy all PINs", edit,
   Reset PIN, delete, move all students). Add "Tests | Manage" links in `TeacherLayout`.
5. Web Vitest tests for the pure functions (list parser, form helpers, messages).
6. Docs: ARCHITECTURE §5 (data model), §7 (API), §17 (M10 built), D26 note (scrypt N=8192: a
   6-digit PIN is protected by the rate limit, and adding 40 students stays fast on 0.1 vCPU),
   §16 wording "move tests to another subject" (any class); `docs/DEVICE-CHECKS.md` (Manage
   checks); README "How it works".
7. `npm run check` green, then small commits, for example
   `feat(server): classes, subjects per class, chapters and students` (server + shared + the web
   changes the new API needs), `feat(web): manage classes, subjects, chapters and students`,
   `feat(web): test type and chapter tags`, `docs: record M10`.
8. Run `npm run build` and smoke-test the production build. Ask the owner before pushing.

## 3. Then M11 to M19, one by one (details in ARCHITECTURE §16)

M11 student login (class + roll number + PIN, 60-day cookie, home with open, upcoming and
finished tests; rebuild `attempts` with `student_id`), M12 installable app + passkeys +
phone-lock steps, M13 typed papers (write `docs/PAPER-FORMAT.md` with a full sample paper — the
owner asked for a sample to copy), M14 answers with the outbox (never lose an answer, 10-minute
late window), M15 photo answers, M16 marking and release, M17 assignments, bounties and points,
M18 dashboard and progress, M19 waiting room.

## 4. Owner's answers (2026-10-24)

Written answers and assignments are chosen per test; bounties = reward note + points; students
see only the top scorer; late answers accepted for 10 minutes; keep the `onrender.com` address;
design the paper format and give the owner a sample.

## 5. Other notes

- GitHub still listed `claude` under Contributors on 2026-10-24 although `main` has no AI
  trailers (three early commits were rewritten on 2026-10-22). The owner was told to switch the
  default branch to another branch and back, or ask GitHub Support, to refresh that cache.
- Real phone checks in `docs/DEVICE-CHECKS.md` are still for the owner to do on the Render site.
