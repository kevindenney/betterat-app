-- Personal saved places ("Home", "Club", custom spots) for one-tap step
-- locations. Owner-only by design: atlas_pois is anon-readable, so a
-- user's home address must never live there. These rows surface only in
-- the owner's own Where-card quick picks and Atlas search.

CREATE TABLE public.user_saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  interest_slug text,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'custom' CHECK (kind IN ('home', 'club', 'custom')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  place_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_saved_places_user_idx ON public.user_saved_places (user_id);

ALTER TABLE public.user_saved_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read own saved places"
  ON public.user_saved_places FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Owner can insert own saved places"
  ON public.user_saved_places FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Owner can update own saved places"
  ON public.user_saved_places FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Owner can delete own saved places"
  ON public.user_saved_places FOR DELETE
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.user_saved_places FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_places TO authenticated;
