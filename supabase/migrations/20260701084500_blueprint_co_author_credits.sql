-- Blueprint co-author credits.
--
-- The primary author stays on blueprints.author_user_id for compatibility with
-- existing marketplace/admin queries. Additional cover-credit authors live in
-- this join table and are restricted to org members for institutional
-- blueprints.

CREATE TABLE IF NOT EXISTS public.blueprint_authors (
  blueprint_id uuid NOT NULL REFERENCES public.blueprints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'co_author' CHECK (role IN ('co_author')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blueprint_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_blueprint_authors_user
  ON public.blueprint_authors(user_id);

ALTER TABLE public.blueprint_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blueprint_authors_read_v1 ON public.blueprint_authors;
CREATE POLICY blueprint_authors_read_v1 ON public.blueprint_authors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blueprints b
      WHERE b.id = blueprint_authors.blueprint_id
        AND (
          b.author_user_id = (SELECT auth.uid())
          OR blueprint_authors.user_id = (SELECT auth.uid())
          OR public.is_org_active_member(b.org_id)
        )
    )
  );

DROP POLICY IF EXISTS blueprint_authors_insert_v1 ON public.blueprint_authors;
CREATE POLICY blueprint_authors_insert_v1 ON public.blueprint_authors
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.blueprints b
      WHERE b.id = blueprint_authors.blueprint_id
        AND (
          b.author_user_id = (SELECT auth.uid())
          OR public.is_org_admin_member(b.org_id)
        )
        AND blueprint_authors.user_id IS DISTINCT FROM b.author_user_id
        AND (
          b.org_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.organization_memberships om
            WHERE om.organization_id = b.org_id
              AND om.user_id = blueprint_authors.user_id
              AND COALESCE(om.status, om.membership_status) = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS blueprint_authors_delete_v1 ON public.blueprint_authors;
CREATE POLICY blueprint_authors_delete_v1 ON public.blueprint_authors
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.blueprints b
      WHERE b.id = blueprint_authors.blueprint_id
        AND (
          b.author_user_id = (SELECT auth.uid())
          OR public.is_org_admin_member(b.org_id)
        )
    )
  );
