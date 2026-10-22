# Exam Room

Mobile-first web app: a teacher uploads a PDF test and shares a link, and 5–10 students read it on
their phones with a timer, exit detection and a watermark.

Before starting, read `docs/ARCHITECTURE.md` (the approved plan, milestones M0–M7 and the decision
log) and check `git log` to see which milestone is done. When a decision changes, update the
decision log there.

## Rules from the project owner (always follow)

- No comments anywhere in code: no JSDoc, no inline comments, no CSS comments. Put reasoning in
  `docs/ARCHITECTURE.md` or in commit messages instead.
- Human-readable, unabbreviated names. Small functions and feature modules that are easy to extend.
- Never add `Co-Authored-By: Claude`, "Generated with Claude Code" or any other AI attribution to
  commits or pull requests.
- Small Conventional Commits (`feat(server): ...`, `fix(web): ...`). `npm run check` must be green
  before every commit.
- Plan first for bigger work. Explain things in simple English; the owner is not a native English
  speaker.
- Everything must fit free hosting: Render free web service (512 MB RAM, about 0.1 vCPU, no
  persistent disk) and the Turso free database. The server is stateless and page images live in the
  database.
- Keep TypeScript pinned to 6.0; typescript-eslint does not support 7 yet.

## Commands

| Command         | What it does                                                  |
| --------------- | ------------------------------------------------------------- |
| `npm run dev`   | Server on port 3000 and web app on port 5173                  |
| `npm run check` | Type-check, lint, Prettier check and tests                    |
| `npm test`      | Vitest tests (server tests use in-memory DB and a fake clock) |

## Layout

- `shared/` API types only, used by both server and web.
- `server/` Express 5 API with libSQL/Turso; feature modules in `server/src/modules/`.
- `web/` React + Vite; features in `web/src/features/`.

## Git

- On the owner's computer: commit on `main` and ask before pushing.
- In a cloud session (claude.ai/code): commit on the session branch and push only that branch when
  the work is done. Never push to `main` and never force-push. The owner merges the branch into
  `main` with a pull request.

## Cloud sessions

`.claude/hooks/setup-cloud-session.sh` runs at session start, but only in cloud sessions. It sets
the owner's git identity, installs dependencies with `npm ci` and creates `.env` from
`.env.example`, so the local teacher password there is `change-this-password`.
