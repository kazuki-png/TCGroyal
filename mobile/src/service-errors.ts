// Read bounded message fields, never whole responses or credentials.
export function serviceErrorMessage(value: unknown, fallback: string): string {
  const seen = new Set<object>();
  function read(item: unknown, depth: number): string | undefined {
    if (typeof item === 'string') {
      const message = item.trim();
      if (!message || message.includes('[object Object]') || /^[{[]/.test(message) || message.length > 500) return;
      return message;
    }
    if (!item || typeof item !== 'object' || depth > 3 || seen.has(item)) return;
    seen.add(item);
    const record = item as Record<string, unknown>;
    for (const key of ['message', 'msg', 'error_description', 'error', 'cause']) {
      const message = read(record[key], depth + 1);
      if (message) return message;
    }
  }
  return read(value, 0) ?? fallback;
}

export function apiResponseError(value: unknown, status: number): Error {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (record.protection || /protected deployment|protected by vercel authentication/i.test(serviceErrorMessage(record, ''))) {
    return Error('Previewへの接続がVercelのアクセス保護で止められました。Supabaseのログインとは別の接続設定の問題です。');
  }
  const fallback = status === 429 ? 'アクセスが集中しています。時間をおいてお試しください。' : `処理を完了できませんでした。（HTTP ${status}）`;
  return Error(serviceErrorMessage(record.error ?? record, fallback));
}
