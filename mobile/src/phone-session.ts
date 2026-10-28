// Native Firebase rejects signOut when no user exists. Resetting a login flow
// must still succeed on first launch, and when another reset won the race.
export async function signOutIfSignedIn<T extends { currentUser: unknown }>(auth: T, signOut: (auth: T) => Promise<void>) {
  if (!auth.currentUser) return;
  try { await signOut(auth); }
  catch (error) {
    if ((error as { code?: string } | null)?.code !== 'auth/no-current-user') throw error;
  }
}
