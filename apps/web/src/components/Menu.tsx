import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

/** Groupe de choix exclusifs affiché en contrôle segmenté dans le menu (menuitemradio). */
export interface MenuRadioGroup {
  radios: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string; icon: ReactNode }>;
    onChange: (value: string) => void;
  };
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Menu d'actions « ⋯ » accessible : Échap ferme, flèches haut/bas naviguent, clic extérieur ferme. */
export function Menu({
  label,
  items,
  align = 'end',
  trigger,
}: {
  label: string;
  items: Array<MenuItem | MenuRadioGroup | 'separator'>;
  align?: 'start' | 'end';
  /** Bouton déclencheur visible (icône + libellé) au lieu du « ⋯ ». */
  trigger?: { icon: ReactNode; text: string; block?: boolean };
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    root.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')?.focus();
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    const els = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [],
    );
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>('.menu-trigger')?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    }
  }

  return (
    <div className="menu" ref={root} onKeyDown={onKey}>
      <button
        type="button"
        className={
          trigger
            ? `fd-btn fd-btn--sm menu-trigger${trigger.block ? ' fd-btn--block' : ''}`
            : 'fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon menu-trigger'
        }
        aria-label={trigger ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        {trigger ? (
          <>
            <span className="fd-btn__icon" aria-hidden="true">
              {trigger.icon}
            </span>
            {trigger.text}
          </>
        ) : (
          <MoreHorizontal size={18} aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className={`menu-list menu-list--${align}`} role="menu" id={id}>
          {items.map((it, i) =>
            it === 'separator' ? (
              <div key={`s${i}`} className="menu-sep" role="separator" />
            ) : 'radios' in it ? (
              <div key={`r${i}`} role="group" aria-label={it.radios.label} className="menu-radios">
                <span className="menu-radios__label" aria-hidden="true">
                  {it.radios.label}
                </span>
                <span className="segmented">
                  {it.radios.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={it.radios.value === o.value}
                      aria-label={o.label}
                      title={o.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        it.radios.onChange(o.value);
                      }}
                    >
                      {o.icon}
                    </button>
                  ))}
                </span>
              </div>
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className={`menu-item${it.danger ? ' menu-item--danger' : ''}`}
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.icon && (
                  <span className="menu-item__icon" aria-hidden="true">
                    {it.icon}
                  </span>
                )}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
