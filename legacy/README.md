# ClashVerse

An all-rounder Clash of Clans platform for players and clans: army progress tracking,
upgrade planning with a real builder schedule, a clan war room, and a base layout builder.

Zero npm dependencies. Node 20+ and a browser is the whole stack.

```bash
npm start          # http://localhost:8787
npm run check      # validate the game dataset
```

## Modules

| Module | What it does |
| --- | --- |
| **Player dashboard** | Look up any tag; merges the account's troop/hero/spell levels with the per-Town-Hall ceilings to show progress-to-max, flag rushed units, and total the cost of closing the gap. |
| **Upgrade planner** | Record your actual building levels, queue upgrades, and get a completion date from a scheduler that models N builders plus separate laboratory and hero lanes. Warns when the queue costs more than you have banked. |
| **Clan war room** | Roster health (donation ratios, Town Hall spread, freeloaders), live war progress with missed-attack flagging, and win-rate history. Tabs are deep-linkable: `#/war/log`. |
| **Base builder** | 44×44 grid editor. Placement is capped by your Town Hall's real building limits, so a finished layout is always buildable. Click to place, drag to paint walls, right-click to remove. |

## Live data

The app runs on deterministic mock data out of the box — every tag yields a stable,
plausible player or clan, so the entire UI is usable with no credentials.

To connect the real API:

1. Create a key at [developer.clashofclans.com](https://developer.clashofclans.com),
   whitelisted to the **public IP of the machine running this server**.
2. `cp .env.example .env` and paste the token into `COC_API_TOKEN`.
3. Restart. The sidebar badge flips from `mock data` to `live API`.

The Supercell API sends no CORS headers and pins tokens to an IP, so it cannot be
called from a browser. `server/coc-api.js` is the proxy that makes it work; the
frontend only ever talks to our own `/api`. A `403 accessDenied.invalidIp` means the
token's whitelisted IP doesn't match this server — the UI says so explicitly.

Responses are cached in memory (1–5 min depending on endpoint) to stay under rate limits.

## Data accuracy — read this

The API exposes troop and hero levels but **no building levels and no upgrade costs**,
so `data/` carries a curated dataset: 17 Town Halls, 43 buildings, 66 units.

Costs and times are stored as **anchors** — levels whose real values I'm confident in —
and the gaps are filled by geometric interpolation (`data/curve.js`). Currently about
**24% of levels are anchored and 76% interpolated**.

Every interpolated number is rendered with a `≈` and flagged `est: true` in the data.
Nothing here should be treated as a wiki-accurate figure until its anchor is verified.

Improving it is a one-line edit — add the true value to a building's `costs`/`times`
map and it stops being an estimate:

```js
costs: { 1: 270, 5: 12000, 8: 400000, 11: 3200000, /* add: */ 12: 4200000 },
```

Then run `npm run check`, which enforces the invariants that are easy to break while
editing: monotonic counts and max levels per Town Hall, non-decreasing costs, and units
that never unlock before the building that produces them.

## Where your data lives

Village levels, the build queue and saved layouts are **localStorage only** — nothing is
sent anywhere. Use Export/Import in the top bar to move or back them up.

## Layout

```
data/          curated game data + the interpolation helper
server/        zero-dependency HTTP server, API proxy, mock generator
web/           frontend (vanilla ES modules, no build step)
  js/modules/  one file per module
scripts/       dataset validator
```
