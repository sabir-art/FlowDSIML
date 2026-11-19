import { describe, expect, it } from 'vitest';
import { FRAME_RUNTIME, FRAME_SANDBOX, buildSrcdoc, frameCsp, parseFromFrame } from './htmlFrame';

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
});
