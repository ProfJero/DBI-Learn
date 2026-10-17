import { useState } from 'react';
import { Mail, MapPin, Phone, Send, Target, HeartHandshake, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/queries';
import { Button, Card, Field, Input, Textarea } from '@/components/ui';
import { BRAND } from '@/lib/config';

export function About() {
  const { data: settings } = useSettings();
  const branding = (settings?.branding ?? {}) as Record<string, string>;
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    const { error } = await supabase.from('inquiries').insert(form);
    setSending(false);
    if (error) return toast.error('Could not send your message. Please check the details and try again.');
    toast.success("Message sent! We'll get back to you soon.");
    setForm({ name: '', email: '', message: '' });
  }

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-white py-16 dark:from-brand-950/40 dark:to-ink-950">
        <div className="container-page grid items-center gap-10 md:grid-cols-2">
          <div>
            <img src="/brand/digital-bridge-initiative-logo.png" alt={BRAND.org} className="h-10 w-auto" />
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight">Bridging the digital divide, one learner at a time.</h1>
            <p className="mt-4 text-lg text-ink-600 dark:text-ink-300">
              {BRAND.org} equips young people and communities in {BRAND.country} with the practical digital skills they need to learn, work and
              build. {BRAND.name} brings our training to every learner — in the classroom, at home, and even without an internet connection.
            </p>
          </div>
          <img src="/images/learners-2.webp" alt="Students learning together" className="rounded-3xl shadow-xl" loading="lazy" />
        </div>
      </section>

      <section className="container-page grid gap-5 py-16 md:grid-cols-3">
        {[
          [Target, 'Our mission', 'Make quality technology education free and accessible to every young person, regardless of where they live.'],
          [Lightbulb, 'Our approach', 'Short, practical lessons; instant-feedback quizzes; and offline-first tools designed for low-bandwidth communities.'],
          [HeartHandshake, 'Our promise', 'Every certificate we issue is earned, verifiable and recognised — a real step toward opportunity.'],
        ].map(([Icon, t, b]) => {
          const I = Icon as typeof Target;
          return (
            <Card key={t as string} className="p-6">
              <I className="h-6 w-6 text-brand-500" />
              <h2 className="mt-3 font-bold">{t as string}</h2>
              <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-300">{b as string}</p>
            </Card>
          );
        })}
      </section>

      <section id="contact" className="container-page grid gap-8 pb-20 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-2xl font-extrabold">Get in touch</h2>
          <p className="mt-2 text-ink-500">Questions about courses, partnerships or certificates? We'd love to hear from you.</p>
          <ul className="mt-6 space-y-4 text-sm">
            <li className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-brand-500" /> {branding.address || 'Ayeldu, Ghana'}
            </li>
            {(branding.support_email || 'ruraltechh@gmail.com') && (
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-brand-500" />
                <a href={`mailto:${branding.support_email || 'ruraltechh@gmail.com'}`} className="hover:text-brand-600">
                  {branding.support_email || 'ruraltechh@gmail.com'}
                </a>
              </li>
            )}
            <li className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-brand-500" />
              <a href={`tel:${(branding.support_phone || '+233 53 120 7256').replace(/\s/g, '')}`} className="hover:text-brand-600">
                {branding.support_phone || '+233 53 120 7256'}
              </a>
            </li>
          </ul>
          <p className="mt-10 rounded-2xl border border-ink-100 p-4 text-sm text-ink-500 dark:border-ink-800">
            {BRAND.name} was designed and built by <strong className="text-ink-800 dark:text-ink-100">{BRAND.builtBy}</strong> for{' '}
            <strong className="text-brand-600">{BRAND.org}</strong>.
          </p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" htmlFor="c-name">
                <Input id="c-name" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Email" htmlFor="c-email">
                <Input id="c-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
            </div>
            <Field label="Message" htmlFor="c-msg">
              <Textarea id="c-msg" required minLength={5} maxLength={5000} rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </Field>
            <Button type="submit" loading={sending} icon={<Send className="h-4 w-4" />}>
              Send message
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
