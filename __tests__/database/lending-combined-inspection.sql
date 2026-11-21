BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE cid uuid; qid uuid; lid uuid; c jsonb; key uuid:=gen_random_uuid();
 customer uuid:='10000000-0000-4000-8000-000000000001'; admin uuid:='10000000-0000-4000-8000-000000000002';
BEGIN
 INSERT INTO lending_support_cases(user_id,created_by,source,reason,card_name) VALUES(customer,customer,'app','other','RECEIPT-TEST') RETURNING id INTO cid;
 INSERT INTO lending_quotes(user_id,card_name,market_snapshot,cap_jpy,source,support_case_id) VALUES(customer,'RECEIPT-TEST','{}',300000,'support',cid) RETURNING id INTO qid;
 INSERT INTO lending_loans(user_id,quote_id,requested_jpy,deposit_method) VALUES(customer,qid,300000,'mail') RETURNING id INTO lid;
 BEGIN
  PERFORM lending_command(admin,lid,'arrive','{}',gen_random_uuid(),1);RAISE EXCEPTION 'Arrival still enabled';
 EXCEPTION WHEN others THEN IF SQLERRM<>'invalid_transition' THEN RAISE; END IF; END;
 BEGIN
  PERFORM lending_command(admin,lid,'receive','{}',gen_random_uuid(),1);RAISE EXCEPTION 'Inspection skipped';
 EXCEPTION WHEN others THEN IF SQLERRM<>'inspection_required' THEN RAISE; END IF; END;
 ASSERT public.lending_collateral_inspected('[{"id":"one","quantity":2}]','[{"id":"one","quantity":2,"checked":true}]');
 ASSERT NOT public.lending_collateral_inspected('[{"id":"one","quantity":2}]','[{"id":"one","quantity":1,"checked":true}]');
 c:=lending_command(admin,lid,'receive','{"inspected":true}',key,1);
 ASSERT c->>'status'='received' AND c->>'inspected_at' IS NOT NULL AND c->>'received_at' IS NOT NULL;
 ASSERT c->>'storage_location' IS NULL;
 ASSERT lending_command(admin,lid,'receive','{"inspected":true}',key,1)=c;
 c:=lending_command(customer,lid,'cancel','{}',gen_random_uuid(),2);
 ASSERT c->>'status'='return_pending';
 ASSERT (SELECT count(*) FROM lending_ledger WHERE loan_id=lid)=0;
END $$;
ROLLBACK;
