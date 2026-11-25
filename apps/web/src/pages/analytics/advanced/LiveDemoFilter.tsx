import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, LayoutGrid, Search } from 'lucide-react';
import type { ContentType } from '@flowdsiml/core';

export interface LiveDemoOption {
  id: string;
  title: string;
  folder: string | null;
  type?: ContentType;
  /** Visiteurs en direct sur la démo (0 : hors du groupe « En direct »). */
  live: number;
}

/** Démos montrées sans recherche (au-delà : « + n autres démos : tapez pour filtrer »). */
const VISIBLE = 8;

/**
 * Temps réel, filtre Démo (retours du 24/11, 2e série §5) : zone de recherche (`combobox`) et liste
 * (`listbox`) groupée : « En direct » avec le nombre de visiteurs, puis par dossier. Chaque démo porte la
 * pastille de couleur de son type. Tient avec des centaines de démos : huit résultats visibles, la suite
 * se trouve en tapant. Flèches, Entrée, Échap.
 */
export function LiveDemoFilter({
  value,
  options,
  totalLive,
  onChange,
}: {
  /** Démo choisie ('' : toutes les démos). */
  value: string;
  options: LiveDemoOption[];
  totalLive: number;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const { groups, flat, hidden } = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    const match = needle ? options.filter((o) => o.title.toLocaleLowerCase().includes(needle)) : options;
    // En direct d'abord (les plus fréquentées en tête), puis par dossier, par ordre alphabétique
    const sorted = [
      ...match.filter((o) => o.live > 0).sort((a, b) => b.live - a.live || a.title.localeCompare(b.title)),
      ...match
        .filter((o) => o.live === 0)
        .sort((a, b) => (a.folder ?? '').localeCompare(b.folder ?? '') || a.title.localeCompare(b.title)),
    ];
    const shown = sorted.slice(0, VISIBLE);
    const out: Array<{ key: string; label: string; items: LiveDemoOption[] }> = [];
    for (const o of shown) {
      const key = o.live > 0 ? '@live' : (o.folder ?? '');
      const label =
        o.live > 0
          ? t('analytics.adv.live.groupLive')
          : o.folder
            ? t('analytics.adv.live.groupFolder', { name: o.folder })
            : t('analytics.adv.live.groupNone');
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push(o);
      else out.push({ key, label, items: [o] });
    }
    return { groups: out, flat: shown, hidden: sorted.length - shown.length };
  }, [options, q, t]);
  // Position 0 : « Toutes les démos » ; puis les démos affichées
  const count = flat.length + 1;

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    setQ('');
    if (refocus) trigger.current?.focus();
  };
  const pick = (i: number) => {
    onChange(i === 0 ? '' : (flat[i - 1]?.id ?? ''));
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(Math.min(active, count - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') close(false);
  };

  const current = options.find((o) => o.id === value);
  let index = 0;
  return (
    <div className="lv-filter" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="fd-btn lv-filter__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('analytics.adv.live.filterLabel', {
          demo: current?.title ?? t('analytics.allDemos'),
        })}
        onClick={() => {
          setActive(0);
          setOpen((o) => !o);
        }}
      >
        {current ? (
          <i className={`lv-dot lv-dot--${current.type ?? 'captures'}`} aria-hidden="true" />
        ) : (
          <LayoutGrid aria-hidden="true" />
        )}
        <span className="lv-filter__v">{current?.title ?? t('analytics.allDemos')}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div className="lv-pop">
          <div className="lv-pop__search">
            <Search aria-hidden="true" />
            <input
              ref={input}
              className="input"
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={`${id}-o${Math.min(active, count - 1)}`}
              aria-label={t('analytics.searchDemo')}
              placeholder={t('analytics.searchDemo')}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(e.target.value.trim() ? 1 : 0);
              }}
              onKeyDown={onKey}
            />
          </div>
          <div
            className="lv-pop__list"
            role="listbox"
            id={`${id}-list`}
            aria-label={t('analytics.demoLabel')}
          >
            <div
              id={`${id}-o0`}
              role="option"
              aria-selected={!value}
              className={`lv-opt${active === 0 ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(0)}
              onClick={() => pick(0)}
            >
              <LayoutGrid aria-hidden="true" />
              <span className="lv-opt__t">{t('analytics.allDemos')}</span>
              <span className="lv-opt__n">{t('analytics.adv.live.liveCount', { count: totalLive })}</span>
            </div>
            {groups.map((g) => (
              <div key={g.key} role="group" aria-label={g.label}>
                <div className="lv-pop__group" aria-hidden="true">
                  {g.label}
                </div>
                {g.items.map((o) => {
                  const i = ++index;
                  return (
                    <div
                      key={o.id}
                      id={`${id}-o${i}`}
                      role="option"
                      aria-selected={value === o.id}
                      className={`lv-opt${active === i ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(i)}
                    >
                      <i className={`lv-dot lv-dot--${o.type ?? 'captures'}`} aria-hidden="true" />
                      <span className="lv-opt__t" title={o.title}>
                        {o.title}
                      </span>
                      {o.live > 0 && (
                        <span
                          className="lv-opt__n"
                          aria-label={t('analytics.adv.live.liveCount', { count: o.live })}
                        >
                          {o.live}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {flat.length === 0 && <p className="lv-pop__more">{t('analytics.noDemoMatch')}</p>}
            {hidden > 0 && (
              <p className="lv-pop__more">{t('analytics.adv.live.moreDemos', { count: hidden })}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
