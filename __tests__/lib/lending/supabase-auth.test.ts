import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/lending/workflow-client', () => ({ createWorkflowClient: vi.fn() }));
import { createWorkflowClient } from '@/lib/lending/workflow-client';
import { readSupabaseLendingActor } from '@/lib/lending/supabase-auth';
const url = 'https://mkmkkkdserlcaycknuxp.supabase.co';
const id = '10000000-0000-4000-8000-000000000003';
const user = { id, role: 'authenticated', email: 'synthetic@example.invalid', email_confirmed_at: '2026-10-27T00:00:00Z', is_anonymous: false, user_metadata: { role: 'admin' }, factors: [] as { status: string }[] };
const token = (claims: Record<string, unknown> = {}) => `header.${Buffer.from(JSON.stringify({ iss: `${url}/auth/v1`, aal: 'aal1', ...claims })).toString('base64url')}.signature`;
const getUser = vi.fn(), lookup = vi.fn();
const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: lookup };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('LENDING_PREVIEW_SUPABASE_URL', url);
  query.select.mockReturnThis(); query.eq.mockReturnThis();
  getUser.mockResolvedValue({ data: { user }, error: null }); lookup.mockResolvedValue({ data: null, error: null });
  vi.mocked(createWorkflowClient).mockReturnValue({ auth: { getUser }, from: () => query } as unknown as ReturnType<typeof createWorkflowClient>);
});
describe('Supabase lending bearer authentication', () => {
  it('verifies with Auth and uses the returned user ID, ignoring editable admin claims', async () => {
    const bearer = token({ sub: 'spoofed', role: 'admin' });
    expect(await readSupabaseLendingActor(bearer)).toMatchObject({ id, role: 'customer', demo: false, authProvider: 'supabase' });
    expect(getUser).toHaveBeenCalledWith(bearer); expect(query.eq).toHaveBeenCalledWith('id', id);
  });
  it('reads administrator privileges from the database', async () => {
    lookup.mockResolvedValue({ data: { role: 'admin' }, error: null });
    expect(await readSupabaseLendingActor(token())).toMatchObject({ role: 'admin' });
  });
  it('preserves administrator access for the existing KYC administrator role', async () => {
    lookup.mockResolvedValue({ data: { role: 'kyc_reviewer' }, error: null });
    expect(await readSupabaseLendingActor(token())).toMatchObject({ id, role: 'admin' });
  });
  it.each([{ email_confirmed_at: null }, { is_anonymous: true }, { role: 'service_role' }])('rejects unconfirmed, anonymous and non-user identities: %j', async values => {
    getUser.mockResolvedValue({ data: { user: { ...user, ...values } }, error: null });
    expect(await readSupabaseLendingActor(token())).toBeNull(); expect(lookup).not.toHaveBeenCalled();
  });
  it('rejects invalid tokens and foreign projects without creating a privileged client', async () => {
    expect(await readSupabaseLendingActor('invalid')).toBeNull();
    expect(await readSupabaseLendingActor(token({ iss: 'https://foreign.supabase.co/auth/v1' }))).toBeNull();
    expect(createWorkflowClient).not.toHaveBeenCalled();
  });
  it('fails closed when token verification or role lookup fails', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid JWT' } });
    expect(await readSupabaseLendingActor(token())).toBeNull();
    lookup.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    expect(await readSupabaseLendingActor(token())).toBeNull();
  });
  it('requires verified aal2 for an account with enrolled MFA', async () => {
    getUser.mockResolvedValue({ data: { user: { ...user, factors: [{ status: 'verified' }] } }, error: null });
    expect(await readSupabaseLendingActor(token())).toBeNull();
    expect(await readSupabaseLendingActor(token({ aal: 'aal2' }))).toMatchObject({ id });
  });
});
