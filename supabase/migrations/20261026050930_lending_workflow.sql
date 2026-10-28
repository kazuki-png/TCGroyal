-- Lending workflow: local development and the explicitly selected Preview only.
-- Production application is outside the current authorization.
BEGIN;
CREATE TABLE public.lending_product_mappings (
 card_uid uuid PRIMARY KEY REFERENCES public.cards(public_uid),
 product_id text NOT NULL CHECK(product_id ~ '^[1-9][0-9]{0,8}$'),
 verified_by uuid NOT NULL REFERENCES auth.users(id),
 verified_at timestamptz NOT NULL DEFAULT now(),
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.lending_quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 card_uid uuid NOT NULL REFERENCES public.cards(public_uid), product_id text NOT NULL,
 card_name text NOT NULL, card_number text, market_snapshot jsonb NOT NULL,
 buy_price_jpy bigint NOT NULL CHECK(buy_price_jpy > 0),
 cap_jpy bigint NOT NULL CHECK(cap_jpy BETWEEN 100000 AND 10000000),
 rule_version text NOT NULL DEFAULT 'snkrdunk-preview-v1',
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes'
);
CREATE TABLE public.lending_loans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 quote_id uuid NOT NULL UNIQUE REFERENCES public.lending_quotes(id),
 cert_number text NOT NULL CHECK(cert_number ~ '^[0-9]{6,12}$'),
 requested_jpy bigint NOT NULL CHECK(requested_jpy BETWEEN 100000 AND 10000000 AND requested_jpy%10000=0),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN
 ('submitted','received','offered','accepted','active','repayment_pending','return_pending','returned','forfeited','rejected','cancelled')),
 version integer NOT NULL DEFAULT 1,
 deposit_method text NOT NULL CHECK(deposit_method IN ('mail','store')),
 storage_location text, inspected_by uuid REFERENCES auth.users(id), inspected_at timestamptz,
 offered_jpy bigint CHECK(offered_jpy BETWEEN 100000 AND 10000000),
 monthly_rate_bps integer CHECK(monthly_rate_bps BETWEEN 0 AND 200),
 terms jsonb, terms_accepted_at timestamptz, offer_expires_at timestamptz,
 principal_jpy bigint NOT NULL DEFAULT 0 CHECK(principal_jpy BETWEEN 0 AND 10000000),
 funded_at timestamptz, interest_start_at timestamptz, due_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lending_reserved_cert ON public.lending_loans(cert_number)
 WHERE status NOT IN ('cancelled','rejected','returned');
CREATE INDEX lending_loans_user_idx ON public.lending_loans(user_id,created_at DESC);
CREATE TABLE public.lending_identity_checks (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 method text NOT NULL CHECK(method IN ('jpki','test_fixture')),
 verified_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 evidence_reference text NOT NULL, verified_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE TABLE public.lending_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), loan_id uuid NOT NULL REFERENCES public.lending_loans(id),
 kind text NOT NULL CHECK(kind IN ('disbursement','repayment','extension_interest','forfeiture')),
 amount_jpy bigint NOT NULL CHECK(amount_jpy>0),
 external_reference text NOT NULL UNIQUE CHECK(length(external_reference) BETWEEN 4 AND 120),
 recorded_by uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lending_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), loan_id uuid NOT NULL REFERENCES public.lending_loans(id),
 kind text NOT NULL CHECK(kind IN ('extension','additional')),
 amount_jpy bigint NOT NULL CHECK(amount_jpy>=0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','rejected')),
 consent_terms jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lending_one_pending_request ON public.lending_requests(loan_id) WHERE status='pending';
CREATE INDEX lending_ledger_loan_idx ON public.lending_ledger(loan_id);
CREATE TABLE public.lending_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), loan_id uuid NOT NULL REFERENCES public.lending_loans(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id), action text NOT NULL,
 from_status text, to_status text NOT NULL, version integer NOT NULL,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lending_command_receipts (
 key uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES auth.users(id),
 fingerprint jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lending_events_loan_idx ON public.lending_events(loan_id,version);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['lending_product_mappings','lending_quotes','lending_loans','lending_identity_checks',
 'lending_ledger','lending_requests','lending_events','lending_command_receipts'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO service_role',t);
 END LOOP;
END $$;

CREATE FUNCTION public.lending_immutable() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'immutable_evidence'; END $$;
CREATE TRIGGER lending_quotes_immutable BEFORE UPDATE OR DELETE ON public.lending_quotes FOR EACH ROW EXECUTE FUNCTION public.lending_immutable();
CREATE TRIGGER lending_events_immutable BEFORE UPDATE OR DELETE ON public.lending_events FOR EACH ROW EXECUTE FUNCTION public.lending_immutable();
CREATE TRIGGER lending_ledger_immutable BEFORE UPDATE OR DELETE ON public.lending_ledger FOR EACH ROW EXECUTE FUNCTION public.lending_immutable();
CREATE TRIGGER lending_receipts_immutable BEFORE UPDATE OR DELETE ON public.lending_command_receipts FOR EACH ROW EXECUTE FUNCTION public.lending_immutable();

CREATE FUNCTION public.lending_request_evidence_guard() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status')
 OR OLD.status<>'pending' OR NEW.status NOT IN ('completed','rejected') THEN RAISE EXCEPTION 'immutable_request_evidence'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lending_request_evidence BEFORE UPDATE OR DELETE ON public.lending_requests FOR EACH ROW EXECUTE FUNCTION public.lending_request_evidence_guard();

CREATE FUNCTION public.lending_invalidate_identity() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF ROW(NEW.last_name,NEW.first_name,NEW.birthday,NEW.address,NEW.postal_code)
 IS DISTINCT FROM ROW(OLD.last_name,OLD.first_name,OLD.birthday,OLD.address,OLD.postal_code) THEN
  UPDATE public.lending_identity_checks SET expires_at=least(expires_at,now()) WHERE user_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lending_identity_profile_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.lending_invalidate_identity();

CREATE FUNCTION public.lending_is_admin(p_actor uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND role='admin')
$$;

CREATE FUNCTION public.lending_interest(p_principal bigint,p_rate integer,p_start timestamptz,p_at timestamptz)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE m integer:=1; BEGIN
 IF p_at<p_start THEN RETURN 0; END IF;
 WHILE m<3 AND (p_start AT TIME ZONE 'Asia/Tokyo')+make_interval(months=>m)<(p_at AT TIME ZONE 'Asia/Tokyo') LOOP m:=m+1; END LOOP;
 RETURN ceil(p_principal::numeric*p_rate*m/10000)::bigint;
END $$;

CREATE FUNCTION public.lending_verify_mapping(p_actor uuid,p_card uuid,p_product text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.lending_is_admin(p_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cards WHERE public_uid=p_card AND grade='PSA10' AND category IN ('pokemon','onepiece')) THEN RAISE EXCEPTION 'unsupported_card'; END IF;
 INSERT INTO public.lending_product_mappings(card_uid,product_id,verified_by) VALUES(p_card,p_product,p_actor)
 ON CONFLICT(card_uid) DO UPDATE SET product_id=excluded.product_id,verified_by=p_actor,verified_at=now(),active=true;
END $$;

CREATE FUNCTION public.lending_create_quote(p_actor uuid,p_card uuid,p_market jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE c public.cards; m public.lending_product_mappings; q public.lending_quotes; floor_jpy bigint; cap bigint; BEGIN
 SELECT * INTO c FROM public.cards WHERE public_uid=p_card;
 SELECT * INTO m FROM public.lending_product_mappings WHERE card_uid=p_card AND active;
 IF c.id IS NULL OR m.card_uid IS NULL OR c.grade<>'PSA10' OR c.category NOT IN ('pokemon','onepiece') THEN RAISE EXCEPTION 'unsupported_card'; END IF;
 IF c.buy_price<=0 OR c.buy_price_updated_at IS NULL OR c.buy_price_updated_at<now()-interval '24 hours' OR c.buy_price_updated_at>now() THEN RAISE EXCEPTION 'stale_price'; END IF;
 IF p_market->>'grade' IS DISTINCT FROM 'PSA10' OR p_market->>'currency' IS DISTINCT FROM 'JPY'
 OR p_market->>'provider' IS DISTINCT FROM 'snkrdunk' OR p_market->>'productId' IS DISTINCT FROM m.product_id
 OR (p_market->>'fetchedAt') IS NULL OR (p_market->>'fetchedAt')::timestamptz<now()-interval '5 minutes'
 OR (p_market->>'fetchedAt')::timestamptz>now() THEN RAISE EXCEPTION 'invalid_market'; END IF;
 floor_jpy:=(p_market->>'floorPriceJpy')::bigint;
 IF floor_jpy IS NULL OR floor_jpy<=0 OR floor_jpy>1000000000 THEN RAISE EXCEPTION 'invalid_market'; END IF;
 cap:=floor(least(floor_jpy::numeric*0.4,c.buy_price::numeric*0.6,10000000)/1000)*1000;
 IF cap<100000 THEN RAISE EXCEPTION 'below_minimum'; END IF;
 INSERT INTO public.lending_quotes(user_id,card_uid,product_id,card_name,card_number,market_snapshot,buy_price_jpy,cap_jpy)
 VALUES(p_actor,p_card,m.product_id,c.name,c.card_number,p_market,c.buy_price,cap) RETURNING * INTO q;
 RETURN jsonb_build_object('id',q.id,'card_name',q.card_name,'cap_jpy',q.cap_jpy,'expires_at',q.expires_at);
END $$;

CREATE FUNCTION public.lending_apply(p_actor uuid,p_quote uuid,p_cert text,p_amount bigint,p_deposit text,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE q public.lending_quotes; l public.lending_loans; r public.lending_command_receipts;
 fp jsonb:=jsonb_build_object('action','apply','quote',p_quote,'cert',p_cert,'amount',p_amount,'deposit',p_deposit); BEGIN
 IF p_actor IS NULL OR p_key IS NULL THEN RAISE EXCEPTION 'invalid_actor_or_key'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor::text,1));
 SELECT * INTO r FROM public.lending_command_receipts WHERE key=p_key;
 IF FOUND THEN
  IF r.actor_id<>p_actor OR r.fingerprint<>fp THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
  RETURN r.result;
 END IF;
 SELECT * INTO q FROM public.lending_quotes WHERE id=p_quote AND user_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF q.expires_at<now() OR p_amount>q.cap_jpy THEN RAISE EXCEPTION 'quote_expired_or_exceeded'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.lending_product_mappings WHERE card_uid=q.card_uid AND product_id=q.product_id AND active) THEN RAISE EXCEPTION 'mapping_changed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND birthday<=current_date-interval '18 years') THEN RAISE EXCEPTION 'adult_profile_required'; END IF;
 IF coalesce((SELECT sum(CASE WHEN status IN ('active','repayment_pending') THEN principal_jpy ELSE requested_jpy END)
 FROM public.lending_loans WHERE user_id=p_actor AND status NOT IN ('cancelled','rejected','returned','forfeited','return_pending')),0)+p_amount>10000000 THEN RAISE EXCEPTION 'customer_limit_exceeded'; END IF;
 INSERT INTO public.lending_loans(user_id,quote_id,cert_number,requested_jpy,deposit_method)
 VALUES(p_actor,p_quote,p_cert,p_amount,p_deposit) RETURNING * INTO l;
 INSERT INTO public.lending_events(loan_id,actor_id,action,to_status,version) VALUES(l.id,p_actor,'apply',l.status,l.version);
 INSERT INTO public.lending_command_receipts(key,actor_id,fingerprint,result) VALUES(p_key,p_actor,fp,to_jsonb(l));
 RETURN to_jsonb(l);
END $$;

CREATE FUNCTION public.lending_command(p_actor uuid,p_loan uuid,p_action text,p_payload jsonb,p_key uuid,p_version integer) RETURNS jsonb
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
  assessment_id:=(public.lending_create_quote(l.user_id,q.card_uid,p_payload->'market')->>'id')::uuid;
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

CREATE FUNCTION public.lending_list(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object(
 'outstandingJpy',coalesce((SELECT sum(principal_jpy) FROM public.lending_loans WHERE user_id=p_actor OR public.lending_is_admin(p_actor)),0),
 'loanCount',(SELECT count(*) FROM public.lending_loans WHERE user_id=p_actor OR public.lending_is_admin(p_actor)),
 'identityVerified',EXISTS(SELECT 1 FROM public.lending_identity_checks WHERE user_id=p_actor AND expires_at>now()),
 'cards',coalesce((SELECT jsonb_agg(jsonb_build_object('public_uid',c.public_uid,'name',c.name,'card_number',c.card_number,'productId',m.product_id))
 FROM public.cards c JOIN public.lending_product_mappings m ON m.card_uid=c.public_uid AND m.active WHERE c.grade='PSA10'),'[]'::jsonb),
 'loans',coalesce((SELECT jsonb_agg(item ORDER BY created_at DESC) FROM (
 SELECT l.created_at,(to_jsonb(l)-'storage_location'-'inspected_by') || jsonb_build_object(
 'card_name',q.card_name,'card_number',q.card_number,'evaluated_at',now(),
 'storage_location',CASE WHEN public.lending_is_admin(p_actor) THEN l.storage_location ELSE NULL END,
 'payoff_jpy',CASE WHEN l.status IN ('active','repayment_pending') THEN l.principal_jpy+public.lending_interest(l.principal_jpy,l.monthly_rate_bps,l.interest_start_at,now()) ELSE 0 END,
 'ledger',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'amount_jpy',e.amount_jpy,'created_at',e.created_at) ORDER BY e.created_at) FROM public.lending_ledger e WHERE e.loan_id=l.id),'[]'::jsonb),
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('action',e.action,'to_status',e.to_status,'version',e.version,'created_at',e.created_at,'reason',e.details->>'reason') ORDER BY e.version) FROM public.lending_events e WHERE e.loan_id=l.id),'[]'::jsonb),
 'requests',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM public.lending_requests r WHERE r.loan_id=l.id),'[]'::jsonb)
 ) AS item FROM public.lending_loans l JOIN public.lending_quotes q ON q.id=l.quote_id
 WHERE l.user_id=p_actor OR public.lending_is_admin(p_actor) ORDER BY l.created_at DESC LIMIT 50
 ) items),'[]'::jsonb))
$$;

-- Only the server can read financial records or execute business commands.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname LIKE 'lending_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
COMMIT;
