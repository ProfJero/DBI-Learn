import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, MailCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, friendlyError } from '@/lib/supabase';
import { Button, Checkbox, Field, Input } from '@/components/ui';
import { Logo, Signature, ThemeToggle } from '@/components/layout/Brand';
import { SITE_URL } from '@/lib/config';
import { cn } from '@/lib/utils';

function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <img src="/images/hero-learners.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-brand-900/30" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link to="/" className="flex items-center gap-3">
            <img src="/brand/emblem.png" alt="" className="h-11 w-11 rounded-xl bg-white p-1" />
            <span className="text-xl font-extrabold">DBI Learn</span>
          </Link>
          <div>
            <p className="max-w-md text-3xl font-extrabold leading-tight">“Learn. Build. Grow.” — practical digital skills for every community.</p>
            <ul className="mt-6 space-y-2 text-sm text-white/80">
              <li>✓ Free courses with verifiable certificates</li>
              <li>✓ Study offline — progress syncs when you reconnect</li>
              <li>✓ Streaks, badges and a supportive community</li>
            </ul>
          </div>
          <Signature className="text-white/60 [&_span]:text-white" />
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-5">
          <div className="lg:invisible">
            <Logo />
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <div className="w-full max-w-md animate-fade-up">
            <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-ink-500">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <Signature className="pb-5 text-center lg:hidden" />
      </div>
    </div>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 hover:text-ink-700"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-brand-400', 'bg-brand-600'];
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full', i < score ? colors[score] : 'bg-ink-200 dark:bg-ink-700')} />
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-500">{labels[score]}</p>
    </div>
  );
}

export function Login() {
  const { signInWithEmail, signInWithUsername } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = new URLSearchParams(useLocation().search).get('next');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (identifier.includes('@')) await signInWithEmail(identifier.trim(), password);
      else await signInWithUsername(identifier.trim(), password);
      toast.success('Welcome back! 👋');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        <>
          New to DBI Learn?{' '}
          <Link to={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand-600 hover:underline">
            Create a free account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</div>}
        <Field label="Email or username" htmlFor="identifier">
          <Input id="identifier" autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
        </Field>
        <div className="relative">
          <Link to="/forgot-password" className="absolute right-0 top-0 text-sm font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
          <Field label="Password" htmlFor="password">
            <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}

export function Signup() {
  const navigate = useNavigate();
  const next = new URLSearchParams(useLocation().search).get('next');
  const [form, setForm] = useState({ full_name: '', username: '', email: '', password: '', school: '', date_of_birth: '' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null);
  const uname = form.username.trim().toLowerCase();
  const validFormat = /^[a-z0-9_.]{3,30}$/.test(uname);

  useEffect(() => {
    setUsernameOk(null);
    if (!validFormat) return;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('username_available', { p_username: uname });
      setUsernameOk(!!data);
    }, 400);
    return () => clearTimeout(t);
  }, [uname, validFormat]);

  const score = useMemo(() => passwordScore(form.password), [form.password]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validFormat) return setError('Usernames use 3–30 lowercase letters, numbers, dots or underscores.');
    if (usernameOk === false) return setError('That username is already taken.');
    if (form.password.length < 8 || score < 2) return setError('Choose a stronger password (at least 8 characters, mixing letters and numbers).');
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${SITE_URL}/app`,
        data: { full_name: form.full_name.trim(), username: uname, school: form.school.trim(), date_of_birth: form.date_of_birth },
      },
    });
    setBusy(false);
    if (err) return setError(/registered/i.test(err.message) ? 'An account with this email already exists. Try logging in.' : friendlyError(err.message));
    if (data.session) {
      toast.success('Account created — welcome to DBI Learn! 🎉');
      navigate(next && next.startsWith('/') ? next : '/app', { replace: true });
    } else {
      setSentTo(form.email.trim());
    }
  }

  if (sentTo)
    return (
      <AuthLayout title="Check your email">
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center dark:border-brand-900 dark:bg-brand-950/40">
          <MailCheck className="mx-auto h-10 w-10 text-brand-600" />
          <p className="mt-3">
            We sent a confirmation link to <strong>{sentTo}</strong>. Click it to activate your account, then log in.
          </p>
          <p className="mt-2 text-sm text-ink-500">Can't find it? Check your spam folder.</p>
        </div>
        <Link to="/login" className="mt-6 block text-center font-semibold text-brand-600 hover:underline">
          Go to log in
        </Link>
      </AuthLayout>
    );

  return (
    <AuthLayout
      title="Create your free account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</div>}
        <Field label="Full name" htmlFor="full_name" hint="This is the name printed on your certificates.">
          <Input id="full_name" autoComplete="name" required minLength={2} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field
          label="Username"
          htmlFor="username"
          error={form.username && !validFormat ? '3–30 characters: lowercase letters, numbers, dots or underscores.' : usernameOk === false ? 'That username is taken.' : null}
          hint={usernameOk ? <span className="flex items-center gap-1 text-brand-600"><CheckCircle2 className="h-3.5 w-3.5" /> Available</span> : 'You can log in with your username or email.'}
        >
          <div className="relative">
            <Input id="username" autoComplete="username" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} />
            {usernameOk === false && <XCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" />}
          </div>
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" htmlFor="new-password">
          <PasswordInput id="new-password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <PasswordStrength password={form.password} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="School (optional)" htmlFor="school">
            <Input id="school" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
          </Field>
          <Field label="Date of birth (optional)" htmlFor="dob">
            <Input id="dob" type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </Field>
        </div>
        <Checkbox
          required
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          label="I agree to learn respectfully and to use DBI Learn according to Digital Bridge Initiative's community guidelines."
        />
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!agree}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${SITE_URL}/reset-password` });
    setBusy(false);
    if (error) return toast.error(friendlyError(error.message));
    setSent(true);
  }
  return (
    <AuthLayout title="Reset your password" subtitle="Enter your account email and we'll send you a reset link.">
      {sent ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center dark:border-brand-900 dark:bg-brand-950/40">
          <MailCheck className="mx-auto h-10 w-10 text-brand-600" />
          <p className="mt-3">If an account exists for {email}, a reset link is on its way.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-6 block text-center text-sm font-semibold text-brand-600 hover:underline">
        Back to log in
      </Link>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY' || s) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordScore(password) < 2) return toast.error('Choose a stronger password.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (data.user) await supabase.from('profiles_private').update({ must_change_password: false }).eq('id', data.user.id);
    }
    setBusy(false);
    if (error) return toast.error(friendlyError(error.message));
    toast.success('Password updated. You are signed in.');
    navigate('/app', { replace: true });
  }
  return (
    <AuthLayout title="Choose a new password">
      {!ready ? (
        <p className="text-ink-500">Open this page from the reset link in your email. The link may have expired — request a new one.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" htmlFor="new-password">
            <PasswordInput id="new-password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordStrength password={password} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
