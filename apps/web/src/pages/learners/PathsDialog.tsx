import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, ChevronUp, GraduationCap, Plus, Trash2, X } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { cleanDomain } from './progress';

const NNBSP = String.fromCharCode(0x202f);

type Path = Tables<'paths'>;
type Mod = Tables<'path_modules'>;
type Structure = Tables<'structures'>;
type Demo = { id: string; title: string; current_version_id: string | null };
type DemoInfo = { steps: number; quiz: boolean; threshold: number };

/**
 * L13-07 : formations (maître-détail : liste à gauche, modules à droite) et structures (domaines
 * e-mail en pastilles). Chaque modification s'enregistre aussitôt et un toast confirme.
 */
export function PathsDialog({
  wsId,
  counts,
  onClose,
}: {
  wsId: string;
  /** Apprenants par formation et par structure (calculés par la page). */
  counts: { paths: Record<string, number>; structures: Record<string, number> };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const [tab, setTab] = useState<'paths' | 'structures'>('paths');
  const [paths, setPaths] = useState<Path[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [info, setInfo] = useState<Record<string, DemoInfo>>({});
  const [structures, setStructures] = useState<Structure[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newStructure, setNewStructure] = useState('');
  const [pick, setPick] = useState('');
  const { error, run, setError } = useAction();
  const ref = useRef<HTMLDivElement>(null);
  const confirming = useRef(false);

  const load = useCallback(async () => {
    const [p, m, d, s] = await Promise.all([
      supabase.from('paths').select('*').eq('workspace_id', wsId).order('created_at'),
      supabase.from('path_modules').select('*').eq('workspace_id', wsId).order('position'),
      supabase
        .from('demos')
        .select('id, title, current_version_id')
        .eq('workspace_id', wsId)
        .is('deleted_at', null)
        .order('title'),
      supabase.from('structures').select('*').eq('workspace_id', wsId).order('name'),
    ]);
    const list = (d.data ?? []) as Demo[];
    setPaths(p.data ?? []);
    setMods(m.data ?? []);
    setDemos(list);
    setStructures((s.data ?? []).map((x) => ({ ...x, domains: x.domains ?? [] })));
    setCurrent((c) => (c && (p.data ?? []).some((x) => x.id === c) ? c : (p.data?.[0]?.id ?? null)));
    const ids = list.map((x) => x.current_version_id).filter((x): x is string => !!x);
    if (ids.length) {
      const v = await supabase.from('demo_versions').select('id, demo_id, manifest').in('id', ids);
      const out: Record<string, DemoInfo> = {};
      for (const row of v.data ?? []) {
        const mf = (row.manifest ?? {}) as {
          steps?: unknown[];
          quiz?: { mode?: string; threshold?: number } | null;
        };
        out[row.demo_id] = {
          steps: Array.isArray(mf.steps) ? mf.steps.length : 0,
          quiz: !!mf.quiz && mf.quiz.mode !== 'survey',
          threshold: mf.quiz?.threshold ?? 70,
        };
      }
      setInfo(out);
    }
  }, [wsId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !confirming.current && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (back?.isConnected) back.focus();
    };
  }, [onClose]);

  const act = (fn: () => Promise<unknown>, done?: string) =>
    void run(async () => {
      await fn();
      await load();
      if (done) toast(done);
    });
  const confirm = async (o: Parameters<typeof ask>[0]) => {
    confirming.current = true;
    const yes = await ask(o);
    setTimeout(() => (confirming.current = false), 0);
    return yes;
  };
  const modsOf = (id: string) => mods.filter((m) => m.path_id === id).sort((a, b) => a.position - b.position);
  const title = (id: string) => demos.find((d) => d.id === id)?.title ?? '—';
  const path = paths.find((p) => p.id === current) ?? null;
  const list = path ? modsOf(path.id) : [];
  const saved = t('learners.paths.saved');

  async function reorder(pathId: string, next: Mod[]) {
    for (const [i, m] of next.entries())
      check(
        await supabase
          .from('path_modules')
          .update({ position: i })
          .eq('path_id', pathId)
          .eq('demo_id', m.demo_id),
      );
  }
  const moduleMeta = (demoId: string) => {
    const x = info[demoId];
    if (!x) return t('learners.paths.metaDemo');
    return t('learners.paths.meta', {
      steps: t('learners.paths.steps', { count: x.steps }),
      quiz: x.quiz
        ? t('learners.paths.quizThreshold', { pct: `${x.threshold}${NNBSP}%` })
        : t('learners.fo.noQuiz'),
    });
  };
  const pathMeta = (p: Path) => {
    const ms = modsOf(p.id);
    const q = ms.filter((m) => info[m.demo_id]?.quiz).length;
    return t('learners.fo.meta', {
      modules: t('learners.fo.modules', { count: ms.length }),
      quiz: q ? t('learners.fo.quiz', { count: q }) : t('learners.fo.noQuiz'),
      learners: t('learners.count', { count: counts.paths[p.id] ?? 0 }),
    });
  };

  function addDomain(s: Structure, raw: string): boolean {
    const r = cleanDomain(raw);
    if ('error' in r) {
      setError(
        t(r.error === 'public' ? 'learners.paths.domainPublic' : 'learners.paths.domainInvalid', {
          domain: raw.trim(),
        }),
      );
      return false;
    }
    setError(null);
    if (s.domains.includes(r.domain)) return true;
    if (s.domains.length >= 20) {
      setError(t('learners.paths.domainLimit'));
      return false;
    }
    act(
      async () =>
        check(
          await supabase
            .from('structures')
            .update({ domains: [...s.domains, r.domain] })
            .eq('id', s.id),
        ),
      saved,
    );
    return true;
  }

  const removeModule = (m: Mod, name: string) =>
    act(
      async () => {
        check(await supabase.from('path_modules').delete().eq('path_id', m.path_id).eq('demo_id', m.demo_id));
        await reorder(
          m.path_id,
          list.filter((x) => x.demo_id !== m.demo_id),
        );
      },
      t('learners.paths.moduleRemoved', { title: name }),
    );

  return createPortal(
    <div className="mk l13-layer l13-layer--top">
      {dialog}
      <div className="l13-scrim" aria-hidden="true" onClick={onClose} />
      <div
        className="l13-modal l13-modal--gerer"
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
        <div className="gm-tabs">
          <div className="fd-segmented" role="tablist" aria-label={t('learners.paths.title')}>
            {(['paths', 'structures'] as const).map((id) => (
              <button
                key={id}
                role="tab"
                type="button"
                id={`gm-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={tab === id ? `gm-panel-${id}` : undefined}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    const n = id === 'paths' ? 'structures' : 'paths';
                    setTab(n);
                    document.getElementById(`gm-tab-${n}`)?.focus();
                  }
                }}
              >
                {id === 'paths' ? <GraduationCap aria-hidden="true" /> : <Building2 aria-hidden="true" />}
                {t(`learners.paths.tab.${id}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="body">
          {error && <Alert kind="error">{error}</Alert>}
          {tab === 'paths' ? (
            <div className="gm-pane--fo" role="tabpanel" id="gm-panel-paths" aria-labelledby="gm-tab-paths">
              <div className="gm-list" role="group" aria-label={t('learners.paths.list')}>
                {paths.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="gm-item"
                    aria-current={p.id === current ? 'true' : undefined}
                    onClick={() => setCurrent(p.id)}
                  >
                    <b>{p.title || t('learners.untitled')}</b>
                    <small>{pathMeta(p)}</small>
                  </button>
                ))}
                <form
                  className="gm-new"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTitle.trim()) return;
                    void run(async () => {
                      const p = check(
                        await supabase
                          .from('paths')
                          .insert({ workspace_id: wsId, title: newTitle.trim() })
                          .select()
                          .single(),
                      );
                      setNewTitle('');
                      await load();
                      setCurrent(p.id);
                      toast(t('learners.paths.created', { title: p.title }));
                    });
                  }}
                >
                  <input
                    className="fd-input"
                    placeholder={t('learners.paths.newTitle')}
                    aria-label={t('learners.paths.newTitle')}
                    maxLength={160}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                  <Button
                    type="submit"
                    icon={<Plus />}
                    aria-label={t('learners.paths.create')}
                    disabled={!newTitle.trim()}
                  />
                </form>
              </div>
              {path ? (
                <div className="gm-edit" key={path.id}>
                  <div className="fd-field">
                    <label className="fd-label" htmlFor="gm-name">
                      {t('learners.paths.name')}
                    </label>
                    <input
                      id="gm-name"
                      className="fd-input"
                      maxLength={160}
                      defaultValue={path.title}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== path.title)
                          act(
                            async () =>
                              check(await supabase.from('paths').update({ title: v }).eq('id', path.id)),
                            saved,
                          );
                      }}
                    />
                  </div>
                  <div className="fd-field">
                    <label className="fd-label" htmlFor="gm-desc">
                      {t('learners.paths.description')}{' '}
                      <span className="fd-help">{t('learners.paths.optional')}</span>
                    </label>
                    <textarea
                      id="gm-desc"
                      className="fd-input"
                      rows={2}
                      maxLength={600}
                      defaultValue={path.description ?? ''}
                      aria-describedby="gm-desc-h"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (path.description ?? ''))
                          act(
                            async () =>
                              check(
                                await supabase.from('paths').update({ description: v }).eq('id', path.id),
                              ),
                            saved,
                          );
                      }}
                    />
                    <span className="fd-help" id="gm-desc-h">
                      {t('learners.paths.descriptionHelp')}
                    </span>
                  </div>
                  <label className="fd-switch gm-row">
                    <span>
                      {t('learners.paths.ordered')}
                      <span className="fd-help gm-help">{t('learners.paths.orderedHelp')}</span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={path.ordered}
                      onChange={(e) => {
                        const v = e.target.checked;
                        act(
                          async () =>
                            check(await supabase.from('paths').update({ ordered: v }).eq('id', path.id)),
                          saved,
                        );
                      }}
                    />
                    <span className="fd-switch__track" aria-hidden="true" />
                  </label>
                  {list.length === 0 ? (
                    <p className="fd-muted gm-empty">{t('learners.paths.noModule')}</p>
                  ) : (
                    <ol className="gm-mods" aria-label={t('learners.paths.modules')}>
                      {list.map((m, i) => {
                        const name = title(m.demo_id);
                        return (
                          <li key={m.demo_id}>
                            <span className="gm-n" aria-hidden="true">
                              {i + 1}
                            </span>
                            <span>
                              <b>{name}</b>
                              <span className="gm-meta">{moduleMeta(m.demo_id)}</span>
                            </span>
                            <label className="gm-req">
                              <input
                                type="checkbox"
                                checked={m.required}
                                onChange={(e) => {
                                  const v = e.target.checked;
                                  act(
                                    async () =>
                                      check(
                                        await supabase
                                          .from('path_modules')
                                          .update({ required: v })
                                          .eq('path_id', path.id)
                                          .eq('demo_id', m.demo_id),
                                      ),
                                    saved,
                                  );
                                }}
                              />
                              {t('learners.paths.required')}
                            </label>
                            <span className="gm-acts">
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<ChevronUp />}
                                aria-label={t('learners.paths.up', { title: name })}
                                disabled={i === 0}
                                onClick={() =>
                                  act(
                                    () =>
                                      reorder(path.id, [
                                        ...list.slice(0, i - 1),
                                        m,
                                        list[i - 1]!,
                                        ...list.slice(i + 1),
                                      ]),
                                    saved,
                                  )
                                }
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<ChevronDown />}
                                aria-label={t('learners.paths.down', { title: name })}
                                disabled={i === list.length - 1}
                                onClick={() =>
                                  act(
                                    () =>
                                      reorder(path.id, [
                                        ...list.slice(0, i),
                                        list[i + 1]!,
                                        m,
                                        ...list.slice(i + 2),
                                      ]),
                                    saved,
                                  )
                                }
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<X />}
                                aria-label={t('learners.paths.removeModule', { title: name })}
                                onClick={() => removeModule(m, name)}
                              />
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <form
                    className="gm-add"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!pick) return;
                      const demoId = pick;
                      setPick('');
                      act(
                        async () =>
                          check(
                            await supabase.from('path_modules').insert({
                              path_id: path.id,
                              demo_id: demoId,
                              workspace_id: wsId,
                              position: list.length,
                            }),
                          ),
                        t('learners.paths.moduleAdded', { title: title(demoId) }),
                      );
                    }}
                  >
                    <select
                      className="fd-input"
                      aria-label={t('learners.paths.addModule')}
                      value={pick}
                      onChange={(e) => setPick(e.target.value)}
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
                    <Button type="submit" icon={<Plus />} disabled={!pick}>
                      {t('learners.paths.addModule')}
                    </Button>
                  </form>
                  <p className="fd-help gm-help">{t('learners.paths.help')}</p>
                </div>
              ) : (
                <div className="gm-edit">
                  <p className="fd-muted gm-empty">{t('learners.paths.noPath')}</p>
                </div>
              )}
            </div>
          ) : (
            <div
              className="gm-pane--st"
              role="tabpanel"
              id="gm-panel-structures"
              aria-labelledby="gm-tab-structures"
            >
              <p className="fd-help gm-help">{t('learners.paths.structuresHelp')}</p>
              {structures.map((s) => (
                <div className="gm-st" key={s.id}>
                  <span>
                    <b>{s.name}</b>
                    <small>{t('learners.count', { count: counts.structures[s.id] ?? 0 })}</small>
                  </span>
                  <div
                    className="gm-chips"
                    role="group"
                    aria-label={t('learners.paths.domains', { name: s.name })}
                  >
                    {s.domains.map((d) => (
                      <span className="chip" key={d}>
                        @{d}
                        <button
                          type="button"
                          aria-label={t('learners.paths.removeDomain', { domain: d })}
                          onClick={() =>
                            act(
                              async () =>
                                check(
                                  await supabase
                                    .from('structures')
                                    .update({ domains: s.domains.filter((x) => x !== d) })
                                    .eq('id', s.id),
                                ),
                              saved,
                            )
                          }
                        >
                          <X aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder={t('learners.paths.addDomain')}
                      aria-label={t('learners.paths.addDomainTo', { name: s.name })}
                      onKeyDown={(e) => {
                        const el = e.currentTarget;
                        if ((e.key === 'Enter' || e.key === ',') && el.value.trim()) {
                          e.preventDefault();
                          if (addDomain(s, el.value)) el.value = '';
                        }
                      }}
                      onBlur={(e) => {
                        const el = e.currentTarget;
                        if (el.value.trim() && addDomain(s, el.value)) el.value = '';
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="btn-danger-ghost"
                    icon={<Trash2 />}
                    aria-label={t('learners.paths.deleteStructure', { name: s.name })}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: t('learners.paths.confirmStructure', { name: s.name }),
                          body: t('learners.paths.confirmStructureBody'),
                          confirmLabel: t('common.delete'),
                          danger: true,
                        })
                      )
                        act(
                          async () => check(await supabase.from('structures').delete().eq('id', s.id)),
                          t('learners.paths.structureDeleted', { name: s.name }),
                        );
                    }}
                  />
                </div>
              ))}
              <form
                className="gm-st gm-st--new"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newStructure.trim();
                  if (!name) return;
                  act(
                    async () => {
                      check(await supabase.from('structures').insert({ workspace_id: wsId, name }));
                      setNewStructure('');
                    },
                    t('learners.paths.structureAdded', { name }),
                  );
                }}
              >
                <input
                  className="fd-input"
                  placeholder={t('learners.paths.newStructure')}
                  aria-label={t('learners.paths.newStructure')}
                  maxLength={120}
                  value={newStructure}
                  onChange={(e) => setNewStructure(e.target.value)}
                />
                <Button type="submit" icon={<Plus />} disabled={!newStructure.trim()}>
                  {t('learners.paths.addStructure')}
                </Button>
              </form>
              <p className="fd-help gm-help">{t('learners.paths.publicHelp')}</p>
            </div>
          )}
        </div>
        <footer>
          {tab === 'paths' && path ? (
            <Button
              size="sm"
              variant="ghost"
              className="btn-danger-ghost"
              icon={<Trash2 />}
              onClick={async () => {
                if (
                  await confirm({
                    title: t('learners.paths.confirmDelete', { title: path.title || t('learners.untitled') }),
                    body: t('learners.paths.confirmDeleteBody'),
                    confirmLabel: t('common.delete'),
                    danger: true,
                  })
                )
                  act(
                    async () => {
                      check(await supabase.from('paths').delete().eq('id', path.id));
                      setCurrent(null);
                    },
                    t('learners.paths.deleted', { title: path.title }),
                  );
              }}
            >
              {t('learners.paths.deletePath')}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="primary" onClick={onClose}>
            {t('learners.paths.done')}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
