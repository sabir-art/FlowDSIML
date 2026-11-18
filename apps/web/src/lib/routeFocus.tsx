/**
 * L24 · A11Y-01 / A11Y-02 (RGAA 8.6, 12.8) :
 * - le titre de la page suit l'écran : « {{h1 de l'écran}} · TutoClick », mis à jour quand le h1 change
 *   (chargement d'une démo, changement d'onglet) ;
 * - au changement d'écran (chemin), le focus passe sur le h1 de l'écran pour qu'un lecteur d'écran
 *   l'annonce. Les changements de filtre ou d'onglet (paramètres d'URL) ne déplacent pas le focus,
 *   le premier affichage non plus (le lien d'évitement reste le premier arrêt).
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { APP_NAME } from '@flowdsiml/core';

function screenHeading(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('#main h1, main h1') ??
    document.querySelector<HTMLElement>('h1:not(dialog h1)')
  );
}

export function titleFor(h1: string | null | undefined): string {
  const text = (h1 ?? '').replace(/\s+/g, ' ').trim();
  return text ? `${text} · ${APP_NAME}` : APP_NAME;
}

/** Dernière action du visiteur : seules ses navigations déplacent le focus (pas les redirections). */
let lastInteraction = 0;
if (typeof document !== 'undefined') {
  const mark = () => (lastInteraction = Date.now());
  document.addEventListener('pointerdown', mark, true);
  document.addEventListener('keydown', mark, true);
}

export function RouteFocus() {
  const { pathname } = useLocation();
  const first = useRef(true);

  // Titre : suit le h1 de l'écran tant que la page est ouverte
  useEffect(() => {
    const sync = () => {
      const next = titleFor(screenHeading()?.textContent);
      if (document.title !== next) document.title = next;
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, []);

  // Focus : sur le h1 du nouvel écran, dès qu'il est rendu (données chargées)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (Date.now() - lastInteraction > 1500) return;
    let tries = 0;
    let timer = 0;
    const tryFocus = () => {
      const h = screenHeading();
      if (h) {
        if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
        h.setAttribute('data-route-focus', '');
        h.focus({ preventScroll: false });
        return;
      }
      if (tries++ < 20) timer = window.setTimeout(tryFocus, 100);
    };
    timer = window.setTimeout(tryFocus, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
