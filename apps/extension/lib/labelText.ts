import { looksTechnical } from '@flowdsiml/core';

/**
 * L63 : texte du libellé d'un élément cliqué, commun aux trois captures (captures d'écran, vidéo, HTML).
 * Celui de l'élément s'il est interactif ou sans enfant ; pour un bloc plus grand (section, page), son
 * premier titre, sinon rien (« Cliquez ici »). innerText rend une ligne par bloc affiché : elementLabel
 * n'en garde que la première, jamais des textes collés.
 */
export const INTERACTIVE = 'a,button,input,select,textarea,label,[role],[onclick],[tabindex]';

export function labelText(el: Element): string {
  if (el instanceof HTMLInputElement) return '';
  if (el.matches(INTERACTIVE) || !el.firstElementChild) {
    const text = (el as HTMLElement).innerText ?? el.textContent ?? '';
    const first = text.split(/[\r\n]+/).find((l) => l.trim()) ?? '';
    // Recette 277f878 §2 : des spans en ligne collent leurs textes (« Generate speechText to SpeechOpen ») ;
    // le premier morceau de texte (« Generate speech ») vaut mieux que « Cliquez ici »
    return looksTechnical(first.replace(/\s+/g, ' ').trim()) ? firstPiece(el) : text;
  }
  return el.querySelector('h1,h2,h3,h4,h5,h6')?.textContent ?? '';
}

/** Premier nœud de texte non vide de l'élément. */
function firstPiece(el: Element): string {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (t) return t;
  }
  return '';
}
