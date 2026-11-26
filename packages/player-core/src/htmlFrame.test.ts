import { describe, expect, it } from 'vitest';
import {
  FRAME_RUNTIME,
  FRAME_SANDBOX,
  buildSrcdoc,
  frameCsp,
  parseFromFrame,
  thumbSrcdoc,
} from './htmlFrame';

describe('htmlFrame', () => {
  it('le script de la page est du JavaScript valide', () => {
    expect(() => new Function(FRAME_RUNTIME)).not.toThrow();
    expect(FRAME_RUNTIME).not.toMatch(/innerHTML|insertAdjacentHTML|eval\(|new Function|document\.write/);
  });
  it('sandbox sans allow-same-origin', () => {
    expect(FRAME_SANDBOX).toBe('allow-scripts');
  });
  it('CSP stricte', () => {
    const csp = frameCsp("'sha256-abc'");
    for (const d of [
      "default-src 'none'",
      "script-src 'sha256-abc'",
      "form-action 'none'",
      "base-uri 'none'",
      "frame-src 'none'",
    ])
      expect(csp).toContain(d);
    expect(csp).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/);
  });
  it('srcdoc : CSP en tête, notre script seul, scripts de la page retirés', async () => {
    const doc = await buildSrcdoc(
      '<!doctype html><html><head><title>t</title><meta http-equiv="refresh" content="0"></head><body><p>x</p><script>alert(1)</script></body></html>',
    );
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<title>'));
    expect(doc).not.toContain('alert(1)');
    expect(doc).not.toContain('refresh');
    expect(doc.match(/<script>/g)).toHaveLength(1);
    expect(doc).toMatch(/<\/script><\/body>/);
    // Le script est inséré tel quel (aucun motif de remplacement interprété)
    expect(doc.slice(doc.indexOf('<script>') + 8, doc.lastIndexOf('</script>'))).toBe(FRAME_RUNTIME);
  });
  it('messages de la page : format strict', () => {
    expect(parseFromFrame({ fd: 1, t: 'go', step: '00000000-0000-0000-0000-000000000001' })).toEqual({
      fd: 1,
      t: 'go',
      step: '00000000-0000-0000-0000-000000000001',
    });
    expect(parseFromFrame({ fd: 1, t: 'go', step: 'javascript:x' })).toBeNull();
    // L49 §4 : lien externe, par l'id de l'opération (jamais une adresse venue de la page)
    expect(parseFromFrame({ fd: 1, t: 'ext', id: 'e1', url: 'https://evil.example' })).toEqual({
      fd: 1,
      t: 'ext',
      id: 'e1',
    });
    expect(parseFromFrame({ fd: 1, t: 'ext', id: 'https://evil.example' })).toBeNull();
    expect(parseFromFrame({ fd: 1, t: 'unlinked', ext: true })).toEqual({ fd: 1, t: 'unlinked', ext: true });
    expect(parseFromFrame({ fd: 1, t: 'unlinked', ext: 'x' })).toEqual({ fd: 1, t: 'unlinked' });
    // EXT-02 §3 : clic dans le vide et nombre de zones cliquables
    expect(parseFromFrame({ fd: 1, t: 'unlinked', empty: true })).toEqual({
      fd: 1,
      t: 'unlinked',
      empty: true,
    });
    expect(parseFromFrame({ fd: 1, t: 'zones', n: 3 })).toEqual({ fd: 1, t: 'zones', n: 3 });
    expect(parseFromFrame({ fd: 1, t: 'zones', n: -1 })).toBeNull();
    expect(parseFromFrame({ fd: 1, t: 'zones', n: '3' })).toBeNull();
    expect(parseFromFrame({ fd: 1, t: 'zones', n: 1.5 })).toBeNull();
    expect(parseFromFrame({ fd: 1, t: 'html', html: '<img onerror=x>' })).toBeNull();
    expect(parseFromFrame({ t: 'ready', h: 1 })).toBeNull();
    expect(
      parseFromFrame({
        fd: 1,
        t: 'select',
        el: { sel: 'b', short: 'b', trail: ['body'], rect: { x: 0, y: 0, w: 1, h: 1 }, text: 't', tag: 'b' },
      })?.t,
    ).toBe('select');
    expect(parseFromFrame({ fd: 1, t: 'select', el: { sel: 'b' } })).toBeNull();
    expect(parseFromFrame({ fd: 1, t: 'key', key: 'exec' })).toBeNull();
  });
  it('A8 guide : un sélecteur reçu n’est jamais évalué autrement que par querySelector', () => {
    // Borné à 500 caractères, cherché par querySelector sous try (un sélecteur invalide ou hostile
    // échoue sans rien exécuter ; cas réel vérifié dans e2e/guide-sandbox.e2e.cjs)
    expect(FRAME_RUNTIME).toContain('m.sel.slice(0, 500)');
    expect(FRAME_RUNTIME).toMatch(
      /function q\(sel\) \{ try \{ return document\.querySelector\(sel\); \} catch/,
    );
    expect(FRAME_RUNTIME).toMatch(
      /function unique\(sel\) \{ try \{ return document\.querySelectorAll\(sel\)\.length === 1; \} catch/,
    );
  });
  it('A8 guide : position de la zone visée et clic, format strict', () => {
    expect(parseFromFrame({ fd: 1, t: 'target', rect: { x: 10, y: 20, w: 30, h: 40 }, found: true })).toEqual(
      {
        fd: 1,
        t: 'target',
        rect: { x: 10, y: 20, w: 30, h: 40 },
        found: true,
      },
    );
    expect(
      parseFromFrame({ fd: 1, t: 'target', rect: { x: 'a', y: 0, w: 1, h: 1 }, found: true }),
    ).toBeNull();
    expect(parseFromFrame({ fd: 1, t: 'target', rect: { x: 0, y: 0, w: 1, h: 1 } })).toBeNull();
    expect(
      parseFromFrame({ fd: 1, t: 'target', rect: { x: Infinity, y: 0, w: 1, h: 1 }, found: false }),
    ).toBeNull();
    expect(parseFromFrame({ fd: 1, t: 'hit', step: 'x' })).toEqual({ fd: 1, t: 'hit' });
  });
  it('L25-07/08 : sélection multiple et graphique reconnu, format strict', () => {
    const el = { sel: 'b.value', short: 'b.value', bg: '#FFFFFF', color: '#111827' };
    expect(parseFromFrame({ fd: 1, t: 'multi', els: [el, el] })).toEqual({
      fd: 1,
      t: 'multi',
      els: [el, el],
    });
    expect(parseFromFrame({ fd: 1, t: 'multi', els: [{ ...el, bg: 'red' }] })).toBeNull();
    expect(parseFromFrame({ fd: 1, t: 'multi', els: Array(201).fill(el) })).toBeNull();
    const base = {
      sel: 'div.chart',
      short: 'div.chart',
      trail: ['body', 'div.chart'],
      rect: { x: 0, y: 0, w: 10, h: 10 },
      text: '18',
      tag: 'div',
      similar: 1,
      bg: '#FFFFFF',
      color: '#000000',
    };
    const chart = { sel: 'div.chart', type: 'bar', title: 'Rapports', rows: [{ label: 'juil.', value: 18 }] };
    const ok = parseFromFrame({ fd: 1, t: 'select', el: { ...base, chart } });
    expect(ok && ok.t === 'select' && ok.el?.chart).toEqual(chart);
    const bad = parseFromFrame({ fd: 1, t: 'select', el: { ...base, chart: { ...chart, type: 'pie' } } });
    expect(bad && bad.t === 'select' && bad.el?.chart).toBeNull();
  });
});

describe('vignette d’une page HTML (lot B)', () => {
  it('aucun script, CSP sans script en tête', () => {
    const doc = thumbSrcdoc(
      '<html><head><meta http-equiv="refresh" content="0"></head><body><script>alert(1)</script><h1>Page</h1></body></html>',
    );
    expect(doc).not.toMatch(/<script/i);
    expect(doc).not.toContain('refresh');
    expect(doc).toContain("script-src 'none'");
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<h1>'));
  });
});
