/** L22-08 : « Afficher les curseurs » (Réglages), préférence de ce navigateur. */
import { useCallback, useState } from 'react';

const KEY = 'fd.editor.cursors';

export function useShowCursors(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== '0';
    } catch {
      return true;
    }
  });
  const set = useCallback((v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* stockage indisponible : la préférence vaut pour la session */
    }
  }, []);
  return [on, set];
}
