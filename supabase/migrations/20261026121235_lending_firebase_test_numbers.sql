-- Reserved fictional NANP numbers are accepted only by the Preview Firebase server.
BEGIN;
ALTER TABLE public.lending_firebase_accounts DROP CONSTRAINT lending_firebase_accounts_phone_check;
ALTER TABLE public.lending_firebase_accounts ADD CONSTRAINT lending_firebase_accounts_phone_check
 CHECK(phone ~ '^\+81[789]0[0-9]{8}$' OR phone ~ '^\+165055501[0-9]{2}$');
COMMIT;
