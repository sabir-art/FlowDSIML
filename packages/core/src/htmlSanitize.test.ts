// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeCss, sanitizeDom } from './htmlSanitize';

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
