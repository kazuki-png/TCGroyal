import { getRandomValues } from 'expo-crypto';
// auth-js must never fall back to Math.random for a native PKCE verifier.
const nativeCrypto = globalThis.crypto ?? ({} as Crypto);
if (typeof nativeCrypto.getRandomValues !== 'function') Object.defineProperty(nativeCrypto, 'getRandomValues', { value: getRandomValues, configurable: true });
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: nativeCrypto, configurable: true });
