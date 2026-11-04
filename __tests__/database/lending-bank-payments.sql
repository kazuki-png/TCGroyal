SET ROLE service_role;
DO $$
DECLARE customer uuid:='10000000-0000-4000-8000-000000000001';admin uuid:='10000000-0000-4000-8000-000000000002';other_user uuid:='10000000-0000-4000-8000-000000000003';q uuid;cid uuid;lid uuid;l lending_loans;res jsonb;key uuid;charge bigint;start_at timestamptz;old_due timestamptz;due_snapshot timestamptz;request_at timestamptz;
BEGIN
 ASSERT lending_charge_months('2026-01-31T03:00:00Z','2026-02-28T14:59:59Z')=1;
 ASSERT lending_charge_months('2026-01-31T03:00:00Z','2026-03-01T00:00:00Z')=2;
 ASSERT lending_month_deadline('2026-01-31T03:00:00Z',2)='2026-03-31T14:59:59.999999Z';
 INSERT INTO lending_support_cases(user_id,created_by,source,reason,card_name) VALUES(customer,customer,'app','other','銀行振込検証') RETURNING id INTO cid;
 INSERT INTO lending_quotes(user_id,card_name,market_snapshot,cap_jpy,source,support_case_id) VALUES(customer,'銀行振込検証','{}',300000,'support',cid) RETURNING id INTO q;
 INSERT INTO lending_loans(user_id,quote_id,requested_jpy,deposit_method,status,principal_jpy,monthly_rate_bps,funded_at,interest_start_at,due_at)
 VALUES(customer,q,300000,'mail','active',300000,200,now()-interval '3 days',now()-interval '3 days',lending_month_deadline(now()-interval '3 days',3)) RETURNING * INTO l;lid:=l.id;
 ASSERT lending_unpaid_charge(l,now())=6000;
 res:=lending_payment_snapshot(customer,lid,(now() AT TIME ZONE 'Asia/Tokyo')::date);ASSERT res->>'chargeLabel'='期限前返済手数料' AND (res->>'totalJpy')::bigint=306000;
 BEGIN PERFORM lending_payment_snapshot(other_user,lid,current_date);RAISE EXCEPTION 'test failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='repayment_not_found';END;
 BEGIN PERFORM lending_command(other_user,lid,'report_repayment','{}',gen_random_uuid(),1);RAISE EXCEPTION 'test failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='not_found';END;
 BEGIN PERFORM lending_command(customer,lid,'report_repayment','{}',gen_random_uuid(),1);RAISE EXCEPTION 'test failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='bank_report_required';END;
 key:=gen_random_uuid();res:=lending_command(customer,lid,'report_repayment',jsonb_build_object('transferName','SYNTHETIC','transferDate',(now() AT TIME ZONE 'Asia/Tokyo')::date),key,1);
 ASSERT lending_command(customer,lid,'report_repayment',jsonb_build_object('transferName','SYNTHETIC','transferDate',(now() AT TIME ZONE 'Asia/Tokyo')::date),key,1)=res;
 ASSERT (SELECT principal_jpy=300000 AND status='repayment_pending' FROM lending_loans WHERE id=lid);
 BEGIN PERFORM lending_command(admin,lid,'confirm_repayment','{"amountJpy":306000,"reference":"BANK-TEST-REPAY"}',gen_random_uuid(),2);RAISE EXCEPTION 'test failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='paid_at_required';END;
 PERFORM lending_command(admin,lid,'confirm_repayment',jsonb_build_object('amountJpy',306000,'reference','BANK-TEST-REPAY','paidAt',now()-interval '1 second'),gen_random_uuid(),2);
 ASSERT (SELECT status='return_pending' AND principal_jpy=0 FROM lending_loans WHERE id=lid);
 ASSERT (SELECT count(*)=1 FROM lending_ledger WHERE loan_id=lid AND kind='repayment' AND received_at IS NOT NULL);
 -- A bank transfer completed before maturity can be reviewed after maturity.
 INSERT INTO lending_support_cases(user_id,created_by,source,reason,card_name) VALUES(customer,customer,'app','other','延長検証') RETURNING id INTO cid;
 INSERT INTO lending_quotes(user_id,card_name,market_snapshot,cap_jpy,source,support_case_id) VALUES(customer,'延長検証','{}',300000,'support',cid) RETURNING id INTO q;
 start_at:=now()-interval '3 months';
 INSERT INTO lending_loans(user_id,quote_id,requested_jpy,deposit_method,status,principal_jpy,monthly_rate_bps,funded_at,interest_start_at,due_at)
 VALUES(customer,q,300000,'mail','active',300000,200,start_at,start_at,lending_bank_deadline(now())) RETURNING * INTO l;lid:=l.id;old_due:=l.due_at;
 key:=gen_random_uuid();res:=lending_command(customer,lid,'request_extension',jsonb_build_object('termsAccepted',true,'transferName','SYNTHETIC','transferDate',(now() AT TIME ZONE 'Asia/Tokyo')::date),key,1);
 ASSERT (SELECT due_at=old_due AND principal_jpy=300000 FROM lending_loans WHERE id=lid);
 ASSERT (SELECT amount_jpy=18000 AND consent_terms->>'ruleVersion'='bank-monthly-v1' FROM lending_requests WHERE loan_id=lid AND status='pending');
 ASSERT lending_command(customer,lid,'request_extension',jsonb_build_object('termsAccepted',true,'transferName','SYNTHETIC','transferDate',(now() AT TIME ZONE 'Asia/Tokyo')::date),key,1)=res;
 BEGIN PERFORM lending_command(admin,lid,'extend',jsonb_build_object('amountJpy',6000,'reference','BANK-EXT-WRONG','paidAt',now()-interval '1 second'),gen_random_uuid(),2);RAISE EXCEPTION 'test failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='extension_amount_mismatch';END;
 PERFORM lending_command(admin,lid,'extend',jsonb_build_object('amountJpy',18000,'reference','BANK-EXT-ONE','paidAt',now()-interval '1 second'),gen_random_uuid(),2);
 SELECT * INTO l FROM lending_loans WHERE id=lid;
 ASSERT l.principal_jpy=300000 AND l.interest_paid_months=3 AND l.term_months_total=4;
 ASSERT l.due_at=lending_month_deadline(start_at,4) AND lending_unpaid_charge(l,now())=0;
 ASSERT (SELECT (lending_account_summary(customer)->>'payoffJpy')::bigint=300000);
 BEGIN PERFORM lending_command(customer,lid,'request_extension',jsonb_build_object('termsAccepted',true,'transferName','SYNTHETIC','transferDate',(now() AT TIME ZONE 'Asia/Tokyo')::date),gen_random_uuid(),3);RAISE EXCEPTION 'test failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='no_unpaid_period';END;
 -- Simulate the next monthly period using this disposable local fixture only.
 UPDATE lending_loans SET funded_at=now()-interval '4 months',interest_start_at=now()-interval '1 month',due_at=lending_month_deadline(now()-interval '4 months',4) WHERE id=lid;
 SELECT * INTO l FROM lending_loans WHERE id=lid;ASSERT lending_unpaid_charge(l,now())=6000;
 PERFORM lending_command(customer,lid,'request_extension',jsonb_build_object('termsAccepted',true,'transferName','SYNTHETIC','transferDate',(now() AT TIME ZONE 'Asia/Tokyo')::date),gen_random_uuid(),3);
 PERFORM lending_command(admin,lid,'extend',jsonb_build_object('amountJpy',6000,'reference','BANK-EXT-TWO','paidAt',now()-interval '1 second'),gen_random_uuid(),4);
 SELECT * INTO l FROM lending_loans WHERE id=lid;ASSERT l.interest_paid_months=4 AND l.term_months_total=5 AND l.principal_jpy=300000;
 ASSERT (SELECT count(*)=2 AND sum(amount_jpy)=24000 FROM lending_ledger WHERE loan_id=lid AND kind='extension_interest');
 -- A verified on-time transfer can be reconciled the following day.
 INSERT INTO lending_support_cases(user_id,created_by,source,reason,card_name) VALUES(customer,customer,'app','other','翌日照合検証') RETURNING id INTO cid;
 INSERT INTO lending_quotes(user_id,card_name,market_snapshot,cap_jpy,source,support_case_id) VALUES(customer,'翌日照合検証','{}',300000,'support',cid) RETURNING id INTO q;
 due_snapshot:=lending_bank_deadline(now()-interval '1 day');request_at:=due_snapshot-interval '1 minute';start_at:=now()-interval '3 months 1 day';
 INSERT INTO lending_loans(user_id,quote_id,requested_jpy,deposit_method,status,principal_jpy,monthly_rate_bps,funded_at,interest_start_at,due_at) VALUES(customer,q,300000,'mail','active',300000,200,start_at,start_at,due_snapshot) RETURNING * INTO l;lid:=l.id;
 INSERT INTO lending_requests(loan_id,kind,amount_jpy,consent_terms,created_at) VALUES(lid,'extension',18000,jsonb_build_object('ruleVersion','bank-monthly-v1','oldDueAt',due_snapshot,'reportedAt',request_at),request_at);
 BEGIN PERFORM lending_command(admin,lid,'extend',jsonb_build_object('amountJpy',18000,'reference','BANK-LATE-REJECT','paidAt',due_snapshot+interval '1 second'),gen_random_uuid(),1);RAISE EXCEPTION 'test failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='payment_date_invalid';END;
 PERFORM lending_command(admin,lid,'extend',jsonb_build_object('amountJpy',18000,'reference','BANK-NEXT-DAY','paidAt',request_at-interval '1 minute'),gen_random_uuid(),1);
 ASSERT (SELECT term_months_total=4 AND principal_jpy=300000 FROM lending_loans WHERE id=lid);
 -- Reminder enqueue is per due-date / day / channel and cancels superseded dates.
 UPDATE lending_loans SET due_at=lending_bank_deadline(now()+interval '3 days') WHERE id=lid;
 IF extract(hour FROM now() AT TIME ZONE 'Asia/Tokyo')>=9 THEN
  PERFORM lending_prepare_due_reminders();PERFORM lending_prepare_due_reminders();
  ASSERT (SELECT count(*)=1 FROM lending_due_reminders WHERE loan_id=lid AND channel='email');
  UPDATE lending_loans SET due_at=lending_bank_deadline(now()+interval '5 days') WHERE id=lid;
  PERFORM lending_claim_due_reminders(4,true,true);
  ASSERT (SELECT bool_and(status='cancelled') FROM lending_due_reminders WHERE loan_id=lid);
 END IF;
 RAISE NOTICE 'Monthly boundaries, fee quote, owner isolation, immutable report, reconciliation, one-month repeated extension, paid period and duplicate protection passed.';
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM lending_charge_months(now(),now());RAISE EXCEPTION 'unsafe helper';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
