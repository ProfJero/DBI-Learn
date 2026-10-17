import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Library, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { isAdminRole } from '@/lib/utils';
import type { ResourceRow } from '@/pages/app/Resources';

const blank: Partial<ResourceRow> = { title: '', url: '', description: '', kind: 'link', category: '', course_id: null, is_public: true };

export function StudioResources() {
  const { profile } = useAuth();
  const admin = isAdminRole(profile?.role);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ResourceRow> | null>(null);
  const { data } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => must(await supabase.from('resources').select('*, course:courses(title)').order('category').order('title')) as ResourceRow[],
  });
  const { data: courses } = useQuery({
    queryKey: ['res-courses', profile?.id],
    queryFn: async () => {
      let q = supabase.from('courses').select('id, title').order('title');
      if (!admin) q = q.eq('instructor_id', profile!.id);
      return must(await q) as { id: string; title: string }[];
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const e = editing!;
      const row = { title: e.title!.trim(), url: e.url!.trim(), description: e.description?.trim() || null, kind: e.kind, category: e.category?.trim() || null, course_id: e.course_id || null, is_public: e.is_public ?? true, created_by: profile!.id };
      if (e.id) must(await supabase.from('resources').update(row).eq('id', e.id));
      else must(await supabase.from('resources').insert(row));
    },
    onSuccess: () => {
      toast.success('Resource saved');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['resources'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader
        title="Resource library"
        subtitle="Curate tools, references and downloads for learners."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ ...blank, course_id: admin ? null : courses?.[0]?.id ?? null })}>
            Add resource
          </Button>
        }
      />
      {!data?.length && <EmptyState icon={<Library className="h-5 w-5" />} title="No resources yet" />}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((r) => (
          <Card key={r.id} className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.title}</p>
              <a href={r.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-sky-600">
                {r.url}
              </a>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge className="capitalize">{r.kind}</Badge>
                {r.category && <Badge tone="blue">{r.category}</Badge>}
                {r.course && <Badge tone="green">{r.course.title}</Badge>}
              </div>
            </div>
            <button className="rounded-lg p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Edit" onClick={() => setEditing(r)}>
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
              aria-label="Delete"
              onClick={async () => {
                if (!confirm('Delete this resource?')) return;
                const { error } = await supabase.from('resources').delete().eq('id', r.id);
                if (error) toast.error(error.message);
                void qc.invalidateQueries({ queryKey: ['resources'] });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        ))}
      </div>
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit resource' : 'Add resource'}
        footer={
          <Button loading={save.isPending} disabled={!editing?.title?.trim() || !/^https?:\/\//.test(editing?.url ?? '')} onClick={() => save.mutate()}>
            Save
          </Button>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Title" htmlFor="r-title">
              <Input id="r-title" value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="URL" htmlFor="r-url">
              <Input id="r-url" type="url" value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://" />
            </Field>
            <Field label="Description" htmlFor="r-desc">
              <Textarea id="r-desc" rows={3} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" htmlFor="r-kind">
                <Select id="r-kind" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as ResourceRow['kind'] })}>
                  <option value="link">Website</option>
                  <option value="tool">Tool</option>
                  <option value="article">Article</option>
                  <option value="video">Video</option>
                  <option value="pdf">PDF</option>
                </Select>
              </Field>
              <Field label="Category" htmlFor="r-cat">
                <Input id="r-cat" value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="e.g. Practice" />
              </Field>
            </div>
            <Field label="Course (optional)" htmlFor="r-course">
              <Select id="r-course" value={editing.course_id ?? ''} onChange={(e) => setEditing({ ...editing, course_id: e.target.value || null })}>
                {admin && <option value="">Library-wide</option>}
                {courses?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Checkbox checked={editing.is_public ?? true} onChange={(e) => setEditing({ ...editing, is_public: e.target.checked })} label="Visible to learners" />
          </div>
        )}
      </Modal>
    </>
  );
}
