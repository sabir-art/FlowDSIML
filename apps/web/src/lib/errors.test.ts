import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('traduit les codes RPC connus', async () => {
    await i18n.changeLanguage('fr');
    expect(errorMessage(i18n.t, { message: 'PLAN_LIMIT:members' })).toContain('Limite de membres');
    expect(errorMessage(i18n.t, new Error('Invalid login credentials'))).toBe(
      'Email ou mot de passe incorrect. Vérifiez vos informations et réessayez.',
    );
  });
  it('a une traduction anglaise', async () => {
    await i18n.changeLanguage('en');
    expect(errorMessage(i18n.t, { message: 'INVITATION_EXPIRED' })).toBe('This invitation has expired.');
  });
  it('les deux langues ont les mêmes clés', async () => {
    const fr = (await import('../locales/fr.json')).default;
    const en = (await import('../locales/en.json')).default;
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });
});
