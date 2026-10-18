import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Globe2, HandHelping, Lock, MessageCircleQuestion, Send, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must, friendlyError } from '@/lib/supabase';
import { Avatar, Badge, Button, Card, EmptyState, Field, FullPageSpinner, Input, Textarea } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { cn, ROLE_LABEL, timeAgo } from '@/lib/utils';
import type { Role } from '@/lib/types';

type Person = { id: string; full_name: string; avatar_url: string | null; role: Role };
export type QuestionRow = {
  id: string;
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  asker_id: string;
  title: string;
  body: string;
  visibility: 'public' | 'private';
  status: 'open' | 'answered' | 'closed';
  featured: boolean;
  vote_count: number;
  answer_count: number;
  answered_at: string | null;
  created_at: string;
  asker: Person;
  course: { title: string; slug: string } | null;
  module: { title: string } | null;
  lesson: { title: string } | null;
};
type AnswerRow = { id: string; body: string; from_staff: boolean; created_at: string; author_id: string; author: Person };

export const QUESTION_SELECT =
  '*, asker:profiles!course_questions_asker_id_fkey(id,full_name,avatar_url,role), course:courses(title,slug), module:modules(title), lesson:lessons(title)';

export const STATUS_LABEL: Record<QuestionRow['status'], { label: string; tone: 'amber' | 'green' | 'gray' }> = {
  open: { label: 'Waiting for a teacher', tone: 'amber' },
  answered: { label: 'Answered', tone: 'green' },
  closed: { label: 'Closed', tone: 'gray' },
};

/** Big, friendly two-way choice: who can see my question. */
function VisibilityPicker({ value, onChange }: { value: 'public' | 'private'; onChange: (v: 'public' | 'private') => void }) {
  const opts = [
    { v: 'public' as const, icon: Globe2, title: 'Everyone in the class', body: 'Classmates can see it and learn from the answer.' },
    { v: 'private' as const, icon: Lock, title: 'Only my teachers', body: 'Just you and the course teachers will see it.' },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Who can see this question">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'flex items-start gap-3 rounded-xl border-2 p-3 text-left transition',
            value === o.v ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-ink-100 hover:border-ink-200 dark:border-ink-800',
          )}
        >
          <o.icon className={cn('mt-0.5 h-5 w-5 shrink-0', value === o.v ? 'text-brand-600' : 'text-ink-400')} />
          <span>
            <span className="block text-sm font-semibold">{o.title}</span>
            <span className="block text-xs text-ink-500">{o.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function AskQuestionForm({
  courseId,
  moduleId,
  lessonId,
  courses,
  onDone,
}: {
  courseId?: string;
  moduleId?: string | null;
  lessonId?: string | null;
  courses?: { id: string; title: string }[];
  onDone?: (id: string) => void;
}) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [course, setCourse] = useState(courseId ?? courses?.[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const ask = useMutation({
    mutationFn: async () => {
      if (!course) throw new Error('Choose a course first.');
      if (title.trim().length < 5) throw new Error('Write your question in a few more words.');
      const row = must(
        await supabase
          .from('course_questions')
          .insert({ course_id: course, module_id: moduleId ?? null, lesson_id: lessonId ?? null, asker_id: session!.user.id, title: title.trim(), body: body.trim(), visibility })
          .select('id')
          .single(),
      ) as { id: string };
      return row.id;
    },
    onSuccess: (id) => {
      toast.success(visibility === 'private' ? 'Sent to your teachers' : 'Question posted');
      setTitle('');
      setBody('');
      void qc.invalidateQueries({ queryKey: ['questions'] });
      onDone?.(id);
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        ask.mutate();
      }}
    >
      {!courseId && courses && (
        <Field label="Which course is it about?" htmlFor="ask-course">
          <select id="ask-course" className="h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm dark:border-ink-700 dark:bg-ink-900" value={course} onChange={(e) => setCourse(e.target.value)}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Your question" htmlFor="ask-title" hint="One clear sentence, e.g. “Why does my image not show on the page?”">
        <Input id="ask-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Type your question…" />
      </Field>
      <Field label="Explain more (optional)" htmlFor="ask-body" hint="Say what you tried. You can paste code between ``` marks.">
        <Textarea id="ask-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <VisibilityPicker value={visibility} onChange={setVisibility} />
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={ask.isPending} icon={<Send className="h-4 w-4" />}>
        Send question
      </Button>
    </form>
  );
}

export function QuestionCard({ q, to }: { q: QuestionRow; to: string }) {
  const st = STATUS_LABEL[q.status];
  return (
    <Link to={to} className="block">
      <Card className="flex gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
        <div className="hidden w-14 shrink-0 flex-col items-center rounded-xl bg-ink-50 py-2 text-center dark:bg-ink-800 sm:flex">
          <span className="text-lg font-bold">{q.vote_count + 1}</span>
          <span className="text-[10px] leading-tight text-ink-500">asking</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={st.tone}>{st.label}</Badge>
            {q.visibility === 'private' && (
              <Badge tone="gray">
                <Lock className="mr-1 inline h-3 w-3" />
                Private
              </Badge>
            )}
            {q.featured && (
              <Badge tone="blue">
                <Star className="mr-1 inline h-3 w-3" />
                Top question
              </Badge>
            )}
          </div>
          <p className="font-semibold leading-snug">{q.title}</p>
          <p className="mt-1 truncate text-xs text-ink-500">
            {q.course?.title}
            {q.lesson ? ` · ${q.lesson.title}` : q.module ? ` · ${q.module.title}` : ''} · {q.asker?.full_name} · {timeAgo(q.created_at)}
            {q.answer_count > 0 && ` · ${q.answer_count} ${q.answer_count === 1 ? 'reply' : 'replies'}`}
          </p>
        </div>
      </Card>
    </Link>
  );
}

/** Questions on the lesson the learner is reading, plus an inline "ask" form. */
export function LessonQuestions({ courseId, moduleId, lessonId }: { courseId: string; moduleId: string; lessonId: string }) {
  const [asking, setAsking] = useState(false);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['questions', 'lesson', lessonId],
    staleTime: 0,
    queryFn: async () =>
      must(await supabase.from('course_questions').select(QUESTION_SELECT).eq('lesson_id', lessonId).order('featured', { ascending: false }).order('vote_count', { ascending: false }).limit(20)) as QuestionRow[],
  });
  return (
    <section className="mt-10" aria-labelledby="lesson-qa">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="lesson-qa" className="flex items-center gap-2 text-lg font-bold">
          <MessageCircleQuestion className="h-5 w-5 text-sky-500" /> Ask a teacher
        </h2>
        {!asking && (
          <Button size="sm" variant="blue" onClick={() => setAsking(true)}>
            Ask a question
          </Button>
        )}
      </div>
      {asking && (
        <Card className="mb-4 p-4">
          <AskQuestionForm courseId={courseId} moduleId={moduleId} lessonId={lessonId} onDone={(id) => navigate(`/app/questions/${id}`)} />
        </Card>
      )}
      {isError && <p className="text-sm text-ink-500">Questions load when you are online.</p>}
      {isLoading && <p className="text-sm text-ink-500">Loading questions…</p>}
      {!!data?.length && (
        <div className="space-y-2">
          {data.map((q) => (
            <QuestionCard key={q.id} q={q} to={`/app/questions/${q.id}`} />
          ))}
        </div>
      )}
      {data && !data.length && !asking && <p className="text-sm text-ink-500">Stuck on something? Ask here — a teacher will answer.</p>}
    </section>
  );
}

/** Full question with its replies. Staff see moderation controls; the asker can follow up and close. */
export function QuestionDetail({ id, studio }: { id: string; studio?: boolean }) {
  const { session, profile } = useAuth();
  const uid = session!.user.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reply, setReply] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['questions', 'one', id],
    // Replies matter more than the cache: always refetch, and poll while the page is open.
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [q, a, v] = await Promise.all([
        supabase.from('course_questions').select(QUESTION_SELECT).eq('id', id).maybeSingle(),
        supabase.from('course_answers').select('*, author:profiles!course_answers_author_id_fkey(id,full_name,avatar_url,role)').eq('question_id', id).order('created_at'),
        supabase.from('question_votes').select('question_id').eq('question_id', id).eq('user_id', uid).maybeSingle(),
      ]);
      return { q: must(q) as QuestionRow | null, answers: must(a) as AnswerRow[], voted: !!v.data };
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['questions'] });

  const send = useMutation({
    mutationFn: async () => must(await supabase.from('course_answers').insert({ question_id: id, author_id: uid, body: reply.trim() })),
    onSuccess: () => {
      setReply('');
      refresh();
    },
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });
  const update = useMutation({
    mutationFn: async (patch: Partial<Pick<QuestionRow, 'status' | 'featured' | 'visibility'>>) => must(await supabase.from('course_questions').update(patch).eq('id', id)),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(friendlyError(e.message)),
  });
  const vote = useMutation({
    mutationFn: async (on: boolean) =>
      on ? must(await supabase.from('question_votes').insert({ question_id: id, user_id: uid })) : must(await supabase.from('question_votes').delete().eq('question_id', id).eq('user_id', uid)),
    onSuccess: refresh,
  });

  if (isLoading) return <FullPageSpinner />;
  const q = data?.q;
  if (!q) return <EmptyState title="Question not found" body="It may have been removed, or it is private." />;
  const mine = q.asker_id === uid;
  const canManage = studio;
  const st = STATUS_LABEL[q.status];
  const canReply = q.status !== 'closed' && (mine || canManage);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={st.tone}>{st.label}</Badge>
          <Badge tone="gray">
            {q.visibility === 'private' ? <Lock className="mr-1 inline h-3 w-3" /> : <Globe2 className="mr-1 inline h-3 w-3" />}
            {q.visibility === 'private' ? 'Private — only teachers' : 'Public — whole class'}
          </Badge>
          {q.featured && <Badge tone="blue">Top question</Badge>}
        </div>
        <h1 className="text-xl font-bold leading-snug sm:text-2xl">{q.title}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {q.course && <Link className="hover:underline" to={studio ? `/admin/courses/${q.course_id}` : `/app/learn/${q.course.slug}`}>{q.course.title}</Link>}
          {q.lesson ? ` · ${q.lesson.title}` : q.module ? ` · ${q.module.title}` : ''}
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Avatar name={q.asker.full_name} url={q.asker.avatar_url} size={28} />
          <span className="font-medium">{mine ? 'You' : q.asker.full_name}</span>
          <span className="text-ink-400">· {timeAgo(q.created_at)}</span>
        </div>
        {q.body && <Markdown className="mt-4">{q.body}</Markdown>}
        <div className="mt-5 flex flex-wrap gap-2">
          {!mine && q.visibility === 'public' && !studio && (
            <Button size="sm" variant={data!.voted ? 'secondary' : 'outline'} icon={<HandHelping className="h-4 w-4" />} loading={vote.isPending} onClick={() => vote.mutate(!data!.voted)}>
              {data!.voted ? 'You have this question too' : 'I have this question too'} · {q.vote_count}
            </Button>
          )}
          {(mine || canManage) && q.status !== 'closed' && (
            <Button size="sm" variant="outline" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => update.mutate({ status: 'closed' })}>
              {mine ? 'My question is solved' : 'Close question'}
            </Button>
          )}
          {(mine || canManage) && q.status === 'closed' && (
            <Button size="sm" variant="ghost" onClick={() => update.mutate({ status: q.answer_count ? 'answered' : 'open' })}>
              Reopen
            </Button>
          )}
          {canManage && q.visibility === 'public' && (
            <Button size="sm" variant="ghost" icon={<Star className="h-4 w-4" />} onClick={() => update.mutate({ featured: !q.featured })}>
              {q.featured ? 'Unfeature' : 'Feature for the class'}
            </Button>
          )}
          {(mine || canManage) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={async () => {
                if (!confirm('Delete this question and its replies?')) return;
                const { error } = await supabase.from('course_questions').delete().eq('id', id);
                if (error) return toast.error(friendlyError(error.message));
                refresh();
                navigate(studio ? '/admin/questions' : '/app/questions');
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </Card>

      {data!.answers.map((a) => (
        <Card key={a.id} className={cn('p-5', a.from_staff && 'border-l-4 border-l-brand-500')}>
          <div className="flex items-center gap-2 text-sm">
            <Avatar name={a.author.full_name} url={a.author.avatar_url} size={28} />
            <span className="font-semibold">{a.author_id === uid ? 'You' : a.author.full_name}</span>
            {a.from_staff && <Badge tone="green">{ROLE_LABEL[a.author.role] ?? 'Teacher'}</Badge>}
            <span className="text-ink-400">· {timeAgo(a.created_at)}</span>
          </div>
          <Markdown className="mt-3">{a.body}</Markdown>
        </Card>
      ))}

      {!data!.answers.length && (
        <Card className="p-5 text-center text-sm text-ink-500">
          {studio ? 'No reply yet — the learner is waiting for you.' : 'A teacher has not replied yet. You will get a notification when they do.'}
        </Card>
      )}

      {canReply && (
        <Card className="p-5">
          <Field label={canManage ? `Answer as ${profile?.full_name ?? 'staff'}` : 'Add more detail or say thanks'} htmlFor="qa-reply">
            <Textarea id="qa-reply" rows={canManage ? 6 : 3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={canManage ? 'Explain step by step. Markdown and ```code``` work.' : ''} />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button disabled={!reply.trim()} loading={send.isPending} onClick={() => send.mutate()} icon={<Send className="h-4 w-4" />}>
              {canManage ? 'Send answer' : 'Send'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
