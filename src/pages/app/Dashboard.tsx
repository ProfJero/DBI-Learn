import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Award, BookOpen, Code2, Flame, Megaphone, MessageCircleQuestion, Sparkles, Target, Trophy, Zap, KeyRound } from 'lucide-react';
import { WelcomeTour } from '@/components/learn/WelcomeTour';
import { useAuth } from '@/auth/AuthProvider';
import { useCatalog, useMyCertificates, useMyEnrollments, useMyBadges, useBadges } from '@/hooks/queries';
import { supabase, must } from '@/lib/supabase';
import { CourseCard, CourseCover } from '@/components/CourseCard';
import { Avatar, Card, EmptyState, LinkButton, Progress, Skeleton } from '@/components/ui';
import { cn, levelFromXp, timeAgo } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Dashboard() {
  const { profile, privateProfile, session } = useAuth();
  const { data: enrollments, isLoading } = useMyEnrollments();
  const { data: catalog } = useCatalog();
  const { data: certs } = useMyCertificates();
  const { data: badges } = useBadges();
  const { data: myBadges } = useMyBadges();
  const uid = session?.user.id;

  const { data: weekXp } = useQuery({
    queryKey: ['week-xp', uid],
    enabled: !!uid,
    queryFn: async () => {
      const since = new Date(Date.now() - 6 * 86400000);
      since.setHours(0, 0, 0, 0);
      const rows = must(await supabase.from('xp_events').select('amount, created_at').eq('user_id', uid!).gte('created_at', since.toISOString())) as {
        amount: number;
        created_at: string;
      }[];
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(since.getTime() + i * 86400000);
        return { label: d.toLocaleDateString('en', { weekday: 'narrow' }), key: d.toDateString(), xp: 0 };
      });
      rows.forEach((r) => {
        const day = days.find((d) => d.key === new Date(r.created_at).toDateString());
        if (day) day.xp += r.amount;
      });
      return days;
    },
  });

  const { data: announcements } = useQuery({
    queryKey: ['announcements-latest'],
    queryFn: async () =>
      must(await supabase.from('announcements').select('id, title, body, created_at, pinned').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3)) as {
        id: string;
        title: string;
        body: string;
        created_at: string;
      }[],
  });

  if (!profile) return null;
  const lvl = levelFromXp(profile.xp);
  const active = enrollments?.filter((e) => e.status === 'active') ?? [];
  const current = active[0];
  const enrolledIds = new Set(enrollments?.map((e) => e.course_id));
  const recommended = catalog?.filter((c) => !enrolledIds.has(c.id)).slice(0, 3) ?? [];
  const todayXp = weekXp?.[6]?.xp ?? 0;
  const goalXp = Math.max(20, Math.round(profile.daily_goal_minutes * 2));
  const activeToday = profile.last_active_date === new Date().toISOString().slice(0, 10);
  const maxDay = Math.max(goalXp, ...(weekXp?.map((d) => d.xp) ?? [0]));

  return (
    <div className="space-y-8">
      {profile.role === 'student' && <WelcomeTour uid={profile.id} />}
      {privateProfile?.must_change_password && (
        <Link to="/app/settings#security" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <KeyRound className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-sm">
            <strong>Secure your account:</strong> you're using a temporary password. Set your own password now.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <Card className="relative flex-1 overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-brand-400/25 to-sky-500/25 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <Avatar name={profile.full_name} url={profile.avatar_url} size={56} />
            <div>
              <p className="text-sm text-ink-500">{greeting()},</p>
              <h1 className="text-2xl font-extrabold tracking-tight">{profile.full_name.split(' ')[0]} 👋</h1>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-3 gap-3">
            <Metric icon={<Flame className={cn('h-5 w-5', activeToday ? 'text-orange-500' : 'text-ink-300')} />} value={profile.streak} label="day streak" />
            <Metric icon={<Zap className="h-5 w-5 text-amber-500" />} value={profile.xp.toLocaleString()} label="total XP" />
            <Metric icon={<Trophy className="h-5 w-5 text-violet-500" />} value={`Lv ${lvl.level}`} label={`${lvl.into}/${lvl.need} XP`} />
          </div>
          <Progress value={lvl.pct} className="relative mt-4" tone="gold" />
        </Card>

        <Card className="p-6 lg:w-96">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <Target className="h-4 w-4 text-brand-500" /> Daily goal
            </h2>
            <span className="text-sm font-semibold text-ink-500">
              {todayXp}/{goalXp} XP
            </span>
          </div>
          <Progress value={(todayXp / goalXp) * 100} className="mt-3" />
          <p className="mt-2 text-xs text-ink-500">
            {todayXp >= goalXp ? "Goal smashed! You're on fire 🔥" : activeToday ? 'Nice start — keep going to hit your goal.' : 'Complete a lesson today to keep your streak alive.'}
          </p>
          <div className="mt-5 flex h-24 items-end gap-2" aria-label="XP earned in the last 7 days">
            {(weekXp ?? Array.from({ length: 7 }, (_, i) => ({ label: '', key: String(i), xp: 0 }))).map((d, i) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={cn('w-full rounded-md transition-all', i === 6 ? 'bg-brand-500' : 'bg-brand-200 dark:bg-brand-900')}
                    style={{ height: `${Math.max(6, (d.xp / maxDay) * 100)}%` }}
                    title={`${d.xp} XP`}
                  />
                </div>
                <span className="text-[10px] font-medium text-ink-400">{d.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Big, obvious shortcuts — the two things younger learners most often look for */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/app/practice" className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 p-5 text-white shadow-sm transition hover:shadow-lift">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20">
            <Code2 className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-bold">Practice Lab</span>
            <span className="block text-sm text-white/85">Write real code and complete challenges</span>
          </span>
          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
        </Link>
        <Link to="/app/questions" className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 p-5 text-white shadow-sm transition hover:shadow-lift">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/20">
            <MessageCircleQuestion className="h-6 w-6" />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-bold">Ask a teacher</span>
            <span className="block text-sm text-white/85">Stuck? Get help on any lesson</span>
          </span>
          <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Continue learning */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Continue learning</h2>
          {active.length > 1 && (
            <Link to="/app/courses" className="text-sm font-semibold text-brand-600 hover:underline">
              All my courses →
            </Link>
          )}
        </div>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : current ? (
          <Card className="flex flex-col overflow-hidden sm:flex-row">
            <CourseCover course={current.course} className="sm:w-72 sm:shrink-0" />
            <div className="flex flex-1 flex-col justify-center gap-3 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{current.course.category?.name}</p>
              <h3 className="text-xl font-bold">{current.course.title}</h3>
              <div>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-ink-500">Last active {timeAgo(current.last_activity_at)}</span>
                  <span className="font-semibold">{current.progress}%</span>
                </div>
                <Progress value={current.progress} />
              </div>
              <LinkButton to={`/app/learn/${current.course.slug}`} className="self-start" icon={<BookOpen className="h-4 w-4" />}>
                {current.progress ? 'Resume' : 'Start'}
              </LinkButton>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="Start your first course"
            body="Pick a track that excites you. Every course is free and earns you a verifiable certificate."
            action={<LinkButton to="/app/catalog">Explore courses</LinkButton>}
          />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-bold">Recommended for you</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recommended.map((c) => (
              <CourseCard key={c.id} course={c} to={`/app/catalog/${c.slug}`} lessonCount={c.lessons?.[0]?.count} />
            ))}
          </div>
        </section>
        <aside className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Badges</h2>
              <Link to="/app/achievements" className="text-xs font-semibold text-brand-600">
                View all
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {badges?.map((b) => {
                const earned = myBadges?.some((m) => m.badge_code === b.code);
                return (
                  <div
                    key={b.code}
                    title={`${b.name}: ${b.description}`}
                    className={cn('grid aspect-square place-items-center rounded-xl text-xl', earned ? '' : 'opacity-30 grayscale')}
                    style={{ background: earned ? `${b.color}22` : undefined }}
                  >
                    {b.icon}
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <Award className="h-4 w-4 text-gold-600" /> Certificates
              </h2>
              <span className="text-2xl font-extrabold">{certs?.length ?? 0}</span>
            </div>
            <p className="mt-1 text-xs text-ink-500">Complete a course to earn a verifiable certificate.</p>
            {!!certs?.length && (
              <LinkButton to="/app/certificates" variant="outline" size="sm" className="mt-4 w-full">
                View certificates
              </LinkButton>
            )}
          </Card>
          {!!announcements?.length && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <Megaphone className="h-4 w-4 text-sky-600" /> Announcements
              </h2>
              <ul className="mt-3 space-y-3">
                {announcements.map((a) => (
                  <li key={a.id}>
                    <Link to="/app/announcements" className="block hover:text-brand-600">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <p className="line-clamp-2 text-xs text-ink-500">{a.body}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
      {icon}
      <p className="mt-1.5 text-xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-ink-500">{label}</p>
    </div>
  );
}
