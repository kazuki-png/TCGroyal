-- Preview-only rollout. Existing evidence and completed payments remain unchanged.
BEGIN;
ALTER TABLE public.lending_loans ADD COLUMN interest_paid_months integer NOT NULL DEFAULT 0 CHECK(interest_paid_months>=0),
 ADD COLUMN term_months_total integer NOT NULL DEFAULT 3 CHECK(term_months_total>=3), ADD COLUMN bank_payment_report jsonb;
ALTER TABLE public.lending_ledger ADD COLUMN received_at timestamptz;
-- Preserve the already settled periods of legacy three-month extensions.
UPDATE public.lending_loans SET interest_paid_months=greatest(0,(extract(year FROM age(interest_start_at AT TIME ZONE 'Asia/Tokyo',funded_at AT TIME ZONE 'Asia/Tokyo'))*12+extract(month FROM age(interest_start_at AT TIME ZONE 'Asia/Tokyo',funded_at AT TIME ZONE 'Asia/Tokyo')))::integer),
 term_months_total=greatest(3,(extract(year FROM age(due_at AT TIME ZONE 'Asia/Tokyo',funded_at AT TIME ZONE 'Asia/Tokyo'))*12+extract(month FROM age(due_at AT TIME ZONE 'Asia/Tokyo',funded_at AT TIME ZONE 'Asia/Tokyo')))::integer)
 WHERE funded_at IS NOT NULL AND interest_start_at IS NOT NULL AND due_at IS NOT NULL;
CREATE FUNCTION public.lending_bank_deadline(p_due timestamptz) RETURNS timestamptz
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT (((p_due AT TIME ZONE 'Asia/Tokyo')::date+1)::timestamp AT TIME ZONE 'Asia/Tokyo')-interval '1 microsecond'
$$;
CREATE FUNCTION public.lending_month_deadline(p_start timestamptz,p_months integer) RETURNS timestamptz
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT public.lending_bank_deadline(((p_start AT TIME ZONE 'Asia/Tokyo')+make_interval(months=>p_months)) AT TIME ZONE 'Asia/Tokyo')
$$;
CREATE FUNCTION public.lending_charge_months(p_start timestamptz,p_at timestamptz) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE start_day date:=(p_start AT TIME ZONE 'Asia/Tokyo')::date; at_day date:=(p_at AT TIME ZONE 'Asia/Tokyo')::date; m integer;
BEGIN
 IF p_start IS NULL OR p_at IS NULL OR p_at<p_start THEN RETURN 0; END IF;
 m:=(extract(year FROM at_day)::integer-extract(year FROM start_day)::integer)*12+extract(month FROM at_day)::integer-extract(month FROM start_day)::integer;
 IF (start_day+make_interval(months=>m))::date<at_day THEN m:=m+1; END IF;
 RETURN greatest(1,m);
END $$;
CREATE FUNCTION public.lending_unpaid_months(p_loan public.lending_loans,p_at timestamptz) RETURNS integer
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT greatest(0,least(p_loan.term_months_total,public.lending_charge_months(p_loan.funded_at,p_at))-p_loan.interest_paid_months)
$$;
CREATE FUNCTION public.lending_unpaid_charge(p_loan public.lending_loans,p_at timestamptz) RETURNS bigint
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT ceil(p_loan.principal_jpy::numeric*p_loan.monthly_rate_bps*public.lending_unpaid_months(p_loan,p_at)/10000)::bigint
$$;
CREATE FUNCTION public.lending_payment_snapshot(p_actor uuid,p_loan uuid,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE l public.lending_loans; basis timestamptz; charge bigint; months_due integer; deadline timestamptz;
BEGIN
 SELECT * INTO l FROM public.lending_loans WHERE id=p_loan AND (user_id=p_actor OR public.lending_is_admin(p_actor));
 IF NOT FOUND OR l.status NOT IN ('active','repayment_pending') THEN RAISE EXCEPTION 'repayment_not_found'; END IF;
 deadline:=public.lending_bank_deadline(l.due_at);
 IF p_date IS NULL OR p_date<(l.funded_at AT TIME ZONE 'Asia/Tokyo')::date OR p_date>(l.due_at AT TIME ZONE 'Asia/Tokyo')::date THEN RAISE EXCEPTION 'repayment_date_outside_term'; END IF;
 basis:=public.lending_bank_deadline(p_date::timestamp AT TIME ZONE 'Asia/Tokyo');
 charge:=public.lending_unpaid_charge(l,basis);months_due:=public.lending_unpaid_months(l,basis);
 RETURN jsonb_build_object('principalJpy',l.principal_jpy,'interestJpy',charge,'totalJpy',l.principal_jpy+charge,'chargeLabel',CASE WHEN p_date<(l.due_at AT TIME ZONE 'Asia/Tokyo')::date THEN '期限前返済手数料' ELSE '質料' END,'basisAt',basis,'calculatedAt',now(),'version',l.version,
 'extensionAmountJpy',charge,'extensionMonths',1,'unpaidMonths',months_due,'dueAt',deadline,'newDueAt',public.lending_month_deadline(l.funded_at,l.term_months_total+1),
 'extensionAvailable',l.status='active' AND now()<=deadline AND months_due>0 AND NOT EXISTS(SELECT 1 FROM public.lending_requests WHERE loan_id=l.id AND status='pending'));
END $$;
CREATE OR REPLACE FUNCTION public.lending_command(p_actor uuid,p_loan uuid,p_action text,p_payload jsonb,p_key uuid,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE l public.lending_loans; q public.lending_quotes; r public.lending_command_receipts; req public.lending_requests;
 paid_at timestamptz; claimed_date date; months_due integer; paid_months integer; settlement_at timestamptz;
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
  l.terms:=jsonb_build_object('version',l.version+1,'principalJpy',amount,'monthlyRateBps',l.monthly_rate_bps,'termMonths',3,'feesJpy',0,'earlyRepayment','monthly_early_repayment_fee','extensionMonths',1,'paymentMethod','bank_transfer','productId',q.product_id,'certNumber',l.cert_number,'assessmentQuoteId',q.id,'documentVersion',CASE WHEN jsonb_array_length(l.collateral_items)>0 THEN 'local-draft-bundle-v1' ELSE 'local-draft-v1' END,'collateralItems',l.collateral_items);
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
  l.interest_paid_months:=0; l.term_months_total:=3;
  l.due_at:=public.lending_month_deadline(l.funded_at,3); l.status:='active';
 ELSIF p_action='report_repayment' AND l.status='active' THEN
  IF EXISTS(SELECT 1 FROM public.lending_requests WHERE loan_id=l.id AND status='pending') THEN RAISE EXCEPTION 'unresolved_request'; END IF;
  IF coalesce(length(trim(p_payload->>'transferName')),0) NOT BETWEEN 1 AND 100 OR p_payload->>'transferDate' IS NULL THEN RAISE EXCEPTION 'bank_report_required'; END IF;
  claimed_date:=(p_payload->>'transferDate')::date;
  IF claimed_date<(l.funded_at AT TIME ZONE 'Asia/Tokyo')::date OR claimed_date>(now() AT TIME ZONE 'Asia/Tokyo')::date THEN RAISE EXCEPTION 'payment_date_invalid'; END IF;
  l.bank_payment_report:=jsonb_build_object('transferName',trim(p_payload->>'transferName'),'transferDate',claimed_date,'reportedAt',now());
  l.status:='repayment_pending';
 ELSIF p_action='reject_repayment' AND l.status='repayment_pending' THEN
  IF coalesce(length(trim(p_payload->>'reason')),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'reason_required'; END IF;
  l.status:='active'; l.bank_payment_report:=NULL;
 ELSIF p_action='confirm_repayment' AND l.status IN ('active','repayment_pending') THEN
  IF p_payload->>'paidAt' IS NULL THEN RAISE EXCEPTION 'paid_at_required'; END IF;
  paid_at:=(p_payload->>'paidAt')::timestamptz;
  IF paid_at<l.funded_at OR paid_at>now() THEN RAISE EXCEPTION 'payment_date_invalid'; END IF;
  IF l.bank_payment_report IS NOT NULL AND paid_at> (l.bank_payment_report->>'reportedAt')::timestamptz THEN RAISE EXCEPTION 'payment_after_report'; END IF;
  interest:=public.lending_unpaid_charge(l,paid_at);
  amount:=(p_payload->>'amountJpy')::bigint;
  IF amount IS DISTINCT FROM l.principal_jpy+interest THEN RAISE EXCEPTION 'repayment_amount_mismatch'; END IF;
  INSERT INTO public.lending_ledger(loan_id,kind,amount_jpy,external_reference,recorded_by,received_at)
  VALUES(l.id,'repayment',amount,trim(p_payload->>'reference'),p_actor,paid_at);
  l.principal_jpy:=0; l.status:='return_pending';
  UPDATE public.lending_requests SET status='rejected' WHERE loan_id=l.id AND status='pending';
 ELSIF p_action='return' AND l.status='return_pending' THEN
  IF jsonb_array_length(l.collateral_items)>0 AND p_payload->'allItemsReturned' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'all_items_return_required'; END IF;
  IF coalesce(length(trim(p_payload->>'reference')),0) NOT BETWEEN 4 AND 120 THEN RAISE EXCEPTION 'return_reference_required'; END IF;
  l.status:='returned';
 ELSIF p_action='reject' AND l.status IN ('submitted','received','offered','accepted') THEN
  IF coalesce(length(trim(p_payload->>'reason')),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'reason_required'; END IF;
  l.status:=CASE WHEN l.inspected_at IS NULL THEN 'rejected' ELSE 'return_pending' END;
 ELSIF p_action IN ('request_extension','request_additional') AND l.status='active' AND now()<=public.lending_bank_deadline(l.due_at) THEN
  IF p_payload->>'termsAccepted' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'consent_required'; END IF;
  IF EXISTS(SELECT 1 FROM public.lending_requests WHERE loan_id=l.id AND status='pending') THEN RAISE EXCEPTION 'unresolved_request'; END IF;
  IF p_action='request_extension' THEN
   IF coalesce(length(trim(p_payload->>'transferName')),0) NOT BETWEEN 1 AND 100 OR p_payload->>'transferDate' IS NULL THEN RAISE EXCEPTION 'bank_report_required'; END IF;
   claimed_date:=(p_payload->>'transferDate')::date;
   IF claimed_date<(l.funded_at AT TIME ZONE 'Asia/Tokyo')::date OR claimed_date>(now() AT TIME ZONE 'Asia/Tokyo')::date OR claimed_date>(l.due_at AT TIME ZONE 'Asia/Tokyo')::date THEN RAISE EXCEPTION 'payment_date_invalid'; END IF;
   settlement_at:=public.lending_bank_deadline(claimed_date::timestamp AT TIME ZONE 'Asia/Tokyo');
   months_due:=public.lending_unpaid_months(l,settlement_at);
   IF months_due<=0 THEN RAISE EXCEPTION 'no_unpaid_period'; END IF;
   amount:=public.lending_unpaid_charge(l,settlement_at);
  ELSE amount:=(p_payload->>'amountJpy')::bigint; END IF;
  IF amount IS NULL OR (p_action='request_additional' AND (amount<10000 OR amount%10000<>0 OR amount>10000000-l.principal_jpy)) THEN RAISE EXCEPTION 'amount_invalid'; END IF;
  INSERT INTO public.lending_requests(loan_id,kind,amount_jpy,consent_terms)
  VALUES(l.id,CASE WHEN p_action='request_extension' THEN 'extension' ELSE 'additional' END,amount,
  CASE WHEN p_action='request_extension' THEN
   jsonb_build_object('ruleVersion','bank-monthly-v1','loanVersion',l.version,'principalJpy',l.principal_jpy,'monthlyRateBps',l.monthly_rate_bps,'interestJpy',amount,'unpaidMonths',months_due,'oldDueAt',l.due_at,'newDueAt',public.lending_month_deadline(l.funded_at,l.term_months_total+1),'transferName',trim(p_payload->>'transferName'),'transferDate',claimed_date,'reportedAt',now())
  ELSE jsonb_build_object('loanVersion',l.version,'requestedAdditionalJpy',amount,'requiresNewAssessment',true,'requiresNewAgreement',true) END);
 ELSIF p_action IN ('extend','reject_request') AND l.status='active' THEN
  SELECT * INTO req FROM public.lending_requests WHERE loan_id=l.id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_missing'; END IF;
  IF p_action='reject_request' THEN
   UPDATE public.lending_requests SET status='rejected' WHERE id=req.id;
  ELSE
   IF req.kind<>'extension' OR req.consent_terms->>'ruleVersion' IS DISTINCT FROM 'bank-monthly-v1' THEN RAISE EXCEPTION 'extension_terms_changed'; END IF;
   IF req.created_at>public.lending_bank_deadline(l.due_at) OR (req.consent_terms->>'oldDueAt')::timestamptz IS DISTINCT FROM l.due_at THEN RAISE EXCEPTION 'extension_unavailable'; END IF;
   IF p_payload->>'paidAt' IS NULL THEN RAISE EXCEPTION 'paid_at_required'; END IF;
   paid_at:=(p_payload->>'paidAt')::timestamptz;
   IF paid_at<l.funded_at OR paid_at>now() OR paid_at>req.created_at OR paid_at>public.lending_bank_deadline(l.due_at) THEN RAISE EXCEPTION 'payment_date_invalid'; END IF;
   months_due:=public.lending_unpaid_months(l,paid_at);
   amount:=(p_payload->>'amountJpy')::bigint;
   IF months_due<=0 OR amount IS DISTINCT FROM req.amount_jpy OR amount IS DISTINCT FROM public.lending_unpaid_charge(l,paid_at) THEN RAISE EXCEPTION 'extension_amount_mismatch'; END IF;
   IF amount>0 THEN INSERT INTO public.lending_ledger(loan_id,kind,amount_jpy,external_reference,recorded_by,received_at) VALUES(l.id,'extension_interest',amount,trim(p_payload->>'reference'),p_actor,paid_at);
   ELSIF coalesce(length(trim(p_payload->>'reference')),0) NOT BETWEEN 4 AND 120 THEN RAISE EXCEPTION 'reference_required'; END IF;
   l.interest_paid_months:=l.interest_paid_months+months_due;
   l.interest_start_at:=((l.funded_at AT TIME ZONE 'Asia/Tokyo')+make_interval(months=>l.interest_paid_months)) AT TIME ZONE 'Asia/Tokyo';
   l.term_months_total:=l.term_months_total+1;
   l.due_at:=public.lending_month_deadline(l.funded_at,l.term_months_total);
   UPDATE public.lending_requests SET status='completed' WHERE id=req.id;
  END IF;
 ELSIF p_action='forfeit' AND l.status='active' AND now()>public.lending_bank_deadline(l.due_at) THEN
  IF p_payload->>'reviewed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'review_required'; END IF;
  IF EXISTS(SELECT 1 FROM public.lending_requests WHERE loan_id=l.id AND status='pending') THEN RAISE EXCEPTION 'unresolved_request'; END IF;
  INSERT INTO public.lending_ledger(loan_id,kind,amount_jpy,external_reference,recorded_by)
  VALUES(l.id,'forfeiture',l.principal_jpy,'forfeit:'||l.id::text,p_actor);
  l.principal_jpy:=0; l.status:='forfeited';
  UPDATE public.lending_requests SET status='rejected' WHERE loan_id=l.id AND status='pending';
 ELSE RAISE EXCEPTION 'invalid_transition'; END IF;
 l.version:=l.version+1; l.updated_at:=now();
 UPDATE public.lending_loans SET interest_paid_months=l.interest_paid_months,term_months_total=l.term_months_total,bank_payment_report=l.bank_payment_report,collateral_inspection=l.collateral_inspection,status=l.status,version=l.version,storage_location=l.storage_location,inspected_by=l.inspected_by,
 inspected_at=l.inspected_at,offered_jpy=l.offered_jpy,monthly_rate_bps=l.monthly_rate_bps,terms=l.terms,
 terms_accepted_at=l.terms_accepted_at,offer_expires_at=l.offer_expires_at,principal_jpy=l.principal_jpy,
 funded_at=l.funded_at,interest_start_at=l.interest_start_at,due_at=l.due_at,updated_at=l.updated_at WHERE id=l.id;
 INSERT INTO public.lending_events(loan_id,actor_id,action,from_status,to_status,version,details)
 VALUES(l.id,p_actor,p_action,old_status,l.status,l.version,
 p_payload||CASE WHEN p_action IN ('offer','accept') THEN jsonb_build_object('termsSnapshot',l.terms) ELSE '{}'::jsonb END);
 INSERT INTO public.lending_command_receipts(key,actor_id,fingerprint,result) VALUES(p_key,p_actor,fp,to_jsonb(l));
 RETURN to_jsonb(l);
END $$;
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
 'due_at',public.lending_bank_deadline(l.due_at),'payoff_jpy',CASE WHEN l.status IN ('active','repayment_pending') THEN l.principal_jpy+public.lending_unpaid_charge(l,now()) ELSE 0 END,
 'ledger',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'amount_jpy',e.amount_jpy,'created_at',e.created_at) ORDER BY e.created_at) FROM public.lending_ledger e WHERE e.loan_id=l.id),'[]'::jsonb),
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('action',e.action,'to_status',e.to_status,'version',e.version,'created_at',e.created_at,'reason',e.details->>'reason') ORDER BY e.version) FROM public.lending_events e WHERE e.loan_id=l.id),'[]'::jsonb),
 'requests',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM public.lending_requests r WHERE r.loan_id=l.id),'[]'::jsonb)
 ) AS item FROM public.lending_loans l JOIN public.lending_quotes q ON q.id=l.quote_id
 WHERE l.user_id=p_actor OR public.lending_is_admin(p_actor) ORDER BY l.created_at DESC LIMIT 50
 ) items),'[]'::jsonb))
$$;
CREATE OR REPLACE FUNCTION public.lending_admin_detail(p_actor uuid,p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE l public.lending_loans; q public.lending_quotes; c public.lending_support_cases; owner_id uuid; item jsonb; customer jsonb;
BEGIN
 IF NOT public.lending_is_admin(p_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_kind='case' THEN
  SELECT * INTO c FROM public.lending_support_cases WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  owner_id:=c.user_id;
  SELECT to_jsonb(c)-'created_by'||jsonb_build_object('events',coalesce((SELECT jsonb_agg(to_jsonb(e)-'actor_id' ORDER BY e.version) FROM public.lending_support_events e WHERE e.case_id=c.id),'[]'::jsonb)) INTO item;
 ELSIF p_kind='loan' THEN
  SELECT * INTO l FROM public.lending_loans WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO q FROM public.lending_quotes WHERE id=l.quote_id;
  owner_id:=l.user_id;
  item:=(to_jsonb(l)-'inspected_by')||jsonb_build_object('card_name',q.card_name,'card_number',q.card_number,'evaluated_at',now(),
   'valuation_source',q.source,
   'payoff_jpy',CASE WHEN l.status IN ('active','repayment_pending') THEN l.principal_jpy+public.lending_unpaid_charge(l,now()) ELSE 0 END,
   'ledger',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'amount_jpy',e.amount_jpy,'created_at',e.created_at) ORDER BY e.created_at) FROM public.lending_ledger e WHERE e.loan_id=l.id),'[]'::jsonb),
   'events',coalesce((SELECT jsonb_agg(jsonb_build_object('action',e.action,'to_status',e.to_status,'version',e.version,'created_at',e.created_at,'reason',e.details->>'reason') ORDER BY e.version) FROM public.lending_events e WHERE e.loan_id=l.id),'[]'::jsonb),
   'requests',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM public.lending_requests r WHERE r.loan_id=l.id),'[]'::jsonb),
   'support_case', (SELECT jsonb_build_object('id',s.id,'reference',s.reference,'condition',s.condition,'notes',s.notes,'selected_card',s.selected_card,'declared_grade',s.declared_grade,'declared_cert_number',s.declared_cert_number) FROM public.lending_support_cases s WHERE s.loan_id=l.id));
 ELSE RAISE EXCEPTION 'not_found'; END IF;
 SELECT jsonb_build_object('id',p.id,'name',trim(p.last_name||' '||p.first_name),'phone',p.phone,
  'identityVerified',EXISTS(SELECT 1 FROM public.lending_identity_checks i WHERE i.user_id=p.id AND i.expires_at>now())) INTO customer FROM public.profiles p WHERE p.id=owner_id;
 RETURN jsonb_build_object('kind',p_kind,'item',item,'customer',customer);
END $$;
REVOKE ALL ON FUNCTION public.lending_bank_deadline(timestamptz),public.lending_month_deadline(timestamptz,integer),public.lending_charge_months(timestamptz,timestamptz),public.lending_unpaid_months(public.lending_loans,timestamptz),public.lending_unpaid_charge(public.lending_loans,timestamptz),public.lending_payment_snapshot(uuid,uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_bank_deadline(timestamptz),public.lending_month_deadline(timestamptz,integer),public.lending_charge_months(timestamptz,timestamptz),public.lending_unpaid_months(public.lending_loans,timestamptz),public.lending_unpaid_charge(public.lending_loans,timestamptz),public.lending_payment_snapshot(uuid,uuid,date) TO service_role;
CREATE OR REPLACE FUNCTION public.lending_account_summary(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('outstandingJpy',coalesce(sum(l.principal_jpy),0),'payoffJpy',coalesce(sum(l.principal_jpy+public.lending_unpaid_charge(l,now())),0),
 'nextDueAt',min(public.lending_bank_deadline(l.due_at)),'activeCount',count(*)) FROM public.lending_loans l WHERE user_id=p_actor AND status IN ('active','repayment_pending')
$$;

CREATE TABLE public.lending_due_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),loan_id uuid NOT NULL REFERENCES public.lending_loans(id),user_id uuid NOT NULL REFERENCES auth.users(id),due_at timestamptz NOT NULL,
 days_before integer NOT NULL CHECK(days_before IN (1,3)),channel text NOT NULL CHECK(channel IN ('email','push')),target_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0,lease_id uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),provider_id text,error_code text,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(loan_id,due_at,days_before,channel,target_id)
);
ALTER TABLE public.lending_due_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lending_due_reminders FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.lending_due_reminders TO service_role;
CREATE INDEX lending_due_reminders_pending ON public.lending_due_reminders(status,next_attempt_at);
CREATE FUNCTION public.lending_prepare_due_reminders() RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
 IF extract(hour FROM now() AT TIME ZONE 'Asia/Tokyo')<9 THEN RETURN 0; END IF;
 WITH eligible AS (
 SELECT id,user_id,public.lending_bank_deadline(due_at) AS due_at,((due_at AT TIME ZONE 'Asia/Tokyo')::date-(now() AT TIME ZONE 'Asia/Tokyo')::date)::integer AS days_before
 FROM public.lending_loans WHERE status IN ('active','repayment_pending') AND (due_at AT TIME ZONE 'Asia/Tokyo')::date-(now() AT TIME ZONE 'Asia/Tokyo')::date IN (1,3)
 ), targets AS (
 SELECT id AS loan_id,user_id,due_at,days_before,'email' AS channel,user_id AS target_id FROM eligible
 UNION ALL
 SELECT e.id,e.user_id,e.due_at,e.days_before,'push',d.id FROM eligible e JOIN public.lending_push_devices d ON d.user_id=e.user_id AND d.platform='android' AND d.token NOT LIKE 'disabled:%'
 ) INSERT INTO public.lending_due_reminders(loan_id,user_id,due_at,days_before,channel,target_id) SELECT * FROM targets ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END $$;
CREATE FUNCTION public.lending_claim_due_reminders(p_limit integer,p_email boolean,p_push boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 8 THEN RAISE EXCEPTION 'invalid_limit'; END IF;
 UPDATE public.lending_due_reminders j SET status='cancelled',lease_id=NULL,lease_until=NULL WHERE status IN ('pending','sending') AND NOT EXISTS(SELECT 1 FROM public.lending_loans l WHERE l.id=j.loan_id AND l.status IN ('active','repayment_pending') AND public.lending_bank_deadline(l.due_at)=j.due_at AND now()<=j.due_at);
 WITH candidates AS (
 SELECT id FROM public.lending_due_reminders WHERE attempts<5 AND ((channel='email' AND p_email) OR (channel='push' AND p_push)) AND ((status='pending' AND next_attempt_at<=now()) OR (status='sending' AND lease_until<now())) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT p_limit
 ), claimed AS (
 UPDATE public.lending_due_reminders j SET status='sending',attempts=j.attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes' FROM candidates c WHERE j.id=c.id RETURNING j.*
 ) SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) INTO result FROM claimed c;
 RETURN result;
END $$;
CREATE FUNCTION public.lending_finish_due_reminder(p_job uuid,p_lease uuid,p_provider text,p_error text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.lending_due_reminders SET status=CASE WHEN p_error='recipient_unavailable' THEN 'cancelled' WHEN p_error IS NULL AND p_provider IS NOT NULL THEN 'sent' WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
 provider_id=left(p_provider,500),error_code=left(p_error,80),lease_id=NULL,lease_until=NULL,next_attempt_at=now()+interval '1 hour' WHERE id=p_job AND status='sending' AND lease_id=p_lease;
END $$;
REVOKE ALL ON FUNCTION public.lending_prepare_due_reminders(),public.lending_claim_due_reminders(integer,boolean,boolean),public.lending_finish_due_reminder(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_prepare_due_reminders(),public.lending_claim_due_reminders(integer,boolean,boolean),public.lending_finish_due_reminder(uuid,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.lending_enqueue_status_push() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE event_id uuid; kind text:=CASE WHEN TG_TABLE_NAME='lending_loans' THEN 'loan' ELSE 'case' END;
BEGIN
 IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
  IF kind<>'loan' THEN RETURN NEW; END IF;
  IF NEW.due_at IS NOT DISTINCT FROM OLD.due_at THEN RETURN NEW; END IF;
 END IF;
 -- The newly created loan supplies the single application notification.
 IF kind='case' AND NEW.status='applied' THEN RETURN NEW; END IF;
 INSERT INTO public.lending_status_notifications(user_id,entity_kind,entity_id,entity_version,from_status,to_status)
 VALUES(NEW.user_id,kind,NEW.id,NEW.version,CASE WHEN TG_OP='UPDATE' THEN OLD.status ELSE NULL END,NEW.status)
 ON CONFLICT(entity_kind,entity_id,entity_version) DO NOTHING RETURNING id INTO event_id;
 IF event_id IS NOT NULL THEN
  INSERT INTO public.lending_push_deliveries(notification_id,device_id)
  SELECT event_id,id FROM public.lending_push_devices WHERE user_id=NEW.user_id AND token NOT LIKE 'disabled:%' AND platform='android'
  ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
