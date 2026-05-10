-- =============================================
-- 参考価格 重複排除ビュー
-- 同一（型番 + ショップ + カード名 + 取得日）で最新1件のみ
-- =============================================
create or replace view public.reference_prices_deduped as
select distinct on (
  (fetched_at at time zone 'Asia/Tokyo')::date,
  coalesce(card_number, ''),
  site_name,
  card_name
)
  id,
  category,
  card_name,
  card_number,
  grade,
  price,
  site_name,
  fetched_at,
  (fetched_at at time zone 'Asia/Tokyo')::date as fetched_date
from public.reference_prices
order by
  (fetched_at at time zone 'Asia/Tokyo')::date,
  coalesce(card_number, ''),
  site_name,
  card_name,
  fetched_at desc;
