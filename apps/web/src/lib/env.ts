/** Variables obligatoires au build (vite.config.ts) : aucune valeur par défaut dans le code. */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const PLAYER_URL: string = (import.meta.env.VITE_PLAYER_URL || 'http://localhost:5174').replace(
  /\/$/,
  '',
);
/** URL absolue de l'app (pour les redirections d'auth). */
export const APP_URL = `${window.location.origin}${import.meta.env.BASE_URL}`;
/**
 * L26-10 : adresse publique de l'app pour la télécommande (QR code et adresse courte affichée). Par
 * défaut, l'adresse courante ; à fixer au build quand l'app est servie derrière une autre adresse.
 */
export const REMOTE_ORIGIN: string = (
  import.meta.env.VITE_REMOTE_ORIGIN || `${window.location.origin}${window.location.pathname}`
).replace(/\/$/, '');
/** L48-A §1 : page de l'extension dans la boutique du navigateur (variable de build ; vide : pas de lien). */
export const EXTENSION_URL: string = (import.meta.env.VITE_EXTENSION_URL || '').trim();
