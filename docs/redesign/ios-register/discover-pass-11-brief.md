# Discover · Pass 11 — Cover and four shelves, one curation grammar

Source: `BetterAt — Discover sub-tabs · improvement proposal.pdf` (2026-05).
Locked baseline: `discover-trio-canonical.html` (Pass 09 — Paths-for-you).
Preview surface: `app/discover-ios.tsx` (five sub-tabs, placeholder data).

## What this pass adds

Pass 09 locked the Paths-for-you surface with three editorial sections and three
signal grammars. Pass 11 extends that grammar in two ways:

1. **A new Today / Cover sub-tab** — the front door, a magazine-front-page
   surface that lands the user on one time-sensitive thing happening now, one
   editorial pick, three cross-shelf invitations. Time-stamped title ("This
   Sunday"), eyebrow names the interest context.
2. **Orgs / People / Forums redeployed as curated shelves** — same three-section
   / three-signal grammar as Paths, with surface-tuned vocabulary. Search moves
   from the header to a quiet pill at the foot.

Five sub-tabs share one structure. Cover is the front door; the four shelves
sit behind it.

## Sub-tabs and titles

Title and sub-tab move together (no segmented swap of the title).

| Sub-tab | Title                  | Eyebrow            |
| ------- | ---------------------- | ------------------ |
| Today   | This Sunday            | Discover · Sail Racing |
| Paths   | Paths for you          | Discover           |
| Orgs    | Clubs and federations  | Discover           |
| People  | Sailors to learn from  | Discover           |
| Forums  | Rooms to read          | Discover           |

## Section grammar (each shelf, top → bottom)

Section one always means **system recommendation, tied to current practice**.
Section two always means **peer signal**. Section three always means **worth
knowing exists**.

| Shelf  | Section 1 (coral)                   | Section 2 (avatar dots)        | Section 3 (no signal)      |
| ------ | ----------------------------------- | ------------------------------ | -------------------------- |
| Paths  | Continuing your practice            | Sailors you follow             | New territory              |
| Orgs   | Where you race                      | Clubs your fleet races at      | Federations and circuits   |
| People | Working on what you're working on   | In your fleet                  | Authors in your playbook   |
| Forums | Threads near your open concepts     | Where your fleet is talking    | Rooms worth knowing exist  |

## Signal grammars (do not cross sections or sub-tabs)

- **Coral dot** `#D97757` — system recommendation. Section 1 only, every sub-tab.
- **Avatar dots** (up to 3, -8px overlap) — peer activity. Section 2 only, every sub-tab.
- **No signal** — editorial framing carries the weight. Section 3 only, every sub-tab.
- **Live green** `#34C759` — home-club spotlight on Orgs and Today only. The one
  earned chrome-break. Tied to step-adjacency.

## Cover (Today) — three sections

1. **NOW HAPPENING AT YOUR CLUB** — home-club spotlight from the Orgs sub-tab,
   repositioned. Green live dot permitted. Skipped entirely if nothing's live.
2. **THIS WEEK'S PICK** — one featured card, italic-serif description, full
   Component-1 weight. Same coral-dot signal as Paths section one. Always a Path.
   "See all in Paths →" link sits next to the eyebrow.
3. **ALSO FOR YOU** — three cards, each tagged `A sailor · A room · A club`.
   Same signal grammar as the source sub-tab. The sailor card uses italic-serif-
   with-provenance to surface a quote. "See more →" link sits next to the eyebrow.

What Cover deliberately doesn't do:
- No feed — finite, hand-curated, refreshes weekly. Scroll ends.
- No second pick of the week — one editorial bet per Cover.
- No "For you" tag on individual cards — the whole surface is for you.
- No empty state — if nothing's happening at the club, Now is omitted; no padding.
- No live dot anywhere except the home-club spotlight.
- No carousel — This week's pick is one card, not a swipe-through.

## Other named-absences (across all shelves)

- No path-style cover art (orgs/people/forums get 44px avatar grammar).
- No follower counts on People cards.
- No thread counts or active-time badges on Forums cards.
- No "Following" chip on the list view (that's a detail-page concern).
- No "Suggested" / "For you" tags on individual cards (eyebrow does the framing).
- No "Join" / "Request to join" CTA on the Orgs list view (detail page only).

## Search

Quiet pill at the bottom of each shelf, after the three curated sections.
Identical to how Paths handles it. The four shelves get it; Cover does not.

## Detail-page reorderings (deferred to next pass)

- **Org detail** — lead with Up next (practice surface), then People you'd know,
  then About (demoted to a strip near the bottom).
- **Person detail** — keep Current concept opener; add "captured at his last
  debrief, three weeks ago" provenance line under the quote.

## Vocabulary entries this proposal would add

- **Component 16** — Home-club spotlight on Discover · Orgs. The one earned
  chrome-break. Live green permitted only here.
- **Component 17** — Four-sub-tab curation parity. Same three-section /
  three-signal grammar across Paths / Orgs / People / Forums.

## Wire-up status

The preview at `app/discover-ios.tsx` renders with placeholder data exactly
matching the PDF copy. The data each curated section needs (peer activity,
capability overlap, fleet-club graph, threads-near-concepts) doesn't yet exist
as Supabase queries. Wiring is a separate pass.
