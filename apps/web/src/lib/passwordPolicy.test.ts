import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASSWORD_POLICY, passwordRules } from './passwordPolicy';

describe('politique de mot de passe', () => {
  it('est la même que celle de Supabase Auth (supabase/config.toml)', () => {
    const toml = readFileSync(resolve(__dirname, '../../../../supabase/config.toml'), 'utf8');
    expect(/^minimum_password_length = (\d+)$/m.exec(toml)?.[1]).toBe(String(PASSWORD_POLICY.minLength));
    expect(/^password_requirements = "([^"]*)"$/m.exec(toml)?.[1]).toBe('lower_upper_letters_digits_symbols');
    expect(PASSWORD_POLICY).toMatchObject({ lower: true, upper: true, digit: true, symbol: true });
  });
  it('dit quelles règles un mot de passe respecte', () => {
    const state = (p: string) => Object.fromEntries(passwordRules(p).map((r) => [r.rule, r.ok]));
    const none = { length: false, lower: false, upper: false, digit: false, symbol: false };
    expect(state('')).toEqual(none);
    expect(state('abcdefgh')).toEqual({ ...none, length: true, lower: true });
    expect(state('1234567')).toEqual({ ...none, digit: true });
    expect(state('Acmedemo2026!')).toEqual({
      length: true,
      lower: true,
      upper: true,
      digit: true,
      symbol: true,
    });
    // Jeux de Supabase Auth : une lettre accentuée ne compte ni comme minuscule ni comme symbole
    expect(state('ÉÉÉÉÉÉÉÉ')).toEqual({ ...none, length: true });
  });
});
