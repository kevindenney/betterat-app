-- Phone-only signups have a null auth.users.email, but public.users.email and
-- public.profiles.email are both NOT NULL. The two auth-user triggers fed
-- NEW.email straight through, so a phone signup aborted with
-- "null value in column \"email\" ... violates not-null constraint".
--
-- Synthesize a non-routable placeholder address (.invalid is reserved by
-- RFC 2606 and never resolves, so no mail is ever delivered) for phone-only
-- users. This preserves the email-not-null invariant the rest of the app
-- relies on rather than loosening the column.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.email,
      NEW.phone || '@phone.betterat.invalid',
      NEW.id::text || '@anon.betterat.invalid'
    ),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.phone, NEW.email)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_auth_users_profile_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.ensure_profile_for_user(
    NEW.id,
    COALESCE(
      NEW.email,
      NEW.phone || '@phone.betterat.invalid',
      NEW.id::text || '@anon.betterat.invalid'
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      NEW.phone
    )
  );
  RETURN NEW;
END;
$function$;
