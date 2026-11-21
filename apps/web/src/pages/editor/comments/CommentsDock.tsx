/**
 * Retours client 21/11 §1 : commentaires dans un panneau sous le canevas (comme des notes de
 * présentateur), qui n'en réduit jamais la largeur. Replié : barre de 40 px ; déplié : 240 px par
 * défaut, de 160 px à 50 % de la colonne, poignée en role=separator. État par utilisateur dans
 * localStorage (fd.comments.dock), Alt + C ouvre et ferme (géré par l'éditeur).
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Lock, MessageSquare } from 'lucide-react';
import { CommentsPanel, readSeen } from './CommentsPanel';
import type { StepCommentsApi } from './useStepComments';

const KEY = 'fd.comments.dock';
export const DOCK_MIN = 160;
const DOCK_DEFAULT = 240;
const STEP = 16;

export interface DockState {
  open: boolean;
  height: number;
}

/** État retenu, avec une valeur sûre si le stockage est indisponible ou illisible. */
export function readDock(): DockState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<DockState> | null;
    return {
      open: v?.open === true,
      height: typeof v?.height === 'number' && v.height >= DOCK_MIN ? v.height : DOCK_DEFAULT,
    };
  } catch {
    return { open: false, height: DOCK_DEFAULT };
  }
}
export function storeDock(s: DockState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible : l'état vaut pour la session */
  }
}

/** Commentaires ouverts de l'étape et, parmi eux, ceux d'un autre membre postés depuis la dernière lecture. */
export function dockCounts(api: StepCommentsApi, stepId: string | null, myId: string | undefined) {
  const open = api.comments.filter((c) => c.step_id === stepId && !c.resolved_at);
  const seenAt = stepId ? Date.parse(readSeen()[stepId] ?? '') || 0 : 0;
  const unread = open.filter((c) => c.author_id !== myId && Date.parse(c.created_at) > seenAt).length;
  return { open: open.length, unread };
}

export function CommentsDock({
  stepId,
  stepIndex,
  api,
  myId,
  focusComment,
  open,
  height,
  onToggle,
  onHeight,
}: {
  stepId: string | null;
  stepIndex: number;
  api: StepCommentsApi;
  myId: string | undefined;
  focusComment?: string | null;
  open: boolean;
  height: number;
  onToggle: () => void;
  onHeight: (h: number) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // 50 % de la colonne du canevas au plus (mesurée en continu)
  const [max, setMax] = useState(DOCK_MIN * 2);
  useLayoutEffect(() => {
    const col = ref.current?.parentElement;
    if (!col) return;
    const update = () => setMax(Math.max(DOCK_MIN, Math.floor(col.clientHeight / 2)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(col);
    return () => ro.disconnect();
  }, []);
  const h = Math.min(Math.max(height, DOCK_MIN), max);

  // Focus : sur le champ de saisie à l'ouverture, sur le bouton à la fermeture (actions de l'utilisateur).
  // Sans défilement : pendant l'animation de hauteur, le champ est encore sous la fenêtre
  const prev = useRef(open);
  useEffect(() => {
    if (prev.current === open) return;
    prev.current = open;
    if (open)
      requestAnimationFrame(() =>
        ref.current?.querySelector<HTMLElement>('.cm-compose textarea')?.focus({ preventScroll: true }),
      );
    else if (ref.current?.contains(document.activeElement) || document.activeElement === document.body)
      button.current?.focus();
  }, [open]);

  const { open: n, unread: u } = dockCounts(api, stepId, myId);
  const label =
    n === 0
      ? t('editor.comments.dockNone')
      : u > 0
        ? t('editor.comments.dockUnread', { count: n, unread: u })
        : t('editor.comments.dockOpen', { count: n });

  // Poignée : glisser (pointeur) ou flèches de 16 px, Début et Fin
  const drag = useRef<{ y: number; h: number } | null>(null);
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, h };
    e.currentTarget.setPointerCapture(e.pointerId);
    ref.current?.classList.add('is-resizing');
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onHeight(Math.min(max, Math.max(DOCK_MIN, drag.current.h + drag.current.y - e.clientY)));
  };
  const onUp = () => {
    drag.current = null;
    ref.current?.classList.remove('is-resizing');
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === 'ArrowUp'
        ? h + STEP
        : e.key === 'ArrowDown'
          ? h - STEP
          : e.key === 'Home'
            ? DOCK_MIN
            : e.key === 'End'
              ? max
              : null;
    if (next === null) return;
    e.preventDefault();
    onHeight(Math.min(max, Math.max(DOCK_MIN, next)));
  };

  return (
    <div
      ref={ref}
      className={`cm-dock${open ? ' is-open' : ''}`}
      style={open ? { height: h } : undefined}
      data-testid="comments-dock"
    >
      {open && (
        // Séparateur redimensionnable (motif APG « Window Splitter »), focalisable
        <div
          className="cm-dock__handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label={t('editor.comments.dockResize')}
          aria-controls="cm-dock-body"
          aria-valuenow={h}
          aria-valuemin={DOCK_MIN}
          aria-valuemax={max}
          tabIndex={0}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onKey}
        />
      )}
      <div className="cm-dock__bar">
        <button
          ref={button}
          type="button"
          className="cm-dock__toggle"
          aria-expanded={open}
          aria-controls="cm-dock-body"
          aria-label={label}
          aria-keyshortcuts="Alt+C"
          onClick={onToggle}
        >
          <MessageSquare aria-hidden="true" />
          <span>{t('editor.comments.title')}</span>
          {n > 0 && (
            <span className={`cm-dock__badge${u > 0 ? ' is-unread' : ''}`} aria-hidden="true">
              {n > 99 ? '99+' : n}
            </span>
          )}
          {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </button>
        {/* Mention « interne » (décrit le champ de saisie), tronquée si la colonne est étroite */}
        <span className="cm-dock__private" title={t('editor.comments.private')}>
          <Lock aria-hidden="true" />
          <span id="cm-private">{t('editor.comments.private')}</span>
        </span>
        <span className="cm-dock__step">{t('editor.stepN', { n: stepIndex + 1 })}</span>
      </div>
      <div id="cm-dock-body" className="cm-dock__body" hidden={!open}>
        {/* Monté seulement déplié : l'ouverture marque les commentaires comme lus */}
        {open && (
          <CommentsPanel
            stepId={stepId}
            stepIndex={stepIndex}
            api={api}
            focusComment={focusComment}
            variant="dock"
          />
        )}
      </div>
    </div>
  );
}
