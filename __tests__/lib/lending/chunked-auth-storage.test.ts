import { beforeEach, describe, expect, it } from 'vitest';
import { chunkSecret, createChunkedAuthStorage } from '../../../mobile/src/chunked-auth-storage';
let values: Map<string, string>, fail: string | null, sequence: number;
const store = { get: async (key: string) => values.get(key) ?? null, set: async (key: string, value: string) => { if (key === fail) throw Error('storage-failed'); values.set(key, value); }, remove: async (key: string) => { values.delete(key); } };
beforeEach(() => { values = new Map(); fail = null; sequence = 0; });
const storage = () => createChunkedAuthStorage(store, () => `generation-${++sequence}`);
describe('encrypted session storage chunking', () => {
  it('keeps every secure-store value below its byte budget without splitting Unicode characters', () => {
    const value = 'テスト🃏'.repeat(1000);
    const chunks = chunkSecret(value);
    expect(chunks.join('')).toBe(value);
    expect(chunks.every(chunk => Buffer.byteLength(chunk, 'utf8') <= 1800)).toBe(true);
  });
  it('round-trips a large session and removes old encrypted chunks after refresh', async () => {
    const adapter = storage(); const first = 'a'.repeat(8000);
    await adapter.setItem('auth', first); expect(await adapter.getItem('auth')).toBe(first);
    await adapter.setItem('auth', 'fresh'); expect(await adapter.getItem('auth')).toBe('fresh');
    expect([...values.keys()].some(key => key.includes('generation-1'))).toBe(false);
  });
  it('keeps the previous session when a replacement write fails before its commit', async () => {
    const adapter = storage(); await adapter.setItem('auth', 'previous'); fail = 'sb.auth.generation-2.1';
    await expect(adapter.setItem('auth', 'x'.repeat(5000))).rejects.toThrow('storage-failed');
    expect(await adapter.getItem('auth')).toBe('previous');
    expect([...values.keys()].some(key => key.includes('generation-2'))).toBe(false);
  });
  it('does not expose a partially persisted session', async () => {
    const adapter = storage(); await adapter.setItem('auth', 'x'.repeat(5000)); values.delete('sb.auth.generation-1.1');
    await expect(adapter.getItem('auth')).rejects.toThrow('不完全');
    await adapter.removeItem('auth'); expect(await adapter.getItem('auth')).toBeNull();
  });
  it('serializes a pending refresh before logout so a session cannot reappear', async () => {
    const adapter = storage(); await Promise.all([adapter.setItem('auth', 'token'), adapter.removeItem('auth')]);
    expect(await adapter.getItem('auth')).toBeNull(); expect(values.size).toBe(0);
  });
  it('rejects unsafe keys and oversized records and can clear malformed metadata', async () => {
    const adapter = storage(); await expect(adapter.getItem('../auth')).rejects.toThrow('キー');
    expect(() => chunkSecret('x'.repeat(240000))).toThrow('大きすぎ');
    values.set('sb.auth.head', '{invalid'); await adapter.removeItem('auth'); expect(values.size).toBe(0);
  });
});
