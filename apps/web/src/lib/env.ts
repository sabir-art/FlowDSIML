export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://ffzlhlxfratcbitkuvli.supabase.co';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const PLAYER_URL: string = (import.meta.env.VITE_PLAYER_URL ?? 'http://localhost:5174').replace(
  /\/$/,
  '',
);
/** URL absolue de l'app (pour les redirections d'auth). */
export const APP_URL = `${window.location.origin}${import.meta.env.BASE_URL}`;
