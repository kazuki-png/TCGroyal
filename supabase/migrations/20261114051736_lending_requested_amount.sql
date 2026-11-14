BEGIN;
-- Consultation requests are not approved loans. Keep the contract/funding limits unchanged.
ALTER TABLE public.lending_support_cases DROP CONSTRAINT lending_support_cases_requested_jpy_check;
ALTER TABLE public.lending_support_cases ADD CONSTRAINT lending_support_cases_requested_jpy_check CHECK (requested_jpy BETWEEN 1 AND 9007199254740991);
COMMIT;
