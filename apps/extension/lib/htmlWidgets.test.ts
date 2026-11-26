// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  WIDGET_ATTR,
  addedToBody,
  applyWidgets,
  hideWidget,
  thirdPartyScriptSites,
  thirdPartyWidgets,
} from './htmlWidgets';

const PAGE = 'https://app.exemple.test/tableau';
const VIEW = { width: 1280, height: 800 };
const source = `<!doctype html><html><head><script src="https://chat.tiers.test/chat.js"></script></head>
<body><header id="haut"></header><main id="app"></main><div class="toast"></div></body></html>`;

function live(body: string, scripts = '<script src="https://chat.tiers.test/chat.js"></script>') {
  document.head.innerHTML = scripts;
  document.body.innerHTML = body;
  return document;
}
// Style lu dans l'attribut data-look (jsdom ne calcule pas la mise en page)
const look = (el: Element) => {
  const [position = 'static', w = '0', h = '0'] = (el.getAttribute('data-look') ?? '').split(' ');
  return { position, box: { width: Number(w), height: Number(h) }, visible: true };
};

describe('ajouts de scripts tiers (gêne lot B)', () => {
  it('apparie les enfants de <body> dans l’ordre : seuls les ajouts restent', () => {
    const d = live(
      '<header id="haut"></header><main id="app"></main><div class="toast"></div><button id="chat"></button>',
    );
    const src = new DOMParser().parseFromString(source, 'text/html');
    expect(addedToBody([...d.body.children], [...src.body.children]).map((e) => e.id)).toEqual(['chat']);
  });

  it('retient un bouton flottant ajouté, pas le contenu ni l’en-tête fixe de la source', () => {
    const d = live(
      '<header id="haut" data-look="fixed 1280 64"></header><main id="app"></main><div class="toast"></div>' +
        '<button id="chat" data-look="fixed 180 48">Discuter avec nous</button>' +
        '<div id="voile" data-look="fixed 1280 800"></div><div id="libre" data-look="static 300 300"></div>',
    );
    expect(thirdPartyWidgets(d, PAGE, source, VIEW, look).map((e) => e.id)).toEqual(['chat']);
  });

  it('un enveloppe dont le premier enfant flotte (bandeau de cookies) compte aussi', () => {
    const d = live(
      '<header id="haut"></header><main id="app"></main><div class="toast"></div>' +
        '<div id="cookies"><div data-look="fixed 1280 120">Cookies</div></div>',
    );
    expect(thirdPartyWidgets(d, PAGE, source, VIEW, look).map((e) => e.id)).toEqual(['cookies']);
  });

  it('un autre port du même hôte compte comme un autre site', () => {
    const d = live(
      '',
      '<script src="http://localhost:54411/chat.js"></script><script src="/app.js"></script>',
    );
    expect(thirdPartyScriptSites(d, 'http://localhost:54410/tiers')).toEqual(['localhost:54411']);
  });

  it('sans script d’un autre site, rien n’est retiré', () => {
    const d = live(
      '<header id="haut"></header><main id="app"></main><button id="chat" data-look="fixed 180 48"></button>',
      '<script src="/app.js"></script>',
    );
    expect(thirdPartyWidgets(d, PAGE, source, VIEW, look)).toEqual([]);
  });

  it('à l’envoi : retiré sauf s’il est gardé, et plus aucune marque', () => {
    document.body.innerHTML = '<p>Page</p><button id="a" style="color:red">A</button><div id="b">B</div>';
    hideWidget(document.getElementById('a')!, 'w1');
    hideWidget(document.getElementById('b')!, 'w2');
    const html = `<!doctype html>\n${document.documentElement.outerHTML}`;
    const out = applyWidgets(html, ['w1']);
    expect(out).toContain('<button id="a" style="color:red">A</button>');
    expect(out).not.toContain('id="b"');
    expect(out).not.toContain(WIDGET_ATTR);
    expect(out).not.toContain('display:none');
    expect(applyWidgets(html, [])).not.toMatch(/id="a"|id="b"/);
  });
});
