-- Seed step templates for the Discharge teach-back blueprint
-- (independent marketplace listing by Noor Aziz). Five steps that
-- walk through the actual teach-back flow used in nursing handoff
-- training.
--
-- Idempotent: delete + reseed any time the blueprint id matches.

DELETE FROM public.blueprint_step_templates
WHERE blueprint_id = '9782c831-15cd-45fb-92e1-6ce9380afeb0';

INSERT INTO public.blueprint_step_templates
  (blueprint_id, sort_order, title, description, category, what_question)
VALUES
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', 1,
   'Prepare the discharge packet',
   'Pull the medication list, follow-up appointments, and red-flag handout. Reconcile against the chart so you can answer "what changed" cleanly.',
   'procedural',
   'What is the one new medication this patient is leaving on today, and why?'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', 2,
   'Set the scene with plain language',
   'Sit (don''t stand), invite a family member, ask the patient how they prefer to learn. Open with "I want to make sure we''re on the same page before you go home."',
   'communication',
   'Who in this room is going to help once they get home?'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', 3,
   'Walk through the three musts',
   'Cover: (1) medication changes, (2) follow-up appointment, (3) when to call us. Use one teach-back question per topic.',
   'communication',
   'If something feels wrong tomorrow, who do you call first?'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', 4,
   'Verify understanding with teach-back',
   'Ask: "In your own words, what are you taking and when?" Listen for gaps. Re-teach the gap, then re-verify. Don''t move on until they can repeat it.',
   'assessment',
   'Did the patient summarize the plan in their own words, or did they just nod?'),
  ('9782c831-15cd-45fb-92e1-6ce9380afeb0', 5,
   'Document the teach-back outcome',
   'Note in the chart what was understood, what needed re-teaching, and any specific concerns the patient or family raised. Future readers of the chart need to know.',
   'procedural',
   'What''s the one piece of follow-up that''s most likely to fall through the cracks for this patient?');
