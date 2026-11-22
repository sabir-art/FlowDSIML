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
  /** Contenu aligné à droite (coche de l'élément actif, badge « Bientôt »…). */
  end?: ReactNode;
  /** Élément actif (aria-current), ex. workspace courant. */
  current?: boolean;
  /**
   * L27 : explication d'un élément indisponible. Avec `disabled`, l'élément reste focalisable
   * (aria-disabled) et l'explication est reliée par aria-describedby et affichée en infobulle.
   */
  hint?: string;
  /** L41 : groupe nommé (ex. « Équipe TutoClick ») : intitulé au-dessus de l'élément, role="group". */
  group?: string;
  /** Choix exclusif d'un groupe (rôle d'un membre) : `menuitemradio`, coché quand `current`. */
  radio?: boolean;
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
  custom,
  search,
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
  /** Déclencheur entièrement personnalisé (contenu et classe), ex. sélecteur de workspace. */
  custom?: { content: ReactNode; className: string };
  /**
   * L48-D : champ de recherche en haut du menu (filtre à la frappe, sans casse ni accents). Les `keep`
   * premiers éléments restent hors du filtre (ex. « Toutes les démos »).
   */
  search?: { label: string; empty: string; keep?: number };
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const preferred: Placement = placement ?? (align === 'start' ? 'bottom-start' : 'bottom-end');
  const count = items.filter((x) => x !== 'separator').length;
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState('');
  const fold = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const needle = fold(q.trim());
  const shown = search
    ? items.filter(
        (it, i) =>
          i < (search.keep ?? 0) ||
          (it !== 'separator' && !('radios' in it) && (!needle || fold(it.label).includes(needle))),
      )
    : items;

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
      // Hauteur du contenu plus les bordures (scrollHeight seul les ignore : 2 px de trop au bord)
      { width: el.offsetWidth, height: el.scrollHeight + el.offsetHeight - el.clientHeight },
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
    if (search) list.current?.querySelector<HTMLInputElement>('.menu-search')?.focus();
    else list.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      window.visualViewport?.removeEventListener('resize', onMove);
    };
  }, [open, place, close, search]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

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
          custom
            ? `${custom.className} menu-trigger`
            : trigger
              ? `fd-btn fd-btn--sm menu-trigger${trigger.block ? ' fd-btn--block' : ''}`
              : 'fd-btn fd-btn--ghost fd-btn--sm fd-btn--icon menu-trigger'
        }
        aria-label={trigger || custom ? undefined : label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        {custom ? (
          custom.content
        ) : trigger ? (
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
            {search && (
              <input
                className="fd-input menu-search"
                type="search"
                aria-label={search.label}
                placeholder={search.label}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            )}
            {search && needle && shown.length <= (search.keep ?? 0) && (
              <p className="menu-empty" role="status">
                {search.empty}
              </p>
            )}
            {shown.map((it, i) =>
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
                (() => {
                  const item = (
                    <button
                      key={it.label}
                      type="button"
                      role={it.radio ? 'menuitemradio' : 'menuitem'}
                      aria-checked={it.radio ? !!it.current : undefined}
                      className={`menu-item${it.danger ? ' menu-item--danger' : ''}`}
                      disabled={it.disabled && !it.hint}
                      aria-disabled={it.disabled && it.hint ? 'true' : undefined}
                      aria-describedby={it.disabled && it.hint ? `${id}-h${i}` : undefined}
                      title={it.disabled && it.hint ? it.hint : undefined}
                      aria-current={it.current && !it.radio ? 'true' : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (it.disabled) return;
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
                      {it.end && <span className="menu-item__end">{it.end}</span>}
                      {it.disabled && it.hint && (
                        <span id={`${id}-h${i}`} className="sr-only">
                          {it.hint}
                        </span>
                      )}
                    </button>
                  );
                  return it.group ? (
                    <div
                      key={it.label}
                      role="group"
                      aria-labelledby={`${id}-g${(() => {
                        let j = i;
                        while (j > 0) {
                          const p = shown[j - 1];
                          if (!p || typeof p === 'string' || 'radios' in p || p.group !== it.group) break;
                          j--;
                        }
                        return j;
                      })()}`}
                      className="menu-group"
                    >
                      {/* Intitulé (12 px, majuscules) une seule fois pour des éléments consécutifs du même
                          groupe ; non focalisable, les flèches le sautent */}
                      {(() => {
                        const prev = shown[i - 1];
                        return (
                          !prev || typeof prev === 'string' || 'radios' in prev || prev.group !== it.group
                        );
                      })() && (
                        <div className="menu-group__label" id={`${id}-g${i}`} role="presentation">
                          {it.group}
                        </div>
                      )}
                      {item}
                    </div>
                  ) : (
                    item
                  );
                })()
              ),
            )}
          </div>,
          getPortal(),
        )}
    </div>
  );
}
