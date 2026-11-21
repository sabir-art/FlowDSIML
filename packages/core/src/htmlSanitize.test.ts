// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  activeRemoved,
  htmlSecurityStatus,
  isExternalLink,
  sanitizeCss,
  sanitizeDom,
  siteOf,
  sumHtmlSecurity,
} from './htmlSanitize';

describe('sanitizeDom', () => {
  it('retire scripts, cadres, gestionnaires, URL dangereuses et saisies', () => {
    const doc = document.implementation.createHTMLDocument('t');
    doc.documentElement.innerHTML = `<head><base href="https://evil.example/"><meta http-equiv="refresh" content="0;url=https://evil.example"><link rel="stylesheet" href="x.css"><script>alert(1)</script></head>
      <body onload="x()"><img src="a.png" onerror="x()"><a href="javascript:alert(1)">a</a><a href="/ok">b</a>
      <iframe src="https://tiers.example"></iframe><object data="x"></object><embed src="x">
      <form action="/send" method="post"><input name="n" value="Camille"><input type="password" value="secret"><input type="submit" value="Envoyer"><textarea>notes</textarea>
      <select><option selected>Paris</option></select></form>
      <div style="background:url(javascript:alert(1));width:expression(alert(1))">x</div>
      <img src="data:text/html,<script>alert(1)</script>"><img src="data:image/webp;base64,AAAA">
      <svg><a href="javascript:x()"><set attributeName="href" to="javascript:x()"/></a></svg><noscript><img src=x></noscript></body>`;
    sanitizeDom(doc.documentElement);
    const html = doc.documentElement.outerHTML;
    expect(html).not.toMatch(/<script|<iframe|<object|<embed|<base|<link|<noscript|http-equiv/i);
    expect(html).not.toMatch(/onload|onerror|javascript:|expression\(|Camille|secret|notes|data:text\/html/i);
    expect(html).toContain('href="/ok"');
    expect(html).toContain('value="Envoyer"');
    expect(html).toContain('data:image/webp;base64,AAAA');
    expect(doc.querySelector('form')!.hasAttribute('action')).toBe(false);
    expect(doc.querySelector('option')!.hasAttribute('selected')).toBe(false);
  });
  it('CSS sans @import ni exécution', () => {
    expect(
      sanitizeCss('@import url(x.css); a{behavior:url(x.htc);color:red} b{background:url("javascript:x")}'),
    ).toBe(' a{;color:red} b{background:url()}');
  });
});

// L49 §3 : page de test commune avec supabase/functions/html-ingest/lib.test.ts (mêmes chiffres des deux côtés)
const SECURITY_PAGE = `<html><head><base href="https://evil.example/"><meta http-equiv="refresh" content="0"><link rel="stylesheet" href="x.css">
<script>alert(1)</script><style>@import url(x.css); .a{width:expression(alert(1))}</style></head>
<body onload="x()"><img src="a.png" onerror="x()" onclick="y()"><a href="javascript:alert(1)">a</a>
<a href="https://app.example.com/ok">interne</a><a href="https://aide.app.example.com/doc">sous-domaine</a>
<a href="https://docs.tiers.example/guide">externe 1</a><a href="http://autre.example/">externe 2</a><a href="mailto:x@example.com">m</a>
<iframe src="https://tiers.example" onload="z()"></iframe><object data="x"><param name="a"></object><embed src="x">
<form action="/send" method="post"><input name="n" value="Camille"><button formaction="/x">b</button></form><form><input></form>
<div style="background:url(javascript:alert(1))">x</div><img src="data:text/html,x"><iframe srcdoc="<p>x</p>"></iframe>
<svg><a href="javascript:x()"><set attributeName="href" to="javascript:x()"/></a></svg><noscript><script>x()</script></noscript></body></html>`;
const SECURITY_PAGE_URL = 'https://app.example.com/dossiers';
// script, noscript, 2 liens javascript: ; 3 on* (pas celui de l'iframe retirée) ; 2 iframes, object, embed ;
// 1 formulaire avec action ; 2 liens vers un autre domaine ; base, meta, link, @import, expression(),
// url(javascript:), data:text/html, formaction, <set href>
const SECURITY_EXPECTED = {
  scripts: 4,
  handlers: 3,
  frames: 4,
  forms: 1,
  externalLinks: 2,
  piiReplaced: 0,
  other: 9,
};

describe('L49 : compteurs du rapport', () => {
  it('compte ce qui est retiré, une fois par élément', () => {
    const doc = document.implementation.createHTMLDocument('t');
    doc.documentElement.innerHTML = SECURITY_PAGE.replace(/^<html>|<\/html>$/g, '');
    expect(sanitizeDom(doc.documentElement, SECURITY_PAGE_URL)).toEqual(SECURITY_EXPECTED);
  });
  it('sans adresse de page, aucun lien externe', () => {
    const doc = document.implementation.createHTMLDocument('t');
    doc.body.innerHTML = '<a href="https://tiers.example/">x</a>';
    expect(sanitizeDom(doc.documentElement).externalLinks).toBe(0);
  });
});

describe('L49 : statut du rapport', () => {
  it('page sûre, éléments retirés, vérification partielle', () => {
    expect(htmlSecurityStatus({ externalLinks: 3, piiReplaced: 2 })).toBe('safe');
    expect(htmlSecurityStatus({ forms: 1 })).toBe('removed');
    expect(htmlSecurityStatus({ dangerousLinks: 1 })).toBe('removed');
    expect(htmlSecurityStatus({ safeBrowsing: 'unavailable' })).toBe('partial');
    expect(htmlSecurityStatus({ scripts: 1, safeBrowsing: 'unavailable' })).toBe('removed');
  });
  it('somme de plusieurs pages', () => {
    const s = sumHtmlSecurity([
      { scripts: 2, handlers: 1 },
      { other: 3, dangerousLinks: 1 },
    ]);
    expect(activeRemoved(s)).toBe(6);
    expect(s.dangerousLinks).toBe(1);
  });
});

describe('L49 : domaine de rattachement (suffixes publics)', () => {
  it('gouv.fr : deux ministères sont deux sites ; sous-domaine du même site interne', () => {
    expect(siteOf('travail-emploi.gouv.fr')).toBe('travail-emploi.gouv.fr');
    expect(isExternalLink('https://www.service-public.gouv.fr/', 'https://travail-emploi.gouv.fr/a')).toBe(
      true,
    );
    expect(isExternalLink('https://aide.travail-emploi.gouv.fr/x', 'https://travail-emploi.gouv.fr/a')).toBe(
      false,
    );
    expect(isExternalLink('https://autre.co.uk/', 'https://acme.co.uk/')).toBe(true);
    expect(isExternalLink('https://docs.globex.example/', 'https://app.acme.example/')).toBe(true);
  });
});
