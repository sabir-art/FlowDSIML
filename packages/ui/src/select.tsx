import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { computePosition, getPortal } from './floating';

/**
 * COMP-01 §1 : Select maison (choix unique). Aucun `<select>` natif : déclencheur en `role="combobox"`
 * (motif APG « select-only combobox »), liste en `role="listbox"` rendue dans le portail, jamais coupée.
 * Migration mécanique depuis `<select>` : mêmes enfants (`<option>`, `<optgroup>`), même `onChange`
 * (`e.target.value`), mêmes `id`, `name`, `value`, `disabled`.
 */
export interface SelectOption {
  value: string;
  label: string;
  /** Ligne grise de 12 px sous le libellé. */
  description?: string;
  disabled?: boolean;
  /** Titre du groupe (11 px, capitales). */
  group?: string;
}
export interface SelectChangeEvent {
  target: { value: string; name: string };
  currentTarget: { value: string; name: string };
}
export interface SelectProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: SelectChangeEvent) => void;
  /** Options en données ; sinon, les enfants `<option>` / `<optgroup>` sont lus. */
  options?: SelectOption[];
  children?: ReactNode;
  /** Texte d'invite quand aucune valeur n'est choisie. */
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** `sm` : déclencheur de 32 px (barres d'outils, lignes de tableau). */
  size?: 'md' | 'sm';
  className?: string;
  /** Textes de la liste (recherche au-delà de 8 options). */
  searchLabel?: string;
  emptyLabel?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

const SEARCH_FROM = 9;
const TYPEAHEAD_MS = 500;

function text(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return text(node.props.children);
  return '';
}
/** Lit des enfants `<option>` et `<optgroup>` comme le ferait un `<select>`. */
function fromChildren(children: ReactNode, group?: string): SelectOption[] {
  const out: SelectOption[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement<Record<string, unknown>>(c)) return;
    const p = c.props;
    if (c.type === 'optgroup') {
      out.push(...fromChildren(p.children as ReactNode, String(p.label ?? '')));
    } else if (c.type === 'option') {
      const label = text(p.children as ReactNode);
      out.push({
        value: p.value === undefined ? label : String(p.value),
        label,
        description: typeof p['data-description'] === 'string' ? p['data-description'] : undefined,
        disabled: p.disabled === true,
        group,
      });
    } else if (p.children) {
      out.push(...fromChildren(p.children as ReactNode, group));
    }
  });
  return out;
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Select({
  id,
  name = '',
  value,
  defaultValue,
  onChange,
  options,
  children,
  placeholder,
  disabled,
  required,
  size = 'md',
  className = '',
  searchLabel = 'Rechercher',
  emptyLabel = 'Aucun résultat',
  ...aria
}: SelectProps) {
  const auto = useId();
  const triggerId = id ?? `${auto}-t`;
  const listId = `${auto}-l`;
  const all = useMemo(() => options ?? fromChildren(children), [options, children]);
  const [inner, setInner] = useState(defaultValue ?? all[0]?.value ?? '');
  const current = value ?? inner;
  const selected = all.find((o) => o.value === current);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const searchable = all.length >= SEARCH_FROM;
  const shown = useMemo(
    () => (query.trim() ? all.filter((o) => norm(o.label).includes(norm(query.trim()))) : all),
    [all, query],
  );
  const optId = (i: number) => `${listId}-o${i}`;

  const firstEnabled = useCallback(
    (from: number, step: 1 | -1) => {
      for (let i = from; i >= 0 && i < shown.length; i += step) if (!shown[i]!.disabled) return i;
      return -1;
    },
    [shown],
  );

  const close = useCallback((focus = true) => {
    setOpen(false);
    setQuery('');
    setPos(null);
    if (focus) trigger.current?.focus();
  }, []);

  const openList = useCallback(() => {
    if (disabled) return;
    const i = all.findIndex((o) => o.value === current && !o.disabled);
    setActive(i >= 0 ? i : all.findIndex((o) => !o.disabled));
    setOpen(true);
  }, [all, current, disabled]);

  const choose = useCallback(
    (o: SelectOption | undefined, focus = true) => {
      if (!o || o.disabled) return;
      if (value === undefined) setInner(o.value);
      if (o.value !== current) {
        const target = { value: o.value, name };
        onChange?.({ target, currentTarget: target });
      }
      close(focus);
    },
    [close, current, name, onChange, value],
  );

  // Position : sous le déclencheur (4 px), au-dessus s'il n'y a pas la place, calée dans la fenêtre
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = trigger.current;
      const p = pop.current;
      if (!t || !p) return;
      const a = t.getBoundingClientRect();
      const width = Math.max(a.width, p.scrollWidth > a.width ? Math.min(p.scrollWidth, 360) : a.width);
      const natural = Math.min(p.scrollHeight + 2, 320);
      const r = computePosition(
        a,
        { width, height: natural },
        'bottom-start',
        window.innerWidth,
        window.innerHeight,
      );
      setPos({ top: r.top, left: r.left, width, maxHeight: Math.min(320, r.maxHeight) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, shown.length]);

  useEffect(() => {
    if (!open) return;
    if (searchable) search.current?.focus();
    const out = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!pop.current?.contains(n) && !trigger.current?.contains(n)) close(false);
    };
    document.addEventListener('pointerdown', out, true);
    return () => document.removeEventListener('pointerdown', out, true);
  }, [open, searchable, close]);

  // L'option active reste visible
  useEffect(() => {
    if (open && active >= 0) document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  // La recherche remet l'option active sur le premier résultat
  useEffect(() => {
    if (open && query) setActive(firstEnabled(0, 1));
  }, [open, query, firstEnabled]);

  function typeahead(key: string) {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > TYPEAHEAD_MS ? key : t.text + key;
    t.at = now;
    const i = shown.findIndex((o) => !o.disabled && norm(o.label).startsWith(norm(t.text)));
    if (i >= 0) setActive(i);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (disabled) return;
    const inSearch = e.target === search.current;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openList();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        openList();
        typeahead(e.key);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const i = firstEnabled(active + 1, 1);
        if (i >= 0) setActive(i);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (e.altKey) return choose(shown[active]);
        const i = firstEnabled(active - 1, -1);
        if (i >= 0) setActive(i);
        break;
      }
      case 'Home':
        if (inSearch) return;
        e.preventDefault();
        setActive(firstEnabled(0, 1));
        break;
      case 'End':
        if (inSearch) return;
        e.preventDefault();
        setActive(firstEnabled(shown.length - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        choose(shown[active]);
        break;
      case ' ':
        if (inSearch) return;
        e.preventDefault();
        choose(shown[active]);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case 'Tab':
        // Valide et laisse le focus passer au champ suivant
        choose(shown[active], false);
        if (inSearch) trigger.current?.focus();
        break;
      default:
        if (!inSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(e.key);
    }
  }

  let lastGroup: string | undefined;
  const activeId = open && active >= 0 && shown[active] ? optId(active) : undefined;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        id={triggerId}
        role="combobox"
        className={`fd-sel${size === 'sm' ? ' fd-sel--sm' : ''}${open ? ' is-open' : ''} ${className}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={searchable ? undefined : activeId}
        aria-required={required || undefined}
        disabled={disabled}
        {...aria}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={`fd-sel__value${selected ? '' : ' fd-sel__value--placeholder'}`}>
          {selected ? selected.label : (placeholder ?? '')}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      {open &&
        createPortal(
          <div
            ref={pop}
            className="fd-pop fd-sel-pop"
            style={
              pos
                ? { top: pos.top, left: pos.left, minWidth: pos.width, maxHeight: pos.maxHeight }
                : { top: 0, left: 0, visibility: 'hidden' }
            }
            data-ready={pos ? '' : undefined}
          >
            {searchable && (
              <div className="fd-sel-search">
                <Search size={16} aria-hidden="true" />
                <input
                  ref={search}
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  aria-autocomplete="list"
                  aria-label={searchLabel}
                  placeholder={searchLabel}
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </div>
            )}
            <div
              id={listId}
              role="listbox"
              className="fd-sel-list"
              aria-labelledby={aria['aria-labelledby']}
              aria-label={aria['aria-labelledby'] ? undefined : (aria['aria-label'] ?? searchLabel)}
              tabIndex={-1}
            >
              {shown.map((o, i) => {
                const title = o.group !== lastGroup && o.group ? o.group : null;
                lastGroup = o.group;
                const isSel = o.value === current;
                return (
                  <div key={`${o.group ?? ''}|${o.value}`} role="presentation" className="fd-sel-item">
                    {title && (
                      <div className="fd-sel-group" role="presentation">
                        {title}
                      </div>
                    )}
                    <div
                      id={optId(i)}
                      role="option"
                      aria-selected={isSel}
                      aria-disabled={o.disabled || undefined}
                      className={`fd-opt${i === active ? ' is-active' : ''}`}
                      onPointerMove={() => !o.disabled && i !== active && setActive(i)}
                      onClick={() => choose(o)}
                    >
                      <span className="fd-opt__text">
                        <span className="fd-opt__label">{o.label}</span>
                        {o.description && <span className="fd-opt__desc">{o.description}</span>}
                      </span>
                      {isSel && <Check size={16} aria-hidden="true" />}
                    </div>
                  </div>
                );
              })}
              {shown.length === 0 && <div className="fd-sel-empty">{emptyLabel}</div>}
            </div>
          </div>,
          getPortal(trigger.current),
        )}
    </>
  );
}
