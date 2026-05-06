-- =============================================
-- Page view daily aggregates and retention
-- =============================================

create table if not exists public.page_view_daily_counts (
  day date not null,
  path text not null,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, path)
);

alter table public.page_view_daily_counts enable row level security;

create index if not exists page_view_daily_counts_day_idx
  on public.page_view_daily_counts (day desc);

create or replace function public.increment_page_view_daily_count(
  p_path text,
  p_created_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.page_view_daily_counts (day, path, view_count)
  values ((p_created_at at time zone 'Asia/Tokyo')::date, p_path, 1)
  on conflict (day, path) do update
  set view_count = public.page_view_daily_counts.view_count + 1,
      updated_at = now();
end;
$$;

insert into public.page_view_daily_counts (day, path, view_count)
select
  (created_at at time zone 'Asia/Tokyo')::date as day,
  path,
  count(*)::integer as view_count
from public.page_views
group by 1, 2
on conflict (day, path) do update
set view_count = excluded.view_count,
    updated_at = now();

create or replace function public.prune_page_view_logs(
  p_raw_retention_days integer default 90,
  p_aggregate_retention_days integer default 730
)
returns table(deleted_raw bigint, deleted_daily bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with raw_deleted as (
    delete from public.page_views
    where created_at < now() - make_interval(days => greatest(p_raw_retention_days, 1))
    returning 1
  ),
  daily_deleted as (
    delete from public.page_view_daily_counts
    where day < ((now() at time zone 'Asia/Tokyo')::date - greatest(p_aggregate_retention_days, 1))
    returning 1
  )
  select
    (select count(*) from raw_deleted)::bigint as deleted_raw,
    (select count(*) from daily_deleted)::bigint as deleted_daily;
end;
$$;
