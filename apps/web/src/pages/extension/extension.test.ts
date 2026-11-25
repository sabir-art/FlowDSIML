import { describe, expect, it } from 'vitest';
import { compareVersions, versionState } from './extension';

describe('compareVersions', () => {
  it('compare par nombres, pas par texte', () => {
    expect(compareVersions('0.3.0', '0.2.9')).toBeGreaterThan(0);
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.2.0', '0.3.0')).toBeLessThan(0);
  });
});

describe('versionState', () => {
  it('version déclarée et à jour', () => {
    expect(versionState('0.3.0', '0.3.0')).toEqual({ version: '0.3.0', known: true, upToDate: true });
  });
  it('version déclarée en retard', () => {
    expect(versionState('0.3.0', '0.4.0').upToDate).toBe(false);
  });
  it('version non déclarée : 0.2.0 ou antérieure', () => {
    expect(versionState(null, '0.2.0')).toEqual({ version: '0.2.0', known: false, upToDate: true });
    expect(versionState(undefined, '0.3.0').upToDate).toBe(false);
  });
});
