import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { getPortal } from './floating';
import { usePopover } from './usePopover';
import './popover.css';
import './datefield.css';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** « 2026-12-21 » en date locale (midi, à l'abri des changements d'heure). */
const parseIso = (s: string | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
};
/** Saisie « jj/mm/aaaa » (ou « jj/mm/aa », séparateurs « / », « . » ou « - »). */
const parseTyped = (s: string) => {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\s*$/.exec(s);
  if (!m) return null;
  const y = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]), 12);
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]) ? d : null;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const addMonths = (d: Date, n: number) => {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last), 12);
};

export interface DateFieldLabels {
  /** Nom du bouton qui ouvre le calendrier (« Ouvrir le calendrier »). */
  open: string;
  previous: string;
  next: string;
}

/**
 * COMP-01 §3 : date sans `<input type="date">`. Le champ affiche la date au format court de la locale
 * (« 21 déc. 2026 ») et accepte la saisie « jj/mm/aaaa » ; le bouton ouvre un calendrier de 280 px
 * (semaine du lundi, aujourd'hui cerclé, jour choisi en primary, bornes désactivées). Clavier de la
 * grille : flèches, Page haut et bas (mois), Début et Fin (semaine), Entrée choisit, Échap ferme.
 */
export function DateField({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  locale = 'fr-FR',
  labels,
  className = '',
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}: {
  id?: string;
  /** Date ISO « aaaa-mm-jj », ou chaîne vide. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  locale?: string;
  labels: DateFieldLabels;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  const gridId = useId();
  const root = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const selected = parseIso(value);
  const [cursor, setCursor] = useState<Date>(selected ?? new Date());
  const lo = parseIso(min);
  const hi = parseIso(max);
  const off = useCallback((d: Date) => (lo && d < lo) || (hi && d > hi) || false, [lo, hi]);
  const close = useCallback((focus: boolean) => {
    setOpen(false);
    if (focus) button.current?.focus();
  }, []);
  const { style, ready } = usePopover(open, root, pop, close);
  useEffect(() => {
    if (open && ready) pop.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [open, ready, cursor]);

  const short = (d: Date) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d);
  const numeric = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const commit = () => {
    if (typed === null) return;
    const d = typed.trim() ? parseTyped(typed) : null;
    if (!typed.trim()) onChange('');
    else if (d && !off(d)) onChange(iso(d));
    setTyped(null);
  };
  const pick = (d: Date) => {
    if (off(d)) return;
    onChange(iso(d));
    close(true);
  };
  const onGridKey = (e: KeyboardEvent) => {
    const step: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
      Home: () => addDays(cursor, -((cursor.getDay() + 6) % 7)),
      End: () => addDays(cursor, 6 - ((cursor.getDay() + 6) % 7)),
    };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(cursor);
    } else if (step[e.key]) {
      e.preventDefault();
      setCursor(step[e.key]!());
    }
  };

  // Grille de 6 semaines à partir du lundi qui précède (ou égale) le 1er du mois
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
  );
  const today = iso(new Date());
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(cursor);
  const full = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });

  return (
    <div ref={root} className={`fd-date ${className}`.trim()} data-disabled={disabled || undefined}>
      <input
        id={id}
        className="fd-date__input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="jj/mm/aaaa"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        value={typed ?? (selected ? short(selected) : '')}
        onFocus={() => setTyped(selected ? numeric(selected) : '')}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            setTyped(null);
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'ArrowDown' && e.altKey) {
            e.preventDefault();
            setCursor(selected ?? new Date());
            setOpen(true);
          }
        }}
      />
      <button
        ref={button}
        type="button"
        className="fd-date__btn"
        disabled={disabled}
        aria-label={labels.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setCursor(selected ?? new Date());
          setOpen((o) => !o);
        }}
      >
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            className="fd-pop fd-cal"
            role="dialog"
            aria-label={labels.open}
            style={style}
            data-ready={ready ? '' : undefined}
          >
            <div className="fd-cal__head">
              <button
                type="button"
                className="fd-cal__nav"
                aria-label={labels.previous}
                onClick={() => setCursor(addMonths(cursor, -1))}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="fd-cal__month" aria-live="polite">
                {month}
              </span>
              <button
                type="button"
                className="fd-cal__nav"
                aria-label={labels.next}
                onClick={() => setCursor(addMonths(cursor, 1))}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            <table className="fd-cal__grid" role="grid" id={gridId} aria-label={month} onKeyDown={onGridKey}>
              <thead>
                <tr>
                  {weeks[0]!.map((d) => (
                    <th key={d.getDay()} scope="col" abbr={weekdayLong.format(d)}>
                      {weekday.format(d).replace('.', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={iso(w[0]!)}>
                    {w.map((d) => {
                      const k = iso(d);
                      const isCursor = k === iso(cursor);
                      return (
                        <td key={k} role="gridcell" aria-selected={k === value}>
                          <button
                            type="button"
                            className="fd-cal__day"
                            tabIndex={isCursor ? 0 : -1}
                            data-out={d.getMonth() !== cursor.getMonth() || undefined}
                            data-today={k === today || undefined}
                            aria-pressed={k === value}
                            aria-current={k === today ? 'date' : undefined}
                            aria-label={full.format(d)}
                            disabled={off(d)}
                            onClick={() => pick(d)}
                          >
                            {d.getDate()}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
          getPortal(root.current),
        )}
    </div>
  );
}

/**
 * COMP-01 §3 : heure sans `<input type="time">`. Saisie libre « hh:mm » et liste de créneaux (30 min par
 * défaut) ouverte par le bouton ou Alt + Flèche bas ; flèches dans la liste, Entrée choisit.
 */
export function TimeField({
  id,
  value,
  onChange,
  step = 30,
  disabled = false,
  labels,
  className = '',
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
}: {
  id?: string;
  /** Heure « hh:mm », ou chaîne vide. */
  value: string;
  onChange: (value: string) => void;
  /** Pas des créneaux proposés, en minutes. */
  step?: number;
  disabled?: boolean;
  labels: { open: string };
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const slots = Array.from(
    { length: Math.floor(1440 / step) },
    (_, i) => `${pad(Math.floor((i * step) / 60))}:${pad((i * step) % 60)}`,
  );
  const [active, setActive] = useState(0);
  const close = useCallback((focus: boolean) => {
    setOpen(false);
    if (focus) input.current?.focus();
  }, []);
  const { style, ready } = usePopover(open, root, pop, close, 'bottom-start', 232);
  useEffect(() => {
    if (open && ready)
      pop.current?.querySelector('[aria-selected="true"], .is-active')?.scrollIntoView({ block: 'nearest' });
  }, [open, ready, active]);
  const parse = (s: string) => {
    const m = /^\s*(\d{1,2})\s*[:h.]\s*(\d{2})?\s*$/i.exec(s) ?? /^\s*(\d{1,2})()\s*$/.exec(s);
    if (!m) return null;
    const h = Number(m[1]);
    const mi = Number(m[2] || 0);
    return h < 24 && mi < 60 ? `${pad(h)}:${pad(mi)}` : null;
  };
  const commit = () => {
    if (typed === null) return;
    const v = typed.trim() ? parse(typed) : '';
    if (v !== null && v !== value) onChange(v);
    setTyped(null);
  };
  const show = () => {
    const i = slots.findIndex((s) => s >= (value || '09:00'));
    setActive(i < 0 ? 0 : i);
    setOpen(true);
  };
  const choose = (s: string) => {
    setTyped(null);
    if (s !== value) onChange(s);
    close(true);
  };
  return (
    <div ref={root} className={`fd-date fd-time ${className}`.trim()} data-disabled={disabled || undefined}>
      <input
        ref={input}
        id={id}
        className="fd-date__input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh:mm"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        disabled={disabled}
        value={typed ?? value}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setActive((a) => Math.min(slots.length - 1, Math.max(0, a + (e.key === 'ArrowDown' ? 1 : -1))));
          } else if (open && e.key === 'Enter') {
            e.preventDefault();
            choose(slots[active]!);
          } else if (e.key === 'ArrowDown' && (e.altKey || !open)) {
            e.preventDefault();
            show();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
      />
      <button
        type="button"
        className="fd-date__btn"
        tabIndex={-1}
        disabled={disabled}
        aria-label={labels.open}
        onClick={() => (open ? close(true) : (input.current?.focus(), show()))}
      >
        <Clock size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={pop}
            className="fd-pop fd-time-pop"
            // Liste courte : 6 créneaux visibles, le reste défile
            style={{ ...style, maxHeight: Math.min(232, Number(style.maxHeight ?? 232)) }}
            data-ready={ready ? '' : undefined}
          >
            <div role="listbox" id={listId} aria-label={labels.open} className="fd-sel-list">
              {slots.map((s, i) => (
                <div
                  key={s}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={s === value}
                  className={`fd-opt${i === active ? ' is-active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(s)}
                >
                  <span className="fd-opt__text">
                    <span className="fd-opt__label">{s}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>,
          getPortal(root.current),
        )}
    </div>
  );
}
