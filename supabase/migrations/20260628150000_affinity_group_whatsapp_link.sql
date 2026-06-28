-- WhatsApp integration is link-out, not chat replacement: there is no API to
-- put a bot inside a peer WhatsApp group or read its messages, so the group's
-- real conversation stays in WhatsApp and BetterAt just stores the group's
-- invite link and opens it. The link is another piece of member-editable group
-- meta, so it folds into set_affinity_group_meta rather than a new RPC.
--
--   whatsapp_invite_url — the group's WhatsApp invite link
--                         (https://chat.whatsapp.com/...). NULL until set.

BEGIN;

ALTER TABLE public.affinity_groups
  ADD COLUMN IF NOT EXISTS whatsapp_invite_url TEXT;

COMMENT ON COLUMN public.affinity_groups.whatsapp_invite_url IS
  'WhatsApp group invite link (https://chat.whatsapp.com/...). Link-out only — BetterAt owns the prep plan, WhatsApp owns the chat. NULL until set.';

-- Recreate set_affinity_group_meta with the extra link param. The signature
-- changes (added arg), so DROP first. Patch semantics per field:
--   NULL  -> leave unchanged (lets callers patch fields independently)
--   ''    -> clear the WhatsApp link (NULL the column)
--   value -> set, after validating it's a chat.whatsapp.com link
DROP FUNCTION IF EXISTS public.set_affinity_group_meta(UUID, TIMESTAMPTZ, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.set_affinity_group_meta(
  p_group_id UUID,
  p_goal_at TIMESTAMPTZ DEFAULT NULL,
  p_goal_label TEXT DEFAULT NULL,
  p_affiliations JSONB DEFAULT NULL,
  p_whatsapp_invite_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wa TEXT := p_whatsapp_invite_url;
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Only members can edit this group';
  END IF;

  IF v_wa IS NOT NULL AND btrim(v_wa) <> ''
     AND btrim(v_wa) !~ '^https://chat\.whatsapp\.com/' THEN
    RAISE EXCEPTION 'Enter a WhatsApp group link (https://chat.whatsapp.com/...)';
  END IF;

  UPDATE public.affinity_groups
  SET goal_at = COALESCE(p_goal_at, goal_at),
      goal_label = COALESCE(p_goal_label, goal_label),
      affiliations = COALESCE(p_affiliations, affiliations),
      whatsapp_invite_url = CASE
        WHEN v_wa IS NULL THEN whatsapp_invite_url
        WHEN btrim(v_wa) = '' THEN NULL
        ELSE btrim(v_wa)
      END,
      updated_at = now()
  WHERE id = p_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_affinity_group_meta(UUID, TIMESTAMPTZ, TEXT, JSONB, TEXT) TO authenticated;

COMMIT;
