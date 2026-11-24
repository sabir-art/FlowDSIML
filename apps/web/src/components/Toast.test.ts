import { describe, expect, it } from 'vitest';
import { leavesPage } from './Toast';

function click(html: string, selector: string, over: Partial<MouseEvent> = {}) {
  document.body.innerHTML = html;
  const target = document.querySelector(selector)!;
  return {
    target,
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...over,
  };
}

describe('toasts et navigation', () => {
  it('un lien de l’application vers une autre page ferme les toasts', () => {
    expect(leavesPage(click('<a href="#/demos"><span>Démos</span></a>', 'span'), '#/media')).toBe(true);
  });
  it('le lien de la page courante, un lien externe ou un téléchargement ne ferment rien', () => {
    expect(leavesPage(click('<a href="#/media">Médiathèque</a>', 'a'), '#/media')).toBe(false);
    expect(leavesPage(click('<a href="https://example.com">Site</a>', 'a'), '#/media')).toBe(false);
    expect(leavesPage(click('<a href="#/demos" target="_blank">Démos</a>', 'a'), '#/media')).toBe(false);
    expect(leavesPage(click('<a href="#/demos" download>Fichier</a>', 'a'), '#/media')).toBe(false);
  });
  it('un bouton, un clic modifié ou un lien dans un toast ne ferment rien', () => {
    expect(leavesPage(click('<button>Enregistrer</button>', 'button'), '#/media')).toBe(false);
    expect(leavesPage(click('<a href="#/demos">Démos</a>', 'a', { ctrlKey: true }), '#/media')).toBe(false);
    expect(leavesPage(click('<a href="#/demos">Démos</a>', 'a', { button: 1 }), '#/media')).toBe(false);
    expect(leavesPage(click('<div class="toasts"><a href="#/demos">Voir</a></div>', 'a'), '#/media')).toBe(
      false,
    );
  });
});
