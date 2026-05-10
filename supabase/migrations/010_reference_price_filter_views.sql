-- フィルター選択肢用の DISTINCT ビュー（PostgREST の行制限を回避）
create or replace view public.reference_price_distinct_sites as
select distinct site_name from public.reference_prices order by site_name;

create or replace view public.reference_price_distinct_grades as
select distinct grade from public.reference_prices order by grade;
