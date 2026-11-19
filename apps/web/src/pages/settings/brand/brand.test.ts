import { describe, expect, it } from 'vitest';
import { copyName, logoError, nameTaken } from './brand';

describe('logo', () => {
  it('formats et taille du bucket branding', () => {
    expect(logoError({ type: 'image/png', size: 1000 })).toBeNull();
    expect(logoError({ type: 'image/svg+xml', size: 2 * 1024 * 1024 })).toBeNull();
    expect(logoError({ type: 'image/gif', size: 10 })).toBe('format');
    expect(logoError({ type: 'image/webp', size: 2 * 1024 * 1024 + 1 })).toBe('size');
  });
});

describe('noms de style', () => {
  it('casse et espaces ignorés', () => expect(nameTaken(' acme ', ['Acme'])).toBe(true));
  it('copie numérotée, 40 caractères au plus', () => {
    expect(copyName('Acme', [], 'copie')).toBe('Acme (copie)');
    expect(copyName('Acme', ['Acme (copie)'], 'copie')).toBe('Acme (copie 2)');
    const long = 'x'.repeat(40);
    expect(copyName(long, [], 'copie')).toHaveLength(40);
  });
});
