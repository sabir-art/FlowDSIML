/** Configuration publique de l'extension (injectée au build par WXT via import.meta.env). */
export const SUPABASE_URL: string =
  import.meta.env.WXT_SUPABASE_URL || 'https://ffzlhlxfratcbitkuvli.supabase.co';
export const SUPABASE_ANON_KEY: string = import.meta.env.WXT_SUPABASE_ANON_KEY || '';
export const APP_URL: string = import.meta.env.WXT_APP_URL || 'http://localhost:5173';
/**
 * EXT-STORE, option B (décision du chef, 21 novembre) : la version de la boutique n'a pas `debugger`
 * (Chrome ne permet pas de la rendre facultative). Format mobile et page entière restent visibles en
 * « Bientôt » ; la taille d'onglet passe par windows.update. WXT_DEBUGGER=1 au build rétablit l'option A.
 */
export const DEBUGGER: boolean = import.meta.env.WXT_DEBUGGER === '1';
