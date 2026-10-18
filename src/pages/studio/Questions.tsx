import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageCircleQuestion } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { EmptyState, FullPageSpinner, PageHeader, Tabs } from '@/components/ui';
import { QUESTION_SELECT, QuestionCard, QuestionDetail, type QuestionRow } from '@/components/qa/QA';

type Filter = 'open' | 'answered' | 'closed' | 'all';

/** Questions on the courses this staff member manages (RLS limits instructors to their own courses). */
export function QuestionsInbox() {
  const { profile } = useAuth();
  const instructor = profile?.role === 'instructor';
  const [filter, setFilter] = useState<Filter>('open');
  const { data, isLoading } = useQuery({
    queryKey: ['questions', 'studio', filter],
    staleTime: 0,
    queryFn: async () => {
      // Instructors can read public questions on any course, but only answer on their own.
      let q = supabase
        .from('course_questions')
        .select(instructor ? QUESTION_SELECT.replace('course:courses(', 'course:courses!inner(instructor_id,') : QUESTION_SELECT).order('vote_count', { ascending: false }).order('created_at', { ascending: filter !== 'open' ? false : true }).limit(200);
      if (filter !== 'all') q = q.eq('status', filter);
      if (instructor) q = q.eq('course.instructor_id', profile!.id);
      return must(await q) as unknown as QuestionRow[];
    },
  });
  return (
    <>
      <PageHeader title="Learner questions" subtitle="Answer questions about your courses. Private questions are only seen by you and the learner." />
      <Tabs
        className="mb-4"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'open', label: 'Waiting' },
          { value: 'answered', label: 'Answered' },
          { value: 'closed', label: 'Closed' },
          { value: 'all', label: 'All' },
        ]}
      />
      {isLoading && <FullPageSpinner />}
      {data && !data.length && <EmptyState icon={<MessageCircleQuestion className="h-5 w-5" />} title={filter === 'open' ? 'All caught up — no one is waiting' : 'Nothing here'} />}
      <div className="space-y-2">
        {data?.map((q) => (
          <QuestionCard key={q.id} q={q} to={`/admin/questions/${q.id}`} />
        ))}
      </div>
    </>
  );
}

export function StudioQuestion() {
  const { id = '' } = useParams();
  return (
    <>
      <Link to="/admin/questions" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> All questions
      </Link>
      <QuestionDetail id={id} studio />
    </>
  );
}
