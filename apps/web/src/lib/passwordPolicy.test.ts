import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASSWORD_POLICY, passwordRules } from './passwordPolicy';

describe('politique de mot de passe', () => {
  it('est la même que celle de Supabase Auth (supabase/config.toml)', () => {
    const toml = readFileSync(resolve(__dirname, '../../../../supabase/config.toml'), 'utf8');
    expect(/^minimum_password_length = (\d+)$/m.exec(toml)?.[1]).toBe(String(PASSWORD_POLICY.minLength));
    expect(/^password_requirements = "([^"]*)"$/m.exec(toml)?.[1]).toBe('letters_digits');
    expect(PASSWORD_POLICY.letter && PASSWORD_POLICY.digit).toBe(true);
  });
  it('dit quelles règles un mot de passe respecte', () => {
    const state = (p: string) => Object.fromEntries(passwordRules(p).map((r) => [r.rule, r.ok]));
    expect(state('')).toEqual({ length: false, letter: false, digit: false });
    expect(state('abcdefgh')).toEqual({ length: true, letter: true, digit: false });
    expect(state('1234567')).toEqual({ length: false, letter: false, digit: true });
    expect(state('éléphant9')).toEqual({ length: true, letter: true, digit: true });
  });
});
