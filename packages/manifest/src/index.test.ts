import { describe, expect, it } from 'vitest';
import { parseManifest, trackBatchSchema } from './index';

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
    expect(m.theme.primary).toBe('#0E7C71');
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
