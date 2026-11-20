import { describe, expect, it } from 'vitest';
import { personalTitle, computedVariables, variablesFromSearch } from './variables';

describe('L25-13 : titre de la page personnalisée', () => {
  it('variables remplacées, variable vide retirée avec ses mots de liaison', () => {
    expect(personalTitle('Votre démo, {{company}}', { company: 'Acme' }, 'Démo')).toBe('Votre démo, Acme');
    expect(personalTitle('Votre démo, {{company}}', {}, 'Démo')).toBe('Votre démo');
    expect(personalTitle('Un parcours pour {{company}} ', { company: '' }, 'Démo')).toBe('Un parcours');
    expect(personalTitle('{{first_name}}', {}, 'Créer un rapport')).toBe('Créer un rapport');
    expect(personalTitle('Aide {{x}}', {}, 'Démo')).toBe('Aide');
  });
});

describe('L46 : variables prédéfinies', () => {
  it('alias français dans l’adresse, variables calculées jamais lues', () => {
    expect(variablesFromSearch('?prenom=Camille&entreprise=Acme&today=x', [])).toEqual({
      first_name: 'Camille',
      company: 'Acme',
    });
    expect(variablesFromSearch('?first_name=Lea&v_last_name=Martin', [])).toMatchObject({
      first_name: 'Lea',
      last_name: 'Martin',
    });
  });
  it('valeurs calculées : titre, nombre d’étapes, date dans la langue', () => {
    const v = computedVariables(
      { title: 'Créer un rapport', stepCount: 7 },
      'fr-FR',
      new Date('2026-11-20T10:00:00Z'),
    );
    expect(v).toEqual({ demo_title: 'Créer un rapport', step_count: '7', today: '20 novembre 2026' });
  });
});
