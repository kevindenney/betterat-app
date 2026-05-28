# Phase D Spec: Persona-Aware Practice Ladder

> The four-level zoom ladder (Step → Near → Season → Lifetime) works
> well for the persona it was built around (JHU MSN nursing) and
> noticeably less well for everyone else. This spec is the
> architectural pass that makes the ladder *equally true* for a
> Hong Kong Dragon sailor, a JHU MSN student, and a rural Jharkhand
> craft entrepreneur — without any of them being a second-class
> citizen. The work is mostly *data*, not visuals: pull persona-specific
> content out of code and into per-interest registries the chrome
> reads from.

## Goal

Make the four-level Practice surface (`L1 Step` / `L2 Nearby` /
`L3 Season` / `L4 Lifetime`) honour the reality of any persona that
adopts BetterAt by promoting eight cross-persona primitives to
first-class objects keyed off `interest_id`.

Concrete acceptance test, per persona:

- **Dragon sailor** scans L4 and reads it as their racing career —
  *campaigns, regattas, fleets, podiums, crew constancy* — not as a
  generic "rotation rotation rotation" pattern.
- **MSN student** scans L4 and reads it as their nursing trajectory —
  *MSN program progress, competencies attested, NCLEX runway,
  preceptor constancy, residency match* — not as undifferentiated
  practice activity.
- **Jharkhand entrepreneur** scans L4 and reads it as her business
  journey — *production cycles, loan-tier progression, scheme
  registrations, women trained, ₹ earned per season* — in Hindi /
  Hinglish, with money as a first-class lane.

If a persona's lifetime view does not produce dignified
self-recognition, the spec has not landed.

## Reference Personas

The three the spec is written against, each grounded in real
behaviour patterns rather than ideal users:

### Persona 1 — Yvonne Leung (Hong Kong Dragon sailor)

- Dragon class racer, RHKYC member, building toward Dragon Worlds.
- Season is HK Winter Series + Worlds qualification campaigns.
- People structure: crew (Markus on foredeck for 18+ races), fleet
  mates (HKDA roster), coaches (Pål from Norway).
- Evidence type: race finishes, video, debrief notes.
- Anchors that aren't her steps: HKDA race calendar, club deadlines,
  Worlds schedule.

### Persona 2 — Maya Patel (JHU MSN nursing student)

- Mid-program MSN, building toward AGACNP DNP.
- Season is one clinical rotation (~6 weeks) inside a semester.
- People structure: preceptor (Patricia Morrison), cohort (~30
  classmates), faculty mentor.
- Evidence type: attested competencies, simulation hours, patient
  encounter counts, reflections.
- Anchors that aren't her steps: academic calendar, simulation lab
  bookings, NCLEX exam date.

### Persona 3 — Savitri Devi Munda (Jharkhand entrepreneur, Khunti district)

- Lac craft + tasar reeling, runs home-based enterprise. SHG member
  with PRADAN; one MUDRA Shishu loan repaid, Kishore in process.
- Season is a production-and-festival cycle ("Diwali run-up",
  "Lac season Oct-Mar").
- People structure: SHG (~12 women), PRADAN field officer, JSLPS
  Community Resource Person, bank manager, gram panchayat.
- Evidence type: sales receipts, ₹ earned per week, photos of
  output, buyer notes, women trained.
- Anchors that aren't her steps: weekly haat days, scheme
  application windows, festival cycle, monsoon, MUDRA loan
  evaluation cadence.
- Language: Hindi / Hinglish primary; Devanagari rendering required.
- Connectivity: intermittent. App must function offline; sync at
  panchayat or town WiFi.

## The Universal Pattern

Stripped to what all three share, the practice ladder is eight
things and nothing else:

1. **A thing to do in the next few hours.**
2. **A handful of things I'm tracking this week.**
3. **A campaign I'm in the middle of, with a vision.**
4. **A trajectory my life is on.**
5. **People I'm doing this with, who matter at each level.**
6. **Evidence that proves it was real.**
7. **Places that shape the work.**
8. **External anchors that govern my time.**

L1–L4 are the four spatial views of items 1–4. Items 5–8 cut
*across* all four levels. The current implementation does items
5–7 well; item 8 is missing; items 6 and 7 are persona-leaky.

## The Eight Primitives That Need to Become First-Class

| # | Primitive | Status today | Becomes |
|---|---|---|---|
| 1 | **Vocab dictionary per interest** | partially via `useVocabulary`, label leakage in many surfaces | a `interest_vocab` table the chrome reads from for every label, prompt, sentence template |
| 2 | **Capability set per interest** | hardcoded `CAPABILITY_PALETTE` (nursing) with hash-to-color fallback | per-interest `interest_capabilities` registry; L3 capability river + L4 dominant-capability read by id + label, not by reverse-mapped colour |
| 3 | **Marker library per interest** | absent; L4 has anonymous bricks | per-interest `interest_marker_types` (e.g. `podium`, `competency_attested`, `loan_tier_up`); marker rows live on `step_markers` |
| 4 | **Evidence types per interest** | partial (`step_evidence` exists in some flows) | `step_evidence` first-class, typed per interest. L3/L4 read it as the "what was real" lane |
| 5 | **Money lane (optional)** | absent | per-interest flag; when on, steps can have `step_finance` rows (in / out / working capital) and L3/L4 render a money lane |
| 6 | **External anchor overlays** | absent | a feed of "things you don't control" (race calendar, semester deadlines, haat days, monsoon, scheme windows) overlaid on L2 strip + L3 season bar |
| 7 | **People model with org context** | strong (`organization_memberships`, `step_collaborators`), light on lifetime constancy | add a lifetime constancy view — "Markus has crewed 18 races; Patricia preceptored 2 rotations; Vimla has been SHG sister 4 seasons" |
| 8 | **Stakeholder cuts** | absent | per-step + per-season read-only views configurable for different external viewers (PRADAN officer view, bank manager view, preceptor view) |

Primitive #1, #2, #3, #6, #8 are the architectural moves. The rest
extend existing structures.

## L1–L4 Behaviour When the Primitives Land

### L1 — Do this now

No structural change to Plan / Do / Reflect / Discuss. The grammar
is universal. Every visible label resolves through the persona's
vocab dictionary. WITH chip surfaces the persona-named role (Crew,
Preceptor, SHG sister). NEAR chip queries proximity peers from
`atlas_peer_steps_near` regardless of persona. Evidence capture
defaults to the persona's evidence type (race finish, attestation,
sales receipt). Step lifecycle adds an optional "seasonal /
opportunistic" status — for tasks that won't happen until a future
window (mahua harvest, NCLEX exam, Worlds qualifier).

### L2 — The week

A `density` axis added: `peek` (current 3-card carousel) or
`compact` (5–7 card horizontal strip). Default by interest:

- Sailor — `peek`
- Nursing student — `compact`
- Entrepreneur — `compact`

An **anchor lane** sits behind the cards: a dim rail rendering
external anchors from the interest's anchor source (e.g. *"Tue · haat
day,"* *"Wed · HKDA Race 1,"* *"Fri · mid-rotation eval"*). Anchors
are not steps; they're the grid steps land against.

### L3 — The season

Already the best-tuned level. Changes are quiet but important:

- Season name pulled from interest vocab ("Race series," "Rotation,"
  "Production cycle").
- Capability river renders **interest-registered capability ids**
  with their real labels (Starts / Tactics / Boat-speed,
  Cardiac / Pharm / Comm, Production / Marketing / QC / Money).
  No more reverse-engineered nursing terms on non-nursing surfaces.
- Reflections lane unchanged.
- Cohort lane attaches the relevant org context (RHKYC, JHU School
  of Nursing, HK Dragon Association, the user's SHG).
- **Money lane** appears only when the interest has money on. Per-week
  net, season running total, working capital available.
- One librarian sentence composed from the persona's capability
  labels and season vocab. If labels are absent or low-confidence,
  the sentence stays generic — *never* leaks vocab from another
  persona.

### L4 — The trajectory

Replace the brick-of-bricks pattern with a **chapter ledger** under
a **lifetime vision banner**.

- **Lifetime vision banner** — large italic serif. Has an origin
  date ("since 2018") and supports evolution (small marks where the
  vision was revised, the prior text retained in history).
- **Vertical scroll of chapter cards** — one per past or current
  season, ordered chronologically. Each card carries:
  - Persona-named season label + date range
  - The season's vision (as it was at the time)
  - Top 1–3 capabilities the season actually worked on (real labels
    from primitive #2)
  - Markers earned in the season (from primitive #3)
  - Key event(s) — race / rotation / production cycle anchors
  - One reflection quote (most-engaged in the season)
- **Marker timeline** — a thin horizontal lane running through the
  chapters. Each marker type renders in the persona's visual
  language (a podium tier for sailors, a competency check for nurses,
  a loan-tier icon for the entrepreneur).
- **People constancy view** — cross-chapter view of who has been
  with you. "Markus — 18 races across 4 campaigns," "Patricia — 2
  rotations as preceptor," "Vimla — 4 seasons as SHG sister." This
  is gold for emotional recognition.
- **Trajectory readout** — interest-tuned summary ("Qualified for
  Worlds in 3 of last 4 years," "32% through MSN, 14 months from
  NCLEX," "Shishu repaid, Kishore active, 60% of the way to Tarun").

## What Makes It Amazing, Not Just Adequate

Adequate is "every persona can use it." Amazing is "every persona
sees their life back at them." The five things separating the two:

1. **Evidence accumulates into proof.** Without typed evidence
   appearing in L3/L4, the lifetime view is melancholy abstraction.
   With it, it becomes a dignity surface — race results for the
   sailor, attestations for the nurse, ₹ totals + buyer photos for
   Savitri.
2. **People constancy makes the lifetime view emotional.** The same
   `step_collaborators` data, surfaced across chapters, produces a
   moment of recognition for every persona. Markus has been crew for
   six years. Patricia signed your first competency attestation.
   Vimla taught you natural dye. These are the moments the app
   *means* something.
3. **External anchors make the app feel like it understands your
   context.** When the L2 strip knows haat day, race day, and
   preceptor-eval day without the user typing them in, the surface
   stops being a generic to-do list and starts being *the user's
   week.*
4. **Stakeholder cuts unlock dignity for Savitri specifically.** Her
   business trajectory is also her case for the next loan / scheme /
   panchayat award. A read-only stakeholder view of her L4 trajectory
   turns the app into her proof of progress. Sailor and nurse get
   smaller wins from this primitive; Savitri's is transformative.
5. **Cross-persona learning, opt-in.** The four-tier social model
   already supports this; surfacing *"how others at this stage of
   the same arc structured their season"* as a tasteful affordance
   at L3/L4 turns the platform from a personal logbook into a
   learning OS.

## Strategic Question

This spec assumes the architectural bet **(a)**:

> *BetterAt is one product that ships persona starter packs.*

The chrome is universal. Persona difference is data (vocab +
capabilities + markers + evidence + anchors), registered against a
generic shape. A new persona = a new registry, no chrome fork.

The alternative bet **(b)** is *many bespoke persona surfaces on a
shared backend* — SailRacingOS, NursingOS, KhuntiCraftOS — each
deliberately tuned, sharing only identity / step / atlas plumbing.
Different brands, different go-to-market.

This spec lives entirely inside bet (a). If the strategic call
moves to (b), the spec is structurally still valid (since the
backend would be shared), but the chrome work concentrates in the
bespoke surfaces instead of in a single configurable shell.

## Phasing — Engineering Bets in Order

Each bet is independently shippable and produces a visible
persona-level improvement.

### Bet D1 — Vocab pass (1–2 days)

Promote `useVocabulary(interestSlug)` to cover every visible label,
prompt, season name, librarian sentence template across L1/L2/L3/L4.
Audit existing string literals; route through vocab. Add `nursing`,
`sail-racing`, and `khunti-craft` starter entries.

Acceptance: a sailor's L3/L4 contains no nursing terms; an
entrepreneur sees season names in Hindi/Hinglish-friendly options.

### Bet D2 — L2 density variant (½ day)

Add a `density` prop to `TimelineZoomCanvas` / `L2WeekView`. `peek`
keeps the carousel-with-silhouettes; `compact` shows a 5–7-card
horizontal strip. Default by interest preference.

Acceptance: nursing and entrepreneur personas see a denser week view
without affecting the sailor's preferred peek pattern.

### Bet D3 — Carry labels forward (1 commit)

Replace `colorToCapabilityLabel` reverse mapping with capability-id
threading. Bricks at L3 carry the real `capability_id`; lifetime
analysis reads ids and labels straight, no colour round-trip.
Eliminates the nursing-vocab leak on non-nursing L4 librarian
sentences.

Acceptance: drift sentence reads accurate labels on any persona.

### Bet D4 — `interest_capabilities` + `interest_marker_types`
tables (1–2 days)

Schema work. Migrate `CAPABILITY_PALETTE` to a per-interest table.
Add `step_markers` for the L4 marker timeline. Adapter reads from
the user's active interest registry. Capability river + L4 trajectory
read from the new tables.

Acceptance: a sailor sees `Starts / Tactics / Boat-speed`; a nurse
sees `Cardiac / Pharm / Comm`; Savitri sees `Production / Marketing
/ QC / Money / Compliance`.

### Bet D5 — L4 chapter ledger restructure (real design work)

Replace L4's brick-of-bricks lanes with vertical scroll of season
chapter cards + lifetime vision banner + marker timeline + people
constancy view + trajectory readout. Read from primitives D3 + D4 +
existing step / collaborator data. **This is the structural change
that makes L4 mean something.**

Acceptance: every persona's L4 produces dignified self-recognition.

### Bet D6 — External anchor overlay (1–2 days per anchor source)

Per-interest anchor data sources. Sailing: race calendar (HKDA,
RHKYC, world Dragon class calendar). Nursing: academic calendar
imports per institution. Entrepreneur: haat day map + festival
cycle + scheme deadlines. Renders behind the L2 strip and the L3
season bar.

Acceptance: every persona's week feels context-aware without manual
entry.

### Bet D7 — Money lane (Savitri-class)

Per-interest `has_money` flag. `step_finance` rows on opted-in
steps. Money lane in L3 + L4 trajectory readout. Off by default;
explicit opt-in per interest. Entrepreneur defaults on.

Acceptance: Savitri sees her ₹ in/out per week; lifetime view shows
loan-tier progression and ₹ earned per season.

### Bet D8 — Stakeholder cuts (Savitri-transformative)

Read-only views of a user's L3 season or L4 trajectory configurable
for different external viewers. PRADAN officer view ≠ bank manager
view ≠ panchayat view. Backend: permissioning on `step_share_grants`
extended with view-template ids. Frontend: a "Share this view"
sheet on L3 / L4.

Acceptance: Savitri can hand a bank manager a clean read-only L4
trajectory specifically tuned for loan evaluation.

### Bet D9 — Hindi / Devanagari support

i18n infrastructure. Devanagari font, RTL not required. Vocab
dictionary entries in Hindi for `khunti-craft` interest. Input
methods preserved.

Acceptance: Savitri reads the chrome in Hindi.

### Bet D10 — Offline-first + WhatsApp/Telegram bridge

Service-worker-style offline + local-first state. WhatsApp export
of step text. Telegram step-creation via bot (already partially
shipped per `reference_telegram_bot_handle.md`).

Acceptance: Savitri uses the app at home offline; SHG decisions
flow into the app from WhatsApp.

## Schema Sketches

Per-interest tables the chrome reads from. All keyed off
`interest_id`. Designed for additive evolution — new persona = new
rows, no chrome fork.

```sql
-- D1 vocab
CREATE TABLE interest_vocab (
  interest_id    UUID NOT NULL REFERENCES interests(id),
  key            TEXT NOT NULL, -- e.g. 'step', 'season', 'cohort', 'preceptor_debrief'
  label          TEXT NOT NULL, -- e.g. 'Race', 'Series', 'Crew', 'Coach debrief'
  PRIMARY KEY (interest_id, key)
);

-- D4 capabilities
CREATE TABLE interest_capabilities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id    UUID NOT NULL REFERENCES interests(id),
  slug           TEXT NOT NULL,                   -- 'starts', 'cardiac', 'production'
  label          TEXT NOT NULL,                   -- 'Starts', 'Cardiac assessment'
  color          TEXT NOT NULL,                   -- hex
  sort_order     INT  NOT NULL DEFAULT 0,
  UNIQUE (interest_id, slug)
);

-- D4 markers (lifetime trajectory anchors)
CREATE TABLE interest_marker_types (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id    UUID NOT NULL REFERENCES interests(id),
  slug           TEXT NOT NULL,                   -- 'podium', 'competency_attested', 'loan_tier_up'
  label          TEXT NOT NULL,
  glyph          TEXT NOT NULL,                   -- sf-symbol or svg id
  tone           TEXT NOT NULL,                   -- 'gold' | 'blue' | 'green' | 'purple'
  UNIQUE (interest_id, slug)
);

CREATE TABLE step_markers (
  step_id        UUID NOT NULL REFERENCES timeline_steps(id),
  marker_type_id UUID NOT NULL REFERENCES interest_marker_types(id),
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata       JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (step_id, marker_type_id)
);

-- D6 external anchors
CREATE TABLE interest_anchor_sources (
  interest_id    UUID NOT NULL REFERENCES interests(id),
  source         TEXT NOT NULL,                   -- 'race_calendar', 'academic_calendar', 'haat_day'
  config         JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (interest_id, source)
);

CREATE TABLE anchor_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_id    UUID NOT NULL REFERENCES interests(id),
  source         TEXT NOT NULL,
  label          TEXT NOT NULL,                   -- 'HKDA Race 4', 'Mid-rotation eval', 'Khunti haat'
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ,
  location_id    UUID,
  metadata       JSONB NOT NULL DEFAULT '{}'
);

-- D7 money (opt-in)
CREATE TABLE interest_features (
  interest_id    UUID PRIMARY KEY REFERENCES interests(id),
  has_money      BOOLEAN NOT NULL DEFAULT false,
  has_stakeholder_views BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE step_finance (
  step_id        UUID NOT NULL REFERENCES timeline_steps(id),
  direction      TEXT NOT NULL CHECK (direction IN ('in','out','working_capital')),
  amount         NUMERIC(12,2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'INR',
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata       JSONB NOT NULL DEFAULT '{}'
);
```

These are sketches, not final. Each bet's commit message lands the
exact migration.

## Non-Goals

Explicitly out of scope for Phase D, even if related:

- AI-generated capability inference (Phase E candidate)
- Public-facing dashboards / embeddable trajectory cards (separate
  spec)
- Real WhatsApp / Telegram bidirectional bridge beyond what already
  ships under the Telegram bot
- Cross-interest analytics / dashboards
- Stripe / payment integration for Savitri-class commerce flow
- Translation beyond Hindi (Mundari/Ho/Kurukh as future work)

## Rollout

Each bet ships independently behind a feature flag. Personas opt in
by interest. The current nursing surface is the reference
implementation — it must not regress.

Recommended rollout sequence — first three bets are unblockers, the
rest are interest-by-interest:

1. D3 (1 commit) — stops the nursing-vocab leak. Ship immediately.
2. D1 (1–2 days) — vocab pass. Ship behind `FEATURE_INTEREST_VOCAB`.
   Default on for `nursing`; light up `sail-racing` and
   `khunti-craft` in turn.
3. D2 (½ day) — L2 density. Ship behind `FEATURE_L2_DENSITY_COMPACT`.
4. D4 (1–2 days) — capability + marker tables. Migration plus reads.
5. D5 (real design work) — L4 chapter ledger restructure. Behind
   `FEATURE_L4_CHAPTER_LEDGER`. Sailor + nurse first; entrepreneur
   gets the same shell but needs D7 + D9 to feel complete.
6. D6 → D7 → D8 → D9 → D10 — interest-pacing dependent.

## Open Questions

- D4 → D5 ordering: ship D5's chrome first (still using current
  data) or wait for D4's primitives? Leaning toward ship D5 chrome
  first behind flag with placeholder data, then back-fill from D4
  once primitives land.
- D6 anchor calendars: build vs partner. HKDA race calendar may be
  iCal-importable; JHU academic calendar typically is; haat-day
  data probably needs hand-curation.
- D8 stakeholder views: is this a Phase D move or its own phase?
  Argument for separating: the permission model touches a lot of
  surfaces.

## File References

- L2 view: [components/ios-register/timeline-zoom/L2WeekView.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/L2WeekView.tsx)
- L3 view: [components/ios-register/timeline-zoom/L3SeasonView.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/L3SeasonView.tsx)
- L4 view: [components/ios-register/timeline-zoom/L4YearsView.tsx](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/L4YearsView.tsx)
- Adapter that translates DB rows to the zoom canvas types:
  [components/ios-register/timeline-zoom/realDataAdapter.ts](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/realDataAdapter.ts)
- Capability palette that leaks across personas:
  [components/ios-register/timeline-zoom/sampleData.ts](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/sampleData.ts) (line 20+)
- Existing vocab helper:
  [components/ios-register/timeline-zoom/interestVocab.ts](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/timeline-zoom/interestVocab.ts)
- Related canonical: [docs/redesign/ios-register/practice-timeline-canonical.html](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/ios-register/practice-timeline-canonical.html)
- Related canonical: [docs/redesign/ios-register/zoomed-out-view-canonical.html](/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/ios-register/zoomed-out-view-canonical.html)
- Prior interest-vernacular memory: project_interest_vernacular_personas.md

## Memory Hooks

The following memory entries directly inform this spec:

- `project_interest_vernacular_personas.md` — the original
  observation that generic words read as tracker-app, not
  tool-for-this-craft.
- `project_season_is_persona_vocab.md` — *Season* and the calendar
  dates are the same concept in different vocab. Collapse to one
  primary persona-native label with dates demoted.
- `feedback_vocab_merge_not_either_or.md` — when merging vocab
  fallback with fetched, spread merge, don't `fetched ?? fallback`
  (which leaks universal literals when DB rows lack a key the
  codebase added).

## End of Phase D Spec

If we ship Bets D1–D5 the experience for sailor + nurse + entrepreneur
materially improves and the architectural foundation for D6–D10 is in
place. Anything past D5 is interest-pacing work, not architecture.
