import { describe, expect, it } from 'vitest';
import { compareVersions, offerInstall, versionState } from './extension';

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

describe('offerInstall (§10)', () => {
  const store = 'https://chromewebstore.example/detail/tutoclick';
  it('propose l’installation tant que l’extension publiée n’a pas été détectée', () => {
    expect(offerInstall({ storeUrl: store, seenAt: null, editable: true })).toBe(true);
    expect(offerInstall({ storeUrl: store, seenAt: undefined, editable: true })).toBe(true);
  });
  it('disparaît dès que l’extension est détectée', () => {
    expect(offerInstall({ storeUrl: store, seenAt: '2026-11-25T08:00:00Z', editable: true })).toBe(false);
  });
  it('ne propose rien si l’extension n’est pas publiée, ni à un lecteur', () => {
    expect(offerInstall({ storeUrl: '', seenAt: null, editable: true })).toBe(false);
    expect(offerInstall({ storeUrl: '  ', seenAt: null, editable: true })).toBe(false);
    expect(offerInstall({ storeUrl: store, seenAt: null, editable: false })).toBe(false);
  });
});
