import * as SecureStore from 'expo-secure-store';
import { createVaultQueue, parseRememberedAccess, type RememberedAccess } from './remembered-access';
const key = 'tcg-royal-preview-access-v1';
const options: SecureStore.SecureStoreOptions = { keychainService: 'tcg-royal-preview', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const enqueue = createVaultQueue();
export async function readAccess() {
  const raw = await enqueue(() => SecureStore.getItemAsync(key, options));
  return raw ? parseRememberedAccess(raw) : null;
}
export async function saveAccess(access: RememberedAccess) {
  await enqueue(() => SecureStore.setItemAsync(key, JSON.stringify(parseRememberedAccess(JSON.stringify(access))), options));
}
export const clearAccess = () => enqueue(() => SecureStore.deleteItemAsync(key, options));
