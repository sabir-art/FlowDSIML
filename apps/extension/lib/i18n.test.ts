import { describe, expect, it } from 'vitest';
import { stepsCaptured } from './i18n';

describe('extension i18n', () => {
  it('accorde le pluriel', () => {
    expect(stepsCaptured(1)).toMatch(/1 (étape capturée|step captured)$/);
    expect(stepsCaptured(3)).toMatch(/3 (étapes capturées|steps captured)$/);
    // 0 : singulier en français, pluriel en anglais
    expect(stepsCaptured(0)).toMatch(/0 (étape capturée|steps captured)$/);
    expect(stepsCaptured(2)).toMatch(/2 (étapes capturées|steps captured)$/);
  });
});
