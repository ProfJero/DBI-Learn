import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CloudOff, LogOut, Menu, RefreshCw, Settings, User, X, ArrowLeftRight, CheckCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { Avatar, Badge } from '@/components/ui';
import { useNotifications, qk } from '@/hooks/queries';
import { useOnline, useSyncState } from '@/hooks/useOffline';
import { supabase } from '@/lib/supabase';
import { cn, isStaffRole, ROLE_LABEL, timeAgo } from '@/lib/utils';
import { Logo, Signature, ThemeToggle } from './Brand';
import { InstallButton, OfflineBanner, UpdatePrompt } from './Pwa';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number;
  mobile?: boolean;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export function Shell({ groups, mode }: { groups: NavGroup[]; mode: 'student' | 'studio' }) {
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);
  const mobileTabs = groups.flatMap((g) => g.items).filter((i) => i.mobile);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo to={mode === 'studio' ? '/admin' : '/app'} />
        {mode === 'studio' && <Badge tone="blue">Studio</Badge>}
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((g, i) => (
          <div key={i}>
            {g.title && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{g.title}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                          : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800/60 dark:hover:text-white',
                      )
                    }
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {!!item.badge && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{item.badge}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-ink-100 p-4 dark:border-ink-800">
        <InstallButton className="mb-3 w-full" />
        <Signature className="text-[11px] leading-relaxed" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50/60 dark:bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900 lg:block">
        {sidebar}
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-up bg-white shadow-2xl dark:bg-ink-900">
            <button className="absolute right-3 top-4 p-1" onClick={() => setDrawer(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <OfflineBanner />
        <TopBar onMenu={() => setDrawer(true)} mode={mode} />
        <main className={cn('mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8', mode === 'student' && 'pb-28 lg:pb-8')}>
          <Outlet />
        </main>
      </div>
      {mode === 'student' && mobileTabs.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-ink-800 dark:bg-ink-900/95 lg:hidden">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, 1fr)` }}>
            {mobileTabs.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-600' : 'text-ink-500')
                  }
                >
                  <t.icon className="h-5 w-5" />
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <UpdatePrompt />
    </div>
  );
}

function TopBar({ onMenu, mode }: { onMenu: () => void; mode: 'student' | 'studio' }) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/85 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button className="rounded-lg p-2 lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="lg:hidden">
          <Logo compact to={mode === 'studio' ? '/admin' : '/app'} />
        </div>
        <div className="flex-1" />
        <SyncIndicator />
        <ThemeToggle />
        <NotificationBell />
        <UserMenu mode={mode} />
      </div>
    </header>
  );
}

function SyncIndicator() {
  const online = useOnline();
  const { pending, syncing } = useSyncState();
  if (online && !pending) return null;
  return (
    <span
      className={cn('hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex', online ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700')}
      title={online ? 'Syncing offline activity' : 'Offline'}
    >
      {online ? <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} /> : <CloudOff className="h-3.5 w-3.5" />}
      {online ? `${pending} to sync` : 'Offline'}
    </span>
  );
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOutside();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onOutside]);
  return ref;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const { data } = useNotifications();
  const { session } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const unread = data?.filter((n) => !n.read_at).length ?? 0;

  async function markAll() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).eq('user_id', session!.user.id);
    void qc.invalidateQueries({ queryKey: qk.notifications(session?.user.id) });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-xl text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-up overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-lift dark:border-ink-700 dark:bg-ink-900">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-brand-600">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {!data?.length && <li className="px-4 py-8 text-center text-sm text-ink-500">You're all caught up ✨</li>}
            {data?.slice(0, 20).map((n) => (
              <li key={n.id}>
                <button
                  className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800', !n.read_at && 'bg-brand-50/50 dark:bg-brand-950/30')}
                  onClick={async () => {
                    setOpen(false);
                    if (!n.read_at) {
                      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
                      void qc.invalidateQueries({ queryKey: qk.notifications(session?.user.id) });
                    }
                    if (n.link) navigate(n.link);
                  }}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand-500')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body && <span className="line-clamp-2 block text-xs text-ink-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-ink-400">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu({ mode }: { mode: 'student' | 'studio' }) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const navigate = useNavigate();
  if (!profile) return null;
  const staff = isStaffRole(profile.role);
  const item = (to: string, label: string, icon: ReactNode) => (
    <Link to={to} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">
      {icon}
      {label}
    </Link>
  );
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Account menu">
        <Avatar name={profile.full_name} url={profile.avatar_url} size={34} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 animate-fade-up rounded-2xl border border-ink-100 bg-white p-2 shadow-lift dark:border-ink-700 dark:bg-ink-900">
          <div className="px-3 py-2">
            <p className="truncate font-semibold">{profile.full_name}</p>
            <p className="text-xs text-ink-500">{ROLE_LABEL[profile.role]}</p>
          </div>
          <div className="my-1 border-t border-ink-100 dark:border-ink-800" />
          {item('/app/profile', 'Profile', <User className="h-4 w-4" />)}
          {item('/app/settings', 'Settings', <Settings className="h-4 w-4" />)}
          {staff && mode === 'student' && item('/admin', 'Switch to Studio', <ArrowLeftRight className="h-4 w-4" />)}
          {staff && mode === 'studio' && item('/app', 'Switch to learner view', <ArrowLeftRight className="h-4 w-4" />)}
          <div className="my-1 border-t border-ink-100 dark:border-ink-800" />
          <button
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
