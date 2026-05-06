-- =============================================
-- Page view tracking
-- =============================================

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  session_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.page_views enable row level security;

create index if not exists page_views_created_at_idx
  on public.page_views (created_at desc);

create index if not exists page_views_session_path_created_at_idx
  on public.page_views (session_id, path, created_at desc);

create index if not exists page_views_path_created_at_idx
  on public.page_views (path, created_at desc);
