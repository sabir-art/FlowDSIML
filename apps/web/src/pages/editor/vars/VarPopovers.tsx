/**
 * L46 : catalogue des variables (insertion) et réglage d'une pastille (valeur de repli).
 * Popovers rendus dans un portail, en position fixe, placés par l'algorithme des infobulles L44
 * (ne sortent jamais de l'écran).
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Braces, ChevronDown, Plus, Settings, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { place } from '@flowdsiml/ui/tooltip';
import { GROUP_ORDER, type CatalogItem } from '../../../lib/varCatalog';

const HELP_KEY = 'fd.vars.help.seen';
export const helpSeen = () => {
  try {
    return localStorage.getItem(HELP_KEY) === '1';
  } catch {
    return true;
  }
};
export const markHelpSeen = () => {
  try {
    localStorage.setItem(HELP_KEY, '1');
  } catch {
    /* stockage indisponible */
  }
};

const GAP = 8;
const EDGE = 8;

/** Popover en position fixe sous l'ancre (au-dessus si la place manque), jamais hors de l'écran. */
function Pop({
  anchor,
  width,
  label,
  onClose,
  children,
  className,
}: {
  anchor: DOMRect;
  width: number;
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const portalTarget = useRef<HTMLElement>(
    (document.activeElement?.closest('dialog[open]') as HTMLElement | null) ?? document.body,
  );
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight?: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const p = place(
      { left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height },
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: vw, height: vh },
      'bottom',
    );
    // Bord gauche aligné sur l'ancre (curseur ou bouton), dans l'écran
    const left = Math.max(EDGE, Math.min(anchor.left, vw - el.offsetWidth - EDGE));
    // L46B-01 : sans place entière ni dessous ni dessus, le popover reste accroché à l'ancre, du côté
    // le plus grand, et sa hauteur se limite à la place disponible (jamais recalé en haut de l'écran)
    const h = el.offsetHeight;
    const below = vh - anchor.bottom - GAP - EDGE;
    const above = anchor.top - GAP - EDGE;
    if (h <= below || h <= above) return setPos({ left, top: p.top });
    if (below >= above) setPos({ left, top: anchor.bottom + GAP, maxHeight: below });
    else setPos({ left, top: EDGE, maxHeight: above });
  }, [anchor]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [onClose]);
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={`mk var-pop ${className ?? ''}`}
      style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? -9999, maxHeight: pos?.maxHeight }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          e.preventDefault();
          onClose();
        }
      }}
    >
      {children}
    </div>,
    // Dans un <dialog> modal (couche supérieure), le popover y est rendu pour rester au-dessus
    portalTarget.current,
  );
}

export function VarCatalog({
  anchor,
  items,
  canManage,
  onPick,
  onCreate,
  onClose,
}: {
  anchor: DOMRect;
  items: CatalogItem[];
  canManage: boolean;
  onPick: (item: CatalogItem) => void;
  onCreate?: (label: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [help] = useState(() => !helpSeen());
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = useMemo(() => {
    const n = norm(q.trim());
    const hit = (c: CatalogItem) =>
      !n || norm(c.label).includes(n) || norm(c.description).includes(n) || c.key.includes(n);
    return GROUP_ORDER.flatMap((g) => items.filter((c) => c.group === g && hit(c)));
  }, [items, q]);
  const idx = Math.min(active, Math.max(0, list.length - 1));
  const listRef = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  // Focus dans la recherche à l'ouverture (après le placement, l'éditeur ne le reprend pas)
  useEffect(() => {
    const id = window.setTimeout(() => search.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  let lastGroup: string | null = null;
  return (
    <Pop anchor={anchor} width={360} label={t('variables.catalog')} onClose={onClose} className="var-cat">
      {help && (
        <p className="var-cat__help" role="note">
          {t('variables.help')}{' '}
          <button
            type="button"
            className="var-link"
            onClick={(e) => {
              markHelpSeen();
              (e.currentTarget.parentElement as HTMLElement).hidden = true;
            }}
          >
            {t('variables.helpOk')}
          </button>
        </p>
      )}
      <input
        ref={search}
        className="fd-input var-cat__search"
        type="search"
        role="combobox"
        aria-expanded="true"
        aria-controls={`${id}-list`}
        aria-activedescendant={list.length ? `${id}-${idx}` : undefined}
        aria-label={t('variables.search')}
        placeholder={t('variables.search')}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const d = e.key === 'ArrowDown' ? 1 : -1;
            setActive((idx + d + list.length) % Math.max(1, list.length));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const it = list[idx];
            if (it && !it.disabledReason) onPick(it);
          }
        }}
      />
      {list.length ? (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={t('variables.catalog')}
          className="var-cat__list"
        >
          {list.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <li key={c.key} role="presentation">
                {head && (
                  <span className="var-cat__group" aria-hidden="true">
                    {t(`variables.groups.${head}`)}
                  </span>
                )}
                <div
                  id={`${id}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === idx}
                  aria-disabled={c.disabledReason ? true : undefined}
                  aria-describedby={`${id}-${i}-d`}
                  className={`var-cat__opt${c.disabledReason ? ' is-disabled' : ''}`}
                  title={c.description || undefined}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => !c.disabledReason && onPick(c)}
                >
                  <span className="var-cat__label">{c.label}</span>
                  {c.disabledReason ? (
                    <>
                      <span className="var-cat__soon">{t('shell.soon')}</span>
                      <span className="var-cat__reason" id={`${id}-${i}-d`}>
                        {c.disabledReason}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="var-cat__ex">{t('variables.example', { value: c.example })}</span>
                      <span className="sr-only" id={`${id}-${i}-d`}>
                        {c.description}
                      </span>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="var-cat__none" role="status">
          <p>{t('variables.none')}</p>
          {canManage && onCreate && q.trim() && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCreate(q.trim())}>
              <Plus aria-hidden="true" />
              {t('variables.create', { name: q.trim() })}
            </button>
          )}
        </div>
      )}
      {canManage && (
        <Link className="var-cat__manage var-link" to="/settings/variables" onClick={onClose}>
          <Settings aria-hidden="true" />
          {t('variables.manage')}
        </Link>
      )}
    </Pop>
  );
}

export function VarSettings({
  anchor,
  item,
  fallback,
  onApply,
  onRemove,
  onClose,
}: {
  anchor: DOMRect;
  item: CatalogItem | null;
  fallback: string | null;
  onApply: (fallback: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [v, setV] = useState(fallback ?? '');
  const alias: Record<string, string> = {
    first_name: 'prenom',
    last_name: 'nom',
    job_title: 'fonction',
    company: 'entreprise',
  };
  return (
    <Pop anchor={anchor} width={360} label={t('variables.settings')} onClose={onClose} className="var-set">
      <div className="var-set__head">
        <Braces aria-hidden="true" />
        <b>{item ? item.label : t('variables.deleted')}</b>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={t('variables.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      {item ? (
        <p className="var-set__desc">
          {item.description} {t('variables.example', { value: item.example })}
        </p>
      ) : (
        <p className="var-set__desc">{t('variables.deletedHelp')}</p>
      )}
      {item && !item.computed && (
        <form
          className="fd-stack fd-stack--label"
          onSubmit={(e) => {
            e.preventDefault();
            onApply(v.trim());
          }}
        >
          <label htmlFor={`${id}-fb`} className="label">
            {t('variables.ifUnknown')}
          </label>
          <input
            id={`${id}-fb`}
            className="input input-sm"
            autoFocus
            maxLength={40}
            value={v}
            aria-describedby={`${id}-fbh`}
            onChange={(e) => setV(e.target.value)}
          />
          <span className="help" id={`${id}-fbh`}>
            {t('variables.ifUnknownHelp')}
          </span>
          <details className="var-set__src">
            <summary>
              {t('variables.source')}
              <ChevronDown aria-hidden="true" />
            </summary>
            <p className="help">
              {t('variables.sourceHelp', {
                param: alias[item.key] ?? item.key,
                example: encodeURIComponent(item.example),
                key: item.key,
              })}
            </p>
          </details>
        </form>
      )}
      {item?.computed && <p className="help">{t('variables.computedHelp')}</p>}
      <div className="var-set__acts">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>
          <Trash2 aria-hidden="true" />
          {t('variables.remove')}
        </button>
        {item && !item.computed && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onApply(v.trim())}>
            {t('variables.apply')}
          </button>
        )}
      </div>
    </Pop>
  );
}
