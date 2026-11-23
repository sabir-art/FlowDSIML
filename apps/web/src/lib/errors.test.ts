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
  describe('mot de passe refusé par Supabase Auth', () => {
    const SETS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789';
    const msg = async (err: unknown, password?: string) => {
      await i18n.changeLanguage('fr');
      return errorMessage(i18n.t, err, password === undefined ? undefined : { password });
    };
    it('même mot de passe que l’actuel : ce n’est pas un mot de passe trop faible', async () => {
      // Cas du client (23/11) : 14 caractères valides, mais identiques à l'actuel
      const text = 'Choisissez un mot de passe différent de l’actuel.';
      expect(await msg({ code: 'same_password', message: 'x' })).toBe(text);
      expect(await msg({ message: 'New password should be different from the old password.' })).toBe(text);
    });
    it('trop court : la longueur donnée par le serveur, sinon celle de la politique', async () => {
      expect(await msg({ message: 'Password should be at least 10 characters.' })).toBe(
        'Utilisez au moins 10\u00a0caractères.',
      );
      expect(await msg({ code: 'weak_password', message: 'x', reasons: ['length'] })).toBe(
        'Utilisez au moins 8\u00a0caractères.',
      );
      expect(await msg({ code: 'weak_password', message: 'x', weak_password: { reasons: ['length'] } })).toBe(
        'Utilisez au moins 8\u00a0caractères.',
      );
    });
    it('caractères exigés : les catégories citées par le serveur', async () => {
      expect(await msg({ message: `Password should contain at least one character of each: ${SETS}.` })).toBe(
        'Ajoutez au moins une lettre et un chiffre.',
      );
      expect(
        await msg({
          message:
            'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};\':"|<>?,./`~.',
        }),
      ).toBe(
        'Ajoutez au moins une minuscule, une majuscule, un chiffre et un caractère spécial (par ex. ! ? # @).',
      );
      // Sans détail du serveur : la politique de l'app (lettres et chiffres)
      expect(await msg({ code: 'weak_password', message: 'x', reasons: ['characters'] })).toBe(
        'Ajoutez au moins une lettre et un chiffre.',
      );
    });
    it('caractères exigés : seulement ce qui manque au mot de passe saisi', async () => {
      const err = { message: `Password should contain at least one character of each: ${SETS}.` };
      expect(await msg(err, 'motdepassefictif')).toBe('Ajoutez au moins un chiffre.');
      expect(await msg(err, '1234567890')).toBe('Ajoutez au moins une lettre.');
    });
    it('plusieurs règles : une phrase par règle, dans l’ordre', async () => {
      expect(
        await msg(
          {
            code: 'weak_password',
            message: `Password should be at least 8 characters. Password should contain at least one character of each: ${SETS}.`,
            reasons: ['length', 'characters'],
          },
          'abc',
        ),
      ).toBe('Utilisez au moins 8\u00a0caractères. Ajoutez au moins un chiffre.');
    });
    it('mot de passe connu dans des fuites', async () => {
      const text = 'Ce mot de passe est trop courant. Choisissez-en un autre.';
      expect(await msg({ code: 'weak_password', message: 'x', reasons: ['pwned'] })).toBe(text);
      expect(
        await msg({
          message: 'Password is known to be weak and easy to guess, please choose a different one.',
        }),
      ).toBe(text);
    });
    it('refus sans précision : message général, jamais « 8 caractères minimum »', async () => {
      expect(await msg({ code: 'weak_password', message: 'weak' })).toBe(
        'Mot de passe refusé\u202f: choisissez-en un plus robuste.',
      );
    });
    it('une autre erreur n’est pas prise pour une erreur de mot de passe', async () => {
      expect(await msg(new Error('Invalid login credentials'))).toBe(
        'E-mail ou mot de passe incorrect. Vérifiez vos informations et réessayez.',
      );
    });
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
