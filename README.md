# VillageLab

Progress tracking, upgrade planning and war analytics for Clash of Clans.

Next.js 16 · TypeScript · Postgres · deployed free.

| Route | |
| --- | --- |
| `/player/[tag]` | Home Village: unit levels against the Town Hall ceiling; rushed detection |
| `/player/[tag]/builder` | Builder Base: the same, against the Builder Hall |
| `/planner` | Upgrade queue scheduled across builder, lab and hero lanes |
| `/clan/[tag]` | Roster health, donation ratios, Town Hall spread |
| `/clan/[tag]/war` | Live war: scoreline, matchup, attacks still owed |
| `/clan/[tag]/log` | War history: record, win rate, average stars |
| `/base` | Isometric 44×44 editor with the game's own art, placement limits per hall |

## Two villages, kept apart

An account is two villages. They have separate halls, separate currencies,
separate troops, separate trophies and separate layouts, and the game never
mixes them — so neither does this. Every surface carries a **Home Village /
Builder Base** switch:

| | Home Village | Builder Base |
| --- | --- | --- |
| Player | `/player/[tag]` | `/player/[tag]/builder` |
| Planner | Town Hall, 6 builders, gold · elixir · dark | Builder Hall, 2 builders, builder gold · builder elixir |
| Base builder | Town Hall palette and layouts | Builder Hall palette and layouts |

The separation is structural rather than a matter of care at each call site: the
planner state is one slice per village, so a Builder Base cost has no path into
a Home Village total. The planner engine itself is village-agnostic — it asks
for a ceiling table and a cost table, not for a Town Hall — which is what lets
one implementation serve both instead of two that drift.

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
| `npm test` | Vitest — 625 tests |
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
`src/lib/game/` carries a curated dataset: 18 Town Halls, 46 buildings, 67 units.

**All 1,579 levels are transcribed**, level by level, from the game's published
tables — every structure and every unit in both villages. Nothing is
interpolated, so the `≈` that marks an estimate does not appear anywhere in the
app, and a test asserts it cannot.

The machinery for estimates is still wired up (`est: true`, `curve.ts`), unused,
because new game content arrives half-documented and that is the honest way to
show it: store the known **anchors**, interpolate the gaps, and mark every
generated value.

### What a curve got wrong

All of this used to be anchors plus geometric interpolation, and it was wrong in
both directions.

A level 21 Cannon was priced at **22,500,000 gold against a real 3,000,000**,
because a curve that keeps doubling does not know that the game flattens out at
the top — so the error grew with the Town Hall, exactly where people rely on the
number. The Town Hall table had the same bug: TH17 at 528 hours and 20M gold
against a real 240 hours and 16M.

The units were worse. **46 of 67 had the wrong maximum level** — the Witch
listed at 10 against a real 8, the Healer at 9 against a real 11 — and
cost-to-max ran from 65% under to 158% over:

| | listed | real | |
|---|---|---|---|
| Goblin | 15.0M elixir | 42.8M | −65% |
| Barbarian King | 22.0M dark | 15.2M | +45% |
| Lava Hound | 2.0M dark | 763K | +158% |

Elixir troops came out consistently understated and dark ones overstated, which
is what one shared curve does to two different price scales.

Three currencies were simply wrong too: the Monolith takes dark elixir, not
gold; the Clan Castle and Dark Elixir Storage take elixir.

### How it is read

Not from the Town Hall page. Its building tables merge cells across several hall
levels, and two successive parsers shifted columns silently — one reported zero
Cannons at Town Hall 17 and handed structures each other's numbers.

Each structure's own page publishes what is needed without a merged cell in
sight, and both anchors are machine-readable:

```
{{NumberAvailable|TH1=2|TH5=3|TH7=5|TH10=6|TH11=7|TH16=7/3*|TH17=7/0*}}
```

for how many a hall allows, and a per-level table whose *Town Hall Level
Required* column gives the ceiling at every hall. The parser locates columns by
header text, cross-checks the cost column against the wiki's own `bCost` class,
and **refuses to read a table it cannot resolve** rather than guessing — which
is what caught a "Boost Cost" column standing in for a build cost on the
collectors.

A unit's table never names a Town Hall — it names the building that gates the
upgrade, the Laboratory for troops and spells, the Pet House for pets, the Hero
Hall for heroes — so a ceiling is derived by asking when that building first
reaches the required level. Those building ceilings are themselves transcribed,
which makes it a lookup rather than a guess. The Hero Hall is the one to watch:
its levels do not track the Town Hall one for one, arriving at TH4 and then not
again until TH8.

Level 1 needs a different source, and getting it wrong is instructive. The level
table's first row is free and names no Laboratory requirement, so reading the
unlock from it put the **Dragon at Town Hall 1**. The unlock comes from the
*producing* building instead — Barracks, Spell Factory, Workshop, Pet House —
named on each page's info table.

Two rules fall out of the building data:

- `count` is the **un-merged** figure. From Town Hall 16 the game merges pairs
  of defences (Cannons into a Ricochet Cannon, and so on) and the wiki gives
  both, e.g. `7/3`. Seven is the number to plan against: merging consumes
  buildings at their maximum level, so a Cannon that ends up inside a Ricochet
  Cannon still has to be paid all the way up first. The merged figure describes
  the finished layout, not the bill. The Eagle Artillery is the one structure
  whose count genuinely falls — it merges into the Giga Inferno at Town Hall 17
  and is gone for good.
- **Supercharges** — Town Hall 18's extra levels on an already-maxed structure,
  18 of them — are kept out of `levels` and out of every cost-to-max total. The
  game removes them again when a real level is added, so a supercharged Mortar
  is not a level 20 Mortar.

Town Hall 18 also brings three structures that did not exist here before: the
**Revenge Tower**, the **Super Wizard Tower**, and the **Crafting Station**. The
Crafting Station is free and level-less; the Crafted Defenses it hosts are
upgraded with Sparky Stones, a currency this app does not model yet — the same
gap as Ores and hero equipment.

### The Builder Base dataset

The Builder Base was the first dataset built this way, and the proof the route
worked: the game publishes every Builder Base level individually, so
`src/lib/game/builder-base.json` carries the real cost and build time for each
of them — 35 structures and 14 units, with footprints, per-hall counts and
per-hall ceilings. It was the first dataset done this way and the reason the
Home Village followed.

Two independent tables agree, which is what makes it trustworthy rather than
transcribed: counts and ceilings come from the Builder Hall page, costs and
times from each structure's own page, and a structure's highest priced level is
exactly its ceiling at Builder Hall 10.

Replacing the old guessed ceilings corrected 13 of 14 units. The previous table
assumed "two levels per hall after unlocking" and had, for instance, the
Electrofire Wizard maxing at level 4; it maxes at 20. It also surfaced a rule
the Home Village has no equivalent for: a Builder Base troop that unlocks late
**arrives part-levelled** — the Electrofire Wizard is handed to you at level 17
— so `startLevel` records that, and the levels below it are absent rather than
free.

### Why the tests exist

They caught a bug that had shipped: geometric interpolation divides by the lower
anchor, and walls (instant) and the Builder's Hut (free at level 1) legitimately
anchor at zero — so every Wall level had `hours: NaN`. The previous validator
checked ordering with `cost < prev`, and **every comparison against NaN is
false**, so it reported success while the data was broken.

`finite.test.ts` now asserts finiteness across all 113 entities, because
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
requires is in the root layout so it cannot be dropped from a page.

The base builder renders official structure art, used under that policy, and it
renders it **per level**: a structure is drawn at the level the selected Town
Hall can reach, so a TH4 cannon is the stubby one and a TH14 cannon is not.
`src/lib/game/buildings.ts` supplies that ceiling.

Units get art too — the player pages and the planner show the same portraits the
game's own Laboratory and Army screens do. Structures are indexed per **level**
and units are not, and that asymmetry is deliberate: the village shows a
structure at the level it is, while the Lab shows a fixed portrait no matter how
far a troop is upgraded.

Resources get the game's own badges — the coin, the elixir drop, the dark drop.
Every cost in the app is stamped with one, which is what makes a cost column
readable without relying on colour alone. An amount you already **hold** is
marked differently, with the storage that banks it: the planner's "on hand"
fields carry Gold, Elixir and Dark Elixir Storage art at the level the selected
Town Hall reaches. Cost is a badge, balance is a building.

| | where | index | keyed by |
| --- | --- | --- | --- |
| Structures | `public/sprites/` | `src/lib/sprites/buildings.json` | id + level |
| Units | `public/sprites/units/` | `src/lib/sprites/units.json` | village + id |
| Resources | `public/sprites/resources/` | `src/lib/sprites/resources.json` | resource |

Files are named by content hash and shared wherever the art is identical: 370
files cover 405 structure-levels, and a level with no entry of its own uses the
highest entry below it. Units are keyed by village because the two villages
share ids — there is a Baby Dragon in both — but not their art. Resources have
no level and no variants, so they are keyed by nothing but themselves.
`public/sprites/credits.json` records the provenance of everything.

Picking "highest numbered file on the wiki" is not safe on its own — it yields
`Archer_Tower109.png` and `Air_Defense2012.png`, a typo and a year — so the
game data caps which files are considered.

Everything else in the UI is original, including the vector structure icons in
`src/lib/base/icons.ts`. Those are still the fallback the board draws while a
sprite loads or if one is missing, so removing `public/sprites/` degrades the
builder rather than breaking it.

## Layout

```
src/lib/game/      curated dataset, interpolation, planner + progress logic
src/lib/war/       war analysis — star credit, standings, war log summaries
src/lib/theme.ts   three-state theme store (system / light / dark)
src/lib/base/      base layout rules — collision, count limits, drag painting
src/lib/base/iso.ts      isometric projection, its inverse, and the zoom/pan camera
src/lib/base/terrain.ts  the village ground, painted once and cached
src/lib/sprites/   official art: per-level structures, per-unit portraits
src/lib/coc/       Supercell client, tag handling, key rotation, mock generator
src/lib/data/      read paths — Postgres only, never upstream
src/lib/ingest/    the only code that calls Supercell
src/app/           routes; /player/[tag] and /clan/[tag] are SSR'd and indexable
legacy/            the original zero-dependency prototype, kept for reference
```
