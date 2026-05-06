-- =============================================
-- Identity image storage bucket
-- =============================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-images',
  'identity-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
