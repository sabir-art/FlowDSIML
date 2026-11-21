import type { Hotspot, Manifest } from '@flowdsiml/manifest';

/**
 * A8 : guide optionnel du Sandbox (spec a8-guide-sandbox). Logique pure, sans rendu :
 * le chemin du guide (étapes dont la page et la bulle existent), l'état gardé pour la session et
 * ce que le lecteur affiche (bulle, bulle de départ, bulle de fin, pastille).
 */
export interface GuidePoint {
  page: string;
  advance: 'click' | 'next';
  hotspot: Hotspot;
}

/**
 * on : le guide suit le visiteur ; hold : bulle fermée par Échap (pause) ; off : « Explorer sans guide »
 * ou « Quitter le guide » ; done : dernière étape franchie (bulle de fin) ; closed : bulle de fin fermée.
 */
export type GuideMode = 'on' | 'hold' | 'off' | 'done' | 'closed';
export interface GuideState {
  k: number;
  mode: GuideMode;
}

export const GUIDE_START: GuideState = { k: 0, mode: 'on' };
const MODES: GuideMode[] = ['on', 'hold', 'off', 'done', 'closed'];

/** Étapes jouables, dans l'ordre : une étape dont la page ou la bulle n'existe plus est ignorée. */
export function guidePath(m: Pick<Manifest, 'kind' | 'sandbox' | 'steps'>): GuidePoint[] {
  const sb = m.kind === 'sandbox' ? m.sandbox : null;
  if (!sb?.guide) return [];
  const out: GuidePoint[] = [];
  for (const g of sb.guideSteps.slice(0, 30)) {
    const s = m.steps.find((x) => x.id === g.page && x.kind === 'html');
    const h = s?.hotspots.find((x) => x.id === g.hotspot);
    if (s && h) out.push({ page: g.page, advance: g.advance, hotspot: h });
  }
  return out;
}

export const guideKey = (demoId: string) => `fd.guide.${demoId}`;

export function readGuide(raw: string | null, n: number): GuideState {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<GuideState>) : null;
    if (v && Number.isInteger(v.k) && MODES.includes(v.mode as GuideMode))
      return { k: Math.max(0, Math.min(n - 1, v.k as number)), mode: v.mode as GuideMode };
  } catch {
    /* état illisible : départ */
  }
  return GUIDE_START;
}

/** Étape franchie : la suivante, ou la fin du guide. */
export function advance(s: GuideState, n: number): GuideState {
  return s.k + 1 >= n ? { k: n - 1, mode: 'done' } : { k: s.k + 1, mode: 'on' };
}

export type GuideView =
  | { kind: 'none' }
  | {
      kind: 'guide';
      /** Bulle de l'étape courante (le visiteur est sur sa page). */
      bubble: GuidePoint | null;
      /** Le guide commence sur une autre page que la page de départ. */
      startsOn: string | null;
      /** Bulle de fin. */
      done: boolean;
      /** Pastille de la barre : active (menu), en pause, à reprendre, ou absente. */
      pill: 'active' | 'paused' | 'resume' | null;
    };

export function guideView(
  s: GuideState,
  path: GuidePoint[],
  stepId: string,
  startId: string | null,
): GuideView {
  const n = path.length;
  if (!n || s.mode === 'closed') return { kind: 'none' };
  const none = { bubble: null, startsOn: null, done: false };
  if (s.mode === 'done') return { kind: 'guide', ...none, done: true, pill: null };
  if (s.mode === 'off') return { kind: 'guide', ...none, pill: 'resume' };
  if (s.mode === 'hold') return { kind: 'guide', ...none, pill: 'paused' };
  const cur = path[s.k]!;
  if (cur.page === stepId) return { kind: 'guide', ...none, bubble: cur, pill: 'active' };
  if (s.k === 0 && stepId === startId) return { kind: 'guide', ...none, startsOn: cur.page, pill: 'active' };
  // Hors du chemin : pause silencieuse, la pastille ramène à l'étape
  return { kind: 'guide', ...none, pill: 'paused' };
}
