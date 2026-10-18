import { Link } from 'react-router-dom';
import { BookOpen, Clock, Star, Users, Code2, BarChart3, Palette, ShieldCheck, Cloud, Megaphone, Laptop, Sparkles } from 'lucide-react';
import type { Course } from '@/lib/types';
import { Badge, Progress } from '@/components/ui';
import { cn } from '@/lib/utils';
import { img } from '@/lib/media';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'software-development': Code2,
  'data-analysis': BarChart3,
  'graphics-multimedia': Palette,
  cybersecurity: ShieldCheck,
  'network-cloud': Cloud,
  'digital-marketing': Megaphone,
  'digital-skills': Laptop,
  'artificial-intelligence': Sparkles,
};

export function categoryIcon(slug?: string | null) {
  return (slug && CATEGORY_ICONS[slug]) || BookOpen;
}

/** Generated cover art so every course looks great without uploading images. */
export function CourseCover({ course, className, size = 'md' }: { course: Pick<Course, 'title' | 'accent' | 'cover_url'> & { category?: Course['category'] }; className?: string; size?: 'md' | 'lg' }) {
  const color = course.accent || course.category?.color || '#03c14b';
  const Icon = categoryIcon(course.category?.slug);
  if (course.cover_url)
    return <img src={img(course.cover_url, 640)} alt="" loading="lazy" className={cn('aspect-[16/9] w-full object-cover', className)} />;
  return (
    <div
      className={cn('relative aspect-[16/9] w-full overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${shade(color, -35)} 100%)` }}
      aria-hidden
    >
      <svg className="absolute inset-0 h-full w-full opacity-25" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`g-${color.slice(1)}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="white" strokeWidth=".6" />
          </pattern>
        </defs>
        <rect width="400" height="225" fill={`url(#g-${color.slice(1)})`} />
        <circle cx="340" cy="40" r="90" fill="white" opacity=".18" />
        <circle cx="40" cy="220" r="70" fill="white" opacity=".12" />
      </svg>
      <Icon className={cn('absolute text-white/90 drop-shadow', size === 'lg' ? 'bottom-6 right-6 h-20 w-20' : 'bottom-4 right-4 h-12 w-12')} />
      <div className={cn('absolute left-4 top-4 max-w-[70%] font-extrabold leading-tight text-white drop-shadow-sm', size === 'lg' ? 'text-2xl' : 'text-base')}>
        {course.title}
      </div>
    </div>
  );
}

function shade(hex: string, pct: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (pct / 100) * 255)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
}

export const LEVEL_TONE = { beginner: 'green', intermediate: 'blue', advanced: 'purple' } as const;

export function CourseCard({
  course,
  to,
  progress,
  lessonCount,
}: {
  course: Course;
  to: string;
  progress?: number | null;
  lessonCount?: number;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift dark:border-ink-800 dark:bg-ink-900"
    >
      <CourseCover course={course} className="transition duration-500 group-hover:scale-[1.02]" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {course.category && <Badge tone="gray">{course.category.name}</Badge>}
          <Badge tone={LEVEL_TONE[course.level]} className="capitalize">
            {course.level}
          </Badge>
          {course.featured && <Badge tone="gold">★ Featured</Badge>}
        </div>
        <h3 className="mt-2.5 line-clamp-2 font-bold leading-snug group-hover:text-brand-600">{course.title}</h3>
        {course.subtitle && <p className="mt-1 line-clamp-2 text-sm text-ink-500">{course.subtitle}</p>}
        <div className="mt-auto pt-4">
          {progress != null ? (
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-medium text-ink-500">
                <span>{progress === 100 ? 'Completed 🎉' : 'Progress'}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
              {lessonCount != null && (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" /> {lessonCount} lessons
                </span>
              )}
              {course.estimated_hours != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {Number(course.estimated_hours)}h
                </span>
              )}
              {course.enrollment_count > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {course.enrollment_count.toLocaleString()}
                </span>
              )}
              {course.rating_count > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-current" /> {Number(course.rating_avg).toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
