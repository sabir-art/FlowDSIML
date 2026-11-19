import type { StepRow } from '../types';
import { showTabs, tabsAt } from './tabs';

/**
 * Barre du navigateur du canevas (A2-01). L25-06 : quand l'étape a été capturée avec le suivi des
 * onglets, les onglets ouverts jusqu'ici s'affichent, celui de l'étape actif. Décorative (aria-hidden) :
 * l'onglet est indiqué dans le panneau Étape.
 */
export function BrowserBar({ steps, index }: { steps: StepRow[]; index: number }) {
  const step = steps[index];
  const { tabs, active } = tabsAt(steps, index);
  const url = step?.page_url?.replace(/^https?:\/\//, '');
  const withTabs = tabs.length > 0 && showTabs(step);
  return (
    <div className={`browser${withTabs ? ' has-tabs' : ''}`} aria-hidden="true">
      <span className="browser-row">
        <i />
        <i />
        <i />
        {withTabs ? (
          <span className="browser-tabs">
            {tabs.map((t) => (
              <span key={t.n} className={`browser-tab${t.n === active ? ' is-active' : ''}`}>
                <span className="browser-fav" />
                <span className="browser-tab-t">{t.title || `#${t.n}`}</span>
              </span>
            ))}
          </span>
        ) : (
          url && <span className="url">{url}</span>
        )}
      </span>
      {withTabs && url && (
        <span className="browser-row browser-row--url">
          <span className="url">{url}</span>
        </span>
      )}
    </div>
  );
}
