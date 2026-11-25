/**
 * L63 : texte du libellé d'un élément cliqué, commun aux trois captures (captures d'écran, vidéo, HTML).
 * Celui de l'élément s'il est interactif ou sans enfant ; pour un bloc plus grand (section, page), son
 * premier titre, sinon rien (« Cliquez ici »). innerText rend une ligne par bloc affiché : elementLabel
 * n'en garde que la première, jamais des textes collés.
 */
export const INTERACTIVE = 'a,button,input,select,textarea,label,[role],[onclick],[tabindex]';

export function labelText(el: Element): string {
  if (el instanceof HTMLInputElement) return '';
  if (el.matches(INTERACTIVE) || !el.firstElementChild)
    return (el as HTMLElement).innerText ?? el.textContent ?? '';
  return el.querySelector('h1,h2,h3,h4,h5,h6')?.textContent ?? '';
}
