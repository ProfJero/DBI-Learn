import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageCircleQuestion, Plus } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { useMyEnrollments } from '@/hooks/queries';
import { Button, EmptyState, FullPageSpinner, Modal, PageHeader, Tabs } from '@/components/ui';
import { AskQuestionForm, QUESTION_SELECT, QuestionCard, QuestionDetail, type QuestionRow } from '@/components/qa/QA';

export function MyQuestions() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const navigate = useNavigate();
  const [tab, setTab] = useState<'mine' | 'class'>('mine');
  const [asking, setAsking] = useState(false);
  const { data: enrollments } = useMyEnrollments();
  const courses = (enrollments ?? []).map((e) => ({ id: e.course_id, title: e.course.title }));

  const { data, isLoading } = useQuery({
    queryKey: ['questions', 'list', tab],
    staleTime: 0,
    queryFn: async () => {
      let q = supabase.from('course_questions').select(QUESTION_SELECT).order('created_at', { ascending: false }).limit(100);
      q = tab === 'mine' ? q.eq('asker_id', uid) : q.eq('visibility', 'public').in('course_id', courses.map((c) => c.id));
      return must(await q) as QuestionRow[];
    },
    enabled: tab === 'mine' || !!enrollments,
  });

  return (
    <>
      <PageHeader
        title="Ask a teacher"
        subtitle="Stuck? Ask a question about any lesson. Teachers reply here and you get a notification."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAsking(true)} disabled={!courses.length}>
            Ask a question
          </Button>
        }
      />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'mine', label: 'My questions' },
          { value: 'class', label: 'Class questions' },
        ]}
      />
      {isLoading && <FullPageSpinner />}
      {data && !data.length && (
        <EmptyState
          icon={<MessageCircleQuestion className="h-5 w-5" />}
          title={tab === 'mine' ? 'You have not asked anything yet' : 'No public questions yet'}
          body={courses.length ? 'There is no silly question. Ask about any lesson and a teacher will help.' : 'Join a course first, then you can ask its teachers.'}
          action={
            !courses.length && (
              <Link className="font-semibold text-brand-600" to="/app/catalog">
                Explore courses
              </Link>
            )
          }
        />
      )}
      <div className="space-y-2">
        {data?.map((q) => (
          <QuestionCard key={q.id} q={q} to={`/app/questions/${q.id}`} />
        ))}
      </div>
      <Modal open={asking} onClose={() => setAsking(false)} title="Ask a teacher" size="lg">
        <AskQuestionForm courses={courses} onDone={(id) => navigate(`/app/questions/${id}`)} />
      </Modal>
    </>
  );
}

export function QuestionPage() {
  const { id = '' } = useParams();
  return (
    <>
      <Link to="/app/questions" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> All questions
      </Link>
      <QuestionDetail id={id} />
    </>
  );
}

