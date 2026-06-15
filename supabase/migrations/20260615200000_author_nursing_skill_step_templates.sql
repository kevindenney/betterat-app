-- Author step content for the 5 org-owned nursing skills that shipped live with
-- step_count > 0 but ZERO blueprint_step_templates rows (foley, h2t, isbar,
-- iv-supervised, med-admin). Migration 20260615190000 deliberately excluded
-- them because they had no step content to materialize, so their discovery
-- cards still resolve to a "Blueprint not found" page.
--
-- The steps below transcribe standard, publicly-taught clinical procedures
-- (ISBAR handoff, the rights of medication administration, the canonical
-- head-to-toe order, sterile Foley insertion, supervised peripheral IV) into
-- the existing nursing-template house voice: imperative title, a description
-- carrying technique + rationale, a reflective `what_question`, and a category
-- in {procedural, assessment, communication, reasoning}.
--
-- These are seed templates drawn from general clinical standards, NOT a
-- specific org's curriculum or competency framework — they should get a
-- clinical SME / org review pass before being treated as authoritative
-- teaching content.
--
-- Idempotent: Part 1 guards on "no template rows for this blueprint", Part 2
-- reuses the slug-keyed NOT EXISTS materialize CTE from 20260615190000, so a
-- re-run is a no-op.

-- ── Part 1: author the step templates ──────────────────────────────────────

-- ISBAR handoff communication
INSERT INTO blueprint_step_templates (blueprint_id, sort_order, title, description, category, what_question)
SELECT b.id, v.sort_order, v.title, v.description, v.category, v.what_question
FROM blueprints b
CROSS JOIN (VALUES
  (1, 'Identify yourself and the patient',
   'Open by saying who you are, your role, and exactly which patient you''re handing off — name plus a second identifier. The receiver should never have to guess who you mean.',
   'communication',
   'Does the person receiving this handoff know exactly which patient you mean before you say anything else?'),
  (2, 'State the situation',
   'In one or two sentences, say why you''re calling right now: the immediate concern or the reason for the handoff. Lead with the headline, not the history.',
   'communication',
   'If you only got one sentence, what is the single most important thing about this patient right now?'),
  (3, 'Give the background',
   'Provide the relevant history that frames the situation: admitting diagnosis, pertinent dates, recent changes, current treatments. Relevant — not the whole chart.',
   'communication',
   'Which piece of background actually changes what the next nurse will do?'),
  (4, 'Share your assessment',
   'Say what you think is going on. This is your clinical read — vitals trend, how the patient looks, your level of concern. It''s allowed to be a judgement, not just numbers.',
   'reasoning',
   'Are you reporting numbers, or are you telling them what the numbers mean?'),
  (5, 'Make a clear recommendation',
   'State what you need and by when: "I need you to come see them in the next 30 minutes" or "Please continue hourly neuro checks overnight." Vague handoffs create gaps.',
   'communication',
   'Did you ask for a specific action with a specific timeframe, or did you leave it open?'),
  (6, 'Close the loop',
   'Ask the receiver to read back the plan and any orders. Confirm you agree. The handoff isn''t done until both of you hold the same plan.',
   'communication',
   'Did they repeat the plan back in their own words, or did they just say "got it"?')
) AS v(sort_order, title, description, category, what_question)
WHERE b.slug = 'isbar'
  AND NOT EXISTS (SELECT 1 FROM blueprint_step_templates t WHERE t.blueprint_id = b.id);

-- Medication administration (the rights)
INSERT INTO blueprint_step_templates (blueprint_id, sort_order, title, description, category, what_question)
SELECT b.id, v.sort_order, v.title, v.description, v.category, v.what_question
FROM blueprints b
CROSS JOIN (VALUES
  (1, 'Verify the order against the MAR',
   'Before you touch a medication, confirm the order is complete and current: drug, dose, route, frequency, and that it matches the MAR. An unclear order gets clarified, never assumed.',
   'procedural',
   'Is there anything about this order you''re filling in from memory rather than reading?'),
  (2, 'Right patient — two identifiers',
   'Check two patient identifiers against the MAR and the patient''s band — name and date of birth, never the room number. Ask the patient to state their name when they''re able.',
   'procedural',
   'Did you confirm the patient, or did you confirm the bed?'),
  (3, 'Right drug and right dose',
   'Check the label against the MAR three times: when you pull it, when you prepare it, and at the bedside. Verify the dose math out loud for anything you calculate.',
   'procedural',
   'If this dose is a calculation, would it survive someone double-checking your math?'),
  (4, 'Right route and right time',
   'Confirm the route matches the order and the patient''s current status, and that you''re inside the correct administration window. Note time-critical meds that can''t flex.',
   'procedural',
   'Is this a med where being an hour off actually matters — and do you know which kind it is?'),
  (5, 'Assess before you give',
   'Check the relevant parameters first: hold parameters, allergies, recent labs, vitals. Some meds you hold; some you''d be wrong to give. Decide before, not after.',
   'assessment',
   'Is there any reason — a vital, a lab, a symptom — that this dose should be held right now?'),
  (6, 'Administer and stay present',
   'Give the medication as ordered and stay with the patient through it where indicated. Don''t leave a med at the bedside to be taken later.',
   'procedural',
   'Did you watch it actually go in / go down, or did you assume it did?'),
  (7, 'Document immediately',
   'Record the administration right after giving it — drug, dose, route, time, site, and who gave it. Charting later is how doses get duplicated.',
   'procedural',
   'If you got pulled to an emergency right now, would the chart show what you just gave?'),
  (8, 'Evaluate the response',
   'Come back and assess whether the medication did what it was supposed to — pain down, rhythm controlled — and watch for adverse effects. The "right" you''re always checking last is right response.',
   'assessment',
   'How will you know whether this med worked, and when will you check?')
) AS v(sort_order, title, description, category, what_question)
WHERE b.slug = 'med-admin'
  AND NOT EXISTS (SELECT 1 FROM blueprint_step_templates t WHERE t.blueprint_id = b.id);

-- Head-to-toe assessment
INSERT INTO blueprint_step_templates (blueprint_id, sort_order, title, description, category, what_question)
SELECT b.id, v.sort_order, v.title, v.description, v.category, v.what_question
FROM blueprints b
CROSS JOIN (VALUES
  (1, 'Hand hygiene, introduce, general survey',
   'Wash in, introduce yourself, confirm two identifiers, and take in the whole patient before you touch them: are they comfortable, in distress, alert? The first impression frames everything after.',
   'procedural',
   'Walking in the door, what does this patient look like before you''ve measured a single thing?'),
  (2, 'Neurological and level of consciousness',
   'Assess orientation, speech, pupils, and movement of all four limbs. A change here outranks almost everything else you''ll find.',
   'assessment',
   'Is this patient the same, sharper, or duller than the last time someone assessed them?'),
  (3, 'HEENT',
   'Work the head, eyes, ears, nose, and throat — conjunctiva, mucous membranes, jugular veins, any drainage. Keep the same order every patient so your eye catches what''s different.',
   'assessment',
   'What in the head and neck would you have missed if you''d skipped straight to the chest?'),
  (4, 'Respiratory',
   'Inspect the work of breathing, then auscultate all lung fields front and back, comparing side to side. Listen long enough to catch what''s at the bases.',
   'assessment',
   'Did you listen to a full breath in every field, or did you sample and move on?'),
  (5, 'Cardiovascular',
   'Auscultate heart sounds, palpate peripheral pulses, check capillary refill and for edema. Compare left to right everywhere you can.',
   'assessment',
   'Do the pulses and the heart sounds tell the same story about how well this patient is perfusing?'),
  (6, 'Abdomen',
   'Inspect, then auscultate bowel sounds, then palpate — in that order, because palpating first changes the sounds. Note distension, tenderness, and last bowel movement.',
   'assessment',
   'Did you auscultate before you palpated, or did your hands get there first?'),
  (7, 'Skin and extremities',
   'Check skin integrity, temperature, color, and turgor; inspect pressure points and any lines or dressings; assess strength and sensation in the limbs.',
   'assessment',
   'Which pressure point is this patient most likely lying on right now, and did you actually look at it?'),
  (8, 'Document and report abnormals',
   'Chart the assessment systematically and flag anything abnormal up the chain. A finding nobody hears about is a finding you didn''t make.',
   'procedural',
   'Of everything you found, what does the next person genuinely need to know in the first ten seconds?')
) AS v(sort_order, title, description, category, what_question)
WHERE b.slug = 'h2t'
  AND NOT EXISTS (SELECT 1 FROM blueprint_step_templates t WHERE t.blueprint_id = b.id);

-- Foley catheter placement (sterile)
INSERT INTO blueprint_step_templates (blueprint_id, sort_order, title, description, category, what_question)
SELECT b.id, v.sort_order, v.title, v.description, v.category, v.what_question
FROM blueprints b
CROSS JOIN (VALUES
  (1, 'Confirm the order and the indication',
   'A Foley is a real infection risk, not a convenience. Confirm there''s an order and a genuine indication — retention, accurate output in a critical patient, certain surgeries — before anything else.',
   'reasoning',
   'Is this catheter being placed because the patient needs it, or because it would be easier?'),
  (2, 'Gather supplies, confirm consent and positioning',
   'Set up the kit, get the right catheter size, and position and drape the patient with privacy and good lighting. Confirm understanding and consent. Set yourself up so you never have to break sterility reaching for something.',
   'procedural',
   'Is everything you need within reach of your sterile field before you put gloves on?'),
  (3, 'Hand hygiene and establish the sterile field',
   'Wash, open the kit, and establish your sterile field and sterile gloves. From here on, one hand stays sterile and one becomes your "dirty" hand — and you don''t mix them.',
   'procedural',
   'Once your sterile glove is on, which hand is committed to staying sterile no matter what?'),
  (4, 'Cleanse using sterile technique',
   'Cleanse the meatus with your non-dominant (now non-sterile) hand holding the patient open, using each swab once in the correct direction. Don''t let the prepped area be re-contaminated.',
   'procedural',
   'Did each cleansing swab move in one direction and then get discarded, or did anything double back?'),
  (5, 'Insert until urine returns, then advance',
   'Lubricate and insert the catheter steadily until you see urine return, then advance a little further before inflating — so the balloon inflates in the bladder, never the urethra.',
   'procedural',
   'Have you actually seen urine return before your hand goes anywhere near the balloon syringe?'),
  (6, 'Inflate, secure, and position drainage',
   'Inflate the balloon with the specified volume of sterile water, gently retract until it seats, secure the catheter to the leg, and hang the bag below bladder level with no dependent loops.',
   'procedural',
   'Is the drainage bag below the bladder with a clear downhill run, or is urine sitting in a loop?'),
  (7, 'Document and plan early removal',
   'Chart size, balloon volume, output, and how the patient tolerated it — and note when the catheter can come out. The best time to plan removal is the moment you place it.',
   'procedural',
   'What''s the criterion that will tell you this catheter is no longer needed?')
) AS v(sort_order, title, description, category, what_question)
WHERE b.slug = 'foley'
  AND NOT EXISTS (SELECT 1 FROM blueprint_step_templates t WHERE t.blueprint_id = b.id);

-- IV insertion · supervised
INSERT INTO blueprint_step_templates (blueprint_id, sort_order, title, description, category, what_question, preceptor_role)
SELECT b.id, v.sort_order, v.title, v.description, v.category, v.what_question, v.preceptor_role
FROM blueprints b
CROSS JOIN (VALUES
  (1, 'Confirm the order and brief your preceptor',
   'Confirm the order and why the line is needed, then tell your preceptor your plan: which site, which gauge, what you''ll do if the first attempt fails. Supervised means they know your plan before you start.',
   'communication',
   'Does your preceptor know your plan and your bail-out point before the needle is in your hand?',
   'Hears the plan and confirms the chosen site and gauge before the attempt.'),
  (2, 'Gather and prime your supplies',
   'Assemble the catheter, tourniquet, prep, dressing, flush, and extension set, and prime your tubing. Have a second catheter ready — planning for a second attempt isn''t pessimism, it''s normal.',
   'procedural',
   'If your first stick blows, is everything for a second attempt already within reach?',
   'Verifies supplies and that a backup catheter is ready.'),
  (3, 'Select the site and apply the tourniquet',
   'Apply the tourniquet and assess for a straight, springy, well-anchored vein, working distal to proximal. Avoid joints, valves, and the side of any contraindication. Let your preceptor confirm before you commit.',
   'assessment',
   'Of the veins you can feel, which one is springy and anchored — not just the one you can see?',
   'Confirms the selected vein before insertion.'),
  (4, 'Hand hygiene, gloves, prep the site',
   'Perform hand hygiene, don gloves, and prep the site with the correct agent and dry time. Don''t re-palpate the prepped site with an ungloved finger.',
   'procedural',
   'Did you let the prep fully dry, or did you rush the part that actually does the disinfecting?',
   'Observes aseptic technique.'),
  (5, 'Insert and watch for flashback',
   'Anchor the vein, insert the catheter at the appropriate angle bevel-up, and watch for flashback. On flashback, lower the angle and advance slightly before threading the catheter off the needle.',
   'procedural',
   'When you saw flashback, did you advance a touch further before threading, or thread immediately?',
   'Stands ready to take over or coach mid-attempt.'),
  (6, 'Release, connect, flush, and secure',
   'Release the tourniquet, retract and safely discard the needle, connect the extension set, flush to confirm patency without infiltration, then secure with a sterile dressing.',
   'procedural',
   'Did the flush go in smoothly with no swelling, or is there any sign it''s sitting outside the vein?',
   'Confirms patency and safe sharps disposal.'),
  (7, 'Document and debrief',
   'Chart the gauge, site, number of attempts, and patient tolerance, then debrief with your preceptor: what went well, what you''d change next time. The debrief is where the supervised attempt becomes learning.',
   'communication',
   'What is the one thing you''d do differently on your next stick, and did you say it out loud?',
   'Debriefs the attempt and names the next focus.')
) AS v(sort_order, title, description, category, what_question, preceptor_role)
WHERE b.slug = 'iv-supervised'
  AND NOT EXISTS (SELECT 1 FROM blueprint_step_templates t WHERE t.blueprint_id = b.id);

-- ── Part 2: materialize into timeline_blueprints (same CTE as 20260615190000) ─

WITH src AS (
  SELECT
    b.id            AS old_bp_id,
    b.author_user_id,
    b.interest_id,
    b.slug,
    b.title,
    b.description,
    b.subtitle
  FROM blueprints b
  WHERE b.status = 'live'
    AND b.author_user_id IS NOT NULL
    AND b.interest_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM blueprint_step_templates t WHERE t.blueprint_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM timeline_blueprints tb WHERE tb.slug = b.slug)
),
new_bp AS (
  INSERT INTO timeline_blueprints
    (user_id, interest_id, slug, title, description, is_published, access_level, tagline)
  SELECT
    author_user_id, interest_id, slug, title, description, true, 'public', subtitle
  FROM src
  RETURNING id AS new_bp_id, slug
),
map AS (
  SELECT nb.new_bp_id, s.old_bp_id, s.author_user_id, s.interest_id
  FROM new_bp nb
  JOIN src s ON s.slug = nb.slug
),
new_steps AS (
  INSERT INTO timeline_steps
    (user_id, interest_id, title, description, visibility, is_plan_template,
     source_type, source_blueprint_id, status, category)
  SELECT
    m.author_user_id,
    m.interest_id,
    t.title,
    t.description,
    'public',
    true,
    'blueprint',
    m.new_bp_id,
    'pending',
    'general'
  FROM map m
  JOIN blueprint_step_templates t ON t.blueprint_id = m.old_bp_id
  RETURNING id AS step_id, source_blueprint_id, title
)
INSERT INTO blueprint_steps (blueprint_id, step_id, sort_order)
SELECT
  ns.source_blueprint_id,
  ns.step_id,
  COALESCE((
    SELECT MIN(t.sort_order)
    FROM blueprint_step_templates t
    JOIN map m2 ON m2.old_bp_id = t.blueprint_id
    WHERE m2.new_bp_id = ns.source_blueprint_id
      AND t.title = ns.title
  ), 0)
FROM new_steps ns;
