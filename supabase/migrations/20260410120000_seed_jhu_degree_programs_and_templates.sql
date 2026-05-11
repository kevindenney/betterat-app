-- =============================================================================
-- Seed: JHU School of Nursing degree programs, curriculum sessions,
--        timeline step templates, and Playbook baseline concepts
--
-- This migration populates the JHU org with realistic degree program data
-- for the Patrick Whitney / Dean demo.
--
-- Canonical ownership:
-- - Owns idempotent seed rows for programs, program_sessions,
--   timeline_step_templates, and playbook_concepts (nursing baselines).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Degree Programs
-- ─────────────────────────────────────────────────────────────────────────────

DO $outer$
DECLARE
  v_org_id uuid := '678e149e-2abb-422c-ac61-b76756a2150e'; -- JHU School of Nursing
  v_nursing_id uuid := 'bec249c5-6412-4d16-bb84-bfcfb887ff67'; -- nursing interest
  v_msn_id uuid;
  v_dnp_fnp_id uuid;
  v_dnp_pmhnp_id uuid;
  v_hol_id uuid;
BEGIN

-- MSN Entry into Nursing
INSERT INTO programs (organization_id, domain, title, description, type, status, metadata)
SELECT v_org_id, 'nursing',
  'MSN Entry into Nursing',
  'JHU''s pre-licensure pathway for career changers and second-degree students. 5 semesters, 1000+ clinical hours, 95% NCLEX pass rate.',
  'program', 'active',
  jsonb_build_object(
    'degree_type', 'MSN',
    'duration_semesters', 5,
    'clinical_hours', 1000,
    'nclex_pass_rate', 0.95,
    'program_path', 'msn-entry-into-nursing'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM programs WHERE organization_id = v_org_id AND title = 'MSN Entry into Nursing'
)
RETURNING id INTO v_msn_id;

-- If already existed, fetch the id
IF v_msn_id IS NULL THEN
  SELECT id INTO v_msn_id FROM programs
  WHERE organization_id = v_org_id AND title = 'MSN Entry into Nursing' LIMIT 1;
END IF;

-- DNP — Family NP
INSERT INTO programs (organization_id, domain, title, description, type, status, metadata)
SELECT v_org_id, 'nursing',
  'DNP — Family NP',
  'Doctor of Nursing Practice with Family Nurse Practitioner specialty. Prepares advanced practice nurses for primary care across the lifespan.',
  'program', 'active',
  jsonb_build_object(
    'degree_type', 'DNP',
    'specialty', 'Family NP',
    'duration_semesters', 7,
    'clinical_hours', 1500,
    'program_path', 'dnp-family-np'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM programs WHERE organization_id = v_org_id AND title = 'DNP — Family NP'
)
RETURNING id INTO v_dnp_fnp_id;

IF v_dnp_fnp_id IS NULL THEN
  SELECT id INTO v_dnp_fnp_id FROM programs
  WHERE organization_id = v_org_id AND title = 'DNP — Family NP' LIMIT 1;
END IF;

-- DNP — Psych Mental Health NP
INSERT INTO programs (organization_id, domain, title, description, type, status, metadata)
SELECT v_org_id, 'nursing',
  'DNP — Psych Mental Health NP',
  'Doctor of Nursing Practice with Psychiatric Mental Health NP specialty. Prepares advanced practice nurses for psychiatric assessment, psychopharmacology, and therapeutic interventions.',
  'program', 'active',
  jsonb_build_object(
    'degree_type', 'DNP',
    'specialty', 'PMHNP',
    'duration_semesters', 7,
    'clinical_hours', 1500,
    'program_path', 'dnp-psych-mental-health-np'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM programs WHERE organization_id = v_org_id AND title = 'DNP — Psych Mental Health NP'
)
RETURNING id INTO v_dnp_pmhnp_id;

IF v_dnp_pmhnp_id IS NULL THEN
  SELECT id INTO v_dnp_pmhnp_id FROM programs
  WHERE organization_id = v_org_id AND title = 'DNP — Psych Mental Health NP' LIMIT 1;
END IF;

-- Healthcare Organizational Leadership MSN
INSERT INTO programs (organization_id, domain, title, description, type, status, metadata)
SELECT v_org_id, 'nursing',
  'Healthcare Organizational Leadership MSN',
  'Prepares nurse leaders for executive roles in healthcare systems. Combines leadership theory, financial management, health policy, and practicum experience.',
  'program', 'active',
  jsonb_build_object(
    'degree_type', 'MSN',
    'specialty', 'Healthcare Organizational Leadership',
    'duration_semesters', 5,
    'practicum_hours', 504,
    'program_path', 'hol-msn'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM programs WHERE organization_id = v_org_id AND title = 'Healthcare Organizational Leadership MSN'
)
RETURNING id INTO v_hol_id;

IF v_hol_id IS NULL THEN
  SELECT id INTO v_hol_id FROM programs
  WHERE organization_id = v_org_id AND title = 'Healthcare Organizational Leadership MSN' LIMIT 1;
END IF;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Program Sessions (curriculum milestones for each program)
-- ─────────────────────────────────────────────────────────────────────────────

-- MSN Entry into Nursing sessions
INSERT INTO program_sessions (program_id, organization_id, title, description, session_type, status, metadata)
SELECT v_msn_id, v_org_id, s.title, s.description, s.session_type, s.status, s.metadata
FROM (VALUES
  ('Fundamentals',
   'Health assessment foundations, nursing fundamentals, patient safety, simulation lab orientation',
   'course', 'completed',
   jsonb_build_object('semester', 1, 'sort_order', 1, 'category', 'foundational')),
  ('Adult Health Nursing',
   'Adult health nursing, medication administration, wound care, IV therapy, clinical rotations at JH Hospital',
   'course', 'completed',
   jsonb_build_object('semester', 2, 'sort_order', 2, 'category', 'clinical')),
  ('Pediatric Nursing',
   'Pediatric assessment, family-centered care, developmental milestones, clinical at Kennedy Krieger Institute',
   'course', 'live',
   jsonb_build_object('semester', 3, 'sort_order', 3, 'category', 'clinical')),
  ('Maternal-Newborn',
   'Maternal-newborn care, prenatal assessment, labor & delivery, postpartum — clinical at JH Bayview',
   'course', 'planned',
   jsonb_build_object('semester', 3, 'sort_order', 4, 'category', 'clinical')),
  ('Critical Care Nursing',
   'Critical care nursing, ventilator management, hemodynamic monitoring, code response, ICU rotations',
   'course', 'planned',
   jsonb_build_object('semester', 4, 'sort_order', 5, 'category', 'clinical')),
  ('Psych & Behavioral Health',
   'Psychiatric & behavioral health nursing, therapeutic communication — clinical at MedStar Harbor',
   'course', 'planned',
   jsonb_build_object('semester', 4, 'sort_order', 6, 'category', 'clinical')),
  ('Capstone & NCLEX Prep',
   'Capstone clinical immersion integrating all competencies, NCLEX preparation, 95% pass rate',
   'course', 'planned',
   jsonb_build_object('semester', 5, 'sort_order', 7, 'category', 'capstone'))
) AS s(title, description, session_type, status, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM program_sessions ps
  WHERE ps.program_id = v_msn_id AND ps.title = s.title
);

-- DNP — Family NP sessions
INSERT INTO program_sessions (program_id, organization_id, title, description, session_type, status, metadata)
SELECT v_dnp_fnp_id, v_org_id, s.title, s.description, s.session_type, s.status, s.metadata
FROM (VALUES
  ('Adv Pathophysiology',
   'Advanced pathophysiology across the lifespan, cellular mechanisms, immune response',
   'course', 'completed',
   jsonb_build_object('semester', 1, 'sort_order', 1, 'category', 'foundational')),
  ('Adv Pharmacology',
   'Advanced pharmacology — prescribing guidelines, drug interactions, pharmacokinetics',
   'course', 'completed',
   jsonb_build_object('semester', 1, 'sort_order', 2, 'category', 'foundational')),
  ('Health Assessment',
   'Comprehensive health assessment, differential diagnosis, clinical reasoning',
   'course', 'live',
   jsonb_build_object('semester', 2, 'sort_order', 3, 'category', 'clinical')),
  ('Evidence-Based Practice',
   'Evidence-based practice, quality improvement methods, translational research',
   'course', 'planned',
   jsonb_build_object('semester', 2, 'sort_order', 4, 'category', 'scholarship')),
  ('Clinical Practicum I',
   'Primary care clinical practicum I — 200+ hours with preceptor, common presentations',
   'clinical', 'planned',
   jsonb_build_object('semester', 3, 'sort_order', 5, 'category', 'clinical', 'hours', 200)),
  ('Clinical Practicum II',
   'Primary care clinical practicum II — complex patients, chronic disease management',
   'clinical', 'planned',
   jsonb_build_object('semester', 4, 'sort_order', 6, 'category', 'clinical', 'hours', 300)),
  ('DNP Scholarly Project',
   'DNP scholarly project — practice change implementation and outcomes evaluation',
   'course', 'planned',
   jsonb_build_object('semester', 5, 'sort_order', 7, 'category', 'capstone'))
) AS s(title, description, session_type, status, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM program_sessions ps
  WHERE ps.program_id = v_dnp_fnp_id AND ps.title = s.title
);

-- DNP — Psych Mental Health NP sessions
INSERT INTO program_sessions (program_id, organization_id, title, description, session_type, status, metadata)
SELECT v_dnp_pmhnp_id, v_org_id, s.title, s.description, s.session_type, s.status, s.metadata
FROM (VALUES
  ('Adv Psychopathology',
   'Advanced psychopathology, neuroscience of mental illness, diagnostic frameworks',
   'course', 'completed',
   jsonb_build_object('semester', 1, 'sort_order', 1, 'category', 'foundational')),
  ('Psychopharmacology',
   'Psychopharmacology — SSRIs, mood stabilizers, antipsychotics, medication management',
   'course', 'completed',
   jsonb_build_object('semester', 1, 'sort_order', 2, 'category', 'foundational')),
  ('Therapeutic Modalities',
   'Therapeutic modalities — CBT, DBT, motivational interviewing, crisis intervention',
   'course', 'live',
   jsonb_build_object('semester', 2, 'sort_order', 3, 'category', 'clinical')),
  ('Psychiatric Assessment',
   'Psychiatric assessment across the lifespan, standardized screening tools',
   'course', 'planned',
   jsonb_build_object('semester', 2, 'sort_order', 4, 'category', 'clinical')),
  ('Psych Clinical I',
   'Psychiatric clinical practicum I — outpatient behavioral health settings',
   'clinical', 'planned',
   jsonb_build_object('semester', 3, 'sort_order', 5, 'category', 'clinical', 'hours', 200)),
  ('Psych Clinical II',
   'Psychiatric clinical practicum II — inpatient & crisis settings, complex cases',
   'clinical', 'planned',
   jsonb_build_object('semester', 4, 'sort_order', 6, 'category', 'clinical', 'hours', 300)),
  ('DNP Scholarly Project',
   'DNP scholarly project focused on mental health outcomes or access improvement',
   'course', 'planned',
   jsonb_build_object('semester', 5, 'sort_order', 7, 'category', 'capstone'))
) AS s(title, description, session_type, status, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM program_sessions ps
  WHERE ps.program_id = v_dnp_pmhnp_id AND ps.title = s.title
);

-- Healthcare Organizational Leadership sessions
INSERT INTO program_sessions (program_id, organization_id, title, description, session_type, status, metadata)
SELECT v_hol_id, v_org_id, s.title, s.description, s.session_type, s.status, s.metadata
FROM (VALUES
  ('Healthcare Systems & Leadership',
   'Healthcare systems, organizational theory, nursing leadership frameworks',
   'course', 'completed',
   jsonb_build_object('semester', 1, 'sort_order', 1, 'category', 'foundational')),
  ('Financial Management',
   'Financial management in healthcare — budgeting, resource allocation, cost analysis',
   'course', 'live',
   jsonb_build_object('semester', 2, 'sort_order', 2, 'category', 'foundational')),
  ('Quality & Safety Science',
   'Quality & safety science, evidence-based practice, performance improvement',
   'course', 'planned',
   jsonb_build_object('semester', 2, 'sort_order', 3, 'category', 'scholarship')),
  ('Health Policy',
   'Health policy analysis, advocacy, regulatory environment, legislative process',
   'course', 'planned',
   jsonb_build_object('semester', 3, 'sort_order', 4, 'category', 'scholarship')),
  ('HOL Practicum I',
   'HOL Practicum I — 112 hours with nurse executive preceptor',
   'clinical', 'planned',
   jsonb_build_object('semester', 3, 'sort_order', 5, 'category', 'clinical', 'hours', 112)),
  ('HOL Practicum II',
   'HOL Practicum II — 168 hours leading a quality improvement initiative',
   'clinical', 'planned',
   jsonb_build_object('semester', 4, 'sort_order', 6, 'category', 'clinical', 'hours', 168)),
  ('Executive Leadership Capstone',
   'HOL Practicum III — 224 hours, executive leadership capstone project',
   'clinical', 'planned',
   jsonb_build_object('semester', 5, 'sort_order', 7, 'category', 'capstone', 'hours', 224))
) AS s(title, description, session_type, status, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM program_sessions ps
  WHERE ps.program_id = v_hol_id AND ps.title = s.title
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Timeline Step Templates (what gets copied when a user follows a program)
-- ─────────────────────────────────────────────────────────────────────────────

-- MSN Entry into Nursing templates
INSERT INTO timeline_step_templates (organization_id, interest_id, path_name, title, description, category, sort_order, metadata)
VALUES
  (v_org_id, v_nursing_id, 'msn-entry-into-nursing', 'Fundamentals & Patient Safety', 'Health assessment foundations, nursing fundamentals, patient safety, simulation lab orientation', 'foundational', 1, jsonb_build_object('program_title', 'MSN Entry into Nursing', 'semester', 1)),
  (v_org_id, v_nursing_id, 'msn-entry-into-nursing', 'Adult Health Nursing', 'Adult health nursing, medication administration, wound care, IV therapy, clinical rotations at JH Hospital', 'clinical', 2, jsonb_build_object('program_title', 'MSN Entry into Nursing', 'semester', 2)),
  (v_org_id, v_nursing_id, 'msn-entry-into-nursing', 'Pediatric Nursing', 'Pediatric assessment, family-centered care, developmental milestones, clinical at Kennedy Krieger Institute', 'clinical', 3, jsonb_build_object('program_title', 'MSN Entry into Nursing', 'semester', 3)),
  (v_org_id, v_nursing_id, 'msn-entry-into-nursing', 'Maternal-Newborn Nursing', 'Maternal-newborn care, prenatal assessment, labor & delivery, postpartum — clinical at JH Bayview', 'clinical', 4, jsonb_build_object('program_title', 'MSN Entry into Nursing', 'semester', 3)),
  (v_org_id, v_nursing_id, 'msn-entry-into-nursing', 'Critical Care Nursing', 'Critical care nursing, ventilator management, hemodynamic monitoring, code response, ICU rotations', 'clinical', 5, jsonb_build_object('program_title', 'MSN Entry into Nursing', 'semester', 4)),
  (v_org_id, v_nursing_id, 'msn-entry-into-nursing', 'Psych & Behavioral Health', 'Psychiatric & behavioral health nursing, therapeutic communication — clinical at MedStar Harbor', 'clinical', 6, jsonb_build_object('program_title', 'MSN Entry into Nursing', 'semester', 4)),
  (v_org_id, v_nursing_id, 'msn-entry-into-nursing', 'Capstone & NCLEX Prep', 'Capstone clinical immersion integrating all competencies, NCLEX preparation', 'capstone', 7, jsonb_build_object('program_title', 'MSN Entry into Nursing', 'semester', 5))
ON CONFLICT (organization_id, path_name, sort_order) DO NOTHING;

-- DNP — Family NP templates
INSERT INTO timeline_step_templates (organization_id, interest_id, path_name, title, description, category, sort_order, metadata)
VALUES
  (v_org_id, v_nursing_id, 'dnp-family-np', 'Adv Pathophysiology', 'Advanced pathophysiology across the lifespan, cellular mechanisms, immune response', 'foundational', 1, jsonb_build_object('program_title', 'DNP — Family NP', 'semester', 1)),
  (v_org_id, v_nursing_id, 'dnp-family-np', 'Adv Pharmacology', 'Advanced pharmacology — prescribing guidelines, drug interactions, pharmacokinetics', 'foundational', 2, jsonb_build_object('program_title', 'DNP — Family NP', 'semester', 1)),
  (v_org_id, v_nursing_id, 'dnp-family-np', 'Health Assessment', 'Comprehensive health assessment, differential diagnosis, clinical reasoning', 'clinical', 3, jsonb_build_object('program_title', 'DNP — Family NP', 'semester', 2)),
  (v_org_id, v_nursing_id, 'dnp-family-np', 'Evidence-Based Practice', 'Evidence-based practice, quality improvement methods, translational research', 'scholarship', 4, jsonb_build_object('program_title', 'DNP — Family NP', 'semester', 2)),
  (v_org_id, v_nursing_id, 'dnp-family-np', 'Clinical Practicum I', 'Primary care clinical practicum I — 200+ hours with preceptor, common presentations', 'clinical', 5, jsonb_build_object('program_title', 'DNP — Family NP', 'semester', 3, 'hours', 200)),
  (v_org_id, v_nursing_id, 'dnp-family-np', 'Clinical Practicum II', 'Primary care clinical practicum II — complex patients, chronic disease management', 'clinical', 6, jsonb_build_object('program_title', 'DNP — Family NP', 'semester', 4, 'hours', 300)),
  (v_org_id, v_nursing_id, 'dnp-family-np', 'DNP Scholarly Project', 'DNP scholarly project — practice change implementation and outcomes evaluation', 'capstone', 7, jsonb_build_object('program_title', 'DNP — Family NP', 'semester', 5))
ON CONFLICT (organization_id, path_name, sort_order) DO NOTHING;

-- DNP — Psych Mental Health NP templates
INSERT INTO timeline_step_templates (organization_id, interest_id, path_name, title, description, category, sort_order, metadata)
VALUES
  (v_org_id, v_nursing_id, 'dnp-psych-mental-health-np', 'Adv Psychopathology', 'Advanced psychopathology, neuroscience of mental illness, diagnostic frameworks', 'foundational', 1, jsonb_build_object('program_title', 'DNP — Psych Mental Health NP', 'semester', 1)),
  (v_org_id, v_nursing_id, 'dnp-psych-mental-health-np', 'Psychopharmacology', 'Psychopharmacology — SSRIs, mood stabilizers, antipsychotics, medication management', 'foundational', 2, jsonb_build_object('program_title', 'DNP — Psych Mental Health NP', 'semester', 1)),
  (v_org_id, v_nursing_id, 'dnp-psych-mental-health-np', 'Therapeutic Modalities', 'Therapeutic modalities — CBT, DBT, motivational interviewing, crisis intervention', 'clinical', 3, jsonb_build_object('program_title', 'DNP — Psych Mental Health NP', 'semester', 2)),
  (v_org_id, v_nursing_id, 'dnp-psych-mental-health-np', 'Psychiatric Assessment', 'Psychiatric assessment across the lifespan, standardized screening tools', 'clinical', 4, jsonb_build_object('program_title', 'DNP — Psych Mental Health NP', 'semester', 2)),
  (v_org_id, v_nursing_id, 'dnp-psych-mental-health-np', 'Psych Clinical Practicum I', 'Psychiatric clinical practicum I — outpatient behavioral health settings', 'clinical', 5, jsonb_build_object('program_title', 'DNP — Psych Mental Health NP', 'semester', 3, 'hours', 200)),
  (v_org_id, v_nursing_id, 'dnp-psych-mental-health-np', 'Psych Clinical Practicum II', 'Psychiatric clinical practicum II — inpatient & crisis settings, complex cases', 'clinical', 6, jsonb_build_object('program_title', 'DNP — Psych Mental Health NP', 'semester', 4, 'hours', 300)),
  (v_org_id, v_nursing_id, 'dnp-psych-mental-health-np', 'DNP Scholarly Project', 'DNP scholarly project focused on mental health outcomes or access improvement', 'capstone', 7, jsonb_build_object('program_title', 'DNP — Psych Mental Health NP', 'semester', 5))
ON CONFLICT (organization_id, path_name, sort_order) DO NOTHING;

-- Healthcare Organizational Leadership MSN templates
INSERT INTO timeline_step_templates (organization_id, interest_id, path_name, title, description, category, sort_order, metadata)
VALUES
  (v_org_id, v_nursing_id, 'hol-msn', 'Healthcare Systems & Leadership', 'Healthcare systems, organizational theory, nursing leadership frameworks', 'foundational', 1, jsonb_build_object('program_title', 'Healthcare Organizational Leadership MSN', 'semester', 1)),
  (v_org_id, v_nursing_id, 'hol-msn', 'Financial Management', 'Financial management in healthcare — budgeting, resource allocation, cost analysis', 'foundational', 2, jsonb_build_object('program_title', 'Healthcare Organizational Leadership MSN', 'semester', 2)),
  (v_org_id, v_nursing_id, 'hol-msn', 'Quality & Safety Science', 'Quality & safety science, evidence-based practice, performance improvement', 'scholarship', 3, jsonb_build_object('program_title', 'Healthcare Organizational Leadership MSN', 'semester', 2)),
  (v_org_id, v_nursing_id, 'hol-msn', 'Health Policy', 'Health policy analysis, advocacy, regulatory environment, legislative process', 'scholarship', 4, jsonb_build_object('program_title', 'Healthcare Organizational Leadership MSN', 'semester', 3)),
  (v_org_id, v_nursing_id, 'hol-msn', 'HOL Practicum I', 'HOL Practicum I — 112 hours with nurse executive preceptor', 'clinical', 5, jsonb_build_object('program_title', 'Healthcare Organizational Leadership MSN', 'semester', 3, 'hours', 112)),
  (v_org_id, v_nursing_id, 'hol-msn', 'HOL Practicum II', 'HOL Practicum II — 168 hours leading a quality improvement initiative', 'clinical', 6, jsonb_build_object('program_title', 'Healthcare Organizational Leadership MSN', 'semester', 4, 'hours', 168)),
  (v_org_id, v_nursing_id, 'hol-msn', 'Executive Leadership Capstone', 'HOL Practicum III — 224 hours, executive leadership capstone project', 'capstone', 7, jsonb_build_object('program_title', 'Healthcare Organizational Leadership MSN', 'semester', 5, 'hours', 224))
ON CONFLICT (organization_id, path_name, sort_order) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Playbook Baseline Concepts (nursing platform baselines)
--    These are world-readable concepts every nursing subscriber inherits
-- ─────────────────────────────────────────────────────────────────────────────

-- Idempotency: only seed concepts on a fresh DB (no existing nursing baselines).
-- playbook_concepts has UNIQUE (playbook_id, slug) which is non-distinct on NULL,
-- so ON CONFLICT DO NOTHING would not catch dupes here.
IF NOT EXISTS (
  SELECT 1 FROM playbook_concepts
  WHERE interest_id = v_nursing_id AND origin = 'platform_baseline'
) THEN
INSERT INTO playbook_concepts (
  interest_id, slug, title, body_md, origin, metadata
)
VALUES
  -- NCLEX Client Needs categories
  (v_nursing_id, 'management-of-care',
   'Management of Care (17-23%)',
   E'## Management of Care\n\nThe largest NCLEX category. Covers delegation, prioritization, ethical practice, advance directives, informed consent, and legal responsibilities.\n\n### Key Concepts\n- **Delegation**: Right task, right circumstance, right person, right direction, right supervision\n- **Priority Setting**: ABCs (Airway, Breathing, Circulation), Maslow''s hierarchy, acute vs. chronic\n- **Ethical Practice**: Autonomy, beneficence, nonmaleficence, justice, fidelity\n- **Legal**: Scope of practice, mandatory reporting, HIPAA, restraint use\n\n### Common NCLEX Patterns\n- "Which client should the nurse see first?" → Look for acute changes, unstable vitals\n- "Which task can the nurse delegate to the UAP?" → Routine, non-assessment tasks only',
   'platform_baseline',
   jsonb_build_object('nclex_weight', '17-23%', 'category', 'nclex-client-needs')),

  (v_nursing_id, 'safety-and-infection-control',
   'Safety & Infection Control (9-15%)',
   E'## Safety and Infection Control\n\nFocuses on protecting clients and staff from health and environmental hazards.\n\n### Key Concepts\n- **Standard Precautions**: Hand hygiene, PPE, safe injection practices\n- **Transmission-Based**: Contact, droplet, airborne isolation\n- **Fall Prevention**: Morse Fall Scale, bed alarm, non-slip footwear, low bed position\n- **Restraints**: Least restrictive first, check circulation q15min, physician order required\n- **Error Prevention**: Two patient identifiers, timeout before procedures, SBAR handoff\n\n### High-Yield for NCLEX\n- Airborne: TB, measles, varicella → N95 + negative pressure room\n- Droplet: Flu, pertussis, meningitis → surgical mask\n- Contact: MRSA, C. diff, scabies → gown + gloves',
   'platform_baseline',
   jsonb_build_object('nclex_weight', '9-15%', 'category', 'nclex-client-needs')),

  (v_nursing_id, 'pharmacological-therapies',
   'Pharmacological & Parenteral Therapies (12-18%)',
   E'## Pharmacological and Parenteral Therapies\n\nSecond-largest NCLEX category. Medication safety, IV therapy, blood products, and drug calculations.\n\n### The 6 Rights\n1. Right patient (two identifiers)\n2. Right medication\n3. Right dose\n4. Right route\n5. Right time\n6. Right documentation\n\n### High-Alert Medications\n- **Insulin**: Never give IV without pump, check blood glucose, know onset/peak/duration\n- **Heparin/Warfarin**: Monitor aPTT (heparin) and INR (warfarin), bleeding precautions\n- **Digoxin**: Hold if HR < 60, check potassium (hypokalemia increases toxicity)\n- **Opioids**: Respiratory depression risk, naloxone (Narcan) reversal\n\n### IV Therapy\n- Isotonic (NS, LR): Volume replacement\n- Hypotonic (0.45% NS): Cellular dehydration\n- Hypertonic (3% NS): Severe hyponatremia — central line only',
   'platform_baseline',
   jsonb_build_object('nclex_weight', '12-18%', 'category', 'nclex-client-needs')),

  (v_nursing_id, 'physiological-adaptation',
   'Physiological Adaptation (11-17%)',
   E'## Physiological Adaptation\n\nManaging clients with acute, chronic, or life-threatening conditions.\n\n### Key Topics\n- **Fluid & Electrolytes**: Na+, K+, Ca2+, Mg2+ — know normal ranges and symptoms of imbalance\n- **Acid-Base**: ROME (Respiratory Opposite, Metabolic Equal) for ABG interpretation\n- **Shock**: Hypovolemic, cardiogenic, septic, anaphylactic — know early vs. late signs\n- **Heart Failure**: Left (pulmonary edema, dyspnea) vs. Right (peripheral edema, JVD)\n- **Diabetes**: DKA vs. HHS — know the differences and treatment priorities\n\n### ABG Quick Reference\n- pH 7.35-7.45 | CO2 35-45 | HCO3 22-26\n- pH < 7.35 = acidosis | pH > 7.45 = alkalosis\n- CO2 abnormal = respiratory | HCO3 abnormal = metabolic',
   'platform_baseline',
   jsonb_build_object('nclex_weight', '11-17%', 'category', 'nclex-client-needs')),

  (v_nursing_id, 'psychosocial-integrity',
   'Psychosocial Integrity (6-12%)',
   E'## Psychosocial Integrity\n\nMental health concepts, coping, therapeutic communication.\n\n### Therapeutic Communication\n- **Do**: Open-ended questions, reflection, silence, empathy, restating\n- **Don''t**: "Why" questions, false reassurance, giving advice, changing the subject\n- **Crisis Intervention**: Assess safety first, one-to-one observation for suicidal ideation\n\n### Key Disorders\n- **Depression**: Assess for suicidal ideation (most important), medication compliance\n- **Anxiety**: Mild → learning possible, Moderate → perceptual narrowing, Severe → cannot learn, Panic → fight/flight\n- **Substance Withdrawal**: Alcohol (seizures, DTs), opioids (not life-threatening but uncomfortable)\n- **Eating Disorders**: Monitor electrolytes, cardiac status, refeeding syndrome risk',
   'platform_baseline',
   jsonb_build_object('nclex_weight', '6-12%', 'category', 'nclex-client-needs')),

  (v_nursing_id, 'health-promotion-maintenance',
   'Health Promotion & Maintenance (6-12%)',
   E'## Health Promotion and Maintenance\n\nPrevention, screening, developmental stages, pregnancy.\n\n### Developmental Milestones\n- **Erikson**: Trust vs. Mistrust (infant) through Integrity vs. Despair (elderly)\n- **Piaget**: Sensorimotor → Preoperational → Concrete → Formal operational\n\n### Screening Guidelines\n- Mammogram: Age 40-50 (varies by guideline), then annually or biennially\n- Colonoscopy: Age 45, then every 10 years\n- Pap smear: Age 21, every 3 years (or 5 with HPV co-test)\n\n### Pregnancy\n- Nagele''s Rule: LMP + 7 days - 3 months = EDD\n- Prenatal vitamins: Folic acid 400-800mcg (neural tube defect prevention)\n- Warning signs: Vaginal bleeding, severe headache, visual changes, decreased fetal movement',
   'platform_baseline',
   jsonb_build_object('nclex_weight', '6-12%', 'category', 'nclex-client-needs')),

  (v_nursing_id, 'basic-care-and-comfort',
   'Basic Care & Comfort (6-12%)',
   E'## Basic Care and Comfort\n\nNutrition, mobility, hygiene, pain management, end-of-life care.\n\n### Nutrition\n- **Renal diet**: Low K+, low phosphorus, fluid restriction\n- **Cardiac diet**: Low sodium (< 2g/day), low saturated fat\n- **Diabetic diet**: Consistent carbohydrate, regular meals\n- **Celiac**: Strict gluten-free\n\n### Pain Management\n- WHO Pain Ladder: Non-opioid → Weak opioid → Strong opioid\n- Non-pharmacological: Positioning, ice/heat, distraction, guided imagery\n- Assess: Location, onset, character, associated symptoms, relieving/aggravating, timing, severity (0-10)\n\n### Mobility\n- Positioning: Fowler''s (respiratory), lateral (unconscious), supine (spinal), Trendelenburg (shock)\n- Fall prevention: Lowest bed position, call light within reach, non-skid footwear',
   'platform_baseline',
   jsonb_build_object('nclex_weight', '6-12%', 'category', 'nclex-client-needs')),

  (v_nursing_id, 'reduction-of-risk-potential',
   'Reduction of Risk Potential (9-15%)',
   E'## Reduction of Risk Potential\n\nMonitoring for complications, diagnostic tests, lab values.\n\n### Critical Lab Values — Know These Cold\n- **Potassium**: 3.5-5.0 mEq/L (cardiac arrest risk outside range)\n- **Sodium**: 136-145 mEq/L\n- **Glucose**: 70-100 mg/dL fasting\n- **WBC**: 5,000-10,000/mm³\n- **Hemoglobin**: M 14-18 g/dL, F 12-16 g/dL\n- **Platelets**: 150,000-400,000/mm³\n- **INR**: 2.0-3.0 (therapeutic on warfarin)\n- **aPTT**: 60-80 sec (therapeutic on heparin)\n\n### Post-Procedure Monitoring\n- **Cardiac cath**: Check insertion site, pedal pulses, keep leg straight 4-6 hrs\n- **Lumbar puncture**: Flat for 4-8 hrs, increase fluids\n- **Liver biopsy**: Right side-lying position, monitor for hemorrhage\n- **Thyroidectomy**: Monitor for hemorrhage, respiratory distress, hypocalcemia (check Chvostek/Trousseau)',
   'platform_baseline',
   jsonb_build_object('nclex_weight', '9-15%', 'category', 'nclex-client-needs')),

  -- Core nursing practice concepts
  (v_nursing_id, 'delegation-and-prioritization',
   'Delegation & Prioritization',
   E'## Delegation and Prioritization\n\nThe #1 tested concept on NCLEX. Every nurse must know what to delegate, to whom, and when.\n\n### Five Rights of Delegation (NCSBN)\n1. **Right Task**: Is this task within the delegatee''s scope?\n2. **Right Circumstance**: Is the patient stable enough for this delegation?\n3. **Right Person**: Does this specific person have the competency?\n4. **Right Direction**: Were clear instructions given?\n5. **Right Supervision**: Is appropriate follow-up planned?\n\n### What RNs CANNOT Delegate\n- Initial assessment and nursing diagnosis\n- Care plan development\n- Evaluation of patient outcomes\n- Patient/family teaching (initial)\n- Unstable patient care\n\n### What CAN Be Delegated to UAP/CNA\n- Vital signs on stable patients\n- Bathing, grooming, ambulation\n- Intake and output measurement\n- Specimen collection (routine)\n- Feeding stable patients',
   'platform_baseline',
   jsonb_build_object('category', 'core-practice')),

  (v_nursing_id, 'clinical-judgment-model',
   'Clinical Judgment (NCSBN Model)',
   E'## NCSBN Clinical Judgment Measurement Model\n\nThe framework underlying Next Generation NCLEX (NGN) questions.\n\n### The 6 Cognitive Skills\n1. **Recognize Cues**: What data is relevant? What matters in this situation?\n2. **Analyze Cues**: What do the cues mean together? What patterns emerge?\n3. **Prioritize Hypotheses**: Which explanation is most likely? Most dangerous?\n4. **Generate Solutions**: What interventions address the priority hypothesis?\n5. **Take Action**: Implement the best intervention(s)\n6. **Evaluate Outcomes**: Did it work? What needs to change?\n\n### NGN Question Types\n- **Extended Multiple Response**: Select all that apply with partial credit\n- **Cloze (Drop-Down)**: Complete statements by selecting from options\n- **Matrix/Grid**: Multiple decisions in a table format\n- **Highlight**: Select relevant text from a clinical scenario\n- **Bow-Tie**: Link conditions → actions → parameters\n\n### How to Practice\nFor every clinical scenario, walk through all 6 steps explicitly. The test rewards structured thinking, not just correct answers.',
   'platform_baseline',
   jsonb_build_object('category', 'core-practice'))
ON CONFLICT DO NOTHING;
END IF;

END $outer$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Link programs to interest via metadata (for useOrgPrograms query)
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure programs have interest_id set (if column exists from later migration)
DO $link$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'interest_id'
  ) THEN
    UPDATE programs
    SET interest_id = 'bec249c5-6412-4d16-bb84-bfcfb887ff67'
    WHERE organization_id = '678e149e-2abb-422c-ac61-b76756a2150e'
      AND domain = 'nursing'
      AND interest_id IS NULL;
  END IF;
END $link$;

COMMIT;
