import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FilterContent } from './toolbar/ListToolbar';
import { Check, Plus, Search, Settings, Tag as TagIcon, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../lib/supabase';
import { check } from '../lib/useAction';
import { useToast } from './Toast';

export type TagRow = Tables<'tags'>;
export type DemoTagRow = Tables<'demo_tags'>;
/** Palette DSI (règle D13) : une couleur par catégorie. */
export const TAG_COLORS = [
  'blue',
  'green',
  'orange',
  'raspberry',
  'plum',
  'slate',
  'teal',
  'violet',
] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export const TAG_LIMIT = 20;
export const DEMO_TAG_LIMIT = 5;

/** L52 §2.1 : première des 8 couleurs pas encore utilisée, sinon la moins utilisée. */
export function proposedColor(tags: Array<Pick<TagRow, 'color'>>): TagColor {
  const uses = new Map<TagColor, number>(TAG_COLORS.map((c) => [c, 0]));
  for (const x of tags)
    if (uses.has(x.color as TagColor)) uses.set(x.color as TagColor, uses.get(x.color as TagColor)! + 1);
  return [...TAG_COLORS].sort((a, b) => uses.get(a)! - uses.get(b)!)[0]!;
}

/** Pastille d'étiquette : point et texte de sa couleur, fond clair de la même teinte. */
export function TagChip({ tag }: { tag: Pick<TagRow, 'name' | 'color'> }) {
  return <span className={`tg tg--${tag.color}`}>{tag.name}</span>;
}

/** Étiquettes du workspace et associations aux démos, avec les opérations (droits vérifiés en base). */
export function useWorkspaceTags(wsId: string | undefined) {
  const { t } = useTranslation();
  const toast = useToast();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [links, setLinks] = useState<DemoTagRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wsId) return;
    const [a, b] = await Promise.all([
      supabase.from('tags').select('*').eq('workspace_id', wsId).order('name'),
      supabase.from('demo_tags').select('*').eq('workspace_id', wsId),
    ]);
    setTags(a.data ?? []);
    setLinks(b.data ?? []);
  }, [wsId]);
  useEffect(() => {
    void load();
  }, [load]);

  const fail = (e: unknown) => {
    const msg = (e as { message?: string; code?: string })?.message ?? '';
    const code = (e as { code?: string })?.code;
    setError(
      /DEMO_TAG_LIMIT/.test(msg)
        ? t('tags.demoLimit', { n: DEMO_TAG_LIMIT })
        : /TAG_LIMIT/.test(msg)
          ? t('tags.wsLimit', { n: TAG_LIMIT })
          : code === '23505'
            ? t('tags.duplicate')
            : t('errors.generic', { message: msg }),
    );
  };
  const guard = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const tagsOf = (demoId: string) =>
    links
      .filter((l) => l.demo_id === demoId)
      .map((l) => tags.find((x) => x.id === l.tag_id))
      .filter((x): x is TagRow => !!x)
      .sort((a, b) => a.name.localeCompare(b.name));

  return {
    tags,
    links,
    error,
    setError,
    reload: load,
    tagsOf,
    countOf: (tagId: string) => links.filter((l) => l.tag_id === tagId).length,
    async create(name: string, color: TagColor) {
      let created: TagRow | null = null;
      const ok = await guard(async () => {
        created = check(
          await supabase
            .from('tags')
            .insert({ workspace_id: wsId!, name: name.trim(), color })
            .select()
            .single(),
        );
      });
      return ok ? created : null;
    },
    toggle: (demoId: string, tagId: string, on: boolean) =>
      guard(async () => {
        if (on)
          check(
            await supabase.from('demo_tags').insert({ demo_id: demoId, tag_id: tagId, workspace_id: wsId! }),
          );
        else check(await supabase.from('demo_tags').delete().eq('demo_id', demoId).eq('tag_id', tagId));
      }),
    update: (id: string, patch: { name?: string; color?: TagColor }) =>
      guard(async () => {
        check(await supabase.from('tags').update(patch).eq('id', id));
      }),
    /** L52 §2.4 : fusion (RPC merge_tags, transactionnelle) ; renvoie le nombre de démos de `from`. */
    async merge(from: TagRow, to: TagRow) {
      let count = 0;
      const ok = await guard(async () => {
        count = check(await supabase.rpc('merge_tags', { p_from: from.id, p_to: to.id })) ?? 0;
      });
      if (ok) toast(t('tags.merged', { from: from.name, to: to.name, count }));
      return ok;
    },
    remove: (id: string) =>
      guard(async () => {
        check(await supabase.from('tags').delete().eq('id', id));
        toast(t('tags.deleted'));
      }),
  };
}
export type WorkspaceTags = ReturnType<typeof useWorkspaceTags>;

/**
 * Choix de couleur parmi les 8 de la palette : pastilles nommées en radiogroup, aux flèches (un seul arrêt de
 * tabulation). La pastille choisie porte un anneau et une coche, jamais la couleur seule. `large` : 28 px (L52).
 */
export function TagColorPicker({
  value,
  onChange,
  large = false,
  label,
}: {
  value: TagColor;
  onChange: (c: TagColor) => void;
  large?: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  const move = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const next = TAG_COLORS[(i + d + TAG_COLORS.length) % TAG_COLORS.length]!;
    onChange(next);
    const group = e.currentTarget.parentElement;
    requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>(`[data-color="${next}"]`)?.focus());
  };
  return (
    <span
      className={`tg-colors${large ? ' tg-colors--lg' : ''}`}
      role="radiogroup"
      aria-label={label ?? t('tags.color')}
    >
      {TAG_COLORS.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          data-color={c}
          // L52 §2.3 : nom dans aria-label et sous la grille, sans infobulle (un seul Échap ferme la fenêtre)
          data-no-tip=""
          aria-checked={value === c}
          tabIndex={value === c ? 0 : -1}
          aria-label={t(`tags.colors.${c}`)}
          className={`sw sw--${c}`}
          onKeyDown={(e) => move(e, i)}
          onClick={(e) => {
            e.stopPropagation();
            onChange(c);
          }}
        >
          {value === c && <Check aria-hidden="true" />}
        </button>
      ))}
    </span>
  );
}

/**
 * Recherche ou création d'étiquette et liste à cocher pour une démo (menu de la carte, éditeur).
 */
export function TagPicker({
  demoId,
  store,
  manage = false,
}: {
  demoId: string;
  store: WorkspaceTags;
  /** L52 §2.6 : lien de pied « Gérer les étiquettes » vers Paramètres › Étiquettes. */
  manage?: boolean;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  // L52 §2.1 : couleur proposée (première libre, sinon la moins utilisée)
  const [color, setColor] = useState<TagColor>(() => proposedColor(store.tags));
  const mine = new Set(store.tagsOf(demoId).map((x) => x.id));
  // Limites : 5 par démo (les autres cases désactivées), 20 par espace (« Créer » désactivé)
  const demoFull = mine.size >= DEMO_TAG_LIMIT;
  const wsFull = store.tags.length >= TAG_LIMIT;
  const needle = q.trim().toLowerCase();
  const list = store.tags.filter((x) => !needle || x.name.toLowerCase().includes(needle));
  const exact = store.tags.some((x) => x.name.trim().toLowerCase() === needle);
  const create = async () => {
    const tag = await store.create(q, color);
    if (tag) {
      await store.toggle(demoId, (tag as TagRow).id, true);
      setQ('');
    }
  };
  return (
    <div className="tg-picker">
      <label className="tg-search">
        <Search aria-hidden="true" />
        <input
          className="fd-input"
          type="search"
          value={q}
          maxLength={32}
          placeholder={t('tags.searchOrCreate')}
          aria-label={t('tags.searchOrCreate')}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && needle && !exact && !wsFull && !demoFull) {
              e.preventDefault();
              void create();
            }
          }}
          autoFocus
        />
      </label>
      <div className="tg-list">
        {list.map((x) => (
          <label key={x.id} className="tg-opt">
            <input
              type="checkbox"
              checked={mine.has(x.id)}
              disabled={demoFull && !mine.has(x.id)}
              aria-describedby={demoFull && !mine.has(x.id) ? `tg-full-${demoId}` : undefined}
              onChange={(e) => void store.toggle(demoId, x.id, e.target.checked)}
            />
            <TagChip tag={x} />
          </label>
        ))}
      </div>
      {needle && !exact && (
        <div className="tg-create">
          <button
            type="button"
            className="tg-create__btn"
            aria-disabled={wsFull || demoFull || undefined}
            title={wsFull ? t('tags.wsLimit', { n: TAG_LIMIT }) : undefined}
            onClick={() => !wsFull && !demoFull && void create()}
          >
            <Plus aria-hidden="true" />
            {t('tags.create', { name: q.trim() })}
          </button>
          <TagColorPicker value={color} onChange={setColor} />
        </div>
      )}
      {store.error && (
        <p className="error-msg tg-err" role="alert">
          {store.error}
        </p>
      )}
      {demoFull ? (
        <p id={`tg-full-${demoId}`} className="fd-help tg-help">
          {t('tags.demoLimit', { n: DEMO_TAG_LIMIT })}
        </p>
      ) : (
        <p className="fd-help tg-help">{t('tags.limits', { ws: TAG_LIMIT, demo: DEMO_TAG_LIMIT })}</p>
      )}
      {manage && (
        <Link className="tg-manage-link" to="/settings/tags">
          {t('tags.manage')}
        </Link>
      )}
    </div>
  );
}

/**
 * L52 §2.6 : ligne d'étiquettes d'une démo (carte, vue liste). Éditeurs : la ligne ouvre le sélecteur,
 * accroché à elle ; sans étiquette, « + Étiquette » paraît au survol et au focus de la carte. Lecteurs :
 * les pastilles seules.
 */
export function CardTags({
  demo,
  store,
  editable,
  list = false,
}: {
  demo: { id: string; title: string };
  store: WorkspaceTags;
  editable: boolean;
  /** Vue liste : alignée sous le nom de la démo. */
  list?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const tags = store.tagsOf(demo.id);
  const popId = `tg-card-${demo.id}`;
  useEffect(() => {
    if (!open) return;
    store.setError(null);
    const trigger = root.current?.querySelector<HTMLElement>('.tg-line');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger?.focus();
      }
    };
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const chips = tags.map((x) => <TagChip key={x.id} tag={x} />);
  const cls = `tg-row${list ? ' tg-row--list' : ''}`;
  if (!editable)
    return tags.length ? (
      <span className={cls} aria-label={t('tags.title')}>
        {chips}
      </span>
    ) : null;
  return (
    <div
      ref={root}
      className={`${cls} tg-card${open ? ' is-open' : ''}${tags.length ? '' : ' tg-card--empty'}`}
    >
      <button
        type="button"
        className={tags.length ? 'tg-line' : 'tg-line tg-add'}
        aria-label={tags.length ? t('tags.of', { title: demo.title }) : undefined}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={() => setOpen(!open)}
      >
        {tags.length ? chips : t('tags.addOnCard')}
      </button>
      {open && (
        <div
          id={popId}
          className="tg-pop fd-card"
          role="dialog"
          aria-label={t('tags.of', { title: demo.title })}
        >
          <TagPicker demoId={demo.id} store={store} manage />
        </div>
      )}
    </div>
  );
}

/** Fenêtre « Étiquettes de … » ouverte depuis le menu « … » d'une carte. */
export function TagsDialog({
  demo,
  store,
  onClose,
}: {
  demo: { id: string; title: string };
  store: WorkspaceTags;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    store.setError(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="mk">
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div
          className="modal modal-sm tg-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={t('tags.of', { title: demo.title })}
        >
          <div className="modal-head">
            <h2>{t('tags.of', { title: demo.title })}</h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body">
            <TagPicker demoId={demo.id} store={store} manage />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Filtre « Étiquettes » du tableau de bord : recherche, liste à cocher avec nombre de démos,
 * combinaison « Au moins une » / « Toutes », Effacer et Gérer les étiquettes.
 */
export function TagFilter({
  store,
  selected,
  setSelected,
  mode,
  setMode,
  manage = false,
}: {
  store: WorkspaceTags;
  selected: string[];
  setSelected: (ids: string[]) => void;
  mode: 'any' | 'all';
  setMode: (m: 'any' | 'all') => void;
  /** L52 §2.6 : lien « Gérer les étiquettes » vers Paramètres › Étiquettes (éditeurs). */
  manage?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>('.tg-filter')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const needle = q.trim().toLowerCase();
  return (
    <div className="tg-anchor" ref={root}>
      {/* L40 : déclencheur « Étiquettes : valeur » (fd-filter), actif dès qu'une étiquette est choisie */}
      <button
        type="button"
        className={`fd-btn fd-filter tg-filter${selected.length ? ' fd-filter--active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? 'tg-pop' : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <FilterContent
          icon={<TagIcon />}
          label={t('tags.title')}
          value={
            selected.length === 0
              ? t('toolbar.allF')
              : selected.length > 2
                ? t('tags.countShort', { count: selected.length })
                : selected.map((id) => store.tags.find((x) => x.id === id)?.name ?? '').join(', ')
          }
        />
      </button>
      {open && (
        <div className="tg-pop fd-card" id="tg-pop" role="dialog" aria-label={t('tags.filterBy')}>
          <label className="tg-search">
            <Search aria-hidden="true" />
            <input
              className="fd-input"
              type="search"
              value={q}
              placeholder={t('tags.search')}
              aria-label={t('tags.search')}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </label>
          {store.tags.length === 0 ? (
            <p className="fd-help tg-empty">{t('tags.none')}</p>
          ) : (
            <fieldset>
              <legend className="sr-only">{t('tags.title')}</legend>
              {store.tags
                .filter((x) => !needle || x.name.toLowerCase().includes(needle))
                .map((x) => (
                  <label key={x.id} className="tg-opt">
                    <input
                      type="checkbox"
                      checked={selected.includes(x.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? [...selected, x.id] : selected.filter((s) => s !== x.id),
                        )
                      }
                    />
                    <TagChip tag={x} />
                    <small>{store.countOf(x.id)}</small>
                  </label>
                ))}
            </fieldset>
          )}
          <div className="tg-mode" role="radiogroup" aria-label={t('tags.combine')}>
            <label>
              <input type="radio" name="tgm" checked={mode === 'any'} onChange={() => setMode('any')} />
              {t('tags.any')}
            </label>
            <label>
              <input type="radio" name="tgm" checked={mode === 'all'} onChange={() => setMode('all')} />
              {t('tags.all')}
            </label>
          </div>
          <div className="tg-foot">
            <button type="button" className="fd-btn fd-btn--ghost fd-btn--sm" onClick={() => setSelected([])}>
              {t('tags.clear')}
            </button>
            {manage && (
              <Link className="fd-btn fd-btn--ghost fd-btn--sm" to="/settings/tags">
                <Settings aria-hidden="true" />
                {t('tags.manage')}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
