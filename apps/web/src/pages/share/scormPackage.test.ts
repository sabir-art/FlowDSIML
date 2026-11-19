import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
const { imsManifest, indexHtml, packageJs, scormFileName } = await import('./scormPackage');

describe('paquet SCORM', () => {
  it('nom de fichier', () => {
    expect(scormFileName('Créer une fiche usager', '1.2')).toBe('creer-une-fiche-usager-scorm12.zip');
    expect(scormFileName('', '2004')).toBe('demo-scorm2004.zip');
  });

  it('imsmanifest 1.2 : schéma, SCO, seuil, fichiers, échappement', () => {
    const x = imsManifest('1.2', {
      id: 'd1',
      title: 'Fiche <usager> & co',
      files: ['index.html', 'assets/a.webp'],
      mastery: 70,
    });
    expect(x).toContain('<schemaversion>1.2</schemaversion>');
    expect(x).toContain('adlcp:scormtype="sco" href="index.html"');
    expect(x).toContain('<adlcp:masteryscore>70</adlcp:masteryscore>');
    expect(x).toContain('<file href="assets/a.webp"/>');
    expect(x).toContain('Fiche &lt;usager&gt; &amp; co');
    expect(x).not.toContain('<usager>');
  });

  it('imsmanifest 1.2 sans quiz : pas de seuil', () => {
    expect(imsManifest('1.2', { id: 'd', title: 'T', files: [], mastery: null })).not.toContain(
      'masteryscore',
    );
  });

  it('imsmanifest 2004 4e édition', () => {
    const x = imsManifest('2004', { id: 'd1', title: 'T', files: ['index.html'], mastery: 70 });
    expect(x).toContain('<schemaversion>2004 4th Edition</schemaversion>');
    expect(x).toContain('adlcp:scormType="sco"');
    expect(x).toContain('http://www.imsglobal.org/xsd/imscp_v1p1');
  });

  it('index.html : langue et titre nettoyé', () => {
    const h = indexHtml('A <b>"x"</b>', 'en');
    expect(h).toContain('<html lang="en">');
    expect(h).toContain('<title>A bx/b</title>');
    expect(h.indexOf('package.js')).toBeLessThan(h.indexOf('tutoclick.js'));
  });

  it('package.js : statistiques désactivées par défaut', () => {
    const m = { demoId: 'd' } as never;
    expect(packageJs(m, { version: '1.2', stats: false }, 'https://x.example/track')).toContain(
      '"stats":null',
    );
    expect(packageJs(m, { version: '2004', stats: true }, 'https://x.example/track')).toContain(
      '"stats":{"trackUrl":"https://x.example/track"}',
    );
  });
});
