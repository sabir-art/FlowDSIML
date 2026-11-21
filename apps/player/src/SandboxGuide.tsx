import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { ChevronRight, Route } from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import type { Rect } from '@flowdsiml/manifest';
import { beaconCenter, tipClass } from '@flowdsiml/player-core';
import { fmt, type Dict } from './i18n';
import type { GuidePoint, GuideView } from './guide';

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const;

/**
 * A8 : bulle du guide (spec a8-guide-sandbox §4-5). Dialogue NON modal : le focus n'est pas volé, le
 * texte est annoncé par la région aria-live du lecteur. Sur petit écran, feuille du bas (remonte en
 * haut si la zone est dans le tiers bas). Ancrée sur la zone visée (fractions du cadre), sinon centrée.
 */
export function GuideBubble({
  t,
  sub,
  html,
  point,
  box,
  found,
  k,
  n,
  sheet,
  startsOn,
  done,
  onNext,
  onSkip,
  onGo,
  onClose,
}: {
  t: Dict;
  sub: (s: string) => string;
  html: (s: string) => string;
  point: GuidePoint | null;
  /** Zone visée, en fractions du cadre (null : bulle centrée). */
  box: Rect | null;
  /** false : élément introuvable, la zone est le rect de secours (pas d'équivalent clavier dans la page). */
  found: boolean;
  k: number;
  n: number;
  sheet: boolean;
  startsOn: string | null;
  done: boolean;
  /** Absent (démo guidée HTML) : la barre de l'étape porte déjà « Suivant ». */
  onNext?: () => void;
  /** Absent (démo guidée HTML) : pas de « Explorer sans guide ». */
  onSkip?: () => void;
  onGo: () => void;
  onClose: () => void;
}) {
  const g = t.guide;
  const h = point?.hotspot;
  const anchored = !!(h && box) && !sheet;
  // La feuille du bas sort du cadre de la page (racine du lecteur) : elle ne le recouvre pas
  const root = typeof document !== 'undefined' ? document.querySelector('.p-root') : null;
  const wrap = (node: ComponentChildren) => (sheet && root ? createPortal(node as never, root) : node);
  // Petit écran : feuille collée en bas de la fenêtre, au-dessus de la barre du lecteur ; en haut seulement
  // si l'élément visé est dans le tiers bas de l'écran (spec §4.5)
  const anchor = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState<{ top: boolean; bottom: number; topPx: number } | null>(null);
  useLayoutEffect(() => {
    if (!sheet) return;
    const measure = () => {
      const fr = anchor.current?.parentElement?.getBoundingClientRect();
      const bar = document.querySelector('.p-controls')?.getBoundingClientRect();
      const head = document.querySelector('.p-top')?.getBoundingClientRect();
      const elY = fr && box ? fr.top + (box.y + box.h / 2) * fr.height : 0;
      setPlace({
        top: !!box && elY > (window.innerHeight * 2) / 3,
        bottom: bar && bar.height ? window.innerHeight - bar.top + 8 : 8,
        topPx: head ? head.bottom + 8 : 8,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [sheet, box?.x, box?.y, box?.w, box?.h]);
  const top = sheet && !!place?.top;
  const cls = sheet
    ? `p-gd p-gd--sheet${top ? ' p-gd--top' : ''}`
    : anchored
      ? `p-gd ${tipClass(box!, h!.placement)}`
      : 'p-gd p-gd--center';
  return (
    <>
      {h && box && <div class="p-gd-ring" style={ring(box)} aria-hidden="true" />}
      {sheet && <span ref={anchor} hidden />}
      {wrap(
        <div
          class={cls}
          style={
            anchored
              ? beaconCenter(box!)
              : sheet && place
                ? top
                  ? { top: `${place.topPx}px` }
                  : { bottom: `${place.bottom}px` }
                : undefined
          }
          role="dialog"
          aria-modal="false"
          aria-labelledby="p-gd-t"
        >
          {done ? (
            <>
              <p id="p-gd-t" class="p-gd-body">
                {g.done}
              </p>
              <div class="p-actions">
                <button type="button" class="p-btn p-btn-primary p-btn-sm" onClick={onClose}>
                  {g.close}
                </button>
              </div>
            </>
          ) : startsOn ? (
            <>
              <p id="p-gd-t" class="p-gd-body">
                {fmt(g as unknown as Record<string, string>, 'startsOn', { page: startsOn })}
              </p>
              <div class="p-actions">
                <button type="button" class="p-btn p-btn-link p-btn-sm" onClick={onSkip}>
                  {g.skip}
                </button>
                <button type="button" class="p-btn p-btn-primary p-btn-sm" onClick={onGo}>
                  {g.goThere}
                </button>
              </div>
            </>
          ) : (
            h && (
              <>
                <div id="p-gd-t" class="p-tip-title">
                  {sub(h.title) || fmt(g as unknown as Record<string, string>, 'step', { k: k + 1, n })}
                </div>
                {h.body && <div class="p-rich" dangerouslySetInnerHTML={{ __html: html(h.body) }} />}
                <div class="p-actions">
                  <span class="p-gd-count">
                    {fmt(g as unknown as Record<string, string>, 'step', { k: k + 1, n })}
                  </span>
                  {onSkip && (
                    <button type="button" class="p-btn p-btn-link p-btn-sm" onClick={onSkip}>
                      {g.skip}
                    </button>
                  )}
                  {/* « Suivant » pour une étape sans geste ; au clic, équivalent clavier sans zone visée */}
                  {onNext && (point!.advance === 'next' || !found) && (
                    <button type="button" class="p-btn p-btn-primary p-btn-sm" onClick={onNext}>
                      {g.next}
                      <ChevronRight {...ICON} size={14} />
                    </button>
                  )}
                </div>
              </>
            )
          )}
        </div>,
      )}
    </>
  );
}

const ring = (b: Rect) => {
  const pct = (v: number) => `${Math.round(v * 100000) / 1000}%`;
  return { left: pct(b.x), top: pct(b.y), width: pct(b.w), height: pct(b.h) };
};

/**
 * A8 : pastille du guide dans la barre du lecteur. Active : ouvre un menu (reprendre, recommencer,
 * quitter) ; en pause : ramène à l'étape ; quitté : reprend le guide.
 */
export function GuidePill({
  t,
  view,
  k,
  n,
  short,
  btnRef,
  onBack,
  onRestart,
  onQuit,
}: {
  t: Dict;
  view: Extract<GuideView, { kind: 'guide' }>;
  k: number;
  n: number;
  short: boolean;
  btnRef: { current: HTMLButtonElement | null };
  onBack: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  const g = t.guide as unknown as Record<string, string>;
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menu.current?.contains(e.target as Node)) {
        setOpen(false);
        if (e instanceof KeyboardEvent) btnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [open, btnRef]);
  if (!view.pill) return null;
  const vars = { k: k + 1, n };
  const act = (f: () => void) => () => {
    setOpen(false);
    f();
  };
  if (view.pill !== 'active')
    return (
      <button ref={btnRef} type="button" class="p-btn p-btn-ghost p-btn-sm p-gd-pill" onClick={onBack}>
        <Route {...ICON} />
        <span>{view.pill === 'paused' ? fmt(g, short ? 'pillShort' : 'paused', vars) : g.resume}</span>
      </button>
    );
  return (
    <div class="p-gd-pillwrap">
      <button
        ref={btnRef}
        type="button"
        class="p-btn p-btn-ghost p-btn-sm p-gd-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Route {...ICON} />
        {/* Nom complet pour les lecteurs d'écran, texte court à l'écran */}
        <span aria-hidden="true">{fmt(g, short ? 'pillShort' : 'pill', vars)}</span>
        <span class="sr-only">{fmt(g, 'pillName', vars)}</span>
      </button>
      {open && (
        <div ref={menu} class="p-gd-menu" role="menu">
          <button type="button" role="menuitem" class="p-menu-item" onClick={act(onBack)}>
            {fmt(g, 'resumeAt', vars)}
          </button>
          <button type="button" role="menuitem" class="p-menu-item" onClick={act(onRestart)}>
            {g.restart}
          </button>
          <button type="button" role="menuitem" class="p-menu-item" onClick={act(onQuit)}>
            {g.quit}
          </button>
        </div>
      )}
    </div>
  );
}
