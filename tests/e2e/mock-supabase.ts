// In-memory stand-in for the Supabase REST/Auth/RPC endpoints used by the app, seeded with the real
// course content generated from content/. It lets Playwright exercise full UI flows in CI or in
// sandboxes that cannot reach Supabase. Server-side security is tested separately against Postgres.
import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(join(here, '../fixtures/content.json'), 'utf8'));

export const USERS = {
  student: { id: '11111111-1111-4111-8111-111111111111', email: 'ama@example.com', password: 'Learner-Pass-2026', full_name: 'Ama Owusu', username: 'ama', role: 'student' },
  superAdmin: { id: '22222222-2222-4222-8222-222222222222', email: 'admin@example.com', password: 'Admin-Pass-2026', full_name: 'ProfJero', username: 'profjero', role: 'super_admin' },
};

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function b64url(o: unknown) {
  return Buffer.from(JSON.stringify(o)).toString('base64url');
}
function jwtFor(id: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: id, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
}

export class MockSupabase {
  db: Record<string, Row[]> = {};
  calls: { method: string; path: string; body?: unknown }[] = [];
  currentUser: string | null = null;

  constructor() {
    const catBySlug = new Map(fixtures.categories.map((c: Row) => [c.slug, c]));
    this.db.categories = fixtures.categories;
    this.db.courses = fixtures.courses.map((c: Row) => ({ ...c.course, category_id: (catBySlug.get(c.course.category_slug) as Row).id }));
    this.db.modules = fixtures.courses.flatMap((c: Row) => c.modules);
    this.db.lessons = fixtures.courses.flatMap((c: Row) => c.lessons);
    this.db.quizzes = fixtures.courses.flatMap((c: Row) => c.quizzes);
    this.db.questions = fixtures.courses.flatMap((c: Row) => c.questions);
    this.db.question_keys = fixtures.courses.flatMap((c: Row) => c.keys);
    this.db.badges = [
      ['first_steps', 'First Steps', '👣'], ['quiz_whiz', 'Quiz Whiz', '🧠'], ['perfectionist', 'Perfectionist', '💯'], ['streak_3', 'On Fire', '🔥'],
      ['streak_7', 'Unstoppable', '⚡'], ['streak_30', 'Dedicated', '🏆'], ['graduate', 'Graduate', '🎓'], ['scholar', 'Scholar', '📚'],
      ['community', 'Community Voice', '💬'], ['offline_learner', 'Anywhere Learner', '📶'],
    ].map(([code, name, icon], i) => ({ code, name, icon, description: `${name} badge`, color: '#03c14b', position: i + 1 }));
    this.db.settings = [
      { key: 'branding', value: { platform_name: 'DBI Learn', organisation: 'Digital Bridge Initiative', built_by: 'ProfJero Digital Studio', support_email: 'ruraltechh@gmail.com', support_phone: '+233 53 120 7256', address: 'Ayeldu, Ghana' } },
      { key: 'certificate', value: { signatories: [{ name: 'Benjamin Amoako', title: 'Executive Director', signature_url: '/images/signatures/executive-director.png' }] } },
    ];
    this.db.profiles = Object.values(USERS).map((u) => ({
      id: u.id, full_name: u.full_name, username: u.username, role: u.role, status: 'active', avatar_url: null, headline: null, bio: null, location: null,
      xp: 0, streak: 0, longest_streak: 0, last_active_date: null, daily_goal_minutes: 15, created_at: '2026-10-01T00:00:00Z',
    }));
    this.db.profiles_private = Object.values(USERS).map((u) => ({ id: u.id, email: u.email, phone: null, date_of_birth: null, gender: null, school: null, guardian_name: null, guardian_phone: null, must_change_password: false }));
    this.db.announcements = [{ id: uuid(), course_id: null, title: 'Welcome to the new DBI Learn! 🎉', body: 'Learn online or offline.', author_id: USERS.superAdmin.id, pinned: true, created_at: now() }];
    for (const t of ['enrollments', 'lesson_progress', 'quiz_attempts', 'certificates', 'user_badges', 'xp_events', 'notifications', 'lesson_notes', 'course_reviews', 'discussion_threads', 'discussion_replies', 'support_tickets', 'ticket_messages', 'resources', 'instructor_applications', 'inquiries', 'audit_logs', 'course_questions', 'course_answers', 'question_votes', 'practice_completions'])
      this.db[t] = [];
  }

  /** Pass `{ tour: true }` to see the first-visit welcome tour; other tests skip it. */
  async install(page: Page, opts: { tour?: boolean } = {}) {
    if (!opts.tour)
      await page.addInitScript((ids) => {
        try {
          ids.forEach((id) => localStorage.setItem(`dbi:tour:${id}`, 'seen'));
        } catch {
          /* sandboxed preview frames have no storage */
        }
      }, Object.values(USERS).map((u) => u.id));
    await page.route(/\.supabase\.co\//, (route) => this.handle(route));
  }

  // ---------------------------------------------------------------- helpers
  private profile(id: string) {
    return this.db.profiles.find((p) => p.id === id)!;
  }
  private notify(user: string, title: string, link: string | null = null) {
    this.db.notifications.push({ id: uuid(), user_id: user, kind: 'info', title, body: null, link, read_at: null, created_at: now() });
  }
  private award(user: string, amount: number, reason: string) {
    if (amount <= 0) return;
    this.db.xp_events.push({ id: this.db.xp_events.length + 1, user_id: user, amount, reason, created_at: now() });
    this.profile(user).xp += amount;
  }
  private badge(user: string, code: string) {
    if (this.db.user_badges.some((b) => b.user_id === user && b.badge_code === code)) return;
    this.db.user_badges.push({ user_id: user, badge_code: code, awarded_at: now() });
  }
  private ensureEnrolled(user: string, course: string) {
    if (!this.db.enrollments.some((e) => e.user_id === user && e.course_id === course))
      this.db.enrollments.push({ user_id: user, course_id: course, status: 'active', progress: 0, last_lesson_id: null, enrolled_at: now(), last_activity_at: now(), completed_at: null });
  }
  private recompute(user: string, course: string) {
    const lessons = this.db.lessons.filter((l) => l.course_id === course);
    const quizzes = this.db.quizzes.filter((q) => q.course_id === course && q.kind !== 'practice');
    const done = this.db.lesson_progress.filter((p) => p.user_id === user && p.course_id === course).length;
    const passed = quizzes.filter((q) => this.db.quiz_attempts.some((a) => a.user_id === user && a.quiz_id === q.id && a.passed)).length;
    const total = lessons.length + quizzes.length;
    const pct = total ? Math.floor((100 * (done + passed)) / total) : 0;
    const e = this.db.enrollments.find((x) => x.user_id === user && x.course_id === course)!;
    e.progress = pct;
    e.last_activity_at = now();
    let serial: string | null = null;
    if (pct === 100) {
      if (e.status !== 'completed') {
        e.status = 'completed';
        e.completed_at = now();
        this.award(user, 100, 'course_completed');
        this.badge(user, 'graduate');
      }
      let cert = this.db.certificates.find((c) => c.user_id === user && c.course_id === course);
      if (!cert) {
        const c = this.db.courses.find((x) => x.id === course)!;
        const cat = this.db.categories.find((x) => x.id === c.category_id);
        const best = quizzes.map((q) => Math.max(...this.db.quiz_attempts.filter((a) => a.user_id === user && a.quiz_id === q.id).map((a) => a.percent)));
        const grade = Math.round(best.reduce((s, b) => s + b, 0) / Math.max(best.length, 1));
        cert = {
          id: uuid(), serial: `DBI-2026-TEST-${String(this.db.certificates.length + 1).padStart(4, '0')}`, user_id: user, recipient_name: this.profile(user).full_name,
          recipient_email: null, course_id: course, course_title: c.title, category_name: cat?.name ?? null, kind: grade >= 85 ? 'distinction' : 'completion', grade,
          hours: c.estimated_hours, description: null, signatories: [...this.db.settings[1]!.value.signatories, ...(cat?.signatory ? [cat.signatory] : [])],
          status: 'valid', revoked_reason: null, issued_at: now(),
        };
        this.db.certificates.push(cert);
        this.notify(user, 'Your certificate is ready 🎓', `/app/certificates/${cert.serial}`);
      }
      serial = cert.serial;
    }
    return { progress: pct, completed: pct === 100, certificate_serial: serial };
  }

  private embed(table: string, rows: Row[], select: string): Row[] {
    const course = (c: Row, sel: string) => {
      const out: Row = { ...c };
      if (sel.includes('category:categories')) {
        const cat = this.db.categories.find((x) => x.id === c.category_id);
        out.category = cat ? { id: cat.id, name: cat.name, slug: cat.slug, color: cat.color, icon: cat.icon } : null;
      }
      if (sel.includes('instructor:profiles')) out.instructor = null;
      if (sel.includes('lessons(count)')) out.lessons = [{ count: this.db.lessons.filter((l) => l.course_id === c.id).length }];
      if (sel.includes('quizzes(count)')) out.quizzes = [{ count: this.db.quizzes.filter((q) => q.course_id === c.id).length }];
      return out;
    };
    if (table === 'courses') return rows.map((r) => course(r, select));
    if (table === 'enrollments' && select.includes('course:courses'))
      return rows.map((r) => ({ ...r, course: course(this.db.courses.find((c) => c.id === r.course_id)!, select) }));
    const person = (id: string) => {
      const pr = this.profile(id);
      return pr ? { id: pr.id, full_name: pr.full_name, avatar_url: null, role: pr.role } : null;
    };
    if (table === 'course_questions')
      return rows.map((r) => {
        const c = this.db.courses.find((x) => x.id === r.course_id);
        return {
          ...r,
          asker: person(r.asker_id),
          course: c ? { title: c.title, slug: c.slug, instructor_id: c.instructor_id ?? null } : null,
          module: r.module_id ? { title: this.db.modules.find((m) => m.id === r.module_id)?.title } : null,
          lesson: r.lesson_id ? { title: this.db.lessons.find((l) => l.id === r.lesson_id)?.title } : null,
        };
      });
    if (table === 'course_answers') return rows.map((r) => ({ ...r, author: person(r.author_id) }));
    if (table === 'announcements') return rows.map((r) => ({ ...r, course: null, author: { full_name: 'ProfJero', avatar_url: null } }));
    if (table === 'quizzes' && select.includes('questions(count)'))
      return rows.map((r) => ({ ...r, questions: [{ count: this.db.questions.filter((q) => q.quiz_id === r.id).length }] }));
    if (table === 'profiles' && select.includes('profiles_private'))
      return rows.map((r) => ({ ...r, profiles_private: this.db.profiles_private.find((p) => p.id === r.id) ?? null, enrollments: [{ count: this.db.enrollments.filter((e) => e.user_id === r.id).length }] }));
    return rows;
  }

  private filter(rows: Row[], params: URLSearchParams) {
    let out = rows;
    for (const [key, raw] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key) || key.includes('.')) continue;
      const [op, ...rest] = raw.split('.');
      const val = rest.join('.');
      out = out.filter((r) => {
        const v = r[key];
        switch (op) {
          case 'eq': return String(v) === val;
          case 'neq': return String(v) !== val;
          case 'in': return val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v));
          case 'is': return val === 'null' ? v == null : String(v) === val;
          case 'gte': return String(v) >= val;
          case 'lte': return String(v) <= val;
          case 'gt': return String(v) > val;
          case 'lt': return String(v) < val;
          default: return true;
        }
      });
    }
    const order = params.get('order');
    if (order) {
      for (const part of order.split(',').reverse()) {
        const [col, dir] = part.split('.');
        out = [...out].sort((a, b) => (a[col!] > b[col!] ? 1 : a[col!] < b[col!] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
      }
    }
    const limit = params.get('limit');
    return limit ? out.slice(0, Number(limit)) : out;
  }

  // ---------------------------------------------------------------- RPCs
  private rpc(name: string, a: Row): unknown {
    const uid = this.currentUser;
    switch (name) {
      case 'username_available':
        return /^[a-z0-9_.]{3,30}$/.test(a.p_username) && !this.db.profiles.some((p) => p.username === a.p_username);
      case 'course_outline': {
        const modules = this.db.modules.filter((m) => m.course_id === a.p_course_id).sort((x, y) => x.position - y.position);
        return {
          modules: modules.map((m) => ({ ...m, lessons: this.db.lessons.filter((l) => l.module_id === m.id).sort((x, y) => x.position - y.position).map(({ content: _c, ...l }) => l) })),
          quizzes: this.db.quizzes.filter((q) => q.course_id === a.p_course_id),
        };
      }
      case 'enroll':
        this.ensureEnrolled(uid!, a.p_course_id);
        return this.recompute(uid!, a.p_course_id);
      case 'complete_lesson': {
        const l = this.db.lessons.find((x) => x.id === a.p_lesson_id)!;
        this.ensureEnrolled(uid!, l.course_id);
        const isNew = !this.db.lesson_progress.some((p) => p.user_id === uid && p.lesson_id === l.id);
        if (isNew) {
          this.db.lesson_progress.push({ user_id: uid, lesson_id: l.id, course_id: l.course_id, seconds_spent: a.p_seconds ?? 0, completed_at: a.p_completed_at ?? now() });
          this.award(uid!, 10, 'lesson_completed');
          this.badge(uid!, 'first_steps');
        }
        const p = this.profile(uid!);
        p.streak = Math.max(1, p.streak);
        p.last_active_date = now().slice(0, 10);
        return { ...this.recompute(uid!, l.course_id), xp_awarded: isNew ? 10 : 0 };
      }
      case 'get_practice_keys': {
        const qs = this.db.questions.filter((q) => q.quiz_id === a.p_quiz_id).map((q) => q.id);
        const quiz = this.db.quizzes.find((q) => q.id === a.p_quiz_id);
        return quiz?.kind === 'practice' ? this.db.question_keys.filter((k) => qs.includes(k.question_id)) : [];
      }
      case 'submit_quiz': {
        const dup = this.db.quiz_attempts.find((x) => x.client_id === a.p_client_id);
        if (dup) return { ...dup, duplicate: true };
        const quiz = this.db.quizzes.find((q) => q.id === a.p_quiz_id)!;
        const qs = this.db.questions.filter((q) => q.quiz_id === quiz.id);
        let total = 0;
        let earned = 0;
        const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
        const results = qs.map((q) => {
          const key = this.db.question_keys.find((k) => k.question_id === q.id)!;
          const given: string[] = a.p_answers[q.id] ?? [];
          const correct =
            q.kind === 'short'
              ? key.answer.some((k: string) => norm(k) === norm(given[0] ?? ''))
              : [...given].sort().join('|') === [...key.answer].sort().join('|');
          total += q.points;
          if (correct) earned += q.points;
          return { question_id: q.id, correct, points: q.points, earned: correct ? q.points : 0, given, answer: key.answer, explanation: key.explanation };
        });
        const percent = Math.floor((100 * earned) / total);
        const prev = this.db.quiz_attempts.filter((x) => x.user_id === uid && x.quiz_id === quiz.id);
        const attempt = {
          id: uuid(), client_id: a.p_client_id, quiz_id: quiz.id, course_id: quiz.course_id, user_id: uid, answers: a.p_answers, results, score: earned, max_score: total,
          percent, passed: percent >= quiz.pass_mark, started_at: a.p_started_at, submitted_at: now(), submitted_offline: !!a.p_offline,
        };
        this.ensureEnrolled(uid!, quiz.course_id);
        this.db.quiz_attempts.push(attempt);
        let xp = prev.length ? 0 : Math.min(20, Math.floor(percent / 5));
        if (attempt.passed && !prev.some((p) => p.passed)) {
          xp += 25;
          this.badge(uid!, 'quiz_whiz');
        }
        if (a.p_offline) this.badge(uid!, 'offline_learner');
        this.award(uid!, xp, 'quiz_submitted');
        return { ...attempt, xp_awarded: xp, pass_mark: quiz.pass_mark, course_progress: this.recompute(uid!, quiz.course_id) };
      }
      case 'complete_practice': {
        const uid = this.currentUser!;
        if (this.db.practice_completions.some((c) => c.user_id === uid && c.challenge_id === a.p_challenge)) return { new: false, xp: 0 };
        const xp = Math.min(Math.max(Number(a.p_xp) || 0, 0), 25);
        this.db.practice_completions.push({ user_id: uid, challenge_id: a.p_challenge, language: a.p_language, xp, completed_at: now() });
        this.award(uid, xp, 'practice');
        return { new: true, xp, total: this.db.practice_completions.filter((c) => c.user_id === uid).length };
      }
      case 'leaderboard':
        return this.db.profiles.filter((p) => p.role === 'student' && p.xp > 0).sort((x, y) => y.xp - x.xp).map((p, i) => ({ user_id: p.id, full_name: p.full_name, username: p.username, avatar_url: null, xp: p.xp, streak: p.streak, rank: i + 1 }));
      case 'verify_certificate':
        return this.db.certificates.filter((c) => c.serial.toUpperCase() === String(a.p_serial).toUpperCase()).map((c) => ({ ...c, course_slug: this.db.courses.find((x) => x.id === c.course_id)?.slug ?? null }));
      case 'staff_overview':
        return {
          students: this.db.profiles.filter((p) => p.role === 'student').length, instructors: 0, admins: 1, courses_published: this.db.courses.length, courses_draft: 0, courses_review: 0,
          enrollments: this.db.enrollments.length, completions: this.db.enrollments.filter((e) => e.status === 'completed').length, certificates: this.db.certificates.length,
          avg_quiz_score: 0, quiz_attempts: this.db.quiz_attempts.length, active_learners_7d: 1, open_tickets: 0, pending_applications: 0,
          signups_30d: Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10), count: i % 4 })),
          enrollments_30d: Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10), count: (i * 7) % 5 })),
          top_courses: this.db.courses.slice(0, 5).map((c) => ({ id: c.id, title: c.title, slug: c.slug, enrollment_count: 0, completions: 0, avg_score: 0, rating_avg: 0 })),
          by_category: this.db.categories.map((c) => ({ name: c.name, enrollments: 0 })),
        };
      default:
        throw new Error(`Unmocked RPC ${name}`);
    }
  }

  // ---------------------------------------------------------------- router
  private async handle(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    let body: Row | undefined;
    try {
      body = req.postDataJSON() ?? undefined;
    } catch {
      body = undefined;
    }
    this.calls.push({ method, path: url.pathname + url.search, body });
    const auth = req.headers()['authorization']?.replace('Bearer ', '');
    if (auth && auth.split('.').length === 3) {
      try {
        this.currentUser = JSON.parse(Buffer.from(auth.split('.')[1]!, 'base64url').toString()).sub ?? null;
      } catch {
        /* anon key */
      }
    }
    const p = url.pathname;

    const sessionFor = (u: (typeof USERS)[keyof typeof USERS]) => ({
      access_token: jwtFor(u.id), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `refresh-${u.id}`,
      user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email' }, user_metadata: { full_name: u.full_name }, created_at: '2026-10-01T00:00:00Z' },
    });

    if (p.startsWith('/auth/v1/token')) {
      const grant = url.searchParams.get('grant_type');
      const u = grant === 'refresh_token' ? Object.values(USERS).find((x) => body?.refresh_token === `refresh-${x.id}`) : Object.values(USERS).find((x) => x.email === body?.email && x.password === body?.password);
      if (!u) return json({ error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' }, 400);
      return json(sessionFor(u));
    }
    if (p === '/auth/v1/user') {
      const u = Object.values(USERS).find((x) => x.id === this.currentUser);
      if (!u) return json({ msg: 'invalid JWT' }, 401);
      return json(sessionFor(u).user);
    }
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (p === '/functions/v1/auth-login') {
      const u = Object.values(USERS).find((x) => x.username === body?.username && x.password === body?.password);
      if (!u) return json({ error: 'Incorrect username or password.' }, 400);
      const s = sessionFor(u);
      return json({ access_token: s.access_token, refresh_token: s.refresh_token });
    }
    if (p.startsWith('/rest/v1/rpc/')) {
      try {
        return json(this.rpc(p.split('/').pop()!, body ?? {}));
      } catch (e) {
        return json({ message: (e as Error).message, code: 'P0001' }, 400);
      }
    }
    if (p.startsWith('/rest/v1/')) {
      const table = p.replace('/rest/v1/', '');
      const rows = (this.db[table] ??= []);
      const params = url.searchParams;
      const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      const wantRep = (req.headers()['prefer'] ?? '').includes('return=representation');
      if (method === 'GET' || method === 'HEAD') {
        const out = this.embed(table, this.filter(rows, params), params.get('select') ?? '*');
        const headers = { 'content-range': `0-${Math.max(out.length - 1, 0)}/${out.length}` };
        if (single) return out.length === 1 ? json(out[0], 200, headers) : json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406);
        return json(out, 200, headers);
      }
      if (method === 'POST') {
        const items = (Array.isArray(body) ? body : [body]) as Row[];
        const upsert = (req.headers()['prefer'] ?? '').includes('resolution=merge-duplicates');
        const inserted = items.map((it) => {
          const keyCols = table === 'lesson_notes' ? ['user_id', 'lesson_id'] : table === 'course_reviews' ? ['user_id', 'course_id'] : ['id'];
          const existing = upsert ? rows.find((r) => keyCols.every((k) => r[k] === it[k])) : undefined;
          if (existing) return Object.assign(existing, it);
          const row: Row = { id: uuid(), created_at: now(), ...it };
          if (table === 'course_questions') Object.assign(row, { status: 'open', featured: false, vote_count: 0, answer_count: 0, answered_at: null });
          if (table === 'course_answers') {
            const q = this.db.course_questions.find((x) => x.id === row.question_id)!;
            row.from_staff = this.profile(this.currentUser!)?.role !== 'student';
            q.answer_count += 1;
            if (row.from_staff) {
              q.status = 'answered';
              q.answered_at ??= now();
              this.notify(q.asker_id, 'Your question was answered', `/app/questions/${q.id}`);
            } else if (q.status === 'answered') q.status = 'open';
          }
          rows.push(row);
          return row;
        });
        if (!wantRep) return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' } });
        return json(single ? inserted[0] : inserted, 201);
      }
      if (method === 'PATCH') {
        const matched = this.filter(rows, params);
        matched.forEach((r) => Object.assign(r, body));
        return wantRep ? json(single ? matched[0] : matched) : route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      }
      if (method === 'DELETE') {
        const matched = new Set(this.filter(rows, params));
        this.db[table] = rows.filter((r) => !matched.has(r));
        return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      }
    }
    if (p.startsWith('/storage/')) return route.fulfill({ status: 404, body: '' });
    return json({ message: `Unmocked ${method} ${p}` }, 404);
  }
}

export function questionAnswerTexts(promptText: string): { kind: string; texts: string[] } {
  const plain = (s: string) => s.replace(/[`*_>#]/g, '').replace(/\s+/g, ' ').trim();
  const target = plain(promptText);
  for (const c of fixtures.courses) {
    for (const q of c.questions) {
      const qp = plain(q.prompt.split('\n```')[0]!);
      if (qp && target.startsWith(qp.slice(0, Math.min(40, qp.length)))) {
        const key = c.keys.find((k: Row) => k.question_id === q.id);
        return { kind: q.kind as string, texts: q.kind === 'short' ? [key.answer[0]] : key.answer.map((id: string) => q.options.find((o: Row) => o.id === id)?.text ?? id) };
      }
    }
  }
  throw new Error(`No fixture question matches: ${target.slice(0, 60)}`);
}

export const COURSE = fixtures.courses.find((c: Row) => c.course.slug === 'digital-literacy-essentials');
