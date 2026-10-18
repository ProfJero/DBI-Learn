import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, PenTool, Users, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must } from '@/lib/supabase';
import { Button, Card, Field, Input, LinkButton, Textarea } from '@/components/ui';
import { formatDate, isStaffRole } from '@/lib/utils';

export function Teach() {
  const { session, profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ expertise: '', experience: '', portfolio: '' });
  const [busy, setBusy] = useState(false);
  const { data: apps } = useQuery({
    queryKey: ['my-applications', session?.user.id],
    enabled: !!session,
    queryFn: async () =>
      must(await supabase.from('instructor_applications').select('*').eq('user_id', session!.user.id).order('created_at', { ascending: false })) as {
        id: string;
        status: string;
        created_at: string;
      }[],
  });
  const pending = apps?.find((a) => a.status === 'pending');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc('apply_to_teach', { p_expertise: form.expertise, p_experience: form.experience, p_portfolio: form.portfolio });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Application submitted! An administrator will review it soon.');
    void qc.invalidateQueries({ queryKey: ['my-applications'] });
  }

  return (
    <div className="container-page grid gap-10 py-14 lg:grid-cols-2">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Teach on DBI Learn</h1>
        <p className="mt-4 text-lg text-ink-600 dark:text-ink-300">
          Share your skills with thousands of young learners. Build courses with our easy studio — lessons, quizzes and certificates — and track
          how your students progress.
        </p>
        <ul className="mt-8 space-y-4">
          {[
            [PenTool, 'Simple course studio', 'Write lessons in Markdown with code highlighting, videos and callouts.'],
            [Users, 'Reach learners anywhere', 'Your courses work offline, so learners in low-connectivity areas can follow along.'],
            [BarChart3, 'See the impact', 'Completion rates, quiz analytics and learner progress in real time.'],
          ].map(([Icon, t, b]) => {
            const I = Icon as typeof PenTool;
            return (
              <li key={t as string} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950">
                  <I className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{t as string}</span>
                  <span className="text-sm text-ink-500">{b as string}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <Card className="p-6 lg:p-8">
        {!session ? (
          <div className="text-center">
            <h2 className="text-xl font-bold">Create an account to apply</h2>
            <p className="mt-2 text-ink-500">Sign up as a learner first, then submit your instructor application from this page.</p>
            <div className="mt-6 flex justify-center gap-2">
              <LinkButton to="/signup?next=/teach">Sign up</LinkButton>
              <LinkButton to="/login?next=/teach" variant="outline">
                Log in
              </LinkButton>
            </div>
          </div>
        ) : isStaffRole(profile?.role) ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand-500" />
            <h2 className="mt-3 text-xl font-bold">You're already part of the team</h2>
            <LinkButton to="/admin" className="mt-5">
              Open the Studio
            </LinkButton>
          </div>
        ) : pending ? (
          <div className="text-center">
            <Clock className="mx-auto h-10 w-10 text-amber-500" />
            <h2 className="mt-3 text-xl font-bold">Application under review</h2>
            <p className="mt-2 text-ink-500">Submitted {formatDate(pending.created_at)}. You'll get a notification once it's reviewed.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-xl font-bold">Instructor application</h2>
            <Field label="What would you like to teach?" htmlFor="t-exp">
              <Input id="t-exp" required placeholder="e.g. Python for beginners, Graphic design with Canva" value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} />
            </Field>
            <Field label="Your teaching or industry experience" htmlFor="t-xp">
              <Textarea id="t-xp" required rows={5} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
            </Field>
            <Field label="Portfolio or LinkedIn (optional)" htmlFor="t-port">
              <Input id="t-port" type="url" placeholder="https://" value={form.portfolio} onChange={(e) => setForm({ ...form, portfolio: e.target.value })} />
            </Field>
            <Button type="submit" loading={busy} className="w-full">
              Submit application
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
