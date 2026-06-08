-- =============================================
-- Coupons and post-completion review request email
-- =============================================

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  amount integer not null default 0 check (amount >= 0),
  comment text not null default '',
  one_use_per_user boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists coupons_code_upper_key
  on public.coupons (upper(code));

alter table public.coupons enable row level security;

drop trigger if exists set_updated_at_coupons on public.coupons;
create trigger set_updated_at_coupons
  before update on public.coupons
  for each row execute function public.handle_updated_at();

alter table public.orders
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null,
  add column if not exists coupon_code text,
  add column if not exists coupon_comment text,
  add column if not exists coupon_amount integer not null default 0 check (coupon_amount >= 0),
  add column if not exists completed_at timestamptz,
  add column if not exists review_request_email_scheduled_at timestamptz,
  add column if not exists review_request_email_resend_id text,
  add column if not exists review_request_email_sent_at timestamptz;

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  one_use_per_user boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists coupon_redemptions_order_id_key
  on public.coupon_redemptions (order_id);

create unique index if not exists coupon_redemptions_one_use_per_user_key
  on public.coupon_redemptions (coupon_id, user_id)
  where one_use_per_user;

alter table public.coupon_redemptions enable row level security;

drop policy if exists "users can view own coupon redemptions"
  on public.coupon_redemptions;
create policy "users can view own coupon redemptions"
  on public.coupon_redemptions for select
  using (auth.uid() = user_id);

update public.orders
set completed_at = coalesce(
  (
    select min(order_status_logs.created_at)
    from public.order_status_logs
    where order_status_logs.order_id = orders.id
      and order_status_logs.new_status = 'completed'
  ),
  updated_at
)
where status = 'completed'
  and completed_at is null;

-- 既存の完了済み注文へレビュー依頼メールが一斉予約されないよう、
-- migration適用時点で完了済みの注文は予約済み扱いにする。
update public.orders
set review_request_email_scheduled_at = coalesce(
  review_request_email_scheduled_at,
  now()
)
where status = 'completed'
  and review_request_email_scheduled_at is null;
