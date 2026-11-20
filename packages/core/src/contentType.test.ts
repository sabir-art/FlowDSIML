import { describe, expect, it } from 'vitest';
import { contentType } from './contentType';

describe('contentType (L48-G)', () => {
  it('sandbox selon kind, quelles que soient les étapes', () => {
    expect(contentType({ kind: 'sandbox' }, { total: 0, html: 0 })).toBe('sandbox');
  });
  it('html si plus de la moitié des étapes sont html', () => {
    expect(contentType({ kind: 'guided' }, { total: 3, html: 2 })).toBe('html');
    expect(contentType({ kind: 'guided' }, { total: 4, html: 2 })).toBe('captures');
  });
  it('captures par défaut (démo vide comprise)', () => {
    expect(contentType({ kind: 'guided' }, { total: 0, html: 0 })).toBe('captures');
    expect(contentType({}, { total: 2, html: 0 })).toBe('captures');
  });
});
