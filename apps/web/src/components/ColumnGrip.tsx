/**
 * COL-02 (COMP-01 §19) : poignée de bord d'une colonne secondaire.
 *  - une pastille (bouton) replie ou déplie la colonne ;
 *  - tout le filet est un séparateur : glissement à la souris, ← → Début Fin et Entrée au clavier.
 * La largeur et l'état replié sont gardés dans le navigateur, séparément pour chaque colonne.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { unit } from '../lib/format';

export interface ColumnBounds {
  min: number;
  max: number;
  def: number;
}

const STEP = 16;
/** Marge sous le minimum avant de replier pendant un glissement */
const SNAP = 24;

interface Stored {
  w: number;
  closed: boolean;
}

function read(key: string, bounds: ColumnBounds, closedByDefault: boolean): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Stored> | null;
    if (raw && typeof raw === 'object')
      return {
        w: Math.min(bounds.max, Math.max(bounds.min, Number(raw.w) || bounds.def)),
        closed: typeof raw.closed === 'boolean' ? raw.closed : closedByDefault,
      };
  } catch {
    /* préférence illisible : valeurs par défaut */
  }
  return { w: bounds.def, closed: closedByDefault };
}

/** Largeur et état replié d'une colonne, gardés dans le navigateur. */
export function useColumn(key: string, bounds: ColumnBounds, closedByDefault = false) {
  const [state, setState] = useState(() => read(key, bounds, closedByDefault));
  // Dernier état connu : deux réglages dans le même geste (largeur, puis repli) ne s'écrasent pas
  const last = useRef(state);
  const save = useCallback(
    (patch: Partial<Stored>) => {
      const next = { ...last.current, ...patch };
      last.current = next;
      setState(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* préférence non gardée */
      }
    },
    [key],
  );
  return {
    width: state.w,
    closed: state.closed,
    setWidth: (w: number) =>
      save({ w: Math.min(bounds.max, Math.max(bounds.min, Math.round(w))), closed: false }),
    setClosed: (closed: boolean) => save({ closed }),
  };
}

export function ColumnGrip({
  controls,
  width,
  closed,
  bounds,
  labels,
  onWidth,
  onClosed,
  onDragging,
}: {
  /** id de la colonne pilotée */
  controls: string;
  width: number;
  closed: boolean;
  bounds: ColumnBounds;
  labels: { collapse: string; expand: string; width: string };
  onWidth: (w: number) => void;
  onClosed: (closed: boolean) => void;
  /** Pas d'animation de largeur pendant un glissement */
  onDragging?: (dragging: boolean) => void;
}) {
  const [drag, setDrag] = useState(false);
  const start = useRef<{ x: number; w: number } | null>(null);
  const rtl = () => document.documentElement.dir === 'rtl';

  const stop = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    start.current = null;
    setDrag(false);
    onDragging?.(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: closed ? 0 : width };
    setDrag(true);
    onDragging?.(true);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const raw = start.current.w + (e.clientX - start.current.x) * (rtl() ? -1 : 1);
    if (raw < bounds.min - SNAP) {
      // En dessous du minimum, la colonne se replie ; rouverte, elle retrouve sa largeur d'avant le geste
      if (!closed) {
        if (start.current.w) onWidth(start.current.w);
        onClosed(true);
      }
    } else if (raw >= bounds.min || !closed) onWidth(raw);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = rtl() ? -1 : 1;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = width - STEP * dir;
    else if (e.key === 'ArrowRight') next = width + STEP * dir;
    else if (e.key === 'Home') next = bounds.min;
    else if (e.key === 'End') next = bounds.max;
    else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onClosed(!closed);
      return;
    }
    if (next === null) return;
    // Ces touches règlent la colonne : elles ne déclenchent pas les raccourcis de la page (éditeur)
    e.preventDefault();
    e.stopPropagation();
    onWidth(next);
  };

  return (
    <div className={`fd-cgrip${closed ? ' is-closed' : ''}${drag ? ' is-drag' : ''}`}>
      {/* Séparateur redimensionnable (ARIA « window splitter ») : focusable et piloté au clavier */}
      <div
        className="fd-cgrip__sep"
        role="separator"
        aria-orientation="vertical"
        aria-label={labels.width}
        aria-controls={controls}
        aria-valuemin={bounds.min}
        aria-valuemax={bounds.max}
        aria-valuenow={width}
        aria-valuetext={unit(width, 'px')}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={onKey}
      />
      <button
        type="button"
        className="fd-cgrip__btn"
        aria-label={closed ? labels.expand : labels.collapse}
        aria-expanded={!closed}
        aria-controls={controls}
        onClick={() => onClosed(!closed)}
      >
        {closed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
      </button>
      {drag && !closed && (
        <span className="fd-cgrip__width" aria-hidden="true">
          {width}&nbsp;px
        </span>
      )}
    </div>
  );
}
