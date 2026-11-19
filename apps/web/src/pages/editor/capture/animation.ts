/**
 * L25-04/05 : réglages de l'animation d'une étape (pur, testé). Le champ de la saisie est repéré à
 * la capture (element_meta : boîte de l'élément cliqué, s'il s'agit d'un champ).
 */
import { matchText } from '@flowdsiml/core';
import { defaultScroll, type FullPage } from '@flowdsiml/player-core';
import type { StepAnimation } from '@flowdsiml/manifest';

export type Rect = { x: number; y: number; w: number; h: number };
type Meta = {
  tag?: string;
  label?: string;
  element?: { left: number; top: number; width: number; height: number } | null;
  viewport?: { width: number; height: number };
};

const FIELD_TAGS = ['input', 'textarea', 'select'];
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Champ repéré à la capture (boîte relative et libellé), ou null si le clic n'était pas sur un champ. */
export function capturedField(meta: unknown): { field: Rect; label: string } | null {
  const m = (meta ?? {}) as Meta;
  const el = m.element;
  const vp = m.viewport;
  if (!el || !vp || vp.width <= 0 || vp.height <= 0 || !FIELD_TAGS.includes((m.tag ?? '').toLowerCase()))
    return null;
  return {
    field: {
      x: r4(el.left / vp.width),
      y: r4(el.top / vp.height),
      w: r4(el.width / vp.width),
      h: r4(el.height / vp.height),
    },
    label: (m.label ?? '').slice(0, 80),
  };
}

/** Champ choisi sur le canevas : une boîte de champ de formulaire centrée sur le clic. */
export function fieldAt(x: number, y: number): Rect {
  const w = 0.24;
  const h = 0.05;
  const c = (v: number, s: number) => r4(Math.min(1 - s, Math.max(0, v - s / 2)));
  return { x: c(x, w), y: c(y, h), w, h };
}

/** Animation proposée quand on choisit un type. */
export function defaultAnimation(
  type: 'typing' | 'scroll',
  meta: unknown,
  fullPage: FullPage | null,
): StepAnimation | undefined {
  if (type === 'typing') {
    const f = capturedField(meta);
    return { type, text: '', field: f?.field ?? null, fieldLabel: f?.label ?? '', speed: 'normal' };
  }
  if (!fullPage) return undefined;
  return { type, ...defaultScroll(fullPage), duration: 1.2 };
}

/** Types de données personnelles repérées dans le texte saisi (variables exclues). */
export function typedPii(text: string): string[] {
  const plain = text.replace(/\{\{[^}]*\}\}/g, ' ');
  return [...new Set(matchText(plain).map((m) => m.type))];
}
