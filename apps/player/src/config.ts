const env = import.meta.env;
/** Variables obligatoires au build (vite.config.ts) : aucune valeur par défaut dans le code. */
export const SUPABASE_URL: string = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
export const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY || '';
/** Edge Function d'ingestion (sinon repli sur la RPC track_events). */
export const TRACK_URL: string | null = env.VITE_TRACK_URL || `${SUPABASE_URL}/functions/v1/track`;
/** Origine de l'app (éditeur) autorisée à envoyer un manifeste d'aperçu. */
export const APP_ORIGIN: string = env.VITE_APP_ORIGIN || 'http://localhost:5173';
/** Edge Function d'ouverture des démos (L11 : bucket privé, règles d'accès côté serveur). */
export const OPEN_URL: string = env.VITE_OPEN_URL || `${SUPABASE_URL}/functions/v1/open-demo`;
export const publishedBase = (demoId: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/published/${demoId}/`;
/** L14 : Edge Function du centre de formation public. */
/** L39 : liens d'accès des démos « Sur invitation » et « Par domaine e-mail ». */
export const ACCESS_URL: string = env.VITE_ACCESS_URL || `${SUPABASE_URL}/functions/v1/access-email`;
export const CENTER_URL: string = env.VITE_CENTER_URL || `${SUPABASE_URL}/functions/v1/open-center`;
/** Logos du centre : bucket public « branding » (L14). */
export const brandingUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/branding/${path}`;
/** L28 051 : fichier de la médiathèque de l'espace (bucket public media). */
export const mediaPublicUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
