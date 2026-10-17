import { useQuery } from '@tanstack/react-query';
import { Megaphone, Pin } from 'lucide-react';
import { supabase, must } from '@/lib/supabase';
import { Avatar, Badge, Card, EmptyState, FullPageSpinner, PageHeader } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { formatDate } from '@/lib/utils';

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  course_id: string | null;
  course: { title: string } | null;
  author: { full_name: string; avatar_url: string | null } | null;
};

export const ANNOUNCEMENT_SELECT = '*, course:courses(title), author:profiles!announcements_author_id_fkey(full_name,avatar_url)';

export function Announcements() {
  const { data, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () =>
      must(await supabase.from('announcements').select(ANNOUNCEMENT_SELECT).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50)) as AnnouncementRow[],
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Announcements" subtitle="News from Digital Bridge Initiative and your instructors." />
      {isLoading && <FullPageSpinner />}
      {!isLoading && !data?.length && <EmptyState icon={<Megaphone className="h-5 w-5" />} title="No announcements yet" />}
      <div className="space-y-4">
        {data?.map((a) => (
          <Card key={a.id} className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              {a.pinned && (
                <Badge tone="blue">
                  <Pin className="h-3 w-3" /> Pinned
                </Badge>
              )}
              <Badge>{a.course?.title ?? 'All learners'}</Badge>
              <span className="text-xs text-ink-400">{formatDate(a.created_at, { dateStyle: 'long' })}</span>
            </div>
            <h2 className="mt-3 text-xl font-bold">{a.title}</h2>
            <Markdown className="mt-2">{a.body}</Markdown>
            {a.author && (
              <div className="mt-4 flex items-center gap-2 text-sm text-ink-500">
                <Avatar name={a.author.full_name} url={a.author.avatar_url} size={24} /> {a.author.full_name}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
