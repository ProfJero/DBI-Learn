import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { LinkButton } from '@/components/ui';
import { cn, isStaffRole } from '@/lib/utils';
import { BRAND } from '@/lib/config';
import { Logo, Signature, ThemeToggle } from './Brand';
import { InstallButton, OfflineBanner, UpdatePrompt } from './Pwa';

const NAV = [
  { to: '/courses', label: 'Courses' },
  { to: '/verify', label: 'Verify certificate' },
  { to: '/about', label: 'About' },
];

export function PublicLayout() {
  const { session, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const home = profile && isStaffRole(profile.role) ? '/admin' : '/app';
  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />
      <header className="sticky top-0 z-40 border-b border-ink-100/80 bg-white/85 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn('rounded-lg px-3 py-2 text-sm font-medium transition hover:text-brand-600', isActive ? 'text-brand-600' : 'text-ink-600 dark:text-ink-300')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <InstallButton />
            <ThemeToggle />
            {session ? (
              <LinkButton to={home}>Go to dashboard</LinkButton>
            ) : (
              <>
                <LinkButton to="/login" variant="ghost">
                  Log in
                </LinkButton>
                <LinkButton to="/signup">Start learning free</LinkButton>
              </>
            )}
          </div>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="border-t border-ink-100 px-4 pb-4 pt-2 dark:border-ink-800 md:hidden">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-medium">
                {n.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-wrap gap-2">
              {session ? (
                <LinkButton to={home} className="flex-1" onClick={() => setOpen(false)}>
                  Go to dashboard
                </LinkButton>
              ) : (
                <>
                  <LinkButton to="/login" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                    Log in
                  </LinkButton>
                  <LinkButton to="/signup" className="flex-1" onClick={() => setOpen(false)}>
                    Sign up free
                  </LinkButton>
                </>
              )}
              <ThemeToggle />
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
      <UpdatePrompt />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-100 bg-ink-50/60 dark:border-ink-800 dark:bg-ink-900/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-md text-sm text-ink-600 dark:text-ink-400">
            {BRAND.name} is the learning platform of {BRAND.org} — bridging the digital divide with free, practical tech education that works
            online and offline.
          </p>
          <img src="/brand/digital-bridge-initiative-logo.png" alt="Digital Bridge Initiative" className="mt-5 h-9 w-auto" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Learn</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-600 dark:text-ink-400">
            <li><Link to="/courses" className="hover:text-brand-600">All courses</Link></li>
            <li><Link to="/signup" className="hover:text-brand-600">Create free account</Link></li>
            <li><Link to="/app/downloads" className="hover:text-brand-600">Learn offline</Link></li>
            <li><Link to="/teach" className="hover:text-brand-600">Teach on DBI Learn</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Trust</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-600 dark:text-ink-400">
            <li><Link to="/verify" className="hover:text-brand-600">Verify a certificate</Link></li>
            <li><Link to="/about" className="hover:text-brand-600">About {BRAND.org}</Link></li>
            <li><Link to="/about#contact" className="hover:text-brand-600">Contact us</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100 dark:border-ink-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:flex-row sm:px-6 sm:text-left">
          <p className="text-xs text-ink-500">
            © {new Date().getFullYear()} {BRAND.org}. {BRAND.tagline}
          </p>
          <Signature />
        </div>
      </div>
    </footer>
  );
}
