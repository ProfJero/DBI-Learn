-- Instructors could not create courses: INSERT ... RETURNING evaluates the SELECT policy, and
-- can_manage_course(id) looks the row up in a snapshot that doesn't contain it yet.
-- Check ownership on the row itself instead.
alter policy "courses: published or managed" on public.courses
  using (status = 'published'
         or (select public.is_admin())
         or (instructor_id = (select auth.uid()) and (select public.my_role()) = 'instructor'));

alter policy "courses: managers update" on public.courses
  using ((select public.is_admin()) or (instructor_id = (select auth.uid()) and (select public.my_role()) = 'instructor'))
  with check ((select public.is_admin()) or (instructor_id = (select auth.uid()) and (select public.my_role()) = 'instructor'));
