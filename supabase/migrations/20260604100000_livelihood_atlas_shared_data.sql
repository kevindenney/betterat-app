-- Livelihood Atlas shared data layer.
--
-- #29 (the didi-facing Ranchi entrepreneur Atlas) writes the haat ledger here.
-- #30 (CRP/Sakhi/CLF mentor and org vantage points) reads the same SHG->VO->CLF
-- hierarchy, haat cadence, scheme catalog, and logged sales/savings evidence.

CREATE TABLE IF NOT EXISTS public.livelihood_org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.livelihood_org_units(id) ON DELETE SET NULL,
  unit_type text NOT NULL CHECK (unit_type IN ('shg', 'vo', 'clf')),
  name text NOT NULL,
  local_name text,
  village text,
  block text,
  district text,
  lat double precision,
  lng double precision,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livelihood_org_units_org_type
  ON public.livelihood_org_units(organization_id, unit_type);
CREATE INDEX IF NOT EXISTS idx_livelihood_org_units_parent
  ON public.livelihood_org_units(parent_id);

CREATE TABLE IF NOT EXISTS public.livelihood_user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shg_unit_id uuid REFERENCES public.livelihood_org_units(id) ON DELETE SET NULL,
  enterprise_kind text,
  primary_craft text,
  annual_goal_minor bigint NOT NULL DEFAULT 10000000 CHECK (annual_goal_minor >= 0),
  currency text NOT NULL DEFAULT 'INR',
  home_poi_id uuid REFERENCES public.atlas_pois(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livelihood_user_profiles_shg
  ON public.livelihood_user_profiles(shg_unit_id);

CREATE TABLE IF NOT EXISTS public.haat_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_unit_id uuid REFERENCES public.livelihood_org_units(id) ON DELETE SET NULL,
  atlas_poi_id uuid REFERENCES public.atlas_pois(id) ON DELETE SET NULL,
  name text NOT NULL,
  local_name text,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at_local time,
  lat double precision,
  lng double precision,
  distance_km numeric(6,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_haat_calendars_org_day
  ON public.haat_calendars(organization_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_haat_calendars_poi
  ON public.haat_calendars(atlas_poi_id);

CREATE TABLE IF NOT EXISTS public.scheme_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  provider text,
  scheme_type text NOT NULL DEFAULT 'livelihood'
    CHECK (scheme_type IN ('livelihood', 'credit', 'subsidy', 'license', 'training', 'digital')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_scheme_catalog_org_type
  ON public.scheme_catalog(organization_id, scheme_type);

CREATE TABLE IF NOT EXISTS public.livelihood_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timeline_step_id uuid REFERENCES public.timeline_steps(id) ON DELETE SET NULL,
  haat_calendar_id uuid REFERENCES public.haat_calendars(id) ON DELETE SET NULL,
  org_unit_id uuid REFERENCES public.livelihood_org_units(id) ON DELETE SET NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  units_sold integer NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
  revenue_minor bigint NOT NULL DEFAULT 0 CHECK (revenue_minor >= 0),
  savings_minor bigint NOT NULL DEFAULT 0 CHECK (savings_minor >= 0),
  expenses_minor bigint NOT NULL DEFAULT 0 CHECK (expenses_minor >= 0),
  customer_count integer NOT NULL DEFAULT 0 CHECK (customer_count >= 0),
  repeat_count integer NOT NULL DEFAULT 0 CHECK (repeat_count >= 0),
  currency text NOT NULL DEFAULT 'INR',
  capability_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  scheme_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  evidence_note text,
  voice_note_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT livelihood_ledger_repeat_le_customer CHECK (repeat_count <= customer_count)
);

CREATE TABLE IF NOT EXISTS public.livelihood_money_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ledger_entry_id uuid REFERENCES public.livelihood_ledger_entries(id) ON DELETE CASCADE,
  timeline_step_id uuid REFERENCES public.timeline_steps(id) ON DELETE SET NULL,
  haat_calendar_id uuid REFERENCES public.haat_calendars(id) ON DELETE SET NULL,
  org_unit_id uuid REFERENCES public.livelihood_org_units(id) ON DELETE SET NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_kind text NOT NULL CHECK (
    entry_kind IN ('sale', 'expense', 'savings_deposit', 'loan_repayment', 'stock_return')
  ),
  product_name text,
  quantity numeric(10,2) CHECK (quantity IS NULL OR quantity >= 0),
  unit_label text,
  unit_price_minor bigint CHECK (unit_price_minor IS NULL OR unit_price_minor >= 0),
  amount_minor bigint NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  payment_channel text NOT NULL DEFAULT 'unknown'
    CHECK (payment_channel IN ('cash', 'upi', 'mixed', 'credit', 'unknown')),
  currency text NOT NULL DEFAULT 'INR',
  counterparty text,
  source_text text,
  is_voice_parsed boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livelihood_ledger_user_date
  ON public.livelihood_ledger_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_livelihood_ledger_haat_date
  ON public.livelihood_ledger_entries(haat_calendar_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_livelihood_ledger_org_unit_date
  ON public.livelihood_ledger_entries(org_unit_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_livelihood_money_user_date
  ON public.livelihood_money_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_livelihood_money_ledger
  ON public.livelihood_money_entries(ledger_entry_id);
CREATE INDEX IF NOT EXISTS idx_livelihood_money_haat_kind_date
  ON public.livelihood_money_entries(haat_calendar_id, entry_kind, entry_date DESC);

ALTER TABLE public.livelihood_org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livelihood_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haat_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livelihood_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livelihood_money_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS livelihood_org_units_authenticated_read ON public.livelihood_org_units;
CREATE POLICY livelihood_org_units_authenticated_read
  ON public.livelihood_org_units FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS livelihood_org_units_org_admin_all ON public.livelihood_org_units;
CREATE POLICY livelihood_org_units_org_admin_all
  ON public.livelihood_org_units FOR ALL
  USING (public.has_org_role(organization_id, ARRAY['owner','admin','manager','coordinator']::text[]))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','manager','coordinator']::text[]));

DROP POLICY IF EXISTS livelihood_user_profiles_self_all ON public.livelihood_user_profiles;
CREATE POLICY livelihood_user_profiles_self_all
  ON public.livelihood_user_profiles FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS livelihood_user_profiles_org_mentor_read ON public.livelihood_user_profiles;
CREATE POLICY livelihood_user_profiles_org_mentor_read
  ON public.livelihood_user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.livelihood_org_units u
      WHERE u.id = livelihood_user_profiles.shg_unit_id
        AND public.has_org_role(
          u.organization_id,
          ARRAY['owner','admin','manager','coordinator','coach','staff','faculty','preceptor']::text[]
        )
    )
  );

DROP POLICY IF EXISTS haat_calendars_authenticated_read ON public.haat_calendars;
CREATE POLICY haat_calendars_authenticated_read
  ON public.haat_calendars FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS haat_calendars_org_admin_all ON public.haat_calendars;
CREATE POLICY haat_calendars_org_admin_all
  ON public.haat_calendars FOR ALL
  USING (organization_id IS NOT NULL AND public.has_org_role(organization_id, ARRAY['owner','admin','manager','coordinator']::text[]))
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_role(organization_id, ARRAY['owner','admin','manager','coordinator']::text[]));

DROP POLICY IF EXISTS scheme_catalog_authenticated_read ON public.scheme_catalog;
CREATE POLICY scheme_catalog_authenticated_read
  ON public.scheme_catalog FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS scheme_catalog_org_admin_all ON public.scheme_catalog;
CREATE POLICY scheme_catalog_org_admin_all
  ON public.scheme_catalog FOR ALL
  USING (organization_id IS NOT NULL AND public.has_org_role(organization_id, ARRAY['owner','admin','manager','coordinator']::text[]))
  WITH CHECK (organization_id IS NOT NULL AND public.has_org_role(organization_id, ARRAY['owner','admin','manager','coordinator']::text[]));

DROP POLICY IF EXISTS livelihood_ledger_self_all ON public.livelihood_ledger_entries;
CREATE POLICY livelihood_ledger_self_all
  ON public.livelihood_ledger_entries FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS livelihood_ledger_org_mentor_read ON public.livelihood_ledger_entries;
CREATE POLICY livelihood_ledger_org_mentor_read
  ON public.livelihood_ledger_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.livelihood_org_units u
      WHERE u.id = livelihood_ledger_entries.org_unit_id
        AND public.has_org_role(
          u.organization_id,
          ARRAY['owner','admin','manager','coordinator','coach','staff','faculty','preceptor']::text[]
        )
    )
  );

DROP POLICY IF EXISTS livelihood_money_self_all ON public.livelihood_money_entries;
CREATE POLICY livelihood_money_self_all
  ON public.livelihood_money_entries FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS livelihood_money_org_mentor_read ON public.livelihood_money_entries;
CREATE POLICY livelihood_money_org_mentor_read
  ON public.livelihood_money_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.livelihood_org_units u
      WHERE u.id = livelihood_money_entries.org_unit_id
        AND public.has_org_role(
          u.organization_id,
          ARRAY['owner','admin','manager','coordinator','coach','staff','faculty','preceptor']::text[]
        )
    )
  );

CREATE OR REPLACE FUNCTION public.touch_livelihood_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_livelihood_org_units_updated_at ON public.livelihood_org_units;
CREATE TRIGGER trigger_livelihood_org_units_updated_at
  BEFORE UPDATE ON public.livelihood_org_units
  FOR EACH ROW EXECUTE FUNCTION public.touch_livelihood_updated_at();

DROP TRIGGER IF EXISTS trigger_livelihood_user_profiles_updated_at ON public.livelihood_user_profiles;
CREATE TRIGGER trigger_livelihood_user_profiles_updated_at
  BEFORE UPDATE ON public.livelihood_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_livelihood_updated_at();

DROP TRIGGER IF EXISTS trigger_haat_calendars_updated_at ON public.haat_calendars;
CREATE TRIGGER trigger_haat_calendars_updated_at
  BEFORE UPDATE ON public.haat_calendars
  FOR EACH ROW EXECUTE FUNCTION public.touch_livelihood_updated_at();

DROP TRIGGER IF EXISTS trigger_scheme_catalog_updated_at ON public.scheme_catalog;
CREATE TRIGGER trigger_scheme_catalog_updated_at
  BEFORE UPDATE ON public.scheme_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_livelihood_updated_at();

DROP TRIGGER IF EXISTS trigger_livelihood_ledger_updated_at ON public.livelihood_ledger_entries;
CREATE TRIGGER trigger_livelihood_ledger_updated_at
  BEFORE UPDATE ON public.livelihood_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_livelihood_updated_at();

DROP TRIGGER IF EXISTS trigger_livelihood_money_updated_at ON public.livelihood_money_entries;
CREATE TRIGGER trigger_livelihood_money_updated_at
  BEFORE UPDATE ON public.livelihood_money_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_livelihood_updated_at();

COMMENT ON TABLE public.livelihood_org_units IS
  'Shared SHG->VO->CLF hierarchy for rural livelihood Atlas frames.';
COMMENT ON TABLE public.haat_calendars IS
  'Recurring weekly haat schedule used by didi market prep and mentor cadence views.';
COMMENT ON TABLE public.livelihood_ledger_entries IS
  'Per-haat sales, savings, scheme, and capability evidence logged by the entrepreneur; mentor/org rollups consume this table.';
COMMENT ON TABLE public.livelihood_money_entries IS
  'Line-level money evidence parsed from didi entry surfaces: sale, expense, savings, loan repayment, and stock return rows under a haat ledger close-out.';

-- Demo seed for the Ranchi/Khunti entrepreneur Atlas. Idempotent and guarded:
-- if the PRADAN demo org or Savitri auth user is absent, the seed simply skips
-- those rows and the app falls back to curated POIs.
WITH org AS (
  SELECT id FROM public.organizations WHERE slug = 'pradan-khunti' LIMIT 1
)
INSERT INTO public.livelihood_org_units (
  id, organization_id, parent_id, unit_type, name, local_name, village, block, district, lat, lng, metadata
)
SELECT *
FROM (
  SELECT
    '78000000-0001-4000-8000-000000000001'::uuid,
    org.id,
    NULL::uuid,
    'clf',
    'Ratu CLF',
    'CLF रातू',
    NULL,
    'Ratu',
    'Ranchi',
    23.422,
    85.220,
    '{"federation":"JSLPS / DAY-NRLM"}'::jsonb
  FROM org
  UNION ALL
  SELECT
    '78000000-0002-4000-8000-000000000002'::uuid,
    org.id,
    '78000000-0001-4000-8000-000000000001'::uuid,
    'vo',
    'Ormanjhi VO',
    'ओरमांझी VO',
    NULL,
    'Ormanjhi',
    'Ranchi',
    23.431,
    85.545,
    '{}'::jsonb
  FROM org
  UNION ALL
  SELECT
    '78000000-0003-4000-8000-000000000003'::uuid,
    org.id,
    '78000000-0002-4000-8000-000000000002'::uuid,
    'shg',
    'Saraswati Sakhi Mandal',
    'सरस्वती सखी मंडल',
    'Bero',
    'Bero',
    'Ranchi',
    23.446,
    85.084,
    '{"members":12,"cadence":"weekly"}'::jsonb
  FROM org
) AS rows(id, organization_id, parent_id, unit_type, name, local_name, village, block, district, lat, lng, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM public.livelihood_org_units u WHERE u.id = rows.id
);

WITH org AS (
  SELECT id FROM public.organizations WHERE slug = 'pradan-khunti' LIMIT 1
),
haats AS (
  SELECT * FROM (VALUES
    ('Bero haat', 'बेरो हाट', 1, '06:30'::time, 23.4500::double precision, 85.0700::double precision, 6.0::numeric, 'Bero haat · बेरो हाट'),
    ('Khunti haat', 'खूंटी हाट', 3, '07:00'::time, 23.0750::double precision, 85.2792::double precision, 11.0::numeric, 'Khunti haat · खुनी हाट'),
    ('Bundu haat', 'बुंडू हाट', 2, '07:00'::time, 23.1770::double precision, 85.5900::double precision, 8.0::numeric, NULL)
  ) AS h(name, local_name, day_of_week, starts_at_local, lat, lng, distance_km, poi_name)
)
INSERT INTO public.haat_calendars (
  organization_id, org_unit_id, atlas_poi_id, name, local_name, day_of_week,
  starts_at_local, lat, lng, distance_km, metadata
)
SELECT
  org.id,
  '78000000-0003-4000-8000-000000000003'::uuid,
  p.id,
  h.name,
  h.local_name,
  h.day_of_week,
  h.starts_at_local,
  h.lat,
  h.lng,
  h.distance_km,
  jsonb_build_object('market_kind', 'weekly_haat')
FROM org
CROSS JOIN haats h
LEFT JOIN public.atlas_pois p ON p.name = h.poi_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.haat_calendars existing
  WHERE existing.organization_id = org.id
    AND existing.name = h.name
);

WITH org AS (
  SELECT id FROM public.organizations WHERE slug = 'pradan-khunti' LIMIT 1
)
INSERT INTO public.scheme_catalog (organization_id, slug, name, provider, scheme_type, metadata)
SELECT org.id, s.slug, s.name, s.provider, s.scheme_type, s.metadata
FROM org
CROSS JOIN (VALUES
  ('lakhpati-didi', 'Lakhpati Didi pathway', 'JSLPS / DAY-NRLM', 'livelihood', '{"annual_goal_minor":10000000}'::jsonb),
  ('pmfme-food-processing', 'PMFME food-processing subsidy', 'MoFPI / JSLPS', 'subsidy', '{"use":"sealing machine, packaging, food processing"}'::jsonb),
  ('mudra-shishu', 'MUDRA Shishu loan', 'Bank / MUDRA', 'credit', '{"limit_minor":5000000}'::jsonb),
  ('fssai-basic', 'FSSAI basic registration', 'FSSAI', 'license', '{"use":"pickle and packaged food sales"}'::jsonb),
  ('upi-whatsapp-catalog', 'UPI + WhatsApp catalog', 'Digital Sakhi', 'digital', '{"use":"digital payments and repeat customer list"}'::jsonb)
) AS s(slug, name, provider, scheme_type, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM public.scheme_catalog existing
  WHERE existing.organization_id = org.id
    AND existing.slug = s.slug
);

INSERT INTO public.livelihood_user_profiles (
  user_id, shg_unit_id, enterprise_kind, primary_craft, annual_goal_minor, currency, home_poi_id, metadata
)
SELECT
  au.id,
  '78000000-0003-4000-8000-000000000003'::uuid,
  'home_food_processing',
  'achar / papad',
  10000000,
  'INR',
  p.id,
  '{"persona":"Savitri Devi Munda","mentor":"Suman","shared_phone":true}'::jsonb
FROM auth.users au
LEFT JOIN public.atlas_pois p ON p.name = 'Lakshmi · home'
WHERE au.email = 'demo-savitri@betterat.app'
  AND EXISTS (SELECT 1 FROM public.livelihood_org_units WHERE id = '78000000-0003-4000-8000-000000000003'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.livelihood_user_profiles existing WHERE existing.user_id = au.id
  );
