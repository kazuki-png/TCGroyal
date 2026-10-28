-- Additive Preview/local features. Production deployment is not authorized.
BEGIN;
CREATE TABLE public.lending_certificate_lookups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 cert_number text NOT NULL CHECK(cert_number ~ '^[0-9]{6,12}$'), certificate jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day'
);
CREATE INDEX lending_certificate_user ON public.lending_certificate_lookups(user_id,created_at DESC);
CREATE TABLE public.lending_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 lookup_id uuid NOT NULL REFERENCES public.lending_certificate_lookups(id), cert_number text NOT NULL,
 product_id text NOT NULL CHECK(product_id ~ '^[1-9][0-9]{0,8}$'), product jsonb NOT NULL, market_snapshot jsonb NOT NULL,
 estimate_jpy bigint NOT NULL CHECK(estimate_jpy BETWEEN 0 AND 10000000),
 quote_id uuid REFERENCES public.lending_quotes(id), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes', submitted_at timestamptz
);
CREATE INDEX lending_assessment_user ON public.lending_assessments(user_id,created_at DESC);
CREATE UNIQUE INDEX lending_one_intake_per_cert ON public.lending_assessments(user_id,cert_number) WHERE status='submitted';
CREATE TABLE public.lending_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 document_type text NOT NULL CHECK(document_type IN ('drivers_license','passport','mynumber_front','address_proof')),
 side text NOT NULL CHECK(side IN ('front','back')), storage_path text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','pending','verified','rejected','deleted')),
 uploaded_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 CHECK(document_type<>'mynumber_front' OR side='front')
);
CREATE INDEX lending_documents_user ON public.lending_documents(user_id,uploaded_at DESC);
CREATE TABLE public.lending_document_access (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL REFERENCES public.lending_documents(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),action text NOT NULL CHECK(action IN ('view','test_approve','reject')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lending_push_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 token text NOT NULL UNIQUE CHECK(length(token) BETWEEN 20 AND 4096), platform text NOT NULL CHECK(platform='android'),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lending_push_user ON public.lending_push_devices(user_id);
CREATE TABLE public.lending_notification_tests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 device_id uuid NOT NULL REFERENCES public.lending_push_devices(id),
 status text NOT NULL CHECK(status IN ('sending','accepted','failed','received')),
 provider_message_id text, error_code text,created_at timestamptz NOT NULL DEFAULT now(), received_at timestamptz
);
CREATE INDEX lending_notification_user ON public.lending_notification_tests(user_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lending_certificate_lookups','lending_assessments','lending_documents','lending_document_access','lending_push_devices','lending_notification_tests'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
 END LOOP;
END $$;
REVOKE UPDATE,DELETE ON public.lending_document_access FROM service_role;
CREATE TRIGGER lending_document_access_immutable BEFORE UPDATE OR DELETE ON public.lending_document_access FOR EACH ROW EXECUTE FUNCTION public.lending_immutable();
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('lending-identity','lending-identity',false,3145728,ARRAY['image/jpeg']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY lending_identity_private_read ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(bucket_id<>'lending-identity');
CREATE POLICY lending_identity_private_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(bucket_id<>'lending-identity');
CREATE POLICY lending_identity_private_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(bucket_id<>'lending-identity') WITH CHECK(bucket_id<>'lending-identity');
CREATE POLICY lending_identity_private_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(bucket_id<>'lending-identity');
CREATE FUNCTION public.lending_update_profile(p_actor uuid,p_payload jsonb,p_version timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE old public.profiles; BEGIN
 SELECT * INTO old FROM public.profiles WHERE id=p_actor FOR UPDATE;
 IF NOT FOUND OR old.updated_at IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'profile_version_conflict'; END IF;
 UPDATE public.profiles SET last_name=p_payload->>'last_name',first_name=p_payload->>'first_name',
 last_name_kana=p_payload->>'last_name_kana',first_name_kana=p_payload->>'first_name_kana',
 birthday=(p_payload->>'birthday')::date,postal_code=p_payload->>'postal_code',address=p_payload->>'address',phone=p_payload->>'phone',updated_at=clock_timestamp()
 WHERE id=p_actor;
END $$;
REVOKE ALL ON FUNCTION public.lending_update_profile(uuid,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_update_profile(uuid,jsonb,timestamptz) TO service_role;
CREATE FUNCTION public.lending_account_summary(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('outstandingJpy',coalesce(sum(principal_jpy),0),'payoffJpy',coalesce(sum(principal_jpy+public.lending_interest(principal_jpy,monthly_rate_bps,interest_start_at,now())),0),
 'nextDueAt',min(due_at),'activeCount',count(*)) FROM public.lending_loans WHERE user_id=p_actor AND status IN ('active','repayment_pending')
$$;
REVOKE ALL ON FUNCTION public.lending_account_summary(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_account_summary(uuid) TO service_role;
CREATE FUNCTION public.lending_begin_document(p_actor uuid,p_type text,p_side text,p_path text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result uuid; BEGIN
 IF split_part(p_path,'/',1)<>p_actor::text OR p_path LIKE '%..%' OR array_length(string_to_array(p_path,'/'),1)<>2 THEN RAISE EXCEPTION 'invalid_document_path'; END IF;
 INSERT INTO public.lending_documents(user_id,document_type,side,storage_path) VALUES(p_actor,p_type,p_side,p_path) RETURNING id INTO result;
 UPDATE public.lending_identity_checks SET expires_at=least(expires_at,now()) WHERE user_id=p_actor;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.lending_begin_document(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_begin_document(uuid,text,text,text) TO service_role;
CREATE FUNCTION public.lending_review_document(p_actor uuid,p_document uuid,p_approve boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE doc public.lending_documents; BEGIN
 IF NOT public.lending_is_admin(p_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO doc FROM public.lending_documents WHERE id=p_document AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'document_already_reviewed'; END IF;
 UPDATE public.lending_documents SET status=CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END WHERE id=doc.id;
 IF p_approve THEN
  INSERT INTO public.lending_identity_checks(user_id,method,verified_at,expires_at,evidence_reference,verified_by)
  VALUES(doc.user_id,'test_fixture',now(),now()+interval '7 days','PREVIEW-DOCUMENT-TEST:'||doc.id::text,p_actor)
  ON CONFLICT(user_id) DO UPDATE SET method='test_fixture',verified_at=now(),expires_at=now()+interval '7 days',evidence_reference=excluded.evidence_reference,verified_by=p_actor;
 END IF;
 INSERT INTO public.lending_document_access(document_id,actor_id,action) VALUES(doc.id,p_actor,CASE WHEN p_approve THEN 'test_approve' ELSE 'reject' END);
END $$;
REVOKE ALL ON FUNCTION public.lending_review_document(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_review_document(uuid,uuid,boolean) TO service_role;
CREATE FUNCTION public.lending_document_deleted() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.status='deleted' AND OLD.status='verified' THEN UPDATE public.lending_identity_checks SET expires_at=least(expires_at,now()) WHERE user_id=NEW.user_id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lending_document_deleted AFTER UPDATE ON public.lending_documents FOR EACH ROW EXECUTE FUNCTION public.lending_document_deleted();
REVOKE ALL ON FUNCTION public.lending_document_deleted() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_document_deleted() TO service_role;
COMMIT;
