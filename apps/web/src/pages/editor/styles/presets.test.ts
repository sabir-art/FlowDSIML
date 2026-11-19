import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../../lib/contrast';
import { PRESETS, asStyleTokens, sameTokens } from './presets';

describe('styles prédéfinis', () => {
  it.each(PRESETS.map((p) => [p.id, p.tokens] as const))('%s : contrastes AA', (_id, s) => {
    expect(contrastRatio(s.text, s.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s.onPrimary, s.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s.hotspot, s.background)).toBeGreaterThanOrEqual(3);
  });

  it('comparaison sans casse, valeurs du workspace complétées', () => {
    const t = { ...PRESETS[2]!.tokens, primary: '#95c11f' };
    expect(sameTokens(t, PRESETS[2]!.tokens)).toBe(true);
    expect(sameTokens({ ...t, radius: 3 }, PRESETS[2]!.tokens)).toBe(false);
    expect(asStyleTokens({ primary: '#123456', radius: 'x' })).toMatchObject({
      primary: '#123456',
      radius: 20,
    });
  });
});

describe('styles livrés en base', () => {
  it('builtin_styles (migration) = PRESETS', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../../../../../supabase/migrations/20261122090000_marque_regles.sql'),
      'utf8',
    );
    for (const p of PRESETS) {
      const m = new RegExp(`\\('${p.id}', \\d+, '(\\{.*?\\})'\\)`).exec(sql);
      expect(m, p.id).not.toBeNull();
      expect(JSON.parse(m![1]!.replace(/''/g, "'"))).toEqual(p.tokens);
    }
  });
});
