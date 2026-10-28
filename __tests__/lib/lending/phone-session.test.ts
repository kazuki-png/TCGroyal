import { describe, expect, it, vi } from 'vitest';
import { signOutIfSignedIn } from '../../../mobile/src/phone-session';
describe('phone authentication session reset', () => {
  it('does not block SMS submission on first launch with no signed-in user', async () => {
    const signOut = vi.fn().mockRejectedValue({ code: 'auth/no-current-user' });
    await expect(signOutIfSignedIn({ currentUser: null }, signOut)).resolves.toBeUndefined();
    expect(signOut).not.toHaveBeenCalled();
  });
  it('clears an existing user before starting another login attempt', async () => {
    const auth = { currentUser: { uid: 'existing' } };
    const signOut = vi.fn().mockResolvedValue(undefined);
    await signOutIfSignedIn(auth, signOut);
    expect(signOut).toHaveBeenCalledExactlyOnceWith(auth);
  });
  it('accepts a concurrent reset that already signed the user out', async () => {
    const signOut = vi.fn().mockRejectedValue({ code: 'auth/no-current-user' });
    await expect(signOutIfSignedIn({ currentUser: { uid: 'existing' } }, signOut)).resolves.toBeUndefined();
  });
  it('preserves other Firebase errors instead of hiding a failed session reset', async () => {
    const error = { code: 'auth/network-request-failed' };
    const signOut = vi.fn().mockRejectedValue(error);
    await expect(signOutIfSignedIn({ currentUser: { uid: 'existing' } }, signOut)).rejects.toBe(error);
  });
});
