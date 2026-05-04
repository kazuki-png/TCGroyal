-- =============================================
-- order_number 自動採番
-- 形式: YYYYMMDD-XX（例: 20260504-01）
-- 日本時間基準、日付ごとに連番リセット
-- =============================================

create or replace function public.generate_order_number()
returns trigger language plpgsql as $$
declare
  v_today text    := to_char(current_timestamp at time zone 'Asia/Tokyo', 'YYYYMMDD');
  v_max   text;
  v_seq   integer;
begin
  select max(substring(order_number from '\d+$'))
    into v_max
    from public.orders
   where order_number like v_today || '-%';

  v_seq := coalesce(v_max::integer, 0) + 1;

  new.order_number := v_today || '-' || lpad(v_seq::text, 2, '0');
  return new;
end;
$$;

create trigger set_order_number
  before insert on public.orders
  for each row
  execute function public.generate_order_number();
