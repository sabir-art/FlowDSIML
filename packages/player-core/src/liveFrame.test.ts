import { describe, expect, it } from 'vitest';
import { buildSrcdoc } from './htmlFrame';
import { LIVE_SHIM, buildLiveSrcdoc, liveCsp, wrapScript, type LivePage } from './liveFrame';

const page = (over: Partial<LivePage> = {}): LivePage => ({
  url: 'https://site.example/app/clients?b=2&a=1',
  html:
    '<!doctype html><html><head><title>T</title></head><body><h1>Page</h1>' +
    '<script data-fd-script="s1"></script><script data-fd-script="s2"></script>' +
    '<script>alert("non marqué")</script></body></html>',
  scripts: [
    { id: 's1', code: 'document.title = location.pathname;', keep: true },
    { id: 's2', code: 'console.log("tiers")', keep: false, source: 'tiers.example', category: 'third' },
  ],
  responses: [{ url: 'https://site.example/api/x', status: 200, type: 'application/json', body: '[]' }],
  ...over,
});

const cspOf = (doc: string) => /Content-Security-Policy" content="([^"]+)"/.exec(doc)![1]!;

describe('Sandbox v2 : lecture vivante (liveFrame)', () => {
  it('l’environnement factice est du JavaScript valide', () => {
    expect(() => new Function(LIVE_SHIM)).not.toThrow();
  });

  it('CSP : aucune sortie, aucun eval, aucune adresse de script', () => {
    const c = liveCsp(["'sha256-abc'"]);
    expect(c).toContain("default-src 'none'");
    expect(c).toContain("connect-src 'none'");
    expect(c).toContain("form-action 'none'");
    expect(c).toContain("frame-src 'none'");
    expect(c).toContain("worker-src 'none'");
    expect(c).toContain('img-src data:;');
    const script = /script-src ([^;]+)/.exec(c)![1]!;
    expect(script).toBe("'sha256-abc'");
    expect(c).not.toMatch(/unsafe-eval|https:|http:/);
  });

  it('scripts : le gardé s’exécute à sa place, le bloqué et le non marqué sont retirés', async () => {
    const doc = await buildLiveSrcdoc(page());
    expect(doc).toContain('with (window.__fdScope) {\ndocument.title = location.pathname;\n}');
    expect(doc).not.toContain('console.log("tiers")');
    expect(doc).not.toContain('non marqué');
    // Ordre : CSP, données, environnement, puis le reste du document ; script du cadre en fin de corps
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('id="fd-replay"'));
    expect(doc.indexOf('id="fd-replay"')).toBeLessThan(doc.indexOf('W.__fdLive = true'));
    expect(doc.lastIndexOf('</body>')).toBeGreaterThan(doc.indexOf('<h1>Page</h1>'));
  });

  it('CSP : une empreinte par script exécuté (environnement, cadre, gardé), rien d’autre', async () => {
    const doc = await buildLiveSrcdoc(page());
    const hashes = /script-src ([^;]+)/.exec(cspOf(doc))![1]!.split(' ');
    expect(hashes).toHaveLength(3);
    expect(hashes.every((h) => /^'sha256-[A-Za-z0-9+/=]+'$/.test(h))).toBe(true);
    // Rétablir le script bloqué ajoute son empreinte, sans recapture
    const s2 = page();
    s2.scripts[1]!.keep = true;
    const doc2 = await buildLiveSrcdoc(s2);
    expect(/script-src ([^;]+)/.exec(cspOf(doc2))![1]!.split(' ')).toHaveLength(4);
    expect(doc2).toContain('console.log("tiers")');
  });

  it('données de rejeu : « </script> » d’une réponse ne ferme pas la balise', async () => {
    const doc = await buildLiveSrcdoc(
      page({
        responses: [
          { url: 'https://site.example/a', status: 200, type: 'text/html', body: '</script><b>x</b>' },
        ],
      }),
    );
    const data = /id="fd-replay">([\s\S]*?)<\/script>/.exec(doc)![1]!;
    expect(data).not.toContain('</script');
    expect(JSON.parse(data).responses[0].body).toBe('</script><b>x</b>');
  });

  it('module : location virtuelle en constante ; « </script> » du code coupé', () => {
    expect(wrapScript({ id: 'm', code: 'x()', keep: true, module: true })).toBe(
      'const location = window.__fdLocation;\nx()',
    );
    expect(wrapScript({ id: 'c', code: 'a = "</script>"', keep: true })).not.toContain('</script>');
  });

  it('le mode inerte n’est pas touché', async () => {
    const inert = await buildSrcdoc(
      '<html><head></head><body><script>scriptDeLaPageInerte()</script></body></html>',
    );
    expect(inert).not.toContain('__fdLive = true');
    expect(inert).not.toContain('scriptDeLaPageInerte');
  });
});
