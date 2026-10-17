import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@/lib/types';
import { useAuth } from './AuthProvider';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { isStaffRole } from '@/lib/utils';

export function RequireAuth() {
  const { session, profile, loading } = useAuth();
  const location = useLocation();
  if (loading || (session && !profile)) return <FullPageSpinner />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (profile?.status === 'suspended') return <Navigate to="/suspended" replace />;
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { profile } = useAuth();
  if (!profile) return <FullPageSpinner />;
  if (!roles.includes(profile.role)) return <Navigate to={isStaffRole(profile.role) ? '/admin' : '/app'} replace />;
  return <Outlet />;
}

/** Sends signed-in visitors of /login or /signup to their home. */
export function RedirectIfSignedIn({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const params = new URLSearchParams(useLocation().search);
  if (loading) return <FullPageSpinner />;
  if (session && profile) {
    const next = params.get('next');
    return <Navigate to={next && next.startsWith('/') ? next : isStaffRole(profile.role) ? '/admin' : '/app'} replace />;
  }
  return <>{children}</>;
}
