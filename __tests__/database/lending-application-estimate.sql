BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE c jsonb; cid uuid; k uuid:=gen_random_uuid(); v integer; result jsonb;
 customer uuid:='10000000-0000-4000-8000-000000000001'; admin uuid:='10000000-0000-4000-8000-000000000002';
 input jsonb:='{"reason":"other","cardName":"ESTIMATE-TEST","consent":true,"applicationEstimate":{"valuationJpy":1051740,"amountJpy":315522}}';
BEGIN
 c:=public.lending_support_create(customer,input,k); cid:=(c->>'id')::uuid;
 IF c->'application_estimate' IS DISTINCT FROM input->'applicationEstimate' THEN RAISE EXCEPTION 'Snapshot missing'; END IF;
 result:=public.lending_support_create(customer,jsonb_set(input,'{applicationEstimate,valuationJpy}','999999'),k);
 IF result IS DISTINCT FROM c THEN RAISE EXCEPTION 'Retry changed snapshot'; END IF;
 c:=public.lending_support_command(admin,cid,'review','{}',gen_random_uuid(),1);
 c:=public.lending_support_command(admin,cid,'offer','{"amountJpy":315522,"valuationJpy":1051740}',gen_random_uuid(),2);
 IF (c->>'offer_jpy')::bigint<>315522 THEN RAISE EXCEPTION 'Estimate rounded'; END IF;
 v:=(c->>'version')::integer;
 BEGIN
  PERFORM public.lending_support_command(admin,cid,'offer','{"amountJpy":300000,"valuationJpy":1000000,"message":"   "}',gen_random_uuid(),v);
  RAISE EXCEPTION 'Missing reason accepted';
 EXCEPTION WHEN others THEN IF SQLERRM<>'valuation_change_reason_required' THEN RAISE; END IF; END;
 c:=public.lending_support_command(admin,cid,'offer','{"amountJpy":300000,"valuationJpy":1000000,"message":"Inspection adjustment"}',gen_random_uuid(),v);
 BEGIN
  UPDATE public.lending_support_cases SET application_estimate='{}' WHERE id=cid;
  RAISE EXCEPTION 'Snapshot mutable';
 EXCEPTION WHEN others THEN IF SQLERRM<>'application_estimate_immutable' THEN RAISE; END IF; END;
 c:=public.lending_support_command(admin,cid,'offer','{"amountJpy":310000,"valuationJpy":1051740}',gen_random_uuid(),v+1);
 -- Unknown original valuation is not treated as zero.
 c:=public.lending_support_create(customer,input-'applicationEstimate',gen_random_uuid()); cid:=(c->>'id')::uuid;
 c:=public.lending_support_command(admin,cid,'review','{}',gen_random_uuid(),1);
 PERFORM public.lending_support_command(admin,cid,'offer','{"amountJpy":300000,"valuationJpy":1000000}',gen_random_uuid(),2);
END $$;
ROLLBACK;
