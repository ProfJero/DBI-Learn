import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileQuestion } from 'lucide-react';
import { supabase, must } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { Button, Card, FullPageSpinner, PageHeader, Select, StatCard } from '@/components/ui';
import { downloadText, formatDate, isAdminRole, toCsv } from '@/lib/utils';
import type { QuestionResult } from '@/lib/types';
import { useOverview } from './Overview';

type Attempt = { id: string; quiz_id: string; user_id: string; percent: number; passed: boolean; submitted_at: string; submitted_offline: boolean; results: QuestionResult[]; quiz: { title: string; kind: string } };

const axis = { fontSize: 11, fill: '#8592a8' };

export function Reports() {
  const { profile } = useAuth();
  const admin = isAdminRole(profile?.role);
  const { data: overview } = useOverview();
  const { data: courses } = useQuery({
    queryKey: ['report-courses', profile?.id],
    queryFn: async () => {
      let q = supabase.from('courses').select('id, title, slug').order('title');
      if (!admin) q = q.eq('instructor_id', profile!.id);
      return must(await q) as { id: string; title: string; slug: string }[];
    },
  });
  const [courseId, setCourseId] = useState('');
  const selected = courseId || courses?.[0]?.id || '';

  const { data: attempts, isLoading } = useQuery({
    queryKey: ['report-attempts', selected],
    enabled: !!selected,
    queryFn: async () => must(await supabase.from('quiz_attempts').select('id, quiz_id, user_id, percent, passed, submitted_at, submitted_offline, results, quiz:quizzes(title, kind)').eq('course_id', selected).order('submitted_at', { ascending: false }).limit(5000)) as unknown as Attempt[],
  });
  const { data: questions } = useQuery({
    queryKey: ['report-questions', selected],
    enabled: !!selected,
    queryFn: async () => must(await supabase.from('questions').select('id, prompt, quiz_id, quizzes!inner(course_id)').eq('quizzes.course_id', selected)) as { id: string; prompt: string; quiz_id: string }[],
  });
  const { data: lessonStats } = useQuery({
    queryKey: ['report-lessons', selected],
    enabled: !!selected,
    queryFn: async () => {
      const [lessons, progress, enrolled] = await Promise.all([
        supabase.from('lessons').select('id, title, position, module:modules(position)').eq('course_id', selected).then(must),
        supabase.from('lesson_progress').select('lesson_id').eq('course_id', selected).then(must),
        supabase.from('enrollments').select('user_id', { count: 'exact', head: true }).eq('course_id', selected),
      ]);
      const counts = new Map<string, number>();
      (progress as { lesson_id: string }[]).forEach((p) => counts.set(p.lesson_id, (counts.get(p.lesson_id) ?? 0) + 1));
      const sorted = (lessons as unknown as { id: string; title: string; position: number; module: { position: number } }[]).sort((a, b) => a.module.position - b.module.position || a.position - b.position);
      return { enrolled: enrolled.count ?? 0, rows: sorted.map((l, i) => ({ name: `${i + 1}`, title: l.title, completed: counts.get(l.id) ?? 0 })) };
    },
  });

  const quizStats = useMemo(() => {
    const m = new Map<string, { title: string; kind: string; attempts: number; learners: Set<string>; passed: Set<string>; total: number; offline: number }>();
    attempts?.forEach((a) => {
      const s = m.get(a.quiz_id) ?? { title: a.quiz.title, kind: a.quiz.kind, attempts: 0, learners: new Set(), passed: new Set(), total: 0, offline: 0 };
      s.attempts++;
      s.total += a.percent;
      s.learners.add(a.user_id);
      if (a.passed) s.passed.add(a.user_id);
      if (a.submitted_offline) s.offline++;
      m.set(a.quiz_id, s);
    });
    return [...m.entries()].map(([id, s]) => ({ id, ...s, avg: Math.round(s.total / s.attempts), passRate: Math.round((100 * s.passed.size) / s.learners.size) }));
  }, [attempts]);

  // Hardest questions: lowest share of correct answers.
  const hardest = useMemo(() => {
    const m = new Map<string, { right: number; total: number }>();
    attempts?.forEach((a) =>
      a.results?.forEach((r) => {
        const s = m.get(r.question_id) ?? { right: 0, total: 0 };
        s.total++;
        if (r.correct) s.right++;
        m.set(r.question_id, s);
      }),
    );
    const prompts = new Map(questions?.map((q) => [q.id, q.prompt]));
    return [...m.entries()]
      .filter(([, s]) => s.total >= 3)
      .map(([id, s]) => ({ id, prompt: prompts.get(id) ?? '—', rate: Math.round((100 * s.right) / s.total), total: s.total }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 8);
  }, [attempts, questions]);

  const course = courses?.find((c) => c.id === selected);
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Understand where learners succeed and where they struggle."
        actions={
          <Select value={selected} onChange={(e) => setCourseId(e.target.value)} className="w-72" aria-label="Course">
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        }
      />
      {overview && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <StatCard label="Enrollments" value={overview.enrollments} />
          <StatCard label="Completions" value={overview.completions} tone="blue" />
          <StatCard label="Certificates" value={overview.certificates} tone="amber" />
          <StatCard label="Quiz attempts" value={overview.quiz_attempts} tone="purple" />
        </div>
      )}
      {isLoading ? (
        <FullPageSpinner />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Lesson completion funnel</h2>
              <span className="text-xs text-ink-500">{lessonStats?.enrolled ?? 0} enrolled</span>
            </div>
            <p className="text-xs text-ink-500">Learners who completed each lesson, in course order. Sharp drops show where learners stop.</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <BarChart data={lessonStats?.rows ?? []} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#8592a833" vertical={false} />
                  <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={false} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                    labelFormatter={(_l, p) => (p?.[0]?.payload as { title?: string })?.title ?? ''}
                  />
                  <Bar dataKey="completed" name="Completed" fill="#03c14b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-5">
              <h2 className="font-bold">Quiz performance</h2>
              <Button
                size="sm"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                disabled={!attempts?.length}
                onClick={() =>
                  downloadText(
                    `${course?.slug ?? 'course'}-quiz-attempts.csv`,
                    toCsv((attempts ?? []).map((a) => ({ quiz: a.quiz.title, user_id: a.user_id, percent: a.percent, passed: a.passed, offline: a.submitted_offline, submitted: a.submitted_at }))),
                  )
                }
              >
                Export attempts
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500 dark:bg-ink-800/50">
                <tr>
                  <th className="px-5 py-3">Quiz</th>
                  <th className="px-5 py-3 text-right">Learners</th>
                  <th className="px-5 py-3 text-right">Attempts</th>
                  <th className="px-5 py-3 text-right">Avg score</th>
                  <th className="px-5 py-3 text-right">Pass rate</th>
                  <th className="px-5 py-3 text-right">Offline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                {quizStats.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3 font-medium">{s.title}</td>
                    <td className="px-5 py-3 text-right">{s.learners.size}</td>
                    <td className="px-5 py-3 text-right">{s.attempts}</td>
                    <td className="px-5 py-3 text-right">{s.avg}%</td>
                    <td className="px-5 py-3 text-right">{s.passRate}%</td>
                    <td className="px-5 py-3 text-right">{s.offline}</td>
                  </tr>
                ))}
                {!quizStats.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-ink-500">
                      No quiz attempts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <FileQuestion className="h-4 w-4 text-red-500" /> Most-missed questions
            </h2>
            <p className="text-xs text-ink-500">Questions with the lowest correct-answer rate (min. 3 answers). Consider improving the related lesson.</p>
            <ul className="mt-4 space-y-3">
              {!hardest.length && <li className="text-sm text-ink-500">Not enough data yet.</li>}
              {hardest.map((h) => (
                <li key={h.id} className="flex items-center gap-4">
                  <span className={`w-12 shrink-0 text-right text-sm font-bold ${h.rate < 50 ? 'text-red-500' : 'text-amber-600'}`}>{h.rate}%</span>
                  <span className="line-clamp-2 flex-1 text-sm">{h.prompt}</span>
                  <span className="text-xs text-ink-400">{h.total} answers</span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-xs text-ink-400">Report generated {formatDate(new Date(), { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
      )}
    </>
  );
}
