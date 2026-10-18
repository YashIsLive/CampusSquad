ALTER TABLE "profiles" ADD COLUMN "email_verified" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
-- Instant password sign-ups are created with user_metadata.email_unverified = true: their address
-- was never proven, so they must not get campus verification from the email domain.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
  v_college uuid;
  v_email_verified boolean;
BEGIN
  base := regexp_replace(lower(split_part(NEW.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  IF length(base) < 3 THEN base := 'user' || base; END IF;
  candidate := left(base, 24);
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    n := n + 1;
    candidate := left(base, 20) || n::text;
  END LOOP;

  v_email_verified := coalesce((NEW.raw_user_meta_data->>'email_unverified')::boolean, false) = false;
  v_college := public.college_for_email(NEW.email);

  INSERT INTO public.profiles (id, username, name, email, avatar_url, college_id, college_verified, email_verified)
  VALUES (
    NEW.id,
    candidate,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    v_college,
    v_college IS NOT NULL AND v_email_verified,
    v_email_verified
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;
