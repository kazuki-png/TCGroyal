-- =============================================
-- Order assessment saved marker
-- =============================================

alter table public.orders
  add column if not exists assessment_saved_at timestamptz;
