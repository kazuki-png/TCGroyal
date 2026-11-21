BEGIN;
-- Change only the optional case message check; keep authorization, financial
-- validation, audit history and notification triggers intact.
DO $migration$
DECLARE definition text;
 old_check text := 'IF p_action<>''link'' AND length(trim(msg)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION ''reason_required''; END IF;';
 new_check text := 'IF p_action<>''link'' AND length(trim(msg)) > 500 THEN RAISE EXCEPTION ''message_too_long''; END IF;';
BEGIN
 SELECT pg_get_functiondef('public.lending_support_command(uuid,uuid,text,jsonb,uuid,integer)'::regprocedure) INTO definition;
 IF strpos(definition,old_check)=0 THEN RAISE EXCEPTION 'Unexpected lending_support_command definition'; END IF;
 EXECUTE replace(definition,old_check,new_check);
END $migration$;
COMMIT;
