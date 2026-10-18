import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  Eye,
  FileQuestion,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  Users,
  ExternalLink,
  Archive,
  CheckCircle2,
  ImagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { uploadImage } from '@/lib/media';
import { COURSE_SELECT } from '@/lib/offline/packages';
import { useCategories } from '@/hooks/queries';
import type { Course, Lesson, Module, Question, QuestionKind, Quiz } from '@/lib/types';
import { Markdown } from '@/components/Markdown';
import { CourseCover } from '@/components/CourseCard';
import { Avatar, Badge, Button, Card, Checkbox, ConfirmModal, EmptyState, Field, FullPageSpinner, Input, Modal, PageHeader, Progress, Select, Tabs, Textarea } from '@/components/ui';
import { downloadText, formatDate, isAdminRole, slugify, timeAgo, toCsv, uuid } from '@/lib/utils';
import { STATUS_BADGE } from './Courses';

type Tab = 'details' | 'curriculum' | 'quizzes' | 'learners';

export function CourseEditor() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') ?? 'details') as Tab;
  const { profile } = useAuth();
  const admin = isAdminRole(profile?.role);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: course, isLoading } = useQuery({
    queryKey: ['studio-course', id],
    queryFn: async () => must(await supabase.from('courses').select(COURSE_SELECT).eq('id', id).maybeSingle()) as Course | null,
  });

  const setStatus = useMutation({
    mutationFn: async (status: Course['status']) => must(await supabase.from('courses').update({ status }).eq('id', id)),
    onSuccess: (_d, status) => {
      toast.success(status === 'published' ? 'Course published 🎉 Learners can now enroll.' : status === 'review' ? 'Submitted for review.' : `Course moved to ${status}.`);
      void qc.invalidateQueries({ queryKey: ['studio-course', id] });
      void qc.invalidateQueries({ queryKey: ['studio-courses'] });
      void qc.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => must(await supabase.from('courses').delete().eq('id', id)),
    onSuccess: () => {
      toast.success('Course deleted');
      void qc.invalidateQueries({ queryKey: ['studio-courses'] });
      navigate('/admin/courses');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <FullPageSpinner />;
  if (!course) return <EmptyState title="Course not found" action={<Link to="/admin/courses" className="text-brand-600">Back to courses</Link>} />;

  return (
    <>
      <Link to="/admin/courses" className="text-sm text-ink-500 hover:text-brand-600">
        ← All courses
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {course.title}
            <Badge tone={STATUS_BADGE[course.status].tone}>{STATUS_BADGE[course.status].label}</Badge>
          </span>
        }
        subtitle={`Last updated ${timeAgo(course.updated_at)}`}
        actions={
          <>
            <Link to={`/courses/${course.slug}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800">
              <ExternalLink className="h-4 w-4" /> Preview
            </Link>
            {course.status !== 'published' && !admin && course.status !== 'review' && (
              <Button icon={<Send className="h-4 w-4" />} loading={setStatus.isPending} onClick={() => setStatus.mutate('review')}>
                Submit for review
              </Button>
            )}
            {admin && course.status !== 'published' && (
              <Button icon={<CheckCircle2 className="h-4 w-4" />} loading={setStatus.isPending} onClick={() => setStatus.mutate('published')}>
                Publish
              </Button>
            )}
            {course.status === 'published' && (
              <Button variant="outline" icon={<Archive className="h-4 w-4" />} onClick={() => setStatus.mutate(admin ? 'archived' : 'draft')}>
                {admin ? 'Archive' : 'Unpublish'}
              </Button>
            )}
            {admin && (
              <Button variant="ghost" className="text-red-600" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { value: 'details', label: 'Details' },
          { value: 'curriculum', label: 'Curriculum' },
          { value: 'quizzes', label: 'Quizzes' },
          { value: 'learners', label: 'Learners' },
        ]}
        className="mb-6"
      />
      {tab === 'details' && <DetailsTab course={course} admin={admin} />}
      {tab === 'curriculum' && <CurriculumTab courseId={course.id} />}
      {tab === 'quizzes' && <QuizzesTab courseId={course.id} passMark={course.pass_mark} />}
      {tab === 'learners' && <LearnersTab course={course} />}
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
        title="Delete this course?"
        confirmLabel="Delete forever"
        body="This permanently deletes the course, its lessons, quizzes and all learner progress. Issued certificates remain valid. This cannot be undone."
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------
function DetailsTab({ course, admin }: { course: Course; admin: boolean }) {
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const { data: instructors } = useQuery({
    queryKey: ['instructor-options'],
    enabled: admin,
    queryFn: async () => must(await supabase.from('profiles').select('id, full_name, role').in('role', ['instructor', 'admin', 'super_admin']).order('full_name')) as { id: string; full_name: string; role: string }[],
  });
  const [f, setF] = useState({
    title: course.title,
    slug: course.slug,
    subtitle: course.subtitle ?? '',
    description: course.description ?? '',
    category_id: course.category_id ?? '',
    level: course.level,
    language: course.language,
    accent: course.accent ?? '',
    cover_url: course.cover_url ?? '',
    outcomes: course.outcomes.join('\n'),
    requirements: course.requirements.join('\n'),
    tags: course.tags.join(', '),
    pass_mark: course.pass_mark,
    estimated_hours: course.estimated_hours ?? '',
    certificate_enabled: course.certificate_enabled,
    sequential: course.sequential,
    featured: course.featured,
    instructor_id: course.instructor_id ?? '',
  });
  const [uploading, setUploading] = useState(false);
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  const save = useMutation({
    mutationFn: async () => {
      const patch: Partial<Course> & Record<string, unknown> = {
        title: f.title.trim(),
        slug: slugify(f.slug) || course.slug,
        subtitle: f.subtitle.trim() || null,
        description: f.description.trim() || null,
        category_id: f.category_id || null,
        level: f.level,
        language: f.language,
        accent: f.accent || null,
        cover_url: f.cover_url || null,
        outcomes: lines(f.outcomes),
        requirements: lines(f.requirements),
        tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
        pass_mark: Number(f.pass_mark),
        estimated_hours: f.estimated_hours === '' ? null : Number(f.estimated_hours),
        certificate_enabled: f.certificate_enabled,
        sequential: f.sequential,
      };
      if (admin) {
        patch.featured = f.featured;
        patch.instructor_id = f.instructor_id || null;
      }
      must(await supabase.from('courses').update(patch).eq('id', course.id));
    },
    onSuccess: () => {
      toast.success('Course saved');
      void qc.invalidateQueries({ queryKey: ['studio-course', course.id] });
      void qc.invalidateQueries({ queryKey: ['studio-courses'] });
      void qc.invalidateQueries({ queryKey: ['catalog'] });
    },
    onError: (e: Error) => toast.error(/duplicate/.test(e.message) ? 'That URL slug is already used by another course.' : e.message),
  });

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage(file, 'cover');
      setF((x) => ({ ...x, cover_url: url }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="d-title" className="sm:col-span-2">
            <Input id="d-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Subtitle" htmlFor="d-sub" className="sm:col-span-2" hint="One sentence that sells the course.">
            <Input id="d-sub" value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} />
          </Field>
          <Field label="Track" htmlFor="d-cat">
            <Select id="d-cat" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
              <option value="">—</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Level" htmlFor="d-level">
            <Select id="d-level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as Course['level'] })}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </Field>
          <Field label="URL slug" htmlFor="d-slug" hint={`/courses/${slugify(f.slug)}`}>
            <Input id="d-slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
          </Field>
          <Field label="Language" htmlFor="d-lang">
            <Input id="d-lang" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} />
          </Field>
        </div>
        <Field label="Description" htmlFor="d-desc">
          <Textarea id="d-desc" rows={6} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What learners will learn" htmlFor="d-out" hint="One outcome per line">
            <Textarea id="d-out" rows={6} value={f.outcomes} onChange={(e) => setF({ ...f, outcomes: e.target.value })} />
          </Field>
          <Field label="Requirements" htmlFor="d-req" hint="One per line">
            <Textarea id="d-req" rows={6} value={f.requirements} onChange={(e) => setF({ ...f, requirements: e.target.value })} />
          </Field>
        </div>
        <Field label="Tags" htmlFor="d-tags" hint="Comma separated — helps search">
          <Input id="d-tags" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Pass mark (%)" htmlFor="d-pass">
            <Input id="d-pass" type="number" min={1} max={100} value={f.pass_mark} onChange={(e) => setF({ ...f, pass_mark: Number(e.target.value) })} />
          </Field>
          <Field label="Estimated hours" htmlFor="d-hours">
            <Input id="d-hours" type="number" step="0.5" min={0} value={f.estimated_hours} onChange={(e) => setF({ ...f, estimated_hours: e.target.value })} />
          </Field>
          {admin && (
            <Field label="Instructor" htmlFor="d-inst">
              <Select id="d-inst" value={f.instructor_id} onChange={(e) => setF({ ...f, instructor_id: e.target.value })}>
                <option value="">— none —</option>
                {instructors?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <div className="space-y-3">
          <Checkbox checked={f.certificate_enabled} onChange={(e) => setF({ ...f, certificate_enabled: e.target.checked })} label="Issue a certificate when learners complete the course" />
          <Checkbox checked={f.sequential} onChange={(e) => setF({ ...f, sequential: e.target.checked })} label="Guided path — learners must complete steps in order" />
          {admin && <Checkbox checked={f.featured} onChange={(e) => setF({ ...f, featured: e.target.checked })} label="Feature this course on the home page" />}
        </div>
        <Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={() => save.mutate()}>
          Save changes
        </Button>
      </Card>
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CourseCover course={{ title: f.title, accent: f.accent || null, cover_url: f.cover_url || null, category: categories?.find((c) => c.id === f.category_id) }} />
          <div className="space-y-3 p-4">
            <Field label="Cover colour" htmlFor="d-accent" hint="Used for generated cover art">
              <div className="flex gap-2">
                <input id="d-accent" type="color" value={f.accent || '#03c14b'} onChange={(e) => setF({ ...f, accent: e.target.value })} className="h-11 w-14 cursor-pointer rounded-lg border border-ink-200" />
                <Button variant="ghost" size="sm" onClick={() => setF({ ...f, accent: '' })}>
                  Use track colour
                </Button>
              </div>
            </Field>
            <Field label="Cover image (optional)" htmlFor="d-cover">
              <input id="d-cover" type="file" accept="image/*" disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} className="block w-full text-sm" />
              {f.cover_url && (
                <button className="mt-1 text-xs text-red-600" onClick={() => setF({ ...f, cover_url: '' })}>
                  Remove image
                </button>
              )}
            </Field>
          </div>
        </Card>
        <Card className="p-4 text-sm text-ink-500">
          <p>Created {formatDate(course.created_at)}</p>
          {course.published_at && <p>Published {formatDate(course.published_at)}</p>}
          <p>{course.enrollment_count} learners enrolled</p>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------
function useCurriculum(courseId: string) {
  return useQuery({
    queryKey: ['studio-curriculum', courseId],
    queryFn: async () => {
      const [modules, lessons] = await Promise.all([
        supabase.from('modules').select('*').eq('course_id', courseId).order('position').then(must),
        supabase.from('lessons').select('*').eq('course_id', courseId).order('position').then(must),
      ]);
      return { modules: modules as Module[], lessons: lessons as Lesson[] };
    },
  });
}

function CurriculumTab({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useCurriculum(courseId);
  const [editingModule, setEditingModule] = useState<Partial<Module> | null>(null);
  const [editingLesson, setEditingLesson] = useState<Partial<Lesson> | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['studio-curriculum', courseId] });
  };

  async function move<T extends { id: string; position: number }>(table: 'modules' | 'lessons', list: T[], index: number, dir: -1 | 1) {
    const a = list[index];
    const b = list[index + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from(table).update({ position: b.position }).eq('id', a.id),
      supabase.from(table).update({ position: a.position }).eq('id', b.id),
    ]);
    refresh();
  }

  async function del(table: 'modules' | 'lessons', id: string, label: string) {
    if (!confirm(`Delete this ${label}? This cannot be undone.`)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) toast.error(error.message);
    refresh();
  }

  if (isLoading || !data) return <FullPageSpinner />;
  const { modules, lessons } = data;

  return (
    <>
      <div className="mb-4 flex justify-between">
        <p className="text-sm text-ink-500">
          {modules.length} modules · {lessons.length} lessons · {lessons.reduce((s, l) => s + l.duration_minutes, 0)} min
        </p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditingModule({ title: '', summary: '', position: (modules.at(-1)?.position ?? 0) + 1 })}>
          Add module
        </Button>
      </div>
      {!modules.length && <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No modules yet" body="Modules group related lessons, e.g. “Getting started”." />}
      <div className="space-y-4">
        {modules.map((m, mi) => {
          const ml = lessons.filter((l) => l.module_id === m.id).sort((a, b) => a.position - b.position);
          return (
            <Card key={m.id} className="overflow-hidden">
              <div className="flex items-center gap-3 bg-ink-50/70 px-4 py-3 dark:bg-ink-800/40">
                <GripVertical className="h-4 w-4 text-ink-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Module {mi + 1}</p>
                  <p className="truncate font-bold">{m.title}</p>
                </div>
                <IconBtn label="Move up" onClick={() => move('modules', modules, mi, -1)} disabled={mi === 0}>
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Move down" onClick={() => move('modules', modules, mi, 1)} disabled={mi === modules.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Edit module" onClick={() => setEditingModule(m)}>
                  <Pencil className="h-4 w-4" />
                </IconBtn>
                <IconBtn label="Delete module" onClick={() => del('modules', m.id, 'module and all its lessons')}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </IconBtn>
              </div>
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {ml.map((l, li) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 pl-11">
                    <BookOpen className="h-4 w-4 shrink-0 text-ink-400" />
                    <button className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-brand-600" onClick={() => setEditingLesson(l)}>
                      {l.title}
                    </button>
                    {l.is_preview && <Badge tone="blue">Preview</Badge>}
                    <span className="text-xs text-ink-400">{l.duration_minutes} min</span>
                    <IconBtn label="Move up" onClick={() => move('lessons', ml, li, -1)} disabled={li === 0}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn label="Move down" onClick={() => move('lessons', ml, li, 1)} disabled={li === ml.length - 1}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn label="Delete lesson" onClick={() => del('lessons', l.id, 'lesson')}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </IconBtn>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-2.5 pl-11">
                <button
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline"
                  onClick={() => setEditingLesson({ module_id: m.id, course_id: courseId, title: '', content: '', kind: 'article', duration_minutes: 8, position: (ml.at(-1)?.position ?? 0) + 1, is_preview: false, attachments: [] })}
                >
                  <Plus className="h-4 w-4" /> Add lesson
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <ModuleModal value={editingModule} courseId={courseId} onClose={() => setEditingModule(null)} onSaved={refresh} />
      <LessonModal value={editingLesson} modules={modules} onClose={() => setEditingLesson(null)} onSaved={refresh} />
    </>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-30 dark:hover:bg-ink-700">
      {children}
    </button>
  );
}

function ModuleModal({ value, courseId, onClose, onSaved }: { value: Partial<Module> | null; courseId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: '', summary: '' });
  useEffect(() => {
    setF({ title: value?.title ?? '', summary: value?.summary ?? '' });
  }, [value]);
  const save = useMutation({
    mutationFn: async () => {
      const row = { title: f.title.trim(), summary: f.summary.trim() || null };
      if (value?.id) must(await supabase.from('modules').update(row).eq('id', value.id));
      else must(await supabase.from('modules').insert({ ...row, course_id: courseId, position: value?.position ?? 1 }));
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={value?.id ? 'Edit module' : 'New module'}
      footer={
        <Button loading={save.isPending} disabled={!f.title.trim()} onClick={() => save.mutate()}>
          Save module
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Module title" htmlFor="m-title">
          <Input id="m-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
        </Field>
        <Field label="Summary (optional)" htmlFor="m-sum">
          <Textarea id="m-sum" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

const MD_HELP = `**bold**, *italic*, \`code\`, [link](https://…), ![image](url)
\`\`\`python  ← fenced code blocks with syntax highlighting
> [!TIP] / [!NOTE] / [!WARNING] / [!TRY]  ← callout boxes
| tables | work | too |`;

function LessonModal({ value, modules, onClose, onSaved }: { value: Partial<Lesson> | null; modules: Module[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Lesson>>({});
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    setF(value ?? {});
    setPreview(false);
  }, [value]);
  const save = useMutation({
    mutationFn: async () => {
      const row = {
        title: (f.title ?? '').trim(),
        module_id: f.module_id,
        course_id: f.course_id ?? modules.find((m) => m.id === f.module_id)?.course_id,
        content: f.content ?? '',
        kind: f.kind ?? 'article',
        video_url: f.video_url?.trim() || null,
        duration_minutes: Number(f.duration_minutes ?? 5),
        is_preview: !!f.is_preview,
        attachments: f.attachments ?? [],
      };
      if (f.id) must(await supabase.from('lessons').update(row).eq('id', f.id));
      else must(await supabase.from('lessons').insert({ ...row, position: f.position ?? 1 }));
    },
    onSuccess: () => {
      toast.success('Lesson saved');
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const words = (f.content ?? '').split(/\s+/).filter(Boolean).length;
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      size="xl"
      title={f.id ? 'Edit lesson' : 'New lesson'}
      footer={
        <>
          <Button variant="outline" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview((p) => !p)}>
            {preview ? 'Edit' : 'Preview'}
          </Button>
          <Button loading={save.isPending} disabled={!f.title?.trim()} onClick={() => save.mutate()}>
            Save lesson
          </Button>
        </>
      }
    >
      {preview ? (
        <div>
          <h1 className="text-3xl font-extrabold">{f.title}</h1>
          <Markdown className="mt-6">{f.content ?? ''}</Markdown>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px_120px]">
            <Field label="Lesson title" htmlFor="l-title">
              <Input id="l-title" value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </Field>
            <Field label="Module" htmlFor="l-mod">
              <Select id="l-mod" value={f.module_id} onChange={(e) => setF({ ...f, module_id: e.target.value })}>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Minutes" htmlFor="l-min">
              <Input id="l-min" type="number" min={1} value={f.duration_minutes ?? 5} onChange={(e) => setF({ ...f, duration_minutes: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Video URL (optional)" htmlFor="l-video" hint="YouTube link or direct .mp4 — videos need a connection; the text works offline.">
            <Input id="l-video" value={f.video_url ?? ''} onChange={(e) => setF({ ...f, video_url: e.target.value, kind: e.target.value ? 'video' : 'article' })} placeholder="https://youtu.be/…" />
          </Field>
          <Field label={`Lesson content (Markdown) · ${words} words`} htmlFor="l-content" hint={<pre className="whitespace-pre-wrap font-mono text-[11px]">{MD_HELP}</pre>}>
            <InsertImage onInsert={(md) => setF((x) => ({ ...x, content: `${x.content ?? ''}\n\n${md}\n` }))} />
            <Textarea id="l-content" rows={18} className="font-mono text-[13px]" value={f.content ?? ''} onChange={(e) => setF({ ...f, content: e.target.value })} />
          </Field>
          <Checkbox checked={!!f.is_preview} onChange={(e) => setF({ ...f, is_preview: e.target.checked })} label="Free preview — visible to visitors without an account" />
        </div>
      )}
    </Modal>
  );
}

function InsertImage({ onInsert }: { onInsert: (markdown: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800">
      <ImagePlus className="h-4 w-4" /> {busy ? 'Uploading…' : 'Insert image'}
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            const url = await uploadImage(file, 'lesson');
            onInsert(`![${file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')}](${url})`);
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------
type EditableQuestion = Question & { answer: string[]; explanation: string; _new?: boolean };

function QuizzesTab({ courseId, passMark }: { courseId: string; passMark: number }) {
  const qc = useQueryClient();
  const { data: curriculum } = useCurriculum(courseId);
  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['studio-quizzes', courseId],
    queryFn: async () => must(await supabase.from('quizzes').select('*, questions(count)').eq('course_id', courseId).order('position')) as (Quiz & { questions: { count: number }[] })[],
  });
  const [editing, setEditing] = useState<Partial<Quiz> | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['studio-quizzes', courseId] });
  };
  if (isLoading) return <FullPageSpinner />;
  const moduleName = (id: string | null) => curriculum?.modules.find((m) => m.id === id)?.title;
  return (
    <>
      <div className="mb-4 flex justify-between">
        <p className="text-sm text-ink-500">Module and final quizzes count toward completion. Practice quizzes give instant feedback, even offline.</p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ course_id: courseId, title: '', kind: 'module', pass_mark: passMark, shuffle_questions: true, show_answers: true, status: 'published', position: (quizzes?.length ?? 0) + 1, module_id: curriculum?.modules[0]?.id ?? null })}>
          Add quiz
        </Button>
      </div>
      {!quizzes?.length && <EmptyState icon={<FileQuestion className="h-5 w-5" />} title="No quizzes yet" body="Add a quiz after each module and a final exam." />}
      <div className="grid gap-3 md:grid-cols-2">
        {quizzes?.map((q) => (
          <Card key={q.id} className="flex items-center gap-4 p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${q.kind === 'final' ? 'bg-gold-300/30 text-gold-700' : 'bg-sky-50 text-sky-600 dark:bg-sky-950'}`}>
              {q.kind === 'final' ? <Award className="h-5 w-5" /> : <FileQuestion className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{q.title}</p>
              <p className="text-xs text-ink-500">
                {q.kind === 'final' ? 'Final exam' : q.kind === 'practice' ? 'Practice' : `Module: ${moduleName(q.module_id) ?? '—'}`} · {q.questions?.[0]?.count ?? 0} questions · pass {q.pass_mark}%
                {q.status === 'draft' && ' · draft'}
              </p>
            </div>
            <Button size="sm" variant="outline" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(q)}>
              Edit
            </Button>
          </Card>
        ))}
      </div>
      {editing && <QuizEditor quiz={editing} modules={curriculum?.modules ?? []} onClose={() => setEditing(null)} onSaved={refresh} />}
    </>
  );
}

function blankQuestion(kind: QuestionKind, position: number): EditableQuestion {
  const options =
    kind === 'true_false'
      ? [
          { id: 'true', text: 'True' },
          { id: 'false', text: 'False' },
        ]
      : kind === 'short'
        ? []
        : ['a', 'b', 'c', 'd'].map((id) => ({ id, text: '' }));
  return { id: uuid(), quiz_id: '', kind, prompt: '', options, points: 1, position, answer: [], explanation: '', _new: true };
}

function QuizEditor({ quiz, modules, onClose, onSaved }: { quiz: Partial<Quiz>; modules: Module[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Quiz>>(quiz);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['studio-quiz-questions', quiz.id],
    enabled: !!quiz.id,
    queryFn: async () => {
      const qs = must(await supabase.from('questions').select('*').eq('quiz_id', quiz.id!).order('position')) as Question[];
      const keys = qs.length ? (must(await supabase.from('question_keys').select('*').in('question_id', qs.map((q) => q.id))) as { question_id: string; answer: string[]; explanation: string | null }[]) : [];
      const km = new Map(keys.map((k) => [k.question_id, k]));
      setQuestions(qs.map((q) => ({ ...q, answer: km.get(q.id)?.answer ?? [], explanation: km.get(q.id)?.explanation ?? '' })));
      return qs;
    },
  });

  const problems = useMemo(
    () =>
      questions
        .map((q, i) => {
          if (!q.prompt.trim()) return `Question ${i + 1} has no prompt`;
          if (!q.answer.filter(Boolean).length) return `Question ${i + 1} has no correct answer`;
          if (q.kind !== 'short' && q.kind !== 'true_false' && q.options.some((o) => !o.text.trim())) return `Question ${i + 1} has an empty option`;
          return null;
        })
        .filter(Boolean) as string[],
    [questions],
  );

  const update = (i: number, patch: Partial<EditableQuestion>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  async function save() {
    if (!f.title?.trim()) return toast.error('Give the quiz a title.');
    if (problems.length) return toast.error(problems[0]);
    setSaving(true);
    try {
      const row = {
        course_id: f.course_id,
        module_id: f.kind === 'final' ? null : f.module_id || null,
        title: f.title.trim(),
        description: f.description?.trim() || null,
        kind: f.kind,
        time_limit_minutes: f.time_limit_minutes || null,
        pass_mark: Number(f.pass_mark ?? 70),
        max_attempts: f.max_attempts || null,
        shuffle_questions: !!f.shuffle_questions,
        show_answers: !!f.show_answers,
        status: f.status ?? 'published',
        position: f.position ?? 1,
      };
      let quizId = f.id;
      if (quizId) must(await supabase.from('quizzes').update(row).eq('id', quizId));
      else quizId = (must(await supabase.from('quizzes').insert(row).select('id').single()) as { id: string }).id;

      if (removed.length) must(await supabase.from('questions').delete().in('id', removed));
      const qRows = questions.map((q, i) => ({ id: q.id, quiz_id: quizId, kind: q.kind, prompt: q.prompt.trim(), options: q.kind === 'short' ? [] : q.options, points: q.points, position: i + 1 }));
      if (qRows.length) {
        must(await supabase.from('questions').upsert(qRows));
        must(
          await supabase
            .from('question_keys')
            .upsert(questions.map((q) => ({ question_id: q.id, answer: q.answer.map((a) => a.trim()).filter(Boolean), explanation: q.explanation.trim() || null }))),
        );
      }
      toast.success('Quiz saved');
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuiz() {
    if (!f.id || !confirm('Delete this quiz and all attempts?')) return;
    const { error } = await supabase.from('quizzes').delete().eq('id', f.id);
    if (error) return toast.error(error.message);
    onSaved();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={f.id ? 'Edit quiz' : 'New quiz'}
      footer={
        <>
          {f.id && (
            <Button variant="ghost" className="mr-auto text-red-600" icon={<Trash2 className="h-4 w-4" />} onClick={deleteQuiz}>
              Delete quiz
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save quiz
          </Button>
        </>
      }
    >
      {isLoading ? (
        <FullPageSpinner />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Title" htmlFor="q-title" className="sm:col-span-2">
              <Input id="q-title" value={f.title ?? ''} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </Field>
            <Field label="Type" htmlFor="q-kind">
              <Select id="q-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Quiz['kind'] })}>
                <option value="module">Module quiz (required)</option>
                <option value="final">Final exam (required)</option>
                <option value="practice">Practice (optional)</option>
              </Select>
            </Field>
            {f.kind !== 'final' && (
              <Field label="Module" htmlFor="q-mod">
                <Select id="q-mod" value={f.module_id ?? ''} onChange={(e) => setF({ ...f, module_id: e.target.value || null })}>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Pass mark %" htmlFor="q-pass">
              <Input id="q-pass" type="number" min={1} max={100} value={f.pass_mark ?? 70} onChange={(e) => setF({ ...f, pass_mark: Number(e.target.value) })} />
            </Field>
            <Field label="Time limit (min)" htmlFor="q-time" hint="Blank = none">
              <Input id="q-time" type="number" min={1} value={f.time_limit_minutes ?? ''} onChange={(e) => setF({ ...f, time_limit_minutes: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Max attempts" htmlFor="q-att" hint="Blank = unlimited">
              <Input id="q-att" type="number" min={1} value={f.max_attempts ?? ''} onChange={(e) => setF({ ...f, max_attempts: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Status" htmlFor="q-status">
              <Select id="q-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Quiz['status'] })}>
                <option value="published">Published</option>
                <option value="draft">Draft (hidden)</option>
              </Select>
            </Field>
          </div>
          <Field label="Instructions (optional)" htmlFor="q-desc">
            <Textarea id="q-desc" rows={2} value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-6">
            <Checkbox checked={!!f.shuffle_questions} onChange={(e) => setF({ ...f, shuffle_questions: e.target.checked })} label="Shuffle question order" />
            <Checkbox checked={!!f.show_answers} onChange={(e) => setF({ ...f, show_answers: e.target.checked })} label="Show correct answers & explanations after submitting" />
          </div>

          <div>
            <h3 className="mb-3 font-bold">Questions ({questions.length})</h3>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <Card key={q.id} className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink-400">Q{i + 1}</span>
                    <Select
                      value={q.kind}
                      onChange={(e) => {
                        const k = e.target.value as QuestionKind;
                        const b = blankQuestion(k, q.position);
                        update(i, { kind: k, options: k === 'single' || k === 'multiple' ? (q.options.length && q.kind !== 'true_false' ? q.options : b.options) : b.options, answer: [] });
                      }}
                      className="h-9 w-auto"
                      aria-label="Question type"
                    >
                      <option value="single">Single choice</option>
                      <option value="multiple">Multiple answers</option>
                      <option value="true_false">True / False</option>
                      <option value="short">Short text answer</option>
                    </Select>
                    <Input type="number" min={1} value={q.points} onChange={(e) => update(i, { points: Math.max(1, Number(e.target.value)) })} className="h-9 w-20" aria-label="Points" />
                    <span className="text-xs text-ink-400">pts</span>
                    <div className="flex-1" />
                    <IconBtn label="Move up" disabled={i === 0} onClick={() => setQuestions((qs) => { const c = [...qs]; [c[i - 1], c[i]] = [c[i]!, c[i - 1]!]; return c; })}>
                      <ArrowUp className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn label="Move down" disabled={i === questions.length - 1} onClick={() => setQuestions((qs) => { const c = [...qs]; [c[i + 1], c[i]] = [c[i]!, c[i + 1]!]; return c; })}>
                      <ArrowDown className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn
                      label="Delete question"
                      onClick={() => {
                        if (!q._new) setRemoved((r) => [...r, q.id]);
                        setQuestions((qs) => qs.filter((_, j) => j !== i));
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </IconBtn>
                  </div>
                  <Textarea className="mt-3" rows={2} placeholder="Question prompt (Markdown supported)" value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
                  {q.kind === 'short' ? (
                    <Field className="mt-3" label="Accepted answers" hint="One per line. Matching ignores case and extra spaces.">
                      <Textarea rows={2} value={q.answer.join('\n')} onChange={(e) => update(i, { answer: e.target.value.split('\n') })} />
                    </Field>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {q.options.map((o, oi) => {
                        const correct = q.answer.includes(o.id);
                        return (
                          <div key={o.id} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => update(i, { answer: q.kind === 'multiple' ? (correct ? q.answer.filter((a) => a !== o.id) : [...q.answer, o.id]) : [o.id] })}
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 text-xs font-bold ${correct ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 text-ink-400 dark:border-ink-700'}`}
                              aria-label={correct ? 'Correct answer' : 'Mark as correct'}
                              title="Mark as correct"
                            >
                              {correct ? '✓' : String.fromCharCode(65 + oi)}
                            </button>
                            <Input
                              value={o.text}
                              disabled={q.kind === 'true_false'}
                              onChange={(e) => update(i, { options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })}
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              className="h-9"
                            />
                            {q.kind !== 'true_false' && q.options.length > 2 && (
                              <IconBtn label="Remove option" onClick={() => update(i, { options: q.options.filter((x) => x.id !== o.id), answer: q.answer.filter((a) => a !== o.id) })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </IconBtn>
                            )}
                          </div>
                        );
                      })}
                      {q.kind !== 'true_false' && q.options.length < 8 && (
                        <button className="text-xs font-semibold text-brand-600" onClick={() => update(i, { options: [...q.options, { id: uuid().slice(0, 8), text: '' }] })}>
                          + Add option
                        </button>
                      )}
                    </div>
                  )}
                  <Input className="mt-3 h-9" placeholder="Explanation shown after answering (recommended)" value={q.explanation} onChange={(e) => update(i, { explanation: e.target.value })} />
                </Card>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(['single', 'multiple', 'true_false', 'short'] as QuestionKind[]).map((k) => (
                <Button key={k} size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setQuestions((qs) => [...qs, blankQuestion(k, qs.length + 1)])}>
                  {k === 'single' ? 'Single choice' : k === 'multiple' ? 'Multiple answers' : k === 'true_false' ? 'True/False' : 'Short answer'}
                </Button>
              ))}
            </div>
            {problems.length > 0 && questions.length > 0 && <p className="mt-3 text-xs text-amber-600">{problems[0]}</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Learners
// ---------------------------------------------------------------------------
function LearnersTab({ course }: { course: Course }) {
  const { data, isLoading } = useQuery({
    queryKey: ['course-learners', course.id],
    queryFn: async () =>
      must(
        await supabase
          .from('enrollments')
          .select('*, learner:profiles!enrollments_user_id_fkey(id, full_name, avatar_url, username, profiles_private(email))')
          .eq('course_id', course.id)
          .order('progress', { ascending: false }),
      ) as {
        user_id: string;
        progress: number;
        status: string;
        enrolled_at: string;
        last_activity_at: string;
        completed_at: string | null;
        learner: { id: string; full_name: string; avatar_url: string | null; username: string | null; profiles_private: { email: string } | null };
      }[],
  });
  if (isLoading) return <FullPageSpinner />;
  const exportCsv = () =>
    downloadText(
      `${course.slug}-learners.csv`,
      toCsv(
        (data ?? []).map((e) => ({
          name: e.learner.full_name,
          email: e.learner.profiles_private?.email ?? '',
          progress: e.progress,
          status: e.status,
          enrolled: e.enrolled_at,
          last_active: e.last_activity_at,
          completed: e.completed_at ?? '',
        })),
      ),
    );
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <p className="flex items-center gap-2 font-bold">
          <Users className="h-4 w-4" /> {data?.length ?? 0} learners
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data?.length}>
          Export CSV
        </Button>
      </div>
      {!data?.length ? (
        <div className="p-6">
          <EmptyState title="No learners yet" body="Once the course is published, enrolled learners appear here." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500 dark:bg-ink-800/50">
              <tr>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
              {data.map((e) => (
                <tr key={e.user_id}>
                  <td className="px-4 py-3">
                    <Link to={`/admin/learners/${e.user_id}`} className="flex items-center gap-3 hover:text-brand-600">
                      <Avatar name={e.learner.full_name} url={e.learner.avatar_url} size={32} />
                      <span>
                        <span className="block font-medium">{e.learner.full_name}</span>
                        <span className="text-xs text-ink-500">{e.learner.profiles_private?.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="w-48 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={e.progress} className="flex-1" />
                      <span className="w-10 text-right text-xs font-semibold">{e.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-500">{formatDate(e.enrolled_at)}</td>
                  <td className="px-4 py-3 text-ink-500">{timeAgo(e.last_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
