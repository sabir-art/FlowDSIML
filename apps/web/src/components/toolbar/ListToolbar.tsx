/**
 * L40 : barre de liste commune (spec docs/ux/specs/l40-barres-liste.md). Deux groupes : « Filtres » à
 * gauche (filtre principal, menus de filtre, Réinitialiser), « Tri et affichage » à droite ; tous les
 * contrôles font 40 px. Sous 768 px, les menus de filtre passent dans une feuille du bas ouverte par
 * « Filtres · n » et le tri passe en icône. Une zone role=status annonce le nombre de résultats.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Menu, type MenuItem } from '../Menu';
import './toolbar.css';

const NNBSP = ' ';

/** Déclencheur « Libellé : valeur » ouvrant un menu (filtre, ou tri avec `sort`). */
export function FilterMenu({
  icon,
  label,
  value,
  active = false,
  sort = false,
  items,
  align = 'start',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  active?: boolean;
  /** Tri : jamais « actif » ; en icône seule sous 768 px (nom accessible complet). */
  sort?: boolean;
  items: Array<MenuItem | 'separator'>;
  align?: 'start' | 'end';
}) {
  return (
    <Menu
      label={label}
      align={align}
      custom={{
        className: `fd-btn fd-filter${active && !sort ? ' fd-filter--active' : ''}${sort ? ' fd-filter--sort' : ''}`,
        content: <FilterContent icon={icon} label={label} value={value} />,
      }}
      items={items}
    />
  );
}

/** Contenu d'un déclencheur de filtre (aussi utilisé par les filtres à fenêtre propre, ex. Étiquettes). */
export function FilterContent({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <>
      <span className="fd-filter__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="fd-filter__label">
        {label}
        {NNBSP}:{' '}
      </span>
      <span className="fd-filter__value" title={value}>
        {value}
      </span>
      <ChevronDown className="fd-filter__chev" aria-hidden="true" />
    </>
  );
}

export function ListToolbar({
  lead,
  filters,
  activeCount,
  onReset,
  end,
  status,
  className = '',
}: {
  /** Premier contrôle du groupe « Filtres » (segmenté Statut, recherche) : pleine largeur sous 768 px. */
  lead?: ReactNode;
  /** Menus de filtre : dans la barre, ou dans la feuille « Filtres · n » sous 768 px. */
  filters?: ReactNode;
  /** Nombre de filtres actifs (le filtre principal compte) : « Réinitialiser » et « Filtres · n ». */
  activeCount: number;
  onReset?: () => void;
  /** Groupe « Tri et affichage ». */
  end?: ReactNode;
  /** Annonce du nombre de résultats (zone role=status visuellement masquée). */
  status: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState(false);
  const reset =
    activeCount > 0 && onReset ? (
      <button
        type="button"
        className="fd-btn fd-btn--ghost fd-btn--icon fd-toolbar__reset"
        aria-label={t('toolbar.reset')}
        title={t('toolbar.reset')}
        onClick={onReset}
      >
        <RotateCcw aria-hidden="true" />
      </button>
    ) : null;
  return (
    <div className={`fd-toolbar list-toolbar ${className}`.trim()}>
      {(lead || filters) && (
        <div className="fd-toolbar__group" role="group" aria-label={t('toolbar.filters')}>
          {lead && <div className="list-toolbar__lead">{lead}</div>}
          {filters && <div className="list-toolbar__filters">{filters}</div>}
          {reset && <span className="list-toolbar__filters">{reset}</span>}
          {filters && (
            <button
              type="button"
              className="fd-btn fd-filter list-toolbar__more"
              aria-haspopup="dialog"
              aria-expanded={sheet}
              onClick={() => setSheet(true)}
            >
              <SlidersHorizontal aria-hidden="true" />
              <span className="fd-filter__value">
                {activeCount ? t('toolbar.moreCount', { count: activeCount }) : t('toolbar.filters')}
              </span>
            </button>
          )}
        </div>
      )}
      {end && (
        <div
          className="fd-toolbar__group fd-toolbar__group--end"
          role="group"
          aria-label={t('toolbar.sortView')}
        >
          {end}
        </div>
      )}
      <p className="sr-only" role="status">
        {status}
      </p>
      {sheet && filters && (
        <FiltersSheet onClose={() => setSheet(false)} reset={reset}>
          {filters}
        </FiltersSheet>
      )}
    </div>
  );
}

/** Feuille du bas (mobile) : mêmes menus de filtre en liste, « Réinitialiser les filtres », Fermer. */
function FiltersSheet({
  children,
  reset,
  onClose,
}: {
  children: ReactNode;
  reset: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Échap ferme la feuille sauf si un menu est ouvert (il se ferme d'abord)
      if (e.key === 'Escape' && !document.querySelector('#fd-portal .menu-list')) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [onClose]);
  return (
    <div className="list-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className="list-sheet" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <div className="list-sheet__head">
          <h2 id={`${id}-t`}>{t('toolbar.filters')}</h2>
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon"
            aria-label={t('toolbar.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="list-sheet__body">
          {children}
          {reset}
        </div>
      </div>
    </div>
  );
}
