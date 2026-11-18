const env = import.meta.env;
export const SUPABASE_URL: string = (
  env.VITE_SUPABASE_URL || 'https://ffzlhlxfratcbitkuvli.supabase.co'
).replace(/\/$/, '');
export const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY || '';
/** Edge Function d'ingestion (sinon repli sur la RPC track_events). */
export const TRACK_URL: string | null = env.VITE_TRACK_URL || `${SUPABASE_URL}/functions/v1/track`;
/** Origine de l'app (éditeur) autorisée à envoyer un manifeste d'aperçu. */
export const APP_ORIGIN: string = env.VITE_APP_ORIGIN || 'http://localhost:5173';
/** Edge Function d'ouverture des démos (L11 : bucket privé, règles d'accès côté serveur). */
export const OPEN_URL: string = env.VITE_OPEN_URL || `${SUPABASE_URL}/functions/v1/open-demo`;
export const publishedBase = (demoId: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/published/${demoId}/`;
