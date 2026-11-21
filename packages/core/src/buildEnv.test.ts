import { describe, expect, it } from 'vitest';
import { assertBuildEnv } from './buildEnv';

describe('assertBuildEnv', () => {
  it('accepte des variables renseignées', () => {
    expect(() => assertBuildEnv({ A: 'x', B: 'y' }, ['A', 'B'])).not.toThrow();
  });
  it('nomme les variables manquantes ou vides', () => {
    expect(() => assertBuildEnv({ A: ' ', C: 'z' }, ['A', 'B', 'C'])).toThrow(
      /manquante\(s\) : A, B\. .*\.env\.production\.local/,
    );
  });
});
