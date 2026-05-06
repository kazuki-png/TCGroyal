-- TCG Royal cart dummy cards
-- Supabase SQL Editor or psql で必要な時だけ実行してください。
-- 同じ name/category/card_number/grade の行は重複投入しません。

with featured_cards(category, name, card_number, grade, buy_price) as (
  values
    ('pokemon', 'ガルーラ', '109/244', 'PSA10', 160000),
    ('pokemon', 'ピカチュウ', '025/165', 'PSA10', 128000),
    ('pokemon', 'リザードン', '006/102', 'PSA10', 240000),
    ('pokemon', 'ミュウツー', '150/165', 'PSA10', 98000),
    ('pokemon', 'イーブイ', '133/165', 'PSA9', 42000),
    ('pokemon', 'ブラッキー', '197/203', 'PSA10', 185000),
    ('pokemon', 'ゲンガー', '094/165', 'PSA10', 112000),
    ('pokemon', 'カビゴン', '143/165', 'PSA8', 26000),
    ('onepiece', 'モンキー・D・ルフィ', 'OP01-001', 'PSA10', 95000),
    ('onepiece', 'ロロノア・ゾロ', 'OP01-025', 'PSA10', 88000),
    ('onepiece', 'ナミ', 'OP01-016', 'PSA10', 72000),
    ('onepiece', 'シャンクス', 'OP01-120', 'PSA10', 210000),
    ('onepiece', 'ポートガス・D・エース', 'OP02-013', 'PSA9', 66000),
    ('onepiece', 'トラファルガー・ロー', 'OP05-069', 'PSA10', 81000)
),
generated_pokemon as (
  select
    'pokemon'::text as category,
    'ポケモン ダミーカード ' || lpad(gs::text, 3, '0') as name,
    lpad((100 + gs)::text, 3, '0') || '/' || lpad((240 + (gs % 60))::text, 3, '0') as card_number,
    case
      when gs % 11 = 0 then 'PSA8'
      when gs % 5 = 0 then 'PSA9'
      else 'PSA10'
    end as grade,
    (3000 + gs * 1270 + (gs % 9) * 1800)::integer as buy_price
  from generate_series(1, 90) as gs
),
generated_onepiece as (
  select
    'onepiece'::text as category,
    'ワンピース ダミーカード ' || lpad(gs::text, 3, '0') as name,
    'OP' || lpad(((gs % 10) + 1)::text, 2, '0') || '-' || lpad(gs::text, 3, '0') as card_number,
    case
      when gs % 13 = 0 then 'PSA8'
      when gs % 4 = 0 then 'PSA9'
      else 'PSA10'
    end as grade,
    (2500 + gs * 1420 + (gs % 7) * 2100)::integer as buy_price
  from generate_series(1, 80) as gs
),
source as (
  select * from featured_cards
  union all
  select * from generated_pokemon
  union all
  select * from generated_onepiece
)
insert into public.cards (category, name, card_number, grade, buy_price, image_url)
select category, name, card_number, grade, buy_price, null
from source
where not exists (
  select 1
  from public.cards cards
  where cards.category = source.category
    and cards.name = source.name
    and cards.card_number is not distinct from source.card_number
    and cards.grade = source.grade
)
order by category, name, grade;
