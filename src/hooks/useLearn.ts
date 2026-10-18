import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { supabase, must } from '@/lib/supabase';
import { fetchCoursePackage, getPackage, listPackages } from '@/lib/offline/packages';
import { getLocalProgress } from '@/lib/offline/store';
import type { CoursePackage, Lesson, Quiz, QuizAttempt } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';

/** Loads a course for studying: network first, falling back to the offline download. */
export function useCoursePackage(slug: string) {
  return useQuery({
    queryKey: ['learn', slug],
    networkMode: 'always',
    queryFn: async (): Promise<CoursePackage & { offline: boolean }> => {
      const offlineCopy = async () => {
        const pkg = (await listPackages()).find((p) => p.course.slug === slug);
        return pkg ? { ...pkg, offline: true } : null;
      };
      if (!navigator.onLine) {
        const pkg = await offlineCopy();
        if (pkg) return pkg;
        throw new Error('This course is not downloaded. Connect to the internet or download it for offline use.');
      }
      try {
        const { data, error } = await supabase.from('courses').select('id').eq('slug', slug).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Course not found');
        return { ...(await fetchCoursePackage(data.id)), offline: false };
      } catch (e) {
        const pkg = await offlineCopy();
        if (pkg) return pkg;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export interface CourseProgress {
  completedLessons: Set<string>;
  quizBest: Map<string, { percent: number; passed: boolean | null; pending?: boolean }>;
  attempts: QuizAttempt[];
  enrolled: boolean;
  lastLessonId: string | null;
}

/** Server progress merged with anything recorded offline on this device. */
export function useCourseProgress(courseId: string | undefined) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const key = ['progress', uid, courseId];
  const query = useQuery({
    queryKey: key,
    enabled: !!uid && !!courseId,
    networkMode: 'always',
    queryFn: async (): Promise<CourseProgress> => {
      const local = await getLocalProgress(uid!, courseId!);
      let lessons: string[] = [];
      let attempts: QuizAttempt[] = [];
      let enrolled = false;
      let lastLessonId: string | null = null;
      if (navigator.onLine) {
        try {
          const [lp, qa, en] = await Promise.all([
            supabase.from('lesson_progress').select('lesson_id').eq('user_id', uid!).eq('course_id', courseId!).then(must),
            supabase.from('quiz_attempts').select('*').eq('user_id', uid!).eq('course_id', courseId!).order('submitted_at', { ascending: false }).then(must),
            supabase.from('enrollments').select('*').eq('user_id', uid!).eq('course_id', courseId!).maybeSingle().then(must),
          ]);
          lessons = (lp as { lesson_id: string }[]).map((r) => r.lesson_id);
          attempts = qa as QuizAttempt[];
          enrolled = !!en;
          lastLessonId = (en as { last_lesson_id: string | null } | null)?.last_lesson_id ?? null;
        } catch {
          /* offline-ish: fall back to local */
        }
      }
      const completedLessons = new Set([...lessons, ...local.lessons]);
      const quizBest = new Map<string, { percent: number; passed: boolean | null; pending?: boolean }>();
      for (const a of attempts) {
        const prev = quizBest.get(a.quiz_id);
        if (!prev || a.percent > prev.percent || (a.passed && !prev.passed)) quizBest.set(a.quiz_id, { percent: a.percent, passed: a.passed });
      }
      for (const [qid, l] of Object.entries(local.quizzes)) {
        const prev = quizBest.get(qid);
        if (!prev) quizBest.set(qid, { percent: l.percent, passed: l.passed, pending: l.passed === null });
        else if (l.passed && !prev.passed) quizBest.set(qid, { percent: Math.max(l.percent, prev.percent), passed: true });
      }
      return { completedLessons, quizBest, attempts, enrolled: enrolled || local.lessons.length > 0, lastLessonId };
    },
  });
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: key }), [qc, key.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...query, refresh };
}

export type Step = { type: 'lesson'; item: Lesson; moduleId: string } | { type: 'quiz'; item: Quiz; moduleId: string | null };

/** The ordered learning path: each module's lessons, then its quizzes; final exam last. */
export function useSteps(pkg: CoursePackage | undefined) {
  return useMemo<Step[]>(() => {
    if (!pkg) return [];
    const steps: Step[] = [];
    const modules = [...pkg.modules].sort((a, b) => a.position - b.position);
    for (const m of modules) {
      pkg.lessons
        .filter((l) => l.module_id === m.id)
        .sort((a, b) => a.position - b.position)
        .forEach((l) => steps.push({ type: 'lesson', item: l, moduleId: m.id }));
      pkg.quizzes
        .filter((q) => q.module_id === m.id && q.kind !== 'final')
        .sort((a, b) => a.position - b.position)
        .forEach((q) => steps.push({ type: 'quiz', item: q, moduleId: m.id }));
    }
    // Course-level quizzes (no module) come next, with the final exam always last.
    const isFinal = (q: Quiz) => (q.kind === 'final' ? 1 : 0);
    pkg.quizzes
      .filter((q) => q.kind === 'final' || !q.module_id)
      .sort((a, b) => isFinal(a) - isFinal(b) || a.position - b.position)
      .forEach((q) => steps.push({ type: 'quiz', item: q, moduleId: q.module_id }));
    return steps;
  }, [pkg]);
}

export function isStepDone(step: Step, p: CourseProgress | undefined) {
  if (!p) return false;
  if (step.type === 'lesson') return p.completedLessons.has(step.item.id);
  if (step.item.kind === 'practice') return p.quizBest.has(step.item.id);
  return !!p.quizBest.get(step.item.id)?.passed;
}

export async function isDownloaded(courseId: string) {
  return !!(await getPackage(courseId));
}
