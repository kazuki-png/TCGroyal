-- COALESCE(card_number, '') を除去し NULL を型番として正しく重複排除する
-- PostgreSQL の DISTINCT ON は NULL 同士を同一グループとして扱う
create or replace view public.reference_prices_deduped as
select distinct on (
  (fetched_at at time zone 'Asia/Tokyo')::date,
  card_number,
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
  card_number nulls first,
  site_name,
  card_name,
  fetched_at desc;
