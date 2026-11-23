// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { PII_ATTR, restorePii, type PiiOriginal } from './htmlKeep';

const BLUR = 'filter:blur(6px)!important';
const page = (body: string) => `<!doctype html>\n<html><head></head><body>${body}</body></html>`;

describe('restorePii (EXT-02 §2.3 : garder une donnée remplacée)', () => {
  const originals: Record<string, PiiOriginal> = {
    p1: { masked: 'Xxxxx Xxxxxx', original: 'Alice Martin', node: 0, start: 9 },
    p2: { masked: 'Xxxxx Xxxxxx', original: 'Bruno Durand', node: 0, start: 25 },
    p3: { texts: ['alice@exemple.test'] },
  };
  const html = page(
    `<p ${PII_ATTR}="p1 p2" data-fd-blurred="" style="color:red;${BLUR}">Suivi de Xxxxx Xxxxxx et Xxxxx Xxxxxx.</p>` +
      `<span ${PII_ATTR}="p3" data-fd-blurred="" style=";${BLUR}">xxxxx@xxxxxxx.xxxx</span>`,
  );

  it('sans donnée gardée, rien n’est rétabli et les marques de travail sont retirées', () => {
    const out = restorePii(html, originals, []);
    expect(out.restored).toBe(0);
    expect(out.html).not.toContain(PII_ATTR);
    expect(out.html).toContain('Suivi de Xxxxx Xxxxxx et Xxxxx Xxxxxx.');
    expect(restorePii(html, undefined, ['p1']).html).not.toContain('Alice');
  });

  it('rétablit seulement la donnée gardée, à sa place, et laisse le flou tant qu’une autre reste', () => {
    const out = restorePii(html, originals, ['p2']);
    expect(out.restored).toBe(1);
    expect(out.html).toContain('Suivi de Xxxxx Xxxxxx et Bruno Durand.');
    expect(out.html).toMatch(/<p data-fd-blurred="" style="color:red;filter:blur/);
    expect(out.html).toContain('xxxxx@xxxxxxx.xxxx');
    expect(out.html).not.toContain(PII_ATTR);
  });

  it('toutes les données d’un élément gardées : texte d’origine et flou retiré', () => {
    const out = restorePii(html, originals, ['p1', 'p2', 'p3']);
    expect(out.restored).toBe(3);
    expect(out.html).toContain('<p style="color:red">Suivi de Alice Martin et Bruno Durand.</p>');
    expect(out.html).toContain('<span>alice@exemple.test</span>');
  });

  it('ne touche à rien si la valeur masquée n’est plus à sa place', () => {
    const moved = html.replace('Suivi de', 'Suivi complet de');
    const out = restorePii(moved, originals, ['p1']);
    expect(out.restored).toBe(0);
    expect(out.html).not.toContain('Alice Martin');
  });
});
