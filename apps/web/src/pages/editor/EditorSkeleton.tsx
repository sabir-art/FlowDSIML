import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Crop,
  Droplet,
  ChevronUp,
  Image as ImageIcon,
  MessageSquare,
  Plus,
  Presentation,
  Rocket,
  Share2,
  Target,
  ZoomIn,
} from 'lucide-react';
import { Sk } from '../../components/Skeleton';
import { HelpButton } from '../../help/HelpButton';

const ratioKey = (demoId: string) => `fd.ed.r.${demoId}`;
const COMMENTS_KEY = 'fd.ed.cm.h';

function readStore(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Géométrie de la dernière visite : ratio du canevas (par démo) et hauteur du panneau des commentaires. */
export function readEditorGeometry(demoId: string) {
  const ratio = readStore(ratioKey(demoId));
  return {
    ratio: ratio && /^\d+(\.\d+)? \/ \d+(\.\d+)?$/.test(ratio) ? ratio : '16 / 10',
    commentsHeight: Number(readStore(COMMENTS_KEY)) || 0,
  };
}

/** À l'affichage de l'éditeur réel : mémorise ce que le squelette doit réserver la prochaine fois. */
export function storeEditorGeometry(demoId: string) {
  try {
    const ratio = document.querySelector<HTMLElement>('.stage .canvas-frame')?.style.aspectRatio;
    if (ratio) localStorage.setItem(ratioKey(demoId), ratio);
    const cm = document.querySelector('.stage .stage-comments')?.getBoundingClientRect().height;
    if (cm) localStorage.setItem(COMMENTS_KEY, String(Math.round(cm)));
  } catch {
    /* stockage indisponible : 16:10 par défaut */
  }
}

/**
 * L32 §3 : squelette de l'éditeur. Barre du haut, onglets, rail, cadre du canevas et barre d'outils réels
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
    <main className="mk ed" id="main" aria-busy={showBlocks || !children ? 'true' : 'false'}>
      {status}
      <h1 className="sr-only">{t('loading.editor')}</h1>
      <header className="ed-bar">
        <Link to="/" className="btn btn-ghost btn-sm btn-icon" aria-label={t('editor.backToDemos')}>
          <ArrowLeft aria-hidden="true" />
        </Link>
        <span className="ed-title ed-title--sk">{showBlocks && <Sk w={200} />}</span>
        {showBlocks && <Sk w={72} h={22} className="sk--round" />}
        <span className="grow" />
        <div className="segmented" role="radiogroup" aria-label={t('editor.mode')}>
          <button type="button" role="radio" aria-checked disabled>
            {t('editor.modeEdit')}
          </button>
          <button type="button" role="radio" aria-checked={false} disabled>
            {t('editor.preview')}
          </button>
        </div>
        <HelpButton className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm" />
        <button type="button" className="btn btn-secondary btn-sm" disabled>
          <Presentation aria-hidden="true" />
          {t('present.button')}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled>
          <Share2 aria-hidden="true" />
          {t('editor.share')}
        </button>
        <span className="tc-cta-grad ed-publish">
          <button type="button" className="btn btn-primary btn-sm" disabled>
            <Rocket aria-hidden="true" />
            {t('publish.publish')}
          </button>
        </span>
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
              <select className="select input-sm stage-zoom" aria-label={t('editor.zoom')} disabled>
                <option>{t('editor.zoomFit')}</option>
              </select>
            </div>
            <div className="stage-main">
              <div className="stage-inner">
                <div className="frame fd-player-scope frame--fit">
                  <div className="browser browser--classic" aria-hidden="true">
                    <span className="browser-row">
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
              <div className="floatbar" role="toolbar" aria-label={t('editor.tools')}>
                {[
                  [Target, t('editor.toolHotspot')],
                  [Droplet, t('editor.toolBlur')],
                  [ZoomIn, t('editor.toolZoom')],
                  [Crop, t('editor.toolCrop')],
                  [ImageIcon, t('editor.toolReplace')],
                ].map(([Icon, label], i) => {
                  const I = Icon as typeof Target;
                  return [
                    i === 4 && <span key="sep" className="sep" />,
                    <button
                      key={i}
                      type="button"
                      className="btn btn-ghost btn-icon"
                      aria-label={label as string}
                      title={label as string}
                      disabled
                    >
                      <I aria-hidden="true" />
                    </button>,
                  ];
                })}
              </div>
            </div>
            {geo.commentsHeight > 0 && (
              <div className="stage-comments">
                {geo.commentsHeight <= 80 ? (
                  <section className="cm cm--collapsed" aria-label={t('editor.comments.title')}>
                    <button type="button" className="cm-collapsed-bar" aria-expanded="false" disabled>
                      <span className="fd-icon-chip" aria-hidden="true">
                        <MessageSquare />
                      </span>
                      <span className="cm-collapsed-bar__title">{t('editor.comments.title')}</span>
                      <span className="cm-collapsed-bar__end">
                        <ChevronUp aria-hidden="true" />
                      </span>
                    </button>
                  </section>
                ) : (
                  <section className="cm" style={{ height: geo.commentsHeight }} aria-hidden="true" />
                )}
              </div>
            )}
          </section>
          <aside className="panel" aria-label={t('editor.properties')}>
            <div className="tabs" role="tablist" aria-label={t('editor.properties')}>
              {(['step', 'design', 'settings'] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={k === 'step'} disabled>
                  {t(`editor.tab_${k}`)}
                </button>
              ))}
            </div>
            <div className="panel-body" aria-hidden="true">
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
        </div>
      )}
    </main>
  );
}
