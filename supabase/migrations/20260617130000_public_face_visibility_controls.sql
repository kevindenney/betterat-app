-- Per-section and per-interaction public-face visibility controls.
--
-- Layered on top of the existing privacy model (profile_public account gate +
-- per-step crew/fleet/public visibility). Section flags decide whether a
-- section *appears at all*; per-step visibility still decides which rows fill a
-- visible section. Interaction flags gate the public-face CTAs.
--
-- See docs/redesign/specs/PUBLIC_FACE_VISIBILITY_CONTROLS_SPEC.md.
--
-- Defaults: conservative-but-useful. The two `false` defaults
-- (show_practice_circle, show_orgs) *tighten* existing public profiles — this
-- intentionally closes the un-gated practice-circle leak in
-- get_person_public_face and keeps affiliation opt-in. Defaults apply to every
-- existing row, so no backfill is needed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_framing               boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_working_on_now        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_capabilities          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_practice_timeline      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_practice_circle        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_orgs                   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_published_blueprints   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_events                 boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_follow                boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_message               boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_suggest_step          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_reflect               boolean NOT NULL DEFAULT true;
