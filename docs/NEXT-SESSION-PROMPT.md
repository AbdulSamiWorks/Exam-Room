# Prompt for the next session

All planned milestones **M0–M19 are built**, plus **M20**, the owner's first feedback round
(logout fix, new PINs for a class, MCQ result after finishing, FBISE papers, warm colours), on
the branch **`wip/m10-manage`**.
`npm run check` is green and every milestone has unit tests, API tests and a browser smoke test.
`main` does not have this work yet. Paste this one line to start:

    Read docs/NEXT-SESSION-PROMPT.md and follow it.

---

You are continuing **Exam Room**. Work like a principal engineer and follow every rule in
`CLAUDE.md` (no comments in code, readable unabbreviated names, small Conventional Commits,
`npm run check` green before every commit, no AI attribution, simple English for the owner, free
hosting only, TypeScript pinned to 6.0).

## 1. Read first

1. `CLAUDE.md`.
2. `docs/ARCHITECTURE.md`: §16 (the plan for M10–M19 and the owner's answers), §17 (what each
   milestone built) and the decision log **D35–D63**; `docs/DESIGN.md` for colours.
3. `git log --oneline -25` and `git status`.

## 2. What is left

1. **Bring the work into `main`.** Push `wip/m10-manage` if it is not on GitHub yet, then the
   owner merges it into `main` with a pull request. Render deploys `main` and runs the new
   migrations (up to 14) on the first start (rebuilds are guarded, D35).
2. **Real phone checks** in `docs/DEVICE-CHECKS.md` (sections 1–20), on the Render HTTPS address,
   with an Android phone (Chrome) and an iPhone (Safari). Fix what they find.
3. New wishes from the owner: plan them first in ARCHITECTURE.md (new milestone and decisions),
   then build them one by one like M10–M19.

## 3. Owner's answers (2026-10-24)

Written answers and assignments are chosen per test; bounties = reward note + points; students
see only the top scorer; late answers accepted for 10 minutes; keep the `onrender.com` address;
the paper format and a sample to copy are in `docs/PAPER-FORMAT.md`.

## 4. Other notes

- GitHub still listed `claude` under Contributors on 2026-10-24 although `main` has no AI
  trailers (three early commits were rewritten on 2026-10-22). The owner was told to switch the
  default branch to another branch and back, or ask GitHub Support, to refresh that cache.
