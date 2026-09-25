# VillageLab — Portfolio First

## Problem Statement
How might we make an engineer or hiring manager who has never played Clash of
Clans conclude, within 3–5 minutes, that the author solves hard problems carefully?

## Recommended Direction
Freeze features. VillageLab already has more product than a reviewer will ever
explore: three tools, two villages and a hand-verified dataset. The competitor
research (see `upgrade-coach.md`) showed every feature area is already served by
free tools, so its value is not market novelty but the engineering and how it's
told. The work now is **presentation, not construction**.

Lead with three stories the README already contains but buries:
1. **Nothing user-facing calls Supercell:** a queue-and-worker design that makes
   an amplification attack structurally impossible, not merely discouraged.
2. **A parser that refuses to guess:** it caught a "Boost Cost" column standing
   in for a build cost, and it replaced curves that priced a Cannon at 22.5M
   against a real 3M, with 46 of 67 units at the wrong maximum level.
3. **Owning the data buys what the API can't serve:** append-on-change
   snapshots give history from a snapshot-only API.

Each gets a short, readable write-up and a direct path into the app where the
reviewer can see it working. The app runs fully on mock data with no setup,
which is exactly what a reviewer needs.

## Key Assumptions to Validate
- [ ] A non-player understands what the app does in 30 seconds. Test: show the
      README top section to 2 non-players and ask them to explain it back.
- [ ] Reviewers read the README before they run anything. Test: ask 2–3
      engineer friends to review the repo cold and note where they stop.
- [ ] The data-accuracy story reads as rigor, not obsession. Test: the same
      reviewers; watch whether they mention it unprompted.
- [ ] It can be judged without a live URL. It probably can't be for long, since
      deploy is on hold; everything below keeps deploy a one-step job for when
      it resumes.

## MVP Scope
**In**
- **README rewrite as the front door:** a 3-line explanation for non-players,
  screenshots or a short GIF, the three stories up top, dataset details moved
  lower. Fix the stale test count (974 → 931).
- **Case-study write-up:** one page (in the repo, and optionally an `/about`
  route) telling the curve-errors story and the architecture story with the
  real numbers.
- **Demo path:** the landing page offers a one-click sample player (mock data)
  that shows the richest views, followed by the planner, in under 90 seconds.
- **Repo hygiene:** remove `legacy/` from the tree (git history keeps it), use
  one name everywhere, and add a CI status badge (workflows already exist).
- **Polish pass** on the three main pages for empty, loading and error states
  and phone width.

**Out**
- Deployment (on hold; resume as the final step)
- Any new feature

## Not Doing (and Why)
- **Upgrade Coach and Clan Pulse.** Competitors already ship both; building them
  adds scope without improving the portfolio story.
- **Chasing real users.** Distribution work doesn't serve this goal right now; it
  can be revisited later with your clan.
- **Removing Builder Base.** It stays visible by choice; it is working code, not
  a liability.
- **The competitor accuracy comparison.** It would strengthen the story, but it's
  optional; add it only if the write-up feels thin.
- **New visual redesign.** The storefront look just landed; polish it, don't
  replace it.

## Open Questions
- Where will reviewers arrive from: a resume link to GitHub, or a live URL? That
  decides whether the README or the landing page is the front door.
- Case study as a markdown file, an in-app page, or a blog post?
- What's the trigger for taking deploy off hold?
