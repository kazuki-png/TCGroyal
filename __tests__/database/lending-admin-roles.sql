SET ROLE service_role;
DO $$
DECLARE reviewer uuid:='10000000-0000-4000-8000-000000000003'; customer uuid:='10000000-0000-4000-8000-000000000001'; c jsonb;
BEGIN
 ASSERT NOT public.lending_is_admin(customer),'customer stays a customer';
 ASSERT NOT public.lending_is_admin(NULL),'null is not an administrator';
 INSERT INTO public.admin_users(id,role) VALUES(reviewer,'kyc_reviewer');
 ASSERT public.lending_is_admin(reviewer),'KYC administrator has ordinary admin membership';
 ASSERT public.lending_admin_dashboard(reviewer)->'summary' IS NOT NULL;
 c:=public.lending_support_create(reviewer,'{"reason":"ungraded","cardName":"権限整合テスト","cardNumber":"","condition":"","notes":"","requestedAmount":"","consent":true}',gen_random_uuid());
 ASSERT c->>'source'='admin' AND c->>'user_id' IS NULL,'reviewer is not mistaken for a customer';
 ASSERT public.lending_admin_detail(reviewer,'case',(c->>'id')::uuid)->'item'->>'id'=c->>'id';
 BEGIN PERFORM public.lending_admin_dashboard(customer);RAISE EXCEPTION 'unsafe';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='forbidden';END;
 RAISE NOTICE 'Both existing admin roles can list/read/create; ordinary customers remain denied.';
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.lending_is_admin('10000000-0000-4000-8000-000000000003');RAISE EXCEPTION 'unsafe';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
