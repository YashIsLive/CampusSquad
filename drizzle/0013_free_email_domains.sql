-- Free email providers can never be a college's student domain (otherwise every Gmail user would be
-- "verified" at that college). Keep this list in sync with FREE_EMAIL_DOMAINS in src/lib/college.ts.
CREATE OR REPLACE FUNCTION public.is_free_email_domain(p_domain text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(p_domain) = ANY (ARRAY['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.in', 'live.com', 'live.in', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'zoho.com', 'zohomail.in', 'rediffmail.com', 'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'tutanota.com'])
      OR EXISTS (SELECT 1 FROM unnest(ARRAY['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.in', 'live.com', 'live.in', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'zoho.com', 'zohomail.in', 'rediffmail.com', 'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'tutanota.com']) f WHERE lower(p_domain) LIKE '%.' || f);
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.is_free_email_domain(text) FROM anon;
--> statement-breakpoint

-- Clean up: anyone verified only because their free-email address matched a college goes back to
-- unverified (they can verify with a student ID or vouches), then the bad domains are cleared.
UPDATE public.profiles p
SET college_verified = false
WHERE p.college_verified
  AND p.college_verified_via = 'email'
  AND public.is_free_email_domain(split_part(p.email, '@', 2));
--> statement-breakpoint
UPDATE public.colleges SET email_domain = NULL WHERE email_domain IS NOT NULL AND public.is_free_email_domain(email_domain);
--> statement-breakpoint
ALTER TABLE public.colleges ADD CONSTRAINT colleges_email_domain_not_free
  CHECK (email_domain IS NULL OR NOT public.is_free_email_domain(email_domain));
--> statement-breakpoint

-- Belt and braces: never map a free-email address to a college.
CREATE OR REPLACE FUNCTION public.college_for_email(p_email text)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT c.id FROM public.colleges c
  WHERE c.email_domain IS NOT NULL
    AND NOT public.is_free_email_domain(split_part(p_email, '@', 2))
    AND (lower(split_part(p_email, '@', 2)) = c.email_domain
         OR lower(split_part(p_email, '@', 2)) LIKE '%.' || c.email_domain)
  ORDER BY length(c.email_domain) DESC
  LIMIT 1;
$$;
--> statement-breakpoint

-- Once a student is verified (any way), a pending ID-card request is moot: cancel it and drop the
-- photo reference (the daily sweep deletes the file itself).
CREATE OR REPLACE FUNCTION public.cancel_id_requests_when_verified()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.college_verified AND NOT OLD.college_verified AND NEW.college_verified_via IS DISTINCT FROM 'id_card' THEN
    UPDATE public.verification_requests
    SET status = 'cancelled', id_card_path = NULL, decided_at = now(), note = 'Verified another way'
    WHERE user_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.cancel_id_requests_when_verified() FROM anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER profiles_cancel_id_requests AFTER UPDATE OF college_verified ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.cancel_id_requests_when_verified();
