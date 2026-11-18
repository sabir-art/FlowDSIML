import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus, Search, Settings, Tag as TagIcon, Trash2, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../lib/supabase';
import { check } from '../lib/useAction';
import { useToast } from './Toast';

export type TagRow = Tables<'tags'>;
export type DemoTagRow = Tables<'demo_tags'>;
/** Palette DSI (règle D13) : une couleur par catégorie. */
export const TAG_COLORS = ['blue', 'green', 'orange', 'raspberry', 'plum'] as const;
export type TagColor = (typeof TAG_COLORS)[number];
export const TAG_LIMIT = 20;
export const DEMO_TAG_LIMIT = 5;

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
    remove: (id: string) =>
      guard(async () => {
        check(await supabase.from('tags').delete().eq('id', id));
        toast(t('tags.deleted'));
      }),
  };
}
export type WorkspaceTags = ReturnType<typeof useWorkspaceTags>;

/** Choix de couleur parmi les 5 de la palette (pastilles nommées). */
function ColorPicker({ value, onChange }: { value: TagColor; onChange: (c: TagColor) => void }) {
  const { t } = useTranslation();
  return (
    <span className="tg-colors" role="radiogroup" aria-label={t('tags.color')}>
      {TAG_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={t(`tags.colors.${c}`)}
          className={`sw sw--${c}`}
          onClick={(e) => {
            e.stopPropagation();
            onChange(c);
          }}
        />
      ))}
    </span>
  );
}

/**
 * Recherche ou création d'étiquette et liste à cocher pour une démo (menu de la carte, éditeur).
 */
export function TagPicker({ demoId, store }: { demoId: string; store: WorkspaceTags }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [color, setColor] = useState<TagColor>('blue');
  const mine = new Set(store.tagsOf(demoId).map((x) => x.id));
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
            if (e.key === 'Enter' && needle && !exact) {
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
              onChange={(e) => void store.toggle(demoId, x.id, e.target.checked)}
            />
            <TagChip tag={x} />
          </label>
        ))}
      </div>
      {needle && !exact && (
        <div className="tg-create">
          <button type="button" className="tg-create__btn" onClick={() => void create()}>
            <Plus aria-hidden="true" />
            {t('tags.create', { name: q.trim() })}
          </button>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      )}
      {store.error && (
        <p className="error-msg tg-err" role="alert">
          {store.error}
        </p>
      )}
      <p className="fd-help tg-help">{t('tags.limits', { ws: TAG_LIMIT, demo: DEMO_TAG_LIMIT })}</p>
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
            <TagPicker demoId={demo.id} store={store} />
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
  onManage,
}: {
  store: WorkspaceTags;
  selected: string[];
  setSelected: (ids: string[]) => void;
  mode: 'any' | 'all';
  setMode: (m: 'any' | 'all') => void;
  onManage?: () => void;
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
      <button
        type="button"
        className={`fd-btn tg-filter${selected.length ? ' is-active' : ''}`}
        aria-expanded={open}
        aria-controls="tg-pop"
        onClick={() => setOpen((v) => !v)}
      >
        <TagIcon aria-hidden="true" />
        {t('tags.title')}
        {selected.length > 0 && (
          <span className="tg-count">
            <span aria-hidden="true">{selected.length}</span>
            <span className="sr-only">{t('tags.activeCount', { count: selected.length })}</span>
          </span>
        )}
        <ChevronDown aria-hidden="true" />
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
            {onManage && (
              <button
                type="button"
                className="fd-btn fd-btn--ghost fd-btn--sm"
                onClick={() => {
                  setOpen(false);
                  onManage();
                }}
              >
                <Settings aria-hidden="true" />
                {t('tags.manage')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** « Gérer les étiquettes » : renommer, recolorer, supprimer. */
export function ManageTagsDialog({ store, onClose }: { store: WorkspaceTags; onClose: () => void }) {
  const { t } = useTranslation();
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    store.setError(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="mk">
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal tg-manage" role="dialog" aria-modal="true" aria-labelledby="tg-m-t">
          <div className="modal-head">
            <h2 id="tg-m-t">{t('tags.manage')}</h2>
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
            {store.tags.length === 0 && <p className="muted">{t('tags.none')}</p>}
            <ul className="tg-manage-list">
              {store.tags.map((x) => (
                <li key={x.id}>
                  <input
                    className="input input-sm"
                    aria-label={t('tags.rename', { name: x.name })}
                    maxLength={32}
                    value={names[x.id] ?? x.name}
                    onChange={(e) => setNames({ ...names, [x.id]: e.target.value })}
                    onBlur={() => {
                      const v = (names[x.id] ?? x.name).trim();
                      if (v && v !== x.name) void store.update(x.id, { name: v });
                    }}
                  />
                  <ColorPicker
                    value={x.color as TagColor}
                    onChange={(c) => void store.update(x.id, { color: c })}
                  />
                  <small className="muted">{t('tags.demos', { count: store.countOf(x.id) })}</small>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    aria-label={t('tags.delete', { name: x.name })}
                    onClick={() => void store.remove(x.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {store.error && (
              <p className="error-msg" role="alert">
                {store.error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
