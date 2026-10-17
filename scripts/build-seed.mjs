#!/usr/bin/env node
// Builds supabase/seed/content.sql from the Markdown courses in content/.
//
// Course file format (content/courses/<slug>.md):
//
//   ---                         YAML front matter: slug, title, subtitle, category, level, hours,
//   ...                         featured, tags, outcomes, requirements, description, pass_mark
//   ---
//   # Module: <title>           starts a module; text until the first "##" is its summary
//   ## Lesson: <title> (8 min) [preview]
//   video: https://...          optional first line
//   ...markdown...
//   ## Quiz: <title> {pass=70 attempts=3 time=15 kind=practice}
//   ### Q: prompt               single choice  (also Q(multiple), Q(tf), Q(short), Q(single,2) for points)
//   - [x] correct option
//   - [ ] other option
//   = true | answer one | answer two     (tf / short answers)
//   > explanation
//   # Final: <title> {pass=70 attempts=3 time=30}   course-level final exam (questions follow)
//
// IDs are derived from slugs/titles so re-running the seed updates content in place.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TAG = '$dbi$';

const uid = (...parts) => {
  const h = createHash('sha1').update(`dbi-learn:${parts.join(':')}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (s.includes(TAG)) throw new Error(`Content contains reserved token ${TAG}`);
  return `${TAG}${s}${TAG}`;
};
const arr = (a) => (a?.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;

function parseAttrs(s = '') {
  return Object.fromEntries([...s.matchAll(/(\w+)=([\w.-]+)/g)].map((m) => [m[1], m[2]]));
}

function parseQuestions(lines, file, quizTitle) {
  const out = [];
  let cur = null;
  let inFence = false;
  const push = () => {
    if (!cur) return;
    cur.prompt = cur.prompt.join('\n').trim();
    cur.explanation = cur.explanation.join(' ').trim() || null;
    if (!cur.prompt) throw new Error(`${file}: empty question in "${quizTitle}"`);
    if (cur.kind === 'single' || cur.kind === 'multiple') {
      if (cur.options.length < 2) throw new Error(`${file}: question "${cur.prompt.slice(0, 40)}" needs options`);
      if (!cur.answer.length) throw new Error(`${file}: question "${cur.prompt.slice(0, 40)}" has no correct option`);
      if (cur.kind === 'single' && cur.answer.length !== 1) throw new Error(`${file}: single-choice "${cur.prompt.slice(0, 40)}" must have exactly one answer`);
    }
    if ((cur.kind === 'true_false' || cur.kind === 'short') && !cur.answer.length) throw new Error(`${file}: "${cur.prompt.slice(0, 40)}" missing "= answer"`);
    out.push(cur);
    cur = null;
  };
  for (const line of lines) {
    const m = !inFence && line.match(/^### Q(?:\(([\w,]+)\))?:\s*(.*)$/);
    if (m) {
      push();
      const [kindRaw = 'single', pts = '1'] = (m[1] ?? 'single').split(',');
      const kind = { tf: 'true_false', multiple: 'multiple', short: 'short', single: 'single' }[kindRaw];
      if (!kind) throw new Error(`${file}: unknown question type ${kindRaw}`);
      cur = { kind, points: Number(pts), prompt: [m[2]], options: [], answer: [], explanation: [] };
      if (kind === 'true_false') cur.options = [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }];
      continue;
    }
    if (!cur) continue;
    if (/^```/.test(line)) inFence = !inFence;
    const opt = !inFence && line.match(/^- \[( |x)\] (.+)$/);
    if (opt) {
      const id = String.fromCharCode(97 + cur.options.length);
      cur.options.push({ id, text: opt[2].trim() });
      if (opt[1] === 'x') cur.answer.push(id);
      continue;
    }
    const ans = !inFence && line.match(/^= (.+)$/);
    if (ans) {
      cur.answer = ans[1].split('|').map((s) => s.trim()).filter(Boolean);
      if (cur.kind === 'true_false') cur.answer = [cur.answer[0].toLowerCase()];
      continue;
    }
    const ex = !inFence && line.match(/^> ?(.*)$/);
    if (ex) {
      cur.explanation.push(ex[1]);
      continue;
    }
    if (!cur.options.length && !cur.explanation.length) cur.prompt.push(line);
  }
  push();
  return out;
}

function parseCourse(file) {
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`${file}: missing front matter`);
  const meta = YAML.parse(fm[1]);
  const body = raw.slice(fm[0].length).split('\n');
  const modules = [];
  const finals = [];
  let mod = null;
  let item = null; // current lesson or quiz
  let inFence = false;
  const close = () => {
    if (!item) return;
    if (item.type === 'lesson') {
      let lines = item.lines;
      const v = lines.find((l) => l.trim())?.match(/^video:\s*(\S+)/);
      if (v) {
        item.video = v[1];
        lines = lines.slice(lines.findIndex((l) => l.trim()) + 1);
      }
      item.content = lines.join('\n').trim();
      if (item.content.split(/\s+/).length < 80) console.warn(`  ! short lesson: ${item.title}`);
    } else {
      item.questions = parseQuestions(item.lines, file, item.title);
      if (!item.questions.length) throw new Error(`${file}: quiz "${item.title}" has no questions`);
    }
    item = null;
  };
  for (const line of body) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence) {
      let m;
      if ((m = line.match(/^# Module:\s*(.+)$/))) {
        close();
        mod = { title: m[1].trim(), summary: [], lessons: [], quizzes: [] };
        modules.push(mod);
        continue;
      }
      if ((m = line.match(/^# Final:\s*([^{]+?)\s*(?:\{(.*)\})?$/))) {
        close();
        mod = null;
        item = { type: 'quiz', kind: 'final', title: m[1].trim(), attrs: parseAttrs(m[2]), lines: [] };
        finals.push(item);
        continue;
      }
      if ((m = line.match(/^## Lesson:\s*(.+?)\s*\((\d+)\s*min\)\s*(\[preview\])?\s*$/))) {
        close();
        if (!mod) throw new Error(`${file}: lesson outside module`);
        item = { type: 'lesson', title: m[1].trim(), minutes: Number(m[2]), preview: !!m[3], lines: [] };
        mod.lessons.push(item);
        continue;
      }
      if ((m = line.match(/^## Quiz:\s*([^{]+?)\s*(?:\{(.*)\})?$/))) {
        close();
        if (!mod) throw new Error(`${file}: quiz outside module`);
        const attrs = parseAttrs(m[2]);
        item = { type: 'quiz', kind: attrs.kind ?? 'module', title: m[1].trim(), attrs, lines: [] };
        mod.quizzes.push(item);
        continue;
      }
    }
    if (item) item.lines.push(line);
    else if (mod) mod.summary.push(line);
  }
  close();
  return { meta, modules, finals };
}

function courseSql({ meta, modules, finals }, categories) {
  const cid = uid('course', meta.slug);
  const cat = categories.find((c) => c.slug === meta.category);
  if (!cat) throw new Error(`${meta.slug}: unknown category ${meta.category}`);
  const pass = meta.pass_mark ?? 70;
  const sql = [];
  const keep = { modules: [], lessons: [], quizzes: [], questions: [] };
  sql.push(`-- ${meta.title}`);
  sql.push(
    `insert into public.courses (id, slug, title, subtitle, description, category_id, level, language, accent, status, outcomes, requirements, tags, pass_mark, estimated_hours, featured, certificate_enabled, sequential, published_at)
values (${q(cid)}, ${q(meta.slug)}, ${q(meta.title)}, ${q(meta.subtitle)}, ${q(meta.description?.trim())}, (select id from public.categories where slug = ${q(meta.category)}), ${q(meta.level ?? 'beginner')}, 'English', ${q(meta.accent ?? null)}, 'published', ${arr(meta.outcomes)}, ${arr(meta.requirements)}, ${arr(meta.tags)}, ${pass}, ${meta.hours ?? 'null'}, ${!!meta.featured}, true, ${!!meta.sequential}, now())
on conflict (id) do update set slug = excluded.slug, title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, level = excluded.level, accent = excluded.accent, outcomes = excluded.outcomes, requirements = excluded.requirements, tags = excluded.tags, pass_mark = excluded.pass_mark, estimated_hours = excluded.estimated_hours, featured = excluded.featured, sequential = excluded.sequential;`,
  );
  const quizSql = (quiz, moduleId, position) => {
    const qid = uid('quiz', meta.slug, quiz.kind, quiz.title);
    keep.quizzes.push(qid);
    const a = quiz.attrs;
    sql.push(
      `insert into public.quizzes (id, course_id, module_id, title, description, kind, time_limit_minutes, pass_mark, max_attempts, shuffle_questions, show_answers, position, status)
values (${q(qid)}, ${q(cid)}, ${moduleId ? q(moduleId) : 'null'}, ${q(quiz.title)}, ${q(a.description ?? null)}, ${q(quiz.kind)}, ${a.time ?? 'null'}, ${a.pass ?? pass}, ${a.attempts ?? 'null'}, true, true, ${position}, 'published')
on conflict (id) do update set module_id = excluded.module_id, title = excluded.title, kind = excluded.kind, time_limit_minutes = excluded.time_limit_minutes, pass_mark = excluded.pass_mark, max_attempts = excluded.max_attempts, position = excluded.position, status = excluded.status;`,
    );
    quiz.questions.forEach((qq, i) => {
      const id = uid('question', qid, qq.prompt);
      keep.questions.push(id);
      sql.push(
        `insert into public.questions (id, quiz_id, kind, prompt, options, points, position) values (${q(id)}, ${q(qid)}, ${q(qq.kind)}, ${q(qq.prompt)}, ${json(qq.kind === 'short' ? [] : qq.options)}, ${qq.points}, ${i + 1})
on conflict (id) do update set kind = excluded.kind, prompt = excluded.prompt, options = excluded.options, points = excluded.points, position = excluded.position;
insert into public.question_keys (question_id, answer, explanation) values (${q(id)}, ${json(qq.answer)}, ${q(qq.explanation)})
on conflict (question_id) do update set answer = excluded.answer, explanation = excluded.explanation;`,
      );
    });
  };
  modules.forEach((m, mi) => {
    const mid = uid('module', meta.slug, mi, m.title);
    keep.modules.push(mid);
    sql.push(
      `insert into public.modules (id, course_id, title, summary, position) values (${q(mid)}, ${q(cid)}, ${q(m.title)}, ${q(m.summary.join('\n').trim() || null)}, ${mi + 1})
on conflict (id) do update set title = excluded.title, summary = excluded.summary, position = excluded.position;`,
    );
    m.lessons.forEach((l, li) => {
      const lid = uid('lesson', meta.slug, mi, l.title);
      keep.lessons.push(lid);
      sql.push(
        `insert into public.lessons (id, course_id, module_id, title, kind, content, video_url, duration_minutes, position, is_preview)
values (${q(lid)}, ${q(cid)}, ${q(mid)}, ${q(l.title)}, ${q(l.video ? 'video' : 'article')}, ${q(l.content)}, ${q(l.video ?? null)}, ${l.minutes}, ${li + 1}, ${l.preview || (mi === 0 && li === 0)})
on conflict (id) do update set module_id = excluded.module_id, title = excluded.title, kind = excluded.kind, content = excluded.content, video_url = excluded.video_url, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;`,
      );
    });
    m.quizzes.forEach((qz, qi) => quizSql(qz, mid, (mi + 1) * 10 + qi));
  });
  finals.forEach((f, i) => quizSql(f, null, 1000 + i));
  // Remove anything that was deleted from the Markdown since the last seed.
  sql.push(`delete from public.questions where quiz_id in (select id from public.quizzes where course_id = ${q(cid)}) and id <> all(${arr(keep.questions)}::uuid[]);`);
  sql.push(`delete from public.quizzes where course_id = ${q(cid)} and id <> all(${arr(keep.quizzes)}::uuid[]);`);
  sql.push(`delete from public.lessons where course_id = ${q(cid)} and id <> all(${arr(keep.lessons)}::uuid[]);`);
  sql.push(`delete from public.modules where course_id = ${q(cid)} and id <> all(${arr(keep.modules)}::uuid[]);`);
  const stats = {
    lessons: keep.lessons.length,
    quizzes: keep.quizzes.length,
    questions: keep.questions.length,
    words: modules.flatMap((m) => m.lessons).reduce((s, l) => s + l.content.split(/\s+/).length, 0),
  };
  return { sql: sql.join('\n'), stats };
}

const categories = YAML.parse(readFileSync(join(root, 'content/categories.yml'), 'utf8'));
const resources = YAML.parse(readFileSync(join(root, 'content/resources.yml'), 'utf8'));
const out = ['-- Generated by scripts/build-seed.mjs — edit content/ and re-run `npm run seed:build`.'];

categories.forEach((c, i) => {
  out.push(
    `insert into public.categories (id, slug, name, description, color, icon, signatory, position) values (${q(uid('category', c.slug))}, ${q(c.slug)}, ${q(c.name)}, ${q(c.description)}, ${q(c.color)}, ${q(c.icon ?? null)}, ${c.signatory ? json(c.signatory) : 'null'}, ${i + 1})
on conflict (slug) do update set name = excluded.name, description = excluded.description, color = excluded.color, signatory = excluded.signatory, position = excluded.position;`,
  );
});

const files = readdirSync(join(root, 'content/courses')).filter((f) => f.endsWith('.md')).sort();
let totals = { lessons: 0, quizzes: 0, questions: 0, words: 0 };
for (const f of files) {
  const parsed = parseCourse(join(root, 'content/courses', f));
  const { sql, stats } = courseSql(parsed, categories);
  out.push(sql);
  totals = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v + stats[k]]));
  console.log(`✓ ${parsed.meta.title}: ${stats.lessons} lessons, ${stats.quizzes} quizzes, ${stats.questions} questions, ${stats.words} words`);
}

resources.forEach((r) => {
  out.push(
    `insert into public.resources (id, title, description, url, kind, category, is_public) values (${q(uid('resource', r.url))}, ${q(r.title)}, ${q(r.description)}, ${q(r.url)}, ${q(r.kind ?? 'link')}, ${q(r.category)}, true)
on conflict (id) do update set title = excluded.title, description = excluded.description, kind = excluded.kind, category = excluded.category;`,
  );
});

writeFileSync(join(root, 'supabase/seed/content.sql'), out.join('\n\n') + '\n');
console.log(`\nTotal: ${files.length} courses, ${totals.lessons} lessons, ${totals.quizzes} quizzes, ${totals.questions} questions, ${totals.words.toLocaleString()} words`);
