BEGIN;
CREATE TABLE public.lending_status_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 entity_kind text NOT NULL CHECK(entity_kind IN ('case','loan')),entity_id uuid NOT NULL,entity_version integer NOT NULL,
 from_status text,to_status text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(entity_kind,entity_id,entity_version)
);
CREATE INDEX lending_status_notifications_owner ON public.lending_status_notifications(user_id,created_at DESC);
CREATE INDEX lending_status_notifications_entity ON public.lending_status_notifications(entity_kind,entity_id,created_at DESC);
CREATE TABLE public.lending_push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),notification_id uuid NOT NULL REFERENCES public.lending_status_notifications(id),device_id uuid NOT NULL REFERENCES public.lending_push_devices(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','failed','disabled')),
 attempts integer NOT NULL DEFAULT 0,total_attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid,lease_until timestamptz,claimed_token text,provider_message_id text,error_code text,
 accepted_at timestamptz,received_at timestamptz,retry_requested_by uuid REFERENCES auth.users(id),retry_requested_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(notification_id,device_id)
);
CREATE INDEX lending_push_deliveries_pending ON public.lending_push_deliveries(status,next_attempt_at);
ALTER TABLE public.lending_status_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lending_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lending_status_notifications,public.lending_push_deliveries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.lending_status_notifications TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.lending_push_deliveries TO service_role;
CREATE TRIGGER lending_status_notifications_immutable BEFORE UPDATE OR DELETE ON public.lending_status_notifications FOR EACH ROW EXECUTE FUNCTION public.lending_immutable();

CREATE FUNCTION public.lending_enqueue_status_push() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE event_id uuid; kind text:=CASE WHEN TG_TABLE_NAME='lending_loans' THEN 'loan' ELSE 'case' END;
BEGIN
 IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
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
CREATE TRIGGER lending_case_status_push AFTER UPDATE OF status ON public.lending_support_cases FOR EACH ROW EXECUTE FUNCTION public.lending_enqueue_status_push();
CREATE TRIGGER lending_loan_status_push AFTER INSERT OR UPDATE OF status ON public.lending_loans FOR EACH ROW EXECUTE FUNCTION public.lending_enqueue_status_push();

CREATE FUNCTION public.lending_claim_status_push(p_limit integer DEFAULT 5,p_kind text DEFAULT NULL,p_entity uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'invalid_limit'; END IF;
 UPDATE public.lending_push_deliveries j SET status='failed',error_code='lease_expired',lease_id=NULL,lease_until=NULL,claimed_token=NULL
 FROM public.lending_status_notifications e WHERE e.id=j.notification_id AND j.status='sending' AND j.lease_until<now() AND j.attempts>=5
 AND (p_kind IS NULL OR (e.entity_kind=p_kind AND e.entity_id=p_entity));
 UPDATE public.lending_push_deliveries j SET status='disabled',error_code='device_unavailable'
 FROM public.lending_status_notifications e,public.lending_push_devices d
 WHERE j.notification_id=e.id AND j.device_id=d.id AND j.status IN ('pending','sending')
 AND (d.token LIKE 'disabled:%' OR d.user_id<>e.user_id) AND (p_kind IS NULL OR (e.entity_kind=p_kind AND e.entity_id=p_entity));
 WITH selected AS (
  SELECT j.id FROM public.lending_push_deliveries j JOIN public.lending_status_notifications e ON e.id=j.notification_id
  JOIN public.lending_push_devices d ON d.id=j.device_id AND d.user_id=e.user_id
  WHERE j.attempts<5 AND ((j.status='pending' AND j.next_attempt_at<=now()) OR (j.status='sending' AND j.lease_until<now()))
   AND d.token NOT LIKE 'disabled:%' AND (p_kind IS NULL OR (e.entity_kind=p_kind AND e.entity_id=p_entity))
  ORDER BY j.created_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT p_limit
 ), claimed AS (
  UPDATE public.lending_push_deliveries j SET status='sending',attempts=attempts+1,total_attempts=total_attempts+1,
   lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',claimed_token=d.token
  FROM selected s,public.lending_push_devices d WHERE j.id=s.id AND d.id=j.device_id RETURNING j.*
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'notificationId',c.notification_id,'leaseId',c.lease_id,'token',c.claimed_token,'kind',e.entity_kind,'entityId',e.entity_id)),'[]'::jsonb)
 INTO result FROM claimed c JOIN public.lending_status_notifications e ON e.id=c.notification_id;
 RETURN result;
END $$;
CREATE FUNCTION public.lending_finish_status_push(p_job uuid,p_lease uuid,p_message text DEFAULT NULL,p_error text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE j public.lending_push_deliveries;
BEGIN
 SELECT * INTO j FROM public.lending_push_deliveries WHERE id=p_job AND status='sending' AND lease_id=p_lease FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF p_error='device_not_registered' THEN
  UPDATE public.lending_push_devices SET token='disabled:'||id::text,updated_at=now() WHERE id=j.device_id AND token=j.claimed_token;
 END IF;
 UPDATE public.lending_push_deliveries SET status=CASE WHEN p_error IS NULL AND p_message IS NOT NULL THEN 'accepted' WHEN p_error='device_not_registered' THEN 'disabled' WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,
  provider_message_id=left(p_message,500),error_code=left(p_error,80),accepted_at=CASE WHEN p_error IS NULL AND p_message IS NOT NULL THEN now() ELSE NULL END,
  next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer),lease_until=NULL,lease_id=NULL,claimed_token=NULL
 WHERE id=j.id;
END $$;
CREATE FUNCTION public.lending_retry_status_push(p_actor uuid,p_kind text,p_entity uuid) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE count_rows integer;
BEGIN
 IF NOT public.lending_is_admin(p_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 UPDATE public.lending_push_deliveries j SET status='pending',attempts=0,next_attempt_at=now(),retry_requested_by=p_actor,retry_requested_at=now()
 FROM public.lending_status_notifications e WHERE j.notification_id=e.id AND e.entity_kind=p_kind AND e.entity_id=p_entity AND j.status IN ('failed','pending');
 GET DIAGNOSTICS count_rows=ROW_COUNT;RETURN count_rows;
END $$;
CREATE FUNCTION public.lending_revert_case_status(p_actor uuid,p_case uuid,p_status text,p_reason text,p_version integer,p_key uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE c public.lending_support_cases;r public.lending_command_receipts;
 fp jsonb:=jsonb_build_object('action','case_status_rollback','case',p_case,'status',p_status,'reason',p_reason,'version',p_version);
BEGIN
 IF NOT public.lending_is_admin(p_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_key IS NULL OR coalesce(length(trim(p_reason)),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'reason_required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 SELECT * INTO r FROM public.lending_command_receipts WHERE key=p_key;
 IF FOUND THEN IF r.actor_id<>p_actor OR r.fingerprint<>fp THEN RAISE EXCEPTION 'idempotency_conflict';END IF;RETURN r.result;END IF;
 SELECT * INTO c FROM public.lending_support_cases WHERE id=p_case FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
 IF c.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'version_conflict'; END IF;
 IF c.loan_id IS NOT NULL OR NOT ((c.status='reviewing' AND p_status='registered') OR (c.status='information_required' AND p_status IN ('registered','reviewing')) OR (c.status='offered' AND p_status='reviewing')) THEN RAISE EXCEPTION 'invalid_transition'; END IF;
 UPDATE public.lending_support_cases SET status=p_status,offer_jpy=NULL,valuation_jpy=NULL,offer_note=NULL,offer_expires_at=NULL,reviewed_by=NULL,version=version+1,updated_at=now() WHERE id=c.id RETURNING * INTO c;
 INSERT INTO public.lending_support_events(case_id,actor_id,action,to_status,version,message) VALUES(c.id,p_actor,'rollback',c.status,c.version,'ステータスを戻しました：'||trim(p_reason));
 INSERT INTO public.lending_command_receipts(key,actor_id,fingerprint,result) VALUES(p_key,p_actor,fp,to_jsonb(c)-'contact_label'-'created_by');
 RETURN to_jsonb(c)-'contact_label'-'created_by';
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('lending_enqueue_status_push','lending_claim_status_push','lending_finish_status_push','lending_retry_status_push','lending_revert_case_status') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
COMMIT;
