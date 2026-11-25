import { describe, expect, it, vi } from 'vitest';
import { parseManifest } from '@flowdsiml/manifest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
const { offlineAssets, offlineFileName, offlineIndexHtml, offlinePackageJs, offlineReadme, stripForOffline } =
  await import('./offlinePackage');

const step = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: 'image',
  title: `Étape ${id}`,
  image: { url: `steps/${id}.webp`, width: 1280, height: 800 },
  ...extra,
});
const manifest = (steps: unknown[], extra: Record<string, unknown> = {}) =>
  parseManifest({
    schemaVersion: 1,
    demoId: '0b5c1f0e-0000-4000-8000-000000000001',
    versionId: 'v-1',
    workspaceId: 'ws-1',
    title: 'Démo CRM',
    publishedAt: '2026-11-24T10:00:00Z',
    theme: {},
    steps,
    ...extra,
  });

describe('archive hors ligne', () => {
  it('nom de fichier : titre, « hors-ligne » et date du jour', () => {
    expect(offlineFileName('Démo CRM', new Date(2026, 10, 24))).toBe('demo-crm-hors-ligne-2026-11-24.zip');
    expect(offlineFileName('', new Date(2026, 0, 5))).toBe('demo-hors-ligne-2026-01-05.zip');
  });

  it('ressources : captures, voix et vidéo, sans doublon ni adresse externe', () => {
    const m = manifest([
      step('a', { voice: { src: 'voice/a.mp3', durationMs: 1200, transcript: 'Bienvenue.' } }),
      step('b', { image: { url: 'steps/a.webp', width: 1280, height: 800 } }),
      step('c', { image: { url: 'https://ailleurs.example/x.webp', width: 10, height: 10 } }),
      step('d', { image: { url: '../secret.webp', width: 10, height: 10 } }),
    ]);
    const assets = offlineAssets(m);
    expect(assets.map((a) => a.path)).toEqual(['steps/a.webp', 'voice/a.mp3']);
    // La première étape qui utilise la ressource est gardée (cause affichée si elle est illisible)
    expect(assets[0]!.step).toEqual({ n: 1, id: 'a' });
  });

  it('v1 sans lead : formulaires retirés, aucune étape ne les attend', () => {
    const m = manifest([step('a', { gateFormId: 'f1' })], {
      forms: [{ id: 'f1', title: 'Contact', fields: [{ key: 'email', label: 'E-mail', type: 'email' }] }],
    });
    const off = stripForOffline(m);
    expect(off.forms).toEqual([]);
    expect(off.steps.every((s) => s.gateFormId === null)).toBe(true);
    // Le manifeste d'origine n'est pas modifié
    expect(m.steps[0]!.gateFormId).toBe('f1');
  });

  it('configuration du lecteur : ni LMS ni suivi, et aucune balise fermante injectable', () => {
    const js = offlinePackageJs(manifest([step('a', { title: '</script><script>alert(1)</script>' })]));
    expect(js.startsWith('window.TUTOCLICK_PACKAGE = ')).toBe(true);
    expect(js).not.toContain('</script>');
    const cfg = JSON.parse(js.slice('window.TUTOCLICK_PACKAGE = '.length).replace(/;\n$/, ''));
    expect(cfg.offline).toBe(true);
    expect(cfg.scorm).toBeNull();
    expect(cfg.stats).toBeNull();
    expect(cfg.manifest.steps[0].title).toBe('</script><script>alert(1)</script>');
  });

  it('index.html : scripts classiques, titre nettoyé, aucune adresse externe', () => {
    const html = offlineIndexHtml('Fiche <usager> & "co"', 'fr');
    expect(html).toContain('<title>Fiche usager  co</title>');
    expect(html).toContain('<script src="package.js"></script>');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('type="module"');
    expect(offlineIndexHtml('T', 'en')).toContain('<html lang="en">');
  });

  it('LISEZ-MOI : ouverture, accès et limites', () => {
    const txt = offlineReadme('Démo CRM', 'fr');
    expect(txt).toContain('Double-cliquez sur index.html');
    expect(txt).toContain('Toute personne qui a ce fichier voit la démo, sans mot de passe.');
    expect(txt).toContain('pas de formulaire de lead');
    expect(offlineReadme('CRM demo', 'en')).toContain('Double-click index.html');
  });
});
