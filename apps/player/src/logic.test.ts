import { describe, expect, it } from 'vitest';
import { parseManifest } from '@flowdsiml/manifest';
import { embedAllowed, nextIndex, parseRoute, resolveAssets, resolvePlacement } from './logic';

const m = parseManifest({
  schemaVersion: 1,
  demoId: 'd',
  versionId: 'v',
  workspaceId: 'w',
  title: 'T',
  publishedAt: 'x',
  theme: {},
  steps: [
    { id: 'a', kind: 'image', image: { url: 'assets/a.webp', width: 10, height: 10 } },
    { id: 'b', kind: 'text' },
    { id: 'c', kind: 'image', image: { url: 'https://cdn/x.webp', width: 10, height: 10 } },
  ],
});

describe('player logic', () => {
  it('place l’info-bulle automatiquement', () => {
    expect(resolvePlacement('auto', { x: 0.1, y: 0.1, w: 0.1, h: 0.1 })).toBe('bottom');
    expect(resolvePlacement('auto', { x: 0.1, y: 0.8, w: 0.1, h: 0.1 })).toBe('top');
    expect(resolvePlacement('left', { x: 0.1, y: 0.8, w: 0.1, h: 0.1 })).toBe('left');
  });
  it('contrôle l’origine d’embed', () => {
    expect(embedAllowed([], true, null)).toBe(true);
    expect(embedAllowed(['acme.example'], false, null)).toBe(true);
    expect(embedAllowed(['acme.example'], true, 'https://acme.example')).toBe(true);
    expect(embedAllowed(['*.acme.example'], true, 'https://www.acme.example')).toBe(true);
    expect(embedAllowed(['acme.example'], true, 'https://evil.example')).toBe(false);
    expect(embedAllowed(['acme.example'], true, null)).toBe(false);
  });
  it('résout les assets relatifs uniquement', () => {
    const r = resolveAssets(m, 'https://s/published/d/');
    expect(r.steps[0]?.image?.url).toBe('https://s/published/d/assets/a.webp');
    expect(r.steps[2]?.image?.url).toBe('https://cdn/x.webp');
  });
  it('calcule l’étape suivante', () => {
    expect(nextIndex(m, 0, { type: 'next' })).toBe(1);
    expect(nextIndex(m, 2, { type: 'next' })).toBeNull();
    expect(nextIndex(m, 0, { type: 'goto', stepId: 'c' })).toBe(2);
  });
  it('parse les routes', () => {
    expect(parseRoute('#/d/0193a5c0-0000-7000-8000-000000000001?company=Acme')).toEqual({
      kind: 'demo',
      id: '0193a5c0-0000-7000-8000-000000000001',
      search: '?company=Acme',
    });
    expect(parseRoute('#/l/abcdef123456')).toEqual({ kind: 'link', token: 'abcdef123456', search: '?' });
    expect(parseRoute('#/d/not-a-uuid')).toEqual({ kind: 'none' });
    expect(parseRoute('#/preview')).toEqual({ kind: 'preview' });
  });
});
