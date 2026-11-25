import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, ArrowDown, ArrowUp, Plus } from 'lucide-react';
import { Button, EmptyState } from '@flowdsiml/ui';
import { TagsPreview } from '../../../components/EmptyPreviews';
import { SettingsShell } from '../SettingsShell';
import { supabase } from '../../../lib/supabase';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { Menu } from '../../../components/Menu';
import { ConfirmDialog, useConfirm } from '../../../components/ConfirmDialog';
import {
  TAG_LIMIT,
  proposedColor,
  TagChip,
  TagColorPicker,
  useWorkspaceTags,
  type TagColor,
  type TagRow,
} from '../../../components/Tags';
import './tags.css';

const NAME_MAX = 32;
type Sort = { by: 'name' | 'demos'; dir: 'asc' | 'desc' };

/** Nom déjà pris (sans tenir compte de la casse ni des espaces autour), hors l'étiquette elle-même. */
const taken = (tags: TagRow[], name: string, self?: string) =>
  tags.find(
    (x) => x.id !== self && x.name.trim().toLocaleLowerCase('fr') === name.trim().toLocaleLowerCase('fr'),
  );

/**
 * L52 §1-2 : Paramètres › Contenu › Étiquettes. Une carte, une ligne par étiquette (pastille, nombre de démos
 * vers Démos filtré, menu Renommer / Couleur / Supprimer), tri par nom ou nombre de démos, création en tête de
 * liste. Lecteurs : la même liste, sans bouton ni menu.
 */
export function TagsSettings() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const ws = current!;
  const store = useWorkspaceTags(ws.id);
  const editable = can('demo.edit');
  const [confirmDialog, ask] = useConfirm();
  const [live, setLive] = useState<Set<string> | null>(null);
  const [sort, setSort] = useState<Sort>({ by: 'name', dir: 'asc' });
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [coloring, setColoring] = useState<string | null>(null);
  /** §2.4 : fusion en cours (étiquette fusionnée, étiquette choisie). */
  const [merging, setMerging] = useState<{ from: TagRow; to: string } | null>(null);
  const limitId = useId();

  // Démos non supprimées : le compte de chaque ligne est celui que montre Démos filtré
  useEffect(() => {
    void supabase
      .from('demos')
      .select('id')
      .eq('workspace_id', ws.id)
      .is('deleted_at', null)
      .then((r) => setLive(new Set((r.data ?? []).map((d) => d.id))));
  }, [ws.id, store.links]);

  const count = (id: string) =>
    store.links.filter((l) => l.tag_id === id && (!live || live.has(l.demo_id))).length;
  const rows = useMemo(() => {
    const list = [...store.tags];
    const byName = (a: TagRow, b: TagRow) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    list.sort((a, b) =>
      sort.by === 'name'
        ? byName(a, b) * (sort.dir === 'asc' ? 1 : -1)
        : (count(a.id) - count(b.id)) * (sort.dir === 'asc' ? 1 : -1) || byName(a, b),
    );
    return list;
  }, [store.tags, store.links, live, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const full = store.tags.length >= TAG_LIMIT;
  const loaded = live !== null;

  async function remove(tag: TagRow) {
    const n = count(tag.id);
    const yes = await ask({
      title: t('tags.deleteTitle', { name: tag.name }),
      body: <p>{n ? t('tags.deleteBody', { count: n }) : t('tags.deleteUnused')}</p>,
      confirmLabel: t('tags.deleteAction'),
      danger: true,
    });
    if (yes) await store.remove(tag.id);
  }

  const header = (by: Sort['by'], label: string) => {
    const on = sort.by === by;
    return (
      <span
        role="columnheader"
        aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={on ? 'is-sorted' : undefined}
      >
        <button
          type="button"
          className="tgs-sort"
          onClick={() =>
            setSort(
              on
                ? { by, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
                : { by, dir: by === 'name' ? 'asc' : 'desc' },
            )
          }
        >
          {label}
          {on && (sort.dir === 'asc' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />)}
        </button>
      </span>
    );
  };

  const newButton = (
    <Button
      variant="primary"
      icon={<Plus size={16} />}
      aria-disabled={full || undefined}
      aria-describedby={full ? limitId : undefined}
      title={full ? t('tags.wsLimit', { n: TAG_LIMIT }) : undefined}
      onClick={() => {
        if (full) return;
        setRenaming(null);
        setCreating(true);
      }}
    >
      {t('tags.new')}
    </Button>
  );

  return (
    <SettingsShell legacy={false} actions={editable && loaded ? newButton : undefined}>
      <section className="stg-sec tgs-page" aria-labelledby="tgs-title">
        <div className="stg-sec__head">
          <div>
            <h2 id="tgs-title">{t('settings.tags')}</h2>
            <p>{t('tags.pageSub')}</p>
          </div>
          {loaded && store.tags.length > 0 && (
            <div className="stg-sec__acts">
              <span className="tgs-quota">{t('tags.quota', { n: store.tags.length, max: TAG_LIMIT })}</span>
              {full && (
                <span id={limitId} className="sr-only">
                  {t('tags.wsLimit', { n: TAG_LIMIT })}
                </span>
              )}
            </div>
          )}
        </div>
        {!editable && <p className="tgs-ro">{t('tags.readOnly')}</p>}
        {store.error && (
          <p className="stg-error tgs-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {store.error}
          </p>
        )}

        {loaded && store.tags.length === 0 && !creating ? (
          // EMPTY-01 : « Nouvelle étiquette » n'est que dans l'en-tête de la page
          <EmptyState preview={<TagsPreview />} title={t('tags.emptyTitle')} body={t('tags.emptyBody')} />
        ) : (
          loaded && (
            <div className="tgs-card" role="table" aria-label={t('tags.tableLabel')}>
              {/* §18.6 : lignes à filets de 56 px, l'écart est porté par la hauteur des lignes */}
              <div className="tgs-row tgs-row--head" role="row" data-gap-exempt="">
                {header('name', t('tags.colName'))}
                {header('demos', t('tags.colDemos'))}
                <span role="columnheader">
                  <span className="sr-only">{t('glossary.actions')}</span>
                </span>
              </div>
              {creating && (
                <CreateRow
                  tags={store.tags}
                  onCancel={() => setCreating(false)}
                  onCreate={async (name, color) => {
                    if (await store.create(name, color)) setCreating(false);
                  }}
                />
              )}
              {rows.map((tag) => {
                const n = count(tag.id);
                return (
                  <div key={tag.id} className="tgs-row" role="row">
                    <span role="cell" className="tgs-name">
                      {renaming === tag.id ? (
                        <RenameField
                          tag={tag}
                          tags={store.tags}
                          onDone={async (name) => {
                            if (name !== null && name !== tag.name) {
                              if (!(await store.update(tag.id, { name }))) return;
                            }
                            setRenaming(null);
                          }}
                          onMerge={(other) => {
                            setRenaming(null);
                            setMerging({ from: tag, to: other.id });
                          }}
                        />
                      ) : (
                        <TagChip tag={tag} />
                      )}
                    </span>
                    <span role="cell">
                      {n ? (
                        <Link
                          className="tgs-count"
                          to={`/?etiquettes=${tag.id}`}
                          aria-label={t('tags.demosOf', { count: n, name: tag.name })}
                        >
                          {t('tags.demos', { count: n })}
                        </Link>
                      ) : (
                        <span className="tgs-count">{t('tags.noDemo')}</span>
                      )}
                    </span>
                    <span role="cell" className="tgs-more">
                      {editable && (
                        <Menu
                          label={t('tags.more', { name: tag.name })}
                          items={[
                            {
                              label: t('tags.renameAction'),
                              onSelect: () => {
                                setCreating(false);
                                setRenaming(tag.id);
                              },
                            },
                            { label: t('tags.colorAction'), onSelect: () => setColoring(tag.id) },
                            {
                              label: t('tags.merge'),
                              disabled: store.tags.length < 2,
                              hint: store.tags.length < 2 ? t('tags.mergeNone') : undefined,
                              onSelect: () =>
                                setMerging({ from: tag, to: rows.find((x) => x.id !== tag.id)!.id }),
                            },
                            'separator',
                            { label: t('tags.deleteAction'), danger: true, onSelect: () => void remove(tag) },
                          ]}
                        />
                      )}
                      {coloring === tag.id && (
                        <ColorPopover
                          tag={tag}
                          onPick={(c) => void store.update(tag.id, { color: c })}
                          onClose={() => setColoring(null)}
                        />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )}
      </section>
      {confirmDialog}
      {merging && (
        <ConfirmDialog
          open
          title={t('tags.mergeTitle', { name: merging.from.name })}
          body={
            <>
              <p>
                {count(merging.from.id)
                  ? t('tags.mergeBody', { count: count(merging.from.id), name: merging.from.name })
                  : t('tags.mergeBodyNone', { name: merging.from.name })}
              </p>
              <fieldset className="tgs-merge">
                <legend>{t('tags.mergeWith')}</legend>
                {rows
                  .filter((x) => x.id !== merging.from.id)
                  .map((x) => (
                    <label key={x.id} className="tgs-merge__o">
                      <input
                        type="radio"
                        name="tgs-merge"
                        checked={merging.to === x.id}
                        onChange={() => setMerging({ ...merging, to: x.id })}
                      />
                      <TagChip tag={x} />
                      <span className="tgs-merge__n">
                        {count(x.id) ? t('tags.demos', { count: count(x.id) }) : t('tags.noDemo')}
                      </span>
                    </label>
                  ))}
              </fieldset>
            </>
          }
          confirmLabel={t('tags.mergeAction')}
          onConfirm={async () => {
            const to = store.tags.find((x) => x.id === merging.to);
            if (to) await store.merge(merging.from, to);
          }}
          onClose={() => setMerging(null)}
        />
      )}
    </SettingsShell>
  );
}

/** §2.1 : ligne de création en tête de liste (nom, couleur, Créer ; Échap annule). */
function CreateRow({
  tags,
  onCancel,
  onCreate,
}: {
  tags: TagRow[];
  onCancel: () => void;
  onCreate: (name: string, color: TagColor) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColor>(() => proposedColor(tags));
  const errId = useId();
  const dup = name.trim() ? taken(tags, name) : undefined;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || dup) return;
    void onCreate(name.trim(), color);
  };
  return (
    <form
      className="tgs-row tgs-row--edit"
      role="row"
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <span role="cell" className="tgs-edit">
        <input
          className="fd-input"
          autoComplete="off"
          aria-label={t('tags.name')}
          maxLength={NAME_MAX}
          autoFocus
          value={name}
          aria-invalid={dup ? true : undefined}
          aria-describedby={dup ? errId : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        <TagColorPicker value={color} onChange={setColor} />
        <Button type="submit" variant="primary" disabled={!name.trim() || !!dup}>
          {t('tags.createAction')}
        </Button>
      </span>
      {dup && (
        <p id={errId} className="tgs-err" role="alert">
          {t('tags.duplicate')}
        </p>
      )}
    </form>
  );
}

/** §2.2 : renommage dans la ligne. Entrée valide, Échap annule, la perte du focus valide. */
function RenameField({
  tag,
  tags,
  onDone,
  onMerge,
}: {
  tag: TagRow;
  tags: TagRow[];
  onDone: (name: string | null) => Promise<void>;
  /** Nom déjà pris : fusionner avec l'étiquette qui le porte (§2.2). */
  onMerge: (other: TagRow) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(tag.name);
  const ref = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  const errId = useId();
  const dup = value.trim() ? taken(tags, value, tag.id) : undefined;
  useEffect(() => ref.current?.select(), []);
  const commit = () => {
    if (cancelled.current) return;
    const v = value.trim();
    if (!v || v === tag.name) return void onDone(null);
    if (dup) return;
    void onDone(v);
  };
  return (
    <span className="tgs-rename">
      <span className="tgs-edit">
        <input
          ref={ref}
          className="fd-input"
          autoComplete="off"
          aria-label={t('tags.rename', { name: tag.name })}
          maxLength={NAME_MAX}
          value={value}
          aria-invalid={dup ? true : undefined}
          aria-describedby={dup ? errId : undefined}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancelled.current = true;
              void onDone(null);
            }
          }}
        />
        <span className="tgs-hint">{t('tags.enterToSave')}</span>
      </span>
      {dup && (
        <span className="tgs-err">
          <span id={errId} role="alert">
            {t('tags.duplicate')}
          </span>
          <button
            type="button"
            className="link-button"
            // Avant la perte du focus du champ (qui validerait le renommage)
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              cancelled.current = true;
              onMerge(dup);
            }}
          >
            {t('tags.mergeInstead', { name: dup.name })}
          </button>
        </span>
      )}
    </span>
  );
}

/** §2.3 : petite fenêtre des 8 pastilles (28 px), accrochée au menu de la ligne ; l'aperçu change tout de suite. */
function ColorPopover({
  tag,
  onPick,
  onClose,
}: {
  tag: TagRow;
  onPick: (c: TagColor) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Écouteurs posés une seule fois : retirés et reposés à chaque rendu, ils manqueraient la touche
  // qui déclenche ce rendu (un écouteur retiré pendant la diffusion d'un événement n'est plus appelé)
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    // Retour du focus au bouton « Plus d'actions » de la ligne (le menu l'a déjà refermé)
    const trigger =
      ref.current?.parentElement?.querySelector<HTMLElement>('button[aria-haspopup]') ??
      (document.activeElement as HTMLElement | null);
    ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close.current();
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      trigger?.focus();
    };
  }, []);
  return (
    <div ref={ref} className="tgs-pop" role="dialog" aria-labelledby={titleId}>
      <p id={titleId} className="tgs-pop__t">
        {t('tags.colorOf', { name: tag.name })}
      </p>
      <TagColorPicker large value={tag.color as TagColor} onChange={onPick} label={t('tags.color')} />
      <p className="tgs-pop__name" aria-hidden="true">
        {t(`tags.colors.${tag.color}`)}
      </p>
    </div>
  );
}
