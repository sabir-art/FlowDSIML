import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Empty } from '@flowdsiml/ui';

/**
 * L48-B §2 : recherche ou filtres sans résultat (variante `search`, annoncée par role=status).
 * « Aucune {objet} ne correspond à « {saisie} » », nombre de filtres actifs, « Réinitialiser les filtres ».
 */
export function NoMatch({
  what,
  query,
  filters,
  onReset,
}: {
  /** Objet au pluriel indéfini, ex. « Aucune démo » (clé empty.no.*). */
  what: 'demo' | 'learner' | 'lead' | 'session';
  query: string;
  filters: number;
  onReset?: () => void;
}) {
  const { t } = useTranslation();
  const q = query.trim();
  return (
    <Empty
      variant="search"
      live
      icon={<Search />}
      title={q ? t(`empty.no.${what}Query`, { q }) : t(`empty.no.${what}`)}
      body={t('empty.searchBody', { count: filters })}
      action={
        onReset && filters > 0 ? (
          <button type="button" className="fd-btn" onClick={onReset}>
            {t('toolbar.reset')}
          </button>
        ) : undefined
      }
    />
  );
}
