BEGIN;
CREATE FUNCTION public.lending_admin_dashboard(p_actor uuid,p_search text DEFAULT '',p_filter text DEFAULT 'all',p_page integer DEFAULT 1) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.lending_is_admin(p_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF length(p_search)>100 OR p_page NOT BETWEEN 1 AND 10000 OR p_filter NOT IN ('all','review','preparing','active','repayment_pending','due_soon','overdue','return_pending','closed') THEN RAISE EXCEPTION 'invalid_filter'; END IF;
 WITH entries AS (
  SELECT 'case'::text kind,c.id,c.reference,c.user_id,trim(coalesce(p.last_name,'')||' '||coalesce(p.first_name,'')) customer_name,
   c.card_name,c.card_number,c.status,c.requested_jpy,0::bigint principal_jpy,c.offer_jpy,NULL::timestamptz due_at,c.created_at,c.updated_at,
   CASE WHEN c.status IN ('declined','cancelled') THEN 'closed' WHEN c.status='offered' THEN 'preparing' ELSE 'review' END bucket,
   false has_pending_request
  FROM public.lending_support_cases c LEFT JOIN public.profiles p ON p.id=c.user_id WHERE c.loan_id IS NULL
  UNION ALL
  SELECT 'loan',l.id,coalesce(c.reference,'LN-'||upper(left(l.id::text,8))),l.user_id,trim(coalesce(p.last_name,'')||' '||coalesce(p.first_name,'')),
   q.card_name,q.card_number,l.status,l.requested_jpy,l.principal_jpy,l.offered_jpy,l.due_at,l.created_at,l.updated_at,
   CASE WHEN l.status IN ('returned','forfeited','rejected','cancelled') THEN 'closed' WHEN l.status IN ('submitted','received','offered','accepted') THEN 'preparing' ELSE l.status END,
   EXISTS(SELECT 1 FROM public.lending_requests r WHERE r.loan_id=l.id AND r.status='pending')
  FROM public.lending_loans l JOIN public.lending_quotes q ON q.id=l.quote_id
  LEFT JOIN public.lending_support_cases c ON c.loan_id=l.id LEFT JOIN public.profiles p ON p.id=l.user_id
 ), filtered AS (
  SELECT * FROM entries e WHERE (p_search='' OR e.reference ILIKE '%'||p_search||'%' OR e.id::text ILIKE '%'||p_search||'%' OR e.card_name ILIKE '%'||p_search||'%' OR e.customer_name ILIKE '%'||p_search||'%' OR e.user_id::text=p_search OR e.card_number ILIKE '%'||p_search||'%')
   AND (p_filter='all' OR e.bucket=p_filter OR (p_filter='active' AND e.kind='loan' AND e.status='repayment_pending')
    OR (p_filter='due_soon' AND e.status IN ('active','repayment_pending') AND e.due_at BETWEEN now() AND now()+interval '7 days')
    OR (p_filter='overdue' AND e.status IN ('active','repayment_pending') AND e.due_at<now()))
 ), paged AS (
  SELECT * FROM filtered ORDER BY CASE WHEN status IN ('active','repayment_pending') AND due_at<now() THEN 0 WHEN status='repayment_pending' THEN 1 WHEN bucket='review' THEN 2 ELSE 3 END,updated_at DESC,id
  LIMIT 25 OFFSET (p_page-1)*25
 )
 SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(paged)) FROM paged),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'page',p_page,'pageSize',25,'evaluatedAt',now(),
  'summary',jsonb_build_object(
   'outstandingJpy',coalesce((SELECT sum(principal_jpy) FROM public.lending_loans WHERE status IN ('active','repayment_pending')),0),
   'activeCount',(SELECT count(*) FROM public.lending_loans WHERE status IN ('active','repayment_pending')),
   'reviewCount',(SELECT count(*) FROM entries WHERE bucket='review'),
   'preparingCount',(SELECT count(*) FROM entries WHERE bucket='preparing'),
   'repaymentPendingCount',(SELECT count(*) FROM public.lending_loans WHERE status='repayment_pending'),
   'dueSoonCount',(SELECT count(*) FROM public.lending_loans WHERE status IN ('active','repayment_pending') AND due_at BETWEEN now() AND now()+interval '7 days'),
   'overdueCount',(SELECT count(*) FROM public.lending_loans WHERE status IN ('active','repayment_pending') AND due_at<now()),
   'returnPendingCount',(SELECT count(*) FROM public.lending_loans WHERE status='return_pending')
  )) INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.lending_admin_detail(p_actor uuid,p_kind text,p_id uuid) RETURNS jsonb
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
   'payoff_jpy',CASE WHEN l.status IN ('active','repayment_pending') THEN l.principal_jpy+public.lending_interest(l.principal_jpy,l.monthly_rate_bps,l.interest_start_at,now()) ELSE 0 END,
   'ledger',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'amount_jpy',e.amount_jpy,'created_at',e.created_at) ORDER BY e.created_at) FROM public.lending_ledger e WHERE e.loan_id=l.id),'[]'::jsonb),
   'events',coalesce((SELECT jsonb_agg(jsonb_build_object('action',e.action,'to_status',e.to_status,'version',e.version,'created_at',e.created_at,'reason',e.details->>'reason') ORDER BY e.version) FROM public.lending_events e WHERE e.loan_id=l.id),'[]'::jsonb),
   'requests',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM public.lending_requests r WHERE r.loan_id=l.id),'[]'::jsonb),
   'support_case', (SELECT jsonb_build_object('id',s.id,'reference',s.reference,'condition',s.condition,'notes',s.notes,'selected_card',s.selected_card,'declared_grade',s.declared_grade,'declared_cert_number',s.declared_cert_number) FROM public.lending_support_cases s WHERE s.loan_id=l.id));
 ELSE RAISE EXCEPTION 'not_found'; END IF;
 SELECT jsonb_build_object('id',p.id,'name',trim(p.last_name||' '||p.first_name),'phone',p.phone,
  'identityVerified',EXISTS(SELECT 1 FROM public.lending_identity_checks i WHERE i.user_id=p.id AND i.expires_at>now())) INTO customer FROM public.profiles p WHERE p.id=owner_id;
 RETURN jsonb_build_object('kind',p_kind,'item',item,'customer',customer);
END $$;
REVOKE ALL ON FUNCTION public.lending_admin_dashboard(uuid,text,text,integer),public.lending_admin_detail(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_admin_dashboard(uuid,text,text,integer),public.lending_admin_detail(uuid,text,uuid) TO service_role;
COMMIT;
