-- DBI Learn — row level security

alter table public.profiles enable row level security;
alter table public.profiles_private enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lesson_notes enable row level security;
alter table public.course_reviews enable row level security;
alter table public.certificates enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.xp_events enable row level security;
alter table public.announcements enable row level security;
alter table public.discussion_threads enable row level security;
alter table public.discussion_replies enable row level security;
alter table public.notifications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.resources enable row level security;
alter table public.instructor_applications enable row level security;
alter table public.inquiries enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles: public-ish card readable by signed-in users; only safe columns are writable.
-- ---------------------------------------------------------------------------
create policy "profiles: signed-in users can read" on public.profiles
  for select to authenticated using (true);
create policy "profiles: owner updates own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: admins update" on public.profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, username, avatar_url, headline, bio, location, daily_goal_minutes)
  on public.profiles to authenticated;

create policy "profiles_private: owner or staff read" on public.profiles_private
  for select to authenticated using (id = (select auth.uid()) or (select public.is_staff()));
create policy "profiles_private: owner updates own" on public.profiles_private
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles_private: admins update" on public.profiles_private
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke insert, update, delete on public.profiles_private from anon, authenticated;
grant update (phone, date_of_birth, gender, school, guardian_name, guardian_phone, must_change_password)
  on public.profiles_private to authenticated;

-- ---------------------------------------------------------------------------
-- Settings & catalogue
-- ---------------------------------------------------------------------------
create policy "settings: anyone reads" on public.settings for select to anon, authenticated using (true);
create policy "settings: admins write" on public.settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "categories: anyone reads" on public.categories for select to anon, authenticated using (true);
create policy "categories: admins write" on public.categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "courses: published or managed" on public.courses for select to anon, authenticated
  using (status = 'published' or (select public.can_manage_course(id)));
create policy "courses: staff create" on public.courses for insert to authenticated
  with check ((select public.is_admin())
              or ((select public.my_role()) = 'instructor' and instructor_id = (select auth.uid())));
create policy "courses: managers update" on public.courses for update to authenticated
  using ((select public.can_manage_course(id))) with check ((select public.can_manage_course(id)));
create policy "courses: admins delete" on public.courses for delete to authenticated
  using ((select public.is_admin()));
revoke update on public.courses from anon, authenticated;
grant update (slug, title, subtitle, description, category_id, level, language, cover_url, accent, instructor_id,
              status, outcomes, requirements, tags, pass_mark, certificate_enabled, sequential, featured,
              estimated_hours) on public.courses to authenticated;

create policy "modules: visible with course" on public.modules for select to anon, authenticated
  using ((select public.can_view_course(course_id)));
create policy "modules: managers write" on public.modules for all to authenticated
  using ((select public.can_manage_course(course_id))) with check ((select public.can_manage_course(course_id)));

-- Lesson bodies need an account (free); previews are public for marketing pages.
create policy "lessons: signed-in readers" on public.lessons for select to authenticated
  using ((select public.can_view_course(course_id)));
create policy "lessons: public previews" on public.lessons for select to anon
  using (is_preview and (select public.can_view_course(course_id)));
create policy "lessons: managers write" on public.lessons for all to authenticated
  using ((select public.can_manage_course(course_id))) with check ((select public.can_manage_course(course_id)));

create policy "quizzes: visible with course" on public.quizzes for select to authenticated
  using ((status = 'published' and (select public.can_view_course(course_id))) or (select public.can_manage_course(course_id)));
create policy "quizzes: managers write" on public.quizzes for all to authenticated
  using ((select public.can_manage_course(course_id))) with check ((select public.can_manage_course(course_id)));

create policy "questions: visible with quiz" on public.questions for select to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id
                  and ((q.status = 'published' and public.can_view_course(q.course_id)) or public.can_manage_course(q.course_id))));
create policy "questions: managers write" on public.questions for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id)))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id)));

create policy "question_keys: managers only" on public.question_keys for all to authenticated
  using (exists (select 1 from public.questions qu join public.quizzes q on q.id = qu.quiz_id
                  where qu.id = question_id and public.can_manage_course(q.course_id)))
  with check (exists (select 1 from public.questions qu join public.quizzes q on q.id = qu.quiz_id
                       where qu.id = question_id and public.can_manage_course(q.course_id)));

-- ---------------------------------------------------------------------------
-- Learner data: owners read; course managers read for reporting; writes via RPCs.
-- ---------------------------------------------------------------------------
create policy "attempts: owner or manager reads" on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.can_manage_course(course_id)));

create policy "enrollments: owner or manager reads" on public.enrollments for select to authenticated
  using (user_id = (select auth.uid()) or (select public.can_manage_course(course_id)));
create policy "enrollments: owner updates resume point" on public.enrollments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "enrollments: owner leaves" on public.enrollments for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update on public.enrollments from anon, authenticated;
grant update (last_lesson_id, last_activity_at) on public.enrollments to authenticated;

create policy "lesson_progress: owner or manager reads" on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.can_manage_course(course_id)));

create policy "notes: owner only" on public.lesson_notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "reviews: anyone reads" on public.course_reviews for select to anon, authenticated using (true);
create policy "reviews: enrolled learners write" on public.course_reviews for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.enrollments e where e.user_id = (select auth.uid()) and e.course_id = course_reviews.course_id));
create policy "reviews: owner edits" on public.course_reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reviews: owner or admin deletes" on public.course_reviews for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "certificates: owner, admin or course manager reads" on public.certificates for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin())
         or (course_id is not null and (select public.can_manage_course(course_id))));
revoke insert, update, delete on public.certificates from anon, authenticated;

create policy "badges: anyone reads" on public.badges for select to anon, authenticated using (true);
create policy "user_badges: signed-in read" on public.user_badges for select to authenticated using (true);
create policy "xp_events: owner reads" on public.xp_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Community
-- ---------------------------------------------------------------------------
create policy "announcements: signed-in read" on public.announcements for select to authenticated
  using (course_id is null or (select public.can_view_course(course_id)));
create policy "announcements: staff write" on public.announcements for insert to authenticated
  with check (author_id = (select auth.uid()) and
              ((course_id is null and (select public.is_admin())) or (course_id is not null and (select public.can_manage_course(course_id)))));
create policy "announcements: staff edit" on public.announcements for update to authenticated
  using ((select public.is_admin()) or author_id = (select auth.uid()));
create policy "announcements: staff delete" on public.announcements for delete to authenticated
  using ((select public.is_admin()) or author_id = (select auth.uid()));

create policy "threads: readers of course" on public.discussion_threads for select to authenticated
  using ((select public.can_view_course(course_id)));
create policy "threads: learners post" on public.discussion_threads for insert to authenticated
  with check (author_id = (select auth.uid()) and (select public.can_view_course(course_id)) and not pinned and not locked);
create policy "threads: author or moderator edits" on public.discussion_threads for update to authenticated
  using (author_id = (select auth.uid()) or (select public.can_manage_course(course_id)))
  with check ((select public.can_manage_course(course_id)) or (not pinned and not locked));
create policy "threads: author or moderator deletes" on public.discussion_threads for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.can_manage_course(course_id)));
revoke update on public.discussion_threads from anon, authenticated;
grant update (title, body, pinned, locked, resolved) on public.discussion_threads to authenticated;
revoke update on public.discussion_replies from anon, authenticated;
grant update (body, is_answer) on public.discussion_replies to authenticated;

create policy "replies: readers of thread" on public.discussion_replies for select to authenticated
  using (exists (select 1 from public.discussion_threads t where t.id = thread_id and public.can_view_course(t.course_id)));
create policy "replies: learners reply to open threads" on public.discussion_replies for insert to authenticated
  with check (author_id = (select auth.uid()) and not is_answer and exists (
    select 1 from public.discussion_threads t where t.id = thread_id and not t.locked and public.can_view_course(t.course_id)));
create policy "replies: author or moderator edits" on public.discussion_replies for update to authenticated
  using (author_id = (select auth.uid()) or exists (
    select 1 from public.discussion_threads t where t.id = thread_id and public.can_manage_course(t.course_id)));
create policy "replies: author or moderator deletes" on public.discussion_replies for delete to authenticated
  using (author_id = (select auth.uid()) or exists (
    select 1 from public.discussion_threads t where t.id = thread_id and public.can_manage_course(t.course_id)));

create policy "notifications: owner" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: owner marks read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: owner deletes" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "tickets: owner or admin reads" on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "tickets: owner opens" on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open' and assigned_to is null);
create policy "tickets: admin updates" on public.support_tickets for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "tickets: owner closes" on public.support_tickets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and status in ('open', 'closed'));

create policy "ticket_messages: participants read" on public.ticket_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id
                  and (t.user_id = (select auth.uid()) or public.is_admin())));
create policy "ticket_messages: participants write" on public.ticket_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = (select auth.uid()) or public.is_admin())));

create policy "resources: public or enrolled" on public.resources for select to anon, authenticated
  using ((is_public and (course_id is null or public.can_view_course(course_id)))
         or (select public.is_staff()));
create policy "resources: staff write" on public.resources for all to authenticated
  using ((select public.is_admin()) or (course_id is not null and (select public.can_manage_course(course_id))))
  with check ((select public.is_admin()) or (course_id is not null and (select public.can_manage_course(course_id))));

create policy "applications: owner or admin reads" on public.instructor_applications for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "inquiries: anyone submits" on public.inquiries for insert to anon, authenticated
  with check (not handled);
create policy "inquiries: admins manage" on public.inquiries for select to authenticated using ((select public.is_admin()));
create policy "inquiries: admins update" on public.inquiries for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "audit: admins read" on public.audit_logs for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.audit_logs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
       ('course-media', 'course-media', true, 52428800,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf', 'video/mp4'])
on conflict (id) do nothing;

create policy "avatars: owner uploads to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner updates own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner deletes own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "course-media: staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-media' and (select public.is_staff()));
create policy "course-media: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'course-media' and (select public.is_staff()));
create policy "course-media: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-media' and (select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
insert into public.badges (code, name, description, icon, color, position) values
  ('first_steps',     'First Steps',     'Completed your very first lesson.',                    '👣', '#1e88e5', 1),
  ('quiz_whiz',       'Quiz Whiz',       'Passed your first quiz.',                              '🧠', '#7c3aed', 2),
  ('perfectionist',   'Perfectionist',   'Scored 100% on a quiz.',                               '💯', '#e11d48', 3),
  ('streak_3',        'On Fire',         'Learned 3 days in a row.',                             '🔥', '#f97316', 4),
  ('streak_7',        'Unstoppable',     'Learned 7 days in a row.',                             '⚡', '#eab308', 5),
  ('streak_30',       'Dedicated',       'Learned 30 days in a row.',                            '🏆', '#ca8a04', 6),
  ('graduate',        'Graduate',        'Completed your first course and earned a certificate.','🎓', '#00c853', 7),
  ('scholar',         'Scholar',         'Completed three courses.',                             '📚', '#0d9488', 8),
  ('community',       'Community Voice', 'Started or joined a discussion.',                      '💬', '#0284c7', 9),
  ('offline_learner', 'Anywhere Learner','Completed a quiz offline and synced it later.',        '📶', '#475569', 10)
on conflict (code) do nothing;

insert into public.settings (key, value) values
  ('branding', jsonb_build_object(
     'platform_name', 'DBI Learn',
     'organisation', 'Digital Bridge Initiative',
     'tagline', 'Learn. Build. Grow.',
     'built_by', 'ProfJero Digital Studio',
     'support_email', '')),
  ('certificate', jsonb_build_object(
     'signatories', jsonb_build_array(
       jsonb_build_object('name', 'Benjamin Amoako', 'title', 'Executive Director',
                          'signature_url', '/images/signatures/executive-director.png'))))
on conflict (key) do nothing;
