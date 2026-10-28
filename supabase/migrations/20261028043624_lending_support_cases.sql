BEGIN;
CREATE TABLE public.lending_support_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reference text NOT NULL UNIQUE DEFAULT ('TR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 user_id uuid REFERENCES auth.users(id), created_by uuid NOT NULL REFERENCES auth.users(id),
 source text NOT NULL CHECK(source IN ('app','admin')),
 reason text NOT NULL CHECK(reason IN ('ungraded','no_certificate','other')),
 card_name text NOT NULL CHECK(length(trim(card_name)) BETWEEN 1 AND 100),
 card_number text NOT NULL DEFAULT '' CHECK(length(card_number)<=100),
 condition text NOT NULL DEFAULT '' CHECK(length(condition)<=300),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
 contact_label text NOT NULL DEFAULT '' CHECK(length(contact_label)<=100),
 status text NOT NULL DEFAULT 'registered' CHECK(status IN ('registered','reviewing','information_required','offered','applied','declined','cancelled')),
 requested_jpy bigint CHECK(requested_jpy BETWEEN 1 AND 10000000),
 valuation_jpy bigint CHECK(valuation_jpy BETWEEN 1 AND 1000000000),
 offer_jpy bigint CHECK(offer_jpy BETWEEN 100000 AND 10000000 AND offer_jpy%10000=0),
 reviewed_by uuid REFERENCES auth.users(id), offer_note text CHECK(length(offer_note)<=500), offer_expires_at timestamptz,
 loan_id uuid UNIQUE REFERENCES public.lending_loans(id), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lending_support_cases_owner ON public.lending_support_cases(user_id,created_at DESC);
CREATE TABLE public.lending_support_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.lending_support_cases(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id), action text NOT NULL, to_status text NOT NULL,
 version integer NOT NULL, message text NOT NULL DEFAULT '' CHECK(length(message)<=500),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(case_id,version)
);
ALTER TABLE public.lending_support_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lending_support_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lending_support_cases,public.lending_support_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.lending_support_cases TO service_role;
GRANT SELECT,INSERT ON public.lending_support_events TO service_role;
CREATE TRIGGER lending_support_events_immutable BEFORE UPDATE OR DELETE ON public.lending_support_events FOR EACH ROW EXECUTE FUNCTION public.lending_immutable();
ALTER TABLE public.lending_quotes ADD COLUMN source text NOT NULL DEFAULT 'snkrdunk' CHECK(source IN ('snkrdunk','support'));
ALTER TABLE public.lending_quotes ADD COLUMN support_case_id uuid REFERENCES public.lending_support_cases(id);
ALTER TABLE public.lending_quotes ALTER COLUMN card_uid DROP NOT NULL;
ALTER TABLE public.lending_quotes ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.lending_quotes ALTER COLUMN buy_price_jpy DROP NOT NULL;
ALTER TABLE public.lending_quotes ADD CONSTRAINT lending_quote_source_evidence CHECK (
 (source='snkrdunk' AND card_uid IS NOT NULL AND product_id IS NOT NULL AND buy_price_jpy IS NOT NULL AND support_case_id IS NULL)
 OR (source='support' AND card_uid IS NULL AND product_id IS NULL AND buy_price_jpy IS NULL AND support_case_id IS NOT NULL));
ALTER TABLE public.lending_loans ALTER COLUMN cert_number DROP NOT NULL;

CREATE FUNCTION public.lending_support_list(p_actor uuid,p_search text DEFAULT '') RETURNS jsonb LANGUAGE sql STABLE
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('cases',coalesce((SELECT jsonb_agg(item ORDER BY created_at DESC) FROM (
 SELECT c.created_at,(to_jsonb(c)-'created_by'-'contact_label') ||
 CASE WHEN public.lending_is_admin(p_actor) THEN jsonb_build_object('contact_label',c.contact_label) ELSE '{}'::jsonb END || jsonb_build_object(
 'loan_status',l.status,'events',coalesce((SELECT jsonb_agg(to_jsonb(e)-'actor_id' ORDER BY e.version) FROM public.lending_support_events e WHERE e.case_id=c.id),'[]'::jsonb)) item
 FROM public.lending_support_cases c LEFT JOIN public.lending_loans l ON l.id=c.loan_id
 WHERE (c.user_id=p_actor OR public.lending_is_admin(p_actor)) AND (p_search='' OR c.reference ILIKE '%'||left(p_search,100)||'%' OR c.card_name ILIKE '%'||left(p_search,100)||'%')
 ORDER BY c.created_at DESC LIMIT 100) x),'[]'::jsonb),
 'total',(SELECT count(*) FROM public.lending_support_cases WHERE user_id=p_actor OR public.lending_is_admin(p_actor)))
$$;
CREATE FUNCTION public.lending_support_create(p_actor uuid,p_input jsonb,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE c public.lending_support_cases; receipt public.lending_command_receipts; owner_id uuid;
 admin boolean:=public.lending_is_admin(p_actor); fp jsonb:=jsonb_build_object('action','support_create','input',p_input);
BEGIN
 IF p_actor IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'invalid_actor_or_key'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO receipt FROM public.lending_command_receipts WHERE key=p_key;
 IF FOUND THEN IF receipt.actor_id<>p_actor OR receipt.fingerprint<>fp THEN RAISE EXCEPTION 'idempotency_conflict'; END IF; RETURN receipt.result; END IF;
 IF NOT admin AND (p_input ? 'userId' OR p_input ? 'contactLabel') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_input->>'consent' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'consent_required'; END IF;
 owner_id:=CASE WHEN admin THEN nullif(p_input->>'userId','')::uuid ELSE p_actor END;
 IF owner_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=owner_id) THEN RAISE EXCEPTION 'customer_not_found'; END IF;
 INSERT INTO public.lending_support_cases(user_id,created_by,source,reason,card_name,card_number,condition,notes,requested_jpy,contact_label)
 VALUES(owner_id,p_actor,CASE WHEN admin THEN 'admin' ELSE 'app' END,p_input->>'reason',trim(p_input->>'cardName'),
 coalesce(p_input->>'cardNumber',''),coalesce(p_input->>'condition',''),coalesce(p_input->>'notes',''),nullif(p_input->>'requestedAmount','')::bigint,coalesce(p_input->>'contactLabel','')) RETURNING * INTO c;
 INSERT INTO public.lending_support_events(case_id,actor_id,action,to_status,version) VALUES(c.id,p_actor,'create',c.status,c.version);
 INSERT INTO public.lending_command_receipts(key,actor_id,fingerprint,result) VALUES(p_key,p_actor,fp,to_jsonb(c)-'contact_label'-'created_by');
 RETURN to_jsonb(c)-'contact_label'-'created_by';
END $$;
CREATE FUNCTION public.lending_support_command(p_actor uuid,p_case uuid,p_action text,p_payload jsonb,p_key uuid,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE c public.lending_support_cases; receipt public.lending_command_receipts; admin boolean:=public.lending_is_admin(p_actor);
 fp jsonb:=jsonb_build_object('action','support_command','case',p_case,'command',p_action,'payload',p_payload,'version',p_version);
 q public.lending_quotes; l public.lending_loans; amount bigint; owner_id uuid; msg text:=coalesce(p_payload->>'message','');
BEGIN
 IF p_actor IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'invalid_actor_or_key'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO c FROM public.lending_support_cases WHERE id=p_case FOR UPDATE;
 IF NOT FOUND OR (NOT admin AND c.user_id IS DISTINCT FROM p_actor) THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT * INTO receipt FROM public.lending_command_receipts WHERE key=p_key;
 IF FOUND THEN IF receipt.actor_id<>p_actor OR receipt.fingerprint<>fp THEN RAISE EXCEPTION 'idempotency_conflict'; END IF; RETURN receipt.result; END IF;
 IF c.version<>p_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
 IF c.status IN ('applied','declined','cancelled') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
 IF p_action='accept' THEN
  IF c.user_id IS DISTINCT FROM p_actor OR c.status<>'offered' OR c.offer_expires_at<=now() OR p_payload->>'termsAccepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'consent_or_offer_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,1));
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND birthday<=current_date-interval '18 years') THEN RAISE EXCEPTION 'adult_profile_required'; END IF;
  amount:=(p_payload->>'amountJpy')::bigint;
  IF amount IS NULL OR amount<100000 OR amount>c.offer_jpy OR amount%10000<>0 THEN RAISE EXCEPTION 'amount_invalid'; END IF;
  IF coalesce((SELECT sum(CASE WHEN status IN ('active','repayment_pending') THEN principal_jpy ELSE requested_jpy END) FROM public.lending_loans
    WHERE user_id=p_actor AND status NOT IN ('cancelled','rejected','returned','forfeited','return_pending')),0)+amount>10000000 THEN RAISE EXCEPTION 'customer_limit_exceeded'; END IF;
  INSERT INTO public.lending_quotes(user_id,card_name,card_number,market_snapshot,cap_jpy,source,support_case_id,expires_at)
  VALUES(p_actor,c.card_name,c.card_number,jsonb_build_object('provider','manual_support','valuationJpy',c.valuation_jpy,'basis',c.offer_note,'reviewedBy',c.reviewed_by,'caseVersion',c.version),c.offer_jpy,'support',c.id,c.offer_expires_at) RETURNING * INTO q;
  INSERT INTO public.lending_loans(user_id,quote_id,cert_number,requested_jpy,deposit_method)
  VALUES(p_actor,q.id,NULL,amount,p_payload->>'deposit') RETURNING * INTO l;
  INSERT INTO public.lending_events(loan_id,actor_id,action,to_status,version,details) VALUES(l.id,p_actor,'apply','submitted',1,jsonb_build_object('supportReference',c.reference,'caseId',c.id,'preliminaryEstimate',true));
  c.loan_id:=l.id;c.status:='applied'; msg:='見積もりを確認して申込。現物検品後に最終条件を提示します。';
 ELSIF p_action='cancel' THEN
  IF c.user_id IS DISTINCT FROM p_actor AND NOT admin THEN RAISE EXCEPTION 'forbidden'; END IF;
  c.status:='cancelled';
 ELSE
  IF NOT admin THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_action='link' THEN
   owner_id:=(p_payload->>'userId')::uuid;
   IF c.user_id IS NOT NULL OR owner_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=owner_id) THEN RAISE EXCEPTION 'customer_link_invalid'; END IF;
   c.user_id:=owner_id;msg:='会員アカウントを確認して紐付けました。';
  ELSIF p_action='review' AND c.status IN ('registered','information_required','reviewing') THEN c.status:='reviewing';
  ELSIF p_action='request_info' AND c.status IN ('registered','reviewing','information_required','offered') THEN c.status:='information_required';c.offer_expires_at:=now();
  ELSIF p_action='decline' THEN c.status:='declined';
  ELSIF p_action='offer' AND c.status IN ('reviewing','information_required','offered') THEN
   IF c.user_id IS NULL THEN RAISE EXCEPTION 'customer_link_required'; END IF;
   c.offer_jpy:=(p_payload->>'amountJpy')::bigint;c.valuation_jpy:=(p_payload->>'valuationJpy')::bigint;
   IF c.offer_jpy IS NULL OR c.valuation_jpy IS NULL OR c.offer_jpy>c.valuation_jpy THEN RAISE EXCEPTION 'amount_invalid'; END IF;
   c.reviewed_by:=p_actor;c.offer_note:=msg;c.offer_expires_at:=now()+interval '24 hours';c.status:='offered';
  ELSE RAISE EXCEPTION 'invalid_transition'; END IF;
  IF p_action<>'link' AND length(trim(msg)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'reason_required'; END IF;
 END IF;
 UPDATE public.lending_support_cases SET status=c.status,user_id=c.user_id,offer_jpy=c.offer_jpy,valuation_jpy=c.valuation_jpy,
 reviewed_by=c.reviewed_by,offer_note=c.offer_note,offer_expires_at=c.offer_expires_at,loan_id=c.loan_id,version=version+1,updated_at=now() WHERE id=c.id RETURNING * INTO c;
 INSERT INTO public.lending_support_events(case_id,actor_id,action,to_status,version,message) VALUES(c.id,p_actor,p_action,c.status,c.version,msg);
 INSERT INTO public.lending_command_receipts(key,actor_id,fingerprint,result) VALUES(p_key,p_actor,fp,to_jsonb(c)-'contact_label'-'created_by');
 RETURN to_jsonb(c)-'contact_label'-'created_by';
END $$;
CREATE OR REPLACE FUNCTION public.lending_command(p_actor uuid,p_loan uuid,p_action text,p_payload jsonb,p_key uuid,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE l public.lending_loans; q public.lending_quotes; r public.lending_command_receipts; req public.lending_requests;
 admin boolean:=public.lending_is_admin(p_actor); old_status text; amount bigint; interest bigint; ref text; assessment_id uuid;
 fp jsonb:=jsonb_build_object('loan',p_loan,'action',p_action,'payload',p_payload-'market','version',p_version);
BEGIN
 IF p_actor IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'invalid_actor_or_key'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO l FROM public.lending_loans WHERE id=p_loan FOR UPDATE;
 IF NOT FOUND OR (NOT admin AND l.user_id<>p_actor) THEN RAISE EXCEPTION 'not_found'; END IF;
 SELECT * INTO r FROM public.lending_command_receipts WHERE key=p_key;
 IF FOUND THEN
  IF r.actor_id<>p_actor OR r.fingerprint<>fp THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
  RETURN r.result;
 END IF;
 IF l.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
 IF p_action IN ('cancel','accept','report_repayment','request_extension','request_additional') THEN
  IF l.user_id<>p_actor THEN RAISE EXCEPTION 'forbidden'; END IF;
 ELSE
  IF NOT admin THEN RAISE EXCEPTION 'forbidden'; END IF;
 END IF;
 SELECT * INTO q FROM public.lending_quotes WHERE id=l.quote_id;
 IF l.cert_number IS NULL AND q.source<>'support' THEN RAISE EXCEPTION 'certificate_required'; END IF;
 old_status:=l.status;
 IF p_action='cancel' AND l.status IN ('submitted','received','offered','accepted') THEN
  -- A received physical card must remain reserved until its return is recorded.
  l.status:=CASE WHEN l.inspected_at IS NULL THEN 'cancelled' ELSE 'return_pending' END;
 ELSIF p_action='receive' AND l.status='submitted' THEN
  IF coalesce(length(trim(p_payload->>'location')),0) NOT BETWEEN 1 AND 120 OR p_payload->>'certNumber' IS DISTINCT FROM l.cert_number
  OR p_payload->>'inspected' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'inspection_required'; END IF;
  l.storage_location:=trim(p_payload->>'location'); l.inspected_at:=now(); l.inspected_by:=p_actor; l.status:='received';
 ELSIF p_action='offer' AND l.status IN ('received','offered','accepted') THEN
  IF NOT EXISTS(SELECT 1 FROM public.lending_identity_checks WHERE user_id=l.user_id AND expires_at>now()) THEN RAISE EXCEPTION 'identity_required'; END IF;
  -- Revalue on arrival, rather than approving against the customer's old estimate.
  IF q.source='support' THEN
   IF (p_payload->>'manualValuationJpy')::bigint IS NULL OR (p_payload->>'manualValuationJpy')::bigint NOT BETWEEN 1 AND 1000000000
    OR (p_payload->>'manualCapJpy')::bigint IS NULL OR (p_payload->>'manualCapJpy')::bigint>(p_payload->>'manualValuationJpy')::bigint
    OR coalesce(length(trim(p_payload->>'reason')),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'manual_evidence_required'; END IF;
   INSERT INTO public.lending_quotes(user_id,card_name,card_number,market_snapshot,cap_jpy,source,support_case_id,expires_at)
   VALUES(l.user_id,q.card_name,q.card_number,jsonb_build_object('provider','manual_support','valuationJpy',(p_payload->>'manualValuationJpy')::bigint,'basis',p_payload->>'reason','reviewedBy',p_actor),
    (p_payload->>'manualCapJpy')::bigint,'support',q.support_case_id,now()+interval '24 hours') RETURNING id INTO assessment_id;
  ELSE
   assessment_id:=(public.lending_create_quote(l.user_id,q.card_uid,p_payload->'market')->>'id')::uuid;
  END IF;
  SELECT * INTO STRICT q FROM public.lending_quotes WHERE id=assessment_id;
  amount:=(p_payload->>'amountJpy')::bigint;
  IF amount IS NULL OR amount<100000 OR amount>least(l.requested_jpy,q.cap_jpy) OR amount%10000<>0 THEN RAISE EXCEPTION 'amount_invalid'; END IF;
  l.monthly_rate_bps:=(p_payload->>'monthlyRateBps')::integer;
  IF l.monthly_rate_bps IS NULL OR l.monthly_rate_bps NOT BETWEEN 0 AND 200 THEN RAISE EXCEPTION 'rate_invalid'; END IF;
  l.offered_jpy:=amount; l.offer_expires_at:=now()+interval '24 hours'; l.terms_accepted_at:=NULL;
  l.terms:=jsonb_build_object('version',l.version+1,'principalJpy',amount,'monthlyRateBps',l.monthly_rate_bps,'termMonths',3,'feesJpy',0,'earlyRepayment','calendar_month_ceil_min_one_max_three','productId',q.product_id,'certNumber',l.cert_number,'assessmentQuoteId',q.id,'documentVersion','local-draft-v1');
  l.status:='offered';
 ELSIF p_action='accept' AND l.status='offered' THEN
  IF l.offer_expires_at<now() OR p_payload->>'termsAccepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'consent_required'; END IF;
  l.terms_accepted_at:=now(); l.status:='accepted';
 ELSIF p_action='fund' AND l.status='accepted' THEN
  IF l.offer_expires_at<now() OR NOT EXISTS(SELECT 1 FROM public.lending_identity_checks WHERE user_id=l.user_id AND expires_at>now()) THEN RAISE EXCEPTION 'identity_or_offer_expired'; END IF;
  amount:=(p_payload->>'amountJpy')::bigint;
  IF amount IS DISTINCT FROM l.offered_jpy THEN RAISE EXCEPTION 'amount_invalid'; END IF;
  ref:=trim(p_payload->>'reference');
  INSERT INTO public.lending_ledger(loan_id,kind,amount_jpy,external_reference,recorded_by) VALUES(l.id,'disbursement',amount,ref,p_actor);
  l.principal_jpy:=amount; l.funded_at:=now(); l.interest_start_at:=now();
  l.due_at:=((now() AT TIME ZONE 'Asia/Tokyo')+interval '3 months') AT TIME ZONE 'Asia/Tokyo'; l.status:='active';
 ELSIF p_action='report_repayment' AND l.status='active' THEN
  l.status:='repayment_pending';
 ELSIF p_action='reject_repayment' AND l.status='repayment_pending' THEN
  IF coalesce(length(trim(p_payload->>'reason')),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'reason_required'; END IF;
  l.status:='active';
 ELSIF p_action='confirm_repayment' AND l.status IN ('active','repayment_pending') THEN
  interest:=public.lending_interest(l.principal_jpy,l.monthly_rate_bps,l.interest_start_at,now());
  amount:=(p_payload->>'amountJpy')::bigint;
  IF amount IS DISTINCT FROM l.principal_jpy+interest THEN RAISE EXCEPTION 'repayment_amount_mismatch'; END IF;
  INSERT INTO public.lending_ledger(loan_id,kind,amount_jpy,external_reference,recorded_by)
  VALUES(l.id,'repayment',amount,trim(p_payload->>'reference'),p_actor);
  l.principal_jpy:=0; l.status:='return_pending';
  UPDATE public.lending_requests SET status='rejected' WHERE loan_id=l.id AND status='pending';
 ELSIF p_action='return' AND l.status='return_pending' THEN
  IF coalesce(length(trim(p_payload->>'reference')),0) NOT BETWEEN 4 AND 120 THEN RAISE EXCEPTION 'return_reference_required'; END IF;
  l.status:='returned';
 ELSIF p_action='reject' AND l.status IN ('submitted','received','offered','accepted') THEN
  IF coalesce(length(trim(p_payload->>'reason')),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'reason_required'; END IF;
  l.status:=CASE WHEN l.inspected_at IS NULL THEN 'rejected' ELSE 'return_pending' END;
 ELSIF p_action IN ('request_extension','request_additional') AND l.status='active' AND now()<l.due_at THEN
  IF p_payload->>'termsAccepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'consent_required'; END IF;
  amount:=CASE WHEN p_action='request_extension' THEN ceil(l.principal_jpy::numeric*l.monthly_rate_bps*3/10000)::bigint ELSE (p_payload->>'amountJpy')::bigint END;
  IF amount IS NULL OR (p_action='request_additional' AND (amount<10000 OR amount%10000<>0 OR amount>10000000-l.principal_jpy)) THEN RAISE EXCEPTION 'amount_invalid'; END IF;
  INSERT INTO public.lending_requests(loan_id,kind,amount_jpy,consent_terms)
  VALUES(l.id,CASE WHEN p_action='request_extension' THEN 'extension' ELSE 'additional' END,amount,
  CASE WHEN p_action='request_extension' THEN
   jsonb_build_object('loanVersion',l.version,'principalJpy',l.principal_jpy,'monthlyRateBps',l.monthly_rate_bps,'interestJpy',amount,'oldDueAt',l.due_at,'newDueAt',((l.due_at AT TIME ZONE 'Asia/Tokyo')+interval '3 months') AT TIME ZONE 'Asia/Tokyo')
  ELSE jsonb_build_object('loanVersion',l.version,'requestedAdditionalJpy',amount,'requiresNewAssessment',true,'requiresNewAgreement',true) END);
 ELSIF p_action IN ('extend','reject_request') AND l.status='active' THEN
  SELECT * INTO req FROM public.lending_requests WHERE loan_id=l.id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_missing'; END IF;
  IF p_action='reject_request' THEN
   UPDATE public.lending_requests SET status='rejected' WHERE id=req.id;
  ELSE
   IF req.kind<>'extension' OR now()>=l.due_at THEN RAISE EXCEPTION 'extension_unavailable'; END IF;
   amount:=(p_payload->>'amountJpy')::bigint;
   IF amount IS DISTINCT FROM req.amount_jpy THEN RAISE EXCEPTION 'extension_amount_mismatch'; END IF;
   IF amount>0 THEN INSERT INTO public.lending_ledger(loan_id,kind,amount_jpy,external_reference,recorded_by) VALUES(l.id,'extension_interest',amount,trim(p_payload->>'reference'),p_actor); END IF;
   l.interest_start_at:=l.due_at;
   l.due_at:=((l.due_at AT TIME ZONE 'Asia/Tokyo')+interval '3 months') AT TIME ZONE 'Asia/Tokyo';
   UPDATE public.lending_requests SET status='completed' WHERE id=req.id;
  END IF;
 ELSIF p_action='forfeit' AND l.status='active' AND now()>l.due_at THEN
  IF p_payload->>'reviewed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'review_required'; END IF;
  IF EXISTS(SELECT 1 FROM public.lending_requests WHERE loan_id=l.id AND status='pending') THEN RAISE EXCEPTION 'unresolved_request'; END IF;
  INSERT INTO public.lending_ledger(loan_id,kind,amount_jpy,external_reference,recorded_by)
  VALUES(l.id,'forfeiture',l.principal_jpy,'forfeit:'||l.id::text,p_actor);
  l.principal_jpy:=0; l.status:='forfeited';
  UPDATE public.lending_requests SET status='rejected' WHERE loan_id=l.id AND status='pending';
 ELSE RAISE EXCEPTION 'invalid_transition'; END IF;
 l.version:=l.version+1; l.updated_at:=now();
 UPDATE public.lending_loans SET status=l.status,version=l.version,storage_location=l.storage_location,inspected_by=l.inspected_by,
 inspected_at=l.inspected_at,offered_jpy=l.offered_jpy,monthly_rate_bps=l.monthly_rate_bps,terms=l.terms,
 terms_accepted_at=l.terms_accepted_at,offer_expires_at=l.offer_expires_at,principal_jpy=l.principal_jpy,
 funded_at=l.funded_at,interest_start_at=l.interest_start_at,due_at=l.due_at,updated_at=l.updated_at WHERE id=l.id;
 INSERT INTO public.lending_events(loan_id,actor_id,action,from_status,to_status,version,details)
 VALUES(l.id,p_actor,p_action,old_status,l.status,l.version,
 p_payload||CASE WHEN p_action IN ('offer','accept') THEN jsonb_build_object('termsSnapshot',l.terms) ELSE '{}'::jsonb END);
 INSERT INTO public.lending_command_receipts(key,actor_id,fingerprint,result) VALUES(p_key,p_actor,fp,to_jsonb(l));
 RETURN to_jsonb(l);
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'lending_support_%' LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
