import { describe, expect, it } from 'vitest';
import {
  buildNeedles,
  findTerms,
  foldText,
  markTermsInHtml,
  termsPresent,
  VAR_CLOSE,
  VAR_OPEN,
} from './glossary';
import { escapeHtml, richTextToHtml } from './richText';
import { applyVariables } from './variables';

const terms = [
  {
    term: 'Dossier unique',
    oldTerm: 'Fiche jeune',
    definition: 'Dossier partagé.',
    forms: ['dossiers uniques'],
  },
  { term: 'PACEA', definition: 'Parcours contractualisé.' },
  { term: 'Élément', definition: 'Un élément.' },
];

describe('glossaire', () => {
  it('replie casse et accents sans changer la longueur', () => {
    expect(foldText('Élément ÇA')).toBe('element ca');
    expect(foldText('Élément ÇA').length).toBe('Élément ÇA'.length);
  });

  it('mot entier, insensible aux accents, première occurrence par étape', () => {
    const n = buildNeedles(terms);
    const used = new Set<number>();
    const text = 'Le PACEA et l’element : PACEA encore, PACEAS non.';
    const m = findTerms(text, n, used);
    expect(m.map((x) => text.slice(x.start, x.end))).toEqual(['PACEA', 'element']);
    expect(findTerms('PACEA', n, used)).toEqual([]);
  });

  it('forme longue prioritaire et autres formes', () => {
    const n = buildNeedles(terms);
    const t = 'Ouvrez les dossiers uniques.';
    const m = findTerms(t, n, new Set());
    expect(t.slice(m[0]!.start, m[0]!.end)).toBe('dossiers uniques');
  });

  it('pluriel simple', () => {
    const n = buildNeedles([
      { term: 'Tableau de bord', definition: 'x' },
      { term: 'Rapport', definition: 'y' },
    ]);
    const t = 'Les tableaux de bord et les rapports, pas rapporte.';
    expect(findTerms(t, n, new Set()).map((x) => t.slice(x.start, x.end))).toEqual(['rapports']);
    const t2 = 'Deux tableau de bords.';
    expect(findTerms(t2, n, new Set()).map((x) => t2.slice(x.start, x.end))).toEqual(['tableau de bords']);
  });

  it("n'utilise jamais l'ancien terme", () => {
    expect(findTerms('La fiche jeune', buildNeedles(terms), new Set())).toEqual([]);
  });

  it('ignore les valeurs de variables et les liens', () => {
    const n = buildNeedles(terms, escapeHtml);
    const src = applyVariables(
      'Bonjour {{nom}}, voir [PACEA](https://acme.example) puis PACEA.',
      { nom: 'PACEA' },
      {},
      [VAR_OPEN, VAR_CLOSE],
    );
    const html = markTermsInHtml(richTextToHtml(src), n, new Set());
    expect(html).toBe(
      'Bonjour PACEA, voir <a href="https://acme.example/" target="_blank" rel="noopener noreferrer">PACEA</a> puis <span class="p-term" tabindex="0" data-term="1">PACEA</span>.',
    );
  });

  it('termes présents dans la démo', () => {
    const n = buildNeedles(terms);
    expect([...termsPresent(['élément', 'rien', 'pacea'], n)].sort()).toEqual([1, 2]);
  });
});
