import '../../components/kpi/kpi.css';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Folder, LayoutGrid, List, Tag as TagIcon } from 'lucide-react';
import { FilterContent } from '../../components/toolbar/ListToolbar';
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
        <h2 id="demos-list-title" className="demos-list-title">
          {t('demos.allDemos')}
        </h2>
        {/* Barre réelle et désactivée, sans compteur (même gabarit que la page, L40) */}
        <div className="fd-toolbar list-toolbar">
          <div className="fd-toolbar__group" role="group" aria-label={t('toolbar.filters')}>
            <div className="list-toolbar__lead">
              <div className="fd-segmented" role="group" aria-label={t('demos.status')}>
                {(['all', 'published', 'draft'] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={k === 'all'} disabled>
                    {t(`demos.filter_${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="list-toolbar__filters">
              <button type="button" className="fd-btn fd-filter" disabled>
                <FilterContent icon={<Folder />} label={t('demos.folderLabel')} value={t('toolbar.all')} />
              </button>
              <button type="button" className="fd-btn fd-filter" disabled>
                <FilterContent icon={<TagIcon />} label={t('tags.title')} value={t('toolbar.allF')} />
              </button>
            </div>
          </div>
          <div
            className="fd-toolbar__group fd-toolbar__group--end"
            role="group"
            aria-label={t('toolbar.sortView')}
          >
            <button type="button" className="fd-btn fd-filter fd-filter--sort" disabled>
              <FilterContent
                icon={<ArrowUpDown />}
                label={t('demos.sortLabel')}
                value={t('demos.sortUpdated')}
              />
            </button>
            <div className="fd-segmented fd-segmented--icons" role="radiogroup" aria-label={t('demos.view')}>
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
 * Bande des 4 raccourcis en squelette (L47). Sert aussi de gabarit invisible pour « Les statistiques
 * apparaîtront après la première publication » : même hauteur, aucun décalage.
 */
export function KpiSkeletonRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className={`kpi-short${hidden ? ' kpi-short--ghost' : ''}`} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="kpi-sc">
          <span className="kpi-tab__l">
            <Sk w="60%" />
          </span>
          <span className="kpi-tab__v">
            <Sk w="40%" h={35} />
          </span>
          <span className="kpi-trend">
            <Sk w="80%" />
          </span>
        </div>
      ))}
    </div>
  );
}
