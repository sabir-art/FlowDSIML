import { useSyncExternalStore } from 'react';

/** Vrai tant que la media query correspond (mise à jour au redimensionnement). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
