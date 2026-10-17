-- Rename PL/pgSQL variables that collided with certificates.serial.
create or replace function public._issue_course_certificate(p_user uuid, p_course uuid, p_grade integer)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  c record;
  existing text;
  sigs jsonb;
  hrs numeric;
  v_serial text;
  v_kind text := case when p_grade >= 85 then 'distinction' else 'completion' end;
begin
  select c0.serial into existing from public.certificates c0
   where c0.user_id = p_user and c0.course_id = p_course and c0.status = 'valid';
  if existing is not null then return existing; end if;

  select co.*, cat.name as category_name, cat.signatory as category_signatory
    into c
    from public.courses co left join public.categories cat on cat.id = co.category_id
   where co.id = p_course;
  if not found or not c.certificate_enabled then return null; end if;

  sigs := public._merge_signatories(
    coalesce((select value -> 'signatories' from public.settings where key = 'certificate'), '[]'::jsonb),
    c.category_signatory);
  hrs := coalesce(c.estimated_hours,
                  round((select coalesce(sum(duration_minutes), 0) from public.lessons where course_id = p_course) / 60.0, 1));

  insert into public.certificates (user_id, recipient_name, recipient_email, course_id, course_title, category_name,
                                   kind, grade, hours, signatories, description)
  select p_user, pr.full_name, pp.email, p_course, c.title, c.category_name, v_kind, p_grade, hrs, sigs,
         'For successfully completing all lessons and assessments of the ' || c.title || ' programme.'
    from public.profiles pr left join public.profiles_private pp on pp.id = pr.id
   where pr.id = p_user
  returning certificates.serial into v_serial;

  perform public._notify(p_user, 'certificate', 'Your certificate is ready 🎓',
                         'Congratulations on completing ' || c.title || '! Download and share your certificate.',
                         '/app/certificates/' || v_serial);
  return v_serial;
end $$;

create or replace function public.issue_certificate(p_recipient_name text, p_recipient_email text, p_course_title text,
                                                    p_kind text default 'completion', p_user uuid default null,
                                                    p_course uuid default null, p_grade integer default null,
                                                    p_hours numeric default null, p_description text default null,
                                                    p_category_name text default null, p_issued_at timestamptz default null)
returns text language plpgsql security definer set search_path = ''
as $$
declare sigs jsonb; v_serial text; uid uuid := p_user;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if uid is null and p_recipient_email is not null then
    select id into uid from public.profiles_private where lower(email) = lower(trim(p_recipient_email));
  end if;
  sigs := public._merge_signatories(
    coalesce((select value -> 'signatories' from public.settings where key = 'certificate'), '[]'::jsonb),
    (select signatory from public.categories where name = p_category_name));

  insert into public.certificates (user_id, recipient_name, recipient_email, course_id, course_title, category_name,
                                   kind, grade, hours, description, signatories, issued_by, issued_at)
  values (uid, trim(p_recipient_name), nullif(trim(p_recipient_email), ''), p_course, trim(p_course_title),
          p_category_name, p_kind, p_grade, p_hours, p_description, sigs, auth.uid(), coalesce(p_issued_at, now()))
  returning certificates.serial into v_serial;

  if uid is not null then
    perform public._notify(uid, 'certificate', 'You received a certificate 🎓',
                           'A certificate for ' || p_course_title || ' has been issued to you.',
                           '/app/certificates/' || v_serial);
  end if;
  perform public._audit('certificate.issued', 'certificate', v_serial, jsonb_build_object('recipient', p_recipient_name));
  return v_serial;
end $$;

