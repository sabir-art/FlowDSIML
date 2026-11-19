import type { Frame } from '@flowdsiml/manifest';
import type { StepRow } from '../types';
import { showTabs, tabsAt } from './tabs';

/**
 * Barre du navigateur du canevas. L25-03 : style du cadre (clair, sombre, minimal, aucun), barre
 * d'adresse, onglets et boutons de fenêtre réglés pour la démo. L25-06 : onglets de la capture
 * (celui de l'étape actif). Sans adresse saisie, l'éditeur montre l'adresse de la capture en gris :
 * elle n'est pas publiée. Décorative (aria-hidden).
 */
export function BrowserBar({
  steps,
  index,
  frame,
  demoTitle = '',
}: {
  steps: StepRow[];
  index: number;
  frame: Frame;
  demoTitle?: string;
}) {
  const step = steps[index];
  if (frame.style === 'none') return null;
  const captured = tabsAt(steps, index);
  const stepTabs = captured.tabs.length > 0 && showTabs(step);
  const tabs = stepTabs
    ? captured.tabs
    : frame.tabs
      ? [{ n: 1, title: frame.tabTitle || step?.page_title || demoTitle }]
      : [];
  const active = stepTabs ? captured.active : 1;
  const captureUrl = step?.page_url?.replace(/^https?:\/\//, '') ?? '';
  const url = frame.address || captureUrl;
  const dots = frame.windowButtons && frame.style !== 'minimal' && (
    <>
      <i />
      <i />
      <i />
    </>
  );
  const address = frame.addressBar && (
    <span className={`url${frame.address ? '' : ' is-capture'}`}>{url}</span>
  );
  const withTabs = tabs.length > 0 && frame.style !== 'minimal';
  return (
    <div className={`browser browser--${frame.style}${withTabs ? ' has-tabs' : ''}`} aria-hidden="true">
      <span className="browser-row">
        {dots}
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
          address
        )}
      </span>
      {withTabs && frame.addressBar && <span className="browser-row browser-row--url">{address}</span>}
    </div>
  );
}
