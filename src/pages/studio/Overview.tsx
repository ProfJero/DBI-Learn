import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, BookOpen, CheckCircle2, ClipboardCheck, GraduationCap, LifeBuoy, Plus, Target, UserPlus, Users, Activity } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { Card, FullPageSpinner, LinkButton, PageHeader, StatCard } from '@/components/ui';
import { isAdminRole, formatDate } from '@/lib/utils';

export interface Overview {
  students: number;
  instructors: number;
  admins: number;
  courses_published: number;
  courses_draft: number;
  courses_review: number;
  enrollments: number;
  completions: number;
  certificates: number;
  avg_quiz_score: number;
  quiz_attempts: number;
  active_learners_7d: number;
  open_tickets: number;
  pending_applications: number;
  signups_30d: { day: string; count: number }[];
  enrollments_30d: { day: string; count: number }[];
  top_courses: { id: string; title: string; slug: string; enrollment_count: number; completions: number; avg_score: number; rating_avg: number }[];
  by_category: { name: string; enrollments: number }[];
}

export function useOverview() {
  return useQuery({ queryKey: ['staff-overview'], queryFn: async () => must(await supabase.rpc('staff_overview')) as Overview, refetchInterval: 120_000 });
}

const axis = { fontSize: 11, fill: '#8592a8' };

export function Overview() {
  const { profile } = useAuth();
  const admin = isAdminRole(profile?.role);
  const { data, isLoading } = useOverview();
  if (isLoading || !data) return <FullPageSpinner />;
  const completionRate = data.enrollments ? Math.round((data.completions / data.enrollments) * 100) : 0;
  const series = data.enrollments_30d.map((e, i) => ({ day: formatDate(e.day, { day: 'numeric', month: 'short' }), enrollments: e.count, signups: data.signups_30d[i]?.count ?? 0 }));

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile?.full_name.split(' ')[0]}`}
        subtitle={admin ? 'Here is how DBI Learn is doing across the platform.' : 'Here is how your courses are doing.'}
        actions={
          <>
            {admin && (
              <LinkButton to="/admin/staff" variant="outline" icon={<UserPlus className="h-4 w-4" />}>
                Add staff
              </LinkButton>
            )}
            <LinkButton to="/admin/courses?new=1" icon={<Plus className="h-4 w-4" />}>
              New course
            </LinkButton>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={admin ? 'Students' : 'Your learners'} value={data.students.toLocaleString()} icon={<GraduationCap className="h-5 w-5" />} hint={`${data.active_learners_7d} active this week`} />
        <StatCard label="Enrollments" value={data.enrollments.toLocaleString()} icon={<Users className="h-5 w-5" />} tone="blue" hint={`${completionRate}% completion rate`} />
        <StatCard label="Certificates issued" value={data.certificates.toLocaleString()} icon={<Award className="h-5 w-5" />} tone="amber" hint={`${data.completions} course completions`} />
        <StatCard label="Average quiz score" value={`${data.avg_quiz_score}%`} icon={<Target className="h-5 w-5" />} tone="purple" hint={`${data.quiz_attempts.toLocaleString()} attempts`} />
      </div>

      {admin && (data.open_tickets > 0 || data.pending_applications > 0 || data.courses_review > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {data.courses_review > 0 && (
            <Link to="/admin/courses?status=review" className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-medium text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
              <ClipboardCheck className="h-5 w-5" /> {data.courses_review} course{data.courses_review > 1 && 's'} awaiting review
            </Link>
          )}
          {data.pending_applications > 0 && (
            <Link to="/admin/applications" className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-medium text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              <UserPlus className="h-5 w-5" /> {data.pending_applications} instructor application{data.pending_applications > 1 && 's'}
            </Link>
          )}
          {data.open_tickets > 0 && (
            <Link to="/admin/support" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <LifeBuoy className="h-5 w-5" /> {data.open_tickets} open support request{data.open_tickets > 1 && 's'}
            </Link>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <Activity className="h-4 w-4 text-brand-500" /> Last 30 days
            </h2>
            <div className="flex gap-4 text-xs text-ink-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500" /> Enrollments</span>
              {admin && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-600" /> New students</span>}
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gEnr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#03c14b" stopOpacity={0.3} />
                    <stop offset="1" stopColor="#03c14b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#8592a833" vertical={false} />
                <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} interval={6} />
                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #eceef2', fontSize: 12 }} />
                <Area type="monotone" dataKey="enrollments" name="Enrollments" stroke="#03c14b" strokeWidth={2} fill="url(#gEnr)" />
                {admin && <Area type="monotone" dataKey="signups" name="New students" stroke="#0b7be8" strokeWidth={2} fill="transparent" />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-bold">Enrollments by track</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer>
              <BarChart data={data.by_category} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={axis} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#8592a811' }} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="enrollments" name="Enrollments" fill="#0b7be8" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <BookOpen className="h-4 w-4 text-brand-500" /> Course performance
          </h2>
          <span className="text-xs text-ink-500">
            {data.courses_published} published · {data.courses_draft} in draft/review
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500 dark:bg-ink-800/50">
              <tr>
                <th className="px-5 py-3">Course</th>
                <th className="px-5 py-3 text-right">Learners</th>
                <th className="px-5 py-3 text-right">Completed</th>
                <th className="px-5 py-3 text-right">Avg quiz</th>
                <th className="px-5 py-3 text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {data.top_courses.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/admin/courses/${c.id}`} className="hover:text-brand-600">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right">{c.enrollment_count}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-brand-500" /> {c.completions}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">{c.avg_score}%</td>
                  <td className="px-5 py-3 text-right">{Number(c.rating_avg) ? `★ ${Number(c.rating_avg).toFixed(1)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
