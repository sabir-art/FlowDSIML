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
  // Lot B (recette UX §3.4) : adresse de la page (préremplie à la capture, modifiable), sinon celle de la démo
  const stepAddress = ((step?.options as { address?: unknown } | null)?.address as string | undefined) ?? '';
  const shown = stepAddress || frame.address;
  const url = shown || captureUrl;
  const dots = frame.windowButtons && frame.style !== 'minimal' && (
    <>
      <i />
      <i />
      <i />
    </>
  );
  const address = frame.addressBar && <span className={`url${shown ? '' : ' is-capture'}`}>{url}</span>;
  const withTabs = tabs.length > 0 && frame.style !== 'minimal';
  return (
    <div className={`browser browser--${frame.style}${withTabs ? ' has-tabs' : ''}`} aria-hidden="true">
      <span
        className="browser-row"
        /* §18.6 : pastilles de fenêtre du faux navigateur, décor */ data-gap-exempt=""
      >
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
