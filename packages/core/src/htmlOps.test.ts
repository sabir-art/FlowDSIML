// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  applyHtmlOps,
  neutralText,
  selectorTrail,
  shortSelector,
  stableSelector,
  undoHtmlOp,
  validHtmlOps,
  type HtmlOp,
} from './htmlOps';

const page = () => {
  document.body.innerHTML = `
    <main>
      <div class="kpi css-1x2y3z"><span>Dossiers</span><b class="value">312</b></div>
      <div class="kpi"><span>Rendez-vous</span><b class="value">48</b></div>
      <nav id="menu"><a href="/a">Accueil</a><a href="/b">Agenda</a></nav>
      <p class="owner">Camille Martin</p>
      <img class="logo" src="a.png" srcset="a2.png 2x" alt="Acme">
      <button data-testid="save">Enregistrer</button>
    </main>`;
  return document;
};

describe('htmlOps', () => {
  it('sélecteur stable, unique, sans classe générée', () => {
    const d = page();
    const b = d.querySelectorAll('b.value')[0]!;
    const sel = stableSelector(b);
    expect(sel).not.toMatch(/css-/);
    expect(d.querySelectorAll(sel)).toHaveLength(1);
    expect(d.querySelector(sel)).toBe(b);
    expect(stableSelector(d.querySelector('nav a:nth-of-type(2)')!)).toMatch(/^#menu > a:nth-of-type\(2\)$/);
    expect(stableSelector(d.querySelector('button')!)).toBe('button[data-testid="save"]');
  });

  it('fil du sélecteur et sélecteur court', () => {
    const d = page();
    const b = d.querySelector('b.value')!;
    expect(selectorTrail(b).map((t) => t.label)).toEqual(['body', 'main', 'div.kpi', 'b.value']);
    expect(shortSelector(b)).toBe('b.value');
  });

  it('texte neutre : casse et chiffres, jamais l’original', () => {
    expect(neutralText('Camille Martin, 06 12')).toBe('Xxxxxxx Xxxxxx, 00 00');
    expect(neutralText('Élodie')).toBe('Xxxxxx');
  });

  it('applique texte (variables au lecteur), flou, masquage, lien, image ; notFound', () => {
    const d = page();
    const ops: HtmlOp[] = [
      {
        id: 'a',
        sel: stableSelector(d.querySelector('b.value')!),
        op: 'text',
        value: '1 248 {{company|Acme}}',
        before: '312',
        scope: 'step',
      },
      { id: 'b', sel: 'p.owner', op: 'blur', scope: 'step' },
      { id: 'c', sel: '#menu > a:nth-of-type(2)', op: 'hide', scope: 'step' },
      { id: 'd', sel: 'button[data-testid="save"]', op: 'link', value: 'step-2', scope: 'step' },
      { id: 'e', sel: 'img.logo', op: 'image', value: 'ws/demo/x.webp', scope: 'step' },
      { id: 'f', sel: 'div.disparu', op: 'text', value: 'x', scope: 'step' },
    ];
    expect(validHtmlOps(ops)).toBe(true);
    const r = applyHtmlOps(d, ops, {
      mode: 'player',
      variables: { company: 'Globex' },
      imageUrl: (p) => `https://cdn.example/${p}`,
    });
    expect(d.querySelector('b.value')!.textContent).toBe('1 248 Globex');
    expect(d.querySelector('p.owner')!.textContent).toBe('Xxxxxxx Xxxxxx');
    expect((d.querySelector('#menu a:nth-of-type(2)') as HTMLElement).style.display).toBe('none');
    expect(d.querySelector('#menu a:nth-of-type(2)')!.getAttribute('aria-hidden')).toBe('true');
    expect(r.links.map((l) => l.step)).toEqual(['step-2']);
    expect(d.querySelector('img')!.getAttribute('src')).toBe('https://cdn.example/ws/demo/x.webp');
    expect(d.querySelector('img')!.hasAttribute('srcset')).toBe(false);
    expect(r.notFound).toEqual(['f']);
  });

  it('éditeur : masqué marqué, pas retiré ; variables gardées telles quelles', () => {
    const d = page();
    applyHtmlOps(
      d,
      [
        { id: 'a', sel: 'p.owner', op: 'hide', scope: 'step' },
        {
          id: 'b',
          sel: 'button[data-testid="save"]',
          op: 'text',
          value: 'Valider {{company}}',
          scope: 'step',
        },
      ],
      { mode: 'editor' },
    );
    expect(d.querySelector('p.owner')!.hasAttribute('data-fd-hidden')).toBe(true);
    expect((d.querySelector('p.owner') as HTMLElement).style.display).toBe('');
    expect(d.querySelector('button')!.textContent).toBe('Valider {{company}}');
  });

  it('validation stricte et annulation par groupe', () => {
    expect(validHtmlOps([{ id: 'a', sel: 'b', op: 'text', scope: 'step' }])).toBe(false);
    expect(validHtmlOps([{ id: 'a', sel: 'b', op: 'exec', scope: 'step' }])).toBe(false);
    expect(validHtmlOps([{ id: 'a', sel: 'b', op: 'hide', scope: 'step', extra: 1 }])).toBe(false);
    const ops: HtmlOp[] = [
      { id: 'a', sel: 'b', op: 'hide', scope: 'all', group: 'g1' },
      { id: 'b', sel: 'p', op: 'hide', scope: 'all', group: 'g1' },
      { id: 'c', sel: 'i', op: 'hide', scope: 'step' },
    ];
    expect(undoHtmlOp(ops, 'a').map((o) => o.id)).toEqual(['c']);
    expect(undoHtmlOp(ops, 'c').map((o) => o.id)).toEqual(['a', 'b']);
  });
});
