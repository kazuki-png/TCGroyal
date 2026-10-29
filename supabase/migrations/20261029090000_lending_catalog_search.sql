BEGIN;
CREATE TABLE public.lending_image_searches (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id), image_hash text NOT NULL CHECK(image_hash ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed','failed')),
 result jsonb, model text, input_tokens integer CHECK(input_tokens>=0), output_tokens integer CHECK(output_tokens>=0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lending_image_searches_owner ON public.lending_image_searches(user_id,created_at DESC);
ALTER TABLE public.lending_image_searches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lending_image_searches FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.lending_image_searches TO service_role;
CREATE TABLE public.lending_catalog_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 card_uid uuid NOT NULL REFERENCES public.cards(public_uid), card jsonb NOT NULL,
 declared_grade text NOT NULL CHECK(declared_grade IN ('PSA10','other','ungraded')), cert_number text CHECK(cert_number ~ '^[0-9]{6,12}$'),
 search_method text NOT NULL CHECK(search_method IN ('catalog','image')), image_request_id uuid REFERENCES public.lending_image_searches(id),
 indicative_jpy bigint CHECK(indicative_jpy BETWEEN 100000 AND 10000000), reasons jsonb NOT NULL, market_snapshot jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 CHECK(declared_grade<>'ungraded' OR cert_number IS NULL), CHECK((search_method='image')=(image_request_id IS NOT NULL))
);
CREATE INDEX lending_catalog_assessments_owner ON public.lending_catalog_assessments(user_id,created_at DESC);
ALTER TABLE public.lending_catalog_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lending_catalog_assessments FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.lending_catalog_assessments TO service_role;
CREATE TRIGGER lending_catalog_assessments_immutable BEFORE UPDATE OR DELETE ON public.lending_catalog_assessments FOR EACH ROW EXECUTE FUNCTION public.lending_immutable();
ALTER TABLE public.lending_support_cases ADD COLUMN catalog_assessment_id uuid UNIQUE REFERENCES public.lending_catalog_assessments(id);
ALTER TABLE public.lending_support_cases ADD COLUMN card_uid uuid REFERENCES public.cards(public_uid);
ALTER TABLE public.lending_support_cases ADD COLUMN selected_card jsonb;
ALTER TABLE public.lending_support_cases ADD COLUMN search_method text CHECK(search_method IN ('catalog','image'));
ALTER TABLE public.lending_support_cases ADD COLUMN declared_grade text CHECK(declared_grade IN ('PSA10','other','ungraded'));
ALTER TABLE public.lending_support_cases ADD COLUMN declared_cert_number text CHECK(declared_cert_number ~ '^[0-9]{6,12}$');
ALTER TABLE public.lending_support_cases ADD COLUMN indicative_jpy bigint;
CREATE FUNCTION public.lending_catalog_submit(p_actor uuid,p_assessment uuid,p_amount bigint,p_notes text,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a public.lending_catalog_assessments; c public.lending_support_cases; r public.lending_command_receipts;
 fp jsonb:=jsonb_build_object('action','catalog_submit','assessment',p_assessment,'amount',p_amount,'notes',p_notes);
BEGIN
 IF p_actor IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'invalid_actor_or_key'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO r FROM public.lending_command_receipts WHERE key=p_key;
 IF FOUND THEN
  IF r.actor_id<>p_actor OR r.fingerprint<>fp THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
  RETURN r.result;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_assessment::text,2));
 SELECT * INTO a FROM public.lending_catalog_assessments WHERE id=p_assessment AND user_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF a.expires_at<=now() THEN RAISE EXCEPTION 'assessment_expired'; END IF;
 IF (p_amount IS NOT NULL AND (p_amount<1 OR p_amount>10000000)) OR p_notes IS NULL OR length(p_notes)>1000 THEN RAISE EXCEPTION 'amount_invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cards WHERE public_uid=a.card_uid AND buy_price_updated_at>=now()-interval '48 hours'
  AND name=a.card->>'name' AND grade=a.card->>'grade' AND category=a.card->>'category'
  AND card_number IS NOT DISTINCT FROM (a.card->>'card_number') AND buy_price=(a.card->>'buy_price')::bigint
  AND buy_price_updated_at=(a.card->>'buy_price_updated_at')::timestamptz) THEN RAISE EXCEPTION 'card_changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.lending_support_cases WHERE catalog_assessment_id=a.id) THEN RAISE EXCEPTION 'assessment_already_submitted'; END IF;
 INSERT INTO public.lending_support_cases(user_id,created_by,source,reason,card_name,card_number,condition,notes,requested_jpy,
 catalog_assessment_id,card_uid,selected_card,search_method,declared_grade,declared_cert_number,indicative_jpy)
 VALUES(p_actor,p_actor,'app',CASE WHEN a.declared_grade='ungraded' THEN 'ungraded' WHEN a.cert_number IS NULL THEN 'no_certificate' ELSE 'other' END,
 left(a.card->>'name',100),left(coalesce(a.card->>'card_number',''),100),
 '利用者申告: '||a.declared_grade||CASE WHEN a.cert_number IS NULL THEN '' ELSE ' / PSA番号 '||a.cert_number END||'（公式API未照会・現物確認待ち）',
 p_notes,p_amount,a.id,a.card_uid,a.card,a.search_method,a.declared_grade,a.cert_number,a.indicative_jpy) RETURNING * INTO c;
 INSERT INTO public.lending_support_events(case_id,actor_id,action,to_status,version,message)
 VALUES(c.id,p_actor,'create',c.status,c.version,'DBのカードを選択して査定依頼。現物・鑑定状態を運営が確認します。');
 INSERT INTO public.lending_command_receipts(key,actor_id,fingerprint,result) VALUES(p_key,p_actor,fp,to_jsonb(c)-'contact_label'-'created_by');
 RETURN to_jsonb(c)-'contact_label'-'created_by';
END $$;
REVOKE ALL ON FUNCTION public.lending_catalog_submit(uuid,uuid,bigint,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_catalog_submit(uuid,uuid,bigint,text,uuid) TO service_role;
COMMIT;
