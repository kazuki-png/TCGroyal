BEGIN;
-- Existing administrators with extra KYC permission also have ordinary admin access.
-- No memberships or role values are added/changed. Customer/public access stays denied.
CREATE OR REPLACE FUNCTION public.lending_is_admin(p_actor uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE id=p_actor AND role IN ('admin','kyc_reviewer'))
$$;
REVOKE ALL ON FUNCTION public.lending_is_admin(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lending_is_admin(uuid) TO service_role;
COMMIT;
