# VillageLab

Progress tracking, upgrade planning and war analytics for Clash of Clans.

Next.js 16 · TypeScript · Postgres · deployed free.

| Route | |
| --- | --- |
| `/player/[tag]` | Unit levels against the Town Hall ceiling; rushed detection |
| `/planner` | Upgrade queue scheduled across builder, lab and hero lanes |
| `/clan/[tag]` | Roster health, donation ratios, Town Hall spread |
| `/clan/[tag]/war` | Live war: scoreline, matchup, attacks still owed |
| `/clan/[tag]/log` | War history: record, win rate, average stars |
| `/base` | 44×44 layout editor, placement limits enforced per Town Hall |

The player page also covers the **Builder Base** — hall level, builder trophies
and troop progress against the hall's ceiling. Levels only, no costs: see
`src/lib/game/builder-base.ts` for why inventing a second cost table would have
made the accuracy problem below worse rather than better.

Light and dark are both first-class, following the system preference until the
visitor picks one. The choice is applied by an inline script before first paint,
so there is no flash of the wrong palette.

```bash
npm install
npm run dev        # works immediately — no database, no API token
```

With no `DATABASE_URL` the app runs on a deterministic mock generator, so a
fresh clone is fully usable and CI needs no secrets.

| Script | |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Vitest — 561 tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration |

## The interesting problem

The Supercell API has two properties that shape the whole design:

1. **Tokens are pinned to a whitelisted IP** and it sends no CORS headers.
2. **Per-key throughput is modest**, so proxying user requests 1:1 does not scale.

### Nothing user-facing calls Supercell

A page miss **enqueues** the tag and renders what we already hold; the ingestion
worker drains that queue on a schedule. This is enforced by structure, not
discipline — `src/lib/data/*` can only read Postgres, and `src/lib/coc/client.ts`
is imported solely by `src/lib/ingest/worker.ts`.

Without this, `/player/<anything>` would be an amplification vector: a crawler
walking random tags could exhaust the upstream budget in minutes.

### Owning the data buys features the API cannot serve

The API is snapshot-only — it has no history. Because we persist snapshots, we
can answer questions it structurally cannot: trophy trends, donation health over
time, and member churn (`clan_memberships.left_at`).

Snapshots are only appended when a value actually changed, so an idle account
costs no storage.

### Key rotation instead of a static IP

Free serverless and CI runners have *dynamic* egress IPs, which a pinned key
rejects intermittently. Paying for a fixed egress IP is the usual fix.

Instead, `src/lib/coc/rotate.ts` rotates the developer key — **lazily**, only
after a real `403 accessDenied.invalidIp`, parsing the current IP out of
Supercell's own error message rather than calling an IP-echo service. Retry is
capped at one, so there is no rotation loop.

That module depends on the developer portal, which is not part of the documented
API. It is quarantined on purpose: if it breaks, set `COC_API_TOKEN` to a static
key, point the worker at a fixed-IP host, and nothing else changes.

## Data accuracy

The API exposes unit levels but **no building levels and no upgrade costs**, so
`src/lib/game/` carries a curated dataset: 17 Town Halls, 43 buildings, 66 units.

Costs and times are stored as **anchors** — levels whose real values are known —
with the gaps filled by geometric interpolation. Roughly **24% of levels are
anchored and 76% interpolated.**

Every interpolated value renders with a `≈` and is flagged `est: true`. Nothing
here should be read as a wiki-accurate figure until its anchor is verified.
Adding a real value is a one-line edit:

```ts
costs: { 1: 270, 5: 12000, 8: 400000, /* add: */ 9: 620000 },
```

### Why the tests exist

They caught a bug that had shipped: geometric interpolation divides by the lower
anchor, and walls (instant) and the Builder's Hut (free at level 1) legitimately
anchor at zero — so every Wall level had `hours: NaN`. The previous validator
checked ordering with `cost < prev`, and **every comparison against NaN is
false**, so it reported success while the data was broken.

`finite.test.ts` now asserts finiteness across all 109 entities, because
ordering checks structurally cannot catch NaN.

The war analysis is tested the same way. Stars are credited to the attacker who
*added* them, not the one who scored them — a cleanup hit on a base the clan
already three-starred is worth nothing — so `sum(members) === clan total` is an
invariant the tests assert against generated wars, rather than a comment nobody
checks.

## Deployment

| | | Cost |
| --- | --- | --- |
| App | Vercel Hobby | $0 |
| Database | Neon | $0 |
| Cache | Next.js ISR — no Redis | $0 |
| Cron | GitHub Actions (`.github/workflows/ingest.yml`) | $0 |

Vercel Hobby's cron is daily-only, which is why the schedule lives in GitHub
Actions hitting `/api/cron/ingest` with a bearer secret.

Redis was deliberately left out: its free tiers are the tightest ceiling in the
stack, and ISR plus Postgres covers the load until traffic proves otherwise.

## Legal

Unofficial fan content. The attribution Supercell's [Fan Content Policy](https://supercell.com/en/fan-content-policy/)
requires is in the root layout so it cannot be dropped from a page. No Supercell
artwork is used — all UI is original.

## Layout

```
src/lib/game/      curated dataset, interpolation, planner + progress logic
src/lib/war/       war analysis — star credit, standings, war log summaries
src/lib/theme.ts   three-state theme store (system / light / dark)
src/lib/base/      base layout rules — collision, count limits, drag painting
src/lib/coc/       Supercell client, tag handling, key rotation, mock generator
src/lib/data/      read paths — Postgres only, never upstream
src/lib/ingest/    the only code that calls Supercell
src/app/           routes; /player/[tag] and /clan/[tag] are SSR'd and indexable
legacy/            the original zero-dependency prototype, kept for reference
```
