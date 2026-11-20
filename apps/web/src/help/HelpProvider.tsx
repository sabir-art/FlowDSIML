/**
 * L26-02 : aide intégrée. Le tiroir s'ouvre par le bouton « Aide » des barres du haut ou par F1 ; il
 * n'est pas modal (la page reste utilisable). Échap le ferme et rend le focus au déclencheur.
 * L'éditeur indique son onglet (Étape, Design, Réglages) pour les articles « Sur cette page ».
 */
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { withRestLocale } from '../i18n';
import { useWorkspace } from '../workspace/WorkspaceProvider';

// L33 : le panneau cite les raccourcis de l'éditeur (textes chargés à la demande)
const HelpDrawer = lazy(() =>
  withRestLocale(() => import('./HelpDrawer')).then((m) => ({ default: m.HelpDrawer })),
);

interface HelpState {
  open: boolean;
  toggle: (opener?: HTMLElement | null) => void;
  close: () => void;
  /** L'éditeur annonce son onglet (articles « Sur cette page »). */
  setEditorTab: (tab: string | null) => void;
  editorTab: string | null;
  /** Ouvre le tiroir sur un article (ex. « Voir comment » sans visite guidée). */
  openArticle: (slug: string, opener?: HTMLElement | null) => void;
}
const Ctx = createContext<HelpState | null>(null);
export const useHelp = () => useContext(Ctx);

export function HelpProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<string | null>(null);
  const [article, setArticle] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const available = !!user && !!current;

  const close = useCallback(() => {
    setOpen(false);
    const el = opener.current;
    opener.current = null;
    // Focus rendu au déclencheur (bouton « Aide »), sinon au contenu principal
    window.setTimeout(() => (el && el.isConnected ? el : document.getElementById('main'))?.focus(), 0);
  }, []);
  const toggle = useCallback(
    (el?: HTMLElement | null) => {
      if (open) return close();
      opener.current = el ?? (document.activeElement as HTMLElement | null);
      setArticle(null);
      setOpen(true);
    },
    [open, close],
  );
  const openArticle = useCallback((slug: string, el?: HTMLElement | null) => {
    opener.current = el ?? (document.activeElement as HTMLElement | null);
    setArticle(slug);
    setOpen(true);
  }, []);

  // F1 : ouvre ou ferme l'aide (le navigateur ouvrirait sa propre aide)
  useEffect(() => {
    if (!available) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [available, toggle]);

  const value = useMemo(
    () => ({ open: open && available, toggle, close, setEditorTab, editorTab, openArticle }),
    [open, available, toggle, close, editorTab, openArticle],
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      {open && available && (
        <Suspense fallback={null}>
          <HelpDrawer key={article ?? ''} onClose={close} editorTab={editorTab} initialArticle={article} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}
