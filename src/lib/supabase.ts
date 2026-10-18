import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'dbi-learn-auth' },
});

/** Unwraps a Supabase response, throwing a readable Error on failure. */
export function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(friendlyError(res.error.message));
  return res.data;
}

export function friendlyError(message: string): string {
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'You appear to be offline. Please check your connection.';
  if (/JWT expired/i.test(message)) return 'Your session expired. Please sign in again.';
  if (/duplicate key.*username/i.test(message)) return 'That username is already taken.';
  if (/violates row-level security|permission denied/i.test(message)) return 'You do not have permission to do that.';
  return message;
}

/** Calls an Edge Function with the signed-in user's token. */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) msg = (await ctx.json()).error ?? msg;
    } catch {
      /* keep generic message */
    }
    throw new Error(friendlyError(msg));
  }
  return data as T;
}
