import { createVaultQueue } from './remembered-access';
type Store = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };
type Head = { id: string; count: number };
const limit = 1800;
function parseHead(raw: string | null): Head | null {
  if (!raw) return null;
  const head = JSON.parse(raw);
  if (!/^[a-z0-9-]{1,60}$/i.test(head.id) || !Number.isInteger(head.count) || head.count < 1 || head.count > 128) throw Error('保存済み認証情報を読み込めません。');
  return head;
}
export function chunkSecret(value: string): string[] {
  const chunks: string[] = []; let current = ''; let size = 0;
  for (const char of value) {
    const code = char.codePointAt(0)!;
    const bytes = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (size + bytes > limit) { chunks.push(current); current = ''; size = 0; }
    current += char; size += bytes;
  }
  chunks.push(current);
  if (chunks.length > 128) throw Error('認証情報が大きすぎます。');
  return chunks;
}
export function createChunkedAuthStorage(store: Store, newId: () => string) {
  const enqueue = createVaultQueue();
  function prefix(key: string) {
    if (!/^[a-z0-9._-]{1,120}$/i.test(key)) throw Error('認証ストレージのキーが不正です。');
    return `sb.${key}`;
  }
  async function cleanup(base: string, head: Head | null) {
    if (head) for (let i = 0; i < head.count; i++) await store.remove(`${base}.${head.id}.${i}`).catch(() => {});
  }
  return {
    getItem: (key: string) => enqueue(async () => {
      const base = prefix(key); const head = parseHead(await store.get(`${base}.head`));
      if (!head) return null;
      const parts: string[] = [];
      for (let i = 0; i < head.count; i++) { const part = await store.get(`${base}.${head.id}.${i}`); if (part === null) throw Error('認証情報が不完全です。再度ログインしてください。'); parts.push(part); }
      return parts.join('');
    }),
    setItem: (key: string, value: string) => enqueue(async () => {
      const base = prefix(key); const old = parseHead(await store.get(`${base}.head`));
      const chunks = chunkSecret(value); const head = { id: newId(), count: chunks.length };
      try {
        for (let i = 0; i < chunks.length; i++) await store.set(`${base}.${head.id}.${i}`, chunks[i]);
        await store.set(`${base}.head`, JSON.stringify(head));
      } catch (error) { await cleanup(base, head); throw error; }
      await cleanup(base, old);
    }),
    removeItem: (key: string) => enqueue(async () => {
      const base = prefix(key); const raw = await store.get(`${base}.head`);
      // Remove the pointer first so a logout cannot resurrect a partial session.
      await store.remove(`${base}.head`);
      let old: Head | null = null; try { old = parseHead(raw); } catch { /* Invalid data must not block logout. */ }
      await cleanup(base, old);
    }),
  };
}
