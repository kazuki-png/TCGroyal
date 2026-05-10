-- =============================================
-- 参考価格テーブル
-- =============================================
create table if not exists public.reference_prices (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('pokemon', 'onepiece')),
  card_name   text not null,
  card_number text,
  grade       text not null,
  price       integer not null,
  site_name   text not null,
  fetched_at  timestamptz not null default now()
);

alter table public.reference_prices enable row level security;

-- 一般ユーザーは参照のみ可
create policy "参考価格は誰でも参照できる"
  on public.reference_prices for select
  using (true);

create index if not exists reference_prices_fetched_at_idx
  on public.reference_prices (fetched_at desc);

create index if not exists reference_prices_category_idx
  on public.reference_prices (category);

create index if not exists reference_prices_card_number_idx
  on public.reference_prices (card_number);
