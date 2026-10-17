import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/config';
import { cn } from '@/lib/utils';

export function Logo({ to = '/', className, compact }: { to?: string; className?: string; compact?: boolean }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)} aria-label="DBI Learn home">
      <img src="/brand/emblem.png" alt="" className="h-9 w-9" width={36} height={36} />
      {!compact && (
        <span className="leading-none">
          <span className="block text-lg font-extrabold tracking-tight">
            <span className="text-brand-500">DBI</span> <span className="text-sky-600 dark:text-sky-400">Learn</span>
          </span>
          <span className="block text-[10px] font-medium tracking-wide text-brand-600 dark:text-brand-400">{BRAND.tagline}</span>
        </span>
      )}
    </Link>
  );
}

/** The platform signature — shown in every layout's footer. */
export function Signature({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs text-ink-500', className)}>
      Built by <span className="font-semibold text-ink-700 dark:text-ink-200">{BRAND.builtBy}</span>
      <span className="mx-1.5 text-ink-300">·</span>
      Powered by <span className="font-semibold text-brand-600 dark:text-brand-400">{BRAND.org}</span>
    </p>
  );
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('dbi-theme', dark ? 'dark' : 'light');
    } catch {
      /* private mode */
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12151b' : '#03c14b');
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className={cn('grid h-9 w-9 place-items-center rounded-xl text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800', className)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
