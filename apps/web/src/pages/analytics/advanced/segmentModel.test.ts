import { describe, expect, it } from 'vitest';
import { conditionValid, decodeDef, defaultCondition, defValid, encodeDef, opsFor } from './segmentModel';

describe('segments (L19-04)', () => {
  it('opérateurs selon le type de critère', () => {
    expect(opsFor('device')).toEqual(['is', 'is_not']);
    expect(opsFor('completed')).toEqual(['is']);
    expect(opsFor('steps')).toEqual(['gte', 'lte']);
    expect(opsFor('referrer')).toEqual(['contains', 'not_contains']);
  });
  it('valeurs validées comme en base', () => {
    expect(conditionValid({ field: 'device', op: 'is', value: 'mobile' })).toBe(true);
    expect(conditionValid({ field: 'device', op: 'is', value: 'montre' })).toBe(false);
    expect(conditionValid({ field: 'country', op: 'is', value: 'fr' })).toBe(false);
    expect(conditionValid({ field: 'lang', op: 'is_not', value: 'fr' })).toBe(true);
    expect(conditionValid({ field: 'completed', op: 'is_not', value: true })).toBe(false);
    expect(conditionValid({ field: 'steps', op: 'gte', value: 1.5 })).toBe(false);
    expect(conditionValid({ field: 'referrer', op: 'contains', value: ' ' })).toBe(false);
    expect(defValid({ match: 'all', conditions: [] })).toBe(false);
    expect(defValid({ match: 'all', conditions: Array(9).fill(defaultCondition('cta')) })).toBe(false);
  });
  it('aller-retour dans l’URL, valeurs invalides écartées', () => {
    const d = {
      match: 'any' as const,
      conditions: [defaultCondition('device'), { field: 'steps' as const, op: 'gte' as const, value: 3 }],
    };
    expect(decodeDef(encodeDef(d))).toEqual(d);
    expect(decodeDef('{"c":[["ip","is","x"]]}')).toBeNull();
    expect(decodeDef('pas du json')).toBeNull();
    expect(decodeDef(null)).toBeNull();
  });
});
