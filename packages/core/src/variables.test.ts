import { describe, expect, it } from 'vitest';
import { personalTitle } from './variables';

describe('L25-13 : titre de la page personnalisée', () => {
  it('variables remplacées, variable vide retirée avec ses mots de liaison', () => {
    expect(personalTitle('Votre démo, {{company}}', { company: 'Acme' }, 'Démo')).toBe('Votre démo, Acme');
    expect(personalTitle('Votre démo, {{company}}', {}, 'Démo')).toBe('Votre démo');
    expect(personalTitle('Un parcours pour {{company}} ', { company: '' }, 'Démo')).toBe('Un parcours');
    expect(personalTitle('{{first_name}}', {}, 'Créer un rapport')).toBe('Créer un rapport');
    expect(personalTitle('Aide {{x}}', {}, 'Démo')).toBe('Aide');
  });
});
