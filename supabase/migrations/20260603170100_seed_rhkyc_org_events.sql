-- Seed a few RHKYC org-published located events so the Atlas → Nearby
-- "From your organizations" section (atlas_org_steps_near) has something to
-- render. These are demo data of the same class as seed:rhkyc — public,
-- exact-located steps authored by an RHKYC admin and tagged with the org so
-- they carry provenance. Idempotent: guarded by title + org so a re-run / db
-- reset doesn't duplicate them.
--
-- Author is RHKYC admin 51241049 (not the sim viewer) so the rows read as
-- "from RHKYC," not the viewer's own steps. step_location triggers inherit
-- location_audience='public' + interest_slug='sail-racing' from the step.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

DO $$
DECLARE
  v_org    uuid := 'a1000001-0000-0000-0000-000000000001'; -- Royal Hong Kong Yacht Club
  v_author uuid := '51241049-02ed-4e31-b8c6-39af7c9d4d50'; -- an RHKYC admin
  v_interest uuid := '5e6b64c3-ea92-42a1-baf5-9342c53eb7d9'; -- sail-racing
  v_step uuid;
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('Dragon Saturday Series — Race Briefing',
       'Pre-race briefing + start-line strategy. Open to all RHKYC keelboat members.',
       '82a002b9-4dd3-4b5b-8744-2ea7c43551af'::uuid, -- Keelboat Skipper blueprint
       22.2850::numeric, 114.1822::numeric, 'Kellett Island Clubhouse'),
      ('Learn to Sail — Dinghy Intro',
       'Hands-on dinghy taster session for newcomers. Boats + buoyancy aids provided.',
       'b7cbb469-d06a-4bc9-beb5-f2674c1e3856'::uuid, -- Dinghy Pathway blueprint
       22.2378::numeric, 114.1853::numeric, 'Middle Island Station'),
      ('Youth Academy — Race Coaching',
       'On-water coaching for the youth squad. Rib support + video debrief ashore.',
       'e5aa9171-20a0-439f-95ad-4ecb239b95d3'::uuid, -- Youth Academy blueprint
       22.3640::numeric, 114.2710::numeric, 'Shelter Cove Station')
    ) AS t(title, descr, blueprint_id, lat, lng, place_name)
  LOOP
    -- Skip if this org already has an event with this title.
    IF EXISTS (
      SELECT 1 FROM public.timeline_steps ts
      WHERE ts.organization_id = v_org AND ts.title = r.title
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.timeline_steps
      (user_id, organization_id, source_type, source_blueprint_id, interest_id,
       visibility, status, is_race, title, description)
    VALUES
      (v_author, v_org, 'blueprint', r.blueprint_id, v_interest,
       'public', 'pending', false, r.title, r.descr)
    RETURNING id INTO v_step;

    INSERT INTO public.step_location
      (step_id, lat, lng, name, set_by, location_precision)
    VALUES
      (v_step, r.lat, r.lng, r.place_name, v_author, 'exact');
  END LOOP;
END $$;
