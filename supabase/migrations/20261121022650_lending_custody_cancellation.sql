-- Record custody independently from inspection; do not rewrite existing loans.
BEGIN;
ALTER TABLE public.lending_loans ADD COLUMN received_at timestamptz;
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
  IF length(coalesce(p_payload->>'reason',''))>500 THEN RAISE EXCEPTION 'reason_too_long'; END IF;
  p_payload:=p_payload||jsonb_build_object('reason',coalesce(nullif(trim(p_payload->>'reason'),''),'利用者による申込キャンセル'));
  l.status:=CASE WHEN l.received_at IS NOT NULL OR l.inspected_at IS NOT NULL OR l.status IN ('received','offered','accepted') THEN 'return_pending' ELSE 'cancelled' END;
  l.terms_accepted_at:=NULL; l.offer_expires_at:=NULL;
 ELSIF p_action='arrive' AND l.status='submitted' THEN
  IF coalesce(length(trim(p_payload->>'location')),0) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'receipt_location_required'; END IF;
  l.received_at:=now(); l.storage_location:=trim(p_payload->>'location'); l.status:='received';
 ELSIF p_action='receive' AND (l.status='submitted' OR (l.status='received' AND l.inspected_at IS NULL)) THEN
  IF coalesce(length(trim(p_payload->>'location')),0) NOT BETWEEN 1 AND 120 OR p_payload->>'certNumber' IS DISTINCT FROM l.cert_number
  OR p_payload->>'inspected' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'inspection_required'; END IF;
  IF NOT public.lending_collateral_inspected(l.collateral_items,coalesce(p_payload->'collateralInspection','[]'::jsonb)) THEN RAISE EXCEPTION 'collateral_inspection_required'; END IF;
  l.collateral_inspection:=coalesce(p_payload->'collateralInspection','[]'::jsonb);
  l.received_at:=coalesce(l.received_at,now()); l.storage_location:=trim(p_payload->>'location'); l.inspected_at:=now(); l.inspected_by:=p_actor; l.status:='received';
 ELSIF p_action='offer' AND l.status IN ('received','offered','accepted') THEN
  IF l.inspected_at IS NULL THEN RAISE EXCEPTION 'inspection_required'; END IF;
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
  IF l.inspected_at IS NULL OR l.terms_accepted_at IS NULL THEN RAISE EXCEPTION 'inspection_or_consent_required'; END IF;
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
  l.status:=CASE WHEN l.received_at IS NOT NULL OR l.inspected_at IS NOT NULL OR l.status IN ('received','offered','accepted') THEN 'return_pending' ELSE 'rejected' END;
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
 UPDATE public.lending_loans SET received_at=l.received_at,interest_paid_months=l.interest_paid_months,term_months_total=l.term_months_total,bank_payment_report=l.bank_payment_report,collateral_inspection=l.collateral_inspection,status=l.status,version=l.version,storage_location=l.storage_location,inspected_by=l.inspected_by,
 inspected_at=l.inspected_at,offered_jpy=l.offered_jpy,monthly_rate_bps=l.monthly_rate_bps,terms=l.terms,
 terms_accepted_at=l.terms_accepted_at,offer_expires_at=l.offer_expires_at,principal_jpy=l.principal_jpy,
 funded_at=l.funded_at,interest_start_at=l.interest_start_at,due_at=l.due_at,updated_at=l.updated_at WHERE id=l.id;
 INSERT INTO public.lending_events(loan_id,actor_id,action,from_status,to_status,version,details)
 VALUES(l.id,p_actor,p_action,old_status,l.status,l.version,
 p_payload||CASE WHEN p_action IN ('offer','accept') THEN jsonb_build_object('termsSnapshot',l.terms) ELSE '{}'::jsonb END);
 INSERT INTO public.lending_command_receipts(key,actor_id,fingerprint,result) VALUES(p_key,p_actor,fp,to_jsonb(l));
 RETURN to_jsonb(l);
END $$;

COMMIT;
