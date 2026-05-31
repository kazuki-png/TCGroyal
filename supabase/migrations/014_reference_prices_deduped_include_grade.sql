-- Keep different appraisal grades as separate reference-price rows.
-- Otherwise a BGS row with the same card number/name/site can hide the PSA row
-- before the admin CSV export filters to PSA grades.
create or replace view public.reference_prices_deduped as
select distinct on (
  (fetched_at at time zone 'Asia/Tokyo')::date,
  card_number,
  site_name,
  card_name,
  grade
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
  grade,
  fetched_at desc,
  price desc;
