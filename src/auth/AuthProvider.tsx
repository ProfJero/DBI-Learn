import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, friendlyError } from '@/lib/supabase';
import type { Profile, ProfilePrivate } from '@/lib/types';
import { flush } from '@/lib/offline/sync';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  privateProfile: ProfilePrivate | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const CACHE_KEY = 'dbi-profile-cache';

type Cached = { profile: Profile; privateProfile: ProfilePrivate | null };

function readCache(userId: string): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null;
    return c?.profile.id === userId ? c : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [privateProfile, setPrivate] = useState<ProfilePrivate | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const cached = readCache(userId);
    if (cached) {
      setProfile(cached.profile);
      setPrivate(cached.privateProfile);
    }
    const [p, pp] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('profiles_private').select('*').eq('id', userId).maybeSingle(),
    ]);
    if (p.data) {
      setProfile(p.data as Profile);
      setPrivate((pp.data as ProfilePrivate) ?? null);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ profile: p.data, privateProfile: pp.data ?? null }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id).catch(() => undefined);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setPrivate(null);
        localStorage.removeItem(CACHE_KEY);
      }
      if (event === 'SIGNED_IN' && s) {
        // Defer: never await Supabase calls inside this callback.
        setTimeout(() => {
          void loadProfile(s.user.id).catch(() => undefined);
          void flush();
        }, 0);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      privateProfile,
      loading,
      refreshProfile: async () => {
        if (session) await loadProfile(session.user.id);
      },
      signInWithEmail: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(/invalid/i.test(error.message) ? 'Incorrect email or password.' : friendlyError(error.message));
        await loadProfile(data.user.id);
      },
      signInWithUsername: async (username, password) => {
        const { data, error } = await supabase.functions.invoke('auth-login', { body: { username, password } });
        if (error) {
          let msg = 'Incorrect username or password.';
          try {
            msg = (await (error as { context?: Response }).context?.json())?.error ?? msg;
          } catch {
            msg = friendlyError(error.message);
          }
          throw new Error(msg);
        }
        const { error: e2, data: d2 } = await supabase.auth.setSession(data);
        if (e2 || !d2.user) throw new Error(friendlyError(e2?.message ?? 'Sign in failed'));
        await loadProfile(d2.user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, privateProfile, loading, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
