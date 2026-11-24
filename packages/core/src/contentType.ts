/**
 * L48-G §2, EXT-02 §4.1 : les quatre types de contenu de TutoClick, partagés par l'app, le lecteur et
 * Analytics.
 * - `sandbox` : demos.kind = 'sandbox' (pages HTML reliées, exploration libre) ;
 * - `video` : démo guidée dont plus de la moitié des étapes sont des vidéos ;
 * - `html` : démo guidée dont plus de la moitié des étapes sont des pages HTML ;
 * - `captures` : toute autre démo guidée (captures d'écran, avant/après).
 */
export type ContentType = 'captures' | 'html' | 'sandbox' | 'video';
export const CONTENT_TYPES: ContentType[] = ['captures', 'html', 'sandbox', 'video'];

export function contentType(
  demo: { kind?: string | null },
  steps: { total: number; html: number; video?: number },
): ContentType {
  if (demo.kind === 'sandbox') return 'sandbox';
  if (steps.total > 0 && (steps.video ?? 0) * 2 > steps.total) return 'video';
  return steps.total > 0 && steps.html * 2 > steps.total ? 'html' : 'captures';
}
