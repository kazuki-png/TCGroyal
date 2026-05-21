-- =============================================
-- Order assessment workflow
-- =============================================

alter table public.order_items
  add column if not exists assessed_unit_price integer,
  add column if not exists customer_decision text,
  add column if not exists customer_decided_at timestamptz;

update public.order_items
set assessed_unit_price = unit_price
where assessed_unit_price is null;

alter table public.order_items
  alter column assessed_unit_price set default 0,
  alter column assessed_unit_price set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_customer_decision_check'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_customer_decision_check
      check (customer_decision in ('approved', 'cancelled'));
  end if;
end $$;
