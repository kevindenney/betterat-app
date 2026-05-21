-- Add the two fields the Library Plans card design requires.
--
--   tagline         short subtitle / theme phrase (2-4 words)
--                   renders as the middle segment of the author line:
--                     "From Kevin Denney · Worlds 2027 prep · 12 steps"
--                   nullable so existing rows keep working unchanged.
--
--   duration_weeks  expected total length of the plan in weeks.
--                   used to derive progress context:
--                     "0 of 12 · Week 6 of 24"   (mid-flight)
--                     "7 of 9 · 3 weeks left"     (almost done)
--                     "6 of 6 · done"             (complete)
--                   nullable; cards just show step counts when absent.

ALTER TABLE public.timeline_blueprints
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS duration_weeks integer;

COMMENT ON COLUMN public.timeline_blueprints.tagline IS
  'Short 2-4 word theme phrase shown as the middle segment of the Library Plan card author line.';

COMMENT ON COLUMN public.timeline_blueprints.duration_weeks IS
  'Expected total length of the plan in weeks; drives the "Week N of M" / "X weeks left" / "done" tail on the Library Plan card progress meta.';
