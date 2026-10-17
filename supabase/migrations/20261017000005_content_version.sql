-- Any change to a course's content bumps courses.updated_at, so offline copies on devices refresh.
create or replace function public.bump_course_version()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare cid uuid;
begin
  if tg_table_name in ('modules', 'lessons', 'quizzes') then
    cid := coalesce(new.course_id, old.course_id);
  elsif tg_table_name = 'questions' then
    select course_id into cid from public.quizzes where id = coalesce(new.quiz_id, old.quiz_id);
  elsif tg_table_name = 'question_keys' then
    select q.course_id into cid from public.questions qu join public.quizzes q on q.id = qu.quiz_id
     where qu.id = coalesce(new.question_id, old.question_id);
  end if;
  if cid is not null then
    update public.courses set updated_at = now() where id = cid;
  end if;
  return null;
end $$;
revoke execute on function public.bump_course_version() from public, anon, authenticated;

create trigger modules_bump after insert or update or delete on public.modules
  for each row execute function public.bump_course_version();
create trigger lessons_bump after insert or update or delete on public.lessons
  for each row execute function public.bump_course_version();
create trigger quizzes_bump after insert or update or delete on public.quizzes
  for each row execute function public.bump_course_version();
create trigger questions_bump after insert or update or delete on public.questions
  for each row execute function public.bump_course_version();
create trigger question_keys_bump after insert or update or delete on public.question_keys
  for each row execute function public.bump_course_version();
