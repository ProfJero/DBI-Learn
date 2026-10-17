import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { formatDate, isAdminRole } from '@/lib/utils';
import { ANNOUNCEMENT_SELECT, type AnnouncementRow } from '@/pages/app/Announcements';

export function StudioAnnouncements() {
  const { profile } = useAuth();
  const admin = isAdminRole(profile?.role);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', body: '', course_id: '', pinned: false });
  const { data } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => must(await supabase.from('announcements').select(ANNOUNCEMENT_SELECT).order('created_at', { ascending: false }).limit(100)) as AnnouncementRow[],
  });
  const { data: courses } = useQuery({
    queryKey: ['ann-courses', profile?.id],
    queryFn: async () => {
      let q = supabase.from('courses').select('id, title').order('title');
      if (!admin) q = q.eq('instructor_id', profile!.id);
      return must(await q) as { id: string; title: string }[];
    },
  });
  const post = useMutation({
    mutationFn: async () => must(await supabase.from('announcements').insert({ title: f.title.trim(), body: f.body.trim(), course_id: f.course_id || null, pinned: f.pinned, author_id: profile!.id })),
    onSuccess: () => {
      toast.success(f.course_id ? 'Posted — enrolled learners have been notified.' : 'Posted to all learners.');
      setOpen(false);
      setF({ title: '', body: '', course_id: '', pinned: false });
      void qc.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ['announcements'] });
  };
  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Share news with all learners or with a single course."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            New announcement
          </Button>
        }
      />
      {!data?.length && <EmptyState icon={<Megaphone className="h-5 w-5" />} title="No announcements yet" />}
      <div className="space-y-4">
        {data?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {a.pinned && <Badge tone="blue"><Pin className="h-3 w-3" /> Pinned</Badge>}
                <Badge>{a.course?.title ?? 'All learners'}</Badge>
                <span className="text-xs text-ink-400">
                  {formatDate(a.created_at)} · {a.author?.full_name}
                </span>
              </div>
              {(admin || a.author?.full_name === profile?.full_name) && (
                <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <h2 className="mt-2 text-lg font-bold">{a.title}</h2>
            <Markdown className="mt-1">{a.body}</Markdown>
          </Card>
        ))}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New announcement"
        footer={
          <Button loading={post.isPending} disabled={!f.title.trim() || !f.body.trim() || (!admin && !f.course_id)} onClick={() => post.mutate()}>
            Post announcement
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Audience" htmlFor="an-aud">
            <Select id="an-aud" value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
              {admin ? <option value="">All learners (platform-wide)</option> : <option value="">Choose one of your courses…</option>}
              {courses?.map((c) => (
                <option key={c.id} value={c.id}>
                  Learners in: {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" htmlFor="an-title">
            <Input id="an-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Message" htmlFor="an-body" hint="Markdown supported">
            <Textarea id="an-body" rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </Field>
          <Checkbox checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} label="Pin to the top" />
        </div>
      </Modal>
    </>
  );
}
