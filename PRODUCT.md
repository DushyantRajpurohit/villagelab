# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, in this order (confirmed 2026-10-14):

1. **Reviewers**: an engineer or hiring manager, usually someone who has never
   played Clash of Clans, arriving from a resume or GitHub link and giving the
   project a few minutes. Their job is to decide whether the author solves hard
   problems carefully.
2. **Players**: someone who plays Clash of Clans and wants to see where an
   account stands, plan upgrades, or follow a clan's wars. They use the tool
   pages; those pages must stay practical for them.

## Product Purpose

VillageLab is an unofficial Clash of Clans companion: player progress tracking,
upgrade planning and clan war analytics. It exists primarily as a portfolio
project. Success is a reviewer concluding, within 3 to 5 minutes, that the
engineering is careful. Features are frozen (see `docs/ideas/portfolio-first.md`).

## Positioning

- Nothing user-facing calls the Supercell API: a page miss enqueues the tag and
  a worker ingests it later, so user traffic cannot exhaust the upstream budget.
- The game dataset is transcribed level by level from published tables by a
  parser that refuses to read a table it cannot resolve; nothing is interpolated.
- Persisted snapshots give history the snapshot-only API cannot serve.

## Operating Context

- Runs fully on a deterministic mock generator with no database or token.
- Not deployed; deploy is on hold. Reviewers currently meet it as a repo.
- Routes: `/`, `/player`, `/player/[tag]`, `/player/[tag]/builder`, `/planner`,
  `/clan`, `/clan/[tag]`, `/clan/[tag]/war`, `/clan/[tag]/league`,
  `/clan/[tag]/log`.

## Capabilities and Constraints

- Next.js 16.3.4, React 19, Tailwind 4. This Next version has breaking changes;
  read `node_modules/next/dist/docs/` before writing route code (AGENTS.md).
- An account is two villages (Home Village, Builder Base) that are never mixed;
  every player and planner surface carries a switch between them.
- Resource colours are data, not decoration: a figure's hue names its currency
  (gold, elixir, dark elixir, three ores, Sparky Stones).
- No estimated values exist in the app; the `≈` marker must not appear.
- Supercell's Fan Content Policy attribution lives in the root layout and must
  stay on every page.
- Undecided: whether light and dark both remain first-class, and whether any
  page or panel may be merged or removed in a redesign. The user was asked and
  did not pin either; default is to keep all function and both themes.

## Brand Commitments

- Name: VillageLab.
- Unofficial fan content; never presented as affiliated with Supercell.
- A full visual replacement was approved on 2026-10-14. The dark "storefront"
  look is the incumbent being replaced, not a commitment.

## Evidence on Hand

- Official game art used under the Fan Content Policy: per-level structure
  sprites (`public/sprites/`), unit portraits (`public/sprites/units/`),
  resource badges (`public/sprites/resources/`), Crafted Defense art
  (`public/sprites/crafted/`); provenance in `public/sprites/credits.json`.
- Real figures from the README: 931 tests; a Cannon priced 22,500,000 by the old
  curve against a real 3,000,000; 46 of 67 units at the wrong maximum level.
- No users, testimonials, traffic numbers or live URL exist. Do not invent them.

## Product Principles

1. Show the engineering working, not a description of it.
2. A non-player must understand what a page is for.
3. Never show a number without its currency or its source of truth.
4. Keep the two villages apart.
5. Tool pages stay usable by an actual player; presentation never costs them a figure.
