// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  applyHtmlOps,
  neutralText,
  selectorTrail,
  shortSelector,
  stableSelector,
  undoHtmlOp,
  validChart,
  validHtmlOps,
  validStyle,
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

  it('L25-07 : style en liste blanche, plusieurs éléments, une seule opération', () => {
    const d = page();
    const op: HtmlOp = {
      id: 's1',
      sel: 'div.kpi:nth-of-type(1) > b.value',
      sels: ['div.kpi:nth-of-type(1) > b.value', 'div.kpi:nth-of-type(2) > b.value'],
      op: 'style',
      value: { color: '#0B6B62', fontSize: 24, fontWeight: '700' },
      scope: 'step',
    };
    expect(validHtmlOps([op])).toBe(true);
    applyHtmlOps(d, [op], { mode: 'player' });
    const bs = [...d.querySelectorAll<HTMLElement>('b.value')];
    expect(bs.map((b) => b.style.fontSize)).toEqual(['24px', '24px']);
    expect(bs[1]!.style.fontWeight).toBe('700');
    expect(bs[0]!.style.color).toBe('rgb(11, 107, 98)');
  });
  it('L25-07 : aucune chaîne CSS libre', () => {
    expect(validStyle({ color: 'red' })).toBe(false);
    expect(validStyle({ color: '#000000; background:url(x)' })).toBe(false);
    expect(validStyle({ fontSize: 200 })).toBe(false);
    expect(validStyle({ fontWeight: 'bold' })).toBe(false);
    expect(validStyle({ position: 'fixed' })).toBe(false);
    expect(validStyle({ background: '#FFFFFF' })).toBe(true);
    const base = { id: 'a', sel: 'b', scope: 'step' };
    expect(validHtmlOps([{ ...base, op: 'style', value: 'color:red' }])).toBe(false);
    expect(validHtmlOps([{ ...base, op: 'hide', sels: ['b'] }])).toBe(false);
    expect(
      validHtmlOps([{ ...base, op: 'style', sels: Array(201).fill('b'), value: { color: '#000000' } }]),
    ).toBe(false);
  });
  it('L25-08 : graphique (type, 12 lignes au plus, valeurs numériques)', () => {
    const rows = [
      { label: 'juil.', value: 18 },
      { label: 'août', value: 22 },
    ];
    expect(validChart({ type: 'bar', rows, title: 'Rapports par mois' })).toBe(true);
    expect(validChart({ type: 'pie', rows })).toBe(false);
    expect(validChart({ type: 'bar', rows: [] })).toBe(false);
    expect(validChart({ type: 'bar', rows: Array(13).fill(rows[0]) })).toBe(false);
    expect(validChart({ type: 'bar', rows: [{ label: 'a', value: '3' }] })).toBe(false);
    expect(validChart({ type: 'line', rows: [{ label: 'a', value: NaN }] })).toBe(false);
    expect(validChart({ type: 'donut', rows, color: '#000000' })).toBe(false);
  });
  it('L28-05 : image Ajuster/Remplir et « Masquer l’image » (forme validée, rendu)', () => {
    const base = { id: 'i1', sel: 'img.logo', scope: 'step' as const };
    expect(validHtmlOps([{ ...base, op: 'image', value: 'w/x.png', fit: 'cover' }])).toBe(true);
    expect(validHtmlOps([{ ...base, op: 'image', value: 'w/x.png', fit: 'stretch' }])).toBe(false);
    expect(validHtmlOps([{ ...base, op: 'text', value: 'x', fit: 'cover' }])).toBe(false);
    expect(validHtmlOps([{ ...base, op: 'mask' }])).toBe(true);
    expect(validHtmlOps([{ ...base, op: 'mask', value: 'https://ailleurs.example/x.png' }])).toBe(false);
    const d = page();
    applyHtmlOps(d, [{ ...base, op: 'image', value: 'w/x.png', fit: 'cover' }], { mode: 'player' });
    const img = d.querySelector('img.logo') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('w/x.png');
    expect(img.style.objectFit).toBe('cover');
    const d2 = page();
    applyHtmlOps(d2, [{ ...base, op: 'mask' }], { mode: 'player' });
    const m = d2.querySelector('img.logo') as HTMLImageElement;
    expect(m.getAttribute('src')).toMatch(/^data:image\/gif;base64,/);
    expect(m.hasAttribute('srcset')).toBe(false);
    expect(m.getAttribute('alt')).toBe('');
  });
});
