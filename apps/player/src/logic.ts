/** Logique pure du player (testée). */
import type { ChoiceAction, Manifest, Step } from '@flowdsiml/manifest';

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

/** F1 : index de l'écran affiché derrière une étape pop-up (dernière étape image précédente). */
export function backdropIndex(m: Manifest, i: number): number | null {
  for (let j = i - 1; j >= 0; j--) if (m.steps[j]?.kind === 'image' && m.steps[j]?.image) return j;
  return null;
}

/**
 * F1 : éléments de la checklist (un par chapitre, sinon un par étape). Un chapitre est coché quand
 * sa dernière étape a été vue (spec a2 §3), ce qui reste juste avec un parcours à embranchements.
 */
export function checklistItems(
  m: Manifest,
  visited: ReadonlySet<number>,
  current: number,
): Array<{ id: string; title: string; target: number; done: boolean; current: boolean }> {
  if (m.chapters.length)
    return m.chapters.flatMap((c) => {
      const idx = m.steps.flatMap((s, i) => (s.chapterId === c.id ? [i] : []));
      if (!idx.length) return [];
      return [
        {
          id: c.id,
          title: c.title,
          target: idx[0]!,
          done: visited.has(idx[idx.length - 1]!),
          current: idx.includes(current),
        },
      ];
    });
  return m.steps.map((s, i) => ({
    id: s.id,
    title: s.title || s.hotspots[0]?.title || `${i + 1}`,
    target: i,
    done: visited.has(i),
    current: i === current,
  }));
}

/** F1 : destination d'un choix de parcours. */
export function choiceTarget(
  m: Manifest,
  action: ChoiceAction,
): { kind: 'step'; index: number } | { kind: 'end' } | { kind: 'url'; url: string } | null {
  if (action.type === 'end') return { kind: 'end' };
  if (action.type === 'url') return { kind: 'url', url: action.url };
  const i =
    action.type === 'goto'
      ? m.steps.findIndex((s) => s.id === action.stepId)
      : m.steps.findIndex((s) => s.chapterId === action.chapterId);
  return i >= 0 ? { kind: 'step', index: i } : null;
}

/** F1 : l'autoplay peut-il avancer depuis l'étape i ? (pas de formulaire, de choix ni de fin) */
export function canAutoAdvance(m: Manifest, i: number, gated: boolean): boolean {
  const s = m.steps[i];
  if (!s || gated || i >= m.steps.length - 1) return false;
  return s.options.choices.length === 0;
}
