import type { Json } from '@flowdsiml/supabase-types';
import { supabase } from '../../../lib/supabase';
import type { DemoEditor } from '../useDemoEditor';
import { asLayers } from '../images/layers';
import { asStepOptions, type HotspotRow, type StepRow } from '../types';
import {
  clipRect,
  fitInside,
  keepInside,
  layout,
  mapPoint,
  mapRect,
  outside,
  targetSize,
  unmapRect,
  type FitMode,
  type FormatId,
  type Layout,
  type Rect,
} from './format';

export interface FormatChoice {
  format: FormatId;
  mode: FitMode;
  outWidth: number;
  custom: { w: number; h: number };
}
type Blur = Rect & Record<string, unknown>;
interface Original {
  image_path: string;
  image_width: number;
  image_height: number;
  blurs: Blur[];
  zoom: (Record<string, unknown> & { x: number; y: number }) | null;
  crop: Rect | null;
  hotspots: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  /** Disposition appliquée par le dernier changement de format (place de l'origine dans le cadre). */
  layout?: Layout;
}

/**
 * Images ajoutées d'une étape dans le nouveau cadre : ramenées d'abord sur l'image d'origine (inverse
 * de la disposition précédente, si l'étape a déjà été mise au format), puis placées comme les autres
 * repères. Elles restent entières, dans le cadre.
 */
export function mapLayers<T extends Rect>(layers: T[], prev: Layout | null | undefined, next: Layout): T[] {
  return layers.map((x) => fitInside(mapRect(prev ? unmapRect(x, prev) : x, next)));
}

/** Étape déjà mise au format avant que la disposition soit gardée : ses images ne peuvent pas suivre. */
export const layersUntracked = (step: StepRow) =>
  asLayers(step.options).length > 0 && !!step.original && !(step.original as unknown as Original).layout;

/** Étapes concernées : les captures (étapes image avec leur fichier). */
export const formatSteps = (steps: StepRow[]) =>
  steps.filter((s) => s.kind === 'image' && s.image_path && s.image_width && s.image_height);

/** Base du calcul : l'origine sauvegardée, sinon l'état actuel (appliquer deux fois ne dégrade rien). */
export function baseOf(step: StepRow, hotspots: HotspotRow[]): Original {
  const o = step.original as unknown as Original | null;
  if (o)
    return {
      ...o,
      blurs: o.blurs ?? [],
      hotspots: o.hotspots ?? [],
      zoom: o.zoom ?? null,
      crop: o.crop ?? null,
    };
  const crop = asStepOptions(step.options).crop as Rect | undefined;
  return {
    image_path: step.image_path!,
    image_width: step.image_width!,
    image_height: step.image_height!,
    blurs: (Array.isArray(step.blurs) ? step.blurs : []) as unknown as Blur[],
    zoom: (step.zoom as Original['zoom']) ?? null,
    crop: crop ?? null,
    hotspots: hotspots
      .filter((h) => h.step_id === step.id)
      .map((h) => ({ id: h.id, x: h.x, y: h.y, w: h.w, h: h.h })),
  };
}

export interface StepPlan {
  step: StepRow;
  base: Original;
  l: Layout;
  /** Repère sorti du cadre, zone de flou coupée (Recadrer). */
  hotspotOut: boolean;
  blurCut: boolean;
}

export function planStep(step: StepRow, hotspots: HotspotRow[], c: FormatChoice): StepPlan {
  const base = baseOf(step, hotspots);
  const src = { w: base.image_width, h: base.image_height };
  const target = targetSize(c.format, c.outWidth, src, c.custom);
  const first = base.hotspots[0];
  const focus = first ? { x: first.x + first.w / 2, y: first.y + first.h / 2 } : undefined;
  const mode: FitMode = c.format === 'original' ? 'fit' : c.mode;
  const l = layout(src, target, mode, focus);
  return {
    step,
    base,
    l,
    hotspotOut: base.hotspots.some((h) => outside(mapRect(h, l))),
    blurCut: base.blurs.some((b) => outside(mapRect(b, l))),
  };
}

/** Rendu de l'image dans le nouveau cadre (bandes de la couleur de fond de la démo en Adapter). */
export async function renderPlan(p: StepPlan, background: string, maxWidth?: number): Promise<Blob> {
  const dl = await supabase.storage.from('captures').download(p.base.image_path);
  if (dl.error) throw dl.error;
  const bmp = await createImageBitmap(dl.data);
  const k = maxWidth ? Math.min(1, maxWidth / p.l.tw) : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(p.l.tw * k);
  c.height = Math.round(p.l.th * k);
  const g = c.getContext('2d')!;
  g.fillStyle = background;
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, p.l.ox * k, p.l.oy * k, p.l.dw * k, p.l.dh * k);
  bmp.close();
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('RENDER'))), 'image/webp', 0.92),
  );
}

/**
 * Applique le format à toutes les captures : nouvelles images rendues et téléversées d'abord, puis toutes
 * les modifications en une seule étape d'annulation. L'origine est sauvegardée au premier changement.
 */
export async function applyFormat(
  editor: DemoEditor,
  plans: StepPlan[],
  background: string,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const ready: Array<{ p: StepPlan; path: string }> = [];
  let done = 0;
  for (const p of plans) {
    const blob = await renderPlan(p, background);
    const path = `${p.step.workspace_id}/${p.step.demo_id}/${crypto.randomUUID()}.webp`;
    const up = await supabase.storage.from('captures').upload(path, blob, { contentType: 'image/webp' });
    if (up.error) throw up.error;
    ready.push({ p, path });
    onProgress?.(++done, plans.length);
  }
  editor.batch(() => {
    for (const { p, path } of ready) {
      const { l, base, step } = p;
      const opts = { ...((step.options ?? {}) as Record<string, unknown>) };
      const crop = base.crop ? clipRect(mapRect(base.crop, l)) : null;
      if (crop) opts.crop = crop;
      else delete opts.crop;
      // Images ajoutées : elles suivent l'image dans le nouveau cadre
      const layers = asLayers(step.options);
      if (layers.length) opts.images = mapLayers(layers, step.original ? (base.layout ?? null) : null, l);
      editor.updateStep(step.id, {
        image_path: path,
        image_width: l.tw,
        image_height: l.th,
        // Zone de flou coupée : la partie visible reste floutée
        blurs: base.blurs.map((b) => clipRect(mapRect(b, l))).filter(Boolean) as unknown as NonNullable<Json>,
        zoom: base.zoom ? (mapPoint(base.zoom, l) as unknown as Json) : null,
        options: opts as unknown as StepRow['options'],
        // L'origine garde la disposition appliquée : le prochain changement repart de l'image d'origine
        original: {
          ...((step.original as unknown as Original | null) ?? base),
          layout: l,
        } as unknown as Json,
      });
      for (const h of base.hotspots) {
        const r = keepInside(mapRect(h, l));
        editor.updateHotspot(h.id, { x: r.x, y: r.y, w: r.w, h: r.h });
      }
    }
  });
  return ready.length;
}
