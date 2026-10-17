-- Public course outline: titles and durations only (lesson bodies stay behind sign-in).
create or replace function public.course_outline(p_course_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when public.can_view_course(p_course_id) then jsonb_build_object(
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'title', m.title, 'summary', m.summary, 'position', m.position,
               'lessons', coalesce((
                 select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'duration_minutes', l.duration_minutes,
                                                     'kind', l.kind, 'is_preview', l.is_preview, 'position', l.position)
                                  order by l.position)
                   from public.lessons l where l.module_id = m.id), '[]'::jsonb))
             order by m.position)
        from public.modules m where m.course_id = p_course_id), '[]'::jsonb),
    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title, 'kind', q.kind, 'module_id', q.module_id,
                                          'questions', (select count(*) from public.questions qq where qq.quiz_id = q.id))
             order by q.position)
        from public.quizzes q where q.course_id = p_course_id and q.status = 'published'), '[]'::jsonb))
  end
$$;
grant execute on function public.course_outline(uuid) to anon, authenticated;

update public.settings
   set value = value || jsonb_build_object('support_email', 'ruraltechh@gmail.com', 'support_phone', '+233 53 120 7256',
                                           'address', 'Ayeldu, Ghana')
 where key = 'branding';
