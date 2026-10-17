// Public configuration. The publishable key is safe to ship to browsers; data is protected by Postgres RLS.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dbmaufhgooxmgkqjxrgx.supabase.co';
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_F8dsw1WJHQvUC-DpSe0Cdg_j5rPpLKf';
export const SITE_URL = (import.meta.env.VITE_SITE_URL || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/$/, '');

export const BRAND = {
  name: 'DBI Learn',
  org: 'Digital Bridge Initiative',
  tagline: 'Learn. Build. Grow.',
  builtBy: 'ProfJero Digital Studio',
  country: 'Ghana',
} as const;
