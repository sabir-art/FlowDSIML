import { useEffect, useRef, useState } from 'preact/hooks';
import { ChevronDown, CircleCheck, Circle, ListChecks } from 'lucide-preact';
import type { Dict } from './i18n';

const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;

export interface ChecklistItem {
  id: string;
  title: string;
  target: number;
  done: boolean;
  current: boolean;
}

/**
 * F1 : checklist de progression (spec a2 §3) : carte de 260 px en bas à droite ou à gauche,
 * repliable en pilule ; « 2 sur 5 terminées », barre de progression, un élément par chapitre.
 */
export function Checklist({
  title,
  position,
  items,
  t,
  sub,
  onGo,
  docked = false,
}: {
  title: string;
  position: 'left' | 'right' | 'collapsed';
  /** F1-3 : pas de place à côté de la capture → pilule dans l'en-tête, carte ouverte à la demande. */
  docked?: boolean;
  items: ChecklistItem[];
  t: Dict;
  sub: (s: string) => string;
  onGo: (index: number) => void;
}) {
  const [open, setOpen] = useState(position !== 'collapsed' && !docked);
  useEffect(() => {
    if (docked) setOpen(false);
  }, [docked]);
  const [announce, setAnnounce] = useState('');
  const done = items.filter((x) => x.done).length;
  const prevDone = useRef(new Set(items.filter((x) => x.done).map((x) => x.id)));
  const side = position === 'left' ? 'left' : 'right';
  const label = title ? sub(title) : t.checklist;
  const progress = t.checklistProgress
    .replace('{done}', String(done))
    .replace('{total}', String(items.length));

  // Annonce « Chapitre « … » terminé » quand un élément vient d'être coché
  useEffect(() => {
    const fresh = items.find((x) => x.done && !prevDone.current.has(x.id));
    prevDone.current = new Set(items.filter((x) => x.done).map((x) => x.id));
    if (fresh) setAnnounce(t.chapterDone.replace('{title}', sub(fresh.title)));
  }, [items.map((x) => (x.done ? 1 : 0)).join('')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div class={`p-checklist ${docked ? 'p-checklist--docked' : `p-checklist--${side}`}`}>
      <span class="sr-only" aria-live="polite">
        {announce}
      </span>
      {!open ? (
        <button
          class="p-checklist-pill"
          aria-expanded={false}
          aria-controls="p-checklist"
          onClick={() => setOpen(true)}
        >
          <ListChecks {...ICON} />
          <span>{label}</span>
          <span class="p-checklist-count">
            {done}/{items.length}
          </span>
        </button>
      ) : (
        <section class="p-checklist-card" id="p-checklist" aria-label={label}>
          <div class="p-checklist-head">
            <div>
              <p class="p-checklist-title">{sub(label)}</p>
              <p class="p-checklist-progress">{progress}</p>
            </div>
            <button
              class="p-icon-btn p-icon-btn--sm"
              aria-expanded={true}
              aria-label={t.collapse}
              onClick={() => setOpen(false)}
            >
              <ChevronDown {...ICON} size={16} />
            </button>
          </div>
          <div class="p-checklist-bar" aria-hidden="true">
            <div style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>
          <ol>
            {items.map((it) => (
              <li key={it.id}>
                <button
                  class={`p-checklist-item${it.done ? ' is-done' : ''}${it.current ? ' is-current' : ''}`}
                  aria-current={it.current ? 'step' : undefined}
                  onClick={() => onGo(it.target)}
                >
                  {it.done ? (
                    <CircleCheck {...ICON} size={18} class="p-check is-on" />
                  ) : (
                    <Circle {...ICON} size={18} class="p-check" />
                  )}
                  <span class="p-checklist-label">{sub(it.title)}</span>
                  {it.done && <span class="sr-only">({t.checklistDone})</span>}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
