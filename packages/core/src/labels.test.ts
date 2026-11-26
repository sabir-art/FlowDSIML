import { describe, expect, it } from 'vitest';
import { displayAddress, looksGlued, looksLikeSelector, looksTechnical, readableLabel } from './labels';

describe('libellés lisibles (L63)', () => {
  it('reconnaît un sélecteur ou du code', () => {
    for (const s of [
      'div:has(> #search-text-area-floating)',
      'button.btn-primary',
      '#main > .content',
      '[data-testid="send"]',
      'ul li:nth-child(2)',
      '.sidebar',
      'a[href="/x"]',
      '() => {}',
    ])
      expect(looksLikeSelector(s), s).toBe(true);
    for (const s of [
      'Créer un projet',
      'Suivant >',
      'Envoyer à l’équipe (3)',
      'example.com',
      'Version 1.2',
      'Étape n° 3 : validez',
      'a',
    ])
      expect(looksLikeSelector(s), s).toBe(false);
  });

  it('reconnaît des textes collés', () => {
    expect(looksGlued('Generate speechText to SpeechOpen in playground')).toBe(true);
    expect(looksGlued('Ouvrir YouTube')).toBe(false);
    expect(looksGlued('Créer un projet')).toBe(false);
    expect(looksTechnical('Cliquez sur « Generate speechText to SpeechOpen »')).toBe(true);
  });

  it('choisit le premier candidat lisible, sur une ligne, borné', () => {
    expect(readableLabel(['  Créer   un  projet '])).toBe('Créer un projet');
    expect(readableLabel(['Fermer', 'x'])).toBe('Fermer');
    expect(readableLabel(['div:has(> #a)', 'Rechercher'])).toBe('Rechercher');
    expect(readableLabel(['Generate speech\nText to Speech\nOpen'])).toBe('Generate speech');
    expect(readableLabel(['div.x > span', null, ''])).toBe('');
    expect(readableLabel(['a'.repeat(80)])).toHaveLength(58);
    expect(readableLabel(['a'.repeat(80)]).endsWith('…')).toBe(true);
  });
});

describe('adresse affichée (lot B)', () => {
  it('domaine et chemin, sans protocole, paramètres ni ancre', () => {
    expect(displayAddress('https://crm.acme.example/opportunites?id=42#x')).toBe(
      'crm.acme.example/opportunites',
    );
    expect(displayAddress('http://localhost:54410/formulaire')).toBe('localhost:54410/formulaire');
    expect(displayAddress('https://acme.example/')).toBe('acme.example');
    expect(displayAddress('https://acme.example/a/b/')).toBe('acme.example/a/b');
  });
  it('vide pour une adresse illisible ou hors web', () => {
    expect(displayAddress('pas une adresse')).toBe('');
    expect(displayAddress('file:///etc/passwd')).toBe('');
  });
  it('120 caractères au plus', () => {
    expect(displayAddress(`https://a.example/${'x'.repeat(300)}`).length).toBe(120);
  });
});
