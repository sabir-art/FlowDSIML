import { describe, expect, it } from 'vitest';
import { versionAtLeast } from './extensionLink';

describe('version de l’extension (EXT-02 §8)', () => {
  it('compare les trois nombres, pas les chaînes', () => {
    expect(versionAtLeast('0.3.0', '0.3.0')).toBe(true);
    expect(versionAtLeast('0.10.0', '0.3.0')).toBe(true);
    expect(versionAtLeast('1.0.0', '0.3.0')).toBe(true);
    expect(versionAtLeast('0.2.9', '0.3.0')).toBe(false);
    expect(versionAtLeast('0.2', '0.3.0')).toBe(false);
  });
});
