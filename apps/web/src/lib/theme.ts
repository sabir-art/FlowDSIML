import { useSyncExternalStore } from 'react';

/** Thème de l'interface (pas du player) : clair par défaut, sombre ou selon le système. */
export type ThemePref = 'light' | 'dark' | 'system';

export const THEME_KEY = 'fd.theme';
const listeners = new Set<() => void>();

export function isThemePref(v: unknown): v is ThemePref {
  return v === 'light' || v === 'dark' || v === 'system';
}

function read(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemePref(v) ? v : 'light';
  } catch {
    return 'light';
  }
}

let current: ThemePref = read();

/** Pose data-theme sur <html> ; « system » laisse tokens.css suivre prefers-color-scheme. */
export function applyTheme(pref: ThemePref) {
  document.documentElement.dataset.theme = pref;
}

export function getTheme(): ThemePref {
  return current;
}

/** Change le thème localement (et le mémorise). La synchronisation avec le compte est faite par l'appelant. */
export function setTheme(pref: ThemePref) {
  current = pref;
  applyTheme(pref);
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* stockage indisponible : le thème vaut pour la session */
  }
  listeners.forEach((l) => l());
}

export function useTheme(): ThemePref {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getTheme,
    getTheme,
  );
}
