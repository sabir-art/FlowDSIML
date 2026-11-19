import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { formatDate, formatNumber, formatPercent, formatRelative } from './format';

describe('format', () => {
  it('formate selon la langue', async () => {
    await i18n.changeLanguage('fr');
    expect(formatDate('2026-11-17T10:00:00Z')).toBe('17 nov. 2026');
    expect(formatNumber(12345)).toMatch(/12\s345/);
    // L26-06 : séparateur des milliers visible (espace insécable, pas d'espace fine)
    if (formatNumber(1000).length > 4) expect(formatNumber(3127)).not.toContain('\u202f');
    expect(formatPercent(0.44)).toMatch(/44\s%/);
    await i18n.changeLanguage('en');
    expect(formatDate('2026-11-17T10:00:00Z')).toBe('17 Nov 2026');
  });
  it('ne produit jamais « Invalid Date »', () => {
    expect(formatDate('pas une date')).toBe('—');
    expect(formatDate(null)).toBe('—');
  });
  it('formate les dates relatives', async () => {
    await i18n.changeLanguage('fr');
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(formatRelative('2026-11-17T10:00:00Z', now)).toBe('il y a 2 heures');
    expect(formatRelative('2026-11-16T12:00:00Z', now)).toBe('hier');
    expect(formatRelative('2026-11-17T11:59:50Z', now)).toBe('maintenant');
    expect(formatRelative('2026-09-01T12:00:00Z', now)).toBe('1 sept. 2026');
  });
});

describe('formatRelativeShort', () => {
  it('format abrégé de la maquette', async () => {
    const { formatRelativeShort } = await import('./format');
    const i18n = (await import('../i18n')).default;
    await i18n.changeLanguage('fr');
    const now = Date.parse('2026-11-17T12:00:00Z');
    const ago = (s: number) => new Date(now - s * 1000).toISOString();
    expect(formatRelativeShort(ago(2 * 3600), now)).toBe('il y a 2 h');
    expect(formatRelativeShort(ago(30 * 3600), now)).toBe('hier');
    expect(formatRelativeShort(ago(3 * 86400), now)).toBe('il y a 3 j');
    expect(formatRelativeShort('2026-11-05T10:00:00Z', now)).toBe('5 nov.');
  });
});
