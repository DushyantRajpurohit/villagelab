# Todo: VillageLab — Portfolio First

Plan: `tasks/plan.md`. Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Phase 1: A green repo

### Task 1: Declare the missing dev dependencies so CI passes
**Description:** `vitest` and `drizzle-kit` are imported by the tests and
`drizzle.config.ts` but missing from `package.json`, so CI has failed typecheck
on every commit. Declare them at the versions already installed locally (vitest
4.1.11, drizzle-kit 0.31.10), update the lockfile, and fix anything `npm run
build` surfaces, since CI has never reached that step.

**Acceptance criteria:**
- [x] `vitest` and `drizzle-kit` are in `devDependencies`, and `package-lock.json` is updated
- [x] From a clean install, typecheck, lint, test and build all pass
- [x] README test count matches the real suite (931), or the hard-coded number is removed

**Verification:**
- [x] `rm -rf node_modules && npm ci && npm run typecheck && npm run lint && npm test && npm run build`
- [x] No `DATABASE_URL` or token set during the run (mirrors CI)

**Dependencies:** None
**Files likely touched:** `package.json`, `package-lock.json`, `README.md`
**Estimated scope:** S

**Done (2026-09-25):** npm 10 crashed adding the deps (arborist `edgesOut` bug), so the lockfile was built with npm 11 and completed with npm 10 `--package-lock-only`. npm 10 needs a nested `vitest/node_modules/esbuild@0.28.2` for vite's optional peer; npm 11 omits it, and `npm ci` rejects a lock without it. No existing package changed version; 143 packages added. Clean `npm ci` passes typecheck, lint, 931 tests and build.

### Task 2: Pause the scheduled Ingest workflow until deploy
**Description:** The Ingest workflow calls a site that doesn't exist yet and
fails every 15 minutes. Comment out the `schedule` trigger with a note to
re-enable it at deploy; keep `workflow_dispatch`.

**Acceptance criteria:**
- [x] No `schedule` trigger is active in `.github/workflows/ingest.yml`
- [x] `workflow_dispatch` still works and a comment says when to restore the schedule

**Verification:**
- [ ] YAML is valid (`gh workflow view Ingest` after push shows no schedule runs)

**Dependencies:** None
**Files likely touched:** `.github/workflows/ingest.yml`
**Estimated scope:** XS

### Task 3: Remove `legacy/` and its references
**Description:** Tag the current commit (for example `legacy-prototype`) so the
old ClashVerse prototype stays reachable, then delete `legacy/` and its
references in `tsconfig.json`, `eslint.config.mjs` and the README layout block.

**Acceptance criteria:**
- [x] `legacy/` is gone and `grep -rn legacy` finds no config or README references (test fixture variable names excepted)
- [x] A git tag points at the last commit that contained it

**Verification:**
- [ ] Full CI sequence passes locally

**Dependencies:** T1
**Files likely touched:** `legacy/**`, `tsconfig.json`, `eslint.config.mjs`, `README.md`
**Estimated scope:** S

## Checkpoint 1: After Tasks 1–3
- [ ] Full CI sequence passes locally
- [ ] Ask before pushing; after the push, CI on `main` is green
- [ ] Review with human before Phase 2

## Phase 2: The front door

### Task 4: Demo path: sample player and sample clan in a few clicks
**Description:** The landing page already links a sample player. Confirm it
generates a rich mock profile (high Town Hall, some rushed units, equipment),
or pick a tag that does. Add an equivalent sample-clan link so the war room and
CWL are reachable with data. The goal: a reviewer reaches player, planner and
clan views, each with data, within 90 seconds.

**Acceptance criteria:**
- [ ] From `/`, the sample player, the planner and a sample clan (war and CWL tabs) are each reachable in 2 clicks or fewer
- [ ] Each shows populated data in mock mode, with no empty tables

**Verification:**
- [ ] Manual walkthrough in `npm run dev`, timed
- [ ] `npm test` and `npm run build` pass

**Dependencies:** Checkpoint 1
**Files likely touched:** `src/app/page.tsx`, possibly `src/app/clan/page.tsx`
**Estimated scope:** S

### Task 5: Capture screenshots of the four key views
**Description:** Landing, player, planner and clan war in mock mode, at desktop
width, one theme (plus dark for one hero shot). Saved under `docs/screenshots/`,
compressed.

**Acceptance criteria:**
- [ ] 4–5 PNG or WebP files in `docs/screenshots/`, each under 400 KB
- [ ] Each shows populated data from the T4 demo tags

**Verification:**
- [ ] Files render on GitHub (check the README preview after T6)

**Dependencies:** T4
**Files likely touched:** `docs/screenshots/*`
**Estimated scope:** S

### Task 6: Restructure the README to lead with the three stories
**Description:** Top of the README: name, CI badge, a 3-line explanation a
non-player understands, one hero screenshot, and "Three problems worth reading
about" (architecture, the parser that refuses to guess, owning the data), each
a short paragraph linking to depth. Then quick start and the routes table. Move
the long dataset sections (hero equipment, Crafted Defenses, Builder Base
dataset, lifetime records, CWL) to `docs/data-accuracy.md` and link them.

**Acceptance criteria:**
- [ ] A non-player can say what the app does from the first screen of the README
- [x] README is 200 lines or fewer; every moved section exists in `docs/data-accuracy.md`
- [ ] CI badge and screenshots render on GitHub

**Verification:**
- [ ] Preview renders (GitHub or local markdown preview); all internal links resolve
- [ ] Diff check: no section deleted outright, only moved

**Dependencies:** T1 (badge is green), T5
**Files likely touched:** `README.md`, `docs/data-accuracy.md`
**Estimated scope:** M

### Task 7: Write the case study
**Description:** `docs/case-study.md`: one page, about a 5-minute read. Two
stories with real numbers: how interpolation curves priced a Cannon at 22.5M
against a real 3M and put 46 of 67 units at the wrong maximum, and how the
parser was made to refuse rather than guess; plus why nothing user-facing calls
Supercell. Linked from the README.

**Acceptance criteria:**
- [ ] Problem → what went wrong → what was built → evidence (tests, numbers) for each story
- [ ] Every number matches the code or the README source
- [ ] Linked from the README top section

**Verification:**
- [ ] Numbers cross-checked against `src/lib/game/` and tests
- [ ] Renders on GitHub

**Dependencies:** None (can run parallel to T5 and T6)
**Files likely touched:** `docs/case-study.md`, `README.md`
**Estimated scope:** S

## Checkpoint 2: After Tasks 4–7
- [ ] One non-player explains the app back from the README
- [ ] One engineer reviews the repo cold; note where they stop
- [ ] Review with human before Phase 3

## Phase 3: Polish

### Task 8: Loading, error and not-found states for the tag routes
**Description:** There are no `loading.tsx`, `error.tsx` or `not-found.tsx`
files. Read the Next 16 docs in `node_modules/next/dist/docs/01-app` first, then
add them for `/player/[tag]` and `/clan/[tag]` (and a root not-found), in the
existing storefront style. An invalid tag already calls `notFound()`.

**Acceptance criteria:**
- [ ] An invalid tag shows a designed not-found page with a way back to search
- [ ] A thrown error in a tag route shows a designed error state, not the default
- [ ] Navigation to a tag route shows a loading state

**Verification:**
- [ ] Manual: `/player/INVALID`, and a forced throw in dev
- [ ] `npm run typecheck && npm run lint && npm test && npm run build`

**Dependencies:** Checkpoint 2
**Files likely touched:** `src/app/not-found.tsx`, `src/app/player/[tag]/{loading,error}.tsx`, `src/app/clan/[tag]/{loading,error}.tsx`
**Estimated scope:** M

### Task 9: Phone-width pass on the four key views
**Description:** Check landing, player, planner and clan war at 375 px. Fix
horizontal page scroll and clipped content. Wide tables may scroll inside their
own container, never the page.

**Acceptance criteria:**
- [ ] No horizontal page scroll at 375 px on the four views
- [ ] Nothing important is clipped or overlapping

**Verification:**
- [ ] Manual check at 375 px in browser devtools, light and dark
- [ ] `npm run build` passes

**Dependencies:** T8
**Files likely touched:** components under `src/components/` used by the four views (up to ~5)
**Estimated scope:** M

## Checkpoint 3: Complete
- [ ] Full CI sequence green on `main`
- [ ] 90-second demo walkthrough works from `/`
- [ ] Every item in the `portfolio-first.md` MVP scope is done except deploy

## Deferred
- [ ] Deploy (on hold): Vercel and Neon, re-enable the Ingest schedule, live URL in the README and GitHub homepage
