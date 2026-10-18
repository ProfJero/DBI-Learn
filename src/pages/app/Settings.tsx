import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Accessibility, KeyRound, LogOut, Moon, Target, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { clear, createStore } from 'idb-keyval';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, friendlyError } from '@/lib/supabase';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { useTheme } from '@/components/layout/Brand';
import { PasswordStrength, passwordScore } from '@/pages/public/Auth';
import { PageHeader } from '@/components/ui';
import { setPrefs, usePrefs, type Prefs } from '@/lib/a11y';
import { ReadAloud } from '@/components/learn/ReadAloud';
import { cn } from '@/lib/utils';

function Section({ id, icon, title, children }: { id?: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 p-6">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </Card>
  );
}

export function SettingsPage() {
  const { profile, privateProfile, refreshProfile, signOut } = useAuth();
  const { dark, toggle } = useTheme();
  const qc = useQueryClient();
  const [account, setAccount] = useState({ username: profile?.username ?? '', phone: privateProfile?.phone ?? '', school: privateProfile?.school ?? '', date_of_birth: privateProfile?.date_of_birth ?? '', guardian_name: privateProfile?.guardian_name ?? '', guardian_phone: privateProfile?.guardian_phone ?? '' });
  const [goal, setGoal] = useState(profile?.daily_goal_minutes ?? 15);
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [email, setEmail] = useState(privateProfile?.email ?? '');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  }, []);

  if (!profile) return null;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(friendlyError((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" />

      <AccessibilitySection />

      <Section icon={<User className="h-5 w-5 text-brand-500" />} title="Account details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" htmlFor="s-user" hint="Lowercase letters, numbers, dots, underscores">
            <Input id="s-user" value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value.toLowerCase() })} />
          </Field>
          <Field label="Phone" htmlFor="s-phone">
            <Input id="s-phone" type="tel" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} />
          </Field>
          <Field label="School" htmlFor="s-school">
            <Input id="s-school" value={account.school} onChange={(e) => setAccount({ ...account, school: e.target.value })} />
          </Field>
          <Field label="Date of birth" htmlFor="s-dob">
            <Input id="s-dob" type="date" value={account.date_of_birth ?? ''} onChange={(e) => setAccount({ ...account, date_of_birth: e.target.value })} />
          </Field>
          <Field label="Parent / guardian name" htmlFor="s-gname">
            <Input id="s-gname" value={account.guardian_name} onChange={(e) => setAccount({ ...account, guardian_name: e.target.value })} />
          </Field>
          <Field label="Parent / guardian phone" htmlFor="s-gphone">
            <Input id="s-gphone" type="tel" value={account.guardian_phone} onChange={(e) => setAccount({ ...account, guardian_phone: e.target.value })} />
          </Field>
        </div>
        <Button
          className="mt-5"
          loading={busy === 'account'}
          onClick={() =>
            run('account', async () => {
              const uname = account.username.trim() || null;
              if (uname && !/^[a-z0-9_.]{3,30}$/.test(uname)) throw new Error('Usernames use 3–30 lowercase letters, numbers, dots or underscores.');
              const a = await supabase.from('profiles').update({ username: uname }).eq('id', profile.id);
              if (a.error) throw new Error(/duplicate/.test(a.error.message) ? 'That username is already taken.' : a.error.message);
              const b = await supabase
                .from('profiles_private')
                .update({
                  phone: account.phone || null,
                  school: account.school || null,
                  date_of_birth: account.date_of_birth || null,
                  guardian_name: account.guardian_name || null,
                  guardian_phone: account.guardian_phone || null,
                })
                .eq('id', profile.id);
              if (b.error) throw b.error;
              await refreshProfile();
              toast.success('Account details saved');
            })
          }
        >
          Save details
        </Button>
      </Section>

      <Section id="security" icon={<KeyRound className="h-5 w-5 text-brand-500" />} title="Sign-in & security">
        {privateProfile?.must_change_password && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            You signed in with a temporary password. Please choose your own password now.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" htmlFor="s-pw">
            <Input id="s-pw" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <PasswordStrength password={pw.next} />
          </Field>
          <Field label="Confirm new password" htmlFor="s-pw2">
            <Input id="s-pw2" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
        </div>
        <Button
          className="mt-4"
          loading={busy === 'pw'}
          disabled={!pw.next}
          onClick={() =>
            run('pw', async () => {
              if (pw.next !== pw.confirm) throw new Error('Passwords do not match.');
              if (pw.next.length < 8 || passwordScore(pw.next) < 2) throw new Error('Choose a stronger password (8+ characters, mix letters and numbers).');
              const { error } = await supabase.auth.updateUser({ password: pw.next });
              if (error) throw error;
              await supabase.from('profiles_private').update({ must_change_password: false }).eq('id', profile.id);
              await refreshProfile();
              setPw({ next: '', confirm: '' });
              toast.success('Password changed');
            })
          }
        >
          Change password
        </Button>
        <div className="mt-6 border-t border-ink-100 pt-5 dark:border-ink-800">
          <Field label="Email address" htmlFor="s-email" hint="We'll send a confirmation link to the new address.">
            <div className="flex gap-2">
              <Input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button
                variant="outline"
                loading={busy === 'email'}
                disabled={!email || email === privateProfile?.email}
                onClick={() =>
                  run('email', async () => {
                    const { error } = await supabase.auth.updateUser({ email });
                    if (error) throw error;
                    toast.success('Check your inbox to confirm the new email address.');
                  })
                }
              >
                Update
              </Button>
            </div>
          </Field>
        </div>
        <Button
          className="mt-6"
          variant="outline"
          icon={<LogOut className="h-4 w-4" />}
          onClick={() =>
            run('global', async () => {
              await supabase.auth.signOut({ scope: 'global' });
              await signOut();
            })
          }
        >
          Sign out on all devices
        </Button>
      </Section>

      <Section icon={<Target className="h-5 w-5 text-brand-500" />} title="Learning preferences">
        <Field label="Daily learning goal" htmlFor="s-goal">
          <Select id="s-goal" value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="max-w-xs">
            <option value={5}>Casual — 5 min/day</option>
            <option value={15}>Regular — 15 min/day</option>
            <option value={30}>Serious — 30 min/day</option>
            <option value={60}>Intense — 60 min/day</option>
          </Select>
        </Field>
        <Button
          className="mt-4"
          loading={busy === 'goal'}
          onClick={() =>
            run('goal', async () => {
              const { error } = await supabase.from('profiles').update({ daily_goal_minutes: goal }).eq('id', profile.id);
              if (error) throw error;
              await refreshProfile();
              toast.success('Goal updated');
            })
          }
        >
          Save goal
        </Button>
      </Section>

      <Section icon={<Moon className="h-5 w-5 text-brand-500" />} title="Appearance & data">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={toggle}>
            Switch to {dark ? 'light' : 'dark'} mode
          </Button>
          <Button
            variant="outline"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={async () => {
              if (!confirm('Clear cached pages? Downloaded courses and unsynced progress are kept.')) return;
              await clear(createStore('dbi-learn-cache', 'rq'));
              qc.clear();
              toast.success('Cache cleared');
            }}
          >
            Clear cached data
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-sm text-ink-500">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-1 h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700')}
      >
        <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

function AccessibilitySection() {
  const prefs = usePrefs();
  const sizes: { v: Prefs['textSize']; label: string; px: string }[] = [
    { v: 'normal', label: 'Normal', px: 'text-base' },
    { v: 'large', label: 'Large', px: 'text-lg' },
    { v: 'xlarge', label: 'Extra large', px: 'text-xl' },
  ];
  return (
    <Section id="accessibility" icon={<Accessibility className="h-5 w-5 text-brand-500" />} title="Reading & accessibility">
      <p className="mb-2 text-sm font-semibold">Text size</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text size">
        {sizes.map((s) => (
          <button
            key={s.v}
            role="radio"
            aria-checked={prefs.textSize === s.v}
            onClick={() => setPrefs({ textSize: s.v })}
            className={cn(
              'rounded-xl border-2 py-3 font-semibold transition',
              s.px,
              prefs.textSize === s.v ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-950/40 dark:text-brand-200' : 'border-ink-100 dark:border-ink-800',
            )}
          >
            Aa <span className="block text-xs font-medium text-ink-500">{s.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 divide-y divide-ink-100 dark:divide-ink-800">
        <Toggle label="Easy-read font" hint="A clearer font designed for people who find reading hard." checked={prefs.easyFont} onChange={(v) => setPrefs({ easyFont: v })} />
        <Toggle label="Reduce motion" hint="Turn off animations and moving effects." checked={prefs.reduceMotion} onChange={(v) => setPrefs({ reduceMotion: v })} />
        <Toggle label="Data saver" hint="Pictures load only when you tap them and videos don't preload. Good for small data bundles." checked={prefs.dataSaver} onChange={(v) => setPrefs({ dataSaver: v })} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-4 dark:border-ink-800">
        <label htmlFor="read-rate" className="text-sm font-semibold">
          Read-aloud speed
        </label>
        <select
          id="read-rate"
          value={prefs.readRate}
          onChange={(e) => setPrefs({ readRate: Number(e.target.value) })}
          className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm dark:border-ink-700 dark:bg-ink-900"
        >
          <option value={0.75}>Slow</option>
          <option value={1}>Normal</option>
          <option value={1.25}>Fast</option>
        </select>
        <ReadAloud text="Hello! This is how lessons sound when you press Listen. Akwaaba to DBI Learn." />
      </div>
    </Section>
  );
}
