-- Ask-the-instructor Q&A. Learners ask about a course, module or lesson, either
-- publicly (every learner of the course can read it and say "I have this question too")
-- or privately (only the asker and the course's staff). The course instructor and admins answer.

create table public.course_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid references public.modules (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  asker_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(title) between 5 and 200),
  body text not null default '' check (length(body) <= 10000),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  featured boolean not null default false,
  vote_count integer not null default 0,
  answer_count integer not null default 0,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.course_questions (course_id, created_at desc);
create index on public.course_questions (lesson_id);
create index on public.course_questions (module_id);
create index on public.course_questions (asker_id);
create index on public.course_questions (status, created_at desc);

create table public.course_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.course_questions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 10000),
  from_staff boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.course_answers (question_id, created_at);
create index on public.course_answers (author_id);

create table public.question_votes (
  question_id uuid not null references public.course_questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, user_id)
);
create index on public.question_votes (user_id);

create trigger course_questions_touch before update on public.course_questions for each row execute function public.touch_updated_at();
create trigger course_answers_touch before update on public.course_answers for each row execute function public.touch_updated_at();

-- Who can see a question: public ones follow the course; private ones only the asker and course staff.
create or replace function public.can_view_question(p_question_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.course_questions q
    where q.id = p_question_id
      and (q.asker_id = auth.uid()
           or public.can_manage_course(q.course_id)
           or (q.visibility = 'public' and public.can_view_course(q.course_id)))
  )
$$;

-- Fill in module/course from the lesson, and tell the course's staff.
create or replace function public.on_course_question()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  c record;
  staff uuid;
begin
  if tg_when = 'BEFORE' then
    if new.lesson_id is not null then
      select l.module_id, l.course_id into new.module_id, new.course_id from public.lessons l where l.id = new.lesson_id;
    elsif new.module_id is not null then
      select m.course_id into new.course_id from public.modules m where m.id = new.module_id;
    end if;
    new.status := 'open';
    new.featured := false;
    new.vote_count := 0;
    new.answer_count := 0;
    new.answered_at := null;
    return new;
  end if;
  -- AFTER INSERT: notify the course instructor, or every admin when the course has none.
  select id, title, instructor_id into c from public.courses where id = new.course_id;
  for staff in
    select c.instructor_id where c.instructor_id is not null and c.instructor_id <> new.asker_id
    union
    select p.id from public.profiles p
    where c.instructor_id is null and p.role in ('admin', 'super_admin') and p.status = 'active' and p.id <> new.asker_id
  loop
    perform public._notify(staff, 'question',
      case when new.visibility = 'private' then 'Private question: ' else 'New question: ' end || left(new.title, 70),
      left(c.title, 80), '/admin/questions/' || new.id);
  end loop;
  return null;
end $$;
create trigger course_questions_before before insert on public.course_questions
  for each row execute function public.on_course_question();
create trigger course_questions_after after insert on public.course_questions
  for each row execute function public.on_course_question();

-- Stamp staff answers, update counts and status, and notify the other side.
create or replace function public.on_course_answer()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare q record;
begin
  if tg_op = 'DELETE' then
    update public.course_questions set answer_count = greatest(answer_count - 1, 0) where id = old.question_id;
    return null;
  end if;
  select * into q from public.course_questions where id = new.question_id;
  if tg_when = 'BEFORE' then
    new.from_staff := public.can_manage_course(q.course_id);
    return new;
  end if;
  update public.course_questions
     set answer_count = answer_count + 1,
         status = case when new.from_staff and status = 'open' then 'answered' else status end,
         answered_at = case when new.from_staff then coalesce(answered_at, new.created_at) else answered_at end
   where id = q.id;
  if new.from_staff and q.asker_id <> new.author_id then
    perform public._notify(q.asker_id, 'question', 'Your question was answered', left(q.title, 120), '/app/questions/' || q.id);
    perform public._award_xp(q.asker_id, 5, 'question_answered', q.id);
  elsif not new.from_staff then
    -- A follow-up from the asker reopens the question for staff.
    update public.course_questions set status = 'open' where id = q.id and status = 'answered';
  end if;
  return null;
end $$;
create trigger course_answers_before before insert on public.course_answers
  for each row execute function public.on_course_answer();
create trigger course_answers_after after insert or delete on public.course_answers
  for each row execute function public.on_course_answer();

create or replace function public.on_question_vote()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.course_questions
     set vote_count = greatest(vote_count + case when tg_op = 'INSERT' then 1 else -1 end, 0)
   where id = coalesce(new.question_id, old.question_id);
  return null;
end $$;
create trigger question_votes_after after insert or delete on public.question_votes
  for each row execute function public.on_question_vote();

-- RLS
alter table public.course_questions enable row level security;
alter table public.course_answers enable row level security;
alter table public.question_votes enable row level security;

create policy "questions: visible to asker, staff, or course readers when public" on public.course_questions
  for select to authenticated
  using (asker_id = (select auth.uid())
         or (select public.can_manage_course(course_id))
         or (visibility = 'public' and (select public.can_view_course(course_id))));
create policy "questions: learners ask" on public.course_questions for insert to authenticated
  with check (asker_id = (select auth.uid()) and (select public.can_view_course(course_id)));
create policy "questions: asker or staff edit" on public.course_questions for update to authenticated
  using (asker_id = (select auth.uid()) or (select public.can_manage_course(course_id)))
  with check ((select public.can_manage_course(course_id)) or (not featured));
create policy "questions: asker or staff delete" on public.course_questions for delete to authenticated
  using (asker_id = (select auth.uid()) or (select public.can_manage_course(course_id)));
revoke update on public.course_questions from anon, authenticated;
grant update (title, body, visibility, status, featured) on public.course_questions to authenticated;

create policy "answers: readers of question" on public.course_answers for select to authenticated
  using ((select public.can_view_question(question_id)));
create policy "answers: staff and the asker reply" on public.course_answers for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.course_questions q
    where q.id = question_id and q.status <> 'closed'
      and (q.asker_id = (select auth.uid()) or (select public.can_manage_course(q.course_id)))));
create policy "answers: author edits" on public.course_answers for update to authenticated
  using (author_id = (select auth.uid()));
create policy "answers: author or staff delete" on public.course_answers for delete to authenticated
  using (author_id = (select auth.uid()) or exists (
    select 1 from public.course_questions q where q.id = question_id and (select public.can_manage_course(q.course_id))));
revoke update on public.course_answers from anon, authenticated;
grant update (body) on public.course_answers to authenticated;

create policy "votes: own" on public.question_votes for select to authenticated using (user_id = (select auth.uid()));
create policy "votes: vote on visible public questions" on public.question_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.course_questions q
    where q.id = question_id and q.visibility = 'public' and q.asker_id <> (select auth.uid())
      and (select public.can_view_course(q.course_id))));
create policy "votes: remove own" on public.question_votes for delete to authenticated using (user_id = (select auth.uid()));

revoke execute on function public.on_course_question(), public.on_course_answer(), public.on_question_vote() from public, anon, authenticated;
grant execute on function public.can_view_question(uuid) to authenticated;
