import { describe, expect, it } from 'vitest';
import { parseManifest, safeExternalUrl, trackBatchSchema } from './index';

const base = {
  schemaVersion: 1,
  demoId: 'd',
  versionId: 'v',
  workspaceId: 'w',
  title: 'Démo',
  publishedAt: '2026-11-17T00:00:00Z',
  theme: {},
  steps: [{ id: 's1', kind: 'image', image: { url: 'a.webp', width: 1280, height: 800 } }],
};

describe('manifest', () => {
  it('applique les valeurs par défaut', () => {
    const m = parseManifest(base);
    expect(m.theme.primary).toBe('#A3195B');
    expect(m.steps[0]?.hotspots).toEqual([]);
    expect(m.locale).toBe('fr');
  });

  it('refuse une version de schéma inconnue', () => {
    expect(() => parseManifest({ ...base, schemaVersion: 2 })).toThrow();
  });

  it('refuse un hotspot hors cadre', () => {
    const bad = structuredClone(base) as typeof base & { steps: Array<Record<string, unknown>> };
    bad.steps[0]!.hotspots = [{ id: 'h', x: 1.5, y: 0, w: 0.1, h: 0.1 }];
    expect(() => parseManifest(bad)).toThrow();
  });

  it('valide un lot d’événements', () => {
    const r = trackBatchSchema.safeParse({
      demoId: '0193a5c0-0000-7000-8000-000000000001',
      versionId: '0193a5c0-0000-7000-8000-000000000002',
      visitorId: 'visitor-123',
      sessionId: 'session-123',
      events: [{ type: 'demo_view' }],
    });
    expect(r.success).toBe(true);
  });
});

describe('adresses externes', () => {
  const hs = (action: unknown) => ({
    ...base,
    steps: [{ ...base.steps[0], hotspots: [{ id: 'h1', x: 0.1, y: 0.1, w: 0.1, h: 0.1, action }] }],
  });

  it('safeExternalUrl : https seulement, http pour localhost', () => {
    expect(safeExternalUrl('https://acme.example/a?b=1')).toBe('https://acme.example/a?b=1');
    expect(safeExternalUrl('http://localhost:5173/x')).toBe('http://localhost:5173/x');
    expect(safeExternalUrl('http://127.0.0.1:5174/')).toBe('http://127.0.0.1:5174/');
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'java\nscript:alert(1)',
      'data:text/html,<p>x</p>',
      'vbscript:x',
      'file:///etc/hosts',
      'http://acme.example/',
      'http://localhost.acme.example/',
      '//acme.example',
      'acme.example',
      '',
      null,
      42,
    ])
      expect(safeExternalUrl(bad), String(bad)).toBeNull();
  });

  it('hotspot : une adresse https est gardée', () => {
    const m = parseManifest(hs({ type: 'url', url: 'https://acme.example/tarifs' }));
    expect(m.steps[0]!.hotspots[0]!.action).toEqual({
      type: 'url',
      url: 'https://acme.example/tarifs',
      newTab: true,
    });
  });

  it('hotspot : une adresse refusée (lien ancien) devient « aucune action », la démo reste lisible', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'http://acme.example/'])
      expect(parseManifest(hs({ type: 'url', url, newTab: false })).steps[0]!.hotspots[0]!.action).toEqual({
        type: 'none',
      });
  });

  it('bouton d’action : adresse refusée, le bouton est retiré ; adresse https, il est gardé', () => {
    const withCta = (url: string) => ({
      ...base,
      steps: [{ ...base.steps[0], cta: { label: 'Voir', url } }],
    });
    expect(parseManifest(withCta('javascript:alert(1)')).steps[0]!.cta).toBeNull();
    expect(parseManifest(withCta('https://acme.example/')).steps[0]!.cta).toEqual({
      label: 'Voir',
      url: 'https://acme.example/',
    });
  });
});
