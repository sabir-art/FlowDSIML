import { createClient } from '@supabase/supabase-js';
import type { Database } from '@flowdsiml/supabase-types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY || 'missing-anon-key', {
  auth: {
    // PKCE : le code arrive en query string (?code=…), compatible avec le HashRouter.
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const isConfigured = Boolean(SUPABASE_ANON_KEY);

/** URL de redirection après un lien email : l'app lit `next` et navigue vers la route. */
export function authRedirect(next: string): string {
  const url = new URL(window.location.origin + import.meta.env.BASE_URL);
  url.searchParams.set('next', next);
  return url.toString();
}
