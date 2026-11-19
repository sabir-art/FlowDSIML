import { describe, expect, it } from 'vitest';
import { exportCsv, parseCsv, previewImport, splitForms } from './glossaryCsv';

describe('glossaire CSV', () => {
  it('lit les guillemets, les retours à la ligne et le point-virgule', () => {
    expect(parseCsv('a;"b ; c";"d ""e"""\r\nf;g;h')).toEqual([
      ['a', 'b ; c', 'd "e"'],
      ['f', 'g', 'h'],
    ]);
    expect(parseCsv('﻿x,"y\nz"')).toEqual([['x', 'y\nz']]);
  });

  it('aperçu : ajout, mise à jour, lignes ignorées avec motif', () => {
    const csv = [
      'nouveau,ancien,definition,formes',
      'Tableau de bord,synthèse mensuelle,Page d’accueil.,"tableaux de bord, TDB"',
      'dossier USAGER,fiche,Mis à jour.,',
      ',ancien,Sans terme.,',
      `Long,,${'x'.repeat(141)},`,
      'Tableau de bord,,Doublon dans le fichier.,',
      'Vide,,,',
    ].join('\n');
    const p = previewImport(csv, [{ term: 'Dossier usager' }]);
    expect(p.add.map((x) => x.term)).toEqual(['Tableau de bord']);
    expect(p.add[0]!.forms).toEqual(['tableaux de bord', 'TDB']);
    expect(p.update.map((x) => x.term)).toEqual(['dossier USAGER']);
    expect(p.skipped).toEqual([
      { line: 4, reason: 'termEmpty' },
      { line: 5, reason: 'defTooLong' },
      { line: 6, reason: 'duplicate' },
      { line: 7, reason: 'defEmpty' },
    ]);
  });

  it('limite de 500 termes', () => {
    const existing = Array.from({ length: 499 }, (_, i) => ({ term: `t${i}` }));
    const p = previewImport('A,,déf\nB,,déf', existing);
    expect(p.add.length).toBe(1);
    expect(p.skipped).toEqual([{ line: 2, reason: 'limit' }]);
  });

  it('export relisible par l’import, formules neutralisées', () => {
    const rows = [{ term: '=SOMME', old_term: null, definition: 'Une, définition', forms: ['a', 'b'] }];
    const p = previewImport(exportCsv(rows), []);
    expect(p.add).toEqual(rows);
  });

  it('formes : sans doublon, 10 au plus', () => {
    expect(splitForms('RDV, rdv, rendez-vous ,')).toEqual(['RDV', 'rendez-vous']);
    expect(splitForms(Array.from({ length: 12 }, (_, i) => `f${i}`).join(',')).length).toBe(10);
  });
});
