import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, Pencil, Play, Plus, Redo2, Rocket, Share2, Undo2 } from 'lucide-react';
import { Sk } from '../../components/Skeleton';
import { BackButton, Select } from '@flowdsiml/ui';

const BackLink = (p: { to: string; className?: string; title?: string; children?: ReactNode }) => (
  <Link {...p} />
);

const ratioKey = (demoId: string) => `fd.ed.r.${demoId}`;

function readStore(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Géométrie de la dernière visite : ratio du canevas (par démo). */
export function readEditorGeometry(demoId: string) {
  const ratio = readStore(ratioKey(demoId));
  return {
    ratio: ratio && /^\d+(\.\d+)? \/ \d+(\.\d+)?$/.test(ratio) ? ratio : '16 / 10',
  };
}

/** À l'affichage de l'éditeur réel : mémorise ce que le squelette doit réserver la prochaine fois. */
export function storeEditorGeometry(demoId: string) {
  try {
    const ratio = document.querySelector<HTMLElement>('.stage .canvas-frame')?.style.aspectRatio;
    if (ratio) localStorage.setItem(ratioKey(demoId), ratio);
  } catch {
    /* stockage indisponible : 16:10 par défaut */
  }
}

/**
 * L32 §3 : squelette de l'éditeur (disposition L48-E). Barre du haut, étapes, cadre du canevas, panneau et rail
 * (désactivés) ; titre, statut, étapes, image et champs en blocs. `children` : zone sous la barre
 * (erreur à la place du contenu, ligne « plus long que prévu »).
 */
export function EditorSkeleton({
  demoId,
  showBlocks,
  status,
  after,
  children,
}: {
  /** false : page vide sous la barre (réponse en moins de 200 ms, pas de clignotement). */
  showBlocks: boolean;
  demoId: string;
  status?: ReactNode;
  /** Ligne « plus long que prévu », dans l'en-tête de la scène. */
  after?: ReactNode;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const geo = readEditorGeometry(demoId);
  return (
    <main
      className={`mk ed${children ? ' on-content' : ''}`}
      id="main"
      aria-busy={showBlocks || !children ? 'true' : 'false'}
    >
      {status}
      <h1 className="sr-only">{t('loading.editor')}</h1>
      {/* Même structure que la barre réelle (gauche · onglets · droite), actions désactivées. Erreur ou démo
          indisponible (`children`) : seulement « ← Démos », rien d'autre n'est utilisable. */}
      <header className="fd-page-header fd-page-header--editor ed-bar">
        <div className="ed-bar__l">
          <BackButton to="/" label={t('demos.title')} ariaLabel={t('editor.backToDemos')} as={BackLink} />
          {!children && (
            <>
              <span className="ed-vsep" aria-hidden="true" />
              <span className="ed-title ed-title--sk">{showBlocks && <Sk w={200} />}</span>
            </>
          )}
        </div>
        {!children && (
          <div className="ed-tabs" aria-hidden="true">
            <div className="ed-tabs__modes">
              <button type="button" aria-checked disabled tabIndex={-1}>
                <Pencil aria-hidden="true" />
                {t('editor.modeEdit')}
              </button>
              <button type="button" aria-checked={false} disabled tabIndex={-1}>
                <Play aria-hidden="true" />
                {t('editor.preview')}
              </button>
            </div>
          </div>
        )}
        {!children && (
          <div className="ed-bar__r">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={t('editor.undo')}
              disabled
            >
              <Undo2 aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label={t('editor.redo')}
              disabled
            >
              <Redo2 aria-hidden="true" />
            </button>
            <button
              type="button"
              className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
              aria-label={t('editor.more')}
              disabled
            >
              <MoreHorizontal aria-hidden="true" />
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled>
              <Share2 aria-hidden="true" />
              {t('editor.share')}
            </button>
            <span className="ed-publish">
              <button type="button" className="btn btn-primary btn-sm" disabled>
                <Rocket aria-hidden="true" />
                {t('publish.publish')}
              </button>
            </span>
          </div>
        )}
      </header>
      {children ?? (
        <div className="ed-body">
          <nav className="rail" aria-label={t('editor.steps')}>
            <div className="rail-head">
              <b className="t-label">{t('editor.steps')}</b>
              <button
                type="button"
                className="fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon menu-trigger"
                aria-label={t('editor.addStep')}
                disabled
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
            <ol className="rail-list" aria-hidden="true">
              {showBlocks &&
                Array.from({ length: 5 }, (_, i) => (
                  <li key={i} className="rail-li">
                    <span className="step">
                      <span className="n">{i + 1}</span>
                      <span className="th th--sk">
                        <Sk w="100%" h="100%" style={{ borderRadius: 'inherit' }} />
                      </span>
                      <span className="meta">
                        <span className="sk-line">
                          <Sk w="80%" />
                        </span>
                        <span className="sk-line">
                          <Sk w="50%" />
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
            </ol>
            <div className="rail-foot">
              <button type="button" className="fd-btn fd-btn--sm fd-btn--block menu-trigger" disabled>
                <span className="fd-btn__icon" aria-hidden="true">
                  <Plus />
                </span>
                {t('editor.addStep')}
              </button>
            </div>
          </nav>
          <section className="stage" aria-label={t('editor.canvas')} id="canvas">
            <div className="row stage-head">
              <span className="t-caption muted sk-line">{showBlocks && <Sk w={160} />}</span>
              {/* Ligne « plus long que prévu » dans l'en-tête : aucun décalage de la scène */}
              {after || <span className="grow" />}
              <Select size="sm" className="stage-zoom" aria-label={t('editor.zoom')} disabled>
                <option>{t('editor.zoomFit')}</option>
              </Select>
            </div>
            <div className="stage-main">
              <div className="stage-inner">
                <div className="frame fd-player-scope frame--fit">
                  <div className="browser browser--classic" aria-hidden="true">
                    <span
                      className="browser-row"
                      /* §18.6 : pastilles de fenêtre du faux navigateur, décor */ data-gap-exempt=""
                    >
                      <i />
                      <i />
                      <i />
                      <span className="url is-capture" />
                    </span>
                  </div>
                  <div className="shot">
                    <div className="canvas-frame canvas-frame--sk" style={{ aspectRatio: geo.ratio }}>
                      {showBlocks && <Sk w="100%" h="100%" style={{ borderRadius: 0 }} />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* L48-E : panneau de l'outil (360 px) et rail d'outils (56 px), en blocs */}
          <aside className="ed-tool" aria-hidden="true">
            <div className="ed-tool__head">{showBlocks && <Sk w={120} />}</div>
            <div className="ed-tool__body">
              {showBlocks &&
                [0, 1, 2].map((i) => (
                  <div key={i} className="sec">
                    <div className="sec-title sk-line">
                      <Sk w="35%" />
                    </div>
                    <Sk w="100%" h={40} className="sk-field" />
                    <Sk w="100%" h={40} className="sk-field" />
                  </div>
                ))}
            </div>
          </aside>
          <div className="ed-rail" aria-hidden="true">
            {showBlocks && [0, 1, 2, 3, 4].map((i) => <Sk key={i} w={40} h={40} />)}
          </div>
        </div>
      )}
    </main>
  );
}
