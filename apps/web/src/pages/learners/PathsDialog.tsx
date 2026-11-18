import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';

type Path = Tables<'paths'>;
type Mod = Tables<'path_modules'>;
type Structure = Tables<'structures'>;
type Demo = { id: string; title: string };

/** Formations (suite de démos) et structures du workspace : création, modules, ordre, suppression. */
export function PathsDialog({ wsId, onClose }: { wsId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'paths' | 'structures'>('paths');
  const [paths, setPaths] = useState<Path[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newStructure, setNewStructure] = useState('');
  const { error, run } = useAction();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [p, m, d, s] = await Promise.all([
      supabase.from('paths').select('*').eq('workspace_id', wsId).order('created_at'),
      supabase.from('path_modules').select('*').eq('workspace_id', wsId).order('position'),
      supabase
        .from('demos')
        .select('id, title')
        .eq('workspace_id', wsId)
        .is('deleted_at', null)
        .order('title'),
      supabase.from('structures').select('*').eq('workspace_id', wsId).order('name'),
    ]);
    setPaths(p.data ?? []);
    setMods(m.data ?? []);
    setDemos((d.data ?? []) as Demo[]);
    setStructures(s.data ?? []);
  }, [wsId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (back?.isConnected) back.focus();
    };
  }, [onClose]);

  const act = (fn: () => Promise<unknown>) => void run(async () => (await fn(), await load()));
  const modsOf = (id: string) => mods.filter((m) => m.path_id === id).sort((a, b) => a.position - b.position);

  async function reorder(pathId: string, list: Mod[]) {
    for (const [i, m] of list.entries())
      check(
        await supabase
          .from('path_modules')
          .update({ position: i })
          .eq('path_id', pathId)
          .eq('demo_id', m.demo_id),
      );
  }

  return createPortal(
    <div className="mk l13-layer l13-layer--top">
      <div className="l13-scrim" aria-hidden="true" onClick={onClose} />
      <div
        className="l13-modal l13-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="l13-pa-t"
        ref={ref}
      >
        <header>
          <h2 id="l13-pa-t" tabIndex={-1} data-autofocus>
            {t('learners.paths.title')}
          </h2>
          <Button size="sm" variant="ghost" icon={<X />} aria-label={t('common.close')} onClick={onClose} />
        </header>
        <div className="body">
          <div className="fd-tabs" role="tablist" aria-label={t('learners.paths.title')}>
            {(['paths', 'structures'] as const).map((id) => (
              <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}>
                {t(`learners.paths.tab.${id}`)}
              </button>
            ))}
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          {tab === 'paths' ? (
            <>
              <p className="fd-help">{t('learners.paths.help')}</p>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTitle.trim()) return;
                  act(async () => {
                    const p = check(
                      await supabase
                        .from('paths')
                        .insert({ workspace_id: wsId, title: newTitle.trim() })
                        .select()
                        .single(),
                    );
                    setNewTitle('');
                    setOpen(p.id);
                  });
                }}
              >
                <label className="fd-field grow">
                  <span className="sr-only">{t('learners.paths.newTitle')}</span>
                  <input
                    className="fd-input"
                    placeholder={t('learners.paths.newTitle')}
                    maxLength={160}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </label>
                <Button type="submit" variant="primary" icon={<Plus />} disabled={!newTitle.trim()}>
                  {t('learners.paths.create')}
                </Button>
              </form>
              <ul className="l13-paths">
                {paths.map((p) => {
                  const list = modsOf(p.id);
                  const isOpen = open === p.id;
                  return (
                    <li key={p.id}>
                      <div className="row">
                        <button
                          type="button"
                          className="l13-paths__toggle grow"
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : p.id)}
                        >
                          <b>{p.title || t('learners.untitled')}</b>{' '}
                          <span className="fd-muted">{t('learners.fo.modules', { count: list.length })}</span>
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="btn-danger-ghost"
                          icon={<Trash2 />}
                          aria-label={t('learners.paths.delete', { title: p.title })}
                          onClick={() =>
                            act(async () => check(await supabase.from('paths').delete().eq('id', p.id)))
                          }
                        />
                      </div>
                      {isOpen && (
                        <div className="l13-paths__edit">
                          <label className="fd-field">
                            <span className="fd-label">{t('learners.paths.name')}</span>
                            <input
                              className="fd-input"
                              maxLength={160}
                              defaultValue={p.title}
                              onBlur={(e) =>
                                e.target.value.trim() !== p.title &&
                                act(async () =>
                                  check(
                                    await supabase
                                      .from('paths')
                                      .update({ title: e.target.value.trim() })
                                      .eq('id', p.id),
                                  ),
                                )
                              }
                            />
                          </label>
                          <label className="fd-check">
                            <input
                              type="checkbox"
                              checked={p.ordered}
                              onChange={(e) =>
                                act(async () =>
                                  check(
                                    await supabase
                                      .from('paths')
                                      .update({ ordered: e.target.checked })
                                      .eq('id', p.id),
                                  ),
                                )
                              }
                            />
                            {t('learners.paths.ordered')}
                          </label>
                          <ol className="l13-paths__mods">
                            {list.map((m, i) => (
                              <li key={m.demo_id}>
                                <span className="grow">
                                  {demos.find((d) => d.id === m.demo_id)?.title ?? '—'}
                                </span>
                                <label className="fd-check">
                                  <input
                                    type="checkbox"
                                    checked={m.required}
                                    onChange={(e) =>
                                      act(async () =>
                                        check(
                                          await supabase
                                            .from('path_modules')
                                            .update({ required: e.target.checked })
                                            .eq('path_id', p.id)
                                            .eq('demo_id', m.demo_id),
                                        ),
                                      )
                                    }
                                  />
                                  {t('learners.paths.required')}
                                </label>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<ArrowUp />}
                                  aria-label={t('learners.paths.up')}
                                  disabled={i === 0}
                                  onClick={() =>
                                    act(() =>
                                      reorder(p.id, [
                                        ...list.slice(0, i - 1),
                                        m,
                                        list[i - 1]!,
                                        ...list.slice(i + 1),
                                      ]),
                                    )
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<ArrowDown />}
                                  aria-label={t('learners.paths.down')}
                                  disabled={i === list.length - 1}
                                  onClick={() =>
                                    act(() =>
                                      reorder(p.id, [
                                        ...list.slice(0, i),
                                        list[i + 1]!,
                                        m,
                                        ...list.slice(i + 2),
                                      ]),
                                    )
                                  }
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<X />}
                                  aria-label={t('learners.paths.removeModule')}
                                  onClick={() =>
                                    act(async () =>
                                      check(
                                        await supabase
                                          .from('path_modules')
                                          .delete()
                                          .eq('path_id', p.id)
                                          .eq('demo_id', m.demo_id),
                                      ),
                                    )
                                  }
                                />
                              </li>
                            ))}
                          </ol>
                          <label className="fd-field">
                            <span className="fd-label">{t('learners.paths.addModule')}</span>
                            <select
                              className="fd-select fd-select--sm"
                              value=""
                              onChange={(e) =>
                                e.target.value &&
                                act(async () =>
                                  check(
                                    await supabase.from('path_modules').insert({
                                      path_id: p.id,
                                      demo_id: e.target.value,
                                      workspace_id: wsId,
                                      position: list.length,
                                    }),
                                  ),
                                )
                              }
                            >
                              <option value="">{t('learners.paths.pickDemo')}</option>
                              {demos
                                .filter((d) => !list.some((m) => m.demo_id === d.id))
                                .map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.title}
                                  </option>
                                ))}
                            </select>
                          </label>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <p className="fd-help">{t('learners.paths.structuresHelp')}</p>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newStructure.trim()) return;
                  act(async () => {
                    check(
                      await supabase
                        .from('structures')
                        .insert({ workspace_id: wsId, name: newStructure.trim() }),
                    );
                    setNewStructure('');
                  });
                }}
              >
                <label className="fd-field grow">
                  <span className="sr-only">{t('learners.paths.newStructure')}</span>
                  <input
                    className="fd-input"
                    placeholder={t('learners.paths.newStructure')}
                    maxLength={120}
                    value={newStructure}
                    onChange={(e) => setNewStructure(e.target.value)}
                  />
                </label>
                <Button type="submit" variant="primary" icon={<Plus />} disabled={!newStructure.trim()}>
                  {t('learners.paths.addStructure')}
                </Button>
              </form>
              <ul className="l13-paths">
                {structures.map((s) => (
                  <li key={s.id} className="row">
                    <b className="l13-structure-name">{s.name}</b>
                    <label className="fd-field grow">
                      <span className="sr-only">{t('learners.paths.domains', { name: s.name })}</span>
                      <input
                        className="fd-input fd-input--sm"
                        placeholder={t('learners.paths.domainsPlaceholder')}
                        defaultValue={s.domains.join(', ')}
                        onBlur={(e) => {
                          const domains = [
                            ...new Set(
                              e.target.value
                                .split(/[\s,;]+/)
                                .map((x) => x.trim().toLowerCase().replace(/^@/, ''))
                                .filter(Boolean),
                            ),
                          ].slice(0, 20);
                          if (domains.join(',') !== s.domains.join(','))
                            act(async () =>
                              check(await supabase.from('structures').update({ domains }).eq('id', s.id)),
                            );
                        }}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="btn-danger-ghost"
                      icon={<Trash2 />}
                      aria-label={t('learners.paths.deleteStructure', { name: s.name })}
                      onClick={() =>
                        act(async () => check(await supabase.from('structures').delete().eq('id', s.id)))
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <footer>
          <Button variant="primary" onClick={onClose}>
            {t('learners.paths.done')}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
