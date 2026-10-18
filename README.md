# VillageLab

[![CI](https://github.com/DushyantRajpurohit/villagelab/actions/workflows/ci.yml/badge.svg)](https://github.com/DushyantRajpurohit/villagelab/actions/workflows/ci.yml)

Progress tracking, upgrade planning and war analytics for Clash of Clans.

Clash of Clans is a mobile strategy game: you build a village, spend in-game
currency on upgrades that take real days to finish, and fight wars as part of a
clan. VillageLab looks up an account and shows how far it is from maxed, what is
left to pay and how to schedule it, and how its clan's wars went.

Next.js 16 · TypeScript · Postgres · 931 tests · designed to run for $0.

```bash
npm install
npm run dev        # works immediately — no database, no API token
```

With no `DATABASE_URL` the app runs on a deterministic mock generator, so a
fresh clone is fully usable and CI needs no secrets.

## Three problems worth reading about

### 1. Nothing user-facing calls Supercell

The Supercell API pins each token to a whitelisted IP and allows modest
per-key throughput, so proxying user requests 1:1 does not scale — and a
crawler walking random `/player/<tag>` URLs could exhaust the upstream budget in
minutes.

So a page miss **enqueues** the tag and renders what we already hold; an
ingestion worker drains that queue on a schedule. This is enforced by structure,
not discipline: `src/lib/data/*` can only read Postgres, and
`src/lib/coc/client.ts` is imported solely by `src/lib/ingest/worker.ts`.

Free serverless hosts have *dynamic* egress IPs, which a pinned key rejects.
Instead of paying for a static IP, `src/lib/coc/rotate.ts` rotates the developer
key lazily — only after a real `403 accessDenied.invalidIp`, reading the current
IP out of Supercell's own error message, with retry capped at one. It relies on
the undocumented developer portal, so it is quarantined: set `COC_API_TOKEN` to
a static key and nothing else changes.

### 2. A parser that refuses to guess

The API exposes unit levels but no building levels and no upgrade costs, so the
app carries its own dataset. It used to be anchors plus geometric
interpolation, and it was wrong in both directions: a level 21 Cannon priced at
**22,500,000 gold against a real 3,000,000**, and **46 of 67 units at the wrong
maximum level**.

Now every level is transcribed — 1,591 Home Village levels, 918 equipment
levels, 81 Crafted Defense module levels and the Builder Base's own set — by a
parser that locates columns by header text, cross-checks costs against the
source's markup, and **refuses to read a table it cannot resolve**. That refusal
is what caught a "Boost Cost" column standing in for a build cost. Nothing is
interpolated, and a test asserts the `≈` estimate marker cannot appear.

The tests pin invariants, not just figures. One caught a bug that had shipped:
interpolation divided by a zero anchor, so every Wall level had `hours: NaN` —
and the old validator, comparing with `cost < prev`, passed, because every
comparison against NaN is false.

→ [What a curve got wrong](docs/data-accuracy.md#what-a-curve-got-wrong) ·
[How it is read](docs/data-accuracy.md#how-it-is-read) ·
[Why the tests exist](docs/data-accuracy.md#why-the-tests-exist)

### 3. Owning the data buys what the API cannot serve

The API is snapshot-only — it has no history. Because we persist snapshots, we
can answer questions it structurally cannot: trophy trends, donation health over
time, and member churn (`clan_memberships.left_at`). Snapshots are only appended
when a value actually changed, so an idle account costs no storage.

## Routes

| Route | |
| --- | --- |
| `/player/[tag]` | Home Village: unit levels against the Town Hall ceiling; rushed detection |
| `/player/[tag]/builder` | Builder Base: the same, against the Builder Hall |
| `/planner` | Upgrade queue scheduled across builder, lab and hero lanes |
| `/clan/[tag]` | Roster health, donation ratios, Town Hall spread |
| `/clan/[tag]/war` | Live war: scoreline, matchup, attacks still owed |
| `/clan/[tag]/league` | Clan War League: group standings, each round, every member's attacks |
| `/clan/[tag]/log` | War history: record, win rate, average stars |

An account is two villages, Home Village and Builder Base, with separate halls,
currencies and troops; the planner keeps one state slice per village, so a cost
from one has no path into the other's total. The modelling of each game entity
(hero equipment, Crafted Defenses, Clan War Leagues and more) is in
[docs/data-accuracy.md](docs/data-accuracy.md).

## Scripts

| Script | |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Vitest — 931 tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration |

## Deployment

| | | Cost |
| --- | --- | --- |
| App | Vercel Hobby | $0 |
| Database | Neon | $0 |
| Cache | Next.js ISR — no Redis | $0 |
| Cron | GitHub Actions (`.github/workflows/ingest.yml`) | $0 |

Vercel Hobby's cron is daily-only, which is why the schedule lives in GitHub
Actions hitting `/api/cron/ingest` with a bearer secret. Redis was left out: its
free tiers are the tightest ceiling in the stack, and ISR plus Postgres covers
the load until traffic proves otherwise.

## Layout

```
src/lib/game/      curated dataset, planner + progress logic
src/lib/war/       war analysis — star credit, standings, war log, Clan War Leagues
src/lib/coc/       Supercell client, tag handling, key rotation, mock generator
src/lib/data/      read paths — Postgres only, never upstream
src/lib/ingest/    the only code that calls Supercell
src/lib/sprites/   official art indexes
src/app/           routes; /player/[tag] and /clan/[tag] are SSR'd and indexable
```

## Legal

Unofficial fan content. The attribution Supercell's [Fan Content Policy](https://supercell.com/en/fan-content-policy/)
requires is in the root layout so it cannot be dropped from a page. Game art is
used under that policy, with provenance in `public/sprites/credits.json`
([details](docs/data-accuracy.md#art)); everything else in the UI is original.
