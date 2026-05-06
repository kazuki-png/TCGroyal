-- =============================================
-- トップページ バナー設定
-- =============================================

create table if not exists public.homepage_banners (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default '',
  image_url    text not null,
  storage_path text,
  link_url     text not null default '#',
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.homepage_banners enable row level security;

create policy "公開中のバナーは全員が参照できる"
  on public.homepage_banners for select
  using (is_active = true);

create policy "管理者はバナーを参照できる"
  on public.homepage_banners for select
  using (
    exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );

create policy "管理者はバナーを作成できる"
  on public.homepage_banners for insert
  with check (
    exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );

create policy "管理者はバナーを更新できる"
  on public.homepage_banners for update
  using (
    exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );

create policy "管理者はバナーを削除できる"
  on public.homepage_banners for delete
  using (
    exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );

create trigger set_updated_at_homepage_banners
  before update on public.homepage_banners
  for each row execute function public.handle_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-banners',
  'site-banners',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "バナー画像は全員が参照できる"
  on storage.objects for select
  using (bucket_id = 'site-banners');

create policy "管理者はバナー画像を追加できる"
  on storage.objects for insert
  with check (
    bucket_id = 'site-banners'
    and exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );

create policy "管理者はバナー画像を更新できる"
  on storage.objects for update
  using (
    bucket_id = 'site-banners'
    and exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );

create policy "管理者はバナー画像を削除できる"
  on storage.objects for delete
  using (
    bucket_id = 'site-banners'
    and exists (
      select 1 from public.admin_users
      where admin_users.id = auth.uid()
    )
  );
