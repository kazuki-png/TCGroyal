-- Disposable fixtures only. The caller wraps remote verification in a rollback.
CREATE OR REPLACE FUNCTION pg_temp.custody_loan(customer uuid, state text DEFAULT 'submitted') RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE cid uuid; qid uuid; lid uuid;
BEGIN
 INSERT INTO public.lending_support_cases(user_id,created_by,source,reason,card_name)
 VALUES(customer,customer,'app','other','CUSTODY-SYNTHETIC') RETURNING id INTO cid;
 INSERT INTO public.lending_quotes(user_id,card_name,market_snapshot,cap_jpy,source,support_case_id)
 VALUES(customer,'CUSTODY-SYNTHETIC','{}',300000,'support',cid) RETURNING id INTO qid;
 INSERT INTO public.lending_loans(user_id,quote_id,requested_jpy,deposit_method,status)
 VALUES(customer,qid,300000,'mail',state) RETURNING id INTO lid;
 RETURN lid;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.custody_error(command text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE command; EXCEPTION WHEN others THEN
  IF SQLERRM=expected THEN RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'Expected %',expected;
END $$;
SET ROLE service_role;
DO $$
DECLARE customer uuid:='10000000-0000-4000-8000-000000000001'; admin uuid:='10000000-0000-4000-8000-000000000002'; other_user uuid:='10000000-0000-4000-8000-000000000003';
 lid uuid; res jsonb; key uuid; state text;
BEGIN
 lid:=pg_temp.custody_loan(customer);
 PERFORM pg_temp.custody_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),1)',customer,lid,'arrive','{"location":"A"}'),'forbidden');
 PERFORM pg_temp.custody_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),1)',admin,lid,'arrive','{}'),'receipt_location_required');
 key:=gen_random_uuid();
 res:=lending_command(admin,lid,'arrive','{"location":"RECEIVING-A"}',key,1);
 ASSERT res->>'status'='received' AND res->>'received_at' IS NOT NULL AND res->>'inspected_at' IS NULL, 'arrival is not inspection';
 ASSERT lending_command(admin,lid,'arrive','{"location":"RECEIVING-A"}',key,1)=res, 'arrival retry';
 PERFORM pg_temp.custody_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),2)',admin,lid,'offer','{}'),'inspection_required');
 PERFORM pg_temp.custody_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),2)',other_user,lid,'cancel','{}'),'not_found');
 PERFORM pg_temp.custody_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),2)',admin,lid,'cancel','{}'),'forbidden');
 key:=gen_random_uuid();
 res:=lending_command(customer,lid,'cancel','{"reason":"融資が不要になった"}',key,2);
 ASSERT res->>'status'='return_pending' AND res->>'inspected_at' IS NULL, 'uninspected custody must be returned';
 ASSERT lending_command(customer,lid,'cancel','{"reason":"融資が不要になった"}',key,2)=res, 'cancellation retry';
 ASSERT (SELECT count(*)=1 FROM lending_events WHERE loan_id=lid AND action='cancel' AND actor_id=customer AND details->>'reason'='融資が不要になった' AND created_at IS NOT NULL), 'audit reason and actor';
 ASSERT (SELECT count(*)=1 FROM lending_status_notifications WHERE entity_id=lid AND entity_kind='loan' AND to_status='return_pending'), 'one return-pending notification';
 PERFORM pg_temp.custody_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),2)',admin,lid,'offer','{}'),'version_conflict');
 FOREACH state IN ARRAY ARRAY['offer','fund','receive','arrive'] LOOP
  PERFORM pg_temp.custody_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),3)',admin,lid,state,'{}'),'invalid_transition');
 END LOOP;
 res:=lending_command(admin,lid,'return','{"reference":"CUSTODY-RETURN-001"}',gen_random_uuid(),3);
 ASSERT res->>'status'='returned', 'uninspected card return completes';
 ASSERT NOT EXISTS(SELECT 1 FROM lending_ledger WHERE loan_id=lid), 'cancellation creates no monetary ledger';
 -- Legacy rows may not have the new timestamp: their existing status still proves custody.
 FOREACH state IN ARRAY ARRAY['received','offered','accepted'] LOOP
  lid:=pg_temp.custody_loan(customer,state);
  res:=lending_command(customer,lid,'cancel','{}',gen_random_uuid(),1);
  ASSERT res->>'status'='return_pending', 'legacy custody fallback';
  ASSERT EXISTS(SELECT 1 FROM lending_events WHERE loan_id=lid AND details->>'reason'='利用者による申込キャンセル'), 'old app default reason';
 END LOOP;
 lid:=pg_temp.custody_loan(customer);
 res:=lending_command(customer,lid,'cancel','{}',gen_random_uuid(),1);
 ASSERT res->>'status'='cancelled', 'unreceived cancellation';
 lid:=pg_temp.custody_loan(customer,'active');
 PERFORM pg_temp.custody_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),1)',customer,lid,'cancel','{}'),'invalid_transition');
 lid:=pg_temp.custody_loan(customer);
 PERFORM lending_command(admin,lid,'arrive','{"location":"A"}',gen_random_uuid(),1);
 res:=lending_command(admin,lid,'receive','{"location":"A","inspected":true}',gen_random_uuid(),2);
 ASSERT res->>'inspected_at' IS NOT NULL, 'inspection after arrival';
 lid:=pg_temp.custody_loan(customer);
 PERFORM lending_command(admin,lid,'arrive','{"location":"A"}',gen_random_uuid(),1);
 res:=lending_command(admin,lid,'reject','{"reason":"現物査定で見送り"}',gen_random_uuid(),2);
 ASSERT res->>'status'='return_pending', 'admin rejection also returns uninspected custody';
 RAISE NOTICE 'Custody, owner cancellation, audit, notification, idempotency, stale version, financial guards and return passed.';
END $$;
RESET ROLE;
