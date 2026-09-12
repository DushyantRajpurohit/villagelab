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
| `npm test` | Vitest — 941 tests |
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
`src/lib/game/` carries a curated dataset: 18 Town Halls, 47 buildings, 67 units,
42 pieces of hero equipment and the 3 Crafted Defenses of the current Crafting
Phase.

**Every level is transcribed** — 1,591 building and unit levels in the Home
Village, 918 equipment levels, 81 Crafted Defense module levels, and the Builder
Base's own set — level by level, from the game's published tables. Nothing is interpolated, so the `≈` that marks
an estimate does not appear anywhere in the app, and a test asserts it cannot.

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

Town Hall 18 also brings two structures that did not exist here before, the
**Revenge Tower** and the **Super Wizard Tower**, and a third that is not a
Town Hall 18 structure at all: the **Crafting Station** is available from Town
Hall 11, which its own `{{NumberAvailable|TH11=1}}` says plainly. It arrived at
the top hall and was opened up to Town Hall 11 when Crafting Phase 4 began.

### Hero equipment

The 42 items the Blacksmith upgrades are a third kind of entity — not a
structure, not a unit — and each of the three ways they differ is modelled
rather than flattened:

- **They cost ore, often two or three at once.** A building or unit step spends
  exactly one currency, which is why `LevelStep` has a single `cost`; an
  equipment step carries an `OreCost` instead. Ores are deliberately *not* part
  of `Resource`: nothing else in either village spends them, no storage banks
  them, and they cannot be raided or donated. Folding them in would put three
  keys into every `Record<Resource, number>` total that could never receive a
  value. `OreRow` renders the two or three figures side by side rather than
  adding them, because there is no exchange rate between ores.
- **Upgrades are instant.** No build time, no lane, so equipment never enters
  the planner's queue and never lands on the laboratory clock.
- **The ceiling comes from the Blacksmith, not the Town Hall** — the same shape
  as the Laboratory gating troops. Each level publishes the Blacksmith level it
  needs; the Town Hall enters only through how far the Blacksmith reaches there,
  and the result is bounded below by the hero's own unlock, since a Grand Warden
  item cannot exist at Town Hall 8.

Ownership is the one thing the tables cannot tell you. Commons arrive with their
hero, but epics are bought from events, the Trader or the League Shop, so the
API's `heroEquipment` list is the only source for which ones an account has. An
item missing from it is reported as **unowned** rather than as level 0: its ore
is quoted as what it *would* cost once obtained and kept out of what the account
owes, and an epic never bought does not drag the equipment percentage down.

The ore price is uniform per rarity, which is the strongest check on the
transcription available: every common costs 27,260 Shiny and 1,920 Glowy from 1
to 18, and every epic 56,060 Shiny, 3,720 Glowy and 480 Starry from 1 to 27.
Forty-one of the forty-two agree to the ore. The exception is the **Stun
Blaster**, whose page prices level 6 at 940 Shiny where the other 23 commons all
say 840 — every other row in its column matches, so it reads like a typo at the
source. It is transcribed as published and pinned in a test rather than quietly
rounded to the pattern, because this dataset records what the tables say, not
what it expects them to say.

The **Hero Hall** joined the building table at the same time. Its page had been
read for a while to derive every hero's ceiling, but the hall itself was never a
structure the village could own. A test now asserts the two agree — Hero Hall
level N reachable at exactly the Town Hall where each hero's ceiling steps up —
so neither can be re-scraped alone.

### Crafted Defenses, and the currency that is not a cost

The Crafting Station is free and has one level, because the levels belong to
what it *becomes*. A **Crafted Defense** is a fourth kind of entity, and the
four ways it differs from a structure are each modelled rather than flattened:

- **The module upgrades, not the defense.** There is no cost table for a
  Crafted Defense and no such thing as the price of "level 7". It has three
  modules of ten levels; its own level is their sum, so it arrives at 3 and
  tops out at 30.
- **One defense is billed in three currencies.** Each module spends exactly one
  and the three spend three different ones — the Hot Candle's hitpoints are
  elixir, its damage gold, its seconds active dark elixir — so `resource` sits
  on the module where a `Building` carries it once.
- **They expire.** A Crafting Phase lasts four months and takes its set with
  it. The dataset carries the current phase only, because a defense nobody can
  still craft is not something to plan against, and records which phase it is
  and when that ends — so a dataset left behind by a rotation shows up in the
  UI instead of presenting a finished set as current.
- **Choosing and swapping is free.** The station toggles between the phase's
  three at no cost, so one defense's bill and the whole phase's are different
  questions and are answered separately.

They do take a builder and they do take build time, which is what separates
them from hero equipment: equipment is instant and occupies no lane, a module
holds the builder lane as long as a Town Hall does. None of it is in
"what this hall can build", for the same reason supercharges are not — it
expires.

The tables are unusually self-checking, and the tests pin the checks rather
than the figures. All three defenses are built from the same three module
slots — three durations and three cost ladders — permuted so no two spend the
same currency on the same slot. The Crafting Station page publishes the slot
durations (20d 20h, 22d 15h, 24d 2h) and their total independently of the
per-level tables the numbers come from, and both sides agree: 1,621 hours, or
67 days 13 hours, per defense. Because each currency lands on each slot exactly
once, the phase costs the same gold as elixir — 216,000,000 of each — though no
single defense does.

**Sparky Stones** are the app's only *yield*. The rest of `src/lib/game/`
answers what something costs; this answers what it pays. They are earned, never
spent in either village: 8 for every Crafted Defense module level and 10 for
every Supercharge charge level, capped at 5,000 held, and spent only on
cosmetics in the Fancy Shop.

That is why they are not a `Resource` and never enter a
`Record<Resource, number>`. It is also the through-line worth noticing: they
are counted from exactly the two tracks this app already keeps out of every
cost-to-max total, because both are upgrades the game intends to take away
again. Sparky Stones are what it pays back for buying them. Maxing one defense
yields 216 and the phase 648 — figures the Crafting Station page states on its
own, and which only fall out of the module tables if those tables have the
right number of purchasable rows.

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

`finite.test.ts` now asserts finiteness across all 156 Home Village entities —
114 structures and units plus 42 pieces of equipment — because ordering checks
structurally cannot catch NaN.

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
| Crafted Defenses | `public/sprites/crafted/` | `src/lib/sprites/crafted.json` | id + level band |

Files are named by content hash and shared wherever the art is identical: 677
files cover 692 indexed structure-levels across the two villages, and a level
with no entry of its own uses the highest entry below it — which is what keeps
the index far smaller than the level tables it serves. Units are keyed by
village because the two villages share ids — there is a Baby Dragon in both —
but not their art. Resources have no level and no variants, so they are keyed
by nothing but themselves. Crafted Defenses are keyed by level like a
structure, but banded: four pictures cover levels 3-11, 12-20, 21-29 and 30.
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
src/lib/game/crafted.ts  Crafted Defenses — three modules, three currencies, one phase
src/lib/game/sparky.ts   Sparky Stones — the one figure that is earned, not spent
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
