import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, ChevronDown } from 'lucide-react';
import { computePosition, getPortal, type Placement } from '../lib/floating';

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

/** Au-delà de ce nombre d'éléments, le menu s'affiche en feuille du bas sous 480 px (§15.7). */
const SHEET_MIN_ITEMS = 7;

/**
 * Menu d'actions accessible, rendu dans le portail #fd-portal (jamais coupé par un conteneur) :
 * position fixed + retournement / décalage / hauteur max, Échap ferme et rend le focus au déclencheur,
 * flèches haut/bas naviguent, clic extérieur ferme.
 */
export function Menu({
  label,
  items,
  align = 'end',
  placement,
  trigger,
  icon,
}: {
  label: string;
  items: Array<MenuItem | MenuRadioGroup | 'separator'>;
  align?: 'start' | 'end';
  /** Côté préféré (par défaut bottom-<align>) ; menu de compte : top-start. */
  placement?: Placement;
  /** Bouton déclencheur visible (icône + libellé) au lieu du « ⋯ ». */
  trigger?: {
    icon?: ReactNode;
    text: string;
    block?: boolean;
    /** Chevron ▾ après le texte */ chevron?: boolean;
  };
  /** Icône du bouton seul (par défaut « ⋯ »), ex. « + » du rail des étapes. */
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const preferred: Placement = placement ?? (align === 'start' ? 'bottom-start' : 'bottom-end');
  const count = items.filter((x) => x !== 'separator').length;
  const [sheet, setSheet] = useState(false);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) btn.current?.focus();
  }, []);

  /** Place le menu (appelé à l'ouverture, au défilement et au redimensionnement). */
  const place = useCallback(() => {
    const el = list.current;
    const anchor = btn.current;
    if (!el || !anchor) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    // Menu ouvert depuis une modale ou le tiroir mobile : au-dessus (popover), sinon dropdown (§15.7)
    el.style.zIndex = anchor.closest('dialog, [aria-modal="true"]') ? 'var(--fd-z-popover)' : '';
    const asSheet = vw < 480 && count >= SHEET_MIN_ITEMS;
    setSheet(asSheet);
    if (asSheet) {
      Object.assign(el.style, { top: '', left: '', maxHeight: '' });
      return;
    }
    el.style.maxHeight = '';
    const pos = computePosition(
      anchor.getBoundingClientRect(),
      { width: el.offsetWidth, height: el.scrollHeight },
      preferred,
      vw,
      vh,
    );
    el.style.top = `${pos.top}px`;
    el.style.left = `${pos.left}px`;
    el.style.maxHeight = `${pos.maxHeight}px`;
    el.dataset.placement = pos.placement;
  }, [count, preferred]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, items]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !list.current?.contains(target)) close(false);
    };
    const onMove = () => place();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    window.visualViewport?.addEventListener('resize', onMove);
    list.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      window.visualViewport?.removeEventListener('resize', onMove);
    };
  }, [open, place, close]);

  function onKey(e: React.KeyboardEvent) {
    const els = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [],
    );
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    }
  }

  return (
    <div className="menu" ref={root}>
      <button
        ref={btn}
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
            {trigger.icon && (
              <span className="fd-btn__icon" aria-hidden="true">
                {trigger.icon}
              </span>
            )}
            {trigger.text}
            {trigger.chevron && <ChevronDown size={16} aria-hidden="true" />}
          </>
        ) : (
          (icon ?? <MoreHorizontal size={18} aria-hidden="true" />)
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={list}
            className={`menu-list${sheet ? ' menu-list--sheet' : ''}`}
            role="menu"
            id={id}
            aria-label={trigger ? trigger.text : label}
            onKeyDown={onKey}
          >
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
                    close(true);
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
          </div>,
          getPortal(),
        )}
    </div>
  );
}
