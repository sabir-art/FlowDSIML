import { describe, expect, it } from 'vitest';
import {
  STEP_COUNT,
  TARGETS,
  addressOnly,
  hasLimit,
  popupAllowed,
  readTarget,
  writeTarget,
} from './snippets';

describe('snippets (L29-01/02)', () => {
  it('six outils dans l’ordre de la spec (Confluence ajouté en L35)', () => {
    expect([...TARGETS]).toEqual(['html', 'wordpress', 'sharepoint', 'moodle', 'notion', 'confluence']);
  });
  it('SharePoint, Notion et Confluence : adresse seule, pas de pop-up', () => {
    expect(TARGETS.filter(addressOnly)).toEqual(['sharepoint', 'notion', 'confluence']);
    expect(TARGETS.filter((t) => !popupAllowed(t))).toEqual(['sharepoint', 'notion', 'confluence']);
  });
  it('3 consignes au plus, une limite sauf pour HTML', () => {
    expect(Math.max(...Object.values(STEP_COUNT))).toBeLessThanOrEqual(3);
    expect(TARGETS.filter((t) => !hasLimit(t))).toEqual(['html']);
  });
  it('choix mémorisé par utilisateur, HTML par défaut', () => {
    expect(readTarget('u1')).toBe('html');
    writeTarget('u1', 'moodle');
    expect(readTarget('u1')).toBe('moodle');
    expect(readTarget('u2')).toBe('html');
  });
});
