# DBI Learn

**The e-learning platform of Digital Bridge Initiative — Learn. Build. Grow.**

Built by **ProfJero Digital Studio** · Powered by **Digital Bridge Initiative**

DBI Learn delivers free, practical digital-skills courses that work online *and offline*, with instant-feedback quizzes, streaks and badges, discussions, and verifiable certificates.

## Highlights

- **9 production-ready courses** — Digital Literacy, Excel & Data Analysis, HTML & CSS, Python, Graphic Design with Canva, Cybersecurity, Digital Marketing, Networking & Cloud, and AI for Everyone — 105 lessons, 53 quizzes and 310 questions with explanations.
- **Installable PWA with offline learning** — learners download whole courses to the device; lesson completions, quiz submissions and notes queue locally and sync automatically when the connection returns. Practice quizzes are graded on the device; graded quizzes are marked by the server on sync.
- **Verifiable certificates** — issued automatically on completion (distinction at ≥85%), with a guilloché security border, foil seal, real signatures, QR code and a public verification page. Download as PDF or PNG, add to LinkedIn. Admins can also issue certificates manually or in bulk from CSV, and revoke them.
- **Engagement** — XP, levels, daily goals, streaks, 10 badges, weekly leaderboard, course reviews, discussions with accepted answers, announcements, notifications.
- **Studio for staff** — course, lesson and quiz authoring (Markdown with live preview, code highlighting and callouts), a review-and-publish workflow, learner progress, reports (lesson funnel, quiz pass rates, most-missed questions, CSV exports), support inbox, contact messages, platform settings and an audit log.
- **Roles** — `super_admin` (adds admins and instructors), `admin`, `instructor`, `student`. Every rule is enforced in Postgres with row-level security, column grants and `SECURITY DEFINER` functions — never only in the browser. Quiz answer keys are never readable by students.

## Tech stack

| Layer | Choice |
|---|---|
| Front end | React 19, TypeScript, Vite 7, Tailwind CSS 3, React Router 7, TanStack Query |
| Offline | `vite-plugin-pwa` (Workbox), IndexedDB (`idb-keyval`), persisted query cache, durable sync queue |
| Back end | Supabase: Postgres + RLS, Auth, Storage, Edge Functions (`staff-admin`, `auth-login`) |
| Hosting | Any static host with SPA fallback — configured for Cloudflare Pages (`public/_redirects`, `public/_headers`) |

## Project layout

```
content/                 Course content in Markdown + categories and resources (YAML)
scripts/build-seed.mjs   Converts content/ into supabase/seed/content.sql
src/
  auth/                  Session/profile provider and route guards
  components/            UI kit, layouts, certificate, lesson & quiz player
  hooks/                 Data hooks (queries, learning progress, offline state)
  lib/offline/           IndexedDB store, course downloads, sync queue, local grading
  pages/public|app|studio
supabase/
  migrations/            Schema, functions, RLS, fixes — apply in order
  functions/             Edge Functions
  seed/content.sql       Generated course content (do not edit by hand)
tests/e2e/               Playwright UI suite with an in-memory API seeded from content/
```

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm test             # unit tests (grading, markdown)
npm run build        # production build in dist/
npx playwright test  # UI suite (builds are served with `vite preview`)
```

Configuration lives in `src/lib/config.ts`. The Supabase URL and **publishable** key are public by design (data is protected by RLS) and can be overridden with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SITE_URL` (see `.env.example`).

## Deploying

### Front end (Cloudflare Pages)

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variable:** `VITE_SITE_URL=https://dbi-learn.pages.dev` (or your custom domain) so certificate QR codes point to the right site.

### Supabase

1. Apply `supabase/migrations/*.sql` in order (SQL editor or `supabase db push`).
2. Deploy the functions: `supabase functions deploy staff-admin --no-verify-jwt` and `supabase functions deploy auth-login --no-verify-jwt` (both verify callers themselves).
3. In **Authentication → URL Configuration**, set the **Site URL** to your live domain and add `https://<domain>/reset-password` and `https://<domain>/app` to **Redirect URLs**.
4. For reliable sign-up and password-reset emails, configure a custom SMTP provider in **Authentication → Emails** (the built-in sender is heavily rate-limited).

## Editing course content

Courses live in `content/courses/*.md`. Each file has YAML front matter followed by modules, lessons and quizzes:

```markdown
# Module: Getting started
## Lesson: What is a computer? (8 min)
Lesson body in Markdown. Use `> [!TIP]`, `> [!NOTE]`, `> [!WARNING]` or `> [!TRY]` for callouts.

## Quiz: Module 1 quiz {pass=70}
### Q: Which is an output device?
- [ ] Keyboard
- [x] Printer
> Explanation shown after answering.

### Q(tf): RAM keeps files after power-off.
= false

### Q(multiple): Select all input devices.
### Q(short): Name the brain of the computer.
= CPU | processor

# Final: Final exam {pass=70 attempts=3 time=25}
```

Then:

```bash
npm run seed:build   # validates content and regenerates supabase/seed/content.sql
git commit && git push
```

and load it into the database from the Supabase SQL editor:

```sql
select public.load_content_seed('<commit-sha or branch>');
```

IDs are derived from slugs and titles, so re-seeding updates content in place and keeps learner progress. Courses can also be authored entirely in the Studio.

## Security model (summary)

- `profiles` holds public profile fields; sensitive data lives in `profiles_private` (owner and staff only).
- Users can update only safe columns of their own rows (column-level grants). Roles, XP, progress and certificates change only through server functions.
- `question_keys` is readable only by course managers. `submit_quiz` grades on the server; offline submissions are idempotent by client-generated IDs.
- Instructors manage only their own courses and cannot publish — admins review and publish.
- Super admins create staff accounts through the `staff-admin` Edge Function, which re-checks the caller's role with the service key. Sensitive actions are written to `audit_logs`.

---

© Digital Bridge Initiative · Built by ProfJero Digital Studio
