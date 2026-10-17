import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useCatalog, useCategories, useMyEnrollments } from '@/hooks/queries';
import { CourseCard } from '@/components/CourseCard';
import { EmptyState, Input, PageHeader, Select, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

function CatalogBody({ inApp }: { inApp: boolean }) {
  const { data: courses, isLoading } = useCatalog();
  const { data: categories } = useCategories();
  const { data: enrollments } = useMyEnrollments();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const cat = params.get('category') ?? '';
  const level = params.get('level') ?? '';
  const sort = params.get('sort') ?? 'popular';

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const progressById = useMemo(() => new Map(enrollments?.map((e) => [e.course_id, e.progress])), [enrollments]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    const list = (courses ?? []).filter(
      (c) =>
        (!cat || c.category?.slug === cat) &&
        (!level || c.level === level) &&
        (!needle || [c.title, c.subtitle, c.description, ...(c.tags ?? [])].join(' ').toLowerCase().includes(needle)),
    );
    if (sort === 'newest') list.sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
    if (sort === 'rating') list.sort((a, b) => Number(b.rating_avg) - Number(a.rating_avg));
    if (sort === 'short') list.sort((a, b) => Number(a.estimated_hours ?? 99) - Number(b.estimated_hours ?? 99));
    return list;
  }, [courses, q, cat, level, sort]);

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => set('q', e.target.value)} placeholder="Search courses, skills or tools…" className="pl-10" aria-label="Search courses" />
        </div>
        <div className="flex gap-2">
          <Select value={level} onChange={(e) => set('level', e.target.value)} aria-label="Level" className="w-auto">
            <option value="">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
          <Select value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort" className="w-auto">
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
            <option value="rating">Top rated</option>
            <option value="short">Shortest</option>
          </Select>
        </div>
      </div>
      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
        {[{ slug: '', name: 'All tracks' }, ...(categories ?? [])].map((c) => (
          <button
            key={c.slug}
            onClick={() => set('category', c.slug)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
              cat === c.slug
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300',
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-72" />)}
        {filtered.map((c) => (
          <CourseCard
            key={c.id}
            course={c}
            to={inApp ? `/app/catalog/${c.slug}` : `/courses/${c.slug}`}
            lessonCount={c.lessons?.[0]?.count}
            progress={progressById.get(c.id) ?? null}
          />
        ))}
      </div>
      {!isLoading && filtered.length === 0 && (
        <EmptyState icon={<SlidersHorizontal className="h-5 w-5" />} title="No courses match your filters" body="Try a different search term or track." />
      )}
    </>
  );
}

export function PublicCatalog() {
  return (
    <div className="container-page py-10">
      <PageHeader title="Explore courses" subtitle="Practical, beginner-friendly courses from Digital Bridge Initiative. All free." />
      <CatalogBody inApp={false} />
    </div>
  );
}

export function AppCatalog() {
  return (
    <>
      <PageHeader title="Explore courses" subtitle="Find your next skill. Every course is free and comes with a certificate." />
      <CatalogBody inApp />
    </>
  );
}
