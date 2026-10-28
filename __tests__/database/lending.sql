CREATE FUNCTION pg_temp.assert_true(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(command text,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE command; EXCEPTION WHEN others THEN
  IF position(expected in SQLERRM)>0 THEN RETURN; ELSE RAISE; END IF;
 END;
 RAISE EXCEPTION 'Expected error: %',expected;
END $$;

SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','lending_loans','SELECT'),'no direct customer table access');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','lending_list(uuid)','EXECUTE'),'no anonymous financial RPC');
SELECT pg_temp.assert_true(NOT has_table_privilege('service_role','lending_ledger','DELETE'),'no ledger deletion');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname LIKE 'lending_%' AND prosecdef),'no security definer');
SET ROLE service_role;
SELECT pg_temp.expect_error($q$SELECT lending_command(NULL,gen_random_uuid(),'accept','{}',gen_random_uuid(),1)$q$,'invalid_actor');

DO $$ DECLARE
 customer uuid:='10000000-0000-4000-8000-000000000001'; admin uuid:='10000000-0000-4000-8000-000000000002'; other_user uuid:='10000000-0000-4000-8000-000000000003';
 card uuid:='20000000-0000-4000-8000-000000000001'; q jsonb; loan jsonb; lid uuid; key uuid:=gen_random_uuid(); i integer;
 market jsonb:=jsonb_build_object('provider','snkrdunk','productId','408333','grade','PSA10','currency','JPY','floorPriceJpy',1000000,'fetchedAt',now());
BEGIN
 PERFORM pg_temp.expect_error(format('SELECT lending_verify_mapping(%L,%L,%L)',customer,card,'408333'),'forbidden');
 q:=lending_create_quote(customer,card,market);
 loan:=lending_apply(customer,(q->>'id')::uuid,'99990001',300000,'mail',key);lid:=(loan->>'id')::uuid;
 PERFORM pg_temp.assert_true(lending_apply(customer,(q->>'id')::uuid,'99990001',300000,'mail',key)=loan,'idempotent apply');
 PERFORM pg_temp.expect_error(format('SELECT lending_apply(%L,%L,%L,200000,%L,%L)',customer,q->>'id','99990001','mail',key),'idempotency_conflict');
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),1)',other_user,lid,'cancel','{}'),'not_found');
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),1)',customer,lid,'receive','{}'),'forbidden');
 q:=lending_create_quote(customer,card,market);
 PERFORM pg_temp.expect_error(format('SELECT lending_apply(%L,%L,%L,300000,%L,gen_random_uuid())',customer,q->>'id','99990001','mail'),'lending_reserved_cert');
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),1)',admin,lid,'offer','{"amountJpy":300000,"monthlyRateBps":200}'),'invalid_transition');
 loan:=lending_command(admin,lid,'receive','{"location":"SAFE-A1","certNumber":"99990001","inspected":true}',gen_random_uuid(),1);
 loan:=lending_command(admin,lid,'offer',jsonb_build_object('amountJpy',300000,'monthlyRateBps',200,'market',market),gen_random_uuid(),2);
 PERFORM pg_temp.assert_true(loan->'terms'->>'assessmentQuoteId' IS NOT NULL,'offer links to a persisted reassessment');
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),3)',customer,lid,'accept','{"termsAccepted":false}'),'consent_required');
 loan:=lending_command(customer,lid,'accept','{"termsAccepted":true}',gen_random_uuid(),3);
 key:=gen_random_uuid();
 loan:=lending_command(admin,lid,'fund','{"amountJpy":300000,"reference":"fund-main-1"}',key,4);
 PERFORM pg_temp.assert_true(lending_command(admin,lid,'fund','{"amountJpy":300000,"reference":"fund-main-1"}',key,4)=loan,'fund retry is idempotent');
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),4)',admin,lid,'fund','{"amountJpy":300000,"reference":"fund-main-2"}'),'version_conflict');
 loan:=lending_command(customer,lid,'report_repayment','{}',gen_random_uuid(),5);
 PERFORM pg_temp.assert_true((loan->>'principal_jpy')::bigint=300000,'customer claim never clears principal');
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),6)',admin,lid,'confirm_repayment','{"amountJpy":300000,"reference":"repay-main-1"}'),'repayment_amount_mismatch');
 loan:=lending_command(admin,lid,'confirm_repayment','{"amountJpy":306000,"reference":"repay-main-1"}',gen_random_uuid(),6);
 PERFORM pg_temp.assert_true(loan->>'status'='return_pending' AND (loan->>'principal_jpy')::bigint=0,'verified repayment clears principal');
 loan:=lending_command(admin,lid,'return','{"reference":"return-tracking-1"}',gen_random_uuid(),7);
 PERFORM pg_temp.assert_true(loan->>'status'='returned','return completes flow');
 PERFORM pg_temp.assert_true(jsonb_array_length(lending_list(other_user)->'loans')=0,'cross tenant list isolation');
 PERFORM pg_temp.assert_true(NOT ((lending_list(customer)->'loans'->0) ? 'inspected_by'),'no reviewer identifier exposed');
 PERFORM pg_temp.expect_error(format('UPDATE lending_quotes SET cap_jpy=100000 WHERE id=%L',q->>'id'),'immutable_evidence');
 PERFORM pg_temp.expect_error(format('UPDATE lending_events SET action=%L WHERE loan_id=%L','tamper',lid),'immutable_evidence');
 PERFORM pg_temp.expect_error(format('UPDATE lending_ledger SET amount_jpy=1 WHERE loan_id=%L',lid),'immutable_evidence');
 -- Prepare an accepted loan for the concurrency check in the Node runner.
 q:=lending_create_quote(customer,card,market);
 loan:=lending_apply(customer,(q->>'id')::uuid,'99990002',300000,'store',gen_random_uuid());lid:=(loan->>'id')::uuid;
 PERFORM lending_command(admin,lid,'receive','{"location":"SAFE-A2","certNumber":"99990002","inspected":true}',gen_random_uuid(),1);
 PERFORM lending_command(admin,lid,'offer',jsonb_build_object('amountJpy',300000,'monthlyRateBps',200,'market',market),gen_random_uuid(),2);
 PERFORM lending_command(customer,lid,'accept','{"termsAccepted":true}',gen_random_uuid(),3);
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),4)',admin,lid,'fund','{"amountJpy":300000,"reference":"fund-main-1"}'),'lending_ledger_external_reference_key');
END $$;

DO $$ DECLARE
 customer uuid:='10000000-0000-4000-8000-000000000001'; admin uuid:='10000000-0000-4000-8000-000000000002';
 card uuid:='20000000-0000-4000-8000-000000000001'; q jsonb; loan jsonb; lid uuid; before_count integer;
 market jsonb:=jsonb_build_object('provider','snkrdunk','productId','408333','grade','PSA10','currency','JPY','floorPriceJpy',1000000,'fetchedAt',now());
BEGIN
 q:=lending_create_quote(customer,card,market);
 loan:=lending_apply(customer,(q->>'id')::uuid,'99990003',300000,'mail',gen_random_uuid());lid:=(loan->>'id')::uuid;
 PERFORM lending_command(admin,lid,'receive','{"location":"SAFE-A3","certNumber":"99990003","inspected":true}',gen_random_uuid(),1);
 -- Arrival revaluation must enforce a lower fresh cap, not the old estimate.
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),2)',admin,lid,'offer',
 jsonb_build_object('amountJpy',300000,'monthlyRateBps',0,'market',market||'{"floorPriceJpy":600000}'::jsonb)),'amount_invalid');
 loan:=lending_command(admin,lid,'offer',jsonb_build_object('amountJpy',200000,'monthlyRateBps',0,'market',market),gen_random_uuid(),2);
 PERFORM lending_command(customer,lid,'accept','{"termsAccepted":true}',gen_random_uuid(),3);
 UPDATE profiles SET address='Changed identity address' WHERE id=customer;
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),4)',admin,lid,'fund','{"amountJpy":200000,"reference":"fund-invalid-identity"}'),'identity_or_offer_expired');
 UPDATE lending_identity_checks SET expires_at=now()+interval '1 day' WHERE user_id=customer;
 -- Revising accepted terms requires a fresh customer agreement.
 loan:=lending_command(admin,lid,'offer',jsonb_build_object('amountJpy',200000,'monthlyRateBps',0,'market',market),gen_random_uuid(),4);
 PERFORM pg_temp.assert_true(loan->>'status'='offered' AND loan->>'terms_accepted_at' IS NULL,'revised conditions clear prior consent');
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),5)',admin,lid,'fund','{"amountJpy":200000,"reference":"fund-unaccepted"}'),'invalid_transition');
 loan:=lending_command(customer,lid,'cancel','{}',gen_random_uuid(),5);
 PERFORM pg_temp.assert_true(loan->>'status'='return_pending','received cancellation preserves custody');
 q:=lending_create_quote(customer,card,market);
 PERFORM pg_temp.expect_error(format('SELECT lending_apply(%L,%L,%L,100000,%L,gen_random_uuid())',customer,q->>'id','99990003','store'),'lending_reserved_cert');
 PERFORM lending_command(admin,lid,'return','{"reference":"return-cancelled-1"}',gen_random_uuid(),6);
 loan:=lending_apply(customer,(q->>'id')::uuid,'99990003',100000,'store',gen_random_uuid());
 PERFORM lending_command(customer,(loan->>'id')::uuid,'cancel','{}',gen_random_uuid(),1);
 -- Zero-interest extension is valid and must not create a zero-valued ledger entry.
 q:=lending_create_quote(customer,card,market);
 loan:=lending_apply(customer,(q->>'id')::uuid,'99990004',100000,'store',gen_random_uuid());lid:=(loan->>'id')::uuid;
 PERFORM lending_command(admin,lid,'receive','{"location":"SAFE-A4","certNumber":"99990004","inspected":true}',gen_random_uuid(),1);
 PERFORM lending_command(admin,lid,'offer',jsonb_build_object('amountJpy',100000,'monthlyRateBps',0,'market',market),gen_random_uuid(),2);
 PERFORM lending_command(customer,lid,'accept','{"termsAccepted":true}',gen_random_uuid(),3);
 PERFORM lending_command(admin,lid,'fund','{"amountJpy":100000,"reference":"fund-zero-interest"}',gen_random_uuid(),4);
 PERFORM lending_command(customer,lid,'request_extension','{"termsAccepted":true}',gen_random_uuid(),5);
 PERFORM lending_command(admin,lid,'extend','{"amountJpy":0,"reference":"extend-zero-interest"}',gen_random_uuid(),6);
 PERFORM pg_temp.expect_error(format('UPDATE lending_requests SET amount_jpy=1 WHERE loan_id=%L',lid),'immutable_request_evidence');
 PERFORM pg_temp.assert_true((SELECT count(*) FROM lending_events WHERE loan_id=lid AND action='accept' AND details->'termsSnapshot'->>'principalJpy'='100000')=1,'immutable consent captures exact accepted terms');
 PERFORM pg_temp.assert_true((SELECT count(*) FROM lending_ledger WHERE loan_id=lid)=1,'zero interest extension has no cash entry');
 PERFORM lending_command(customer,lid,'request_additional','{"amountJpy":10000,"termsAccepted":true}',gen_random_uuid(),7);
 UPDATE lending_loans SET due_at=now()-interval '1 day' WHERE id=lid;
 PERFORM pg_temp.expect_error(format('SELECT lending_command(%L,%L,%L,%L,gen_random_uuid(),8)',admin,lid,'forfeit','{"reviewed":true}'),'unresolved_request');
 PERFORM lending_command(admin,lid,'reject_request','{}',gen_random_uuid(),8);
 loan:=lending_command(admin,lid,'forfeit','{"reviewed":true}',gen_random_uuid(),9);
 PERFORM pg_temp.assert_true((loan->>'principal_jpy')::bigint=0 AND loan->>'status'='forfeited','forfeiture clears debt by explicit ledger event');
 q:=lending_create_quote(customer,card,market);
 PERFORM pg_temp.expect_error(format('SELECT lending_apply(%L,%L,%L,100000,%L,gen_random_uuid())',customer,q->>'id','99990004','store'),'lending_reserved_cert');
 -- Aggregate customer limit includes pending reservations, not just funded loans.
 UPDATE cards SET buy_price=100000000 WHERE public_uid=card;
 q:=lending_create_quote(customer,card,market||'{"floorPriceJpy":100000000}'::jsonb);
 PERFORM pg_temp.expect_error(format('SELECT lending_apply(%L,%L,%L,9900000,%L,gen_random_uuid())',customer,q->>'id','99990005','store'),'customer_limit_exceeded');
 UPDATE cards SET buy_price=1000000 WHERE public_uid=card;
END $$;
RESET ROLE;
SELECT pg_temp.assert_true(lending_interest(300000,200,'2026-01-31T03:00:00Z','2026-02-28T03:00:00Z')=6000,'clamped calendar anniversary');
SELECT pg_temp.assert_true(lending_interest(300000,200,'2026-01-31T03:00:00Z','2026-02-28T03:00:01Z')=12000,'next month begins after anniversary');
SELECT pg_temp.assert_true(lending_interest(300000,200,'2026-01-31T03:00:00Z','2027-01-31T03:00:00Z')=18000,'interest capped at agreed three months');
SELECT 'SQL lending workflow assertions passed';
