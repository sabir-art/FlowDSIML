import { describe, expect, it } from 'vitest';
import { cohorts, exportLinks, IMPORT_MAX, linkFromRow, previewImport, TEMPLATE } from './linksCsv';

describe('previewImport', () => {
  it('colonnes reconnues sans tenir compte des accents ni de la casse, séparateur « ; » ou « , »', () => {
    const p = previewImport('Prénom;NOM;E-mail\nCamille;Exemple;Camille@Nord.example\n', new Set());
    expect(p.missing).toEqual([]);
    expect(p.rows).toEqual([
      {
        line: 2,
        firstName: 'Camille',
        lastName: 'Exemple',
        email: 'camille@nord.example',
        cohort: '',
        errors: [],
      },
    ]);
    expect(previewImport('first name,email\nSami,sami@nord.example', new Set()).rows[0]?.firstName).toBe(
      'Sami',
    );
  });
  it('erreurs par ligne : nom manquant, e-mail invalide, doublon du fichier, lien existant', () => {
    const csv = [
      'prénom;nom;e-mail',
      ';;vide@nord.example',
      'Alex;;pas-un-email',
      'Léa;Martin;lea@nord.example',
      'Léa;Martin;LEA@nord.example',
      'Paul;Robert;paul@nord.example',
    ].join('\n');
    const p = previewImport(csv, new Set(['paul@nord.example']));
    expect(p.rows.map((r) => [r.line, r.errors])).toEqual([
      [2, ['name']],
      [3, ['email']],
      [4, []],
      [5, ['duplicate']],
      [6, ['exists']],
    ]);
  });
  it('groupe : colonne du fichier, sinon groupe choisi pour tout l’import ; 80 caractères au plus', () => {
    const p = previewImport(
      `prénom;e-mail;groupe\nA;a@x.example;Session 1\nB;b@x.example;\nC;c@x.example;${'x'.repeat(81)}`,
      new Set(),
      ' Session 2 ',
    );
    expect(p.rows.map((r) => r.cohort.slice(0, 9))).toEqual(['Session 1', 'Session 2', 'xxxxxxxxx']);
    expect(p.rows[2]?.errors).toEqual(['cohort']);
  });
  it('colonnes manquantes signalées, lignes vides ignorées, limite de lignes', () => {
    expect(previewImport('nom;téléphone\nA;01', new Set()).missing).toEqual(['email']);
    expect(previewImport('e-mail\na@x.example', new Set()).missing).toEqual(['name']);
    expect(previewImport('prénom;e-mail\n\n;\nA;a@x.example\n', new Set()).rows).toHaveLength(1);
    const many = [
      'prénom;e-mail',
      ...Array.from({ length: IMPORT_MAX + 3 }, (_, i) => `P${i};p${i}@x.example`),
    ];
    const p = previewImport(many.join('\n'), new Set());
    expect(p.rows).toHaveLength(IMPORT_MAX);
    expect(p.truncated).toBe(3);
  });
  it('le modèle téléchargeable se relit sans erreur', () => {
    const p = previewImport(TEMPLATE, new Set());
    expect(p.missing).toEqual([]);
    expect(p.rows[0]?.errors).toEqual([]);
    expect(p.rows[0]?.cohort).toBe('Session du 12 novembre');
  });
});

describe('linkFromRow, exportLinks, cohorts', () => {
  it('nom et variables du lien', () => {
    const [r] = previewImport('prénom;nom;e-mail;groupe\nCamille;Exemple;c@x.example;S1', new Set()).rows;
    expect(linkFromRow(r!)).toEqual({
      name: 'Camille Exemple',
      variables: { email: 'c@x.example', first_name: 'Camille', last_name: 'Exemple' },
      cohort: 'S1',
    });
  });
  it('export : colonne du lien du centre seulement si au moins un lien en a un', () => {
    const L = {
      name: 'Nom',
      email: 'E-mail',
      cohort: 'Groupe',
      center: 'Lien du centre',
      demo: 'Lien de la démo',
    };
    const base = {
      name: 'Camille Exemple',
      email: 'c@x.example',
      cohort: 'S1',
      demo: 'https://d.example/#/l/t1',
    };
    expect(exportLinks([{ ...base, center: 'https://d.example/#/c/ml?l=t1' }], L).split('\r\n')).toEqual([
      'Nom;E-mail;Groupe;Lien du centre;Lien de la démo',
      'Camille Exemple;c@x.example;S1;https://d.example/#/c/ml?l=t1;https://d.example/#/l/t1',
    ]);
    expect(exportLinks([{ ...base, center: null }], L).split('\r\n')[0]).toBe(
      'Nom;E-mail;Groupe;Lien de la démo',
    );
  });
  it('groupes existants triés, sans doublon ni vide', () => {
    expect(cohorts(['Session 2', '', null, 'Session 1', 'Session 2 '])).toEqual(['Session 1', 'Session 2']);
  });
});
