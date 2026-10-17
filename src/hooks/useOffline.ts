import { useEffect, useState } from 'react';
import { onSyncState, type SyncState } from '@/lib/offline/sync';

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export function useSyncState() {
  const [s, setS] = useState<SyncState>({ pending: 0, syncing: false, lastSyncedAt: null, lastResults: {} });
  useEffect(() => onSyncState((n) => setS({ ...n })), []);
  return s;
}
