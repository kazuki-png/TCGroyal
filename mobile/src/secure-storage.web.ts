import type {SecureStoreOptions} from 'expo-secure-store';
export type {SecureStoreOptions} from 'expo-secure-store';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 0;
// Browser sessions live only in this tab; never describe Web Storage as encrypted.
const scoped = (key:string, options?:SecureStoreOptions) => `tcg-web:${options?.keychainService??'default'}:${key}`;
export async function getItemAsync(key:string, options?:SecureStoreOptions) { return sessionStorage.getItem(scoped(key,options)); }
export async function setItemAsync(key:string,value:string,options?:SecureStoreOptions) { sessionStorage.setItem(scoped(key,options),value); }
export async function deleteItemAsync(key:string,options?:SecureStoreOptions) { sessionStorage.removeItem(scoped(key,options)); }
