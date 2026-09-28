-- Apply before deploying the accompanying application. No customer images are deleted here.
BEGIN;
GRANT SELECT (id, email_confirmed_at) ON auth.users TO service_role;
-- All application mutations run through authenticated server actions. This also
-- prevents admin Data API calls from bypassing the server's MFA requirement.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON storage.objects FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items FROM anon, authenticated;
DROP POLICY IF EXISTS "ユーザーは自分のプロフィールを更新できる" ON public.profiles;
DROP POLICY IF EXISTS "ユーザーは自分のプロフィールを作成できる" ON public.profiles;
DROP POLICY IF EXISTS "ユーザーは注文を作成できる" ON public.orders;
DROP POLICY IF EXISTS "ユーザーは注文明細を作成できる" ON public.order_items;
DROP POLICY IF EXISTS "identity-images: ユーザーは自分のフォルダにのみアップロード可" ON storage.objects;
-- Restrictive policies also constrain any pre-existing permissive storage policy.
CREATE POLICY identity_private_read ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (bucket_id <> 'identity-images');
CREATE POLICY identity_private_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (bucket_id <> 'identity-images');
CREATE POLICY identity_private_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (bucket_id <> 'identity-images') WITH CHECK (bucket_id <> 'identity-images');
CREATE POLICY identity_private_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (bucket_id <> 'identity-images');
UPDATE storage.buckets SET public = false WHERE id = 'identity-images';

-- Never preserve approval after identity-bearing details change.
CREATE OR REPLACE FUNCTION public.reset_identity_on_profile_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF ROW(NEW.last_name, NEW.first_name, NEW.last_name_kana, NEW.first_name_kana, NEW.birthday, NEW.address, NEW.postal_code, NEW.id_type)
 IS DISTINCT FROM ROW(OLD.last_name, OLD.first_name, OLD.last_name_kana, OLD.first_name_kana, OLD.birthday, OLD.address, OLD.postal_code, OLD.id_type) THEN
   NEW.identity_verified := false;
   UPDATE public.identity_documents SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL WHERE user_id = NEW.id AND deleted_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reset_identity_on_profile_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.reset_identity_on_profile_change();

CREATE TABLE public.security_rate_limits (key text PRIMARY KEY, count integer NOT NULL, reset_at timestamptz NOT NULL);
ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_rate_limits FROM anon, authenticated;
GRANT ALL ON public.security_rate_limits TO service_role;
CREATE FUNCTION public.consume_security_rate_limit(p_key text, p_limit integer, p_window_ms integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE r public.security_rate_limits;
BEGIN
 IF p_limit < 1 OR p_window_ms < 1 OR p_window_ms > 86400000 OR length(p_key) <> 64 THEN RAISE EXCEPTION 'Invalid rate limit'; END IF;
 INSERT INTO public.security_rate_limits AS t VALUES (p_key, 1, clock_timestamp() + p_window_ms * interval '1 millisecond')
 ON CONFLICT (key) DO UPDATE SET count = CASE WHEN t.reset_at <= clock_timestamp() THEN 1 ELSE least(t.count + 1, p_limit + 1) END,
 reset_at = CASE WHEN t.reset_at <= clock_timestamp() THEN clock_timestamp() + p_window_ms * interval '1 millisecond' ELSE t.reset_at END RETURNING * INTO r;
 RETURN jsonb_build_object('allowed', r.count <= p_limit, 'remaining', greatest(0, p_limit-r.count), 'reset_at', floor(extract(epoch FROM r.reset_at)*1000));
END $$;
REVOKE ALL ON FUNCTION public.consume_security_rate_limit(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_security_rate_limit(text,integer,integer) TO service_role;

ALTER TABLE public.identity_documents ADD COLUMN deletion_requested_at timestamptz;
REVOKE INSERT, UPDATE, DELETE ON public.identity_documents FROM anon, authenticated;
REVOKE ALL ON public.identity_document_access_logs FROM anon, authenticated;
-- Preserve audit history when an account or document record is removed.
ALTER TABLE public.identity_document_access_logs DROP CONSTRAINT identity_document_access_logs_document_id_fkey;
ALTER TABLE public.identity_document_access_logs DROP CONSTRAINT identity_document_access_logs_accessed_by_fkey;
-- Recover only references that match an existing object in the user's own folder.
WITH recovered AS (
 INSERT INTO public.identity_documents(user_id,storage_path,document_type,status)
 SELECT p.id,p.id_image_url,p.id_type,'pending' FROM public.profiles p
 JOIN storage.objects s ON s.bucket_id='identity-images' AND s.name=p.id_image_url
 WHERE split_part(p.id_image_url,'/',1)=p.id::text
 AND array_length(string_to_array(p.id_image_url,'/'),1)=2
 AND p.id_image_url NOT LIKE '%..%' AND position(chr(92) in p.id_image_url)=0
 ON CONFLICT(user_id) DO NOTHING RETURNING user_id
)
UPDATE public.profiles SET identity_verified=false WHERE id IN (SELECT user_id FROM recovered);
CREATE TABLE public.identity_cleanup_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, storage_path text UNIQUE NOT NULL,
 available_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz,
 CHECK (split_part(storage_path, '/', 1) = user_id::text AND storage_path NOT LIKE '%..%')
);
ALTER TABLE public.identity_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_cleanup_jobs FROM anon, authenticated;
GRANT ALL ON public.identity_cleanup_jobs TO service_role;

-- Immutable object paths + an expected previous path prevent concurrent replacement races.
CREATE FUNCTION public.commit_identity_document(p_user_id uuid, p_path text, p_type text, p_expected_path text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE old_doc public.identity_documents; job_id uuid;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing'; END IF;
 SELECT * INTO old_doc FROM public.identity_documents WHERE user_id=p_user_id FOR UPDATE;
 IF old_doc.storage_path IS DISTINCT FROM p_expected_path OR (old_doc.deletion_requested_at IS NOT NULL AND old_doc.deleted_at IS NULL) THEN RAISE EXCEPTION 'Document changed'; END IF;
 IF split_part(p_path,'/',1) <> p_user_id::text OR p_path LIKE '%..%' THEN RAISE EXCEPTION 'Invalid path'; END IF;
 DELETE FROM public.identity_cleanup_jobs WHERE storage_path=p_path AND user_id=p_user_id AND claimed_at IS NULL RETURNING id INTO job_id;
 IF job_id IS NULL THEN RAISE EXCEPTION 'Upload expired'; END IF;
 INSERT INTO public.identity_documents(user_id,storage_path,document_type) VALUES(p_user_id,p_path,p_type)
 ON CONFLICT(user_id) DO UPDATE SET storage_path=p_path,document_type=p_type,status='pending',uploaded_at=now(),reviewed_at=NULL,reviewed_by=NULL,deleted_at=NULL,deletion_requested_at=NULL;
 UPDATE public.profiles SET id_image_url=p_path,identity_verified=false WHERE id=p_user_id;
 IF old_doc.id IS NOT NULL AND old_doc.storage_path <> p_path AND split_part(old_doc.storage_path,'/',1)=p_user_id::text AND old_doc.storage_path NOT LIKE '%..%' THEN
   INSERT INTO public.identity_cleanup_jobs(user_id,storage_path) VALUES(p_user_id,old_doc.storage_path) ON CONFLICT(storage_path) DO NOTHING;
 END IF;
END $$;
CREATE FUNCTION public.begin_identity_deletion(p_document_id uuid, p_reviewer uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE d public.identity_documents;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_reviewer AND role='kyc_reviewer') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO d FROM public.identity_documents WHERE id=p_document_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document missing'; END IF;
 UPDATE public.identity_documents SET deletion_requested_at=coalesce(deletion_requested_at,now()) WHERE id=d.id;
 RETURN to_jsonb(d);
END $$;
CREATE FUNCTION public.finish_identity_deletion(p_document_id uuid, p_reviewer uuid, p_path text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE d public.identity_documents;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_reviewer AND role='kyc_reviewer') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO d FROM public.identity_documents WHERE id=p_document_id FOR UPDATE;
 IF NOT FOUND OR d.storage_path <> p_path OR d.deletion_requested_at IS NULL THEN RAISE EXCEPTION 'Document changed'; END IF;
 IF d.deleted_at IS NOT NULL THEN RETURN; END IF;
 INSERT INTO public.identity_document_access_logs(document_id,accessed_by,action) VALUES(d.id,p_reviewer,'delete');
 UPDATE public.identity_documents SET deleted_at=now(),status='rejected' WHERE id=d.id;
 UPDATE public.profiles SET id_image_url=NULL,identity_verified=false WHERE id=d.user_id;
END $$;
CREATE FUNCTION public.review_identity_document(p_user_id uuid, p_reviewer uuid, p_verified boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE d public.identity_documents;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_reviewer AND role='kyc_reviewer') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO d FROM public.identity_documents WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR d.deleted_at IS NOT NULL OR d.deletion_requested_at IS NOT NULL THEN RAISE EXCEPTION 'No active document'; END IF;
 INSERT INTO public.identity_document_access_logs(document_id,accessed_by,action) VALUES(d.id,p_reviewer,CASE WHEN p_verified THEN 'verify' ELSE 'reject' END);
 UPDATE public.identity_documents SET status=CASE WHEN p_verified THEN 'verified' ELSE 'rejected' END,reviewed_at=now(),reviewed_by=p_reviewer WHERE id=d.id;
 UPDATE public.profiles SET identity_verified=p_verified WHERE id=p_user_id;
END $$;
CREATE FUNCTION public.claim_identity_cleanup_jobs() RETURNS SETOF public.identity_cleanup_jobs
LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
 UPDATE public.identity_cleanup_jobs SET claimed_at=now() WHERE id IN (
 SELECT j.id FROM public.identity_cleanup_jobs j WHERE available_at < now() AND (claimed_at IS NULL OR claimed_at < now()-interval '15 minutes')
 AND NOT EXISTS(SELECT 1 FROM public.identity_documents d WHERE d.storage_path=j.storage_path AND d.deleted_at IS NULL)
 ORDER BY available_at LIMIT 50 FOR UPDATE SKIP LOCKED) RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.commit_identity_document(uuid,text,text,text), public.begin_identity_deletion(uuid,uuid), public.finish_identity_deletion(uuid,uuid,text), public.review_identity_document(uuid,uuid,boolean), public.claim_identity_cleanup_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_identity_document(uuid,text,text,text), public.begin_identity_deletion(uuid,uuid), public.finish_identity_deletion(uuid,uuid,text), public.review_identity_document(uuid,uuid,boolean), public.claim_identity_cleanup_jobs() TO service_role;
CREATE FUNCTION public.create_order_secure(p_order jsonb, p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE o public.orders; i jsonb; c public.coupons; uid uuid := (p_order->>'user_id')::uuid;
BEGIN
 IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid items'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Email unverified'; END IF;
 PERFORM 1 FROM public.identity_documents WHERE user_id=uid AND deleted_at IS NULL AND deletion_requested_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Identity document required'; END IF;
 IF p_order->>'coupon_id' IS NOT NULL THEN
  SELECT * INTO c FROM public.coupons WHERE id=(p_order->>'coupon_id')::uuid AND is_active FOR UPDATE;
  IF NOT FOUND OR c.amount <> (p_order->>'coupon_amount')::integer THEN RAISE EXCEPTION 'Invalid coupon'; END IF;
  IF c.one_use_per_user AND (EXISTS(SELECT 1 FROM public.coupon_redemptions WHERE coupon_id=c.id AND user_id=uid) OR EXISTS(SELECT 1 FROM public.orders WHERE coupon_id=c.id AND user_id=uid AND status NOT IN ('cancelled','completed'))) THEN RAISE EXCEPTION 'Coupon already used'; END IF;
 END IF;
 INSERT INTO public.orders(order_number,user_id,status,total_amount,bank_name,bank_branch,bank_account_no,bank_holder,note,coupon_id,coupon_code,coupon_comment,coupon_amount)
 VALUES(p_order->>'order_number',uid,'unhandled',(p_order->>'total_amount')::integer,p_order->>'bank_name',p_order->>'bank_branch',p_order->>'bank_account_no',p_order->>'bank_holder',p_order->>'note',c.id,c.code,c.comment,coalesce(c.amount,0)) RETURNING * INTO o;
 FOR i IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  IF (i->>'quantity')::integer NOT BETWEEN 1 AND 999 OR (i->>'unit_price')::integer < 0 THEN RAISE EXCEPTION 'Invalid item'; END IF;
  INSERT INTO public.order_items(order_id,card_id,item_type,card_name,grade,quantity,unit_price,assessed_unit_price,requested_note)
  VALUES(o.id,(i->>'card_id')::uuid,i->>'item_type',i->>'card_name',i->>'grade',(i->>'quantity')::integer,(i->>'unit_price')::integer,(i->>'unit_price')::integer,i->>'requested_note');
 END LOOP;
 IF (SELECT sum(quantity::bigint*unit_price)+coalesce(c.amount,0) FROM public.order_items WHERE order_id=o.id) <> o.total_amount THEN RAISE EXCEPTION 'Invalid total'; END IF;
 RETURN jsonb_build_object('id',o.id,'order_number',o.order_number);
END $$;

CREATE FUNCTION public.transition_order_secure(p_order_id uuid,p_expected text,p_next text,p_actor uuid,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE o public.orders; is_admin boolean; c public.coupons;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status::text <> p_expected THEN RAISE EXCEPTION 'Order changed'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor) INTO is_admin;
 IF NOT is_admin AND (o.user_id <> p_actor OR p_next <> 'cancelled') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF o.status='completed' AND p_next='cancelled' THEN RAISE EXCEPTION 'Completed order'; END IF;
 IF p_next='pending_approval' THEN RAISE EXCEPTION 'Use assessment'; END IF;
 IF p_next = p_expected THEN RETURN; END IF;
 IF p_next <> 'cancelled' AND (o.status='cancelled' OR p_next NOT IN ('unhandled','accepted','waiting_arrival','inspecting','pending_transfer','completed')) THEN RAISE EXCEPTION 'Invalid transition'; END IF;
 IF p_next='completed' AND o.coupon_id IS NOT NULL THEN
  SELECT * INTO c FROM public.coupons WHERE id=o.coupon_id FOR UPDATE;
  INSERT INTO public.coupon_redemptions(coupon_id,user_id,order_id,one_use_per_user) VALUES(c.id,o.user_id,o.id,c.one_use_per_user) ON CONFLICT(order_id) DO NOTHING;
 END IF;
 UPDATE public.orders SET status=p_next::public.order_status,completed_at=CASE WHEN p_next='completed' THEN now() WHEN o.status='completed' THEN NULL ELSE completed_at END WHERE id=o.id;
 INSERT INTO public.order_status_logs(order_id,old_status,new_status,changed_by,note) VALUES(o.id,o.status,p_next::public.order_status,p_actor,left(p_note,2000));
END $$;

CREATE FUNCTION public.decide_order_secure(p_order_id uuid,p_actor uuid,p_decisions jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE o public.orders; i public.order_items; decision text; total bigint:=0; approved integer:=0; n integer; nxt public.order_status;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.user_id<>p_actor OR o.status<>'pending_approval' OR o.assessment_saved_at IS NULL THEN RAISE EXCEPTION 'Order changed'; END IF;
 SELECT count(*) INTO n FROM public.order_items WHERE order_id=o.id;
 IF jsonb_array_length(p_decisions) <> n OR (SELECT count(DISTINCT value->>'itemId') FROM jsonb_array_elements(p_decisions)) <> n THEN RAISE EXCEPTION 'Invalid decisions'; END IF;
 FOR i IN SELECT * FROM public.order_items WHERE order_id=o.id FOR UPDATE LOOP
  SELECT value->>'decision' INTO decision FROM jsonb_array_elements(p_decisions) WHERE value->>'itemId'=i.id::text;
  IF decision IS NULL OR decision NOT IN ('approved','cancelled') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  UPDATE public.order_items SET customer_decision=decision,customer_decided_at=now() WHERE id=i.id;
  IF decision='approved' THEN total:=total+i.quantity::bigint*i.assessed_unit_price; approved:=approved+1; END IF;
 END LOOP;
 nxt:=CASE WHEN n>0 AND approved=0 THEN 'cancelled' ELSE 'pending_transfer' END;
 IF approved>0 THEN total:=total+o.coupon_amount; END IF;
 UPDATE public.orders SET status=nxt,total_amount=total WHERE id=o.id;
 INSERT INTO public.order_status_logs(order_id,old_status,new_status,changed_by,note) VALUES(o.id,o.status,nxt,p_actor,'ユーザーが査定結果を確定');
END $$;

CREATE FUNCTION public.save_assessment_secure(p_order_id uuid,p_actor uuid,p_expected text,p_updates jsonb,p_manual jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE o public.orders; i public.order_items; c public.cards; entry jsonb; price integer; total bigint:=0; n integer; manual_count integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status::text<>p_expected OR NOT(o.status='inspecting' OR (o.status='pending_approval' AND o.assessment_saved_at IS NULL)) THEN RAISE EXCEPTION 'Order changed'; END IF;
 SELECT count(*) INTO n FROM public.order_items WHERE order_id=o.id AND item_type<>'unlisted';
 IF jsonb_array_length(p_updates) <> n OR (SELECT count(DISTINCT value->>'itemId') FROM jsonb_array_elements(p_updates)) <> n THEN RAISE EXCEPTION 'Invalid updates'; END IF;
 manual_count:=jsonb_array_length(p_manual);
 IF manual_count>200 OR (manual_count>0 AND NOT EXISTS(SELECT 1 FROM public.order_items WHERE order_id=o.id AND item_type='unlisted')) THEN RAISE EXCEPTION 'Invalid manual items'; END IF;
 FOR i IN SELECT * FROM public.order_items WHERE order_id=o.id AND item_type<>'unlisted' FOR UPDATE LOOP
  SELECT (value->>'assessedUnitPrice')::integer INTO price FROM jsonb_array_elements(p_updates) WHERE value->>'itemId'=i.id::text;
  IF price IS NULL OR price<0 THEN RAISE EXCEPTION 'Invalid price'; END IF;
  UPDATE public.order_items SET assessed_unit_price=price,customer_decision=NULL,customer_decided_at=NULL WHERE id=i.id;
  total:=total+i.quantity::bigint*price;
 END LOOP;
 FOR entry IN SELECT * FROM jsonb_array_elements(p_manual) LOOP
  c:=NULL; price:=(entry->>'assessedUnitPrice')::integer;
  IF price IS NULL OR price<0 THEN RAISE EXCEPTION 'Invalid price'; END IF;
  IF entry->>'existingCardId' IS NOT NULL THEN
   SELECT * INTO c FROM public.cards WHERE id=(entry->>'existingCardId')::uuid;
   IF NOT FOUND THEN RAISE EXCEPTION 'Card missing'; END IF;
  ELSE
   IF length(trim(entry->>'cardName')) NOT BETWEEN 1 AND 300 OR entry->>'grade' NOT IN ('PSA10','PSA9','PSA8') THEN RAISE EXCEPTION 'Invalid card'; END IF;
   IF (entry->>'saveToDb')::boolean THEN
    INSERT INTO public.cards(name,category,grade,buy_price) VALUES(entry->>'cardName','pokemon',entry->>'grade',price) RETURNING * INTO c;
   END IF;
  END IF;
  INSERT INTO public.order_items(order_id,card_id,item_type,card_name,grade,quantity,unit_price,assessed_unit_price,requested_note)
  VALUES(o.id,c.id,'card',coalesce(c.name,entry->>'cardName'),coalesce(c.grade,entry->>'grade'),1,coalesce(c.buy_price,price),price,'リストにない商品の査定依頼から追加');
  total:=total+price;
 END LOOP;
 DELETE FROM public.order_items WHERE order_id=o.id AND item_type='unlisted';
 UPDATE public.orders SET status='pending_approval',total_amount=total+o.coupon_amount,assessment_saved_at=now() WHERE id=o.id;
 INSERT INTO public.order_status_logs(order_id,old_status,new_status,changed_by,note) VALUES(o.id,o.status,'pending_approval',p_actor,'査定額を保存');
END $$;
REVOKE ALL ON FUNCTION public.create_order_secure(jsonb,jsonb), public.transition_order_secure(uuid,text,text,uuid,text), public.decide_order_secure(uuid,uuid,jsonb), public.save_assessment_secure(uuid,uuid,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_secure(jsonb,jsonb), public.transition_order_secure(uuid,text,text,uuid,text), public.decide_order_secure(uuid,uuid,jsonb), public.save_assessment_secure(uuid,uuid,text,jsonb,jsonb) TO service_role;
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_profile_email() SET search_path = pg_catalog, public;
ALTER FUNCTION public.handle_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.generate_order_number() SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_buy_price_updated_at() SET search_path = pg_catalog, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user(), public.sync_profile_email(), public.reset_identity_on_profile_change() FROM PUBLIC, anon, authenticated;
ALTER VIEW public.reference_prices_deduped SET (security_invoker=true);
ALTER VIEW public.reference_price_distinct_sites SET (security_invoker=true);
ALTER VIEW public.reference_price_distinct_grades SET (security_invoker=true);
COMMIT;
