import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlarmClock, ArrowLeft, ArrowRight, Award, CheckCircle2, CloudUpload, Flag, History, ListChecks, RotateCcw, Target, XCircle, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Markdown } from '@/components/Markdown';
import { Badge, Button, Card, ConfirmModal, Input, Progress } from '@/components/ui';
import { supabase, friendlyError } from '@/lib/supabase';
import { enqueue } from '@/lib/offline/sync';
import { markQuizLocal } from '@/lib/offline/store';
import { gradeLocally } from '@/lib/offline/grading';
import { useAuth } from '@/auth/AuthProvider';
import { useOnline } from '@/hooks/useOffline';
import type { CoursePackage, Question, QuestionResult, Quiz, QuizAttempt } from '@/lib/types';
import { cn, formatDate, shuffle, uuid } from '@/lib/utils';
import { CertificateCelebration, claimCelebration } from './Celebration';

type Phase = 'intro' | 'running' | 'result';
interface Result {
  percent: number;
  score: number;
  max_score: number;
  passed: boolean | null; // null = waiting for server grading (offline)
  results: QuestionResult[];
  xp?: number;
  certificateSerial?: string | null;
  completed?: boolean;
}

const draftKey = (quizId: string) => `dbi-quiz-draft:${quizId}`;

export function QuizView({
  pkg,
  quiz,
  attempts,
  best,
  nextPath,
  onProgress,
}: {
  pkg: CoursePackage;
  quiz: Quiz;
  attempts: QuizAttempt[];
  best?: { percent: number; passed: boolean | null; pending?: boolean };
  nextPath: string | null;
  onProgress: () => void;
}) {
  const { session } = useAuth();
  const uid = session!.user.id;
  const online = useOnline();
  const navigate = useNavigate();
  const questions = useMemo(() => pkg.questions.filter((q) => q.quiz_id === quiz.id).sort((a, b) => a.position - b.position), [pkg, quiz.id]);
  const isPractice = quiz.kind === 'practice';
  const attemptsLeft = quiz.max_attempts == null ? null : Math.max(0, quiz.max_attempts - attempts.length);

  // Resume an unfinished attempt after refresh / app close.
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey(quiz.id)) ?? 'null') as { clientId: string; startedAt: string; answers: Record<string, string[]> } | null;
    } catch {
      return null;
    }
  }, [quiz.id]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [clientId, setClientId] = useState(saved?.clientId ?? '');
  const [startedAt, setStartedAt] = useState(saved?.startedAt ?? '');
  const [answers, setAnswers] = useState<Record<string, string[]>>(saved?.answers ?? {});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const order = useMemo(() => (quiz.shuffle_questions && clientId ? shuffle(questions, clientId) : questions), [questions, quiz.shuffle_questions, clientId]);

  useEffect(() => {
    if (phase === 'running') localStorage.setItem(draftKey(quiz.id), JSON.stringify({ clientId, startedAt, answers }));
  }, [phase, answers, clientId, startedAt, quiz.id]);

  function start() {
    const id = uuid();
    setClientId(id);
    setStartedAt(new Date().toISOString());
    setAnswers({});
    setIndex(0);
    setResult(null);
    setPhase('running');
  }

  function resume() {
    setPhase('running');
  }

  const deadline = quiz.time_limit_minutes && startedAt ? new Date(startedAt).getTime() + quiz.time_limit_minutes * 60_000 : null;

  async function submit() {
    setConfirm(false);
    setSubmitting(true);
    const finish = (r: Result) => {
      localStorage.removeItem(draftKey(quiz.id));
      setResult(r);
      setPhase('result');
      onProgress();
      if (r.passed) void confetti({ particleCount: 120, spread: 80, origin: { y: 0.65 } });
      if (r.completed && claimCelebration(r.certificateSerial)) setTimeout(() => setCelebrate(r.certificateSerial!), 900);
    };
    const queueOffline = async () => {
      await enqueue({ type: 'submit_quiz', id: clientId, userId: uid, quizId: quiz.id, courseId: pkg.course.id, answers, startedAt, at: new Date().toISOString() });
      if (isPractice) {
        const g = gradeLocally(order, pkg.practiceKeys, answers);
        await markQuizLocal(uid, pkg.course.id, quiz.id, g.percent, g.percent >= quiz.pass_mark);
        finish({ ...g, passed: g.percent >= quiz.pass_mark });
      } else {
        await markQuizLocal(uid, pkg.course.id, quiz.id, 0, null);
        finish({ percent: 0, score: 0, max_score: 0, passed: null, results: [] });
      }
    };
    try {
      if (!online) return await queueOffline();
      const { data, error } = await supabase.rpc('submit_quiz', {
        p_quiz_id: quiz.id,
        p_answers: answers,
        p_client_id: clientId,
        p_started_at: startedAt,
        p_offline: false,
      });
      if (error) throw new Error(friendlyError(error.message));
      const a = data as QuizAttempt & { xp_awarded: number; course_progress: { completed: boolean; certificate_serial: string | null } };
      await markQuizLocal(uid, pkg.course.id, quiz.id, a.percent, a.passed);
      finish({
        percent: a.percent,
        score: Number(a.score),
        max_score: Number(a.max_score),
        passed: a.passed,
        results: a.results,
        xp: a.xp_awarded,
        certificateSerial: a.course_progress?.certificate_serial,
        completed: a.course_progress?.completed,
      });
    } catch (e) {
      if (/offline|fetch/i.test((e as Error).message)) await queueOffline();
      else toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!questions.length)
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-ink-500">This quiz has no questions yet.</div>
    );

  if (phase === 'running') {
    const q = order[index]!;
    const answered = order.filter((x) => (answers[x.id] ?? []).filter(Boolean).length > 0).length;
    return (
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink-500">
            Question {index + 1} of {order.length}
          </p>
          {deadline && <Countdown deadline={deadline} onExpire={submit} />}
        </div>
        <Progress value={((index + 1) / order.length) * 100} className="mt-3" tone="blue" />
        <Card className="mt-6 p-5 sm:p-7">
          <QuestionInput q={q} value={answers[q.id] ?? []} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} seed={clientId} />
        </Card>
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="outline" disabled={index === 0} icon={<ArrowLeft className="h-4 w-4" />} onClick={() => setIndex((i) => i - 1)}>
            Back
          </Button>
          {index < order.length - 1 ? (
            <Button onClick={() => setIndex((i) => i + 1)}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="blue" icon={<Flag className="h-4 w-4" />} loading={submitting} onClick={() => setConfirm(true)}>
              Submit quiz
            </Button>
          )}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-1.5" aria-label="Question navigator">
          {order.map((x, i) => (
            <button
              key={x.id}
              onClick={() => setIndex(i)}
              className={cn(
                'h-8 w-8 rounded-lg text-xs font-semibold transition',
                i === index
                  ? 'bg-sky-600 text-white'
                  : (answers[x.id] ?? []).filter(Boolean).length
                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100'
                    : 'bg-ink-100 text-ink-500 dark:bg-ink-800',
              )}
              aria-label={`Question ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <ConfirmModal
          open={confirm}
          onClose={() => setConfirm(false)}
          onConfirm={submit}
          loading={submitting}
          title="Submit your answers?"
          confirmLabel="Submit"
          body={
            answered < order.length
              ? `You have answered ${answered} of ${order.length} questions. Unanswered questions will be marked wrong.`
              : 'You have answered every question. Ready to see your results?'
          }
        />
      </div>
    );
  }

  if (phase === 'result' && result) return <ResultView quiz={quiz} questions={order} result={result} nextPath={nextPath} onRetry={start} canRetry={attemptsLeft !== 0} onNext={() => nextPath && navigate(nextPath)} celebrate={celebrate} setCelebrate={setCelebrate} courseTitle={pkg.course.title} />;

  // Intro
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Badge tone={quiz.kind === 'final' ? 'gold' : quiz.kind === 'practice' ? 'gray' : 'blue'}>
        {quiz.kind === 'final' ? 'Final exam' : quiz.kind === 'practice' ? 'Practice quiz' : 'Module quiz'}
      </Badge>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{quiz.title}</h1>
      {quiz.description && <Markdown className="mt-3 text-ink-600">{quiz.description}</Markdown>}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [ListChecks, `${questions.length}`, 'Questions'],
          [Target, `${quiz.pass_mark}%`, 'Pass mark'],
          [AlarmClock, quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : 'None', 'Time limit'],
          [RotateCcw, attemptsLeft == null ? 'Unlimited' : `${attemptsLeft} left`, 'Attempts'],
        ].map(([Icon, v, l]) => {
          const I = Icon as typeof Target;
          return (
            <Card key={l as string} className="p-4">
              <I className="h-5 w-5 text-sky-600" />
              <p className="mt-2 text-lg font-bold">{v as string}</p>
              <p className="text-xs text-ink-500">{l as string}</p>
            </Card>
          );
        })}
      </div>

      {best && (
        <Card className={cn('mt-6 flex items-center gap-4 p-4', best.passed ? 'border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30' : '')}>
          {best.pending ? <CloudUpload className="h-8 w-8 text-sky-600" /> : best.passed ? <Trophy className="h-8 w-8 text-brand-600" /> : <Target className="h-8 w-8 text-amber-500" />}
          <div>
            <p className="font-semibold">
              {best.pending ? 'Submitted offline — awaiting sync' : best.passed ? `Passed with ${best.percent}%` : `Best score so far: ${best.percent}%`}
            </p>
            <p className="text-sm text-ink-500">
              {best.pending ? 'Your score will appear once you reconnect.' : best.passed ? 'Great work! You can retake it to improve your score.' : `You need ${quiz.pass_mark}% to pass. Review the lessons and try again.`}
            </p>
          </div>
        </Card>
      )}

      {!online && !isPractice && (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          You're offline. You can take this quiz now — it will be graded automatically when you reconnect.
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {saved && clientId ? (
          <>
            <Button size="lg" onClick={resume}>
              Resume attempt
            </Button>
            <Button size="lg" variant="outline" onClick={start} disabled={attemptsLeft === 0}>
              Start over
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={start} disabled={attemptsLeft === 0}>
            {attempts.length ? 'Retake quiz' : 'Start quiz'}
          </Button>
        )}
        {nextPath && best?.passed && (
          <Button size="lg" variant="outline" onClick={() => navigate(nextPath)}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {attempts.length > 0 && (
        <div className="mt-10">
          <h2 className="flex items-center gap-2 font-bold">
            <History className="h-4 w-4" /> Attempt history
          </h2>
          <ul className="mt-3 divide-y divide-ink-100 rounded-2xl border border-ink-100 dark:divide-ink-800 dark:border-ink-800">
            {attempts.map((a, i) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  Attempt {attempts.length - i} · {formatDate(a.submitted_at, { dateStyle: 'medium', timeStyle: 'short' })}
                  {a.submitted_offline && <Badge className="ml-2">offline</Badge>}
                </span>
                <span className={cn('font-bold', a.passed ? 'text-brand-600' : 'text-ink-500')}>{a.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Countdown({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, deadline - now);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      toast.warning("Time's up! Submitting your answers.");
      onExpire();
    }
  }, [left, onExpire]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-bold', left < 60000 ? 'bg-red-50 text-red-600' : 'bg-ink-100 dark:bg-ink-800')}>
      <AlarmClock className="h-4 w-4" />
      {m}:{s.toString().padStart(2, '0')}
    </span>
  );
}

function QuestionInput({ q, value, onChange, seed }: { q: Question; value: string[]; onChange: (v: string[]) => void; seed: string }) {
  const options = useMemo(() => {
    if (q.kind === 'true_false')
      return q.options.length ? q.options : [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }];
    return shuffle(q.options, seed + q.id);
  }, [q, seed]);
  return (
    <fieldset>
      <legend className="w-full">
        <Markdown className="prose-p:my-0 text-lg font-semibold">{q.prompt}</Markdown>
        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-ink-400">
          {q.kind === 'multiple' ? 'Select all that apply' : q.kind === 'short' ? 'Type your answer' : 'Choose one answer'}
          {q.points > 1 && ` · ${q.points} points`}
        </p>
      </legend>
      {q.kind === 'short' ? (
        <Input className="mt-4" value={value[0] ?? ''} onChange={(e) => onChange([e.target.value])} placeholder="Your answer" aria-label="Your answer" />
      ) : (
        <div className="mt-4 space-y-2.5">
          {options.map((o, i) => {
            const checked = value.includes(o.id);
            return (
              <label
                key={o.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition',
                  checked ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40' : 'border-ink-100 hover:border-ink-200 dark:border-ink-800 dark:hover:border-ink-700',
                )}
              >
                <input
                  type={q.kind === 'multiple' ? 'checkbox' : 'radio'}
                  name={q.id}
                  className="sr-only"
                  checked={checked}
                  onChange={() => onChange(q.kind === 'multiple' ? (checked ? value.filter((v) => v !== o.id) : [...value, o.id]) : [o.id])}
                />
                <span
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center text-xs font-bold',
                    q.kind === 'multiple' ? 'rounded-md' : 'rounded-full',
                    checked ? 'bg-sky-600 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800',
                  )}
                >
                  {q.kind === 'true_false' ? (o.id === 'true' ? 'T' : 'F') : String.fromCharCode(65 + i)}
                </span>
                <span className="pt-0.5 text-[15px]">{o.text}</span>
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function ResultView({
  quiz,
  questions,
  result,
  nextPath,
  onRetry,
  canRetry,
  onNext,
  celebrate,
  setCelebrate,
  courseTitle,
}: {
  quiz: Quiz;
  questions: Question[];
  result: Result;
  nextPath: string | null;
  onRetry: () => void;
  canRetry: boolean;
  onNext: () => void;
  celebrate: string | null;
  setCelebrate: (s: string | null) => void;
  courseTitle: string;
}) {
  const byId = new Map(result.results.map((r) => [r.question_id, r]));
  if (result.passed === null)
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <CloudUpload className="mx-auto h-14 w-14 text-sky-600" />
        <h1 className="mt-4 text-2xl font-extrabold">Answers saved offline</h1>
        <p className="mt-2 text-ink-500">Your quiz will be graded automatically as soon as you're back online. You'll see your score here and on your dashboard.</p>
        {nextPath && (
          <Button size="lg" className="mt-6" onClick={onNext}>
            Continue learning <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Card className={cn('overflow-hidden text-center', result.passed ? 'border-brand-200 dark:border-brand-900' : 'border-amber-200 dark:border-amber-900')}>
        <div className={cn('px-6 py-8', result.passed ? 'bg-gradient-to-br from-brand-50 to-sky-50 dark:from-brand-950/50 dark:to-sky-950/30' : 'bg-amber-50/60 dark:bg-amber-950/20')}>
          {result.passed ? <Award className="mx-auto h-14 w-14 text-brand-600" /> : <Target className="mx-auto h-14 w-14 text-amber-500" />}
          <p className="mt-3 text-5xl font-black tracking-tight">{result.percent}%</p>
          <p className="mt-1 text-lg font-bold">{result.passed ? (result.percent === 100 ? 'Perfect score! 💯' : 'You passed! 🎉') : 'Not quite there yet'}</p>
          <p className="mt-1 text-sm text-ink-500">
            {result.score} of {result.max_score} points · pass mark {quiz.pass_mark}%{result.xp ? ` · +${result.xp} XP` : ''}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {canRetry && (
              <Button variant="outline" icon={<RotateCcw className="h-4 w-4" />} onClick={onRetry}>
                Try again
              </Button>
            )}
            {nextPath && (result.passed || quiz.kind === 'practice') && (
              <Button onClick={onNext}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {result.results.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">Review your answers</h2>
          <ol className="mt-4 space-y-4">
            {questions.map((q, i) => {
              const r = byId.get(q.id);
              if (!r) return null;
              const optText = (id: string) => q.options.find((o) => o.id === id)?.text ?? (id === 'true' ? 'True' : id === 'false' ? 'False' : id);
              return (
                <Card key={q.id} className="p-5">
                  <div className="flex gap-3">
                    {r.correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink-400">Question {i + 1}</p>
                      <Markdown className="prose-p:my-1 font-medium">{q.prompt}</Markdown>
                      <p className="mt-2 text-sm">
                        <span className="text-ink-500">Your answer: </span>
                        <span className={r.correct ? 'font-semibold text-brand-700 dark:text-brand-400' : 'font-semibold text-red-600'}>
                          {r.given?.length ? (q.kind === 'short' ? r.given[0] : r.given.map(optText).join(', ')) : 'No answer'}
                        </span>
                      </p>
                      {!r.correct && r.answer && (
                        <p className="mt-1 text-sm">
                          <span className="text-ink-500">Correct answer: </span>
                          <span className="font-semibold text-brand-700 dark:text-brand-400">{q.kind === 'short' ? r.answer[0] : r.answer.map(optText).join(', ')}</span>
                        </p>
                      )}
                      {r.explanation && (
                        <div className="mt-3 rounded-xl bg-sky-50 px-3.5 py-2.5 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                          <span className="font-semibold">Why: </span>
                          {r.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </ol>
        </>
      )}
      <CertificateCelebration serial={celebrate} courseTitle={courseTitle} onClose={() => setCelebrate(null)} />
    </div>
  );
}
