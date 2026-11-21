import { describe, expect, it } from 'vitest';
import { proposedColor } from './TagsSettings';

describe('L52 §2.1 : couleur proposée', () => {
  it('première des 8 pas encore utilisée', () => {
    expect(proposedColor([])).toBe('blue');
    expect(proposedColor([{ color: 'blue' }, { color: 'orange' }])).toBe('green');
  });
  it('sinon la moins utilisée (ordre de la palette à égalité)', () => {
    const all = ['blue', 'green', 'orange', 'raspberry', 'plum', 'slate', 'teal', 'violet'].map((color) => ({
      color,
    }));
    expect(proposedColor([...all, { color: 'blue' }, { color: 'green' }])).toBe('orange');
    expect(proposedColor(all)).toBe('blue');
  });
});
