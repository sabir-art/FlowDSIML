import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { endCheck, type MenuItem } from '../../components/Menu';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

type Page = { enabled: boolean; demos: 'all' | string[] };
type DemoLike = { id: string; title: string; status: string };

/**
 * Retours du 24/11 (2e série) §1 : « Afficher sur la page publique » dans le menu ⋯ d'une démo (barre
 * de démo, carte). La page publique est le catalogue de l'espace (Paramètres › Page publique) : la case
 * ajoute ou retire la démo de sa liste. Réservée aux administrateurs ; indisponible, avec la raison, si
 * la démo n'est pas publiée, si son accès est restreint ou si la page publique est hors ligne.
 */
export function usePublicPageList(wsId: string | undefined) {
  const { t } = useTranslation();
  const toast = useToast();
  const { can } = useWorkspace();
  const allowed = can('workspace.settings');
  const [page, setPage] = useState<Page | null>(null);
  const [restricted, setRestricted] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!wsId || !allowed) return;
    const [c, a] = await Promise.all([
      supabase
        .from('training_centers')
        .select('public_page, public_page_enabled')
        .eq('workspace_id', wsId)
        .maybeSingle(),
      supabase.from('demo_access').select('demo_id, mode').eq('workspace_id', wsId),
    ]);
    const demos = (c.data?.public_page as { demos?: unknown } | null)?.demos;
    setPage({
      enabled: !!c.data?.public_page_enabled,
      demos: Array.isArray(demos) ? (demos as string[]) : 'all',
    });
    setRestricted(new Set((a.data ?? []).filter((x) => x.mode !== 'link').map((x) => x.demo_id)));
  }, [wsId, allowed]);
  useEffect(() => {
    void load();
  }, [load]);

  /** Entrée de menu de la démo (aucune pour qui ne peut pas régler la page publique). */
  const itemFor = (demo: DemoLike | null | undefined): MenuItem[] => {
    if (!allowed || !page || !demo) return [];
    const reason =
      demo.status !== 'published'
        ? 'unpublished'
        : restricted.has(demo.id)
          ? 'restricted'
          : !page.enabled
            ? 'off'
            : null;
    const shown = !reason && (page.demos === 'all' || page.demos.includes(demo.id));
    return [
      {
        label: t('share.publicPageShow'),
        // CHOIX-01 : icône en tête, coche à droite quand la démo est affichée
        icon: <Globe />,
        end: endCheck(shown),
        checkbox: true,
        current: shown,
        disabled: !!reason,
        hint: reason ? t(`share.publicPageWhy.${reason}`) : undefined,
        onSelect: () =>
          void supabase
            .rpc('set_public_page_demo', { p_demo: demo.id, p_shown: !shown })
            .then(({ error }) => {
              if (error) toast(errorMessage(t, error), undefined, { tone: 'warning' });
              else
                toast(t(shown ? 'share.publicPageHidden' : 'share.publicPageShown', { title: demo.title }));
              void load();
            }),
      },
    ];
  };
  return { itemFor, reload: load };
}
