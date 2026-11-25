import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudOff } from 'lucide-react';
import './skeleton.css';

/** Bloc de squelette (spec L32 §1.2) : largeur et hauteur fixes, jamais aléatoires. */
export function Sk({
  w = '100%',
  h,
  className = '',
  style,
}: {
  w?: string | number;
  h?: string | number;
  className?: string;
  style?: CSSProperties;
}) {
  return <span className={`sk ${className}`} aria-hidden="true" style={{ width: w, height: h, ...style }} />;
}

export type LoadPhase = 'blank' | 'skeleton' | 'content';

/**
 * MOTION-01 §3 « Squelette vers contenu » : fondu croisé. Au moment où le contenu remplace le squelette,
 * une copie inerte du squelette (repérée par `data-skeleton`) reste posée au même endroit et s'efface en
 * 200 ms au-dessus du contenu, qui apparaît dessous : jamais un contenu qui « saute ». Opacité seule ;
 * rien en mouvement réduit (durée du jeton à 0).
 */
type SkeletonSnapshot = { node: HTMLElement; rect: DOMRect };
/** Copie décorative du squelette affiché (prise tant qu'il est à l'écran). */
function snapshotSkeleton(): SkeletonSnapshot | null {
  const src = document.querySelector<HTMLElement>('[data-skeleton]');
  if (!src) return null;
  const rect = src.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const node = src.cloneNode(true) as HTMLElement;
  // Ni identifiants en double, ni rôle, ni références ARIA
  for (const el of [node, ...node.querySelectorAll<HTMLElement>('*')])
    for (const a of [
      'id',
      'role',
      'aria-busy',
      'aria-labelledby',
      'aria-describedby',
      'aria-controls',
      'for',
    ])
      el.removeAttribute(a);
  node.removeAttribute('data-skeleton');
  return { node, rect };
}
function fadeSkeletonOut(snap: SkeletonSnapshot | null) {
  if (!snap) return;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fd-motion-duration-base').trim();
  const ms = v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : 0;
  if (!(ms > 0)) return;
  // Posée dans le corps de la page (son conteneur d'origine est remplacé par le contenu), dans une
  // enveloppe inerte qui garde la portée des styles de l'app
  const wrap = document.createElement('div');
  wrap.className = 'mk sk-ghost';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.setAttribute('inert', '');
  wrap.appendChild(snap.node);
  Object.assign(snap.node.style, { width: '100%', height: '100%', margin: '0' });
  Object.assign(wrap.style, {
    position: 'fixed',
    left: `${snap.rect.left}px`,
    top: `${snap.rect.top}px`,
    width: `${snap.rect.width}px`,
    height: `${snap.rect.height}px`,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '5',
  });
  document.body.appendChild(wrap);
  const done = () => wrap.remove();
  const anim = wrap.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: ms,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  });
  anim.onfinish = done;
  anim.oncancel = done;
}

/**
 * Délais de la spec L32 §1.4 et §4 : squelette seulement au-delà de 200 ms, puis visible 300 ms au moins ;
 * ligne « plus long que prévu » à 10 s, erreur à 30 s. `loading` = requête de démarrage en cours.
 */
export function useSkeleton(loading: boolean) {
  const [shown, setShown] = useState(false);
  const [hold, setHold] = useState(false);
  const [slow, setSlow] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const shownAt = useRef(0);
  const startedAt = useRef(Date.now());
  const [longLoad, setLongLoad] = useState(false);
  // MOTION-01 : copie du squelette, prise quand il vient de s'afficher (à l'arrivée du contenu, React
  // l'a déjà retiré)
  const ghost = useRef<SkeletonSnapshot | null>(null);
  useEffect(() => {
    if (shown) ghost.current = snapshotSkeleton();
    else ghost.current = null;
  }, [shown]);

  useEffect(() => {
    if (loading) {
      startedAt.current = Date.now();
      setSlow(false);
      setTimedOut(false);
      const a = window.setTimeout(() => {
        shownAt.current = Date.now();
        setShown(true);
      }, 200);
      const b = window.setTimeout(() => setSlow(true), 10_000);
      const c = window.setTimeout(() => setTimedOut(true), 30_000);
      return () => {
        window.clearTimeout(a);
        window.clearTimeout(b);
        window.clearTimeout(c);
      };
    }
    // Fin du chargement : annonce seulement s'il a duré plus de 2 s
    setLongLoad(Date.now() - startedAt.current > 2000);
    setSlow(false);
    if (!shown) return;
    const left = 300 - (Date.now() - shownAt.current);
    if (left <= 0) {
      fadeSkeletonOut(ghost.current);
      ghost.current = null;
      setShown(false);
      return;
    }
    setHold(true);
    const t = window.setTimeout(() => {
      fadeSkeletonOut(ghost.current);
      ghost.current = null;
      setHold(false);
      setShown(false);
    }, left);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seul le passage de loading compte
  }, [loading]);

  const phase: LoadPhase = loading ? (shown ? 'skeleton' : 'blank') : hold ? 'skeleton' : 'content';
  return { phase, slow, timedOut, longLoad };
}

/** aria-busy sur la zone principale pendant le chargement (spec §1.6). */
export function useMainBusy(busy: boolean) {
  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    main.setAttribute('aria-busy', busy ? 'true' : 'false');
    return () => main.removeAttribute('aria-busy');
  }, [busy]);
}

/** Annonce visuellement masquée : « Chargement… », puis la fin si le chargement a été long. */
export function LoadStatus({
  loading,
  longLoad,
  busy,
  done,
}: {
  loading: boolean;
  longLoad: boolean;
  busy: string;
  done: string;
}) {
  return (
    <span className="sr-only" role="status">
      {loading ? busy : longLoad ? done : ''}
    </span>
  );
}

/** « Le chargement prend plus de temps que prévu. » + Réessayer (spec §4, 10 s). */
export function SlowLine({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <p className="sk-slow">
      {t('loading.slow')}{' '}
      <button type="button" className="link-button sk-link" onClick={onRetry}>
        {t('loading.retry')}
      </button>
    </p>
  );
}

/** Carte d'erreur (spec §4) : focus sur le titre, role=alert, « Réessayer » ne relance que la requête. */
export function LoadError({
  title,
  body,
  onRetry,
  extra,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="fd-card load-error" role="alert">
      <CloudOff className="load-error__icon" aria-hidden="true" />
      <h2 ref={ref} tabIndex={-1} className="load-error__title">
        {title}
      </h2>
      <p className="fd-muted">{body}</p>
      <div className="load-error__acts">
        {onRetry && (
          <button type="button" className="fd-btn fd-btn--primary" onClick={onRetry}>
            {t('loading.retry')}
          </button>
        )}
        {extra}
      </div>
    </div>
  );
}
