// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { altText, renderAccessibleHtml, type AccessibleStrings } from './accessible';
import { demoLang, fileName, type ExportDemo } from './model';

const S: AccessibleStrings = {
  skip: 'Aller au contenu',
  toc: 'Sommaire',
  stepHeading: (n, title) => `Étape ${n} · ${title}`,
  altCapture: (title) => `Capture d’écran : ${title}.`,
  altTarget: 'La zone à cliquer est entourée.',
  altVideo: (title) => `Première image de la vidéo : ${title}.`,
  transcript: 'Transcription',
  quiz: 'Questions du quiz',
  noChapter: 'Autres étapes',
  allSteps: 'Étapes',
  generated: 'Créé avec TutoClick',
};
const step = (title: string, extra: Partial<ExportDemo['steps'][number]> = {}) => ({
  title,
  text: `Consigne de ${title} <b>`,
  imageUrl: 'x',
  width: 100,
  height: 60,
  target: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
  ...extra,
});
const demo: ExportDemo = {
  title: 'Prise en main d’un logiciel',
  workspace: 'Acme',
  brand: '#A3195B',
  logo: null,
  version: 1,
  url: null,
  context: '',
  showBranding: true,
  lang: 'fr-FR',
  chapters: [{ id: 'c1', title: 'Se connecter' }],
  questions: ['Où est le bouton ?'],
  steps: [
    step('Ouvrir', { chapterId: 'c1' }),
    step('Saisir', { chapterId: 'c1', transcript: 'Bienvenue.' }),
    step('Valider', { chapterId: null, target: null, kind: 'video' }),
  ],
};

describe('version accessible (L29-03/04)', () => {
  const html = renderAccessibleHtml(
    demo,
    new Map([
      [0, 'data:image/jpeg;base64,AAAA'],
      [1, null],
      [2, 'data:image/jpeg;base64,BBBB'],
    ]),
    { images: true, text: true },
    S,
  );
  const doc = new DOMParser().parseFromString(html, 'text/html');
  it('lang, title, h1, h2 par chapitre, h3 par étape, sans saut de niveau', () => {
    expect(doc.documentElement.lang).toBe('fr-FR');
    expect(doc.title).toBe('Prise en main d’un logiciel');
    expect(doc.querySelector('h1')?.textContent).toBe('Prise en main d’un logiciel');
    const h2 = [...doc.querySelectorAll('main h2')].map((h) => h.textContent);
    expect(h2).toEqual(['Se connecter', 'Autres étapes', 'Questions du quiz']);
    expect([...doc.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Étape 1 · Ouvrir',
      'Étape 2 · Saisir',
      'Étape 3 · Valider',
    ]);
  });
  it('sommaire et lien d’évitement', () => {
    expect([...doc.querySelectorAll('nav a')].map((a) => a.getAttribute('href'))).toEqual([
      '#etape-1',
      '#etape-2',
      '#etape-3',
    ]);
    expect(doc.querySelector('a.skip')?.getAttribute('href')).toBe('#contenu');
    expect(doc.getElementById('contenu')).not.toBeNull();
  });
  it('textes alternatifs, consigne en texte réel échappée, transcription, quiz sans réponses', () => {
    const imgs = [...doc.querySelectorAll('img')].map((i) => i.alt);
    expect(imgs).toEqual([
      'Capture d’écran : Ouvrir. La zone à cliquer est entourée.',
      'Première image de la vidéo : Valider.',
    ]);
    expect(doc.querySelector('#etape-1')?.parentElement?.textContent).toContain('Consigne de Ouvrir <b>');
    expect(doc.querySelectorAll('main b').length).toBe(0);
    expect(doc.querySelector('.transcript')?.textContent).toContain('Bienvenue.');
    expect(doc.querySelectorAll('main ol li').length).toBe(1);
    expect(html).not.toMatch(/<script/i);
  });
  it('sans chapitre : un h2 « Étapes »', () => {
    const d2 = renderAccessibleHtml(
      { ...demo, chapters: [], questions: [] },
      new Map(),
      { images: false, text: true },
      S,
    );
    const doc2 = new DOMParser().parseFromString(d2, 'text/html');
    expect([...doc2.querySelectorAll('main h2')].map((h) => h.textContent)).toEqual(['Étapes']);
    expect(doc2.querySelectorAll('img').length).toBe(0);
  });
  it('alt, langue et nom de fichier', () => {
    expect(altText({ title: 'X', target: null }, 1, S)).toBe('Capture d’écran : X.');
    expect(demoLang('en')).toBe('en-GB');
    expect(demoLang(undefined)).toBe('fr-FR');
    expect(fileName('Prise en main d’un logiciel', 'accessible.html')).toBe(
      'prise-en-main-d-un-logiciel-accessible.html',
    );
  });
});
