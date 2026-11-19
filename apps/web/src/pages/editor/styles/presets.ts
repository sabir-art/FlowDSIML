import type { Theme } from '@flowdsiml/manifest';

/** L18-05 : champs d'un thème fixés par un style (le logo, le filigrane et le dégradé restent). */
export type StyleTokens = Pick<
  Theme,
  | 'primary'
  | 'onPrimary'
  | 'hotspot'
  | 'background'
  | 'surface'
  | 'text'
  | 'radius'
  | 'buttonRadius'
  | 'fontFamily'
>;
export const STYLE_KEYS: Array<keyof StyleTokens> = [
  'primary',
  'onPrimary',
  'hotspot',
  'background',
  'surface',
  'text',
  'radius',
  'buttonRadius',
  'fontFamily',
];

const JAKARTA = "'Plus Jakarta Sans', system-ui, sans-serif";

/**
 * Les 6 styles livrés (valeurs de refonte/styles-predefinis.html). Chacun respecte : texte de bulle
 * ≥ 4,5:1, bouton ≥ 4,5:1, pastille ≥ 3:1 sur le fond (vérifié par presets.test.ts).
 */
export const PRESETS: Array<{ id: string; tokens: StyleTokens }> = [
  {
    id: 'dsi',
    tokens: {
      primary: '#A3195B',
      onPrimary: '#FFFFFF',
      hotspot: '#D60B52',
      background: '#EEF2F6',
      surface: '#FFFFFF',
      text: '#080808',
      radius: 20,
      buttonRadius: 999,
      fontFamily: JAKARTA,
    },
  },
  {
    id: 'blue',
    tokens: {
      // Maquette : #2381B5 (4,30:1 avec le blanc, sous l'AA) ; teinte la plus proche à 4,5:1 (4,67:1)
      primary: '#217BAC',
      onPrimary: '#FFFFFF',
      hotspot: '#2897D5',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      text: '#161A20',
      radius: 12,
      buttonRadius: 8,
      fontFamily: JAKARTA,
    },
  },
  {
    id: 'green',
    tokens: {
      primary: '#95C11F',
      onPrimary: '#080808',
      hotspot: '#557014',
      background: '#F5F9E8',
      surface: '#FFFFFF',
      text: '#080808',
      radius: 20,
      buttonRadius: 999,
      fontFamily: JAKARTA,
    },
  },
  {
    id: 'night',
    tokens: {
      primary: '#CF86A9',
      onPrimary: '#080808',
      hotspot: '#E35889',
      background: '#0B0D10',
      surface: '#1C2128',
      text: '#F3F5F8',
      radius: 16,
      buttonRadius: 999,
      fontFamily: JAKARTA,
    },
  },
  {
    id: 'minimal',
    tokens: {
      primary: '#080808',
      onPrimary: '#FFFFFF',
      hotspot: '#080808',
      background: '#F6F8FA',
      surface: '#FFFFFF',
      text: '#080808',
      radius: 6,
      buttonRadius: 6,
      fontFamily: 'system-ui, sans-serif',
    },
  },
  {
    id: 'contrast',
    tokens: {
      primary: '#FFFFFF',
      onPrimary: '#080808',
      hotspot: '#D60B52',
      background: '#FFFFFF',
      surface: '#080808',
      text: '#FFFFFF',
      radius: 8,
      buttonRadius: 8,
      fontFamily: JAKARTA,
    },
  },
];

export const pickTokens = (t: Theme): StyleTokens =>
  Object.fromEntries(STYLE_KEYS.map((k) => [k, t[k]])) as StyleTokens;

/** Le thème correspond-il exactement à ces valeurs (casse des couleurs ignorée) ? */
export function sameTokens(a: Partial<StyleTokens>, b: StyleTokens): boolean {
  return STYLE_KEYS.every((k) => {
    const x = a[k];
    const y = b[k];
    return typeof x === 'string' && typeof y === 'string' ? x.toUpperCase() === y.toUpperCase() : x === y;
  });
}

/** Valeurs d'un style du workspace (themes.tokens), complétées par celles du style par défaut. */
export function asStyleTokens(v: unknown): StyleTokens {
  const base = PRESETS[0]!.tokens;
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out = { ...base } as Record<string, unknown>;
  for (const k of STYLE_KEYS) {
    const x = o[k];
    if (typeof x === typeof base[k]) out[k] = x;
  }
  return out as StyleTokens;
}
