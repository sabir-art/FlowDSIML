import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import './controls.css';

/**
 * COMP-01 §6 : curseur maison. Piste de 4 px, partie remplie en primary, poignée de 20 px.
 * `role="slider"` porté par la poignée : flèches pour un pas, Page haut et bas pour 10 pas, Début et Fin
 * pour les bornes. À la souris ou au doigt, on clique ou on fait glisser sur toute la piste.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  valueText,
  id,
  className = '',
  'aria-label': ariaLabel,
  'aria-labelledby': labelledBy,
  'aria-describedby': describedBy,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Valeur lisible (« 160 % »), annoncée à la place du nombre. */
  valueText?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const set = (v: number) => {
    const next = clamp(v);
    if (next !== value) onChange(next);
  };
  const fromPointer = (e: PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    // La poignée (20 px) reste dans la piste : sa course va de 10 px à largeur - 10 px
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left - 10) / Math.max(1, r.width - 20)));
    set(min + ratio * (max - min));
  };
  const onKey = (e: KeyboardEvent) => {
    const d: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: 10 * step,
      PageDown: -10 * step,
    };
    if (e.key === 'Home') set(min);
    else if (e.key === 'End') set(max);
    else if (e.key in d) set(value + d[e.key]!);
    else return;
    e.preventDefault();
  };
  const pct = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0;
  return (
    <div
      ref={root}
      className={`fd-slider ${className}`.trim()}
      data-disabled={disabled || undefined}
      style={{ ['--fd-slider-pct-n' as string]: pct / 100 }}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e);
        root.current?.querySelector<HTMLElement>('[role="slider"]')?.focus();
        e.preventDefault();
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <span className="fd-slider__track" aria-hidden="true">
        <span className="fd-slider__fill" />
      </span>
      <span
        id={id}
        className="fd-slider__thumb"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        aria-disabled={disabled || undefined}
        aria-orientation="horizontal"
        onKeyDown={(e) => !disabled && onKey(e)}
      />
    </div>
  );
}
