-- Keep gear creation out of recursive PostgREST RLS plans.
-- The function still authorizes the caller explicitly before bypassing table
-- RLS for the primary-clear + insert transaction.

CREATE OR REPLACE FUNCTION public.create_gear_item(
  p_user_id uuid,
  p_interest_id uuid,
  p_kind text,
  p_name text,
  p_parent_id uuid DEFAULT NULL,
  p_is_primary boolean DEFAULT false,
  p_status text DEFAULT 'active',
  p_spec jsonb DEFAULT '{}'::jsonb,
  p_notes text DEFAULT NULL
) RETURNS public.gear_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item public.gear_items;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot create gear for another user'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(TRIM(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Gear name is required'
      USING ERRCODE = '23514';
  END IF;

  IF p_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.gear_items parent
    WHERE parent.id = p_parent_id
      AND parent.user_id = p_user_id
      AND parent.interest_id = p_interest_id
  ) THEN
    RAISE EXCEPTION 'Parent gear item was not found'
      USING ERRCODE = '23503';
  END IF;

  IF p_is_primary THEN
    UPDATE public.gear_items
    SET is_primary = false
    WHERE user_id = p_user_id
      AND interest_id = p_interest_id
      AND kind = TRIM(p_kind)
      AND is_primary = true;
  END IF;

  INSERT INTO public.gear_items (
    user_id,
    interest_id,
    kind,
    name,
    parent_id,
    is_primary,
    status,
    spec,
    notes
  )
  VALUES (
    p_user_id,
    p_interest_id,
    TRIM(p_kind),
    TRIM(p_name),
    p_parent_id,
    COALESCE(p_is_primary, false),
    COALESCE(NULLIF(TRIM(p_status), ''), 'active'),
    COALESCE(p_spec, '{}'::jsonb),
    NULLIF(TRIM(p_notes), '')
  )
  RETURNING * INTO v_item;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION public.create_gear_item(uuid, uuid, text, text, uuid, boolean, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_gear_item(uuid, uuid, text, text, uuid, boolean, text, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
