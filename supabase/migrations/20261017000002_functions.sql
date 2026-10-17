-- DBI Learn — triggers, internal helpers and RPCs

-- ---------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger courses_touch before update on public.courses for each row execute function public.touch_updated_at();
create trigger lessons_touch before update on public.lessons for each row execute function public.touch_updated_at();
create trigger quizzes_touch before update on public.quizzes for each row execute function public.touch_updated_at();
create trigger tickets_touch before update on public.support_tickets for each row execute function public.touch_updated_at();
create trigger threads_touch before update on public.discussion_threads for each row execute function public.touch_updated_at();
create trigger reviews_touch before update on public.course_reviews for each row execute function public.touch_updated_at();

-- New auth user -> profile. Role is ALWAYS student here; staff roles are granted afterwards
-- by the staff-admin edge function or set_user_role().
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname text := lower(nullif(trim(meta ->> 'username'), ''));
  dob date;
begin
  if uname is not null and (uname !~ '^[a-z0-9_.]{3,30}$'
      or exists (select 1 from public.profiles where username = uname)) then
    uname := null;
  end if;
  begin
    dob := nullif(meta ->> 'date_of_birth', '')::date;
  exception when others then
    dob := null;
  end;

  insert into public.profiles (id, full_name, username)
  values (new.id, coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1)), uname);

  insert into public.profiles_private (id, email, phone, school, date_of_birth, gender)
  values (new.id, new.email, nullif(meta ->> 'phone', ''), nullif(meta ->> 'school', ''), dob,
          nullif(meta ->> 'gender', ''));

  insert into public.notifications (user_id, kind, title, body, link)
  values (new.id, 'welcome', 'Welcome to DBI Learn! 🎉',
          'Pick your first course and start building your digital skills today.', '/app/catalog');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles_private set email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Instructors may draft and submit courses for review, only admins publish.
create or replace function public.guard_course_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
      raise exception 'Only administrators can publish courses. Submit it for review instead.'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.instructor_id is distinct from old.instructor_id then
      raise exception 'Only administrators can reassign a course instructor.' using errcode = '42501';
    end if;
    if new.featured and (tg_op = 'INSERT' or not old.featured) then
      raise exception 'Only administrators can feature courses.' using errcode = '42501';
    end if;
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

create trigger courses_guard before insert or update on public.courses
  for each row execute function public.guard_course_status();

-- Denormalised counters
create or replace function public.sync_enrollment_count()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare cid uuid := coalesce(new.course_id, old.course_id);
begin
  update public.courses set enrollment_count = (select count(*) from public.enrollments where course_id = cid)
  where id = cid;
  return null;
end $$;
create trigger enrollments_count after insert or delete on public.enrollments
  for each row execute function public.sync_enrollment_count();

create or replace function public.sync_course_rating()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare cid uuid := coalesce(new.course_id, old.course_id);
begin
  update public.courses c set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.course_reviews where course_id = cid), 0),
    rating_count = (select count(*) from public.course_reviews where course_id = cid)
  where c.id = cid;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.course_reviews
  for each row execute function public.sync_course_rating();

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable from the API)
-- ---------------------------------------------------------------------------
create or replace function public._audit(p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'))
$$;

create or replace function public._notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text default null)
returns void language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link)
$$;

create or replace function public._award_xp(p_user uuid, p_amount integer, p_reason text, p_ref uuid default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_amount <= 0 then return; end if;
  insert into public.xp_events (user_id, amount, reason, ref_id) values (p_user, p_amount, p_reason, p_ref);
  update public.profiles set xp = xp + p_amount where id = p_user;
end $$;

-- Returns true if newly awarded
create or replace function public._award_badge(p_user uuid, p_code text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare b record;
begin
  insert into public.user_badges (user_id, badge_code) values (p_user, p_code)
  on conflict do nothing;
  if not found then return false; end if;
  select * into b from public.badges where code = p_code;
  perform public._notify(p_user, 'badge', 'New badge: ' || coalesce(b.name, p_code) || ' ' || coalesce(b.icon, ''),
                         b.description, '/app/achievements');
  return true;
end $$;

-- Streaks are day-based (UTC == Ghana time). Offline events may arrive late; only newer days count.
create or replace function public._bump_streak(p_user uuid, p_at timestamptz default now())
returns void language plpgsql security definer set search_path = ''
as $$
declare
  d date := (least(coalesce(p_at, now()), now()) at time zone 'UTC')::date;
  p record;
  new_streak integer;
begin
  select streak, longest_streak, last_active_date into p from public.profiles where id = p_user for update;
  if p.last_active_date is not null and d <= p.last_active_date then return; end if;
  if p.last_active_date = d - 1 then new_streak := p.streak + 1; else new_streak := 1; end if;
  update public.profiles
     set streak = new_streak, longest_streak = greatest(longest_streak, new_streak), last_active_date = d
   where id = p_user;
  if new_streak >= 3 then perform public._award_badge(p_user, 'streak_3'); end if;
  if new_streak >= 7 then perform public._award_badge(p_user, 'streak_7'); end if;
  if new_streak >= 30 then perform public._award_badge(p_user, 'streak_30'); end if;
end $$;

create or replace function public._ensure_enrolled(p_user uuid, p_course uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.enrollments (user_id, course_id) values (p_user, p_course) on conflict do nothing;
end $$;

-- Issue the completion certificate for a course (idempotent). Returns the serial.
create or replace function public._issue_course_certificate(p_user uuid, p_course uuid, p_grade integer)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  c record;
  existing text;
  sigs jsonb;
  hrs numeric;
  serial text;
  kind text := case when p_grade >= 85 then 'distinction' else 'completion' end;
begin
  select serial into existing from public.certificates
   where user_id = p_user and course_id = p_course and status = 'valid';
  if existing is not null then return existing; end if;

  select co.*, cat.name as category_name, cat.signatory as category_signatory
    into c
    from public.courses co left join public.categories cat on cat.id = co.category_id
   where co.id = p_course;
  if not found or not c.certificate_enabled then return null; end if;

  sigs := coalesce((select value -> 'signatories' from public.settings where key = 'certificate'), '[]'::jsonb);
  if c.category_signatory is not null and not sigs @> jsonb_build_array(c.category_signatory) then
    sigs := sigs || jsonb_build_array(c.category_signatory);
  end if;
  hrs := coalesce(c.estimated_hours,
                  round((select coalesce(sum(duration_minutes), 0) from public.lessons where course_id = p_course) / 60.0, 1));

  insert into public.certificates (user_id, recipient_name, recipient_email, course_id, course_title, category_name,
                                   kind, grade, hours, signatories, description)
  select p_user, pr.full_name, pp.email, p_course, c.title, c.category_name, kind, p_grade, hrs, sigs,
         'For successfully completing all lessons and assessments of the ' || c.title || ' programme.'
    from public.profiles pr left join public.profiles_private pp on pp.id = pr.id
   where pr.id = p_user
  returning certificates.serial into serial;

  perform public._notify(p_user, 'certificate', 'Your certificate is ready 🎓',
                         'Congratulations on completing ' || c.title || '! Download and share your certificate.',
                         '/app/certificates/' || serial);
  return serial;
end $$;

-- Recompute a learner's progress in a course; completes the course + issues certificate when done.
create or replace function public._recompute_progress(p_user uuid, p_course uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  total_lessons integer;
  done_lessons integer;
  total_quizzes integer;
  passed_quizzes integer;
  pct integer;
  grade integer;
  was_completed boolean;
  serial text;
  completed_courses integer;
begin
  select count(*) into total_lessons from public.lessons where course_id = p_course;
  select count(*) into done_lessons from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
   where lp.user_id = p_user and lp.course_id = p_course;
  select count(*) into total_quizzes from public.quizzes
   where course_id = p_course and status = 'published' and kind in ('module', 'final');
  select count(distinct qa.quiz_id) into passed_quizzes from public.quiz_attempts qa
    join public.quizzes q on q.id = qa.quiz_id and q.status = 'published' and q.kind in ('module', 'final')
   where qa.user_id = p_user and qa.course_id = p_course and qa.passed;

  if total_lessons + total_quizzes = 0 then pct := 0;
  else pct := floor(100.0 * (done_lessons + passed_quizzes) / (total_lessons + total_quizzes));
  end if;

  select status = 'completed' into was_completed from public.enrollments where user_id = p_user and course_id = p_course;
  update public.enrollments set progress = pct, last_activity_at = now()
   where user_id = p_user and course_id = p_course;

  if pct = 100 then
    select coalesce(round(avg(best)), 100) into grade from (
      select max(qa.percent) as best from public.quiz_attempts qa
        join public.quizzes q on q.id = qa.quiz_id and q.kind in ('module', 'final') and q.status = 'published'
       where qa.user_id = p_user and qa.course_id = p_course group by qa.quiz_id
    ) s;
    if not coalesce(was_completed, false) then
      update public.enrollments set status = 'completed', completed_at = now()
       where user_id = p_user and course_id = p_course;
      perform public._award_xp(p_user, 100, 'course_completed', p_course);
      perform public._award_badge(p_user, 'graduate');
      select count(*) into completed_courses from public.enrollments where user_id = p_user and status = 'completed';
      if completed_courses >= 3 then perform public._award_badge(p_user, 'scholar'); end if;
    end if;
    serial := public._issue_course_certificate(p_user, p_course, grade);
  end if;

  return jsonb_build_object('progress', pct, 'completed', pct = 100, 'certificate_serial', serial);
end $$;

-- ---------------------------------------------------------------------------
-- Learner RPCs
-- ---------------------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select lower(p_username) ~ '^[a-z0-9_.]{3,30}$'
     and not exists (select 1 from public.profiles where username = lower(p_username))
$$;

create or replace function public.enroll(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); c record;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into c from public.courses where id = p_course_id and status = 'published';
  if not found then raise exception 'Course not available' using errcode = 'P0002'; end if;
  insert into public.enrollments (user_id, course_id) values (uid, p_course_id) on conflict do nothing;
  if found then
    perform public._notify(uid, 'enrollment', 'Enrolled in ' || c.title,
                           'Great choice! Start with the first lesson whenever you are ready.', '/app/learn/' || c.slug);
  end if;
  return public._recompute_progress(uid, p_course_id);
end $$;

create or replace function public.complete_lesson(p_lesson_id uuid, p_seconds integer default 0,
                                                  p_completed_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  l record;
  is_new boolean;
  at timestamptz := least(coalesce(p_completed_at, now()), now());
  res jsonb;
  xp integer := 0;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into l from public.lessons where id = p_lesson_id;
  if not found or not public.can_view_course(l.course_id) then
    raise exception 'Lesson not available' using errcode = 'P0002';
  end if;

  perform public._ensure_enrolled(uid, l.course_id);
  insert into public.lesson_progress (user_id, lesson_id, course_id, seconds_spent, completed_at)
  values (uid, p_lesson_id, l.course_id, greatest(coalesce(p_seconds, 0), 0), at)
  on conflict (user_id, lesson_id) do update
    set seconds_spent = public.lesson_progress.seconds_spent + greatest(coalesce(excluded.seconds_spent, 0), 0)
  returning (xmax = 0) into is_new;

  update public.enrollments set last_lesson_id = p_lesson_id, last_activity_at = now()
   where user_id = uid and course_id = l.course_id;

  if is_new then
    xp := 10;
    perform public._award_xp(uid, xp, 'lesson_completed', p_lesson_id);
    perform public._award_badge(uid, 'first_steps');
  end if;
  perform public._bump_streak(uid, at);
  res := public._recompute_progress(uid, l.course_id);
  return res || jsonb_build_object('xp_awarded', xp);
end $$;

-- Practice quizzes expose their keys so they can be self-graded instantly (even offline).
create or replace function public.get_practice_keys(p_quiz_id uuid)
returns table (question_id uuid, answer jsonb, explanation text)
language sql stable security definer set search_path = ''
as $$
  select k.question_id, k.answer, k.explanation
    from public.question_keys k
    join public.questions qu on qu.id = k.question_id
    join public.quizzes q on q.id = qu.quiz_id
   where q.id = p_quiz_id and (q.kind = 'practice' or public.can_manage_course(q.course_id))
     and public.can_view_course(q.course_id)
$$;

create or replace function public.submit_quiz(p_quiz_id uuid, p_answers jsonb, p_client_id uuid,
                                              p_started_at timestamptz default null, p_offline boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  q record;
  qu record;
  existing public.quiz_attempts;
  attempt public.quiz_attempts;
  given jsonb;
  given_sorted text[];
  key_sorted text[];
  is_correct boolean;
  total numeric := 0;
  earned numeric := 0;
  results jsonb := '[]';
  pct integer;
  did_pass boolean;
  prev_passed boolean;
  prev_count integer;
  xp integer := 0;
  progress jsonb;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;

  select * into existing from public.quiz_attempts where client_id = p_client_id;
  if found then
    if existing.user_id <> uid then raise exception 'Invalid attempt id' using errcode = '42501'; end if;
    return to_jsonb(existing) || jsonb_build_object('duplicate', true);
  end if;

  select * into q from public.quizzes where id = p_quiz_id and status = 'published';
  if not found or not public.can_view_course(q.course_id) then
    raise exception 'Quiz not available' using errcode = 'P0002';
  end if;

  select count(*), coalesce(bool_or(passed), false) into prev_count, prev_passed
    from public.quiz_attempts where quiz_id = p_quiz_id and user_id = uid;
  if q.max_attempts is not null and prev_count >= q.max_attempts then
    raise exception 'You have used all % attempts for this quiz.', q.max_attempts using errcode = 'P0001';
  end if;

  for qu in
    select qs.*, k.answer as key, k.explanation
      from public.questions qs left join public.question_keys k on k.question_id = qs.id
     where qs.quiz_id = p_quiz_id order by qs.position
  loop
    given := coalesce(p_answers -> qu.id::text, '[]'::jsonb);
    if jsonb_typeof(given) <> 'array' then given := jsonb_build_array(given); end if;
    select coalesce(array_agg(x order by x), '{}') into given_sorted from jsonb_array_elements_text(given) x;
    select coalesce(array_agg(x order by x), '{}') into key_sorted from jsonb_array_elements_text(coalesce(qu.key, '[]')) x;

    if qu.kind = 'short' then
      is_correct := exists (
        select 1 from unnest(key_sorted) k
         where lower(regexp_replace(trim(k), '\s+', ' ', 'g')) =
               lower(regexp_replace(trim(coalesce(given_sorted[1], '')), '\s+', ' ', 'g')));
    else
      is_correct := cardinality(key_sorted) > 0 and given_sorted = key_sorted;
    end if;

    total := total + qu.points;
    if is_correct then earned := earned + qu.points; end if;
    results := results || jsonb_build_object(
      'question_id', qu.id,
      'correct', is_correct,
      'points', qu.points,
      'earned', case when is_correct then qu.points else 0 end,
      'given', given,
      'answer', case when q.show_answers then qu.key else null end,
      'explanation', case when q.show_answers then qu.explanation else null end);
  end loop;

  pct := case when total = 0 then 0 else floor(100 * earned / total) end;
  did_pass := pct >= q.pass_mark;

  perform public._ensure_enrolled(uid, q.course_id);
  insert into public.quiz_attempts (client_id, quiz_id, course_id, user_id, answers, results, score, max_score,
                                    percent, passed, started_at, submitted_offline)
  values (p_client_id, p_quiz_id, q.course_id, uid, coalesce(p_answers, '{}'), results, earned, total, pct, did_pass,
          p_started_at, coalesce(p_offline, false))
  returning * into attempt;

  if prev_count = 0 then xp := xp + least(20, pct / 5); end if;
  if did_pass and not prev_passed then
    xp := xp + 25;
    perform public._award_badge(uid, 'quiz_whiz');
  end if;
  if pct = 100 then perform public._award_badge(uid, 'perfectionist'); end if;
  if coalesce(p_offline, false) then perform public._award_badge(uid, 'offline_learner'); end if;
  perform public._award_xp(uid, xp, 'quiz_submitted', attempt.id);
  perform public._bump_streak(uid, coalesce(p_started_at, now()));
  progress := public._recompute_progress(uid, q.course_id);

  return to_jsonb(attempt) || jsonb_build_object('xp_awarded', xp, 'pass_mark', q.pass_mark,
                                                  'course_progress', progress);
end $$;

create or replace function public.leaderboard(p_period text default 'week', p_limit integer default 20)
returns table (user_id uuid, full_name text, username text, avatar_url text, xp bigint, streak integer, rank bigint)
language sql stable security definer set search_path = ''
as $$
  with scores as (
    select p.id, p.full_name, p.username, p.avatar_url, p.streak,
           case when p_period = 'all' then p.xp::bigint
                else coalesce((select sum(e.amount) from public.xp_events e
                                where e.user_id = p.id
                                  and e.created_at >= now() - case when p_period = 'month' then interval '30 days'
                                                                   else interval '7 days' end), 0)
           end as score
      from public.profiles p
     where p.role = 'student' and p.status = 'active'
  )
  select id, full_name, username, avatar_url, score, streak, rank() over (order by score desc)
    from scores where score > 0
   order by score desc limit least(greatest(p_limit, 1), 100)
$$;

-- Public certificate verification (callable without signing in)
create or replace function public.verify_certificate(p_serial text)
returns table (serial text, recipient_name text, course_title text, category_name text, kind text, grade integer,
               hours numeric, description text, signatories jsonb, status text, revoked_reason text,
               issued_at timestamptz, course_slug text)
language sql stable security definer set search_path = ''
as $$
  select c.serial, c.recipient_name, c.course_title, c.category_name, c.kind, c.grade, c.hours, c.description,
         c.signatories, c.status, c.revoked_reason, c.issued_at, co.slug
    from public.certificates c left join public.courses co on co.id = c.course_id
   where upper(c.serial) = upper(trim(p_serial))
$$;

create or replace function public.apply_to_teach(p_expertise text, p_experience text, p_portfolio text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); app_id uuid;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if public.my_role() <> 'student' then raise exception 'You already have a staff role.'; end if;
  insert into public.instructor_applications (user_id, expertise, experience, portfolio_url)
  values (uid, p_expertise, p_experience, nullif(p_portfolio, ''))
  returning id into app_id;
  return app_id;
end $$;

-- ---------------------------------------------------------------------------
-- Staff RPCs
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(p_user uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  me public.app_role := public.my_role();
  current_role_ public.app_role;
begin
  if p_user = auth.uid() then raise exception 'You cannot change your own role.' using errcode = '42501'; end if;
  select role into current_role_ from public.profiles where id = p_user;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;

  if me = 'super_admin' then
    null; -- may assign any role
  elsif me = 'admin' and current_role_ in ('student', 'instructor') and p_role in ('student', 'instructor') then
    null;
  else
    raise exception 'You do not have permission to assign this role.' using errcode = '42501';
  end if;

  update public.profiles set role = p_role where id = p_user;
  perform public._audit('user.role_changed', 'user', p_user::text,
                        jsonb_build_object('from', current_role_, 'to', p_role));
  perform public._notify(p_user, 'account', 'Your role was updated',
                         'You now have the ' || replace(p_role::text, '_', ' ') || ' role on DBI Learn.', '/app');
end $$;

create or replace function public.set_user_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare me public.app_role := public.my_role(); target_role public.app_role;
begin
  if p_status not in ('active', 'suspended') then raise exception 'Invalid status'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own status.' using errcode = '42501'; end if;
  select role into target_role from public.profiles where id = p_user;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if not (me = 'super_admin' or (me = 'admin' and target_role in ('student', 'instructor'))) then
    raise exception 'You do not have permission to change this account.' using errcode = '42501';
  end if;
  update public.profiles set status = p_status where id = p_user;
  perform public._audit('user.status_changed', 'user', p_user::text, jsonb_build_object('status', p_status));
end $$;

create or replace function public.review_instructor_application(p_application uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare a record;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into a from public.instructor_applications where id = p_application and status = 'pending' for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  update public.instructor_applications
     set status = case when p_approve then 'approved' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_application;
  if p_approve then
    update public.profiles set role = 'instructor' where id = a.user_id and role = 'student';
    perform public._notify(a.user_id, 'account', 'You are now an instructor 🎉',
                           'Your application was approved. Head to the Studio to create your first course.', '/admin');
  else
    perform public._notify(a.user_id, 'account', 'Instructor application update',
                           'Thank you for applying. Your application was not approved this time.', '/app/profile');
  end if;
  perform public._audit('instructor_application.' || case when p_approve then 'approved' else 'rejected' end,
                        'application', p_application::text, '{}');
end $$;

-- Manual certificate issuance (events, workshops, external programmes)
create or replace function public.issue_certificate(p_recipient_name text, p_recipient_email text, p_course_title text,
                                                    p_kind text default 'completion', p_user uuid default null,
                                                    p_course uuid default null, p_grade integer default null,
                                                    p_hours numeric default null, p_description text default null,
                                                    p_category_name text default null, p_issued_at timestamptz default null)
returns text language plpgsql security definer set search_path = ''
as $$
declare sigs jsonb; cat_sig jsonb; serial text; uid uuid := p_user;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if uid is null and p_recipient_email is not null then
    select id into uid from public.profiles_private where lower(email) = lower(trim(p_recipient_email));
  end if;
  sigs := coalesce((select value -> 'signatories' from public.settings where key = 'certificate'), '[]'::jsonb);
  select signatory into cat_sig from public.categories where name = p_category_name;
  if cat_sig is not null and not sigs @> jsonb_build_array(cat_sig) then sigs := sigs || jsonb_build_array(cat_sig); end if;

  insert into public.certificates (user_id, recipient_name, recipient_email, course_id, course_title, category_name,
                                   kind, grade, hours, description, signatories, issued_by, issued_at)
  values (uid, trim(p_recipient_name), nullif(trim(p_recipient_email), ''), p_course, trim(p_course_title),
          p_category_name, p_kind, p_grade, p_hours, p_description, sigs, auth.uid(), coalesce(p_issued_at, now()))
  returning certificates.serial into serial;

  if uid is not null then
    perform public._notify(uid, 'certificate', 'You received a certificate 🎓',
                           'A certificate for ' || p_course_title || ' has been issued to you.',
                           '/app/certificates/' || serial);
  end if;
  perform public._audit('certificate.issued', 'certificate', serial, jsonb_build_object('recipient', p_recipient_name));
  return serial;
end $$;

create or replace function public.revoke_certificate(p_serial text, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.certificates set status = 'revoked', revoked_reason = p_reason where serial = p_serial;
  if not found then raise exception 'Certificate not found' using errcode = 'P0002'; end if;
  perform public._audit('certificate.revoked', 'certificate', p_serial, jsonb_build_object('reason', p_reason));
end $$;

-- Dashboard metrics. Admins see the whole platform; instructors see their own courses.
create or replace function public.staff_overview()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  scope uuid[];
  res jsonb;
begin
  if not public.is_staff() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if public.is_admin() then
    select coalesce(array_agg(id), '{}') into scope from public.courses;
  else
    select coalesce(array_agg(id), '{}') into scope from public.courses where instructor_id = auth.uid();
  end if;

  select jsonb_build_object(
    'students', case when public.is_admin()
                     then (select count(*) from public.profiles where role = 'student')
                     else (select count(distinct user_id) from public.enrollments where course_id = any(scope)) end,
    'instructors', (select count(*) from public.profiles where role = 'instructor'),
    'admins', (select count(*) from public.profiles where role in ('admin', 'super_admin')),
    'courses_published', (select count(*) from public.courses where id = any(scope) and status = 'published'),
    'courses_draft', (select count(*) from public.courses where id = any(scope) and status in ('draft', 'review')),
    'courses_review', (select count(*) from public.courses where id = any(scope) and status = 'review'),
    'enrollments', (select count(*) from public.enrollments where course_id = any(scope)),
    'completions', (select count(*) from public.enrollments where course_id = any(scope) and status = 'completed'),
    'certificates', (select count(*) from public.certificates where status = 'valid'
                       and (public.is_admin() or course_id = any(scope))),
    'avg_quiz_score', (select coalesce(round(avg(percent)), 0) from public.quiz_attempts where course_id = any(scope)),
    'quiz_attempts', (select count(*) from public.quiz_attempts where course_id = any(scope)),
    'active_learners_7d', (select count(distinct user_id) from public.enrollments
                            where course_id = any(scope) and last_activity_at > now() - interval '7 days'),
    'open_tickets', case when public.is_admin()
                         then (select count(*) from public.support_tickets where status in ('open', 'pending')) else 0 end,
    'pending_applications', case when public.is_admin()
                         then (select count(*) from public.instructor_applications where status = 'pending') else 0 end,
    'signups_30d', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', n) order by d), '[]')
                      from (select gs as d, (select count(*) from public.profiles p
                                              where p.created_at::date = gs::date and p.role = 'student') as n
                              from generate_series(current_date - 29, current_date, interval '1 day') gs) s),
    'enrollments_30d', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', n) order by d), '[]')
                      from (select gs as d, (select count(*) from public.enrollments e
                                              where e.enrolled_at::date = gs::date and e.course_id = any(scope)) as n
                              from generate_series(current_date - 29, current_date, interval '1 day') gs) s),
    'top_courses', (select coalesce(jsonb_agg(t), '[]') from (
                      select c.id, c.title, c.slug, c.enrollment_count,
                             (select count(*) from public.enrollments e where e.course_id = c.id and e.status = 'completed') as completions,
                             (select coalesce(round(avg(percent)), 0) from public.quiz_attempts a where a.course_id = c.id) as avg_score,
                             c.rating_avg
                        from public.courses c where c.id = any(scope)
                       order by c.enrollment_count desc, c.title limit 8) t),
    'by_category', (select coalesce(jsonb_agg(t), '[]') from (
                      select coalesce(cat.name, 'Uncategorised') as name, count(e.*) as enrollments
                        from public.courses c left join public.categories cat on cat.id = c.category_id
                        left join public.enrollments e on e.course_id = c.id
                       where c.id = any(scope) group by 1 order by 2 desc) t)
  ) into res;
  return res;
end $$;

-- ---------------------------------------------------------------------------
-- Community triggers
-- ---------------------------------------------------------------------------
create or replace function public.on_discussion_reply()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare t record;
begin
  if tg_op = 'INSERT' then
    update public.discussion_threads set reply_count = reply_count + 1, last_reply_at = new.created_at
     where id = new.thread_id returning * into t;
    if t.author_id <> new.author_id then
      perform public._notify(t.author_id, 'discussion', 'New reply on "' || left(t.title, 60) || '"',
                             left(new.body, 140), '/app/discussions/' || t.id);
    end if;
    perform public._award_badge(new.author_id, 'community');
  elsif tg_op = 'DELETE' then
    update public.discussion_threads set reply_count = greatest(reply_count - 1, 0) where id = old.thread_id;
  end if;
  return null;
end $$;
create trigger discussion_replies_after after insert or delete on public.discussion_replies
  for each row execute function public.on_discussion_reply();

create or replace function public.on_discussion_thread()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public._award_badge(new.author_id, 'community');
  return null;
end $$;
create trigger discussion_threads_after after insert on public.discussion_threads
  for each row execute function public.on_discussion_thread();

create or replace function public.on_ticket_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare t record;
begin
  new.from_staff := public.is_admin();
  select * into t from public.support_tickets where id = new.ticket_id;
  if new.from_staff then
    update public.support_tickets set status = case when status = 'open' then 'pending' else status end,
                                      updated_at = now() where id = new.ticket_id;
    if t.user_id <> new.author_id then
      perform public._notify(t.user_id, 'support', 'Support replied: ' || left(t.subject, 60), left(new.body, 140),
                             '/app/support/' || t.id);
    end if;
  else
    update public.support_tickets set status = case when status in ('resolved', 'closed', 'pending') then 'open' else status end,
                                      updated_at = now() where id = new.ticket_id;
  end if;
  return new;
end $$;
create trigger ticket_messages_before before insert on public.ticket_messages
  for each row execute function public.on_ticket_message();

create or replace function public.on_announcement()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.course_id is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    select e.user_id, 'announcement', new.title, left(new.body, 160), '/app/announcements'
      from public.enrollments e where e.course_id = new.course_id;
  end if;
  return null;
end $$;
create trigger announcements_after after insert on public.announcements
  for each row execute function public.on_announcement();

-- ---------------------------------------------------------------------------
-- Function privileges: internal helpers are not part of the API.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.my_role(), public.is_super_admin(), public.is_admin(), public.is_staff(),
  public.can_manage_course(uuid), public.can_view_course(uuid) to anon, authenticated;
grant execute on function public.username_available(text), public.verify_certificate(text) to anon, authenticated;
grant execute on function
  public.enroll(uuid),
  public.complete_lesson(uuid, integer, timestamptz),
  public.get_practice_keys(uuid),
  public.submit_quiz(uuid, jsonb, uuid, timestamptz, boolean),
  public.leaderboard(text, integer),
  public.apply_to_teach(text, text, text),
  public.set_user_role(uuid, public.app_role),
  public.set_user_status(uuid, text),
  public.review_instructor_application(uuid, boolean),
  public.issue_certificate(text, text, text, text, uuid, uuid, integer, numeric, text, text, timestamptz),
  public.revoke_certificate(text, text),
  public.staff_overview()
to authenticated;
-- Trigger functions run as their owner; gen_certificate_serial is used as a column default.
grant execute on function public.gen_certificate_serial() to authenticated;
