import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { errorMessage } from '../../lib/errors';
import { unpublishDemo } from '../../lib/publish';

/**
 * Retours du 24/11 (2e série) §1 : « Retirer la publication… » du menu ⋯ de la barre de démo. Ce n'est pas
 * un réglage d'accès mais l'état de publication : une confirmation dit ce qui cesse de fonctionner, puis
 * la démo redevient un brouillon. Renvoie la fenêtre de confirmation à rendre et l'action à brancher.
 */
export function useUnpublish(demo: { id: string; title: string } | null | undefined, onDone: () => void) {
  const { t } = useTranslation();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const run = async () => {
    if (!demo) return;
    const yes = await ask({
      title: t('share.unpublishTitle', { title: demo.title }),
      body: t('share.unpublishBody'),
      confirmLabel: t('share.unpublishConfirm'),
      danger: true,
    });
    if (!yes) return;
    try {
      await unpublishDemo(demo.id);
      toast(t('share.unpublished'));
      onDone();
    } catch (e) {
      toast(errorMessage(t, e), undefined, { tone: 'warning' });
    }
  };
  return [dialog, run] as const;
}
