# Implementation Plan: VillageLab — Portfolio First

Source: `docs/ideas/portfolio-first.md`. Deploy is on hold. No new features.

## Overview
Make the repo convince a reviewer who has never played Clash of Clans, in 3–5
minutes, that the author solves hard problems carefully. The product already
exists. This plan fixes what currently undermines it, then puts the engineering
in front of the reader: a green repo, a README that leads with the stories, a
case study, a demo path that works in a few clicks, and a polish pass.

## What planning found (2026-09-25)
- **CI has failed on every commit since the initial one.** `vitest` (4.1.11
  locally) and `drizzle-kit` (0.31.10 locally) are installed in `node_modules`
  but not declared in `package.json`, so `npm ci` skips them and `tsc` fails on
  every test file and `drizzle.config.ts`. The repo is public; the Actions tab
  is solid red. This is the highest-priority item.
- **The scheduled Ingest workflow fails every run** (every 15 min) because
  nothing is deployed for it to call. More red for a reviewer to find.
- `legacy/` is referenced by `tsconfig.json` (exclude), `eslint.config.mjs`
  (ignore) and the README layout block.
- Already in place: a sample profile link on the landing page (`#2PP0JCVL9`),
  the Fan Content Policy notice in the root layout, a mock-data mode that needs
  no setup.
- No `loading.tsx`, `error.tsx` or `not-found.tsx` exists anywhere in `src/app`.
- README is 458 lines. The best stories (architecture, "What a curve got
  wrong") sit between lines 55 and 140, after the route table and village notes.
- README claims 974 tests; the suite runs 931.

## Architecture Decisions
- **Move, don't delete, README content.** Detailed dataset sections move to
  `docs/data-accuracy.md`; the README links to them. No knowledge is lost.
- **Pause the Ingest schedule rather than delete it.** Keep `workflow_dispatch`
  so it can be run by hand; re-enable `schedule` as part of deploy.
- **Remove `legacy/` from the tree.** Git history keeps it; tag the last
  commit that contained it so it stays one command away.
- **Read the Next 16 docs in `node_modules/next/dist/docs/` before writing
  any route file** (per AGENTS.md); conventions may differ from older Next.
- **The case study is a markdown file** (`docs/case-study.md`). An in-app
  `/about` route is out of scope until deploy resumes.

## Dependency Graph
```
T1 CI green ──┬── T3 legacy removal (needs green CI to prove nothing broke)
T2 pause cron ┘
      │
      └── Checkpoint 1 (push → green badge)
              │
T4 demo path ─┴── T5 screenshots ── T6 README front door ── T7 case study
                                                                 │
                                                          Checkpoint 2 (cold read)
                                                                 │
                                          T8 route states ── T9 phone width
                                                                 │
                                                          Checkpoint 3 (done)
```
T7 does not depend on T5/T6 and can run in parallel with them.

## Task List
Full tasks with acceptance criteria: `tasks/todo.md`.

### Phase 1: A green repo
- [x] T1: Declare the missing dev dependencies so CI passes
- [x] T2: Pause the scheduled Ingest workflow until deploy
- [x] T3: Remove `legacy/` and its references
### Checkpoint 1: CI green on `main` (requires a push; ask first)

### Phase 2: The front door
- [ ] T4: Demo path: sample player and sample clan, reachable in a few clicks
- [ ] T5: Capture screenshots of the four key views
- [ ] T6: Restructure the README to lead with the three stories
- [ ] T7: Write the case study
### Checkpoint 2: Cold read by a non-player and an engineer

### Phase 3: Polish
- [ ] T8: Loading, error and not-found states for the tag routes
- [ ] T9: Phone-width pass on the four key views
### Checkpoint 3: Complete

### Deferred
- Deploy (on hold): set up Vercel and Neon, re-enable the Ingest schedule, add a live URL to the README and GitHub homepage.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Declaring deps changes the lockfile, and a clean install behaves differently from the local `node_modules` | High | Verify with `rm -rf node_modules && npm ci` then the full CI sequence locally before pushing |
| `npm run build` has never run in CI; it may fail after typecheck is fixed | High | T1 acceptance includes a local clean build; fix whatever it surfaces inside T1 |
| README trim loses detail reviewers valued | Med | Move sections to `docs/data-accuracy.md`, never delete |
| Next 16 route-file conventions differ from training data | Med | Read `node_modules/next/dist/docs/01-app` before T8 |
| Screenshots need a running app and a browser | Low | Capture manually if no browser tooling is available; T5 is small either way |

## Open Questions
- Where will reviewers arrive from: a resume link to GitHub, or a live URL? This
  plan assumes GitHub, so the README is the front door.
- Pushes: memory says confirm every push. Checkpoint 1 needs one.
- What's the trigger for taking deploy off hold?
