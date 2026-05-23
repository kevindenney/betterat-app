-- Seed JHSON blueprints catalog so the Admin · Blueprints list renders
-- real rows. Run AFTER 20260523180000_phase_4g_blueprints_catalog.sql.

INSERT INTO public.blueprints (org_id, author_user_id, title, slug, category, version, status, step_count, description, last_edited_at, published_at)
VALUES
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f',
    'Sepsis bundle recognition', 'sepsis-bundle', 'reasoning',
    'v0.4 draft', 'draft', 6,
    'Recognize SIRS criteria and initiate sepsis bundle within 1 hour.',
    now() - interval '4 hours', NULL),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f',
    'IV insertion · supervised', 'iv-supervised', 'procedural',
    'v2.1 live', 'live', 4,
    'Place a peripheral IV with supervising preceptor present. First five attempts must be supervised.',
    now() - interval '7 days', now() - interval '70 days'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f',
    'Medication administration', 'med-admin', 'procedural',
    'v1.3 live', 'live', 5,
    'Five rights of medication administration in real clinical setting.',
    now() - interval '14 days', now() - interval '90 days'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f',
    'Head-to-toe assessment', 'h2t', 'assessment',
    'v3.0 live', 'live', 8,
    'Complete head-to-toe physical assessment on a patient and document findings.',
    now() - interval '30 days', now() - interval '120 days'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f',
    'ISBAR handoff communication', 'isbar', 'communication',
    'v1.4 live', 'live', 3,
    'Lead a shift handoff using ISBAR framework. Mentor-reviewed.',
    now() - interval '40 days', now() - interval '150 days'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f',
    'Discharge teach-back', 'teach-back', 'communication',
    'v1.0 review', 'review', 5,
    'Conduct discharge teach-back using plain-language method; verify patient understanding.',
    now() - interval '21 days', NULL),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f',
    'Foley catheter placement', 'foley', 'procedural',
    'v2.0 live', 'live', 4,
    'Insert indwelling urinary catheter using sterile technique.',
    now() - interval '50 days', now() - interval '95 days')
ON CONFLICT (org_id, slug) DO NOTHING;

INSERT INTO public.blueprint_cohorts (blueprint_id, cohort_id)
SELECT b.id, 'aac74235-1712-f6e5-b006-11e74e6e0c1b'
FROM public.blueprints b
WHERE b.org_id = '678e149e-2abb-422c-ac61-b76756a2150e'
  AND b.status IN ('live','draft')
ON CONFLICT DO NOTHING;
