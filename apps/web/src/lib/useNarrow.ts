import { useEffect, useState } from 'react';

/** Vrai si la fenêtre est plus étroite que `px` (ED11 : l'éditeur exige un écran large). */
export function useNarrow(px: number) {
  const query = `(max-width: ${px - 1}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return narrow;
}
