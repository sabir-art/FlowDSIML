import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { formatDate, formatNumber, formatPercent, formatRelative } from './format';

describe('format', () => {
  it('formate selon la langue', async () => {
    await i18n.changeLanguage('fr');
    expect(formatDate('2026-11-17T10:00:00Z')).toBe('17 nov. 2026');
    expect(formatNumber(12345)).toMatch(/12\s345/);
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
