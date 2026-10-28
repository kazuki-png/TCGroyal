-- Preview/local only. Do not apply to production without a separate release.
BEGIN;
CREATE TABLE public.lending_firebase_accounts (
 subject_hash text PRIMARY KEY CHECK(subject_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
 phone text NOT NULL CHECK(phone ~ '^\+81[789]0[0-9]{8}$'),
 verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lending_firebase_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lending_firebase_accounts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.lending_firebase_accounts TO service_role;
CREATE FUNCTION public.lending_bind_firebase_phone(p_actor uuid,p_subject_hash text,p_phone text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR UPDATE;
 IF NOT FOUND OR public.lending_is_admin(p_actor) THEN RAISE EXCEPTION 'invalid_customer'; END IF;
 INSERT INTO public.lending_firebase_accounts(subject_hash,user_id,phone) VALUES(p_subject_hash,p_actor,p_phone)
 ON CONFLICT(subject_hash) DO UPDATE SET phone=excluded.phone,verified_at=now()
 WHERE lending_firebase_accounts.user_id=excluded.user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'firebase_account_conflict'; END IF;
 -- Initial profile only. Logging in must not silently overwrite a saved profile.
 UPDATE public.profiles SET phone=p_phone,updated_at=clock_timestamp() WHERE id=p_actor AND phone IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.lending_bind_firebase_phone(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_bind_firebase_phone(uuid,text,text) TO service_role;

ALTER TABLE public.lending_documents ADD COLUMN profile_version timestamptz;
CREATE OR REPLACE FUNCTION public.lending_begin_document(p_actor uuid,p_type text,p_side text,p_path text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result uuid; version timestamptz; BEGIN
 IF split_part(p_path,'/',1)<>p_actor::text OR p_path LIKE '%..%' OR array_length(string_to_array(p_path,'/'),1)<>2 THEN RAISE EXCEPTION 'invalid_document_path'; END IF;
 SELECT updated_at INTO version FROM public.profiles WHERE id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile_missing'; END IF;
 INSERT INTO public.lending_documents(user_id,document_type,side,storage_path,profile_version,uploaded_at)
 VALUES(p_actor,p_type,p_side,p_path,version,clock_timestamp()) RETURNING id INTO result;
 UPDATE public.lending_identity_checks SET expires_at=least(expires_at,now()) WHERE user_id=p_actor;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.lending_review_document(p_actor uuid,p_document uuid,p_approve boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE doc public.lending_documents; version timestamptz; pair_count integer; BEGIN
 IF NOT public.lending_is_admin(p_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 -- All reviewers, uploads and profile changes lock the same profile first.
 SELECT d.* INTO doc FROM public.lending_documents d WHERE d.id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'document_already_reviewed'; END IF;
 SELECT updated_at INTO version FROM public.profiles WHERE id=doc.user_id FOR UPDATE;
 PERFORM 1 FROM public.lending_documents WHERE user_id=doc.user_id FOR UPDATE;
 SELECT * INTO doc FROM public.lending_documents WHERE id=p_document AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'document_already_reviewed'; END IF;
 IF p_approve AND (doc.document_type<>'drivers_license' OR doc.profile_version IS DISTINCT FROM version) THEN RAISE EXCEPTION 'document_profile_changed'; END IF;
 UPDATE public.lending_documents SET status=CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END WHERE id=doc.id;
 SELECT count(*) INTO pair_count FROM (
  SELECT DISTINCT ON(side) side,status,profile_version FROM public.lending_documents
  WHERE user_id=doc.user_id AND document_type='drivers_license'
  ORDER BY side,uploaded_at DESC,id DESC
 ) latest WHERE status='verified' AND profile_version=version;
 IF p_approve AND pair_count=2 THEN
  INSERT INTO public.lending_identity_checks(user_id,method,verified_at,expires_at,evidence_reference,verified_by)
  VALUES(doc.user_id,'test_fixture',now(),now()+interval '7 days','PREVIEW-LICENSE-PAIR:'||doc.id::text,p_actor)
  ON CONFLICT(user_id) DO UPDATE SET method='test_fixture',verified_at=now(),expires_at=now()+interval '7 days',evidence_reference=excluded.evidence_reference,verified_by=p_actor;
 ELSE
  UPDATE public.lending_identity_checks SET expires_at=least(expires_at,now()) WHERE user_id=doc.user_id;
 END IF;
 INSERT INTO public.lending_document_access(document_id,actor_id,action) VALUES(doc.id,p_actor,CASE WHEN p_approve THEN 'test_approve' ELSE 'reject' END);
END $$;
-- CREATE OR REPLACE preserves earlier service-only grants.
COMMIT;
