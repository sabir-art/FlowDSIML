import { describe, expect, it } from 'vitest';
import { preparePage, uniqueSelector } from './htmlText';

const page = `<!doctype html><html><head><title>Usagers · Acme</title><script>alert(1)</script>
<style>.x{}</style></head><body>
<nav id="menu"><a href="/">Accueil</a><a href="/usagers">Usagers</a></nav>
<main><h1>Liste des usagers</h1>
<p class="perso">Camille Fictive, 12 rue de l'Exemple</p>
<p data-fd-blurred>06 12 34 56 78</p>
<div><button>Ajouter</button><button>Exporter</button><button aria-label="Fermer">×</button></div>
<button class="promo">Offre</button>
<a href="/aide">   </a>
</main></body></html>`;

describe('L30-05 : capture HTML préparée pour l’IA', () => {
  it('texte sans script, sans zone floutée à la capture ni zone floutée ou masquée dans l’éditeur', () => {
    const p = preparePage(page, [
      { op: 'blur', sel: 'p.perso' },
      { op: 'hide', sel: 'button.promo' },
      { op: 'text', sel: 'h1' },
    ]);
    expect(p.title).toBe('Usagers · Acme');
    expect(p.text).toContain('Liste des usagers');
    expect(p.text).not.toContain('alert');
    expect(p.text).not.toContain('Camille');
    expect(p.text).not.toContain('06 12');
    expect(p.text).not.toContain('Offre');
  });

  it('éléments cliquables numérotés, libellés courts, sélecteurs uniques pris sur la page intacte', () => {
    const p = preparePage(page, [{ op: 'blur', sel: 'p.perso' }]);
    expect(p.elements.map((e) => [e.i, e.label])).toEqual([
      [0, 'Accueil'],
      [1, 'Usagers'],
      [2, 'Ajouter'],
      [3, 'Exporter'],
      [4, 'Fermer'],
      [5, 'Offre'],
    ]);
    // Le sélecteur désigne le même élément dans la page complète (rien n'a été retiré avant le calcul)
    const doc = new DOMParser().parseFromString(page, 'text/html');
    for (const e of p.elements) {
      const found = doc.querySelectorAll(e.sel);
      expect(found.length).toBe(1);
    }
    expect(doc.querySelector(p.elements[3]!.sel)!.textContent).toBe('Exporter');
  });

  it('sélecteur : id sûr si unique, sinon chemin depuis body ; borné à 500 caractères', () => {
    const doc = new DOMParser().parseFromString(
      '<body><div id="a"><span></span><span></span></div></body>',
      'text/html',
    );
    expect(uniqueSelector(doc.getElementById('a')!)).toBe('#a');
    expect(uniqueSelector(doc.querySelectorAll('span')[1]!)).toBe('body > div > span:nth-of-type(2)');
    const deep = `<body>${'<div>'.repeat(120)}<b>x</b>${'</div>'.repeat(120)}</body>`;
    const d2 = new DOMParser().parseFromString(deep, 'text/html');
    expect(uniqueSelector(d2.querySelector('b')!)).toBeNull();
  });

  it('texte borné à 6 000 caractères, 80 éléments au plus', () => {
    const big = `<body><p>${'mot '.repeat(3000)}</p>${Array.from({ length: 120 }, (_, i) => `<button>B${i}</button>`).join('')}</body>`;
    const p = preparePage(big, []);
    expect(p.text.length).toBe(6000);
    expect(p.elements).toHaveLength(80);
  });
});
