import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileQuestion,
  Globe,
  Lock,
  PlayCircle,
  Star,
  Users,
  WifiOff,
  ListChecks,
} from 'lucide-react';
import { supabase, must } from '@/lib/supabase';
import { COURSE_SELECT } from '@/lib/offline/packages';
import { useAuth } from '@/auth/AuthProvider';
import type { Course, Lesson, Module, Quiz } from '@/lib/types';
import { qk, useMyEnrollments } from '@/hooks/queries';
import { CourseCover, LEVEL_TONE } from '@/components/CourseCard';
import { Avatar, Badge, Button, Card, FullPageSpinner, LinkButton, Progress, Textarea } from '@/components/ui';
import { cn, formatDate, minutesLabel } from '@/lib/utils';
import { NotFound } from './NotFound';

type Detail = Course & {
  modules: (Module & { lessons: Pick<Lesson, 'id' | 'title' | 'duration_minutes' | 'kind' | 'is_preview' | 'position'>[] })[];
  quizzes: Pick<Quiz, 'id' | 'title' | 'kind' | 'module_id'>[];
};

export function CourseDetail({ inApp }: { inApp?: boolean }) {
  const { slug = '' } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: enrollments } = useMyEnrollments();
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({ 0: true });

  const { data: course, isLoading } = useQuery({
    queryKey: qk.course(slug),
    queryFn: async () => {
      const c = must(await supabase.from('courses').select(COURSE_SELECT).eq('slug', slug).maybeSingle()) as Course | null;
      if (!c) return null;
      // Outline is titles only — lesson bodies stay behind sign-in.
      const outline = must(await supabase.rpc('course_outline', { p_course_id: c.id })) as Pick<Detail, 'modules' | 'quizzes'>;
      return { ...c, ...outline } as Detail;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', course?.id],
    enabled: !!course,
    queryFn: async () =>
      must(
        await supabase
          .from('course_reviews')
          .select('rating, comment, created_at, user_id')
          .eq('course_id', course!.id)
          .order('created_at', { ascending: false })
          .limit(10),
      ) as { rating: number; comment: string | null; created_at: string; user_id: string }[],
  });

  const enrollment = enrollments?.find((e) => e.course_id === course?.id);

  const enroll = useMutation({
    mutationFn: async () => must(await supabase.rpc('enroll', { p_course_id: course!.id })),
    onSuccess: () => {
      toast.success(`You're enrolled in ${course!.title}! 🎉`);
      void qc.invalidateQueries({ queryKey: qk.enrollments(session?.user.id) });
      navigate(`/app/learn/${course!.slug}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <FullPageSpinner />;
  if (!course) return <NotFound />;

  const lessons = course.modules.flatMap((m) => m.lessons);
  const totalMin = lessons.reduce((s, l) => s + l.duration_minutes, 0);
  const finalQuiz = course.quizzes.find((q) => q.kind === 'final');

  const cta = enrollment ? (
    <LinkButton to={`/app/learn/${course.slug}`} size="lg" className="w-full">
      {enrollment.progress > 0 ? 'Continue learning' : 'Start learning'}
    </LinkButton>
  ) : session ? (
    <Button size="lg" className="w-full" loading={enroll.isPending} onClick={() => enroll.mutate()}>
      Enroll for free
    </Button>
  ) : (
    <LinkButton to={`/signup?next=/app/catalog/${course.slug}`} size="lg" className="w-full">
      Sign up to enroll — free
    </LinkButton>
  );

  return (
    <div className={cn(!inApp && 'container-page py-8')}>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <nav className="mb-4 text-sm text-ink-500">
            <Link to={inApp ? '/app/catalog' : '/courses'} className="hover:text-brand-600">
              Courses
            </Link>{' '}
            / <span>{course.category?.name}</span>
          </nav>
          <div className="flex flex-wrap gap-2">
            {course.category && <Badge>{course.category.name}</Badge>}
            <Badge tone={LEVEL_TONE[course.level]} className="capitalize">
              {course.level}
            </Badge>
            {course.status !== 'published' && <Badge tone="amber">{course.status}</Badge>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{course.title}</h1>
          {course.subtitle && <p className="mt-3 text-lg text-ink-600 dark:text-ink-300">{course.subtitle}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-500">
            {course.rating_count > 0 && (
              <span className="flex items-center gap-1 font-semibold text-amber-600">
                <Star className="h-4 w-4 fill-current" /> {Number(course.rating_avg).toFixed(1)}
                <span className="font-normal text-ink-500">({course.rating_count} reviews)</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> {course.enrollment_count.toLocaleString()} learners
            </span>
            <span className="flex items-center gap-1">
              <Globe className="h-4 w-4" /> {course.language}
            </span>
            {course.published_at && <span>Updated {formatDate(course.updated_at)}</span>}
          </div>
          {course.instructor && (
            <div className="mt-5 flex items-center gap-3">
              <Avatar name={course.instructor.full_name} url={course.instructor.avatar_url} size={40} />
              <div>
                <p className="text-sm font-semibold">{course.instructor.full_name}</p>
                <p className="text-xs text-ink-500">{course.instructor.headline ?? 'Instructor'}</p>
              </div>
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-2xl lg:hidden">
            <CourseCover course={course} size="lg" />
          </div>

          {course.outcomes.length > 0 && (
            <Card className="mt-8 p-6">
              <h2 className="text-lg font-bold">What you'll learn</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-2.5 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {o}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {course.description && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">About this course</h2>
              <div className="mt-3 space-y-3 whitespace-pre-line text-ink-600 dark:text-ink-300">{course.description}</div>
            </section>
          )}

          <section className="mt-8">
            <div className="flex items-end justify-between">
              <h2 className="text-lg font-bold">Course content</h2>
              <p className="text-sm text-ink-500">
                {course.modules.length} modules · {lessons.length} lessons · {minutesLabel(totalMin)}
              </p>
            </div>
            <div className="mt-4 divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 dark:divide-ink-800 dark:border-ink-800">
              {course.modules.map((m, i) => {
                const open = openModules[i] ?? false;
                const moduleQuiz = course.quizzes.find((q) => q.module_id === m.id && q.kind !== 'final');
                return (
                  <div key={m.id}>
                    <button
                      className="flex w-full items-center gap-3 bg-ink-50/70 px-4 py-3.5 text-left dark:bg-ink-900"
                      onClick={() => setOpenModules((s) => ({ ...s, [i]: !open }))}
                      aria-expanded={open}
                    >
                      <ChevronDown className={cn('h-4 w-4 shrink-0 transition', open && 'rotate-180')} />
                      <span className="flex-1 font-semibold">
                        Module {i + 1}: {m.title}
                      </span>
                      <span className="text-xs text-ink-500">{m.lessons.length} lessons</span>
                    </button>
                    {open && (
                      <ul className="bg-white dark:bg-ink-950">
                        {m.lessons.map((l) => (
                          <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 pl-11 text-sm">
                            {l.kind === 'video' ? <PlayCircle className="h-4 w-4 text-ink-400" /> : <BookOpen className="h-4 w-4 text-ink-400" />}
                            <span className="flex-1">{l.title}</span>
                            {l.is_preview && <Badge tone="blue">Preview</Badge>}
                            <span className="text-xs text-ink-500">{l.duration_minutes} min</span>
                          </li>
                        ))}
                        {moduleQuiz && (
                          <li className="flex items-center gap-3 px-4 py-2.5 pl-11 text-sm">
                            <FileQuestion className="h-4 w-4 text-sky-500" />
                            <span className="flex-1 font-medium">{moduleQuiz.title}</span>
                            <Badge tone={moduleQuiz.kind === 'practice' ? 'gray' : 'blue'}>{moduleQuiz.kind === 'practice' ? 'Practice' : 'Quiz'}</Badge>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
              {finalQuiz && (
                <div className="flex items-center gap-3 bg-gradient-to-r from-gold-300/20 to-transparent px-4 py-3.5">
                  <Award className="h-4 w-4 text-gold-600" />
                  <span className="flex-1 font-semibold">{finalQuiz.title}</span>
                  <Badge tone="gold">Final exam</Badge>
                </div>
              )}
            </div>
          </section>

          {course.requirements.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">Requirements</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-600 dark:text-ink-300">
                {course.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          <Reviews courseId={course.id} reviews={reviews ?? []} canReview={!!enrollment} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="hidden lg:block">
              <CourseCover course={course} />
            </div>
            <div className="space-y-5 p-5">
              {enrollment && (
                <div>
                  <div className="mb-1.5 flex justify-between text-sm font-medium">
                    <span>Your progress</span>
                    <span>{enrollment.progress}%</span>
                  </div>
                  <Progress value={enrollment.progress} />
                </div>
              )}
              <div className="text-3xl font-extrabold">
                Free <span className="text-sm font-medium text-ink-500">forever</span>
              </div>
              {cta}
              <ul className="space-y-2.5 text-sm text-ink-600 dark:text-ink-300">
                <li className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-ink-400" /> {course.estimated_hours ? `${Number(course.estimated_hours)} hours` : minutesLabel(totalMin)} of learning
                </li>
                <li className="flex items-center gap-2.5">
                  <BookOpen className="h-4 w-4 text-ink-400" /> {lessons.length} bite-sized lessons
                </li>
                <li className="flex items-center gap-2.5">
                  <ListChecks className="h-4 w-4 text-ink-400" /> {course.quizzes.length} quizzes with instant feedback
                </li>
                <li className="flex items-center gap-2.5">
                  <WifiOff className="h-4 w-4 text-ink-400" /> Download &amp; learn offline
                </li>
                {course.certificate_enabled && (
                  <li className="flex items-center gap-2.5">
                    <Award className="h-4 w-4 text-ink-400" /> Verifiable certificate ({course.pass_mark}% pass mark)
                  </li>
                )}
                {course.sequential && (
                  <li className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-ink-400" /> Guided path: unlock lessons in order
                  </li>
                )}
              </ul>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Reviews({ courseId, reviews, canReview }: { courseId: string; reviews: { rating: number; comment: string | null; created_at: string; user_id: string }[]; canReview: boolean }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const mine = reviews.find((r) => r.user_id === session?.user.id);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const save = useMutation({
    mutationFn: async () =>
      must(
        await supabase
          .from('course_reviews')
          .upsert({ user_id: session!.user.id, course_id: courseId, rating, comment: comment.trim() || null }),
      ),
    onSuccess: () => {
      toast.success('Thanks for your review!');
      void qc.invalidateQueries({ queryKey: ['reviews', courseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!reviews.length && !canReview) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">Learner reviews</h2>
      {canReview && (
        <Card className="mt-4 p-4">
          <p className="text-sm font-medium">{mine ? 'Update your review' : 'Rate this course'}</p>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} role="radio" aria-checked={rating === n}>
                <Star className={cn('h-6 w-6', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-ink-300')} />
              </button>
            ))}
          </div>
          <Textarea className="mt-3" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you like? What could be better?" />
          <Button className="mt-3" size="sm" disabled={!rating} loading={save.isPending} onClick={() => save.mutate()}>
            Submit review
          </Button>
        </Card>
      )}
      <ul className="mt-4 space-y-3">
        {reviews
          .filter((r) => r.comment)
          .map((r) => (
            <li key={r.user_id} className="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={cn('h-3.5 w-3.5', i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-ink-200')} />
                ))}
                <span className="ml-2 text-xs text-ink-500">{formatDate(r.created_at)}</span>
              </div>
              <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{r.comment}</p>
            </li>
          ))}
      </ul>
    </section>
  );
}
