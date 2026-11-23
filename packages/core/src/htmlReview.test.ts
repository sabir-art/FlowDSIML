// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  allowedFrame,
  classifyRemoved,
  collectRemoved,
  countByGroup,
  piiItem,
  registerHtmlClassifier,
} from './htmlReview';

const PAGE = 'https://app.acme.example/clients';
function page(body: string, head = '') {
  const doc = document.implementation.createHTMLDocument('t');
  doc.documentElement.innerHTML = `<head>${head}</head><body>${body}</body>`;
  return doc.documentElement;
}

describe('classement des éléments retirés (EXT-02 §2)', () => {
  it('range les scripts : de la page, tiers, de suivi', () => {
    const root = page(
      '',
      `<script>window.x = 1</script>
       <script src="/assets/app.4f2a.js"></script>
       <script src="https://cdn.tiers.example/lib.js"></script>
       <script src="https://www.googletagmanager.com/gtag/js?id=G-FICTIF"></script>
       <script>window.dataLayer = []; function gtag(){dataLayer.push(arguments)} gtag('js', new Date())</script>`,
    );
    const items = collectRemoved(root, PAGE);
    expect(items.map((i) => [i.group, i.reason, i.keepable])).toEqual([
      ['pageScripts', 'scriptInline', false],
      ['pageScripts', 'scriptSameSite', false],
      ['pageScripts', 'scriptThirdParty', false],
      ['trackingScripts', 'scriptTracking', false],
      ['trackingScripts', 'scriptTracking', false],
    ]);
    expect(items[1]).toMatchObject({ name: 'app.4f2a.js', source: 'acme.example' });
    expect(items[2]).toMatchObject({ name: 'lib.js', source: 'tiers.example' });
    expect(items[0]).toMatchObject({ name: '', source: '' });
  });

  it('ne permet de garder un cadre que pour un fournisseur de la liste blanche, en https', () => {
    expect(allowedFrame('https://www.youtube.com/embed/abc')).toBe('frameVideo');
    expect(allowedFrame('https://www.youtube-nocookie.com/embed/abc')).toBe('frameVideo');
    expect(allowedFrame('https://player.vimeo.com/video/1')).toBe('frameVideo');
    expect(allowedFrame('https://www.loom.com/embed/abc')).toBe('frameVideo');
    expect(allowedFrame('https://www.openstreetmap.org/export/embed.html?bbox=1')).toBe('frameMap');
    expect(allowedFrame('https://www.google.com/maps/embed?pb=1')).toBe('frameMap');
    // Même fournisseur, autre page ; http ; domaine qui imite ; autre site
    expect(allowedFrame('https://www.youtube.com/watch?v=abc')).toBeNull();
    expect(allowedFrame('http://www.youtube.com/embed/abc')).toBeNull();
    expect(allowedFrame('https://youtube.com.tiers.example/embed/abc')).toBeNull();
    expect(allowedFrame('https://tiers.example/embed/abc')).toBeNull();
    const root = page(
      `<iframe src="https://www.youtube.com/embed/abc" title="Présentation"></iframe>
       <iframe src="https://tiers.example/widget"></iframe>
       <object data="https://www.youtube.com/embed/abc"></object>`,
    );
    expect(collectRemoved(root, PAGE).map((i) => [i.reason, i.keepable, i.name])).toEqual([
      ['frameVideo', true, 'Présentation'],
      ['frameThirdParty', false, 'tiers.example/widget'],
      ['frameThirdParty', false, 'www.youtube.com/embed/abc'],
    ]);
  });

  it('liste les formulaires actifs et les liens externes, pas les liens internes', () => {
    const root = page(
      `<form action="/recherche" aria-label="Recherche"><input name="q"></form>
       <form><input name="sans-envoi"></form>
       <a href="/clients/1">Fiche</a>
       <a href="https://aide.acme.example/guide">Aide</a>
       <a href="https://autre.example/doc">Documentation</a>
       <a href="mailto:contact@acme.example">Écrire</a>`,
    );
    const items = collectRemoved(root, PAGE);
    expect(items.map((i) => [i.group, i.name, i.source, i.keepable])).toEqual([
      ['forms', 'Recherche', 'acme.example', false],
      ['externalLinks', 'Documentation', 'autre.example', true],
    ]);
  });

  it('compte par groupe, données personnelles comprises, sans jamais porter la valeur réelle', () => {
    const items = [
      ...collectRemoved(page('<a href="https://autre.example/">x</a>', '<script>1</script>'), PAGE),
      piiItem(0, 'Xxxxxxx XXXXXX'),
    ];
    expect(countByGroup(items)).toEqual({
      pageScripts: 1,
      trackingScripts: 0,
      frames: 0,
      forms: 0,
      pii: 1,
      externalLinks: 1,
    });
    expect(items.at(-1)).toMatchObject({ id: 'p1', group: 'pii', keepable: true, name: 'Xxxxxxx XXXXXX' });
  });

  it('laisse un classeur enregistré décider avant les règles par défaut', () => {
    const el = page('', '<script src="https://cdn.tiers.example/douteux.js"></script>').querySelector(
      'script',
    )!;
    expect(classifyRemoved(el, PAGE)?.group).toBe('pageScripts');
    const off = registerHtmlClassifier((e) =>
      e.getAttribute('src')?.includes('douteux')
        ? { group: 'trackingScripts', reason: 'scriptTracking', keepable: false }
        : null,
    );
    expect(classifyRemoved(el, PAGE)?.group).toBe('trackingScripts');
    off();
    expect(classifyRemoved(el, PAGE)?.group).toBe('pageScripts');
  });

  it('lien externe : sélecteur et adresse fournis par l’appelant ; donnée : type gardé', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<a id="cg" href="https://legal.example.com/cg">Conditions</a><script src="/a.js"></script>';
    const a = root.querySelector('a')!;
    const items = collectRemoved(root, PAGE, (el) =>
      el === a ? { sel: '#cg', href: 'https://legal.example.com/cg' } : undefined,
    );
    const link = items.find((i) => i.group === 'externalLinks')!;
    expect([link.sel, link.href]).toEqual(['#cg', 'https://legal.example.com/cg']);
    expect(items.find((i) => i.group === 'pageScripts')!.sel).toBeUndefined();
    expect(piiItem(2, 'j••••@••••.fr', 'email')).toMatchObject({
      id: 'p3',
      piiType: 'email',
      keepable: true,
    });
    expect('piiType' in piiItem(0, 'Xxxx')).toBe(false);
  });
});
