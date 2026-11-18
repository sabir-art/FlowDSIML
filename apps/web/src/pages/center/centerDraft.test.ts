import { describe, expect, it } from 'vitest';
import { centerUrl, defaultSlug, pendingChanges, publishable, sanitizeSvg } from './centerDraft';

describe('réglages du centre', () => {
  it('adresse proposée et adresse publique', () => {
    expect(defaultSlug('Mission Locale Exemple')).toBe('mission-locale-exemple');
    expect(defaultSlug('É')).toBe('centre-e');
    expect(centerUrl('https://lecteur.example/', 'ml')).toBe('https://lecteur.example/#/c/ml');
  });

  it('publication : au moins une formation visible avec un module publié', () => {
    const paths = [
      {
        id: 'a',
        title: 'A',
        ordered: false,
        modules: 2,
        published: 0,
        protectedCount: 0,
        expiredCount: 0,
        tags: [],
      },
      {
        id: 'b',
        title: 'B',
        ordered: false,
        modules: 1,
        published: 1,
        protectedCount: 0,
        expiredCount: 0,
        tags: [],
      },
    ];
    expect(
      publishable(
        {
          paths: [
            { id: 'a', visible: true },
            { id: 'b', visible: false },
          ],
        },
        paths,
      ),
    ).toBe(false);
    expect(publishable({ paths: [{ id: 'b', visible: true }] }, paths)).toBe(true);
  });

  it('modifications non publiées comptées par réglage', () => {
    expect(pendingChanges({ title: 'A', style: 'dark' }, { title: 'A', style: 'workspace' })).toBe(1);
    expect(pendingChanges({ title: 'A', intro: 'x' }, { title: 'B' })).toBe(2);
    expect(
      pendingChanges({ paths: [{ id: 'a', visible: true }] }, { paths: [{ id: 'a', visible: true }] }),
    ).toBe(0);
  });

  it('SVG nettoyé : scripts, événements et liens externes retirés', () => {
    const out = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><a href="javascript:x"><rect width="10" height="10" onclick="x()"/></a><foreignObject><div/></foreignObject></svg>',
    )!;
    expect(out).not.toMatch(/script|onload|onclick|javascript|foreignObject/i);
    expect(out).toMatch(/<rect/);
    expect(sanitizeSvg('<html><body>pas un svg</body></html>')).toBeNull();
  });
});
