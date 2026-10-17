import { useQuery } from '@tanstack/react-query';
import { supabase, must } from '@/lib/supabase';
import { COURSE_SELECT } from '@/lib/offline/packages';
import type { Badge, Category, Certificate, Course, Enrollment, Notification } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';

export const qk = {
  categories: ['categories'] as const,
  catalog: ['catalog'] as const,
  course: (slug: string) => ['course', slug] as const,
  coursePkg: (id: string) => ['course-pkg', id] as const,
  enrollments: (uid?: string) => ['enrollments', uid] as const,
  progress: (uid: string | undefined, courseId: string) => ['progress', uid, courseId] as const,
  notifications: (uid?: string) => ['notifications', uid] as const,
  certificates: (uid?: string) => ['certificates', uid] as const,
  badges: ['badges'] as const,
  myBadges: (uid?: string) => ['my-badges', uid] as const,
  settings: ['settings'] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: async () => must(await supabase.from('categories').select('*').order('position')) as Category[],
    staleTime: 10 * 60_000,
  });
}

export function useCatalog() {
  return useQuery({
    queryKey: qk.catalog,
    queryFn: async () =>
      must(
        await supabase
          .from('courses')
          .select(`${COURSE_SELECT}, lessons(count), quizzes(count)`)
          .eq('status', 'published')
          .order('featured', { ascending: false })
          .order('enrollment_count', { ascending: false }),
      ) as (Course & { lessons: { count: number }[]; quizzes: { count: number }[] })[],
    staleTime: 5 * 60_000,
  });
}

export function useMyEnrollments() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: qk.enrollments(uid),
    enabled: !!uid,
    queryFn: async () =>
      must(
        await supabase
          .from('enrollments')
          .select(`*, course:courses(${COURSE_SELECT}, lessons(count))`)
          .eq('user_id', uid!)
          .order('last_activity_at', { ascending: false }),
      ) as (Enrollment & { course: Course & { lessons: { count: number }[] } })[],
  });
}

export function useNotifications() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: qk.notifications(uid),
    enabled: !!uid,
    refetchInterval: 60_000,
    queryFn: async () =>
      must(await supabase.from('notifications').select('*').eq('user_id', uid!).order('created_at', { ascending: false }).limit(50)) as Notification[],
  });
}

export function useMyCertificates() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: qk.certificates(uid),
    enabled: !!uid,
    queryFn: async () =>
      must(await supabase.from('certificates').select('*').eq('user_id', uid!).order('issued_at', { ascending: false })) as Certificate[],
  });
}

export function useBadges() {
  return useQuery({
    queryKey: qk.badges,
    staleTime: 60 * 60_000,
    queryFn: async () => must(await supabase.from('badges').select('*').order('position')) as Badge[],
  });
}

export function useMyBadges() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: qk.myBadges(uid),
    enabled: !!uid,
    queryFn: async () =>
      must(await supabase.from('user_badges').select('badge_code, awarded_at').eq('user_id', uid!)) as { badge_code: string; awarded_at: string }[],
  });
}

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const rows = must(await supabase.from('settings').select('key, value')) as { key: string; value: Record<string, unknown> }[];
      return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, Record<string, unknown>>;
    },
  });
}
