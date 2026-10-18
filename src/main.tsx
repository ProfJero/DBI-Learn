import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del, createStore } from 'idb-keyval';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/index.css';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';
import { setAfterSync, startSyncLoop } from './lib/offline/sync';
import { refreshStalePackages } from './lib/offline/packages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 7 * 24 * 60 * 60 * 1000, // keep for offline use
      retry: (count, err) => count < 2 && !/permission|not found/i.test(String(err)),
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
    },
    mutations: { networkMode: 'offlineFirst' },
  },
});

// Persist the query cache to IndexedDB so previously viewed pages work offline.
const cacheStore = createStore('dbi-learn-cache', 'rq');
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (k) => get(k, cacheStore),
    setItem: (k, v) => set(k, v, cacheStore),
    removeItem: (k) => del(k, cacheStore),
  },
  key: 'dbi-query-cache',
  throttleTime: 2000,
});

setAfterSync(() => void queryClient.invalidateQueries());
startSyncLoop();
window.addEventListener('online', () => void refreshStalePackages());
setTimeout(() => void refreshStalePackages(), 5000);

console.info(
  '%cDBI Learn%c Built by ProfJero Digital Studio · Powered by Digital Bridge Initiative',
  'background:#03c14b;color:#fff;padding:4px 8px;border-radius:4px;font-weight:700',
  'color:#0b7be8;padding:4px',
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000, buster: 'v2' }}
    >
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster richColors position="top-center" closeButton />
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);
