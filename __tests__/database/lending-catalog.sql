SET ROLE service_role;
DO $$
DECLARE customer uuid:='10000000-0000-4000-8000-000000000001'; other_customer uuid:='10000000-0000-4000-8000-000000000003';
 card_id uuid:='20000000-0000-4000-8000-000000000001'; a uuid; expired_id uuid; k uuid:=gen_random_uuid(); c jsonb; snapshot jsonb;
BEGIN
 SELECT to_jsonb(cards)-'id' INTO snapshot FROM public.cards WHERE public_uid=card_id;
 INSERT INTO public.lending_catalog_assessments(user_id,card_uid,card,declared_grade,search_method,reasons)
 VALUES(customer,card_id,snapshot,'ungraded','catalog','["manual review required"]') RETURNING id INTO a;
 BEGIN PERFORM lending_catalog_submit(other_customer,a,300000,'',gen_random_uuid());RAISE EXCEPTION 'failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='not_found';END;
 c:=lending_catalog_submit(customer,a,300000,'写真は別途共有',k);
 ASSERT c->>'card_uid'=card_id::text AND c->>'declared_grade'='ungraded';
 ASSERT c->>'declared_cert_number' IS NULL AND c->>'indicative_jpy' IS NULL AND c->>'loan_id' IS NULL;
 ASSERT c->'selected_card'->>'name'=snapshot->>'name';
 ASSERT c=lending_catalog_submit(customer,a,300000,'写真は別途共有',k),'idempotent retry';
 BEGIN PERFORM lending_catalog_submit(customer,a,400000,'',k);RAISE EXCEPTION 'failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='idempotency_conflict';END;
 BEGIN PERFORM lending_catalog_submit(customer,a,300000,'',gen_random_uuid());RAISE EXCEPTION 'failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='assessment_already_submitted';END;
 ASSERT NOT EXISTS(SELECT 1 FROM jsonb_array_elements(lending_support_list(other_customer)->'cases') x WHERE x->>'id'=c->>'id'),'owner list isolation';
 INSERT INTO public.lending_catalog_assessments(user_id,card_uid,card,declared_grade,cert_number,search_method,reasons,expires_at)
 VALUES(customer,card_id,snapshot,'PSA10','167034272','catalog','[]',now()-interval '1 minute') RETURNING id INTO expired_id;
 BEGIN PERFORM lending_catalog_submit(customer,expired_id,NULL,'',gen_random_uuid());RAISE EXCEPTION 'failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='assessment_expired';END;
 INSERT INTO public.lending_catalog_assessments(user_id,card_uid,card,declared_grade,search_method,reasons)
 VALUES(customer,card_id,snapshot||'{"name":"changed card"}','ungraded','catalog','[]') RETURNING id INTO a;
 BEGIN PERFORM lending_catalog_submit(customer,a,NULL,'',gen_random_uuid());RAISE EXCEPTION 'failed';EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='card_changed';END;
 RAISE NOTICE 'Catalog selection, snapshots, no fake certification, ownership, expiry and idempotency passed.';
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM id FROM public.lending_catalog_assessments;RAISE EXCEPTION 'unsafe table';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM id FROM public.lending_image_searches;RAISE EXCEPTION 'unsafe table';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.lending_catalog_submit(gen_random_uuid(),gen_random_uuid(),NULL,'',gen_random_uuid());RAISE EXCEPTION 'unsafe RPC';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
