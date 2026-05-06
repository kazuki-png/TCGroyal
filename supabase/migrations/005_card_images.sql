-- =============================================
-- Card image storage
-- =============================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images',
  'card-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "カード画像は全員が参照できる"
  on storage.objects for select
  using (bucket_id = 'card-images');

create policy "管理者はカード画像を追加できる"
  on storage.objects for insert
  with check (
    bucket_id = 'card-images'
    and exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );

create policy "管理者はカード画像を更新できる"
  on storage.objects for update
  using (
    bucket_id = 'card-images'
    and exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );

create policy "管理者はカード画像を削除できる"
  on storage.objects for delete
  using (
    bucket_id = 'card-images'
    and exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );
