import { describe, expect, it } from 'vitest';
import {
  applyUrlVariables,
  computedVariables,
  personalTitle,
  variablesFromForm,
  variablesFromSearch,
} from './variables';

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

describe('L46-bis : adresse et formulaire', () => {
  it('encode chaque valeur dans l’adresse', () => {
    const url = 'https://intranet.example/inscription?prenom={{first_name}}';
    expect(applyUrlVariables(url, { first_name: 'Camille' })).toBe(
      'https://intranet.example/inscription?prenom=Camille',
    );
    expect(applyUrlVariables(url, { first_name: 'Jean Ö' })).toBe(
      'https://intranet.example/inscription?prenom=Jean%20%C3%96',
    );
  });
  it('sans valeur ni repli : paramètre vide, lien valide ; repli encodé', () => {
    expect(applyUrlVariables('https://x.example/?p={{first_name}}', {})).toBe('https://x.example/?p=');
    expect(applyUrlVariables('https://x.example/?c={{company|A & B}}', {})).toBe(
      'https://x.example/?c=A%20%26%20B',
    );
  });
  it('formulaire : clés et alias du visiteur et de l’entreprise seulement', () => {
    expect(
      variablesFromForm({ first_name: ' Camille ', entreprise: 'Acme', email: 'a@example.com', other: 'x' }),
    ).toEqual({
      first_name: 'Camille',
      company: 'Acme',
    });
    expect(variablesFromForm({ prenom: '' })).toEqual({});
  });
});
