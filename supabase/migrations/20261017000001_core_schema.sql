-- DBI Learn — core schema
-- Built by ProfJero Digital Studio · Powered by Digital Bridge Initiative
--
-- Security model:
--   * Roles live in public.profiles.role and are only changed via SECURITY DEFINER RPCs
--     (or the staff-admin edge function using the service role).
--   * Every table has RLS. Students can never read quiz answer keys; grading is server-side.
--   * Side-effects (XP, streaks, progress, certificates) only happen inside RPCs.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('super_admin', 'admin', 'instructor', 'student');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  username text unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  role public.app_role not null default 'student',
  status text not null default 'active' check (status in ('active', 'suspended')),
  avatar_url text,
  headline text,
  bio text,
  location text,
  xp integer not null default 0,
  streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  daily_goal_minutes integer not null default 15 check (daily_goal_minutes between 5 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sensitive fields, readable by the owner and staff only.
create table public.profiles_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  email text not null,
  phone text,
  date_of_birth date,
  gender text,
  school text,
  guardian_name text,
  guardian_phone text,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies don't recurse into profiles RLS)
-- ---------------------------------------------------------------------------
create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.my_role() = 'super_admin', false) $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.my_role() in ('super_admin', 'admin'), false) $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.my_role() in ('super_admin', 'admin', 'instructor'), false) $$;

-- ---------------------------------------------------------------------------
-- Organisation settings (branding, certificate signatories)
-- ---------------------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon text,
  color text,
  signatory jsonb, -- {name, title, signature_url} head of department for certificates
  position integer not null default 0
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null,
  subtitle text,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  language text not null default 'English',
  cover_url text,
  accent text,
  instructor_id uuid references public.profiles (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  outcomes text[] not null default '{}',
  requirements text[] not null default '{}',
  tags text[] not null default '{}',
  pass_mark integer not null default 70 check (pass_mark between 1 and 100),
  certificate_enabled boolean not null default true,
  sequential boolean not null default false,
  featured boolean not null default false,
  estimated_hours numeric(5, 1),
  enrollment_count integer not null default 0,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index on public.courses (status);
create index on public.courses (category_id);
create index on public.courses (instructor_id);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  summary text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.modules (course_id, position);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  kind text not null default 'article' check (kind in ('article', 'video', 'exercise')),
  content text not null default '',
  video_url text,
  duration_minutes integer not null default 5,
  position integer not null default 0,
  is_preview boolean not null default false,
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.lessons (module_id, position);
create index on public.lessons (course_id);

create or replace function public.can_manage_course(p_course_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.instructor_id = auth.uid() and public.my_role() = 'instructor'
  )
$$;

create or replace function public.can_view_course(p_course_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.courses c where c.id = p_course_id and c.status = 'published')
      or public.can_manage_course(p_course_id)
$$;

-- ---------------------------------------------------------------------------
-- Assessment
-- ---------------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  module_id uuid references public.modules (id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'module' check (kind in ('module', 'final', 'practice')),
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes > 0),
  pass_mark integer not null default 70 check (pass_mark between 1 and 100),
  max_attempts integer check (max_attempts is null or max_attempts > 0),
  shuffle_questions boolean not null default true,
  show_answers boolean not null default true,
  position integer not null default 0,
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.quizzes (course_id);
create index on public.quizzes (module_id);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  kind text not null default 'single' check (kind in ('single', 'multiple', 'true_false', 'short')),
  prompt text not null,
  options jsonb not null default '[]', -- [{"id":"a","text":"..."}]
  points integer not null default 1 check (points > 0),
  position integer not null default 0
);
create index on public.questions (quiz_id, position);

-- Answer keys: never readable by students.
create table public.question_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  answer jsonb not null, -- ["a"] / ["a","c"] / ["accepted text", ...]
  explanation text
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique, -- idempotency key, generated on device (offline-safe)
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}',
  results jsonb not null default '[]',
  score numeric not null default 0,
  max_score numeric not null default 0,
  percent integer not null default 0,
  passed boolean not null default false,
  started_at timestamptz,
  submitted_at timestamptz not null default now(),
  submitted_offline boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.quiz_attempts (user_id, quiz_id);
create index on public.quiz_attempts (course_id);

-- ---------------------------------------------------------------------------
-- Learning progress
-- ---------------------------------------------------------------------------
create table public.enrollments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  last_lesson_id uuid references public.lessons (id) on delete set null,
  enrolled_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, course_id)
);
create index on public.enrollments (course_id);

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  seconds_spent integer not null default 0,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index on public.lesson_progress (user_id, course_id);

create table public.lesson_notes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.course_reviews (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- ---------------------------------------------------------------------------
-- Certificates
-- ---------------------------------------------------------------------------
create or replace function public.gen_certificate_serial()
returns text language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  s text;
begin
  loop
    s := 'DBI-' || to_char(now(), 'YYYY') || '-';
    for i in 1..8 loop
      s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i = 4 then s := s || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.certificates where serial = s);
  end loop;
  return s;
end $$;

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  serial text not null unique,
  user_id uuid references public.profiles (id) on delete set null,
  recipient_name text not null,
  recipient_email text,
  course_id uuid references public.courses (id) on delete set null,
  course_title text not null,
  category_name text,
  kind text not null default 'completion' check (kind in ('completion', 'distinction', 'participation', 'achievement')),
  grade integer check (grade between 0 and 100),
  hours numeric(5, 1),
  description text,
  signatories jsonb not null default '[]',
  status text not null default 'valid' check (status in ('valid', 'revoked')),
  revoked_reason text,
  issued_by uuid references public.profiles (id) on delete set null,
  issued_at timestamptz not null default now()
);
alter table public.certificates alter column serial set default public.gen_certificate_serial();
create unique index certificates_one_per_course on public.certificates (user_id, course_id)
  where user_id is not null and course_id is not null and status = 'valid';

-- ---------------------------------------------------------------------------
-- Gamification
-- ---------------------------------------------------------------------------
create table public.badges (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null,
  color text not null default '#1e88e5',
  position integer not null default 0
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index on public.xp_events (user_id, created_at desc);
create index on public.xp_events (created_at);

-- ---------------------------------------------------------------------------
-- Community & communication
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete cascade, -- null = platform-wide
  title text not null,
  body text not null,
  author_id uuid references public.profiles (id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(title) between 3 and 200),
  body text not null check (length(body) between 1 and 10000),
  pinned boolean not null default false,
  locked boolean not null default false,
  resolved boolean not null default false,
  reply_count integer not null default 0,
  last_reply_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.discussion_threads (course_id, created_at desc);

create table public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 10000),
  is_answer boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.discussion_replies (thread_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (length(subject) between 3 and 200),
  category text not null default 'general' check (category in ('general', 'technical', 'course', 'certificate', 'account')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.support_tickets (user_id);
create index on public.support_tickets (status);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 10000),
  from_staff boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.ticket_messages (ticket_id, created_at);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete cascade, -- null = library-wide
  title text not null,
  description text,
  url text not null,
  kind text not null default 'link' check (kind in ('link', 'pdf', 'video', 'tool', 'article')),
  category text,
  is_public boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.instructor_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expertise text not null,
  experience text not null,
  portfolio_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index instructor_applications_one_pending
  on public.instructor_applications (user_id) where status = 'pending';

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (length(message) between 5 and 5000),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);
