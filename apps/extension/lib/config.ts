/** Configuration publique de l'extension (injectée au build par WXT via import.meta.env). */
export const SUPABASE_URL: string =
  import.meta.env.WXT_SUPABASE_URL ?? 'https://ffzlhlxfratcbitkuvli.supabase.co';
export const SUPABASE_ANON_KEY: string = import.meta.env.WXT_SUPABASE_ANON_KEY ?? '';
export const APP_URL: string = import.meta.env.WXT_APP_URL ?? 'http://localhost:5173';
