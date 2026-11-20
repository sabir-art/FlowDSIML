/**
 * L48-G §2 : les trois types de contenu de TutoClick, partagés par l'app, le lecteur et Analytics.
 * - `sandbox` : demos.kind = 'sandbox' (pages HTML reliées, exploration libre) ;
 * - `html` : démo guidée dont plus de la moitié des étapes sont des pages HTML ;
 * - `captures` : toute autre démo guidée (captures d'écran, vidéo, avant/après).
 */
export type ContentType = 'captures' | 'html' | 'sandbox';
export const CONTENT_TYPES: ContentType[] = ['captures', 'html', 'sandbox'];

export function contentType(
  demo: { kind?: string | null },
  steps: { total: number; html: number },
): ContentType {
  if (demo.kind === 'sandbox') return 'sandbox';
  return steps.total > 0 && steps.html * 2 > steps.total ? 'html' : 'captures';
}
