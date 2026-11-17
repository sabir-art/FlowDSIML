import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export interface Crumb {
  label: string;
  to?: string;
}

const Ctx = createContext<{ custom: Crumb[] | null; set: (c: Crumb[] | null) => void }>({
  custom: null,
  set: () => undefined,
});

export function CrumbsProvider({ children }: { children: ReactNode }) {
  const [custom, set] = useState<Crumb[] | null>(null);
  return <Ctx.Provider value={{ custom, set }}>{children}</Ctx.Provider>;
}

/** Fil d'Ariane de la barre du haut : celui de la page, sinon déduit de la route. */
export function useCrumbs(): Crumb[] {
  const { t } = useTranslation();
  const { custom } = useContext(Ctx);
  const { pathname } = useLocation();
  if (custom) return custom;
  if (pathname.startsWith('/analytics')) return [{ label: t('shell.analytics') }];
  if (pathname.startsWith('/leads')) return [{ label: t('shell.leads') }];
  if (pathname.startsWith('/settings/plans')) return [{ label: t('shell.plans') }];
  if (pathname.startsWith('/settings')) return [{ label: t('shell.settings') }];
  return [{ label: t('shell.demos') }];
}

/** Une page déclare son fil d'Ariane (ex. Démos / « titre » / Partager). */
export function useSetCrumbs(crumbs: Crumb[] | null) {
  const { set } = useContext(Ctx);
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    set(crumbs);
    return () => set(null);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
