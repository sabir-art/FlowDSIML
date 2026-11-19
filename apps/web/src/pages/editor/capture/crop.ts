/**
 * L25-02 : application d'un recadrage aux étapes (les boîtes suivent : hotspots, flous, zoom, champ
 * de la saisie). Le recadrage est non destructif : seule options.crop change, l'image reste entière.
 */
import { asCrop, reframe, type CropRect } from '@flowdsiml/player-core';
import type { DemoEditor } from '../useDemoEditor';
import type { StepRow } from '../types';

export type CropRatio = 'free' | '16:9' | '4:3' | '1:1';
export const RATIOS: Record<Exclude<CropRatio, 'free'>, number> = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1 };
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** Format reconnu d'une taille (affiché sous les dimensions : « 16:9 »), sinon null. */
export function ratioLabel(w: number, h: number): string | null {
  const r = w / h;
  const hit = Object.entries(RATIOS).find(([, v]) => Math.abs(v - r) < 0.01);
  return hit ? hit[0] : null;
}

/** Étapes concernées par « Toutes » : captures de même taille que l'étape. */
export function sameSize(steps: StepRow[], step: StepRow): StepRow[] {
  return steps.filter(
    (s) =>
      s.kind === 'image' &&
      !!s.image_path &&
      s.image_width === step.image_width &&
      s.image_height === step.image_height,
  );
}

/** Recadre des étapes : options.crop, et chaque boîte ramenée dans le nouveau cadre. */
export function applyCrop(editor: DemoEditor, targets: StepRow[], next: CropRect | null) {
  const to = next && asCrop(next);
  editor.batch(() => {
    for (const s of targets) {
      const raw = (s.options ?? {}) as Record<string, unknown>;
      const from = asCrop(raw.crop);
      for (const h of editor.hotspots.filter((x) => x.step_id === s.id)) {
        const r = reframe({ x: h.x, y: h.y, w: h.w, h: h.h }, from, to);
        editor.updateHotspot(h.id, r);
      }
      const opts: Record<string, unknown> = { ...raw };
      if (to) opts.crop = to;
      else delete opts.crop;
      const anim = raw.animation as
        { type?: string; field?: { x: number; y: number; w: number; h: number } | null } | undefined;
      if (anim?.type === 'typing' && anim.field)
        opts.animation = { ...anim, field: reframe(anim.field, from, to) };
      const patch: Partial<StepRow> = { options: opts as StepRow['options'] };
      if (Array.isArray(s.blurs) && s.blurs.length)
        patch.blurs = (s.blurs as Array<{ x: number; y: number; w: number; h: number }>).map((b) =>
          reframe(b, from, to),
        ) as unknown as StepRow['blurs'];
      const z = s.zoom as { x?: number; y?: number } | null;
      if (z && typeof z.x === 'number' && typeof z.y === 'number')
        patch.zoom = { ...z, ...reframe({ x: z.x, y: z.y }, from, to) } as StepRow['zoom'];
      editor.updateStep(s.id, patch);
    }
  });
}
