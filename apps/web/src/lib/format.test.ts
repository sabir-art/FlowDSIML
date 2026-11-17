import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { formatDate, formatNumber, formatPercent } from './format';

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
});
