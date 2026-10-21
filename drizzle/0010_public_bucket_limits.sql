-- Public buckets (posters, avatars, logos) accept images only, up to 5 MB.
-- Without this, anyone signed in could upload an SVG or HTML file with scripts (served from the
-- Supabase storage domain) or arbitrarily large files. SVG is excluded because it can carry script.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('posters', 'avatars', 'logos');
