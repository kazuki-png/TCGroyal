-- Coupon redemptions are finalized only when an order reaches completed.
-- Existing non-completed orders may have been recorded at order creation time
-- by the previous implementation, so remove those provisional records.
delete from public.coupon_redemptions as redemptions
using public.orders as orders
where redemptions.order_id = orders.id
  and orders.status <> 'completed';

-- Backfill completed one-use coupon orders as redeemed.
insert into public.coupon_redemptions (
  coupon_id,
  user_id,
  order_id,
  one_use_per_user
)
select
  orders.coupon_id,
  orders.user_id,
  orders.id,
  true
from public.orders as orders
join public.coupons as coupons
  on coupons.id = orders.coupon_id
where orders.status = 'completed'
  and orders.coupon_id is not null
  and coupons.one_use_per_user
on conflict do nothing;
