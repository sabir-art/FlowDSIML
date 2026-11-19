/**
 * L26 §3.3-3.4 (arbitrage du chef) : visites guidées et modules « Apprendre TutoClick » = démos
 * statiques embarquées (public/help/<id>/manifest.json + captures), générées par scripts/help-capture.cjs.
 * Une visite absente de l'index (pas encore capturable) est affichée « Bientôt ».
 */
import type { HelpPage } from './articles';

export interface TourEntry {
  key: string;
  id: string;
  kind: 'page' | 'module';
  order: number | null;
  title: string;
  steps: number;
}

const base = () => `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}help/`;
let cache: Promise<TourEntry[]> | null = null;

export function loadTours(): Promise<TourEntry[]> {
  cache ??= fetch(`${base()}index.json`)
    .then((r) => (r.ok ? r.json() : { tours: [] }))
    .then((j: { tours?: TourEntry[] }) => (Array.isArray(j.tours) ? j.tours : []))
    .catch(() => []);
  return cache;
}

/** Visite de chaque page d'aide (l'éditeur a une visite pour ses trois onglets). */
export const PAGE_TOUR: Record<HelpPage, string> = {
  demos: 'page:demos',
  'editor-step': 'page:editor',
  'editor-design': 'page:editor',
  'editor-settings': 'page:editor',
  share: 'page:share',
  distribute: 'page:distribution',
  analytics: 'page:analytics',
  learners: 'page:learners',
  center: 'page:center',
  settings: 'page:settings',
};

/** Modules « Apprendre » : clé de progression (base) → visite. */
export const MODULE_TOUR = {
  capturer: 'learn:capture',
  modifier: 'learn:edit',
  flouter: 'learn:blur',
  publier: 'learn:share',
  diffuser: 'learn:distribute',
  statistiques: 'learn:analytics',
} as const;

/**
 * Manifeste d'une visite, images en adresses absolues (le lecteur est servi depuis une autre origine).
 */
export async function loadTourManifest(id: string): Promise<unknown> {
  if (!/^[a-z0-9-]{1,60}$/.test(id)) throw new Error('TOUR_INVALID');
  const dir = new URL(`${base()}${id}/`, location.href).href;
  const m = (await (await fetch(`${dir}manifest.json`)).json()) as {
    steps?: Array<{ image?: { url: string } | null }>;
  };
  for (const s of m.steps ?? []) if (s.image) s.image = { ...s.image, url: new URL(s.image.url, dir).href };
  return m;
}
