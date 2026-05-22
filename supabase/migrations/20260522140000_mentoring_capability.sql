-- Add 'mentoring' to the user_capabilities enum and allow cross-user reads of
-- active capabilities so other users can render MENTOR / COACH badges on a
-- sailor's profile rows (e.g. AddPeoplePicker on the Plan tab).
--
-- Capabilities are inherently public ("this sailor mentors"), so a SELECT
-- policy gated on is_active is the right scope — write paths stay self-only.

ALTER TABLE public.user_capabilities
  DROP CONSTRAINT IF EXISTS user_capabilities_capability_type_check;

ALTER TABLE public.user_capabilities
  ADD CONSTRAINT user_capabilities_capability_type_check
  CHECK (capability_type IN ('coaching', 'mentoring'));

DROP POLICY IF EXISTS "Anyone can view active capabilities" ON public.user_capabilities;
CREATE POLICY "Anyone can view active capabilities"
  ON public.user_capabilities
  FOR SELECT
  USING (is_active = true);
