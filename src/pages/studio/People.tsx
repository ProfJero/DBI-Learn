import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Ban, Check, Copy, KeyRound, MoreHorizontal, Search, ShieldCheck, Trash2, UserPlus, X, Mail, Flame, Zap, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { supabase, must, callFunction } from '@/lib/supabase';
import type { Profile, Role } from '@/lib/types';
import { Avatar, Badge, Button, Card, ConfirmModal, EmptyState, Field, FullPageSpinner, Input, Modal, PageHeader, Progress, Select, Tabs } from '@/components/ui';
import { downloadText, formatDate, isAdminRole, ROLE_LABEL, timeAgo, toCsv } from '@/lib/utils';

type PersonRow = Profile & { profiles_private: { email: string; phone: string | null; school: string | null } | null; enrollments?: { count: number }[] };

const ROLE_TONE: Record<Role, 'purple' | 'blue' | 'green' | 'gray'> = { super_admin: 'purple', admin: 'blue', instructor: 'green', student: 'gray' };

function usePeople(roles: Role[]) {
  return useQuery({
    queryKey: ['people', roles.join()],
    queryFn: async () =>
      must(
        await supabase
          .from('profiles')
          .select('*, profiles_private(email, phone, school), enrollments(count)')
          .in('role', roles)
          .order('created_at', { ascending: false })
          .limit(1000),
      ) as PersonRow[],
  });
}

function filterPeople(list: PersonRow[] | undefined, q: string) {
  const n = q.toLowerCase();
  return (list ?? []).filter((p) => !n || `${p.full_name} ${p.username ?? ''} ${p.profiles_private?.email ?? ''} ${p.profiles_private?.school ?? ''}`.toLowerCase().includes(n));
}

export function Learners() {
  const { profile } = useAuth();
  const admin = isAdminRole(profile?.role);
  const [q, setQ] = useState('');
  const { data: all, isLoading } = usePeople(['student']);
  // Instructors only see learners enrolled in their courses (RLS limits enrollments; filter here).
  const { data: myLearnerIds } = useQuery({
    queryKey: ['my-learner-ids', profile?.id],
    enabled: !admin,
    queryFn: async () => {
      const rows = must(await supabase.from('enrollments').select('user_id, course:courses!inner(instructor_id)').eq('course.instructor_id', profile!.id)) as { user_id: string }[];
      return new Set(rows.map((r) => r.user_id));
    },
  });
  const list = useMemo(() => filterPeople(all, q).filter((p) => admin || myLearnerIds?.has(p.id)), [all, q, admin, myLearnerIds]);

  return (
    <>
      <PageHeader
        title="Learners"
        subtitle={admin ? 'Everyone learning on DBI Learn.' : 'Learners enrolled in your courses.'}
        actions={
          <Button
            variant="outline"
            disabled={!list.length}
            onClick={() =>
              downloadText(
                'dbi-learners.csv',
                toCsv(list.map((p) => ({ name: p.full_name, username: p.username ?? '', email: p.profiles_private?.email ?? '', school: p.profiles_private?.school ?? '', xp: p.xp, streak: p.streak, courses: p.enrollments?.[0]?.count ?? 0, status: p.status, joined: p.created_at }))),
              )
            }
          >
            Export CSV
          </Button>
        }
      />
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input className="pl-10" placeholder="Search by name, email or school" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search learners" />
      </div>
      {isLoading ? <FullPageSpinner /> : <PeopleTable rows={list} manage={admin} />}
    </>
  );
}

function PeopleTable({ rows, manage, staff }: { rows: PersonRow[]; manage: boolean; staff?: boolean }) {
  const { profile: me } = useAuth();
  const qc = useQueryClient();
  const [menu, setMenu] = useState<string | null>(null);
  const [roleFor, setRoleFor] = useState<PersonRow | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'suspend' | 'delete' | 'reset'; p: PersonRow } | null>(null);
  const [tempPw, setTempPw] = useState<{ name: string; email: string; password: string } | null>(null);
  const superAdmin = me?.role === 'super_admin';
  const refresh = () => void qc.invalidateQueries({ queryKey: ['people'] });

  const canManage = (p: PersonRow) => manage && p.id !== me?.id && (superAdmin || p.role === 'student' || p.role === 'instructor');

  const act = useMutation({
    mutationFn: async ({ kind, p }: { kind: 'suspend' | 'delete' | 'reset'; p: PersonRow }) => {
      if (kind === 'suspend') must(await supabase.rpc('set_user_status', { p_user: p.id, p_status: p.status === 'active' ? 'suspended' : 'active' }));
      if (kind === 'delete') await callFunction('staff-admin', { action: 'delete_user', user_id: p.id });
      if (kind === 'reset') {
        const r = await callFunction<{ temp_password: string }>('staff-admin', { action: 'reset_password', user_id: p.id });
        setTempPw({ name: p.full_name, email: p.profiles_private?.email ?? '', password: r.temp_password });
      }
    },
    onSuccess: (_d, { kind, p }) => {
      if (kind === 'suspend') toast.success(p.status === 'active' ? `${p.full_name} suspended` : `${p.full_name} reactivated`);
      if (kind === 'delete') toast.success('Account deleted');
      setConfirm(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!rows.length) return <EmptyState title="No people found" />;
  return (
    <Card className="overflow-visible">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-500 dark:bg-ink-800/50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              {!staff && <th className="px-4 py-3 text-right">Courses</th>}
              {!staff && <th className="px-4 py-3 text-right">XP</th>}
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {rows.map((p) => (
              <tr key={p.id} className={p.status === 'suspended' ? 'opacity-60' : ''}>
                <td className="px-4 py-3">
                  <Link to={`/admin/learners/${p.id}`} className="flex items-center gap-3 hover:text-brand-600">
                    <Avatar name={p.full_name} url={p.avatar_url} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {p.full_name} {p.status === 'suspended' && <Badge tone="red">Suspended</Badge>}
                      </span>
                      <span className="block truncate text-xs text-ink-500">{p.profiles_private?.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={ROLE_TONE[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                </td>
                {!staff && <td className="px-4 py-3 text-right">{p.enrollments?.[0]?.count ?? 0}</td>}
                {!staff && <td className="px-4 py-3 text-right">{p.xp}</td>}
                <td className="px-4 py-3 text-ink-500">{formatDate(p.created_at)}</td>
                <td className="relative px-4 py-3 text-right">
                  {canManage(p) && (
                    <>
                      <button className="rounded-lg p-1.5 hover:bg-ink-100 dark:hover:bg-ink-800" onClick={() => setMenu(menu === p.id ? null : p.id)} aria-label="Actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menu === p.id && (
                        <div className="absolute right-4 top-11 z-20 w-52 rounded-xl border border-ink-100 bg-white p-1 text-left shadow-lift dark:border-ink-700 dark:bg-ink-900" onMouseLeave={() => setMenu(null)}>
                          <MenuItem icon={<ShieldCheck className="h-4 w-4" />} onClick={() => { setRoleFor(p); setMenu(null); }}>
                            Change role
                          </MenuItem>
                          <MenuItem icon={<KeyRound className="h-4 w-4" />} onClick={() => { setConfirm({ kind: 'reset', p }); setMenu(null); }}>
                            Reset password
                          </MenuItem>
                          <MenuItem icon={<Ban className="h-4 w-4" />} onClick={() => { setConfirm({ kind: 'suspend', p }); setMenu(null); }}>
                            {p.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </MenuItem>
                          {superAdmin && (
                            <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onClick={() => { setConfirm({ kind: 'delete', p }); setMenu(null); }}>
                              Delete account
                            </MenuItem>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RoleModal person={roleFor} onClose={() => setRoleFor(null)} onSaved={refresh} />
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && act.mutate(confirm)}
        loading={act.isPending}
        danger={confirm?.kind !== 'reset'}
        title={confirm?.kind === 'delete' ? 'Delete account?' : confirm?.kind === 'reset' ? 'Reset password?' : confirm?.p.status === 'active' ? 'Suspend account?' : 'Reactivate account?'}
        confirmLabel={confirm?.kind === 'delete' ? 'Delete permanently' : confirm?.kind === 'reset' ? 'Generate temporary password' : 'Confirm'}
        body={
          confirm?.kind === 'delete'
            ? `This permanently deletes ${confirm.p.full_name}'s account and learning history. Issued certificates stay verifiable.`
            : confirm?.kind === 'reset'
              ? `A new temporary password will be generated for ${confirm.p.full_name}. Share it with them securely; they'll be asked to change it.`
              : `${confirm?.p.full_name} will ${confirm?.p.status === 'active' ? 'lose access until reactivated' : 'regain access'}.`
        }
      />
      <TempPasswordModal value={tempPw} onClose={() => setTempPw(null)} />
    </Card>
  );
}

function MenuItem({ children, icon, onClick, danger }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800 ${danger ? 'text-red-600' : ''}`}>
      {icon}
      {children}
    </button>
  );
}

function RoleModal({ person, onClose, onSaved }: { person: PersonRow | null; onClose: () => void; onSaved: () => void }) {
  const { profile: me } = useAuth();
  const [role, setRole] = useState<Role>('student');
  useEffect(() => {
    if (person) setRole(person.role);
  }, [person]);
  const options: Role[] = me?.role === 'super_admin' ? ['student', 'instructor', 'admin', 'super_admin'] : ['student', 'instructor'];
  const save = useMutation({
    mutationFn: async () => must(await supabase.rpc('set_user_role', { p_user: person!.id, p_role: role })),
    onSuccess: () => {
      toast.success(`${person!.full_name} is now ${ROLE_LABEL[role]}`);
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Modal
      open={!!person}
      onClose={onClose}
      title={`Change role — ${person?.full_name}`}
      size="sm"
      footer={
        <Button loading={save.isPending} disabled={role === person?.role} onClick={() => save.mutate()}>
          Save role
        </Button>
      }
    >
      <div className="space-y-2">
        {options.map((r) => (
          <label key={r} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${role === r ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-ink-100 dark:border-ink-800'}`}>
            <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="mt-1" />
            <span>
              <span className="block font-semibold">{ROLE_LABEL[r]}</span>
              <span className="text-xs text-ink-500">
                {r === 'student' && 'Learns courses, earns certificates.'}
                {r === 'instructor' && 'Creates courses and sees their own learners. Admins publish their courses.'}
                {r === 'admin' && 'Manages courses, learners, instructors, certificates and support.'}
                {r === 'super_admin' && 'Full control, including adding and removing admins.'}
              </span>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

function TempPasswordModal({ value, onClose }: { value: { name: string; email: string; password: string } | null; onClose: () => void }) {
  const text = value ? `DBI Learn login\nEmail: ${value.email}\nTemporary password: ${value.password}\nSign in at ${location.origin}/login and change your password in Settings.` : '';
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title="Account credentials"
      size="sm"
      footer={
        <Button
          icon={<Copy className="h-4 w-4" />}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast.success('Copied');
          }}
        >
          Copy details
        </Button>
      }
    >
      <p className="text-sm text-ink-600 dark:text-ink-300">
        Share these with <strong>{value?.name}</strong> privately. This password is shown <strong>only once</strong>; they'll be asked to set their own.
      </p>
      <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-ink-900 p-4 font-mono text-sm text-brand-300">{text}</pre>
    </Modal>
  );
}

export function Staff() {
  const { profile } = useAuth();
  const superAdmin = profile?.role === 'super_admin';
  const [tab, setTab] = useState<'all' | 'admin' | 'instructor'>('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const { data, isLoading } = usePeople(['super_admin', 'admin', 'instructor']);
  const list = filterPeople(data, q).filter((p) => tab === 'all' || (tab === 'admin' ? p.role === 'admin' || p.role === 'super_admin' : p.role === tab));
  return (
    <>
      <PageHeader
        title="Admins & instructors"
        subtitle={superAdmin ? 'Add administrators and instructors, and manage their access.' : 'Add instructors and manage their access.'}
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            Add {superAdmin ? 'staff member' : 'instructor'}
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'All staff', count: data?.length },
            { value: 'admin', label: 'Admins', count: data?.filter((p) => p.role !== 'instructor').length },
            { value: 'instructor', label: 'Instructors', count: data?.filter((p) => p.role === 'instructor').length },
          ]}
        />
        <div className="relative sm:w-72">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input className="pl-10" placeholder="Search staff" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search staff" />
        </div>
      </div>
      {isLoading ? <FullPageSpinner /> : <PeopleTable rows={list} manage staff />}
      <AddStaffModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function AddStaffModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const superAdmin = profile?.role === 'super_admin';
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: '', email: '', role: 'instructor' as Role, headline: '' });
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
  const roles: Role[] = superAdmin ? ['instructor', 'admin', 'super_admin'] : ['instructor'];
  const create = useMutation({
    mutationFn: async () => callFunction<{ temp_password: string; email: string }>('staff-admin', { action: 'create_user', ...f }),
    onSuccess: (r) => {
      setCreated({ name: f.full_name, email: r.email, password: r.temp_password });
      setF({ full_name: '', email: '', role: 'instructor', headline: '' });
      void qc.invalidateQueries({ queryKey: ['people'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`Add ${superAdmin ? 'a staff member' : 'an instructor'}`}
        footer={
          <Button loading={create.isPending} disabled={f.full_name.trim().length < 2 || !f.email.includes('@')} onClick={() => create.mutate()} icon={<UserPlus className="h-4 w-4" />}>
            Create account
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" htmlFor="as-name">
            <Input id="as-name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="as-email" hint="They'll sign in with this email and a temporary password.">
            <Input id="as-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Role" htmlFor="as-role">
            <Select id="as-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title / headline (optional)" htmlFor="as-head" hint="e.g. Head of Software Development">
            <Input id="as-head" value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <TempPasswordModal value={created} onClose={() => setCreated(null)} />
    </>
  );
}

export function LearnerDetail() {
  const { id = '' } = useParams();
  const { data: person, isLoading } = useQuery({
    queryKey: ['person', id],
    queryFn: async () => must(await supabase.from('profiles').select('*, profiles_private(*)').eq('id', id).maybeSingle()) as (Profile & { profiles_private: Record<string, string | null> | null }) | null,
  });
  const { data: enrollments } = useQuery({
    queryKey: ['person-enrollments', id],
    queryFn: async () => must(await supabase.from('enrollments').select('*, course:courses(title, slug)').eq('user_id', id).order('last_activity_at', { ascending: false })) as {
      course_id: string;
      progress: number;
      status: string;
      last_activity_at: string;
      course: { title: string; slug: string };
    }[],
  });
  const { data: attempts } = useQuery({
    queryKey: ['person-attempts', id],
    queryFn: async () => must(await supabase.from('quiz_attempts').select('id, percent, passed, submitted_at, submitted_offline, quiz:quizzes(title)').eq('user_id', id).order('submitted_at', { ascending: false }).limit(20)) as unknown as {
      id: string;
      percent: number;
      passed: boolean;
      submitted_at: string;
      submitted_offline: boolean;
      quiz: { title: string };
    }[],
  });
  const { data: certs } = useQuery({
    queryKey: ['person-certs', id],
    queryFn: async () => must(await supabase.from('certificates').select('serial, course_title, issued_at, status').eq('user_id', id)) as { serial: string; course_title: string; issued_at: string; status: string }[],
  });
  if (isLoading) return <FullPageSpinner />;
  if (!person) return <EmptyState title="Person not found" />;
  const pp = person.profiles_private ?? {};
  return (
    <>
      <Link to="/admin/learners" className="text-sm text-ink-500 hover:text-brand-600">
        ← Learners
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="p-6">
          <div className="text-center">
            <Avatar name={person.full_name} url={person.avatar_url} size={88} className="mx-auto" />
            <h1 className="mt-3 text-xl font-bold">{person.full_name}</h1>
            <p className="text-sm text-ink-500">{person.username && `@${person.username}`}</p>
            <div className="mt-2 flex justify-center gap-2">
              <Badge tone={ROLE_TONE[person.role]}>{ROLE_LABEL[person.role]}</Badge>
              {person.status === 'suspended' && <Badge tone="red">Suspended</Badge>}
            </div>
          </div>
          <dl className="mt-6 space-y-2.5 text-sm">
            {[
              ['Email', pp.email],
              ['Phone', pp.phone],
              ['School', pp.school],
              ['Date of birth', pp.date_of_birth && formatDate(pp.date_of_birth)],
              ['Guardian', [pp.guardian_name, pp.guardian_phone].filter(Boolean).join(' · ')],
              ['Joined', formatDate(person.created_at)],
              ['Last active', person.last_active_date ? formatDate(person.last_active_date) : '—'],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-3">
                <dt className="text-ink-500">{k}</dt>
                <dd className="truncate text-right font-medium">{v || '—'}</dd>
              </div>
            ))}
          </dl>
          {pp.email && (
            <a href={`mailto:${pp.email}`} className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-ink-200 py-2 text-sm font-medium hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800">
              <Mail className="h-4 w-4" /> Email learner
            </a>
          )}
        </Card>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4"><Zap className="h-5 w-5 text-amber-500" /><p className="mt-1 text-xl font-bold">{person.xp}</p><p className="text-xs text-ink-500">XP</p></Card>
            <Card className="p-4"><Flame className="h-5 w-5 text-orange-500" /><p className="mt-1 text-xl font-bold">{person.streak}</p><p className="text-xs text-ink-500">day streak</p></Card>
            <Card className="p-4"><Award className="h-5 w-5 text-gold-600" /><p className="mt-1 text-xl font-bold">{certs?.length ?? 0}</p><p className="text-xs text-ink-500">certificates</p></Card>
          </div>
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><BookOpen className="h-4 w-4" /> Courses</h2>
            {!enrollments?.length && <p className="text-sm text-ink-500">Not enrolled in any courses yet.</p>}
            <ul className="space-y-3">
              {enrollments?.map((e) => (
                <li key={e.course_id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{e.course.title}</span>
                    <span className="text-ink-500">{e.progress}% · {timeAgo(e.last_activity_at)}</span>
                  </div>
                  <Progress value={e.progress} className="mt-1.5" />
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-bold">Recent quiz attempts</h2>
            {!attempts?.length && <p className="text-sm text-ink-500">No quiz attempts yet.</p>}
            <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
              {attempts?.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span>
                    {a.quiz.title} {a.submitted_offline && <Badge>offline</Badge>}
                    <span className="block text-xs text-ink-400">{formatDate(a.submitted_at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </span>
                  <span className={`font-bold ${a.passed ? 'text-brand-600' : 'text-red-500'}`}>{a.percent}%</span>
                </li>
              ))}
            </ul>
          </Card>
          {!!certs?.length && (
            <Card className="p-5">
              <h2 className="mb-3 font-bold">Certificates</h2>
              <ul className="space-y-2 text-sm">
                {certs.map((c) => (
                  <li key={c.serial} className="flex justify-between">
                    <Link to={`/verify/${c.serial}`} className="hover:text-brand-600">{c.course_title}</Link>
                    <span className="font-mono text-xs text-ink-500">{c.serial}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export function Applications() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () =>
      must(await supabase.from('instructor_applications').select('*, applicant:profiles!instructor_applications_user_id_fkey(id, full_name, avatar_url, profiles_private(email))').order('created_at', { ascending: false })) as {
        id: string;
        expertise: string;
        experience: string;
        portfolio_url: string | null;
        status: string;
        created_at: string;
        applicant: { id: string; full_name: string; avatar_url: string | null; profiles_private: { email: string } | null };
      }[],
  });
  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => must(await supabase.rpc('review_instructor_application', { p_application: id, p_approve: approve })),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? 'Approved — they are now an instructor.' : 'Application declined.');
      void qc.invalidateQueries({ queryKey: ['applications'] });
      void qc.invalidateQueries({ queryKey: ['studio-counts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="Instructor applications" subtitle="Learners who want to teach on DBI Learn." />
      {isLoading && <FullPageSpinner />}
      {!isLoading && !data?.length && <EmptyState icon={<UserPlus className="h-5 w-5" />} title="No applications yet" body="Learners can apply from the “Teach on DBI Learn” page." />}
      <div className="space-y-4">
        {data?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={a.applicant.full_name} url={a.applicant.avatar_url} size={44} />
                <div>
                  <p className="font-bold">{a.applicant.full_name}</p>
                  <p className="text-xs text-ink-500">{a.applicant.profiles_private?.email} · applied {timeAgo(a.created_at)}</p>
                </div>
              </div>
              <Badge tone={a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'amber'} className="capitalize">{a.status}</Badge>
            </div>
            <p className="mt-4 text-sm font-semibold">Wants to teach: {a.expertise}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-600 dark:text-ink-300">{a.experience}</p>
            {a.portfolio_url && (
              <a href={a.portfolio_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-sky-600 hover:underline">
                {a.portfolio_url}
              </a>
            )}
            {a.status === 'pending' && (
              <div className="mt-4 flex gap-2">
                <Button size="sm" icon={<Check className="h-4 w-4" />} loading={review.isPending} onClick={() => review.mutate({ id: a.id, approve: true })}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" icon={<X className="h-4 w-4" />} onClick={() => review.mutate({ id: a.id, approve: false })}>
                  Decline
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
