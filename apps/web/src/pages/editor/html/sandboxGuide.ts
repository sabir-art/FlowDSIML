/**
 * A8 : guide optionnel du Sandbox, côté éditeur (spec a8-guide-sandbox §3). Logique pure : lecture de
 * demo.sandbox.guideSteps, lignes de la liste (orphelines comprises), repères « Guide : 1, 3 » des
 * cartes du plan, ajout et réordonnancement. 30 étapes au plus (même limite que la base).
 */
export const GUIDE_MAX = 30;

export interface GuideStepRef {
  page: string;
  hotspot: string;
  advance: 'click' | 'next';
}

/** Étapes enregistrées (forme valide seulement ; une étape orpheline est gardée pour être signalée). */
export function guideStepsOf(v: unknown): GuideStepRef[] {
  const raw = v && typeof v === 'object' ? (v as Record<string, unknown>).guideSteps : null;
  if (!Array.isArray(raw)) return [];
  const out: GuideStepRef[] = [];
  for (const g of raw) {
    const o = g as Record<string, unknown> | null;
    if (!o || typeof o.page !== 'string' || typeof o.hotspot !== 'string') continue;
    out.push({ page: o.page, hotspot: o.hotspot, advance: o.advance === 'next' ? 'next' : 'click' });
    if (out.length === GUIDE_MAX) break;
  }
  return out;
}

export interface GuideRow extends GuideStepRef {
  /** Numéro affiché (à partir de 1). */
  n: number;
  /** Bulle ou page supprimée, ou bulle déplacée sur une autre page. */
  orphan: boolean;
  title: string;
  pageTitle: string;
}

export function guideRows(
  steps: Array<{ id: string; title: string; kind: string }>,
  hotspots: Array<{ id: string; step_id: string; title: string; body: string }>,
  list: GuideStepRef[],
): GuideRow[] {
  return list.map((g, i) => {
    const page = steps.find((s) => s.id === g.page && s.kind === 'html');
    const h = hotspots.find((x) => x.id === g.hotspot);
    const orphan = !page || !h || h.step_id !== g.page;
    const text = (h?.title || h?.body || '').replace(/<[^>]*>/g, '').trim();
    return { ...g, n: i + 1, orphan, title: text, pageTitle: page?.title ?? '' };
  });
}

/** Numéros des étapes (non orphelines) portées par chaque page, pour « Guide : 1, 3 ». */
export function guideOnPages(rows: GuideRow[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const r of rows) if (!r.orphan) m.set(r.page, [...(m.get(r.page) ?? []), r.n]);
  return m;
}

/** Déplace l'étape i de d (−1 : monter, +1 : descendre) ; sans effet aux bords. */
export function moveGuideStep(list: GuideStepRef[], i: number, d: -1 | 1): GuideStepRef[] {
  const j = i + d;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Glisser-déposer : l'étape `from` prend la place `to`. */
export function dropGuideStep(list: GuideStepRef[], from: number, to: number): GuideStepRef[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x!);
  return next;
}

/**
 * Zone de secours d'une bulle posée sur un élément : son rect dans la fenêtre de la page, en fractions
 * de la fenêtre capturée (bornées à 0..1).
 */
export function fallbackRect(r: { x: number; y: number; w: number; h: number }, vw: number, vh: number) {
  const c = (v: number) => Math.max(0, Math.min(1, Math.round(v * 10000) / 10000));
  const x = c(r.x / vw);
  const y = c(r.y / vh);
  return { x, y, w: c(Math.min(r.w / vw, 1 - x)), h: c(Math.min(r.h / vh, 1 - y)) };
}
