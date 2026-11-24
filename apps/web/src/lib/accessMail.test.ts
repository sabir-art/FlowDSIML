import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TTL_SECONDS } from '../../../../supabase/functions/access-email/mail';

/**
 * §8 : l'e-mail d'accès annonce la durée de validité du lien. Elle doit être celle qu'Auth applique
 * (supabase/config.toml, [auth.email] otp_expiry), jamais un texte figé qui dérive.
 */
describe('e-mail d’accès : durée de validité', () => {
  it('égale à otp_expiry de la configuration d’Auth', () => {
    // Les tests tournent depuis apps/web
    const toml = readFileSync(resolve(process.cwd(), '../../supabase/config.toml'), 'utf8');
    const m = /^otp_expiry\s*=\s*(\d+)/m.exec(toml);
    expect(m, 'otp_expiry présent dans config.toml').not.toBeNull();
    expect(DEFAULT_TTL_SECONDS).toBe(Number(m![1]));
  });
});
