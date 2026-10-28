DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM pg_tables WHERE schemaname='public' AND tablename IN
 ('lending_certificate_lookups','lending_assessments','lending_documents','lending_push_devices','lending_notification_tests') AND rowsecurity;
 IF n<>5 THEN RAISE EXCEPTION 'New tables must all use RLS'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'lending_%'
 AND (has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE'))) THEN RAISE EXCEPTION 'Public business RPC'; END IF;
 IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'lending_%'
 AND (has_table_privilege('anon','public.'||tablename,'SELECT') OR has_table_privilege('authenticated','public.'||tablename,'SELECT'))) THEN RAISE EXCEPTION 'Public lending table'; END IF;
 IF (SELECT public FROM storage.buckets WHERE id='lending-identity') THEN RAISE EXCEPTION 'Identity bucket is public'; END IF;
END $$;
SET ROLE service_role;
DO $$ DECLARE version timestamptz; payload jsonb; summary jsonb; BEGIN
 SELECT updated_at INTO version FROM public.profiles WHERE id='10000000-0000-4000-8000-000000000001';
 payload:='{"last_name":"テスト","first_name":"融資利用者","last_name_kana":"テスト","first_name_kana":"ユウザ","birthday":"1990-01-01","postal_code":"1000001","address":"テスト用架空住所","phone":"09000000000"}';
 PERFORM public.lending_update_profile('10000000-0000-4000-8000-000000000001',payload,version);
 BEGIN
  PERFORM public.lending_update_profile('10000000-0000-4000-8000-000000000001',payload,version);
  RAISE EXCEPTION 'Stale profile update succeeded';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'profile_version_conflict' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.lending_begin_document('10000000-0000-4000-8000-000000000001','drivers_license','front','10000000-0000-4000-8000-000000000002/other.jpg');
  RAISE EXCEPTION 'Cross-user path succeeded';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_document_path' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.lending_begin_document('10000000-0000-4000-8000-000000000001','mynumber_front','back','10000000-0000-4000-8000-000000000001/number-back.jpg');
  RAISE EXCEPTION 'My Number back succeeded';
 EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM public.lending_begin_document('10000000-0000-4000-8000-000000000001','drivers_license','front','10000000-0000-4000-8000-000000000001/fixture-front.jpg');
 IF EXISTS(SELECT 1 FROM public.lending_identity_checks WHERE user_id='10000000-0000-4000-8000-000000000001' AND expires_at>now()) THEN RAISE EXCEPTION 'Upload retained identity approval'; END IF;
 summary:=public.lending_account_summary('10000000-0000-4000-8000-000000000001');
 IF (summary->>'outstandingJpy')::bigint<>(SELECT coalesce(sum(principal_jpy),0) FROM public.lending_loans WHERE user_id='10000000-0000-4000-8000-000000000001' AND status IN ('active','repayment_pending')) THEN RAISE EXCEPTION 'Incorrect account aggregate'; END IF;
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ DECLARE front_id uuid; back_id uuid; replacement uuid; customer uuid:='10000000-0000-4000-8000-000000000001'; administrator uuid:='10000000-0000-4000-8000-000000000002'; BEGIN
 front_id:=public.lending_begin_document(customer,'drivers_license','front',customer::text||'/pair-front.jpg');
 back_id:=public.lending_begin_document(customer,'drivers_license','back',customer::text||'/pair-back.jpg');
 UPDATE public.lending_documents SET status='pending' WHERE id IN(front_id,back_id);
 PERFORM public.lending_review_document(administrator,front_id,true);
 IF EXISTS(SELECT 1 FROM public.lending_identity_checks WHERE user_id=customer AND expires_at>now()) THEN RAISE EXCEPTION 'One side incorrectly verified identity'; END IF;
 PERFORM public.lending_review_document(administrator,back_id,true);
 IF NOT EXISTS(SELECT 1 FROM public.lending_identity_checks WHERE user_id=customer AND expires_at>now()) THEN RAISE EXCEPTION 'Approved pair did not verify test identity'; END IF;
 replacement:=public.lending_begin_document(customer,'drivers_license','front',customer::text||'/replacement-front.jpg');
 UPDATE public.lending_documents SET status='pending' WHERE id=replacement;
 IF EXISTS(SELECT 1 FROM public.lending_identity_checks WHERE user_id=customer AND expires_at>now()) THEN RAISE EXCEPTION 'Replacement retained verification'; END IF;
 UPDATE public.profiles SET updated_at=clock_timestamp(),address='changed test address' WHERE id=customer;
 BEGIN
  PERFORM public.lending_review_document(administrator,replacement,true);
  RAISE EXCEPTION 'Stale profile document approved';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'document_profile_changed' THEN RAISE; END IF; END;
 PERFORM public.lending_bind_firebase_phone(customer,repeat('a',64),'+819012345678');
 BEGIN
  PERFORM public.lending_bind_firebase_phone('10000000-0000-4000-8000-000000000003',repeat('a',64),'+819012345678');
  RAISE EXCEPTION 'Firebase account reassigned';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'firebase_account_conflict' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.lending_bind_firebase_phone(administrator,repeat('b',64),'+819012345679');
  RAISE EXCEPTION 'Firebase account linked to administrator';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_customer' THEN RAISE; END IF; END;
 IF (SELECT phone FROM public.profiles WHERE id=customer)<>'09000000000' THEN RAISE EXCEPTION 'Login overwrote saved profile'; END IF;
END $$;
RESET ROLE;
SELECT 'Mobile profile, document ownership, private bucket, permissions and account aggregation passed';
