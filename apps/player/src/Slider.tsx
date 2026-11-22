import { useRef } from 'preact/hooks';

/**
 * COMP-01 §6 : curseur maison du lecteur (aucun `<input type="range">`). Piste de 4 px, partie remplie à la
 * couleur du thème, poignée de 20 px. `role="slider"` sur la poignée : flèches pour un pas, Page haut et
 * bas pour 10 pas, Début et Fin pour les bornes ; clic ou glissement sur toute la piste.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  label,
  valueText,
  onChange,
  stopKeys = false,
  class: cls = '',
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Nom accessible du curseur. */
  label: string;
  /** Valeur lisible (« 55 % Avant visible »), annoncée à la place du nombre. */
  valueText?: string;
  onChange: (value: number) => void;
  /** Les touches du curseur ne remontent pas aux raccourcis du lecteur (vidéo). */
  stopKeys?: boolean;
  class?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
    if (next !== value) onChange(next);
  };
  const fromPointer = (e: PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left - 10) / Math.max(1, r.width - 20)));
    set(min + ratio * (max - min));
  };
  const onKey = (e: KeyboardEvent) => {
    if (stopKeys) e.stopPropagation();
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
    // Une touche traitée par le curseur ne déclenche pas les raccourcis du lecteur (étape suivante…)
    e.stopPropagation();
    e.preventDefault();
  };
  const ratio = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  return (
    <div
      ref={root}
      class={`p-slider ${cls}`.trim()}
      style={{ '--p-slider-n': String(ratio) }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        fromPointer(e);
        root.current?.querySelector<HTMLElement>('[role="slider"]')?.focus();
        e.preventDefault();
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <span class="p-slider__track" aria-hidden="true">
        <span class="p-slider__fill" />
      </span>
      <span
        class="p-slider__thumb"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        aria-orientation="horizontal"
        onKeyDown={onKey}
      />
    </div>
  );
}
