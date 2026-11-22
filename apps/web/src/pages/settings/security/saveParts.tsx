import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Sécurité (lot 1) : un seul « Annuler / Enregistrer » dans la barre de page pour plusieurs sections qui
 * gardent chacune leur brouillon et leur enregistrement. Chaque section se déclare ici.
 */
export interface SavePart {
  dirty: boolean;
  busy: boolean;
  /** Brouillon non enregistrable (ex. aucun mode d'accès, aucun domaine). */
  invalid?: boolean;
  save: () => void | Promise<void>;
  reset: () => void;
}
type Register = (key: string, part: SavePart | null) => void;
const Ctx = createContext<Register>(() => undefined);

export function useSaveParts() {
  const [parts, setParts] = useState<Record<string, SavePart>>({});
  const register = useCallback<Register>((key, part) => {
    setParts((prev) => {
      const next = { ...prev };
      if (part) next[key] = part;
      else delete next[key];
      return next;
    });
  }, []);
  const list = Object.values(parts);
  const api = useMemo(
    () => ({
      dirty: list.some((p) => p.dirty),
      busy: list.some((p) => p.busy),
      /** Une section a un brouillon non enregistrable : Enregistrer reste inactif, l'erreur est affichée. */
      invalid: list.some((p) => p.invalid),
      saveAll: async () => {
        for (const p of list) if (p.dirty && !p.invalid) await p.save();
      },
      resetAll: () => list.forEach((p) => p.reset()),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts],
  );
  const Provider = useCallback(
    ({ children }: { children: ReactNode }) => <Ctx.Provider value={register}>{children}</Ctx.Provider>,
    [register],
  );
  return { ...api, Provider };
}

/** Déclare une section auprès de la barre de page ; `save` et `reset` lisent toujours le dernier brouillon. */
export function useSavePart(key: string, part: SavePart) {
  const register = useContext(Ctx);
  const latest = useRef(part);
  latest.current = part;
  const { dirty, busy, invalid } = part;
  useEffect(() => {
    register(key, {
      dirty,
      busy,
      invalid,
      save: () => latest.current.save(),
      reset: () => latest.current.reset(),
    });
    return () => register(key, null);
  }, [register, key, dirty, busy, invalid]);
}
