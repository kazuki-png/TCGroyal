-- =============================================
-- TCG Royal 初期マイグレーション
-- =============================================

-- profiles（ユーザー詳細情報）
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  postal_code text,
  address     text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "ユーザーは自分のプロフィールを参照できる"
  on public.profiles for select
  using (auth.uid() = id);

create policy "ユーザーは自分のプロフィールを更新できる"
  on public.profiles for update
  using (auth.uid() = id);

create policy "ユーザーは自分のプロフィールを作成できる"
  on public.profiles for insert
  with check (auth.uid() = id);

-- cards（カードマスタ）
create table if not exists public.cards (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text not null check (category in ('pokemon', 'onepiece')),
  grade      text not null check (grade in ('PSA10', 'PSA9', 'PSA8')),
  buy_price  integer not null default 0,
  image_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cards enable row level security;

create policy "カードは全員が参照できる"
  on public.cards for select
  using (true);

-- orders（買取申込）
create type public.order_status as enum (
  'unhandled',
  'accepted',
  'waiting_arrival',
  'inspecting',
  'pending_approval',
  'pending_transfer',
  'completed'
);

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          public.order_status not null default 'unhandled',
  total_amount    integer not null default 0,
  bank_name       text,
  bank_branch     text,
  bank_account_no text,
  bank_holder     text,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "ユーザーは自分の注文を参照できる"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "ユーザーは注文を作成できる"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- order_items（注文明細）
create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  card_id    uuid references public.cards(id) on delete set null,
  card_name  text not null,
  grade      text not null,
  quantity   integer not null default 1 check (quantity > 0),
  unit_price integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;

create policy "ユーザーは自分の注文明細を参照できる"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

create policy "ユーザーは注文明細を作成できる"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

-- order_status_logs（ステータス変更履歴）
create table if not exists public.order_status_logs (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  old_status public.order_status,
  new_status public.order_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.order_status_logs enable row level security;

create policy "ユーザーは自分の注文のログを参照できる"
  on public.order_status_logs for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_status_logs.order_id
        and orders.user_id = auth.uid()
    )
  );

-- admin_users（管理者）
create table if not exists public.admin_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "管理者は管理者テーブルを参照できる"
  on public.admin_users for select
  using (auth.uid() = id);

-- =============================================
-- updated_at 自動更新トリガー
-- =============================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_cards
  before update on public.cards
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_orders
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- =============================================
-- 新規ユーザー登録時に profiles を自動作成
-- =============================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
