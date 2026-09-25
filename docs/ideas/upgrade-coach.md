# VillageLab — Upgrade Coach

## Problem Statement
How might we tell a Clash of Clans player exactly what to upgrade next, and why,
so their builder, lab and hero time goes where it matters most?

> **Status (2026-09-25): superseded by [portfolio-first.md](portfolio-first.md).**
> Competitor research found that every direction here (individual coaching and
> clan readiness) is already shipped by free tools. Kept for the research.

## Recommended Direction
VillageLab stops being an "all-rounder" and becomes an **Upgrade Coach**: give it
your village and it returns the next ~30 days of builder, lab and hero work in
order, with a one-line reason for each step. Two goal presets on one engine:
**War-ready** (rush repair: offense and key defenses first) and **Max efficiently**
(shortest time to a maxed Town Hall). Trackers show where you stand; this tells
you what to do next.

It builds on what already exists: the lane scheduler in the planner, rushed
detection, and a fully transcribed, test-guarded cost dataset. The work is the
ordering rule and the input path, not new surface area. The existing player
dashboard, clan war room, CWL and Builder Base stay as supporting features, not
headlines.

In parallel, the ingestion worker starts snapshotting the author's own clan on
day one with no new UI. History can't be backfilled, so starting now means a
future **Clan Pulse** (activity, donations, war form over time) launches with
weeks of real data instead of none.

This doubles as the portfolio story: a resource-constrained scheduling problem,
a data pipeline that refuses to guess, and real weekly users.

## Competitive Landscape (checked 2026-09-25)
| Tool | Export import | Next-upgrade advice | Rushed detection | Scheduling | Clan side |
|---|---|---|---|---|---|
| [ClashWatcher](https://clashwatcher.com/) | Yes (paste, 5 accounts, browser-only) | **Yes:** Maxer / Strategic Rush / Super Rusher presets plus custom order | Not mentioned | Yes: builders, lab, potions, Gold Pass | Minimal (attack counts only) |
| [Clash Companion analyzer](https://clashcwl.com/analyzer.html) | Yes | **Yes:** ranked upgrade priorities scored against the TH18 meta, plus an AI coach | Not mentioned | No | CWL-focused site |
| [Clash Ninja](https://www.clash.ninja/upgrade-tracker/overview) | Yes (since July 2025, bulk upload) | Not confirmed | Not confirmed | Tracker and planner | No |

**Clan-side tools (checked the same day):**
| Tool | Rushed detection | Progress over time | Activity / donations | CWL roster | Form |
|---|---|---|---|---|---|
| [ClashPerk](https://github.com/clashperk/clashperk/blob/main/docs/reference.md) | `/rushed` | `/history` (upgrades per season), `/upgrades` | `/lastseen`, `/clan-activity`, donation logs | `/cwl-roster`, `/cwl-lineup` | Discord bot |
| [ClashOS](https://www.clashos.in/) | Yes, by category | Time-to-max | n/a | Readiness before signups, medal odds, war planner | Free web, no login |
| [Clanalyze](https://clanalyze.com/), [ClansHQ](https://clans-hq.com/tools-guide), [Clash Mighty](https://www.clashmighty.com/) | Some | Season stats | Yes | CWL stats, roster building | Web |

**Takeaway:** there is no open feature gap. Individual coaching (ClashWatcher,
Clash Companion) and clan readiness and history (ClashPerk, ClashOS) are both
shipped, free and established. A pivot to "Clan Readiness" does not escape the
competition either. Any user-facing edge has to come from quality or a specific
audience, not from a missing feature.

## Key Assumptions to Validate
- [x] Players can supply building levels cheaply. **Resolved:** the game has an
      in-game village export (Settings → More Settings → export village data, JSON
      copied to the clipboard). Clash Ninja has imported it since July 2025.
      Remaining: map the exact fields from one real export.
- [ ] The ordering beats gut feeling. Give 5 clanmates a plan and count how many
      follow its first 3 steps.
- [ ] The dataset can be kept current. Build an automated wiki re-read that diffs
      against the stored tables and alerts on change; test it on the next balance patch.
- [ ] The worker runs unattended in production. Deploy it against the clan for
      2 weeks and count gaps; switch to the static-key fallback if rotation fails.
- [ ] People outside the clan want it. One r/ClashOfClans post plus 3 clan
      leaders; target 50 weekly users within 4 weeks of launch.

## MVP Scope
**In**
- Deployed publicly (it currently isn't), with a demo account preloaded so
  anyone, reviewers included, sees a full plan in one click
- Coach page: village input by pasting the in-game JSON export,
  preset picker, ordered plan with a reason per step, total time and cost
- Home Village only for the Coach
- Worker snapshotting the author's clan on a schedule (no UI)
- Fan Content Policy footer notice

**Out**
- Coach for Builder Base
- Accounts or login (the plan lives in local state or a share link)
- Clan Pulse UI

## Not Doing (and Why)
- **New Clan Pulse screens.** Collect the data now, build the UI once there's
  history to show.
- **Coach for Builder Base.** Low war stakes, and it doubles the ordering work;
  the existing tracker covers it.
- **New war room or CWL features.** Discord bots own this space; the existing
  pages are enough.
- **Base layout builder.** Already cut, and it stays cut.
- **Accounts and login.** They add friction before there's proven value; a
  share link is enough.
- **Monetization.** Supercell's fan content terms rule it out, and it would
  distract anyway.
- **A black-box "optimal" solver.** Explainable rules that players can argue
  with beat an opaque score.

## Open Questions
- What is the exact field layout of the export (level, count and timer keys)?
  Does it include Builder Base and hero equipment? Settle this from one real export.
  Entities are numeric game IDs (e.g. `Cannon = 1000008`); the public mapping is
  incomplete, so an unknown ID must be reported, never dropped silently.
- Given the competitors below, what does VillageLab do that they don't?
- Which host runs the worker (free tier with key rotation, or a small fixed-IP box)?
- What is the exact War-ready priority rule? Draft it with 2–3 strong players in the clan.
- Does "reason per step" need the numbers ("+12% army DPS"), or is a category
  ("offense: heroes first") enough?
