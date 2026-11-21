BEGIN;
-- Server-calculated application-time evidence; never recomputed on offer.
ALTER TABLE public.lending_support_cases ADD COLUMN application_estimate jsonb;
ALTER TABLE public.lending_support_cases DROP CONSTRAINT lending_support_cases_offer_jpy_check;
ALTER TABLE public.lending_support_cases ADD CONSTRAINT lending_support_cases_offer_jpy_check CHECK(offer_jpy BETWEEN 100000 AND 10000000);
DO $migration$
DECLARE definition text; original text;
BEGIN
 SELECT pg_get_functiondef('public.lending_support_create(uuid,jsonb,uuid)'::regprocedure) INTO definition;
 original:=definition;
 definition:=replace(definition,$old$'input',p_input)$old$,$new$'input',p_input-'applicationEstimate')$new$);
 IF definition=original THEN RAISE EXCEPTION 'Unexpected create fingerprint'; END IF;
 original:=definition;
 definition:=replace(definition,'contact_label,collateral_items)','contact_label,collateral_items,application_estimate)');
 definition:=replace(definition,$old$coalesce(p_input->'items','[]'::jsonb)) RETURNING$old$,$new$coalesce(p_input->'items','[]'::jsonb),p_input->'applicationEstimate') RETURNING$new$);
 IF definition=original THEN RAISE EXCEPTION 'Unexpected create insert'; END IF;
 EXECUTE definition;
 SELECT pg_get_functiondef('public.lending_support_command(uuid,uuid,text,jsonb,uuid,integer)'::regprocedure) INTO definition;
 original:=definition;
 definition:=replace(definition,$old$c.offer_jpy:=(p_payload->>'amountJpy')::bigint;c.valuation_jpy:=(p_payload->>'valuationJpy')::bigint;$old$,
 $new$c.offer_jpy:=(p_payload->>'amountJpy')::bigint;c.valuation_jpy:=(p_payload->>'valuationJpy')::bigint;
   IF (c.application_estimate->>'valuationJpy')::bigint IS NOT NULL AND c.valuation_jpy IS DISTINCT FROM (c.application_estimate->>'valuationJpy')::bigint AND length(trim(msg))=0 THEN RAISE EXCEPTION 'valuation_change_reason_required'; END IF;$new$);
 IF definition=original THEN RAISE EXCEPTION 'Unexpected offer command'; END IF;
 EXECUTE definition;
END $migration$;
CREATE FUNCTION public.lending_application_estimate_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.application_estimate IS DISTINCT FROM OLD.application_estimate THEN RAISE EXCEPTION 'application_estimate_immutable'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lending_application_estimate_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_application_estimate_guard() TO service_role;
CREATE TRIGGER lending_application_estimate_immutable BEFORE UPDATE ON public.lending_support_cases FOR EACH ROW EXECUTE FUNCTION public.lending_application_estimate_guard();
COMMIT;
