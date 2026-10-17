import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { COURSE_SELECT } from '@/lib/offline/packages';
import { useCategories } from '@/hooks/queries';
import type { Course, CourseStatus } from '@/lib/types';
import { CourseCover } from '@/components/CourseCard';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Skeleton, Tabs } from '@/components/ui';
import { isAdminRole, slugify, timeAgo } from '@/lib/utils';

export const STATUS_BADGE: Record<CourseStatus, { tone: 'green' | 'gray' | 'purple' | 'amber'; label: string }> = {
  published: { tone: 'green', label: 'Published' },
  draft: { tone: 'gray', label: 'Draft' },
  review: { tone: 'purple', label: 'In review' },
  archived: { tone: 'amber', label: 'Archived' },
};

export function StudioCourses() {
  const { profile } = useAuth();
  const admin = isAdminRole(profile?.role);
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'all') as CourseStatus | 'all';
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(params.get('new') === '1');

  const { data: courses, isLoading } = useQuery({
    queryKey: ['studio-courses', profile?.id],
    queryFn: async () => {
      let query = supabase.from('courses').select(`${COURSE_SELECT}, lessons(count), quizzes(count)`).order('updated_at', { ascending: false });
      if (!admin) query = query.eq('instructor_id', profile!.id);
      return must(await query) as (Course & { lessons: { count: number }[]; quizzes: { count: number }[] })[];
    },
  });

  const list = useMemo(
    () => (courses ?? []).filter((c) => (status === 'all' || c.status === status) && (!q || c.title.toLowerCase().includes(q.toLowerCase()))),
    [courses, status, q],
  );
  const count = (s: CourseStatus) => courses?.filter((c) => c.status === s).length ?? 0;

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle={admin ? 'Create, review and publish courses for every track.' : 'Build your courses. Submit them for review when ready.'}
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New course
          </Button>
        }
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={status}
          onChange={(v) => setParams(v === 'all' ? {} : { status: v })}
          tabs={[
            { value: 'all', label: 'All', count: courses?.length },
            { value: 'published', label: 'Published', count: count('published') },
            { value: 'review', label: 'In review', count: count('review') },
            { value: 'draft', label: 'Drafts', count: count('draft') },
            { value: 'archived', label: 'Archived', count: count('archived') },
          ]}
          className="overflow-x-auto"
        />
        <div className="relative md:w-72">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input className="pl-10" placeholder="Search courses" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search courses" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-64" />)}
        {list.map((c) => (
          <Link key={c.id} to={`/admin/courses/${c.id}`}>
            <Card className="overflow-hidden transition hover:shadow-lift">
              <CourseCover course={c} />
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_BADGE[c.status].tone}>{STATUS_BADGE[c.status].label}</Badge>
                  {c.featured && <Badge tone="gold">Featured</Badge>}
                </div>
                <p className="mt-2 font-bold">{c.title}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {c.lessons?.[0]?.count ?? 0} lessons · {c.quizzes?.[0]?.count ?? 0} quizzes · {c.enrollment_count} learners · updated {timeAgo(c.updated_at)}
                </p>
                {c.instructor && <p className="mt-1 text-xs text-ink-400">Instructor: {c.instructor.full_name}</p>}
              </div>
            </Card>
          </Link>
        ))}
      </div>
      {!isLoading && !list.length && (
        <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No courses here" body="Create a course to get started." action={<Button onClick={() => setCreating(true)}>New course</Button>} />
      )}
      <NewCourseModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function NewCourseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const { data: categories } = useCategories();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('beginner');
  useEffect(() => {
    if (!category && categories?.[0]) setCategory(categories[0].id);
  }, [categories, category]);
  const create = useMutation({
    mutationFn: async () => {
      const base = slugify(title) || 'course';
      const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      return must(
        await supabase
          .from('courses')
          .insert({ title: title.trim(), slug, category_id: category || null, level, status: 'draft', instructor_id: profile!.id, created_by: profile!.id })
          .select('id')
          .single(),
      ) as { id: string };
    },
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['studio-courses'] });
      toast.success('Course created — now add modules and lessons.');
      onClose();
      navigate(`/admin/courses/${c.id}?tab=curriculum`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a course"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={title.trim().length < 3} onClick={() => create.mutate()}>
            Create course
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Course title" htmlFor="nc-title">
          <Input id="nc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to Python" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Track" htmlFor="nc-cat">
            <Select id="nc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Level" htmlFor="nc-level">
            <Select id="nc-level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
