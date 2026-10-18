import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useMyEnrollments } from '@/hooks/queries';
import { CourseCard } from '@/components/CourseCard';
import { EmptyState, LinkButton, PageHeader, Skeleton, Tabs } from '@/components/ui';

export function MyCourses() {
  const { data, isLoading } = useMyEnrollments();
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const list = data?.filter((e) => e.status === tab) ?? [];
  return (
    <>
      <PageHeader
        title="My learning"
        subtitle="Pick up where you left off."
        actions={<LinkButton to="/app/catalog" variant="outline">Find more courses</LinkButton>}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'active', label: 'In progress', count: data?.filter((e) => e.status === 'active').length },
          { value: 'completed', label: 'Completed', count: data?.filter((e) => e.status === 'completed').length },
        ]}
      />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-72" />)}
        {list.map((e) => (
          <CourseCard key={e.course_id} course={e.course} to={`/app/learn/${e.course.slug}`} progress={e.progress} />
        ))}
      </div>
      {!isLoading && !list.length && (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title={tab === 'active' ? 'No courses in progress' : 'No completed courses yet'}
          body={tab === 'active' ? 'Enroll in a course to start learning.' : 'Finish all lessons and pass the quizzes to complete a course.'}
          action={<LinkButton to="/app/catalog">Explore courses</LinkButton>}
        />
      )}
    </>
  );
}
