import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CloudOff,
  Flame,
  GraduationCap,
  MessagesSquare,
  QrCode,
  Smartphone,
  Sparkles,
  Trophy,
  WifiOff,
} from 'lucide-react';
import { useCatalog, useCategories } from '@/hooks/queries';
import { CourseCard, categoryIcon } from '@/components/CourseCard';
import { Button, Input, LinkButton, Skeleton } from '@/components/ui';
import { useInstall } from '@/components/layout/Pwa';
import { BRAND } from '@/lib/config';

export function Home() {
  const { data: courses, isLoading } = useCatalog();
  const { data: categories } = useCategories();
  const navigate = useNavigate();
  const [serial, setSerial] = useState('');
  const { canInstall, install } = useInstall();
  const totalLessons = courses?.reduce((s, c) => s + (c.lessons?.[0]?.count ?? 0), 0) ?? 0;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_80%_-10%,rgba(11,123,232,.12),transparent),radial-gradient(50rem_30rem_at_0%_10%,rgba(3,193,75,.14),transparent)]" />
        <div className="container-page grid items-center gap-12 py-14 md:py-20 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" /> Free courses · Works offline · Verifiable certificates
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Digital skills for <span className="gradient-text">every community</span>, online or off.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-600 dark:text-ink-300">
              {BRAND.name} by {BRAND.org} teaches practical tech skills — coding, data, design, cybersecurity and more — through bite-sized
              lessons, instant-feedback quizzes and certificates employers can verify in seconds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/signup" size="lg" icon={<GraduationCap className="h-5 w-5" />}>
                Start learning — it's free
              </LinkButton>
              <LinkButton to="/courses" size="lg" variant="outline">
                Browse courses <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[
                [courses?.length ?? '—', 'Courses'],
                [totalLessons || '—', 'Lessons'],
                ['100%', 'Free'],
              ].map(([v, l]) => (
                <div key={l as string}>
                  <dt className="text-xs text-ink-500">{l}</dt>
                  <dd className="text-2xl font-extrabold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-400/30 to-sky-500/30 blur-2xl" />
            <img
              src="/images/hero-learners.webp"
              alt="Young learners practising computer skills"
              className="aspect-square w-full rounded-[2rem] object-cover shadow-2xl"
              width={900}
              height={900}
              fetchPriority="high"
            />
            <div className="absolute -left-4 bottom-10 hidden animate-fade-up rounded-2xl bg-white p-3 shadow-lift dark:bg-ink-900 sm:flex sm:items-center sm:gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-600">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">7-day streak!</p>
                <p className="text-xs text-ink-500">Keep the momentum going</p>
              </div>
            </div>
            <div className="absolute -right-4 top-10 hidden animate-fade-up rounded-2xl bg-white p-3 shadow-lift dark:bg-ink-900 sm:flex sm:items-center sm:gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-600">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Certificate earned</p>
                <p className="text-xs text-ink-500">Verified by DBI</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      {!!categories?.length && (
        <section className="container-page py-10">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-ink-500">Learning tracks</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categories.map((c) => {
              const Icon = categoryIcon(c.slug);
              return (
                <Link
                  key={c.id}
                  to={`/courses?category=${c.slug}`}
                  className="group flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lift dark:border-ink-800 dark:bg-ink-900"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: c.color ?? '#03c14b' }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold leading-tight group-hover:text-brand-600">{c.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured courses */}
      <section className="container-page py-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Start with a popular course</h2>
            <p className="mt-2 text-ink-500">Hands-on lessons written for beginners, with real-world examples.</p>
          </div>
          <Link to="/courses" className="hidden shrink-0 text-sm font-semibold text-brand-600 hover:underline sm:block">
            View all courses →
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-72" />)}
          {courses?.slice(0, 8).map((c) => (
            <CourseCard key={c.id} course={c} to={`/courses/${c.slug}`} lessonCount={c.lessons?.[0]?.count} />
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="bg-ink-950 py-20 text-white">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Built for real learners, in real conditions.</h2>
            <p className="mt-3 text-ink-300">
              We combined the best ideas from the world's leading platforms — and designed them for places where data is expensive and
              connections drop.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [WifiOff, 'Learn offline', 'Download whole courses — lessons and quizzes — and study with zero data. Progress syncs automatically when you reconnect.'],
              [Smartphone, 'Install as an app', 'Add DBI Learn to your home screen on Android, iPhone or desktop. Fast, light and app-like.'],
              [Sparkles, 'Instant feedback', 'Every quiz explains why an answer is right, so mistakes become lessons — mastery, not memorisation.'],
              [Trophy, 'Streaks, XP & badges', 'Daily streaks, a weekly leaderboard and achievement badges keep you motivated.'],
              [BadgeCheck, 'Verifiable certificates', 'Every certificate has a unique ID and QR code that employers can check instantly.'],
              [MessagesSquare, 'Learn together', 'Ask questions in course discussions and get help from instructors and peers.'],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof WifiOff;
              return (
                <div key={title as string} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <I className="h-6 w-6 text-brand-400" />
                  <h3 className="mt-4 font-bold">{title as string}</h3>
                  <p className="mt-1.5 text-sm text-ink-300">{body as string}</p>
                </div>
              );
            })}
          </div>
          {canInstall && (
            <div className="mt-10">
              <Button size="lg" onClick={install} icon={<CloudOff className="h-5 w-5" />}>
                Install DBI Learn for offline learning
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section className="container-page py-20">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Learners are building their futures</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ['/images/testimonial-3.webp', 'Emelda Amoah', 'JHS Student', 'Before joining the Digital Bridge Initiative platform, I had little knowledge about computers. Now I can confidently use Microsoft Excel and understand basic data analysis. The lessons are simple, practical and very easy to follow. This platform has really helped me improve my digital skills.'],
            ['/images/testimonial-1.webp', 'Emmanuel Essel', 'JHS Student', 'The DBI eLearning platform has completely changed how I see technology. The training is very interactive, and I love how everything is explained step by step. I now feel more confident using digital tools and I am considering a career in technology.'],
            ['/images/testimonial-2.webp', 'Lovina Aduafo', 'JHS Student', 'Learning through Digital Bridge Initiative has been an amazing experience. The platform makes learning fun and practical. I especially enjoyed working on real-life examples, which helped me understand better. I feel inspired and ready to learn more.'],
          ].map(([img, who, role, quote], i) => (
            <figure key={i} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card dark:border-ink-800 dark:bg-ink-900">
              <blockquote className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">“{quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <img src={img} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" />
                <span>
                  <span className="block text-sm font-semibold">{who}</span>
                  <span className="block text-xs text-ink-500">{role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Verify */}
      <section className="container-page pb-20">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-sky-600 p-8 text-white md:grid-cols-2 md:p-12">
          <div>
            <QrCode className="h-10 w-10" />
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Verify a DBI certificate</h2>
            <p className="mt-2 text-white/85">Employers and schools can confirm any certificate in seconds — no account needed.</p>
          </div>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (serial.trim()) navigate(`/verify/${encodeURIComponent(serial.trim().toUpperCase())}`);
            }}
          >
            <Input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="e.g. DBI-2026-AB12-CD34"
              aria-label="Certificate ID"
              className="h-12 border-white/30 bg-white/15 text-white placeholder:text-white/60 focus:border-white"
            />
            <Button type="submit" size="lg" variant="secondary" className="shrink-0">
              Verify
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}
