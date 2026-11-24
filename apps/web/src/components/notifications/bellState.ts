/**
 * État d'ouverture du panneau des notifications, dans un store partagé hors des composants.
 *
 * Le bouton de la cloche est remplacé plusieurs fois pendant le chargement d'une page : le bouton
 * d'attente laisse la place à la cloche quand son code arrive, puis la cloche est remontée quand la page
 * passe de son squelette à son contenu. Un clic fait pendant ce temps ne doit pas être perdu :
 *  - le panneau s'ouvre même si le clic tombe sur le bouton d'attente, et reste ouvert au remontage
 *    (chaque cloche lit le store à son montage et s'y abonne) ;
 *  - si le bouton est remplacé ENTRE l'appui et le relâchement, le navigateur n'émet aucun clic
 *    (l'élément pressé n'existe plus) : l'appui puis le relâchement sur une cloche valent alors un clic.
 */
import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

export const bellStore = {
  get: () => open,
  set(next: boolean) {
    if (next === open) return;
    open = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};

/** Ouverture du panneau, partagée par toutes les cloches montées. */
export const useBellOpen = () => useSyncExternalStore(bellStore.subscribe, bellStore.get, () => false);

/** Classe du bouton de la cloche (bouton d'attente et cloche chargée). */
const BELL = '.nb-bell';
const bellOf = (target: EventTarget | null) => (target instanceof Element ? target.closest(BELL) : null);

if (typeof document !== 'undefined') {
  let pressed: Element | null = null;
  document.addEventListener(
    'pointerdown',
    (e) => void (pressed = e.button === 0 ? bellOf(e.target) : null),
    true,
  );
  document.addEventListener(
    'pointerup',
    (e) => {
      const from = pressed;
      pressed = null;
      const on = bellOf(e.target);
      // Même bouton à l'appui et au relâchement : le clic du navigateur fait le travail
      if (from && on && from !== on) bellStore.set(true);
    },
    true,
  );
  document.addEventListener('pointercancel', () => void (pressed = null), true);
}
