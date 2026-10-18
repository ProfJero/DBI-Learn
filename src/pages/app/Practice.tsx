import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, FolderOpen, Trophy, WifiOff } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Card, PageHeader, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LANGUAGES, languageById, type LangId } from '@/features/codelab/languages';
import { CHALLENGES } from '@/features/codelab/challenges';
import { getCompleted, listProjects } from '@/features/codelab/projects';

export function Practice() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const [filter, setFilter] = useState<LangId | 'all'>('all');

  const { data: done } = useQuery({
    queryKey: ['codelab-done', uid],
    networkMode: 'always',
    queryFn: async () => {
      const local = await getCompleted(uid);
      if (navigator.onLine) {
        const { data } = await supabase.from('practice_completions').select('challenge_id').eq('user_id', uid);
        data?.forEach((r) => local.add(r.challenge_id as string));
      }
      return local;
    },
  });
  const { data: projects } = useQuery({ queryKey: ['codelab-projects', uid], networkMode: 'always', queryFn: () => listProjects(uid) });

  const list = CHALLENGES.filter((c) => filter === 'all' || c.lang === filter);
  const doneCount = CHALLENGES.filter((c) => done?.has(c.id)).length;

  return (
    <>
      <PageHeader title="Practice Lab" subtitle="Learn by doing. Write real code, run it instantly and complete challenges for XP." />

      <Card className="mb-6 overflow-hidden bg-gradient-to-br from-brand-500 to-sky-600 p-6 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-white/80">Your coding journey</p>
            <p className="mt-1 text-3xl font-extrabold">
              {doneCount} / {CHALLENGES.length} challenges
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/90">
              <WifiOff className="h-4 w-4" /> Works offline — Python needs internet only the first time.
            </p>
          </div>
          <Trophy className="hidden h-16 w-16 text-white/30 sm:block" />
        </div>
        <Progress value={(doneCount / CHALLENGES.length) * 100} className="mt-4 bg-white/25" />
      </Card>

      <h2 className="mb-3 text-lg font-bold">Start coding</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {LANGUAGES.map((l) => (
          <Link key={l.id} to={`/app/practice/code?lang=${l.id}`} className="group">
            <Card className="flex h-full flex-col p-4 transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
              <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: `${l.color}22` }} aria-hidden>
                {l.emoji}
              </span>
              <p className="mt-3 font-bold">{l.label}</p>
              <p className="mt-1 flex-1 text-sm text-ink-500">{l.blurb}</p>
              <span className="mt-3 inline-flex items-center text-sm font-semibold text-brand-600">
                Open editor <ChevronRight className="h-4 w-4" />
              </span>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Challenges</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by language">
          {(['all', 'web', 'python', 'javascript', 'sql'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition',
                filter === f ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300',
              )}
            >
              {f === 'all' ? 'All' : `${languageById(f).emoji} ${f === 'web' ? 'Web' : languageById(f).label.split(' ')[0]}`}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const isDone = done?.has(c.id);
          const l = languageById(c.lang);
          return (
            <Link key={c.id} to={`/app/practice/challenge/${c.id}`}>
              <Card className={cn('flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lift', isDone && 'border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-950/20')}>
                <span className="text-2xl" aria-hidden>
                  {l.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.title}</p>
                  <p className="text-xs text-ink-500">
                    {c.level} · {c.xp} XP
                  </p>
                </div>
                {isDone ? <CheckCircle2 className="h-6 w-6 text-brand-500" aria-label="Completed" /> : <ChevronRight className="h-5 w-5 text-ink-300" />}
              </Card>
            </Link>
          );
        })}
      </div>

      {!!projects?.length && (
        <>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <FolderOpen className="h-5 w-5 text-ink-400" /> My projects
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.slice(0, 9).map((p) => (
              <Link key={p.id} to={`/app/practice/code?lang=${p.lang}&project=${p.id}`}>
                <Card className="flex items-center gap-3 p-4 hover:shadow-lift">
                  <span className="text-2xl">{languageById(p.lang).emoji}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-ink-500">Edited {new Date(p.updated_at).toLocaleDateString()}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
