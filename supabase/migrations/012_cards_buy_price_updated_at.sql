ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS buy_price_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_buy_price_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.buy_price_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cards_buy_price_updated_at ON public.cards;

CREATE TRIGGER cards_buy_price_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_buy_price_updated_at();
