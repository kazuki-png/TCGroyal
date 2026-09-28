BEGIN;
-- Storage tables are owned by supabase_storage_admin, so postgres REVOKE may
-- leave the owner's existing grants intact. Restrictive RLS is the boundary.
CREATE POLICY storage_server_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY storage_server_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY storage_server_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);
COMMIT;
