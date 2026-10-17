import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Lock, MessageSquare, MessagesSquare, Pin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { useMyEnrollments } from '@/hooks/queries';
import { Avatar, Badge, Button, Card, EmptyState, Field, FullPageSpinner, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { cn, isStaffRole, ROLE_LABEL, timeAgo } from '@/lib/utils';
import type { Role } from '@/lib/types';

type Author = { id: string; full_name: string; avatar_url: string | null; role: Role };
type ThreadRow = {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  resolved: boolean;
  reply_count: number;
  last_reply_at: string | null;
  created_at: string;
  author: Author;
  course: { title: string; slug: string };
  lesson: { title: string } | null;
};

const THREAD_SELECT = '*, author:profiles!discussion_threads_author_id_fkey(id,full_name,avatar_url,role), course:courses(title,slug), lesson:lessons(title)';

export function Discussions() {
  const [params, setParams] = useSearchParams();
  const courseFilter = params.get('course') ?? '';
  const lessonId = params.get('lesson');
  const { data: enrollments } = useMyEnrollments();
  const [composer, setComposer] = useState(!!lessonId);

  const { data: threads, isLoading } = useQuery({
    queryKey: ['threads', courseFilter],
    queryFn: async () => {
      let q = supabase.from('discussion_threads').select(THREAD_SELECT).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100);
      if (courseFilter) q = q.eq('course_id', courseFilter);
      return must(await q) as ThreadRow[];
    },
  });

  return (
    <>
      <PageHeader
        title="Discussions"
        subtitle="Ask questions, share tips and help each other learn."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setComposer(true)}>
            New discussion
          </Button>
        }
      />
      <div className="mb-5 max-w-xs">
        <Select
          value={courseFilter}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('course', e.target.value);
            else next.delete('course');
            next.delete('lesson');
            setParams(next);
          }}
          aria-label="Filter by course"
        >
          <option value="">All my courses</option>
          {enrollments?.map((e) => (
            <option key={e.course_id} value={e.course_id}>
              {e.course.title}
            </option>
          ))}
        </Select>
      </div>
      {isLoading && <FullPageSpinner />}
      {!isLoading && !threads?.length && (
        <EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="No discussions yet" body="Be the first to start a conversation." />
      )}
      <div className="space-y-3">
        {threads?.map((t) => (
          <Link key={t.id} to={`/app/discussions/${t.id}`}>
            <Card className="flex gap-4 p-4 transition hover:shadow-lift">
              <Avatar name={t.author.full_name} url={t.author.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t.pinned && <Pin className="h-3.5 w-3.5 text-sky-600" />}
                  <p className="font-semibold">{t.title}</p>
                  {t.resolved && (
                    <Badge tone="green">
                      <CheckCircle2 className="h-3 w-3" /> Answered
                    </Badge>
                  )}
                  {t.locked && <Lock className="h-3.5 w-3.5 text-ink-400" />}
                </div>
                <p className="mt-0.5 line-clamp-1 text-sm text-ink-500">{t.body}</p>
                <p className="mt-1.5 text-xs text-ink-400">
                  {t.author.full_name} · {t.course.title}
                  {t.lesson && ` › ${t.lesson.title}`} · {timeAgo(t.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-sm text-ink-500">
                <MessageSquare className="h-4 w-4" /> {t.reply_count}
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <NewThread open={composer} onClose={() => setComposer(false)} defaultCourse={courseFilter} lessonId={lessonId} />
    </>
  );
}

function NewThread({ open, onClose, defaultCourse, lessonId }: { open: boolean; onClose: () => void; defaultCourse: string; lessonId: string | null }) {
  const { session } = useAuth();
  const { data: enrollments } = useMyEnrollments();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [courseId, setCourseId] = useState(defaultCourse);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const create = useMutation({
    mutationFn: async () =>
      must(
        await supabase
          .from('discussion_threads')
          .insert({ course_id: courseId || defaultCourse, lesson_id: lessonId, author_id: session!.user.id, title: title.trim(), body: body.trim() })
          .select('id')
          .single(),
      ) as { id: string },
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: ['threads'] });
      onClose();
      navigate(`/app/discussions/${t.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a discussion"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={!(courseId || defaultCourse) || title.trim().length < 3 || !body.trim()} onClick={() => create.mutate()}>
            Post
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Course" htmlFor="nt-course">
          <Select id="nt-course" value={courseId || defaultCourse} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Choose a course…</option>
            {enrollments?.map((e) => (
              <option key={e.course_id} value={e.course_id}>
                {e.course.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="nt-title">
          <Input id="nt-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Why does my loop never end?" />
        </Field>
        <Field label="Details" htmlFor="nt-body" hint="Markdown supported — use ``` for code.">
          <Textarea id="nt-body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function Thread() {
  const { id = '' } = useParams();
  const { session, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reply, setReply] = useState('');
  const staff = isStaffRole(profile?.role);

  const { data: thread, isLoading } = useQuery({
    queryKey: ['thread', id],
    queryFn: async () => must(await supabase.from('discussion_threads').select(THREAD_SELECT).eq('id', id).maybeSingle()) as ThreadRow | null,
  });
  const { data: replies } = useQuery({
    queryKey: ['replies', id],
    queryFn: async () =>
      must(
        await supabase
          .from('discussion_replies')
          .select('*, author:profiles!discussion_replies_author_id_fkey(id,full_name,avatar_url,role)')
          .eq('thread_id', id)
          .order('created_at'),
      ) as { id: string; body: string; is_answer: boolean; created_at: string; author: Author }[],
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['thread', id] });
    void qc.invalidateQueries({ queryKey: ['replies', id] });
    void qc.invalidateQueries({ queryKey: ['threads'] });
  };
  const post = useMutation({
    mutationFn: async () => must(await supabase.from('discussion_replies').insert({ thread_id: id, author_id: session!.user.id, body: reply.trim() })),
    onSuccess: () => {
      setReply('');
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateThread = async (patch: Partial<ThreadRow>) => {
    const { error } = await supabase.from('discussion_threads').update(patch).eq('id', id);
    if (error) toast.error(error.message);
    refresh();
  };

  if (isLoading) return <FullPageSpinner />;
  if (!thread) return <EmptyState title="Discussion not found" />;
  const isAuthor = thread.author.id === session?.user.id;
  const canModerate = staff;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/discussions" className="text-sm text-ink-500 hover:text-brand-600">
        ← All discussions
      </Link>
      <Card className="mt-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{thread.course.title}</Badge>
          {thread.lesson && <Badge tone="blue">{thread.lesson.title}</Badge>}
          {thread.resolved && <Badge tone="green">Answered</Badge>}
          {thread.locked && <Badge tone="amber">Locked</Badge>}
        </div>
        <h1 className="mt-3 text-2xl font-bold">{thread.title}</h1>
        <AuthorLine author={thread.author} at={thread.created_at} />
        <Markdown className="mt-4">{thread.body}</Markdown>
        {(isAuthor || canModerate) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
            <Button size="sm" variant="outline" onClick={() => updateThread({ resolved: !thread.resolved })}>
              {thread.resolved ? 'Mark unanswered' : 'Mark answered'}
            </Button>
            {canModerate && (
              <>
                <Button size="sm" variant="outline" icon={<Pin className="h-3.5 w-3.5" />} onClick={() => updateThread({ pinned: !thread.pinned })}>
                  {thread.pinned ? 'Unpin' : 'Pin'}
                </Button>
                <Button size="sm" variant="outline" icon={<Lock className="h-3.5 w-3.5" />} onClick={() => updateThread({ locked: !thread.locked })}>
                  {thread.locked ? 'Unlock' : 'Lock'}
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={async () => {
                if (!confirm('Delete this discussion?')) return;
                await supabase.from('discussion_threads').delete().eq('id', id);
                void qc.invalidateQueries({ queryKey: ['threads'] });
                navigate('/app/discussions');
              }}
            >
              Delete
            </Button>
          </div>
        )}
      </Card>

      <h2 className="mb-3 mt-8 font-bold">{replies?.length ?? 0} replies</h2>
      <div className="space-y-3">
        {replies?.map((r) => (
          <Card key={r.id} className={cn('p-5', r.is_answer && 'border-brand-300 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-950/30')}>
            <AuthorLine author={r.author} at={r.created_at} />
            {r.is_answer && (
              <Badge tone="green" className="mt-2">
                <CheckCircle2 className="h-3 w-3" /> Accepted answer
              </Badge>
            )}
            <Markdown className="mt-3">{r.body}</Markdown>
            {(isAuthor || canModerate) && !r.is_answer && (
              <button
                className="mt-3 text-xs font-semibold text-brand-600 hover:underline"
                onClick={async () => {
                  await supabase.from('discussion_replies').update({ is_answer: true }).eq('id', r.id);
                  await updateThread({ resolved: true });
                }}
              >
                Mark as answer
              </button>
            )}
          </Card>
        ))}
      </div>

      {thread.locked && !canModerate ? (
        <p className="mt-6 text-center text-sm text-ink-500">This discussion is locked.</p>
      ) : (
        <Card className="mt-6 p-4">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a helpful reply… (Markdown supported)" rows={4} />
          <div className="mt-3 flex justify-end">
            <Button loading={post.isPending} disabled={!reply.trim()} onClick={() => post.mutate()}>
              Reply
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function AuthorLine({ author, at }: { author: Author; at: string }) {
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <Avatar name={author.full_name} url={author.avatar_url} size={28} />
      <span className="text-sm font-semibold">{author.full_name}</span>
      {author.role !== 'student' && <Badge tone="blue">{ROLE_LABEL[author.role]}</Badge>}
      <span className="text-xs text-ink-400">{timeAgo(at)}</span>
    </div>
  );
}
