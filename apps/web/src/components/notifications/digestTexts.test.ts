import { describe, expect, it } from 'vitest';
import fr from '../../locales/fr.json';
import { FR } from '../../../../../supabase/functions/notify-email/texts';

/** E-mails P2 : la fonction notify-email garde une copie des textes ; elle doit rester celle de l'app. */
describe('textes du résumé par e-mail', () => {
  it('identiques à fr.json', () => {
    for (const [path, text] of Object.entries(FR)) {
      const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], fr);
      expect(value, path).toBe(text);
    }
  });
});
