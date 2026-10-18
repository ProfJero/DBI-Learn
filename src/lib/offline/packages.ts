import { supabase, must } from '../supabase';
import type { Course, CoursePackage, Lesson, Module, Question, QuestionKey, Quiz } from '../types';
import { idb } from './store';

const pkgKey = (courseId: string) => `pkg:${courseId}`;

export const COURSE_SELECT =
  '*, category:categories(id,name,slug,color,icon), instructor:profiles!courses_instructor_id_fkey(id,full_name,avatar_url,headline)';

/** Fetches the whole course (lessons, quizzes, questions) from the server. */
export async function fetchCoursePackage(courseId: string): Promise<CoursePackage> {
  const [course, modules, lessons, quizzes] = await Promise.all([
    supabase.from('courses').select(COURSE_SELECT).eq('id', courseId).single().then(must),
    supabase.from('modules').select('*').eq('course_id', courseId).order('position').then(must),
    supabase.from('lessons').select('*').eq('course_id', courseId).order('position').then(must),
    supabase.from('quizzes').select('*').eq('course_id', courseId).eq('status', 'published').order('position').then(must),
  ]);
  const quizIds = (quizzes as Quiz[]).map((q) => q.id);
  const questions = quizIds.length
    ? ((await supabase.from('questions').select('*').in('quiz_id', quizIds).order('position').then(must)) as Question[])
    : [];
  const practice = (quizzes as Quiz[]).filter((q) => q.kind === 'practice');
  const practiceKeys = (
    await Promise.all(practice.map((q) => supabase.rpc('get_practice_keys', { p_quiz_id: q.id }).then(must)))
  ).flat() as QuestionKey[];
  return {
    course: course as Course,
    modules: modules as Module[],
    lessons: lessons as Lesson[],
    quizzes: quizzes as Quiz[],
    questions,
    practiceKeys,
    downloadedAt: new Date().toISOString(),
    version: (course as Course).updated_at,
  };
}

function imageUrls(markdown: string) {
  return [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]!).filter((u) => /^https?:|^\//.test(u));
}

/** Downloads a course for offline study, warming the service-worker cache with its images. */
export async function downloadCourse(courseId: string, onProgress?: (pct: number) => void) {
  onProgress?.(5);
  const pkg = await fetchCoursePackage(courseId);
  onProgress?.(60);
  await idb.set(pkgKey(courseId), pkg);
  const urls = [...new Set([...(pkg.course.cover_url ? [pkg.course.cover_url] : []), ...pkg.lessons.flatMap((l) => imageUrls(l.content))])];
  let done = 0;
  await Promise.all(
    urls.map((u) =>
      fetch(u, { mode: 'no-cors' })
        .catch(() => undefined)
        .finally(() => onProgress?.(60 + Math.round((40 * ++done) / Math.max(urls.length, 1)))),
    ),
  );
  onProgress?.(100);
  return pkg;
}

export const getPackage = (courseId: string) => idb.get<CoursePackage>(pkgKey(courseId));
export const removePackage = (courseId: string) => idb.del(pkgKey(courseId));

export async function listPackages(): Promise<CoursePackage[]> {
  const ks = await idb.keys('pkg:');
  const all = await Promise.all(ks.map((k) => idb.get<CoursePackage>(k)));
  return all.filter(Boolean) as CoursePackage[];
}

/** Refreshes downloaded courses that changed on the server. */
export async function refreshStalePackages() {
  if (!navigator.onLine) return;
  const pkgs = await listPackages();
  if (!pkgs.length) return;
  const { data } = await supabase.from('courses').select('id, updated_at').in('id', pkgs.map((p) => p.course.id));
  for (const row of data ?? []) {
    const pkg = pkgs.find((p) => p.course.id === row.id);
    if (pkg && pkg.version !== row.updated_at) await downloadCourse(row.id).catch(() => undefined);
  }
}

export function estimateSize(pkg: CoursePackage) {
  return new Blob([JSON.stringify(pkg)]).size;
}
