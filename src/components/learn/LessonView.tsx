import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileText, MessagesSquare, NotebookPen, PartyPopper, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Markdown } from '@/components/Markdown';
import { Badge, Button, Card, Textarea } from '@/components/ui';
import { supabase, friendlyError } from '@/lib/supabase';
import { enqueue } from '@/lib/offline/sync';
import { idb, markLessonLocal } from '@/lib/offline/store';
import { useAuth } from '@/auth/AuthProvider';
import { useOnline } from '@/hooks/useOffline';
import type { CoursePackage, Lesson, Module, ProgressResult } from '@/lib/types';
import { uuid, youtubeId } from '@/lib/utils';
import { CertificateCelebration, claimCelebration } from './Celebration';
import { LessonQuestions } from '@/components/qa/QA';
import { ReadAloud } from './ReadAloud';
import { dataSaverOn } from '@/lib/a11y';

export function LessonView({
  pkg,
  lesson,
  module,
  done,
  prevPath,
  nextPath,
  nextLabel,
  onProgress,
}: {
  pkg: CoursePackage;
  lesson: Lesson;
  module: Module;
  done: boolean;
  prevPath: string | null;
  nextPath: string | null;
  nextLabel: string | null;
  onProgress: () => void;
}) {
  const { session } = useAuth();
  const uid = session!.user.id;
  const navigate = useNavigate();
  const online = useOnline();
  const started = useRef(Date.now());
  const [saving, setSaving] = useState(false);
  const [certSerial, setCertSerial] = useState<string | null>(null);
  const yt = youtubeId(lesson.video_url);

  async function complete() {
    const seconds = Math.min(4 * 3600, Math.round((Date.now() - started.current) / 1000));
    setSaving(true);
    let earnedCertificate = false;
    try {
      if (online) {
        const { data, error } = await supabase.rpc('complete_lesson', { p_lesson_id: lesson.id, p_seconds: seconds });
        if (error) throw new Error(friendlyError(error.message));
        const res = data as ProgressResult;
        if (res.xp_awarded) toast.success(`+${res.xp_awarded} XP · Lesson complete!`, { icon: '⭐' });
        if (res.completed && claimCelebration(res.certificate_serial)) {
          earnedCertificate = true;
          setCertSerial(res.certificate_serial);
          void confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
        }
      } else {
        await enqueue({ type: 'complete_lesson', id: uuid(), userId: uid, lessonId: lesson.id, courseId: pkg.course.id, seconds, at: new Date().toISOString() });
        toast.success('Lesson complete! Saved offline — it will sync when you reconnect.');
      }
      await markLessonLocal(uid, pkg.course.id, lesson.id);
      onProgress();
      if (nextPath && !earnedCertificate) navigate(nextPath);
    } catch (e) {
      // Network dropped mid-request: queue it instead of losing progress.
      if (/offline|fetch/i.test((e as Error).message)) {
        await enqueue({ type: 'complete_lesson', id: uuid(), userId: uid, lessonId: lesson.id, courseId: pkg.course.id, seconds, at: new Date().toISOString() });
        await markLessonLocal(uid, pkg.course.id, lesson.id);
        onProgress();
        toast.message('Saved offline — will sync later.');
      } else toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{module.title}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{lesson.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-500">
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" /> {lesson.duration_minutes} min
        </span>
        {done && (
          <Badge tone="green">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </Badge>
        )}
        <ReadAloud text={`${lesson.title}.\n${lesson.content}`} className="ml-auto" />
      </div>

      {lesson.video_url && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-ink-900">
          {online && yt ? (
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${yt}`}
              title={lesson.title}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : online ? (
            <video className="aspect-video w-full" controls preload={dataSaverOn() ? 'none' : 'metadata'} src={lesson.video_url} />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 text-ink-300">
              <WifiOff className="h-8 w-8" />
              <p className="text-sm">Video needs a connection — the written lesson below works offline.</p>
            </div>
          )}
        </div>
      )}

      <Markdown className="mt-8" tryIt>{lesson.content}</Markdown>

      {lesson.attachments?.length > 0 && (
        <Card className="mt-8 p-4">
          <p className="mb-2 text-sm font-semibold">Lesson resources</p>
          <ul className="space-y-1.5">
            {lesson.attachments.map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-sky-600 hover:underline">
                  <FileText className="h-4 w-4" /> {a.title}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Notes courseId={pkg.course.id} lessonId={lesson.id} />
      {online && <LessonQuestions courseId={pkg.course.id} moduleId={module.id} lessonId={lesson.id} />}

      <div className="mt-10 flex flex-col-reverse gap-3 border-t border-ink-100 pt-6 dark:border-ink-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {prevPath && (
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(prevPath)}>
              Previous
            </Button>
          )}
          <Link
            to={`/app/discussions?course=${pkg.course.id}&lesson=${lesson.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-500 hover:text-brand-600"
          >
            <MessagesSquare className="h-4 w-4" /> Discuss
          </Link>
        </div>
        {done ? (
          nextPath ? (
            <Button size="lg" onClick={() => navigate(nextPath)}>
              {nextLabel} <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" variant="outline" icon={<PartyPopper className="h-4 w-4" />} onClick={() => navigate('/app/courses')}>
              Back to my learning
            </Button>
          )
        ) : (
          <Button size="lg" loading={saving} onClick={complete} icon={<CheckCircle2 className="h-5 w-5" />}>
            {nextPath ? 'Complete & continue' : 'Mark as complete'}
          </Button>
        )}
      </div>
      <CertificateCelebration serial={certSerial} courseTitle={pkg.course.title} onClose={() => setCertSerial(null)} />
    </article>
  );
}

function Notes({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { session } = useAuth();
  const uid = session!.user.id;
  const localKey = `note:${uid}:${lessonId}`;
  const [body, setBody] = useState('');
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const loaded = useRef(false);
  const lastSaved = useRef('');

  const { data } = useQuery({
    queryKey: ['note', uid, lessonId],
    networkMode: 'always',
    queryFn: async () => {
      const local = await idb.get<{ body: string; at: string }>(localKey);
      if (navigator.onLine) {
        const { data: row } = await supabase.from('lesson_notes').select('body, updated_at').eq('user_id', uid).eq('lesson_id', lessonId).maybeSingle();
        if (row && (!local || row.updated_at > local.at)) return row.body as string;
      }
      return local?.body ?? '';
    },
  });

  useEffect(() => {
    if (data !== undefined && !loaded.current) {
      lastSaved.current = data;
      setBody(data);
      if (data) setOpen(true);
      loaded.current = true;
    }
  }, [data]);

  useEffect(() => {
    if (!loaded.current || body === lastSaved.current) return;
    setStatus('saving');
    const t = setTimeout(async () => {
      const at = new Date().toISOString();
      await idb.set(localKey, { body, at });
      await enqueue({ type: 'save_note', id: uuid(), userId: uid, lessonId, courseId, body, at });
      lastSaved.current = body;
      setStatus('saved');
    }, 800);
    return () => clearTimeout(t);
  }, [body]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-10">
      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm font-semibold text-sky-600 hover:underline">
          <NotebookPen className="h-4 w-4" /> Add personal notes
        </button>
      ) : (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <NotebookPen className="h-4 w-4 text-sky-600" /> My notes
            </p>
            <span className="text-xs text-ink-400">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Private to you'}</span>
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Write key ideas, questions or code snippets to remember…" />
        </Card>
      )}
    </div>
  );
}
