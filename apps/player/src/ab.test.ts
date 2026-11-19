import { describe, expect, it } from 'vitest';
import { parseManifest } from '@flowdsiml/manifest';
import { abVariant, applyAb, resolveAssets } from './logic';

const base = {
  schemaVersion: 1,
  demoId: 'd',
  versionId: 'v',
  workspaceId: 'w',
  title: 'T',
  publishedAt: 'x',
  theme: {},
};

describe('L17 / L18 lecteur', () => {
  it('résout la capture « Avant » publiée', () => {
    const m = parseManifest({
      ...base,
      steps: [
        {
          id: 'a',
          kind: 'before_after',
          image: { url: 'assets/a.webp', width: 10, height: 10 },
          beforeAfter: { before: { url: 'assets/a-b.webp', width: 10, height: 10 } },
        },
      ],
    });
    const r = resolveAssets(m, 'https://s/published/d/');
    expect(r.steps[0]?.beforeAfter?.before.url).toBe('https://s/published/d/assets/a-b.webp');
  });

  it('variante tirée une fois puis mémorisée', () => {
    const mem = new Map<string, string>();
    const store = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    expect(abVariant('t1', 50, store, () => 0.2)).toBe('B');
    expect(abVariant('t1', 50, store, () => 0.9)).toBe('B');
    expect(mem.get('tc_ab_t1')).toBe('B');
    expect(abVariant('t2', 10, store, () => 0.5)).toBe('A');
    expect(abVariant('t3', 50, null, () => 0.7)).toBe('A');
  });

  it('variante B : la bulle testée prend le texte de B', () => {
    const m = parseManifest({
      ...base,
      steps: [
        {
          id: 's',
          kind: 'image',
          image: { url: 'a', width: 1, height: 1 },
          hotspots: [{ id: 'h', x: 0, y: 0, w: 0.1, h: 0.1, title: 'A', body: 'texte A', placement: 'auto' }],
        },
      ],
      ab: { testId: 't', hotspotId: 'h', splitB: 50, b: { title: 'B', body: 'texte B', cta: null } },
    });
    expect(applyAb(m, 'A').steps[0]?.hotspots[0]?.title).toBe('A');
    expect(applyAb(m, 'B').steps[0]?.hotspots[0]).toMatchObject({ title: 'B', body: 'texte B' });
  });
});
