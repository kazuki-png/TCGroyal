-- Collectors Republic が参照するカード価格用の公開境界。
-- cards.id は内部参照用のため、外部連携には public_uid を使用する。
-- UIDや公開設定の更新を価格更新として扱わない。
CREATE OR REPLACE FUNCTION public.set_buy_price_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.buy_price IS DISTINCT FROM OLD.buy_price THEN
    NEW.buy_price_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS public_uid uuid,
  ADD COLUMN IF NOT EXISTS is_available_for_collectors boolean NOT NULL DEFAULT false;

UPDATE public.cards
SET public_uid = gen_random_uuid()
WHERE public_uid IS NULL;

ALTER TABLE public.cards
  ALTER COLUMN public_uid SET DEFAULT gen_random_uuid(),
  ALTER COLUMN public_uid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cards_public_uid_key
  ON public.cards (public_uid);

COMMENT ON COLUMN public.cards.public_uid IS
  'Stable external identifier for Collectors Republic price lookups.';
COMMENT ON COLUMN public.cards.is_available_for_collectors IS
  'Explicit opt-in for exposing a card price through Collectors Republic RPCs.';

-- This is a group role. Provision a separate LOGIN role manually for Collectors
-- Republic, grant it this role, and keep that connection string server-side.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'collectors_republic') THEN
    CREATE ROLE collectors_republic NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_collectors_card_price(input_public_uid text)
RETURNS TABLE (
  public_uid text,
  card_name text,
  game text,
  card_number text,
  rarity text,
  buy_price_jpy integer,
  price_updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    c.public_uid::text,
    c.name,
    c.category,
    c.card_number,
    c.grade,
    c.buy_price,
    c.buy_price_updated_at
  FROM public.cards AS c
  WHERE c.public_uid::text = trim(input_public_uid)
    AND c.is_available_for_collectors = true
    AND c.buy_price > 0
    AND c.buy_price_updated_at IS NOT NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_collectors_card_prices(input_public_uids text[])
RETURNS TABLE (
  public_uid text,
  card_name text,
  game text,
  card_number text,
  rarity text,
  buy_price_jpy integer,
  price_updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    c.public_uid::text,
    c.name,
    c.category,
    c.card_number,
    c.grade,
    c.buy_price,
    c.buy_price_updated_at
  FROM public.cards AS c
  WHERE c.public_uid::text = ANY(input_public_uids)
    AND c.is_available_for_collectors = true
    AND c.buy_price > 0
    AND c.buy_price_updated_at IS NOT NULL
  ORDER BY array_position(input_public_uids, c.public_uid::text);
$$;

REVOKE ALL ON TABLE public.cards FROM collectors_republic;
REVOKE SELECT ON TABLE public.cards FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO collectors_republic;
REVOKE ALL ON FUNCTION public.get_collectors_card_price(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_collectors_card_prices(text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_collectors_card_price(text) TO collectors_republic;
GRANT EXECUTE ON FUNCTION public.get_collectors_card_prices(text[]) TO collectors_republic;

-- The public site reads its explicitly selected display fields through the
-- Next.js server. Do not leave a permissive direct Data API policy in place.
DO $$
DECLARE
  select_policy_name text;
BEGIN
  FOR select_policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cards'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cards', select_policy_name);
  END LOOP;
END
$$;
