-- Phase 5f · seed author bios for the 3 indie authors
--
-- public.users.bio was added in 20260524190000. These bios show on
-- /marketplace?author=<id> and the detail page. Idempotent — safe to
-- re-run.

UPDATE public.users
SET bio = 'Pediatric ICU nurse turned QI program lead at a 600-bed academic hospital. Spent 18 months rebuilding the bedside skin-assessment workflow after a Stage 4 sentinel event in 2024 — the rounding playbook here is what came out of that work. Teaching since 2018, mostly at the bedside.'
WHERE id = 'e4d11111-aaaa-4111-8111-aabbccdd1111';

UPDATE public.users
SET bio = 'Hospitalist PA on a 12-physician service in a 400-bed regional medical center. 400+ overnight shifts, ~6,000 cross-cover pages, exactly one code-blue I''ll never forget. I write what I wish someone had handed me on day one of intern year.'
WHERE id = 'e4d22222-bbbb-4222-8222-aabbccdd2222';

UPDATE public.users
SET bio = 'JHSON faculty (Adult & Acute Care). Spent six years on a transitional-care discharge team before moving to teaching full time. The teach-back method here is the version we use with second-year DNPs in their first med-surg rotation.'
WHERE id = 'd4222222-2222-4222-8222-422222222222';
