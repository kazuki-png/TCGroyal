SET ROLE service_role;
DO $$
DECLARE customer uuid:='10000000-0000-4000-8000-000000000001'; admin uuid:='10000000-0000-4000-8000-000000000002';
 card uuid:='20000000-0000-4000-8000-000000000001'; n integer; q uuid; loan uuid; first_loan uuid; c jsonb; d jsonb; detail jsonb;
 market jsonb:=jsonb_build_object('provider','snkrdunk','productId','408333','grade','PSA10','currency','JPY','fetchedAt',now(),'floorPriceJpy',1000000,'sales','[]'::jsonb,'coverage','latest_page_only','dailySalesAverage',NULL);
BEGIN
 BEGIN PERFORM lending_admin_dashboard(customer);RAISE EXCEPTION 'unsafe';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='forbidden';END;
 FOR n IN 1..60 LOOP
  q:=(lending_create_quote(customer,card,market)->>'id')::uuid;
  INSERT INTO public.lending_loans(user_id,quote_id,cert_number,requested_jpy,deposit_method,status,principal_jpy,monthly_rate_bps,interest_start_at,due_at)
  VALUES(customer,q,(99000000+n)::text,100000,'mail',CASE WHEN n=1 THEN 'repayment_pending' WHEN n=2 THEN 'return_pending' WHEN n=3 THEN 'cancelled' ELSE 'active' END,
  CASE WHEN n IN (2,3) THEN 0 ELSE 100000 END,100,now()-interval '1 month',CASE WHEN n=4 THEN now()-interval '1 day' WHEN n=5 THEN now()+interval '1 day' ELSE now()+interval '30 days' END) RETURNING id INTO loan;
  IF n=1 THEN first_loan:=loan;END IF;
 END LOOP;
 c:=lending_support_create(admin,jsonb_build_object('reason','ungraded','cardName','管理テスト相談','cardNumber','','condition','','notes','','requestedAmount','','consent',true,'userId',customer),gen_random_uuid());
 UPDATE public.lending_support_cases SET loan_id=first_loan,status='applied' WHERE id=(c->>'id')::uuid;
 PERFORM lending_support_create(admin,'{"reason":"ungraded","cardName":"未紐付け相談","cardNumber":"","condition":"","notes":"","requestedAmount":"","consent":true}',gen_random_uuid());
 d:=lending_admin_dashboard(admin);
 ASSERT (d->>'total')::integer=61,'linked case must not double count loan';
 ASSERT jsonb_array_length(d->'rows')=25,'paged rows';
 ASSERT (d->'summary'->>'outstandingJpy')::bigint=5800000,'full portfolio, not just first 50';
 ASSERT (d->'summary'->>'activeCount')::integer=58;
 ASSERT (d->'summary'->>'reviewCount')::integer=1;
 ASSERT (d->'summary'->>'repaymentPendingCount')::integer=1;
 ASSERT (d->'summary'->>'overdueCount')::integer=1;
 ASSERT (d->'summary'->>'dueSoonCount')::integer=1;
 ASSERT (d->'summary'->>'returnPendingCount')::integer=1;
 ASSERT (lending_admin_dashboard(admin,'','overdue')->>'total')::integer=1;
 ASSERT (lending_admin_dashboard(admin,'','active')->>'total')::integer=58;
 ASSERT (lending_admin_dashboard(admin,'未紐付け相談')->>'total')::integer=1;
 ASSERT (lending_admin_dashboard(admin,'','all',3)->>'total')::integer=61;
 ASSERT jsonb_array_length(lending_admin_dashboard(admin,'','all',3)->'rows')=11;
 detail:=lending_admin_detail(admin,'loan',first_loan);ASSERT detail->'item'->>'id'=first_loan::text;
 ASSERT detail->'item'->'support_case'->>'reference'=c->>'reference';
 ASSERT detail->'customer'->>'id'=customer::text;
 BEGIN PERFORM lending_admin_detail(customer,'loan',first_loan);RAISE EXCEPTION 'unsafe';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='forbidden';END;
 RAISE NOTICE 'Admin portfolio counts, no double counting, urgency, search, pagination beyond 50 and scoped detail passed.';
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM lending_admin_dashboard(gen_random_uuid());RAISE EXCEPTION 'unsafe';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM lending_admin_detail(gen_random_uuid(),'case',gen_random_uuid());RAISE EXCEPTION 'unsafe';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
