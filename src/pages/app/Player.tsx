import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, BookOpen, CheckCircle2, ChevronDown, CloudDownload, CloudOff, FileQuestion, Lock, Menu, PlayCircle, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useCoursePackage, useCourseProgress, useSteps, isStepDone, type Step } from '@/hooks/useLearn';
import { downloadCourse, getPackage } from '@/lib/offline/packages';
import { Button, EmptyState, FullPageSpinner, LinkButton, ProgressRing } from '@/components/ui';
import { ThemeToggle } from '@/components/layout/Brand';
import { OfflineBanner } from '@/components/layout/Pwa';
import { LessonView } from '@/components/learn/LessonView';
import { QuizView } from '@/components/learn/QuizView';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export function Player() {
  const { slug = '' } = useParams();
  const { data: pkg, isLoading, error } = useCoursePackage(slug);
  const progress = useCourseProgress(pkg?.course.id);
  const steps = useSteps(pkg);
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setDrawer(false);
  }, [location.pathname]);

  // Record the resume point (best effort, online only).
  const currentLessonId = location.pathname.match(/lesson\/([^/]+)/)?.[1];
  useEffect(() => {
    if (!currentLessonId || !pkg || !navigator.onLine || !progress.data?.enrolled) return;
    void supabase
      .from('enrollments')
      .update({ last_lesson_id: currentLessonId, last_activity_at: new Date().toISOString() })
      .eq('course_id', pkg.course.id)
      .then(() => undefined);
  }, [currentLessonId, pkg, progress.data?.enrolled]);

  if (isLoading) return <FullPageSpinner label="Opening course…" />;
  if (error || !pkg)
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<CloudOff className="h-5 w-5" />}
          title="Course unavailable"
          body={(error as Error)?.message ?? 'We could not open this course.'}
          action={<LinkButton to="/app/downloads">See downloaded courses</LinkButton>}
        />
      </div>
    );

  const done = steps.filter((s) => isStepDone(s, progress.data)).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;

  const locked = (index: number) => pkg.course.sequential && steps.slice(0, index).some((s) => !isStepDone(s, progress.data));

  const sidebar = (
    <Curriculum
      pkg={pkg}
      steps={steps}
      progress={progress.data}
      locked={locked}
      onClose={() => setDrawer(false)}
    />
  );

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950">
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <Link to="/app/courses" className="rounded-lg p-2 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Back to my learning">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <button className="rounded-lg p-2 hover:bg-ink-100 lg:hidden dark:hover:bg-ink-800" onClick={() => setDrawer(true)} aria-label="Course contents">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold sm:text-base">{pkg.course.title}</p>
            <p className="hidden text-xs text-ink-500 sm:block">
              {done} of {steps.length} steps complete {pkg.offline && '· offline copy'}
            </p>
          </div>
          <DownloadButton courseId={pkg.course.id} />
          <ThemeToggle />
          <ProgressRing value={pct} size={40} stroke={4}>
            <span className="text-[10px]">{pct}%</span>
          </ProgressRing>
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-80 shrink-0 overflow-y-auto border-r border-ink-100 dark:border-ink-800 lg:block">{sidebar}</aside>
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-ink-950/50" onClick={() => setDrawer(false)} />
            <aside className="absolute inset-y-0 left-0 w-[85%] max-w-sm overflow-y-auto bg-white shadow-2xl dark:bg-ink-900">{sidebar}</aside>
          </div>
        )}
        <main className="min-w-0 flex-1">
          <Routes>
            <Route index element={<Resume steps={steps} progress={progress.data} />} />
            <Route
              path="lesson/:lessonId"
              element={<LessonRoute pkg={pkg} steps={steps} progress={progress} locked={locked} />}
            />
            <Route path="quiz/:quizId" element={<QuizRoute pkg={pkg} steps={steps} progress={progress} locked={locked} />} />
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

const stepPath = (s: Step) => (s.type === 'lesson' ? `lesson/${s.item.id}` : `quiz/${s.item.id}`);

function Resume({ steps, progress }: { steps: Step[]; progress: ReturnType<typeof useCourseProgress>['data'] }) {
  if (!steps.length) return <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No content yet" body="This course doesn't have lessons yet. Check back soon!" />;
  if (!progress) return <FullPageSpinner />;
  const last = progress.lastLessonId ? steps.find((s) => s.item.id === progress.lastLessonId) : null;
  const target = (last && !isStepDone(last, progress) ? last : steps.find((s) => !isStepDone(s, progress))) ?? steps[0]!;
  return <Navigate to={stepPath(target)} replace />;
}

function useNeighbours(steps: Step[], id: string) {
  return useMemo(() => {
    const i = steps.findIndex((s) => s.item.id === id);
    return { index: i, prev: i > 0 ? steps[i - 1] : undefined, next: i >= 0 ? steps[i + 1] : undefined };
  }, [steps, id]);
}

function LessonRoute({ pkg, steps, progress, locked }: RouteProps) {
  const { lessonId = '' } = useParams();
  const { index, prev, next } = useNeighbours(steps, lessonId);
  const step = steps[index];
  if (!step || step.type !== 'lesson') return <Navigate to=".." replace />;
  if (locked(index)) return <LockedNotice />;
  return (
    <LessonView
      key={lessonId}
      pkg={pkg}
      lesson={step.item}
      module={pkg.modules.find((m) => m.id === step.moduleId)!}
      done={progress.data?.completedLessons.has(lessonId) ?? false}
      prevPath={prev ? `../${stepPath(prev)}` : null}
      nextPath={next ? `../${stepPath(next)}` : null}
      nextLabel={next ? (next.type === 'quiz' ? `Next: ${next.item.title}` : 'Next lesson') : null}
      onProgress={progress.refresh}
    />
  );
}

function QuizRoute({ pkg, steps, progress, locked }: RouteProps) {
  const { quizId = '' } = useParams();
  const { index, next } = useNeighbours(steps, quizId);
  const step = steps[index];
  if (!step || step.type !== 'quiz') return <Navigate to=".." replace />;
  if (locked(index)) return <LockedNotice />;
  return (
    <QuizView
      key={quizId}
      pkg={pkg}
      quiz={step.item}
      attempts={progress.data?.attempts.filter((a) => a.quiz_id === quizId) ?? []}
      best={progress.data?.quizBest.get(quizId)}
      nextPath={next ? `../${stepPath(next)}` : null}
      onProgress={progress.refresh}
    />
  );
}

type RouteProps = {
  pkg: NonNullable<ReturnType<typeof useCoursePackage>['data']>;
  steps: Step[];
  progress: ReturnType<typeof useCourseProgress>;
  locked: (i: number) => boolean;
};

function LockedNotice() {
  return (
    <div className="mx-auto max-w-xl px-5 py-20">
      <EmptyState
        icon={<Lock className="h-5 w-5" />}
        title="Complete the previous steps first"
        body="This course follows a guided path. Finish the earlier lessons and pass their quizzes to unlock this step."
      />
    </div>
  );
}

function Curriculum({
  pkg,
  steps,
  progress,
  locked,
  onClose,
}: {
  pkg: RouteProps['pkg'];
  steps: Step[];
  progress: ReturnType<typeof useCourseProgress>['data'];
  locked: (i: number) => boolean;
  onClose: () => void;
}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const modules = [...pkg.modules].sort((a, b) => a.position - b.position);
  const groups = [
    ...modules.map((m) => ({ id: m.id, title: m.title, steps: steps.filter((s) => s.moduleId === m.id) })),
    { id: 'final', title: 'Final assessment', steps: steps.filter((s) => s.moduleId === null) },
  ].filter((g) => g.steps.length);

  return (
    <div className="py-3">
      <div className="flex items-center justify-between px-4 pb-2 lg:hidden">
        <p className="font-bold">Course contents</p>
        <button onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
      {groups.map((g, gi) => {
        const doneCount = g.steps.filter((s) => isStepDone(s, progress)).length;
        const isCollapsed = collapsed[g.id];
        return (
          <div key={g.id} className="mb-1">
            <button
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-ink-50 dark:hover:bg-ink-900"
              onClick={() => setCollapsed((c) => ({ ...c, [g.id]: !isCollapsed }))}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  {g.id === 'final' ? 'Certificate' : `Module ${gi + 1}`}
                </span>
                <span className="block truncate text-sm font-semibold">{g.title}</span>
              </span>
              <span className="text-xs text-ink-400">
                {doneCount}/{g.steps.length}
              </span>
              <ChevronDown className={cn('h-4 w-4 text-ink-400 transition', !isCollapsed && 'rotate-180')} />
            </button>
            {!isCollapsed && (
              <ul>
                {g.steps.map((s) => {
                  const idx = steps.indexOf(s);
                  const isLocked = locked(idx);
                  const done = isStepDone(s, progress);
                  const active = location.pathname.endsWith(stepPath(s));
                  const Icon = s.type === 'lesson' ? (s.item.kind === 'video' ? PlayCircle : BookOpen) : s.item.kind === 'final' ? Award : FileQuestion;
                  const pending = s.type === 'quiz' && progress?.quizBest.get(s.item.id)?.pending;
                  return (
                    <li key={s.item.id}>
                      <Link
                        to={isLocked ? '#' : stepPath(s)}
                        aria-disabled={isLocked}
                        onClick={(e) => isLocked && e.preventDefault()}
                        className={cn(
                          'flex items-center gap-3 py-2 pl-6 pr-4 text-sm transition',
                          active ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950/50 dark:text-brand-200' : 'hover:bg-ink-50 dark:hover:bg-ink-900',
                          isLocked && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span
                          className={cn(
                            'grid h-6 w-6 shrink-0 place-items-center rounded-full border',
                            done ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 text-ink-400 dark:border-ink-700',
                          )}
                        >
                          {done ? <Check className="h-3.5 w-3.5" /> : isLocked ? <Lock className="h-3 w-3" /> : <Icon className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2">{s.item.title}</span>
                          <span className="text-xs text-ink-400">
                            {s.type === 'lesson'
                              ? `${s.item.duration_minutes} min`
                              : s.item.kind === 'final'
                                ? 'Final exam'
                                : s.item.kind === 'practice'
                                  ? 'Practice quiz'
                                  : 'Module quiz'}
                            {pending && ' · awaiting sync'}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DownloadButton({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { data: downloaded } = useQuery({ queryKey: ['downloaded', courseId], queryFn: async () => !!(await getPackage(courseId)), networkMode: 'always' });
  const [pct, setPct] = useState<number | null>(null);
  if (downloaded)
    return (
      <span className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300 sm:inline-flex" title="Available offline">
        <CheckCircle2 className="h-3.5 w-3.5" /> Offline ready
      </span>
    );
  return (
    <Button
      size="sm"
      variant="outline"
      className="hidden sm:inline-flex"
      icon={<CloudDownload className="h-4 w-4" />}
      loading={pct !== null}
      disabled={!navigator.onLine}
      onClick={async () => {
        setPct(0);
        try {
          await downloadCourse(courseId, setPct);
          toast.success('Course downloaded — you can now study it offline.');
          void qc.invalidateQueries({ queryKey: ['downloaded', courseId] });
          void qc.invalidateQueries({ queryKey: ['packages'] });
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setPct(null);
        }
      }}
    >
      {pct !== null ? `${pct}%` : 'Download'}
    </Button>
  );
}
