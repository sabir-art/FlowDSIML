import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Notebook, Search, X } from 'lucide-preact';
import { foldText, type GlossaryEntry } from '@flowdsiml/core';
import type { Dict } from './i18n';

const ICON = { size: 18, strokeWidth: 2, 'aria-hidden': true } as const;
const TIP_ID = 'p-gloss-tip';

/**
 * L17-09 : info-bulle d'un terme souligné (role=tooltip, portée par le lecteur). Ouverte au survol
 * ou au focus d'un .p-term (délégation sur `root`), fermée par Échap, à la sortie ou au défilement.
 */
export function GlossaryTip({
  root,
  terms,
  t,
}: {
  root: { current: HTMLElement | null };
  terms: GlossaryEntry[];
  t: Dict;
}) {
  const [tip, setTip] = useState<{ i: number; x: number; y: number | null } | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Placement après mesure : sous la bulle qui contient le terme ; hors bulle, au-dessus du terme si
  // la place le permet, sinon en dessous, et jamais sur les boutons (spec §6).
  useLayoutEffect(() => {
    if (!tip || tip.y !== null || !anchor.current || !box.current) return;
    const r = anchor.current.getBoundingClientRect();
    const h = box.current.offsetHeight;
    // L17-09 : dans une bulle, l'infobulle se place sous la bulle (hors de la bulle : titre, texte et
    // hotspot restent visibles), au-dessus seulement si la place manque en bas
    const bubble = anchor.current.closest('.p-tip, .p-sheet')?.getBoundingClientRect();
    let y: number;
    if (bubble) {
      y = bubble.bottom + 8;
      if (y + h > window.innerHeight - 8) y = Math.max(8, bubble.top - 8 - h);
    } else {
      y = r.top - 8 - h;
      if (y < 8) {
        y = r.bottom + 8;
        const acts = anchor.current.closest('.p-text-step, .p-ba-card')?.querySelector('.p-actions, .p-btn');
        const a = acts?.getBoundingClientRect();
        if (a && y < a.bottom && y + h > a.top) y = a.bottom + 8;
      }
    }
    setTip({ ...tip, y });
  }, [tip]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const show = (e: Event) => {
      const target = (e.target as HTMLElement | null)?.closest?.('.p-term') as HTMLElement | null;
      if (!target || !el.contains(target)) return;
      const i = Number(target.dataset.term);
      if (!terms[i]) return;
      anchor.current?.removeAttribute('aria-describedby');
      anchor.current = target;
      target.setAttribute('aria-describedby', TIP_ID);
      const r = target.getBoundingClientRect();
      setTip({ i, x: Math.min(Math.max(8, r.left), window.innerWidth - 268), y: null });
    };
    const hide = (e: Event) => {
      const target = (e.target as HTMLElement | null)?.closest?.('.p-term');
      if (target && target === anchor.current) close();
    };
    const close = () => {
      anchor.current?.removeAttribute('aria-describedby');
      anchor.current = null;
      setTip(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && anchor.current) {
        e.preventDefault();
        close();
      }
    };
    el.addEventListener('mouseover', show);
    el.addEventListener('focusin', show);
    el.addEventListener('mouseout', hide);
    el.addEventListener('focusout', hide);
    el.addEventListener('keydown', key);
    window.addEventListener('scroll', close, true);
    return () => {
      el.removeEventListener('mouseover', show);
      el.removeEventListener('focusin', show);
      el.removeEventListener('mouseout', hide);
      el.removeEventListener('focusout', hide);
      el.removeEventListener('keydown', key);
      window.removeEventListener('scroll', close, true);
    };
  }, [root, terms]);

  const term = tip ? terms[tip.i] : undefined;
  if (!tip || !term) return null;
  return (
    <div
      id={TIP_ID}
      ref={box}
      role="tooltip"
      class="p-gloss-tip"
      style={{
        left: `${tip.x}px`,
        top: `${tip.y ?? 0}px`,
        visibility: tip.y === null ? 'hidden' : undefined,
      }}
    >
      <b>{term.term}</b>
      {term.oldTerm && (
        <span class="p-gloss-old">
          {t.glossaryOld} <s>{term.oldTerm}</s>
        </span>
      )}
      {term.definition}
    </div>
  );
}

/** L17-10 : tiroir « Glossaire » (380 px, modal) : termes présents dans la démo, recherche. */
export function GlossaryDrawer({
  terms,
  t,
  onClose,
}: {
  terms: GlossaryEntry[];
  t: Dict;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const sorted = useMemo(
    () => [...terms].sort((a, b) => a.term.localeCompare(b.term, 'fr', { sensitivity: 'base' })),
    [terms],
  );
  const fq = foldText(q.trim());
  const shown = fq
    ? sorted.filter((x) =>
        [x.term, x.oldTerm ?? '', x.definition, ...(x.forms ?? [])].some((s) => foldText(s).includes(fq)),
      )
    : sorted;
  const count = (shown.length === 1 ? t.glossaryCount_one : t.glossaryCount_other).replace(
    '{{count}}',
    String(shown.length),
  );
  return (
    <dialog
      ref={ref}
      class="p-gloss-drawer"
      aria-labelledby="p-gloss-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div class="p-gloss-inner">
        <header>
          <Notebook {...ICON} size={20} />
          <h2 id="p-gloss-title">{t.glossary}</h2>
          <button class="p-icon-btn" aria-label={t.glossaryClose} onClick={() => ref.current?.close()}>
            <X {...ICON} />
          </button>
        </header>
        <div class="p-gloss-search">
          <Search {...ICON} />
          <input
            type="search"
            aria-label={t.glossarySearch}
            placeholder={t.glossarySearch}
            value={q}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          />
        </div>
        <p class="p-gloss-count" role="status">
          {count}
        </p>
        {shown.length > 0 ? (
          <dl>
            {shown.map((x) => (
              <div key={x.term}>
                <dt>
                  {x.term}
                  {x.oldTerm && (
                    <span class="p-gloss-old">
                      {t.glossaryOld} <s>{x.oldTerm}</s>
                    </span>
                  )}
                </dt>
                <dd>{x.definition}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p class="p-gloss-empty">{t.glossaryNone}</p>
        )}
      </div>
    </dialog>
  );
}
