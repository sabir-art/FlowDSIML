import { useCallback, useEffect, useRef, useState } from 'react';

/** Durée de la confirmation de copie (ms). */
export const COPIED_MS = 2000;

/**
 * Confirmation de copie sur place : `copy(texte)` met le texte dans le presse-papiers et rend `copied`
 * vrai pendant 2 s (icône en coche, « Copié », annonce par une région polie). Pas de toast.
 */
export function useCopied(): [boolean, (text: string) => Promise<boolean>] {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
    return true;
  }, []);
  return [copied, copy];
}
