import { describe, expect, it } from 'vitest';
import { decodeCsv, detectSeparator, parseCsv, personalColumn, readDataset } from './dataset';

const enc = (s: string) => new TextEncoder().encode(s);

describe('L25-09 : jeu de données CSV', () => {
  it('séparateur point-virgule et UTF-8 détectés, guillemets gérés', () => {
    const r = readDataset(
      enc('\uFEFFequipe;rapports;vues\r\nAntenne Nord;"1 248";86\r\n"Antenne ""Sud""";932;64\r\n'),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.separator).toBe(';');
    expect(r.data.encoding).toBe('UTF-8');
    expect(r.data.columns).toEqual(['equipe', 'rapports', 'vues']);
    expect(r.data.rows[1]).toEqual(['Antenne "Sud"', '932', '64']);
  });
  it('Windows-1252 et virgule', () => {
    const bytes = new Uint8Array([
      ...enc('ville,taux\n'),
      0x45,
      0x76,
      0x72,
      0x79,
      ...enc(',12\n'),
      0x53,
      0xe8,
      0x74,
      0x65,
      ...enc(',8\n'),
    ]);
    const d = decodeCsv(bytes);
    expect(d.encoding).toBe('Windows-1252');
    expect(detectSeparator(d.text)).toBe(',');
    expect(parseCsv(d.text, ',')[2]).toEqual(['Sète', '8']);
  });
  it('colonne personnelle refusée (e-mail, téléphone, identifiant, noms)', () => {
    expect(personalColumn('contact', ['alice@acme.example'])).toBe(true);
    expect(personalColumn('ligne', ['06 12 34 56 78'])).toBe(true);
    expect(personalColumn('Identifiant', ['A-12'])).toBe(true);
    expect(personalColumn('responsable', ['Camille DURAND', 'Léa MARTIN'])).toBe(true);
    expect(personalColumn('equipe', ['Antenne Nord', 'Antenne Sud'])).toBe(false);
    const r = readDataset(enc('equipe;email\nNord;nord@acme.example\n'));
    expect(r).toEqual({ ok: false, error: { code: 'personal', column: 'email' } });
  });
  it('limites : 500 Ko, 1 000 lignes, 20 colonnes, en-têtes', () => {
    expect(readDataset(new Uint8Array(500 * 1024 + 1))).toEqual({ ok: false, error: { code: 'tooBig' } });
    expect(readDataset(enc('a\n' + '1\n'.repeat(1001)))).toEqual({
      ok: false,
      error: { code: 'tooManyRows' },
    });
    expect(
      readDataset(
        enc(
          Array(21)
            .fill('c')
            .map((c, i) => c + i)
            .join(';') + '\n1\n',
        ),
      ),
    ).toEqual({
      ok: false,
      error: { code: 'tooManyColumns' },
    });
    expect(readDataset(enc('a;a\n1;2\n'))).toEqual({ ok: false, error: { code: 'duplicate', column: 'a' } });
    expect(readDataset(enc('a\n'))).toEqual({ ok: false, error: { code: 'empty' } });
  });
});
