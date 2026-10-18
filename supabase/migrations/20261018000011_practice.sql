-- Code Lab practice: XP for each challenge the first time a learner passes it,
-- plus badges for coders and curious learners who ask questions.

create table public.practice_completions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id text not null check (challenge_id ~ '^[a-z0-9-]{2,60}$'),
  language text not null check (language in ('web', 'javascript', 'typescript', 'python', 'sql')),
  xp integer not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);
alter table public.practice_completions enable row level security;
create policy "practice: own" on public.practice_completions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

insert into public.badges (code, name, description, icon, color, position) values
  ('first_code',  'Hello, World', 'Passed your first Code Lab challenge.', '💻', '#0b7be8', 11),
  ('code_10',     'Code Builder', 'Passed 10 Code Lab challenges.',        '🛠️', '#03c14b', 12),
  ('curious',     'Curious Mind', 'Asked a teacher your first question.',  '❓', '#0ea5e9', 13)
on conflict (code) do nothing;

-- Challenges are defined in the app, so the server caps the XP a single challenge can grant.
create or replace function public.complete_practice(p_challenge text, p_language text, p_xp integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  amount integer := least(greatest(coalesce(p_xp, 0), 0), 25);
  total integer;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  insert into public.practice_completions (user_id, challenge_id, language, xp)
  values (uid, p_challenge, p_language, amount)
  on conflict do nothing;
  if not found then return jsonb_build_object('new', false, 'xp', 0); end if;
  perform public._award_xp(uid, amount, 'practice', null);
  perform public._bump_streak(uid, now());
  select count(*) into total from public.practice_completions where user_id = uid;
  if total >= 1 then perform public._award_badge(uid, 'first_code'); end if;
  if total >= 10 then perform public._award_badge(uid, 'code_10'); end if;
  return jsonb_build_object('new', true, 'xp', amount, 'total', total);
end $$;
revoke execute on function public.complete_practice(text, text, integer) from public, anon;
grant execute on function public.complete_practice(text, text, integer) to authenticated;

create or replace function public.on_question_badge()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public._award_badge(new.asker_id, 'curious');
  return null;
end $$;
create trigger course_questions_badge after insert on public.course_questions
  for each row execute function public.on_question_badge();
revoke execute on function public.on_question_badge() from public, anon, authenticated;
