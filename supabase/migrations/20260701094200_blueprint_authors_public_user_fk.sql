-- Blueprint co-author credits point at public.users because the picker,
-- display join, and seeded Studio people all source from that profile table.

DO $$
DECLARE
  constraint_name text;
BEGIN
  IF to_regclass('public.blueprint_authors') IS NULL THEN
    RETURN;
  END IF;

  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = ANY(con.conkey)
  WHERE con.conrelid = 'public.blueprint_authors'::regclass
    AND con.contype = 'f'
    AND att.attname = 'user_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.blueprint_authors DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.blueprint_authors
    ADD CONSTRAINT blueprint_authors_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;
END $$;
