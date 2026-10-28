import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseReadIds } from './inbox';

export function useInboxReceipts(key: string | null) {
  const [saved, setSaved] = useState<{ key: string; ids: string[] } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const current = useRef<{ key: string; ids: string[]; saving: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    current.current = null;
    if (key) void AsyncStorage.getItem(key).then(raw => {
      if (!live) return;
      let ids: string[];
      let warning = '';
      try { ids = parseReadIds(raw); } catch { ids = []; warning = '既読情報を復元できなかったため、未読として表示しています。'; }
      current.current = { key, ids, saving: false }; setSaved({ key, ids }); setSaving(false); setError(warning);
    }).catch(() => { if (live) { setError('既読状態を読み込めません。再読み込みしてください。'); setSaving(false); } });
    return () => { live = false; current.current = null; };
  }, [key, attempt]);
  async function markRead(ids: string[]) {
    const snapshot = current.current;
    if (!snapshot || snapshot.key !== key || snapshot.saving) return false;
    snapshot.saving = true; setSaving(true);
    const next = [...new Set([...snapshot.ids, ...ids])].slice(-500);
    try {
      await AsyncStorage.setItem(snapshot.key, JSON.stringify(next));
      if (current.current !== snapshot) return false;
      snapshot.ids = next; setSaved({ key: snapshot.key, ids: next }); setError(''); return true;
    } catch { if (current.current === snapshot) setError('既読状態を保存できません。もう一度お試しください。'); return false; }
    finally { if (current.current === snapshot) { snapshot.saving = false; setSaving(false); } }
  }
  return { readIds: saved?.key === key ? saved.ids : [], ready: !!key && saved?.key === key, saving, error, markRead, retry: () => setAttempt(value => value + 1) };
}
