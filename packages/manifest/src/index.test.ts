import { describe, expect, it } from 'vitest';
import {
  maskIntensity,
  maskPixelBlock,
  maskPreviewStyle,
  maskRadiusCss,
  maskSchema,
  maskTintColor,
  parseManifest,
  safeExternalUrl,
  trackBatchSchema,
} from './index';

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

describe('masque stylé (EXT-02 §6.2)', () => {
  it('garde le rendu d’origine d’une zone sans réglage', () => {
    const m = maskSchema.parse({ x: 0.1, y: 0.1, w: 0.2, h: 0.1 });
    expect(m.shape).toBe('rect');
    expect(m.tint).toBe('none');
    expect(m.intensity).toBeUndefined();
    expect(maskIntensity(m)).toBe(6);
    expect(maskIntensity({ style: 'pixels' })).toBe(12);
    expect(maskPixelBlock({ style: 'pixels' })).toBe(12);
  });
  it('borne l’intensité et ne laisse jamais un pavé sous 8 px', () => {
    expect(maskIntensity({ intensity: 40 })).toBe(24);
    expect(maskIntensity({ intensity: 0 })).toBe(2);
    expect(maskPixelBlock({ style: 'pixels', intensity: 2 })).toBe(8);
    expect(maskPixelBlock({ style: 'pixels', intensity: 24 })).toBe(30);
    expect(maskSchema.parse({ x: 0, y: 0, w: 1, h: 1, intensity: 99 }).intensity).toBeUndefined();
  });
  it('ne teinte jamais un aplat et ignore une teinte inconnue', () => {
    expect(maskTintColor({ style: 'blur', tint: 'plum' })).toBe('#a3195b');
    expect(maskTintColor({ style: 'solid', tint: 'plum' })).toBeNull();
    expect(maskTintColor({ style: 'blur', tint: 'rose' })).toBeNull();
    expect(maskSchema.parse({ x: 0, y: 0, w: 1, h: 1, tint: 'rose', shape: 'étoile' })).toMatchObject({
      tint: 'none',
      shape: 'rect',
    });
  });
  it('calcule l’arrondi de 12 px à l’échelle 1 280, plafonné à la moitié de la zone', () => {
    expect(maskRadiusCss({ shape: 'rect', w: 0.5, h: 0.5 }, 1.6)).toBeUndefined();
    expect(maskRadiusCss({ shape: 'ellipse', w: 0.5, h: 0.5 }, 1.6)).toBe('50%');
    // zone de 640 × 400 px sur une capture de 1 280 × 800 : 12 / 640 et 12 / 400
    expect(maskRadiusCss({ shape: 'rounded', w: 0.5, h: 0.5 }, 1.6)).toBe('1.9% / 3%');
    expect(maskRadiusCss({ shape: 'rounded', w: 0.01, h: 0.01 }, 1.6)).toBe('50% / 50%');
  });
  it('donne l’aperçu : flou réglé, teinte à 30 %, aplat sans filtre', () => {
    expect(maskPreviewStyle({ style: 'blur', intensity: 12, tint: 'ink', w: 0.5, h: 0.5 }, 1.6)).toEqual({
      borderRadius: undefined,
      backdropFilter: 'blur(12px)',
      background: '#1a1f264d',
    });
    expect(maskPreviewStyle({ style: 'solid', color: '#2A2F3A', tint: 'ink', w: 0.5, h: 0.5 }, 1.6)).toEqual({
      borderRadius: undefined,
      backdropFilter: 'none',
      background: '#2A2F3A',
    });
  });
});
