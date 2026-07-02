-- Let an active member delete a self-serve group from the app UI.
--
-- This is intentionally a soft delete: the group disappears from Library,
-- direct group routes, discovery, and roster reads via existing is_active
-- filters, while historical rows remain inspectable if needed. Official
-- institutional groupings are not deletable here.

CREATE OR REPLACE FUNCTION public.delete_self_serve_affinity_group(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT;
BEGIN
  IF NOT public.is_affinity_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Only members can delete this group';
  END IF;

  SELECT kind INTO v_kind
  FROM public.affinity_groups
  WHERE id = p_group_id AND is_active = true;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Group not found';
  END IF;

  IF v_kind NOT IN ('crew_pod', 'practice_group') THEN
    RAISE EXCEPTION 'Only self-serve groups can be deleted here';
  END IF;

  UPDATE public.affinity_groups
  SET is_active = false,
      invite_token = NULL,
      updated_at = now()
  WHERE id = p_group_id;

  UPDATE public.affinity_group_members
  SET status = 'inactive'
  WHERE group_id = p_group_id
    AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_self_serve_affinity_group(UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_self_serve_affinity_group(UUID) IS
  'Soft-delete a self-serve affinity group. Active-member gated; crew_pod/practice_group only.';
