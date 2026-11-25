import { useId, type ReactNode } from 'react';

export interface RadioCard<T extends string> {
  value: T;
  label: string;
  /** Petit schéma décoratif au-dessus du libellé. */
  art?: ReactNode;
  disabled?: boolean;
  /** Raison affichée quand le choix est indisponible. */
  hint?: string;
  describedBy?: string;
}

/**
 * Cartes radio (ACTION-01 : un choix entre deux à quatre formes d'un même objet). Un `radiogroup` ; les
 * flèches déplacent le choix, comme pour des boutons radio. Un choix indisponible reste visible, grisé.
 */
export function RadioCards<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: RadioCard<T>[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  const move = (from: T, d: number) => {
    const ok = options.filter((o) => !o.disabled);
    const i = ok.findIndex((o) => o.value === from);
    const next = ok[(i + d + ok.length) % ok.length];
    if (!next) return;
    onChange(next.value);
    document.getElementById(`${id}-${next.value}`)?.focus();
  };
  return (
    <div className={`shd-cards${className ? ` ${className}` : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          id={`${id}-${o.value}`}
          type="button"
          role="radio"
          className="shd-card"
          aria-checked={value === o.value}
          aria-disabled={o.disabled || undefined}
          aria-describedby={o.disabled ? o.describedBy : undefined}
          title={o.disabled ? o.hint : undefined}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => !o.disabled && onChange(o.value)}
          onKeyDown={(e) => {
            const d =
              e.key === 'ArrowRight' || e.key === 'ArrowDown'
                ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                  ? -1
                  : 0;
            if (!d) return;
            e.preventDefault();
            move(o.value, d);
          }}
        >
          {o.art && (
            <span className="shd-card__art" aria-hidden="true">
              {o.art}
            </span>
          )}
          <span className="shd-card__row">
            <span className="shd-card__dot" aria-hidden="true" />
            <span className="shd-card__label">{o.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
