import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { getPortal } from './floating';
import { usePopover } from './usePopover';
import './popover.css';
import './colorswatch.css';

/** Nuancier de la marque (COMP-01 §4) : prune, framboise, prune-700, les trois couleurs de la DSIML, encre, blanc. */
const BRAND = ['#A3195B', '#D60B52', '#85164B', '#217BAC', '#95C11F', '#F39200', '#080808', '#FFFFFF'];

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1]!, 16) : 0;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
function hsvToHex({ h, s, v }: { h: number; s: number; v: number }): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`.toUpperCase();
}
const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s);

export interface ColorSwatchLabels {
  /** Nom du groupe de pastilles (« Couleurs de la marque »). */
  palette: string;
  /** Zone de teinte : saturation et luminosité. */
  shade: string;
  /** Barre de teinte. */
  hue: string;
  /** Champ hexadécimal du sélecteur. */
  hex: string;
}

/**
 * COMP-01 §4 : pastille de couleur sans `<input type="color">`. Le bouton ouvre un popover : nuancier de
 * la marque (8 pastilles, `radiogroup`, flèches et Espace), zone de saturation et de luminosité, barre de
 * teinte et valeur hexadécimale ; tout se règle à la souris et au clavier (flèches).
 */
export function ColorSwatch({
  value,
  onChange,
  label,
  labels,
  disabled = false,
  className = '',
}: {
  /** Couleur « #RRGGBB ». */
  value: string;
  onChange: (hex: string) => void;
  /** Nom accessible du bouton (« Choisir la couleur principale »). */
  label: string;
  labels: ColorSwatchLabels;
  disabled?: boolean;
  className?: string;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(isHex(value) ? value : '#000000'));
  const [text, setText] = useState(value);
  const close = useCallback((focus: boolean) => {
    setOpen(false);
    if (focus) button.current?.focus();
  }, []);
  const { style, ready } = usePopover(open, button, pop, close);
  // La valeur vient d'ailleurs (champ voisin, « Utiliser cette couleur ») : le sélecteur suit
  useEffect(() => {
    if (isHex(value) && value.toUpperCase() !== hsvToHex(hsv)) setHsv(hexToHsv(value));
    setText(value.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(() => {
    if (open && ready)
      (
        pop.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
        pop.current?.querySelector<HTMLElement>('[role="radio"]')
      )?.focus();
  }, [open, ready]);

  const apply = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };
  const drag = useRef<'shade' | 'hue' | null>(null);
  const fromPointer = (e: PointerEvent, kind: 'shade' | 'hue') => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width);
    if (kind === 'hue') apply({ ...hsv, h: Math.round(x * 359) });
    else apply({ ...hsv, s: x, v: 1 - clamp((e.clientY - r.top) / r.height) });
  };
  const handlers = (kind: 'shade' | 'hue') => ({
    onPointerDown: (e: PointerEvent) => {
      drag.current = kind;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      fromPointer(e, kind);
    },
    onPointerMove: (e: PointerEvent) => drag.current === kind && fromPointer(e, kind),
    onPointerUp: () => (drag.current = null),
    onPointerCancel: () => (drag.current = null),
  });
  const onShadeKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (!d[e.key]) return;
    e.preventDefault();
    apply({ ...hsv, s: clamp(hsv.s + d[e.key]![0]), v: clamp(hsv.v + d[e.key]![1]) });
  };
  const onHueKey = (e: KeyboardEvent) => {
    const d: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -10,
      PageUp: 10,
    };
    if (e.key === 'Home') apply({ ...hsv, h: 0 });
    else if (e.key === 'End') apply({ ...hsv, h: 359 });
    else if (d[e.key]) apply({ ...hsv, h: clamp(hsv.h + d[e.key]!, 0, 359) });
    else return;
    e.preventDefault();
  };
  const onPaletteKey = (e: KeyboardEvent, i: number) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const next = (i + d + BRAND.length) % BRAND.length;
    pop.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
  const current = isHex(value) ? value.toUpperCase() : '';

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`fd-color ${className}`.trim()}
        style={{ ['--fd-color-value' as string]: current || 'transparent' }}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open &&
        createPortal(
          <div
            ref={pop}
            className="fd-pop fd-color-pop"
            role="dialog"
            aria-label={label}
            style={style}
            data-ready={ready ? '' : undefined}
          >
            <div className="fd-color-pop__palette" role="radiogroup" aria-label={labels.palette}>
              {BRAND.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={c === current}
                  aria-label={c}
                  tabIndex={c === current || (!BRAND.includes(current) && i === 0) ? 0 : -1}
                  className="fd-color-pop__sw"
                  style={{ ['--fd-color-value' as string]: c }}
                  onClick={() => onChange(c)}
                  onKeyDown={(e) => onPaletteKey(e, i)}
                >
                  {c === current && <Check size={14} aria-hidden="true" />}
                </button>
              ))}
            </div>
            <div
              className="fd-color-pop__shade"
              role="slider"
              tabIndex={0}
              aria-label={labels.shade}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hsv.s * 100)}
              aria-valuetext={hsvToHex(hsv)}
              style={{ ['--fd-color-hue' as string]: String(hsv.h) }}
              onKeyDown={onShadeKey}
              {...handlers('shade')}
            >
              <span
                className="fd-color-pop__dot"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
                aria-hidden="true"
              />
            </div>
            <div
              className="fd-color-pop__hue"
              role="slider"
              tabIndex={0}
              aria-label={labels.hue}
              aria-valuemin={0}
              aria-valuemax={359}
              aria-valuenow={Math.round(hsv.h)}
              onKeyDown={onHueKey}
              {...handlers('hue')}
            >
              <span
                className="fd-color-pop__dot"
                style={{ left: `${(hsv.h / 359) * 100}%` }}
                aria-hidden="true"
              />
            </div>
            <input
              className="fd-input fd-color-pop__hex"
              aria-label={labels.hex}
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              value={text}
              aria-invalid={!isHex(text) || undefined}
              onChange={(e) => {
                const v = e.target.value.trim();
                setText(v);
                if (isHex(v)) onChange(v.toUpperCase());
              }}
              onBlur={() => setText(value.toUpperCase())}
            />
          </div>,
          getPortal(button.current),
        )}
    </>
  );
}
