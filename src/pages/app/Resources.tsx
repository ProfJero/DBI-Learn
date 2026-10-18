import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Library, PlayCircle, Search, Wrench, Newspaper } from 'lucide-react';
import { supabase, must } from '@/lib/supabase';
import { Badge, Card, EmptyState, Input, PageHeader, Skeleton } from '@/components/ui';

export type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  kind: 'link' | 'pdf' | 'video' | 'tool' | 'article';
  category: string | null;
  course_id: string | null;
  is_public: boolean;
  course?: { title: string } | null;
};

const ICON = { link: ExternalLink, pdf: FileText, video: PlayCircle, tool: Wrench, article: Newspaper };

export function Resources() {
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => must(await supabase.from('resources').select('*, course:courses(title)').order('category').order('title')) as ResourceRow[],
  });
  const groups = useMemo(() => {
    const n = q.toLowerCase();
    const list = (data ?? []).filter((r) => !n || `${r.title} ${r.description} ${r.category}`.toLowerCase().includes(n));
    const m = new Map<string, ResourceRow[]>();
    list.forEach((r) => m.set(r.category ?? 'General', [...(m.get(r.category ?? 'General') ?? []), r]));
    return [...m.entries()];
  }, [data, q]);
  return (
    <>
      <PageHeader title="Resource library" subtitle="Hand-picked free tools, references and practice sites to go further." />
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources…" aria-label="Search resources" />
      </div>
      {isLoading && <Skeleton className="h-60" />}
      {!isLoading && !groups.length && <EmptyState icon={<Library className="h-5 w-5" />} title="No resources found" />}
      <div className="space-y-8">
        {groups.map(([cat, items]) => (
          <section key={cat}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">{cat}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((r) => {
                const I = ICON[r.kind];
                return (
                  <a key={r.id} href={r.url} target="_blank" rel="noreferrer">
                    <Card className="flex h-full gap-3 p-4 transition hover:shadow-lift">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950">
                        <I className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">{r.title}</p>
                        {r.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-500">{r.description}</p>}
                        {r.course && <Badge className="mt-2">{r.course.title}</Badge>}
                      </div>
                    </Card>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
