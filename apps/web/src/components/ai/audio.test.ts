import { describe, expect, it } from 'vitest';
import { estimateSeconds, languageName, withDefaults } from './AiAudio';

describe('voix de synthèse (L30-11)', () => {
  it('lit les variables avec leur valeur par défaut, sinon le repli', () => {
    const vars = [{ key: 'company', default_value: 'votre entreprise' }];
    expect(withDefaults('Bienvenue chez {{company}} !', vars)).toBe('Bienvenue chez votre entreprise !');
    expect(withDefaults('Bonjour {{ first_name | cher client }}', vars)).toBe('Bonjour cher client');
    expect(withDefaults('{{inconnue}}', vars)).toBe('');
  });
  it('estime la durée comme le serveur (14 caractères par seconde)', () => {
    expect(estimateSeconds('a'.repeat(140))).toBe(10);
    expect(estimateSeconds('a'.repeat(140), 'fast')).toBe(9);
    expect(estimateSeconds('a'.repeat(140), 'slow')).toBe(12);
    expect(estimateSeconds('x')).toBe(1);
    expect(estimateSeconds('a'.repeat(5000))).toBe(120);
  });
  it('nomme la langue détectée', () => {
    expect(languageName('fra', 'fr')).toBe('Français');
    expect(languageName('', 'fr')).toBe('');
  });
});
