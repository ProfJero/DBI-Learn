import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudDownload, HardDrive, RefreshCw, Smartphone, Trash2, WifiOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCourse, estimateSize, listPackages, removePackage } from '@/lib/offline/packages';
import { flush, getFailures } from '@/lib/offline/sync';
import { useMyEnrollments } from '@/hooks/queries';
import { useOnline, useSyncState } from '@/hooks/useOffline';
import { useInstall } from '@/components/layout/Pwa';
import { CourseCover } from '@/components/CourseCard';
import { Button, Card, EmptyState, PageHeader, Progress } from '@/components/ui';
import { formatDate, timeAgo } from '@/lib/utils';

export function Downloads() {
  const qc = useQueryClient();
  const online = useOnline();
  const sync = useSyncState();
  const { canInstall, install, standalone, isIos } = useInstall();
  const { data: enrollments } = useMyEnrollments();
  const { data: pkgs } = useQuery({ queryKey: ['packages'], queryFn: listPackages, networkMode: 'always' });
  const { data: failures } = useQuery({ queryKey: ['sync-failures', sync.lastSyncedAt], queryFn: getFailures, networkMode: 'always' });
  const { data: storage } = useQuery({
    queryKey: ['storage-estimate', pkgs?.length],
    queryFn: async () => (navigator.storage?.estimate ? navigator.storage.estimate() : null),
    networkMode: 'always',
  });
  const [progress, setProgress] = useState<Record<string, number>>({});

  const downloadedIds = new Set(pkgs?.map((p) => p.course.id));
  const notDownloaded = enrollments?.filter((e) => !downloadedIds.has(e.course_id)) ?? [];

  async function get(courseId: string) {
    setProgress((p) => ({ ...p, [courseId]: 0 }));
    try {
      await downloadCourse(courseId, (n) => setProgress((p) => ({ ...p, [courseId]: n })));
      if (navigator.storage?.persist) await navigator.storage.persist();
      toast.success('Ready for offline learning ✅');
      void qc.invalidateQueries({ queryKey: ['packages'] });
      void qc.invalidateQueries({ queryKey: ['downloaded', courseId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(({ [courseId]: _, ...rest }) => rest);
    }
  }

  return (
    <>
      <PageHeader title="Downloads" subtitle="Save courses to this device and keep learning without internet. Your progress syncs automatically." />

      {!standalone && (
        <Card className="mb-6 flex flex-col gap-4 bg-gradient-to-r from-brand-50 to-sky-50 p-5 dark:from-brand-950/40 dark:to-sky-950/30 sm:flex-row sm:items-center">
          <Smartphone className="h-10 w-10 shrink-0 text-brand-600" />
          <div className="flex-1">
            <p className="font-bold">Install DBI Learn as an app</p>
            <p className="text-sm text-ink-600 dark:text-ink-300">
              {isIos ? 'On iPhone/iPad: tap the Share button, then "Add to Home Screen".' : 'Launch it from your home screen, full-screen and offline-ready.'}
            </p>
          </div>
          {canInstall && <Button onClick={install}>Install app</Button>}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          {online ? <RefreshCw className="h-5 w-5 text-sky-600" /> : <WifiOff className="h-5 w-5 text-amber-500" />}
          <p className="mt-2 font-bold">{online ? 'Online' : 'Offline'}</p>
          <p className="text-xs text-ink-500">
            {sync.pending ? `${sync.pending} activities waiting to sync` : 'Everything is synced'}
            {sync.lastSyncedAt && ` · last sync ${timeAgo(sync.lastSyncedAt)}`}
          </p>
          {online && sync.pending > 0 && (
            <Button size="sm" variant="outline" className="mt-3" loading={sync.syncing} onClick={() => void flush()}>
              Sync now
            </Button>
          )}
        </Card>
        <Card className="p-5">
          <CloudDownload className="h-5 w-5 text-brand-600" />
          <p className="mt-2 font-bold">{pkgs?.length ?? 0} courses downloaded</p>
          <p className="text-xs text-ink-500">Lessons, quizzes and images are stored on this device.</p>
        </Card>
        <Card className="p-5">
          <HardDrive className="h-5 w-5 text-violet-600" />
          <p className="mt-2 font-bold">{storage?.usage != null ? `${(storage.usage / 1048576).toFixed(1)} MB used` : 'Storage'}</p>
          {storage?.quota != null && storage.usage != null && (
            <>
              <Progress value={(storage.usage / storage.quota) * 100} className="mt-2" tone="blue" />
              <p className="mt-1 text-xs text-ink-500">of {(storage.quota / 1073741824).toFixed(1)} GB available</p>
            </>
          )}
        </Card>
      </div>

      {!!failures?.length && (
        <Card className="mt-6 border-amber-200 p-4 dark:border-amber-900">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Some offline activities couldn't be saved
          </p>
          <ul className="mt-2 space-y-1 text-xs text-ink-500">
            {failures.slice(-5).map((f) => (
              <li key={f.item.id}>
                {formatDate(f.at, { dateStyle: 'short', timeStyle: 'short' })} — {f.item.type.replace('_', ' ')}: {f.error}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-4 mt-10 text-xl font-bold">On this device</h2>
      {!pkgs?.length ? (
        <EmptyState icon={<CloudDownload className="h-5 w-5" />} title="No downloads yet" body="Download a course below — then you can study it anywhere, even with no data." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pkgs.map((p) => (
            <Card key={p.course.id} className="flex overflow-hidden">
              <CourseCover course={p.course} className="w-36 shrink-0 sm:w-44" />
              <div className="flex min-w-0 flex-1 flex-col p-4">
                <Link to={`/app/learn/${p.course.slug}`} className="truncate font-bold hover:text-brand-600">
                  {p.course.title}
                </Link>
                <p className="mt-1 text-xs text-ink-500">
                  {p.lessons.length} lessons · {p.quizzes.length} quizzes · {(estimateSize(p) / 1024).toFixed(0)} KB
                </p>
                <p className="text-xs text-ink-400">Saved {timeAgo(p.downloadedAt)}</p>
                <div className="mt-auto flex gap-2 pt-3">
                  <Button size="sm" variant="outline" disabled={!online} loading={progress[p.course.id] != null} onClick={() => get(p.course.id)} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                    Update
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={async () => {
                      await removePackage(p.course.id);
                      void qc.invalidateQueries({ queryKey: ['packages'] });
                      void qc.invalidateQueries({ queryKey: ['downloaded', p.course.id] });
                      toast('Removed from this device');
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {notDownloaded.length > 0 && (
        <>
          <h2 className="mb-4 mt-10 text-xl font-bold">Your courses available to download</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {notDownloaded.map((e) => (
              <Card key={e.course_id} className="flex items-center gap-4 p-3">
                <CourseCover course={e.course} className="w-24 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{e.course.title}</p>
                  {progress[e.course_id] != null && <Progress value={progress[e.course_id]!} className="mt-2" />}
                </div>
                <Button size="sm" disabled={!online} loading={progress[e.course_id] != null} onClick={() => get(e.course_id)} icon={<CloudDownload className="h-4 w-4" />}>
                  Download
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
