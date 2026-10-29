BEGIN;
-- Immutable, bounded line snapshots. Existing one-card cases keep empty arrays.
CREATE FUNCTION public.lending_collateral_valid(items jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE item jsonb; total integer:=0; ids text[]:='{}';
BEGIN
 IF jsonb_typeof(items)<>'array' OR jsonb_array_length(items)>20 THEN RETURN false; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
  IF jsonb_typeof(item)<>'object' OR NOT item ?& ARRAY['id','name','cardNumber','quantity','grade','condition','source','productId','cardUid']
   OR (SELECT count(*) FROM jsonb_object_keys(item))<>9 THEN RETURN false; END IF;
  IF (item->>'id')::uuid IS NULL OR item->>'id'=ANY(ids) THEN RETURN false; END IF;
  ids:=array_append(ids,item->>'id');
  IF jsonb_typeof(item->'name')<>'string' OR length(trim(item->>'name')) NOT BETWEEN 1 AND 100
   OR jsonb_typeof(item->'cardNumber')<>'string' OR length(item->>'cardNumber')>100
   OR jsonb_typeof(item->'grade')<>'string' OR length(item->>'grade')>60
   OR jsonb_typeof(item->'condition')<>'string' OR length(item->>'condition')>300
   OR jsonb_typeof(item->'quantity')<>'number' OR (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric)
   OR (item->>'quantity')::integer NOT BETWEEN 1 AND 100 THEN RETURN false; END IF;
  total:=total+(item->>'quantity')::integer;
  IF item->>'source'='snkrdunk' THEN
   IF jsonb_typeof(item->'productId')<>'string' OR item->>'productId'!~'^[1-9][0-9]{0,8}$' OR item->'cardUid'<>'null'::jsonb THEN RETURN false; END IF;
  ELSIF item->>'source'='catalog' THEN
   IF jsonb_typeof(item->'cardUid')<>'string' OR (item->>'cardUid')::uuid IS NULL OR item->'productId'<>'null'::jsonb THEN RETURN false; END IF;
  ELSIF item->>'source'='manual' THEN
   IF item->'cardUid'<>'null'::jsonb OR item->'productId'<>'null'::jsonb THEN RETURN false; END IF;
  ELSE RETURN false; END IF;
 END LOOP;
 RETURN total<=100;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE FUNCTION public.lending_collateral_inspected(items jsonb,inspection jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE item jsonb; checked jsonb;
BEGIN
 IF jsonb_array_length(items)=0 THEN RETURN true; END IF;
 IF jsonb_typeof(inspection)<>'array' OR jsonb_array_length(items)<>jsonb_array_length(inspection) THEN RETURN false; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
  IF (SELECT count(*) FROM jsonb_array_elements(inspection) e WHERE e->>'id'=item->>'id')<>1 THEN RETURN false; END IF;
  SELECT e INTO checked FROM jsonb_array_elements(inspection) e WHERE e->>'id'=item->>'id';
  IF checked->'quantity' IS DISTINCT FROM item->'quantity' OR checked->'checked' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(checked->'location')<>'string' OR coalesce(length(trim(checked->>'location')),0) NOT BETWEEN 1 AND 120 THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
ALTER TABLE public.lending_support_cases ADD COLUMN collateral_items jsonb NOT NULL DEFAULT '[]' CHECK(public.lending_collateral_valid(collateral_items));
ALTER TABLE public.lending_quotes ADD COLUMN collateral_items jsonb NOT NULL DEFAULT '[]' CHECK(public.lending_collateral_valid(collateral_items));
ALTER TABLE public.lending_loans ADD COLUMN collateral_items jsonb NOT NULL DEFAULT '[]' CHECK(public.lending_collateral_valid(collateral_items));
ALTER TABLE public.lending_loans ADD COLUMN collateral_inspection jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.lending_loans ADD CONSTRAINT lending_bundle_inspection CHECK(inspected_at IS NULL OR public.lending_collateral_inspected(collateral_items,collateral_inspection));
ALTER TABLE public.lending_loans ADD CONSTRAINT lending_bundle_terms CHECK(jsonb_array_length(collateral_items)=0 OR terms IS NULL OR terms->'collateralItems' IS NOT DISTINCT FROM collateral_items);
CREATE FUNCTION public.lending_collateral_snapshot() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.collateral_items IS DISTINCT FROM OLD.collateral_items THEN RAISE EXCEPTION 'collateral_immutable'; END IF;
 ELSIF TG_TABLE_NAME='lending_quotes' THEN
  IF NEW.source='support' THEN
   SELECT collateral_items INTO STRICT NEW.collateral_items FROM public.lending_support_cases WHERE id=NEW.support_case_id AND user_id=NEW.user_id;
  END IF;
 ELSIF TG_TABLE_NAME='lending_loans' THEN
  SELECT collateral_items INTO STRICT NEW.collateral_items FROM public.lending_quotes WHERE id=NEW.quote_id AND user_id=NEW.user_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lending_case_items_immutable BEFORE UPDATE ON public.lending_support_cases FOR EACH ROW EXECUTE FUNCTION public.lending_collateral_snapshot();
CREATE TRIGGER lending_quote_items_snapshot BEFORE INSERT ON public.lending_quotes FOR EACH ROW EXECUTE FUNCTION public.lending_collateral_snapshot();
CREATE TRIGGER lending_loan_items_snapshot BEFORE INSERT OR UPDATE ON public.lending_loans FOR EACH ROW EXECUTE FUNCTION public.lending_collateral_snapshot();

CREATE OR REPLACE FUNCTION public.lending_support_create(p_actor uuid,p_input jsonb,p_key uuid) RETURNS jsonb
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
 IF p_input ? 'items' THEN
  IF NOT public.lending_collateral_valid(p_input->'items') OR jsonb_array_length(p_input->'items')=0 THEN RAISE EXCEPTION 'collateral_invalid'; END IF;
  p_input:=p_input||jsonb_build_object('cardName',left(p_input->'items'->0->>'name',60)||CASE WHEN jsonb_array_length(p_input->'items')>1 THEN ' ほか'||(jsonb_array_length(p_input->'items')-1)||'種類' ELSE '' END||' / 合計'||(SELECT sum((e->>'quantity')::integer) FROM jsonb_array_elements(p_input->'items') e)||'枚','cardNumber','','condition','カード別の状態は明細を参照');
 END IF;
 INSERT INTO public.lending_support_cases(user_id,created_by,source,reason,card_name,card_number,condition,notes,requested_jpy,contact_label,collateral_items)
 VALUES(owner_id,p_actor,CASE WHEN admin THEN 'admin' ELSE 'app' END,p_input->>'reason',trim(p_input->>'cardName'),
 coalesce(p_input->>'cardNumber',''),coalesce(p_input->>'condition',''),coalesce(p_input->>'notes',''),nullif(p_input->>'requestedAmount','')::bigint,coalesce(p_input->>'contactLabel',''),coalesce(p_input->'items','[]'::jsonb)) RETURNING * INTO c;
 INSERT INTO public.lending_support_events(case_id,actor_id,action,to_status,version) VALUES(c.id,p_actor,'create',c.status,c.version);
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
  IF NOT public.lending_collateral_inspected(l.collateral_items,coalesce(p_payload->'collateralInspection','[]'::jsonb)) THEN RAISE EXCEPTION 'collateral_inspection_required'; END IF;
  l.collateral_inspection:=coalesce(p_payload->'collateralInspection','[]'::jsonb);
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
  l.terms:=jsonb_build_object('version',l.version+1,'principalJpy',amount,'monthlyRateBps',l.monthly_rate_bps,'termMonths',3,'feesJpy',0,'earlyRepayment','calendar_month_ceil_min_one_max_three','productId',q.product_id,'certNumber',l.cert_number,'assessmentQuoteId',q.id,'documentVersion',CASE WHEN jsonb_array_length(l.collateral_items)>0 THEN 'local-draft-bundle-v1' ELSE 'local-draft-v1' END,'collateralItems',l.collateral_items);
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
  IF jsonb_array_length(l.collateral_items)>0 AND p_payload->'allItemsReturned' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'all_items_return_required'; END IF;
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
 UPDATE public.lending_loans SET collateral_inspection=l.collateral_inspection,status=l.status,version=l.version,storage_location=l.storage_location,inspected_by=l.inspected_by,
 inspected_at=l.inspected_at,offered_jpy=l.offered_jpy,monthly_rate_bps=l.monthly_rate_bps,terms=l.terms,
 terms_accepted_at=l.terms_accepted_at,offer_expires_at=l.offer_expires_at,principal_jpy=l.principal_jpy,
 funded_at=l.funded_at,interest_start_at=l.interest_start_at,due_at=l.due_at,updated_at=l.updated_at WHERE id=l.id;
 INSERT INTO public.lending_events(loan_id,actor_id,action,from_status,to_status,version,details)
 VALUES(l.id,p_actor,p_action,old_status,l.status,l.version,
 p_payload||CASE WHEN p_action IN ('offer','accept') THEN jsonb_build_object('termsSnapshot',l.terms) ELSE '{}'::jsonb END);
 INSERT INTO public.lending_command_receipts(key,actor_id,fingerprint,result) VALUES(p_key,p_actor,fp,to_jsonb(l));
 RETURN to_jsonb(l);
END $$;
REVOKE ALL ON FUNCTION public.lending_collateral_valid(jsonb),public.lending_collateral_inspected(jsonb,jsonb),public.lending_collateral_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_collateral_valid(jsonb),public.lending_collateral_inspected(jsonb,jsonb),public.lending_collateral_snapshot() TO service_role;
CREATE OR REPLACE FUNCTION public.lending_list(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object(
 'outstandingJpy',coalesce((SELECT sum(principal_jpy) FROM public.lending_loans WHERE user_id=p_actor OR public.lending_is_admin(p_actor)),0),
 'loanCount',(SELECT count(*) FROM public.lending_loans WHERE user_id=p_actor OR public.lending_is_admin(p_actor)),
 'identityVerified',EXISTS(SELECT 1 FROM public.lending_identity_checks WHERE user_id=p_actor AND expires_at>now()),
 'cards',coalesce((SELECT jsonb_agg(jsonb_build_object('public_uid',c.public_uid,'name',c.name,'card_number',c.card_number,'productId',m.product_id))
 FROM public.cards c JOIN public.lending_product_mappings m ON m.card_uid=c.public_uid AND m.active WHERE c.grade='PSA10'),'[]'::jsonb),
 'loans',coalesce((SELECT jsonb_agg(item ORDER BY created_at DESC) FROM (
 SELECT l.created_at,(to_jsonb(l)-'storage_location'-'inspected_by'-'collateral_inspection') || jsonb_build_object(
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
NOTIFY pgrst,'reload schema';
COMMIT;
