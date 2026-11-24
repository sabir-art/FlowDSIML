import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { HelpButton } from '../../help/HelpButton';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { bellState } from './bellState';
import './notifications.css';

const NotificationBell = lazy(() =>
  import('./NotificationBell').then((m) => ({ default: m.NotificationBell })),
);

/**
 * L33 : cloche du tableau de bord chargée après le premier affichage (hors du chemin critique). En attendant,
 * mêmes boutons à la même place (aide et cloche sans compteur), aucun décalage.
 */
export function LazyNotificationBell({ topbar = false }: { topbar?: boolean }) {
  const { t } = useTranslation();
  // Même règle que NotificationBell : une seule instance, barre mobile ou en-tête de page
  const mobile = useMediaQuery('(max-width: 1023px)');
  if (mobile !== topbar) return null;
  return (
    <Suspense
      fallback={
        <>
          <HelpButton />
          <span className="nb" data-tip-side="bottom">
            <button
              type="button"
              className="fd-btn fd-btn--ghost fd-btn--icon nb-bell"
              aria-label={t('notifications.bellNone')}
              // Clic avant la fin du chargement : retenu, le panneau s'ouvre dès que la cloche est prête
              onClick={() => (bellState.open = true)}
            >
              <Bell aria-hidden="true" />
            </button>
          </span>
        </>
      }
    >
      <NotificationBell topbar={topbar} />
    </Suspense>
  );
}
