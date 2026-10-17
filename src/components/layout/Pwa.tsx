import { useEffect, useState } from 'react';
import { CloudOff, Download, RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOnline, useSyncState } from '@/hooks/useOffline';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    installListeners.forEach((l) => l());
  });
}

export function useInstall() {
  const [available, setAvailable] = useState(!!deferred);
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  useEffect(() => {
    const l = () => setAvailable(!!deferred);
    installListeners.add(l);
    return () => void installListeners.delete(l);
  }, []);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    canInstall: available && !standalone,
    standalone,
    isIos,
    install: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      setAvailable(false);
      return outcome === 'accepted';
    },
  };
}

export function InstallButton({ className }: { className?: string }) {
  const { canInstall, install } = useInstall();
  if (!canInstall) return null;
  return (
    <Button size="sm" variant="outline" icon={<Download className="h-4 w-4" />} onClick={install} className={className}>
      Install app
    </Button>
  );
}

/** Prompts to reload when a new version of the app has been downloaded. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md animate-fade-up rounded-2xl border border-ink-100 bg-white p-4 shadow-lift dark:border-ink-700 dark:bg-ink-900 lg:bottom-6">
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-5 w-5 text-brand-500" />
        <div className="flex-1">
          <p className="font-semibold">A new version of DBI Learn is ready</p>
          <p className="text-sm text-ink-500">Reload to get the latest features and fixes.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => updateServiceWorker(true)}>
              Reload
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
              Later
            </Button>
          </div>
        </div>
        <button onClick={() => setNeedRefresh(false)} aria-label="Dismiss" className="text-ink-400">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnline();
  const { pending, syncing } = useSyncState();
  if (online && !pending) return null;
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium',
        online ? 'bg-sky-600 text-white' : 'bg-amber-500 text-amber-950',
        className,
      )}
      role="status"
    >
      {online ? (
        <>
          <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
          Syncing {pending} offline {pending === 1 ? 'activity' : 'activities'}…
        </>
      ) : (
        <>
          <CloudOff className="h-3.5 w-3.5" />
          You're offline — downloaded courses still work. {pending > 0 && `${pending} ${pending === 1 ? 'activity' : 'activities'} will sync later.`}
        </>
      )}
    </div>
  );
}
