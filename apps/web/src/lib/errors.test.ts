import { describe, expect, it } from 'vitest';
import i18n, { setLocale } from '../i18n';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('traduit les codes RPC connus', async () => {
    await i18n.changeLanguage('fr');
    expect(errorMessage(i18n.t, { message: 'PLAN_LIMIT:members' })).toContain('Limite de membres');
    expect(errorMessage(i18n.t, new Error('Invalid login credentials'))).toBe(
      'E-mail ou mot de passe incorrect. Vérifiez vos informations et réessayez.',
    );
  });
  it('nomme la règle du mot de passe que le serveur a refusée', async () => {
    await i18n.changeLanguage('fr');
    // Messages de Supabase Auth : seules les règles en échec sont citées
    expect(errorMessage(i18n.t, { message: 'Password should be at least 8 characters.' })).toBe(
      'Le mot de passe doit contenir au moins 8\u00a0caractères.',
    );
    expect(
      errorMessage(i18n.t, {
        code: 'weak_password',
        message:
          'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.',
      }),
    ).toBe('Il doit contenir au moins une lettre et un chiffre.');
    expect(
      errorMessage(i18n.t, {
        message:
          'Password should be at least 10 characters. Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};\':"|<>?,./`~.',
      }),
    ).toBe(
      'Le mot de passe doit contenir au moins 10\u00a0caractères. Il doit contenir au moins une minuscule, une majuscule, un chiffre et un symbole.',
    );
    expect(
      errorMessage(i18n.t, {
        message: 'Password is known to be weak and easy to guess, please choose a different one.',
      }),
    ).toBe('Ce mot de passe figure dans des fuites connues\u202f: choisissez-en un autre.');
    expect(errorMessage(i18n.t, { code: 'weak_password', message: 'weak' })).toBe(
      'Mot de passe refusé\u202f: choisissez-en un plus robuste.',
    );
  });
  it('a une traduction anglaise', async () => {
    await setLocale('en');
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
