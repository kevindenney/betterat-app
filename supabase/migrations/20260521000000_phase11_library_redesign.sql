-- Phase 11 · Library redesign
-- Adds tables for Library tab redesign (D21–D40).
-- See docs/redesign/ios-register/library-codex-brief.md
--
-- Skipped (already exist with compatible schema):
--   step_concept_links, step_discussions (uses user_id/parent_id), step_deck
--
-- This migration is additive only — no drops, no destructive ALTERs.

-- ============================================================================
-- §1 · Plans (Library "Plans" zone)
-- ============================================================================

-- plan_subscriptions · "I follow this plan in Library" relationship.
-- Distinct from blueprint_subscriptions (which is Stripe-payment scoped).
CREATE TABLE IF NOT EXISTS public.plan_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id       uuid NOT NULL,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done','left')),
  source_type   text,
  UNIQUE (user_id, plan_id)
);
CREATE INDEX IF NOT EXISTS plan_subscriptions_plan_id_idx ON public.plan_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS plan_subscriptions_user_id_idx ON public.plan_subscriptions(user_id);

ALTER TABLE public.plan_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_subscriptions_owner_rw ON public.plan_subscriptions;
CREATE POLICY plan_subscriptions_owner_rw ON public.plan_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- Anyone subscribed to a plan can see other subscribers of the same plan.
DROP POLICY IF EXISTS plan_subscriptions_peer_read ON public.plan_subscriptions;
CREATE POLICY plan_subscriptions_peer_read ON public.plan_subscriptions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.plan_subscriptions ps
    WHERE ps.plan_id = plan_subscriptions.plan_id AND ps.user_id = auth.uid()
  ));

-- plan_resources · materials bundled by a coach into a plan, auto-surfaced
-- to subscribers' Library/Resources zone.
CREATE TABLE IF NOT EXISTS public.plan_resources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id        uuid NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('article','video','drill','book','audio','link','pdf')),
  title          text NOT NULL,
  url            text,
  linked_step_id uuid,
  duration_min   integer,
  position       integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_resources_plan_id_idx ON public.plan_resources(plan_id);

ALTER TABLE public.plan_resources ENABLE ROW LEVEL SECURITY;
-- Subscribers (incl. plan owners via plan_subscriptions) can read; only
-- service role writes for now (coach UI lands later).
DROP POLICY IF EXISTS plan_resources_subscriber_read ON public.plan_resources;
CREATE POLICY plan_resources_subscriber_read ON public.plan_resources
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.plan_subscriptions ps
    WHERE ps.plan_id = plan_resources.plan_id AND ps.user_id = auth.uid()
  ));

-- ============================================================================
-- §2 · Personal library items (Emily's catalog · D36–D40)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('article','video','book','audio','link','pdf','image','note')),
  title            text NOT NULL,
  source_label     text,
  url_or_blob_id   text,
  year             integer,
  page_count       integer,
  duration_min     integer,
  captured_at      timestamptz NOT NULL DEFAULT now(),
  read_at          timestamptz,
  last_used_at     timestamptz
);
CREATE INDEX IF NOT EXISTS library_items_user_id_idx ON public.library_items(user_id);
CREATE INDEX IF NOT EXISTS library_items_captured_at_idx ON public.library_items(captured_at DESC);

ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_items_owner_rw ON public.library_items;
CREATE POLICY library_items_owner_rw ON public.library_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.library_collections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  ai_suggested  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS library_collections_user_id_idx ON public.library_collections(user_id);

ALTER TABLE public.library_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_collections_owner_rw ON public.library_collections;
CREATE POLICY library_collections_owner_rw ON public.library_collections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.library_item_collections (
  item_id       uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.library_collections(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, collection_id)
);
CREATE INDEX IF NOT EXISTS library_item_collections_collection_idx ON public.library_item_collections(collection_id);

ALTER TABLE public.library_item_collections ENABLE ROW LEVEL SECURITY;
-- Via item ownership (both item + collection must belong to same user).
DROP POLICY IF EXISTS library_item_collections_owner_rw ON public.library_item_collections;
CREATE POLICY library_item_collections_owner_rw ON public.library_item_collections
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = library_item_collections.item_id AND li.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = library_item_collections.item_id AND li.user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS public.library_item_topics (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id   uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  topic_tag text NOT NULL,
  UNIQUE (item_id, topic_tag)
);
CREATE INDEX IF NOT EXISTS library_item_topics_tag_idx ON public.library_item_topics(topic_tag);

ALTER TABLE public.library_item_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS library_item_topics_owner_rw ON public.library_item_topics;
CREATE POLICY library_item_topics_owner_rw ON public.library_item_topics
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = library_item_topics.item_id AND li.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = library_item_topics.item_id AND li.user_id = auth.uid()
  ));

-- ============================================================================
-- §3 · Concept ↔ library back-references (D36, D39)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.concept_origins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id      uuid NOT NULL REFERENCES public.playbook_concepts(id) ON DELETE CASCADE,
  library_item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  quote_text      text,
  quote_page      integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS concept_origins_concept_idx ON public.concept_origins(concept_id);
CREATE INDEX IF NOT EXISTS concept_origins_item_idx ON public.concept_origins(library_item_id);

ALTER TABLE public.concept_origins ENABLE ROW LEVEL SECURITY;
-- Concept owner can manage.
DROP POLICY IF EXISTS concept_origins_owner_rw ON public.concept_origins;
CREATE POLICY concept_origins_owner_rw ON public.concept_origins
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playbook_concepts c
    WHERE c.id = concept_origins.concept_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playbook_concepts c
    WHERE c.id = concept_origins.concept_id AND c.user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS public.concept_citations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id      uuid NOT NULL REFERENCES public.playbook_concepts(id) ON DELETE CASCADE,
  library_item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  context         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS concept_citations_concept_idx ON public.concept_citations(concept_id);
CREATE INDEX IF NOT EXISTS concept_citations_item_idx ON public.concept_citations(library_item_id);

ALTER TABLE public.concept_citations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concept_citations_owner_rw ON public.concept_citations;
CREATE POLICY concept_citations_owner_rw ON public.concept_citations
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.playbook_concepts c
    WHERE c.id = concept_citations.concept_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.playbook_concepts c
    WHERE c.id = concept_citations.concept_id AND c.user_id = auth.uid()
  ));

-- ============================================================================
-- §4 · Step ↔ library hooks (D37)
-- ============================================================================

-- step_library_before · "Before the shift" checklist on a step's Plan tab.
-- step_id is a logical reference (timeline_steps / betterat_timeline_steps);
-- no FK enforced because the canonical step table is still consolidating.
CREATE TABLE IF NOT EXISTS public.step_library_before (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id         uuid NOT NULL,
  library_item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  position        integer NOT NULL DEFAULT 0,
  read_at         timestamptz,
  added_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (step_id, library_item_id)
);
CREATE INDEX IF NOT EXISTS step_library_before_step_idx ON public.step_library_before(step_id);

ALTER TABLE public.step_library_before ENABLE ROW LEVEL SECURITY;
-- Author of the row (added_by) OR item owner manages; readers TBD via step-share.
DROP POLICY IF EXISTS step_library_before_rw ON public.step_library_before;
CREATE POLICY step_library_before_rw ON public.step_library_before
  FOR ALL TO authenticated
  USING (added_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = step_library_before.library_item_id AND li.user_id = auth.uid()
  ))
  WITH CHECK (added_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = step_library_before.library_item_id AND li.user_id = auth.uid()
  ));

-- step_beat_pins · inline pinned references inside Do/beat content.
CREATE TABLE IF NOT EXISTS public.step_beat_pins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id         uuid NOT NULL,
  beat_id         uuid,
  library_item_id uuid NOT NULL REFERENCES public.library_items(id) ON DELETE CASCADE,
  pin_label       text,
  added_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS step_beat_pins_step_idx ON public.step_beat_pins(step_id);

ALTER TABLE public.step_beat_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS step_beat_pins_rw ON public.step_beat_pins;
CREATE POLICY step_beat_pins_rw ON public.step_beat_pins
  FOR ALL TO authenticated
  USING (added_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = step_beat_pins.library_item_id AND li.user_id = auth.uid()
  ))
  WITH CHECK (added_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.library_items li
    WHERE li.id = step_beat_pins.library_item_id AND li.user_id = auth.uid()
  ));

-- ============================================================================
-- §5 · Step-level new tables (D33, D34)
-- ============================================================================

-- step_resource_links · D34 sub-step Resource-link chip target.
-- Distinct from polymorphic step_playbook_links — this one is specifically
-- about new library_items + plan_resources.
CREATE TABLE IF NOT EXISTS public.step_resource_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id         uuid NOT NULL,
  resource_kind   text NOT NULL CHECK (resource_kind IN ('library_item','plan_resource')),
  resource_id     uuid NOT NULL,
  linked_at       timestamptz NOT NULL DEFAULT now(),
  linked_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (step_id, resource_kind, resource_id)
);
CREATE INDEX IF NOT EXISTS step_resource_links_step_idx ON public.step_resource_links(step_id);

ALTER TABLE public.step_resource_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS step_resource_links_rw ON public.step_resource_links;
CREATE POLICY step_resource_links_rw ON public.step_resource_links
  FOR ALL TO authenticated
  USING (linked_by = auth.uid() OR linked_by IS NULL)
  WITH CHECK (linked_by = auth.uid());

-- step_collaborators · D33 "With" field membership.
CREATE TABLE IF NOT EXISTS public.step_collaborators (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id   uuid NOT NULL,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'collaborator' CHECK (role IN ('collaborator','helm','crew','foredeck','coach','mentor','other')),
  added_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (step_id, user_id)
);
CREATE INDEX IF NOT EXISTS step_collaborators_step_idx ON public.step_collaborators(step_id);
CREATE INDEX IF NOT EXISTS step_collaborators_user_idx ON public.step_collaborators(user_id);

ALTER TABLE public.step_collaborators ENABLE ROW LEVEL SECURITY;
-- Member OR adder can read; only adder can write.
DROP POLICY IF EXISTS step_collaborators_member_read ON public.step_collaborators;
CREATE POLICY step_collaborators_member_read ON public.step_collaborators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR added_by = auth.uid());
DROP POLICY IF EXISTS step_collaborators_adder_write ON public.step_collaborators;
CREATE POLICY step_collaborators_adder_write ON public.step_collaborators
  FOR ALL TO authenticated
  USING (added_by = auth.uid())
  WITH CHECK (added_by = auth.uid());

-- step_location · D33 "Where" + §10 map.
CREATE TABLE IF NOT EXISTS public.step_location (
  step_id    uuid PRIMARY KEY,
  lat        numeric(10,6),
  lng        numeric(10,6),
  name       text,
  address    text,
  set_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS step_location_geo_idx ON public.step_location(lat, lng);

ALTER TABLE public.step_location ENABLE ROW LEVEL SECURITY;
-- Anyone authenticated can read (peer map is public-among-followees); only setter writes.
DROP POLICY IF EXISTS step_location_authed_read ON public.step_location;
CREATE POLICY step_location_authed_read ON public.step_location
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS step_location_setter_write ON public.step_location;
CREATE POLICY step_location_setter_write ON public.step_location
  FOR ALL TO authenticated
  USING (set_by = auth.uid())
  WITH CHECK (set_by = auth.uid());

-- ============================================================================
-- §6 · Suggestions & inbox (D27, D30)
-- ============================================================================

-- step_suggestions · sender ⋮ → "Suggest to…" → recipient inbox.
CREATE TABLE IF NOT EXISTS public.step_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_step_id  uuid NOT NULL,
  message         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','adopted','saved','dismissed'))
);
CREATE INDEX IF NOT EXISTS step_suggestions_target_idx ON public.step_suggestions(target_user_id, status);
CREATE INDEX IF NOT EXISTS step_suggestions_source_idx ON public.step_suggestions(source_user_id);

ALTER TABLE public.step_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS step_suggestions_participants_read ON public.step_suggestions;
CREATE POLICY step_suggestions_participants_read ON public.step_suggestions
  FOR SELECT TO authenticated
  USING (source_user_id = auth.uid() OR target_user_id = auth.uid());
DROP POLICY IF EXISTS step_suggestions_sender_insert ON public.step_suggestions;
CREATE POLICY step_suggestions_sender_insert ON public.step_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (source_user_id = auth.uid());
DROP POLICY IF EXISTS step_suggestions_recipient_update ON public.step_suggestions;
CREATE POLICY step_suggestions_recipient_update ON public.step_suggestions
  FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid())
  WITH CHECK (target_user_id = auth.uid());

-- ============================================================================
-- §7 · Cross-interest mentor suggestions (Plan tab "Suggestions from your network")
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mentor_suggestions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggested_step_template  jsonb NOT NULL,
  source_interest_id       uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  dismissed_at             timestamptz
);
CREATE INDEX IF NOT EXISTS mentor_suggestions_target_idx ON public.mentor_suggestions(target_user_id) WHERE dismissed_at IS NULL;

ALTER TABLE public.mentor_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mentor_suggestions_target_read ON public.mentor_suggestions;
CREATE POLICY mentor_suggestions_target_read ON public.mentor_suggestions
  FOR SELECT TO authenticated
  USING (target_user_id = auth.uid() OR mentor_user_id = auth.uid());
DROP POLICY IF EXISTS mentor_suggestions_target_update ON public.mentor_suggestions;
CREATE POLICY mentor_suggestions_target_update ON public.mentor_suggestions
  FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid())
  WITH CHECK (target_user_id = auth.uid());

-- ============================================================================
-- §8 · Materialised-style views (start as regular views, swap to MV later)
-- ============================================================================

-- inbox_items · unified view over step_suggestions + step_deck for the
-- Practice Inbox. Plan-pushes will join in once that source exists.
CREATE OR REPLACE VIEW public.inbox_items AS
  SELECT
    s.id                     AS id,
    'suggestion'::text       AS kind,
    s.target_user_id         AS user_id,
    s.source_user_id         AS from_user_id,
    NULL::uuid               AS from_plan_id,
    s.source_step_id         AS step_id,
    s.message                AS body,
    s.status                 AS status,
    s.created_at             AS created_at
  FROM public.step_suggestions s
  WHERE s.status = 'pending'
UNION ALL
  SELECT
    d.id                     AS id,
    'on_deck'::text          AS kind,
    d.user_id                AS user_id,
    NULL::uuid               AS from_user_id,
    NULL::uuid               AS from_plan_id,
    d.source_id              AS step_id,
    d.body                   AS body,
    d.status                 AS status,
    d.added_at               AS created_at
  FROM public.step_deck d
  WHERE d.status = 'on_deck';

-- person_recent_activity · "last 1 settled step per followee" — populated in
-- Wave 2 once the canonical step state surface is locked. Empty stub for now.
CREATE OR REPLACE VIEW public.person_recent_activity AS
  SELECT
    NULL::uuid        AS user_id,
    NULL::uuid        AS following_id,
    NULL::uuid        AS step_id,
    NULL::text        AS step_title,
    NULL::timestamptz AS last_active_at
  WHERE FALSE;

COMMENT ON TABLE public.plan_subscriptions IS
  'Library "I follow this plan" relationship. Distinct from blueprint_subscriptions (Stripe-payment).';
COMMENT ON TABLE public.plan_resources IS
  'Materials a coach bundles into a plan. Auto-surfaced to subscribers'' Library/Resources zone.';
COMMENT ON TABLE public.library_items IS
  'Personal Library catalog (D36–D40, Emily nursing canonical Phone 1/2/4).';
COMMENT ON TABLE public.step_library_before IS
  'D37 "Before the shift" checklist on a step''s Plan tab.';
COMMENT ON TABLE public.step_beat_pins IS
  'D37 inline pinned library references inside Do/beat content.';
COMMENT ON TABLE public.step_suggestions IS
  'D30 step ⋮ → Suggest to… → recipient''s Practice Inbox.';
COMMENT ON VIEW public.inbox_items IS
  'Unified Practice Inbox source — suggestions + on-deck. Plan-pushes join in Wave 2.';
