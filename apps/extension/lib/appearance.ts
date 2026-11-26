import { browser } from 'wxt/browser';

/**
 * L64 §4 : apparence de l'extension (Système, Clair ou Sombre), mémorisée. Elle vaut pour le popup, la
 * barre de capture et les écrans de vérification. Par défaut : Système (le thème du navigateur).
 */
export type Appearance = 'system' | 'light' | 'dark';
export const APPEARANCE_KEY = 'fd.appearance';

export const asAppearance = (v: unknown): Appearance => (v === 'light' || v === 'dark' ? v : 'system');

export async function readAppearance(): Promise<Appearance> {
  try {
    return asAppearance((await browser.storage.local.get(APPEARANCE_KEY))[APPEARANCE_KEY]);
  } catch {
    return 'system';
  }
}

/** Pages de l'extension : `<html data-theme>` (jetons du design system) et logo clair ou sombre. */
export function paintPage(a: Appearance): void {
  const html = document.documentElement;
  if (a === 'system') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', a);
  // Logo : la source sombre suit le thème choisi, ou celui du navigateur en Système
  for (const src of document.querySelectorAll<HTMLSourceElement>('picture source[srcset*="sombre"]'))
    src.media = a === 'system' ? '(prefers-color-scheme: dark)' : a === 'dark' ? 'all' : 'not all';
}

/** Applique l'apparence mémorisée à la page, et la suit si elle change (popup ouvert à côté). */
export function followAppearance(onChange?: (a: Appearance) => void): void {
  void readAppearance().then((a) => {
    paintPage(a);
    onChange?.(a);
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(APPEARANCE_KEY in changes)) return;
    const a = asAppearance(changes[APPEARANCE_KEY]?.newValue);
    paintPage(a);
    onChange?.(a);
  });
}

/** Barre et carte dans la page (shadow DOM) : `data-theme` sur l'hôte ; les couleurs sont des variables. */
export function themeHost(host: HTMLElement): void {
  const set = (a: Appearance) => host.setAttribute('data-theme', a);
  set('system');
  void readAppearance().then(set);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && APPEARANCE_KEY in changes) set(asAppearance(changes[APPEARANCE_KEY]?.newValue));
  });
}
