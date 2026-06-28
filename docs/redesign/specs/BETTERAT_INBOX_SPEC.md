# BetterAt Inbox — capture-first, organize-later

> **Status:** Spec / not built. Author: design pass 2026-06-28.
> **One-liner:** Let a user dump a link, article, quote, or half-formed idea
> into BetterAt in one tap — *without* deciding yet whether it's a step, a
> concept, a resource, or a blueprint. Triage happens later, as its own pass.

## The problem

A user is reading an article, or watching a YouTube video
(`youtube.com/watch?v=…` for their drawing interest), and thinks *"BetterAt
might be relevant here."* Today their only options are heavyweight: create a
step, fork a concept into the playbook, upload a library resource. Each forces
a classification decision at the worst possible moment — mid-read, low
intent, no time. So the link gets lost to a browser tab or a Notes app, and
BetterAt never sees the raw material that should feed its plans and worked
examples.

**The fix is to separate *capture* from *organization*.** Capture must be
zero-friction and zero-classification. Organization (turn-this-into-something)
is a deliberate, later pass over the pile.

## What already exists (don't reinvent)

Two things in the codebase are easy to confuse with this; neither is it, but
one is the foundation:

| Surface | Table | What it is | Relationship to the Inbox |
| --- | --- | --- | --- |
| **Suggestions inbox** | `inbox_items` | Inbound peer *suggestions* (`from_user_id`, `from_plan_id`, `suggested_title`, `step_id`). Folds onto the avatar with an unread badge. | **Different feature.** This is "someone sent *you* something." Do not overload it. |
| **Playbook insight capture** | `playbook_insights` | Raw self-capture: `kind`, `content`, `audio_uri`, `interest_id`, `refined_to_concept_id`. Written by `QuickCaptureService.dropInsight()`; refined into a concept later. | **This IS the seed of the Inbox.** It already models "dump now, refine later" — but only for text/voice → concept. |

`QuickCaptureService` already has the two write paths (`createDraftStep`,
`dropInsight`) and the `capture/` services dir is the `@betterat_bot` Telegram
capture infrastructure (`conversation.ts`, `actions.ts`, `systemPrompt.ts`).

**Recommendation: generalize `playbook_insights` into the universal capture
inbox rather than create a new table.** It already has the shape; it's missing
(a) link/URL as a first-class capture kind and (b) refine targets beyond
concept.

> Naming note: per `project_playbook_to_library_rename`, keep the
> `playbook_*` DB identifiers; the *UI* word is "Library"/"Inbox". This spec
> uses "Inbox" for the surface and `playbook_insights` for the table.

## Data model

Extend `playbook_insights` (additive, no breaking change):

```sql
ALTER TABLE public.playbook_insights
  ADD COLUMN source_url   TEXT,        -- the dumped link, when kind='link'
  ADD COLUMN title        TEXT,        -- fetched/og title or user note (nullable)
  ADD COLUMN status       TEXT NOT NULL DEFAULT 'unsorted'
             CHECK (status IN ('unsorted','kept','archived','refined')),
  ADD COLUMN refined_to_type TEXT      -- 'step' | 'concept' | 'resource' | 'blueprint'
             CHECK (refined_to_type IN ('step','concept','resource','blueprint')),
  ADD COLUMN refined_to_id   UUID;     -- polymorphic target id
```

- `kind` gains `'link'` alongside existing `'text' | 'voice'`. A link capture
  sets `source_url`; `content` holds the user's optional one-line note.
- `interest_id` stays **nullable and optional at capture** — the whole point is
  not to make the user pick. Inferred or chosen at triage (see below).
- `refined_to_concept_id` is retained for back-compat; new refinements use the
  polymorphic `refined_to_type` + `refined_to_id`. (Migration can backfill the
  old column into the new pair.)
- `status` is the triage state machine: `unsorted` → (`kept` | `archived` |
  `refined`).

## Capture entry points (all write one `playbook_insights` row)

Ranked by friction — lower is better and should be built first:

1. **Telegram forward → `@betterat_bot`.** Lowest friction of all: the user
   forwards a link to the bot from anywhere, no app open. The bot infra already
   exists in `services/capture/`; add a "looks like a bare link → drop as
   `kind='link'`" branch to `conversation.ts`/`actions.ts`. **Build first.**
2. **Native share-sheet target.** Register BetterAt as an iOS/Android share
   target so "Share → BetterAt" from Safari/YouTube drops the URL. (Requires an
   `expo-share-intent`-style native module — the heaviest lift; schedule last.)
3. **Web/in-app paste box.** A always-available "＋ Dump a link or note" field
   at the top of the Inbox surface. Trivial; build alongside #1.

Every path is fire-and-forget: write the row, optimistic toast ("Saved to your
Inbox"), no modal, no required fields. An async OG-fetch backfills `title` +
thumbnail for links (reuse `library_items_thumb_url` patterns).

## Triage (organize-later) flow

A dedicated Inbox surface lists `status='unsorted'` rows newest-first, each a
card: thumbnail/title, source domain, captured-at, optional note. Per card, the
deliberate "turn into something" choice:

- **→ Step** — opens the QuickCapture composer prefilled (title = `title`,
  description = note + link). On save, set `refined_to_type='step'`,
  `refined_to_id`, `status='refined'`.
- **→ Concept (Library)** — reuse the existing concept-fork path
  (`refined_to_concept_id` legacy column / `refined_to_type='concept'`).
- **→ Resource (Library)** — create a `library_items` row from the link
  (and tag via `library_item_interests`, per
  `project_library_item_tagging_join_table`).
- **→ Blueprint** — feed it as inspiration material to the "Get Inspired" /
  worked-example generator (`project_worked_example_compounding`), which already
  knows how to consume raw source text/links.
- **Keep** (`status='kept'`, leave un-refined) / **Archive**
  (`status='archived'`).

**Interest tagging is deferred to triage, not capture:** the card offers an
interest chip (default inferred from the link/text via a cheap LLM pass or the
user's single active interest); the user can override. This keeps capture a
single tap while still letting items land in the right interest's Library.

## Where the Inbox lives (UI)

The avatar/bell inbox is taken by peer *suggestions* (`inbox_items`). This
capture Inbox belongs in the **Library** surface as a zone — it's the raw feeder
for everything else there (concepts, resources, plans). Proposed:
`/library?zone=inbox`, sibling to the existing interests/resources zones
(`project_interests_surface_architecture`). An unsorted-count badge on the
Library tab signals "you have stuff to triage."

## Why this shape

- **Capture/organize split** is the whole thesis — never make the user
  classify at capture time.
- **Generalizing `playbook_insights`** avoids a parallel table, inherits the
  existing capture service + Telegram path, and keeps the "raw → refined"
  lineage (`refined_to_*`) that the worked-example compounding already wants.
- **Telegram-first** because the lowest-friction capture is the one that
  doesn't require opening the app — and that bot already exists.

## Build order (suggested commits)

1. **Migration** — extend `playbook_insights` (columns above) + backfill
   `refined_to_concept_id` → polymorphic pair.
2. **Capture writes** — `kind='link'` in `QuickCaptureService` + web paste box;
   Telegram bare-link branch.
3. **Inbox zone** — `/library?zone=inbox` list of unsorted items + keep/archive.
4. **Triage actions** — → Step / Concept / Resource / Blueprint wiring.
5. **OG enrichment** — async title/thumbnail backfill for links.
6. **Native share-sheet target** — last (native module lift).

## Open questions for the user

- Should an unsorted item ever auto-expire / nudge ("12 links sitting for 30
  days — triage or archive?"), or stay forever until acted on?
- Is **Blueprint** a real triage target now, or defer it until the
  worked-example generator is further along?
- Native share-sheet: worth the native-module cost early, or is Telegram +
  paste enough to validate the behavior first?
