import { describe, expect, it } from 'vitest';
import { place, shortcutKeys } from './tooltip';

const view = { width: 390, height: 844 };
const bubble = { width: 120, height: 30 };

describe('L44 : placement des infobulles', () => {
  it('au-dessus par défaut, centrée sur le bouton', () => {
    const p = place({ left: 100, top: 400, width: 40, height: 40 }, bubble, view, 'top');
    expect(p).toEqual({ side: 'top', left: 60, top: 362, arrow: 60 });
  });
  it('passe au côté opposé si elle déborde', () => {
    expect(place({ left: 100, top: 10, width: 40, height: 40 }, bubble, view, 'top').side).toBe('bottom');
    expect(place({ left: 100, top: 800, width: 40, height: 40 }, bubble, view, 'bottom').side).toBe('top');
  });
  it('bouton Langue au bord droit : bulle décalée, flèche sur l’icône', () => {
    const p = place({ left: 346, top: 780, width: 36, height: 36 }, bubble, view, 'top');
    expect(p.left + bubble.width).toBe(390 - 8);
    expect(p.left + p.arrow).toBe(346 + 18);
  });
  it('flèche à au moins 10 px des coins', () => {
    const p = place({ left: 0, top: 400, width: 8, height: 8 }, bubble, view, 'top');
    expect(p.left).toBe(8);
    expect(p.arrow).toBe(10);
  });
  it('à droite d’une barre verticale', () => {
    const p = place({ left: 0, top: 100, width: 48, height: 40 }, bubble, view, 'right');
    expect(p).toMatchObject({ side: 'right', left: 56, top: 105, arrow: 15 });
  });
});

describe('L44 : raccourcis', () => {
  it('Ctrl et Alt deviennent ⌘ et ⌥ sur Mac', () => {
    expect(shortcutKeys('Ctrl+Z', false)).toEqual(['Ctrl', 'Z']);
    expect(shortcutKeys('Ctrl+Alt+K', true)).toEqual(['⌘', '⌥', 'K']);
  });
  it('aria-keyshortcuts : première combinaison, noms de touches lisibles', () => {
    expect(shortcutKeys('Control+Z', false)).toEqual(['Ctrl', 'Z']);
    expect(shortcutKeys('Alt+ArrowUp Alt+ArrowDown', false)).toEqual(['Alt', '↑']);
  });
});
