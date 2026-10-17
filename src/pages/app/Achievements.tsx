import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown, Flame, Medal, Trophy, Zap } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { useBadges, useMyBadges } from '@/hooks/queries';
import { supabase, must } from '@/lib/supabase';
import { Avatar, Card, EmptyState, PageHeader, Progress, Skeleton, Tabs } from '@/components/ui';
import { cn, formatDate, levelFromXp, timeAgo } from '@/lib/utils';

type Row = { user_id: string; full_name: string; username: string | null; avatar_url: string | null; xp: number; streak: number; rank: number };

const REASONS: Record<string, string> = {
  lesson_completed: 'Completed a lesson',
  quiz_submitted: 'Took a quiz',
  course_completed: 'Completed a course 🎓',
};

export function Achievements() {
  const { profile, session } = useAuth();
  const uid = session?.user.id;
  const { data: badges } = useBadges();
  const { data: mine } = useMyBadges();
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');

  const { data: board, isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: async () => must(await supabase.rpc('leaderboard', { p_period: period, p_limit: 50 })) as Row[],
  });
  const { data: history } = useQuery({
    queryKey: ['xp-history', uid],
    enabled: !!uid,
    queryFn: async () =>
      must(await supabase.from('xp_events').select('id, amount, reason, created_at').eq('user_id', uid!).order('created_at', { ascending: false }).limit(15)) as {
        id: number;
        amount: number;
        reason: string;
        created_at: string;
      }[],
  });

  if (!profile) return null;
  const lvl = levelFromXp(profile.xp);
  const earned = new Map(mine?.map((m) => [m.badge_code, m.awarded_at]));
  const myRank = board?.find((r) => r.user_id === uid);

  return (
    <>
      <PageHeader title="Achievements" subtitle="Earn XP for every lesson and quiz, keep your streak alive and collect badges." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <Zap className="h-6 w-6 text-amber-500" />
          <p className="mt-2 text-3xl font-extrabold">Level {lvl.level}</p>
          <Progress value={lvl.pct} tone="gold" className="mt-3" />
          <p className="mt-1.5 text-xs text-ink-500">
            {lvl.need - lvl.into} XP to level {lvl.level + 1} · {profile.xp.toLocaleString()} XP total
          </p>
        </Card>
        <Card className="p-5">
          <Flame className="h-6 w-6 text-orange-500" />
          <p className="mt-2 text-3xl font-extrabold">{profile.streak} days</p>
          <p className="mt-1.5 text-xs text-ink-500">Current streak · best {profile.longest_streak} days</p>
        </Card>
        <Card className="p-5">
          <Medal className="h-6 w-6 text-violet-500" />
          <p className="mt-2 text-3xl font-extrabold">
            {earned.size}/{badges?.length ?? 0}
          </p>
          <p className="mt-1.5 text-xs text-ink-500">Badges collected</p>
        </Card>
      </div>

      <h2 className="mb-4 mt-10 text-xl font-bold">Badges</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {badges?.map((b) => {
          const at = earned.get(b.code);
          return (
            <Card key={b.code} className={cn('p-4 text-center', !at && 'opacity-60')}>
              <div className={cn('mx-auto grid h-14 w-14 place-items-center rounded-2xl text-3xl', !at && 'grayscale')} style={{ background: `${b.color}1f` }}>
                {b.icon}
              </div>
              <p className="mt-3 text-sm font-bold">{b.name}</p>
              <p className="mt-0.5 text-xs text-ink-500">{b.description}</p>
              <p className="mt-2 text-[11px] font-medium text-brand-600">{at ? `Earned ${formatDate(at)}` : 'Locked'}</p>
            </Card>
          );
        })}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Trophy className="h-5 w-5 text-amber-500" /> Leaderboard
            </h2>
            <Tabs
              value={period}
              onChange={setPeriod}
              tabs={[
                { value: 'week', label: 'This week' },
                { value: 'month', label: '30 days' },
                { value: 'all', label: 'All time' },
              ]}
            />
          </div>
          <Card className="overflow-hidden">
            {isLoading && <Skeleton className="m-4 h-40" />}
            {!isLoading && !board?.length && (
              <div className="p-6">
                <EmptyState title="No one on the board yet" body="Complete a lesson to be the first!" />
              </div>
            )}
            <ol className="divide-y divide-ink-100 dark:divide-ink-800">
              {board?.map((r) => (
                <li key={r.user_id} className={cn('flex items-center gap-3 px-4 py-3', r.user_id === uid && 'bg-brand-50/70 dark:bg-brand-950/40')}>
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                      r.rank === 1 ? 'bg-amber-400 text-amber-950' : r.rank === 2 ? 'bg-ink-200 text-ink-800' : r.rank === 3 ? 'bg-orange-300 text-orange-950' : 'text-ink-500',
                    )}
                  >
                    {r.rank === 1 ? <Crown className="h-4 w-4" /> : r.rank}
                  </span>
                  <Avatar name={r.full_name} url={r.avatar_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {r.full_name} {r.user_id === uid && <span className="text-xs text-brand-600">(you)</span>}
                    </p>
                    <p className="text-xs text-ink-500">
                      {r.username ? `@${r.username}` : ''} {r.streak > 0 && `· 🔥 ${r.streak}`}
                    </p>
                  </div>
                  <span className="text-sm font-bold">{Number(r.xp).toLocaleString()} XP</span>
                </li>
              ))}
            </ol>
          </Card>
          {profile.role === 'student' && !myRank && board && board.length > 0 && (
            <p className="mt-3 text-sm text-ink-500">Earn XP this {period === 'all' ? 'season' : period} to appear on the leaderboard.</p>
          )}
        </section>
        <section>
          <h2 className="mb-4 text-xl font-bold">Recent XP</h2>
          <Card className="divide-y divide-ink-100 dark:divide-ink-800">
            {!history?.length && <p className="p-5 text-sm text-ink-500">No XP yet — your first lesson earns 10 XP.</p>}
            {history?.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  {REASONS[h.reason] ?? h.reason}
                  <span className="block text-xs text-ink-400">{timeAgo(h.created_at)}</span>
                </span>
                <span className="font-bold text-amber-600">+{h.amount}</span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
