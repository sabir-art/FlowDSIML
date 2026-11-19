export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL || 'https://ffzlhlxfratcbitkuvli.supabase.co';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const PLAYER_URL: string = (import.meta.env.VITE_PLAYER_URL || 'http://localhost:5174').replace(
  /\/$/,
  '',
);
/** URL absolue de l'app (pour les redirections d'auth). */
export const APP_URL = `${window.location.origin}${import.meta.env.BASE_URL}`;
/** Adresse de support pour les demandes de changement de plan (variable de build, jamais en dur : dépôt public). */
export const SUPPORT_EMAIL: string = (import.meta.env.VITE_SUPPORT_EMAIL || '').trim();
/**
 * L26-10 : adresse publique de l'app pour la télécommande (QR code et adresse courte affichée). Par
 * défaut, l'adresse courante ; à fixer au build quand l'app est servie derrière une autre adresse.
 */
export const REMOTE_ORIGIN: string = (
  import.meta.env.VITE_REMOTE_ORIGIN || `${window.location.origin}${window.location.pathname}`
).replace(/\/$/, '');
