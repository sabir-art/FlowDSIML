import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { HelpButton } from '../../help/HelpButton';
import './notifications.css';

const NotificationBell = lazy(() =>
  import('./NotificationBell').then((m) => ({ default: m.NotificationBell })),
);

/**
 * L33 : cloche du tableau de bord chargée après le premier affichage (hors du chemin critique). En attendant,
 * mêmes boutons à la même place (aide et cloche sans compteur), aucun décalage.
 */
export function LazyNotificationBell() {
  const { t } = useTranslation();
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
            >
              <Bell aria-hidden="true" />
            </button>
          </span>
        </>
      }
    >
      <NotificationBell />
    </Suspense>
  );
}
