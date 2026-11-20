import { useTranslation } from 'react-i18next';
import { ChevronDown, Folder, LayoutGrid, List, Tag as TagIcon } from 'lucide-react';
import { Sk } from '../../components/Skeleton';

/**
 * L32 §2 : squelette du tableau de bord. Mêmes conteneurs que la page (indicateurs, barre de filtres,
 * grille) ; seuls les contenus sont des blocs. La barre de filtres est réelle et désactivée, sans compteur.
 */
export function DemosSkeleton({ onboardingHeight }: { onboardingHeight: number }) {
  const { t } = useTranslation();
  return (
    <>
      <KpiSkeletonRow />
      {/* Prise en main : place réservée à la hauteur de la dernière visite (rien si elle était masquée) */}
      {onboardingHeight > 0 && (
        <div className="fd-card sk-reserve" style={{ height: onboardingHeight }} aria-hidden="true" />
      )}
      <section aria-labelledby="demos-list-title" className="demos-section">
        <div className="filter-bar">
          <h2 id="demos-list-title">{t('demos.allDemos')}</h2>
          <div className="fd-segmented" role="group" aria-label={t('demos.status')}>
            {(['all', 'published', 'draft'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={k === 'all'} disabled>
                {t(`demos.filter_${k}`)}
              </button>
            ))}
          </div>
          <div className="filter-bar__end">
            <button type="button" className="fd-btn fd-btn--sm menu-trigger" disabled>
              <span className="fd-btn__icon" aria-hidden="true">
                <Folder />
              </span>
              {t('demos.folders')}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <button type="button" className="fd-btn tg-filter" disabled>
              <TagIcon aria-hidden="true" />
              {t('tags.title')}
            </button>
            <div className="fd-segmented view-seg" role="radiogroup" aria-label={t('demos.view')}>
              <button type="button" role="radio" aria-checked aria-label={t('demos.viewGrid')} disabled>
                <LayoutGrid aria-hidden="true" />
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={false}
                aria-label={t('demos.viewList')}
                disabled
              >
                <List aria-hidden="true" />
              </button>
            </div>
            <button type="button" className="fd-btn fd-btn--sm menu-trigger" disabled>
              {t('demos.sortUpdated')}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <ul className="demo-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="fd-card demo-card">
              <div className="demo-cover">
                <Sk w="100%" h="100%" style={{ borderRadius: 'inherit' }} />
              </div>
              <div className="demo-body">
                <div className="demo-head sk-fixed-32">
                  <h3 className="sk-line">
                    <Sk w="70%" />
                  </h3>
                </div>
                <div className="demo-meta sk-line sk-fixed-22">
                  <Sk w="50%" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * Rangée des 4 indicateurs en squelette (carte héros comprise). Sert aussi de gabarit invisible pour
 * « Les statistiques apparaîtront après la première publication » : même hauteur, aucun décalage.
 */
export function KpiSkeletonRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className={`stat-row${hidden ? ' stat-row--ghost' : ''}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <article key={i} className={`fd-card fd-kpi stat-tile${i === 0 ? ' fd-card--hero' : ''}`}>
          <div className="fd-card__head" style={{ margin: 0 }}>
            <Sk w={36} h={36} className="sk--round" />
            <span className="fd-kpi__label stat-label sk-line">
              <Sk w="60%" />
            </span>
          </div>
          <span className="fd-kpi__value stat-value sk-line">
            <Sk w="40%" h={40} />
          </span>
          <span className="fd-kpi__foot sk-line sk-fixed-24">
            <Sk w="80%" />
          </span>
        </article>
      ))}
    </div>
  );
}
