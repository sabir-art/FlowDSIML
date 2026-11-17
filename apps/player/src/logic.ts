/** Logique pure du player (testée). */
import type { Manifest, Step } from '@flowdsiml/manifest';

export { resolvePlacement, type Placement } from '@flowdsiml/player-core';

/** L'origine qui embarque le player est-elle autorisée ? (contrôle côté client, contournable) */
export function embedAllowed(allowed: string[], inIframe: boolean, parentOrigin: string | null): boolean {
  if (!inIframe || allowed.length === 0) return true;
  if (!parentOrigin) return false;
  return allowed.some((a) => {
    try {
      const want = new URL(a.includes('://') ? a : `https://${a}`);
      const got = new URL(parentOrigin);
      if (want.hostname.startsWith('*.')) return got.hostname.endsWith(want.hostname.slice(1));
      return want.hostname === got.hostname;
    } catch {
      return false;
    }
  });
}

/** Résout les URL d'images relatives (assets/…) par rapport au dossier publié. */
export function resolveAssets(m: Manifest, base: string): Manifest {
  return {
    ...m,
    steps: m.steps.map((s): Step =>
      s.image && !/^(https?:|blob:|data:)/.test(s.image.url)
        ? { ...s, image: { ...s.image, url: base + s.image.url } }
        : s,
    ),
  };
}

/** Index de l'étape suivante pour une action de hotspot. */
export function nextIndex(
  m: Manifest,
  current: number,
  action: { type: string; stepId?: string },
): number | null {
  if (action.type === 'goto' && action.stepId) {
    const i = m.steps.findIndex((s) => s.id === action.stepId);
    return i >= 0 ? i : null;
  }
  if (action.type === 'next') return current + 1 < m.steps.length ? current + 1 : null;
  return null;
}

export function randomId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Parse le hash : #/d/<demoId>?company=x | #/l/<token> | #/preview */
export function parseRoute(
  hash: string,
):
  | { kind: 'demo'; id: string; search: string }
  | { kind: 'link'; token: string; search: string }
  | { kind: 'preview' }
  | { kind: 'none' } {
  const h = hash.replace(/^#/, '');
  const [path = '', search = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'd' && parts[1] && /^[0-9a-f-]{36}$/i.test(parts[1]))
    return { kind: 'demo', id: parts[1], search: `?${search}` };
  if (parts[0] === 'l' && parts[1] && /^[A-Za-z0-9_-]{6,64}$/.test(parts[1]))
    return { kind: 'link', token: parts[1], search: `?${search}` };
  if (parts[0] === 'preview') return { kind: 'preview' };
  return { kind: 'none' };
}
