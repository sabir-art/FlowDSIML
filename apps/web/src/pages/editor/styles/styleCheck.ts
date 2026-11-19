import { adjustToContrast, contrastRatio } from '../../../lib/contrast';
import type { StyleTokens } from './presets';

/**
 * L27 §3.4 : contrastes d'un style. Texte de la bulle et texte du bouton à 4,5:1 au moins, pastille du
 * hotspot à 3:1 au moins sur le fond. `fix` : couleur proposée (champ concerné), si elle existe.
 */
export interface StyleCheck {
  key: 'bubble' | 'button' | 'hotspot';
  ratio: number;
  min: number;
  ok: boolean;
  field: keyof StyleTokens;
  fix: string | null;
}

export function checkStyle(s: StyleTokens): StyleCheck[] {
  const row = (
    key: StyleCheck['key'],
    field: keyof StyleTokens,
    fg: string,
    bg: string,
    min: number,
  ): StyleCheck => {
    const ratio = contrastRatio(fg, bg);
    return { key, ratio, min, ok: ratio >= min, field, fix: adjustToContrast(fg, bg, min) };
  };
  return [
    row('bubble', 'text', s.text, s.surface, 4.5),
    row('button', 'primary', s.primary, s.onPrimary, 4.5),
    row('hotspot', 'hotspot', s.hotspot, s.background, 3),
  ];
}

export const styleOk = (s: StyleTokens) => checkStyle(s).every((c) => c.ok);
