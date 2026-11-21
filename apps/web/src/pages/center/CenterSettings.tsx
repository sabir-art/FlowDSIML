import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  FileText,
  CircleAlert,
  Copy,
  ExternalLink,
  Globe,
  GraduationCap,
  GripVertical,
  LayoutTemplate,
  Palette,
  Plus,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import type { Json } from '@flowdsiml/supabase-types';
import { Alert, Button } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { contrastRatio } from '../../lib/contrast';
import { PLAYER_URL } from '../../lib/env';
import { DemoCenterCard } from './DemoCenterCard';
import { initials } from '../../lib/initials';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';
import { PathsDialog } from '../learners/PathsDialog';
import { buildRows, learnerCounts, type ProgressData } from '../learners/progress';
import {
  CENTER_STYLES,
  centerUrl,
  defaultSlug,
  pendingChanges,
  publishable,
  sanitizeSvg,
  type CenterDraft,
  type CenterStyle,
  type PathSummary,
} from './centerDraft';
import './center.css';
import { NotificationBell } from '../../components/notifications/NotificationBell';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const;
const MAX_LOGO = 512 * 1024;

type Row = {
  slug: string;
  draft: CenterDraft;
  published: CenterDraft | null;
  published_at: string | null;
  access_mode: string;
  password_changed_at: string | null;
};

const ratio = (n: number) => n.toFixed(1).replace('.', ',');

/** L14-08 / L14-09 : réglages du centre de formation (propriétaires et admins). */
export function CenterSettings() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const toast = useToast();
  const { error, run, busy } = useAction();
  const ws = current?.id ?? '';
  const [row, setRow] = useState<Row | null>(null);
  const [slug, setSlug] = useState('');
  const [draft, setDraft] = useState<CenterDraft>({});
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [counts, setCounts] = useState<{ paths: Record<string, number>; structures: Record<string, number> }>(
    {
      paths: {},
      structures: {},
    },
  );
  const [slugState, setSlugState] = useState<'ok' | 'taken' | 'invalid' | 'checking'>('ok');
  const [colorErr, setColorErr] = useState<string | undefined>();
  const [brandInput, setBrandInput] = useState('');
  const [password, setPassword] = useState('');
  const [managing, setManaging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const allowed = can('members.manage');

  const load = useCallback(async () => {
    if (!ws) return;
    const [tc, p, m, d, dt, tg, acc, prog] = await Promise.all([
      supabase.from('training_centers').select('*').eq('workspace_id', ws).maybeSingle(),
      supabase.from('paths').select('*').eq('workspace_id', ws).order('created_at'),
      supabase.from('path_modules').select('*').eq('workspace_id', ws).order('position'),
      supabase.from('demos').select('id, title, status, deleted_at').eq('workspace_id', ws),
      supabase.from('demo_tags').select('*').eq('workspace_id', ws),
      supabase.from('tags').select('*').eq('workspace_id', ws),
      supabase.from('demo_access').select('demo_id, mode, expires_at').eq('workspace_id', ws),
      supabase.rpc('learners_progress', { p_workspace: ws }),
    ]);
    const demos = new Map((d.data ?? []).map((x) => [x.id, x]));
    const tagName = new Map((tg.data ?? []).map((x) => [x.id, x.name]));
    const access = new Map((acc.data ?? []).map((x) => [x.demo_id, x]));
    const list: PathSummary[] = (p.data ?? []).map((x) => {
      const mods = (m.data ?? []).filter((y) => y.path_id === x.id);
      const live = mods.filter((y) => {
        const dm = demos.get(y.demo_id);
        return dm && dm.status === 'published' && !dm.deleted_at;
      });
      return {
        id: x.id,
        title: x.title,
        ordered: x.ordered,
        modules: mods.length,
        published: live.length,
        protectedCount: live.filter((y) => access.get(y.demo_id)?.mode === 'password').length,
        expiredCount: live.filter((y) => {
          const e = access.get(y.demo_id)?.expires_at;
          return !!e && Date.parse(e) <= Date.now();
        }).length,
        tags: [
          ...new Set(
            (dt.data ?? [])
              .filter((y) => live.some((l) => l.demo_id === y.demo_id))
              .map((y) => tagName.get(y.tag_id) ?? '')
              .filter(Boolean),
          ),
        ],
      };
    });
    setPaths(list);
    if (prog.data) setCounts(learnerCounts(buildRows(prog.data as unknown as ProgressData, Date.now())));
    const r = tc.data as unknown as Row | null;
    setRow(r);
    setSlug((s) => s || r?.slug || defaultSlug(current?.slug || current?.name || ''));
    setDraft((prev) => {
      const base: CenterDraft = r?.draft ?? {
        title: current?.name ?? '',
        intro: '',
        style: 'workspace',
        a11y: 'non_evalue',
        indexable: false,
        paths: list.map((x) => ({ id: x.id, visible: true })),
      };
      const known = new Set((base.paths ?? []).map((x) => x.id));
      // Formations créées depuis : ajoutées en fin de liste, masquées
      const merged = {
        ...base,
        paths: [
          ...(base.paths ?? []).filter((x) => list.some((y) => y.id === x.id)),
          ...list.filter((x) => !known.has(x.id)).map((x) => ({ id: x.id, visible: false })),
        ],
      };
      return loaded ? { ...prev, paths: merged.paths } : merged;
    });
    setLoaded(true);
  }, [ws, current?.slug, current?.name, loaded]);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, ws]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => setBrandInput(draft.brand ?? '#A3195B'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded],
  );

  // Vérification de l'adresse en direct
  useEffect(() => {
    if (!loaded || !ws) return;
    if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug)) return setSlugState('invalid');
    setSlugState('checking');
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc('center_slug_available', { p_slug: slug, p_ws: ws });
      setSlugState(data ? 'ok' : 'taken');
    }, 300);
    return () => clearTimeout(id);
  }, [slug, ws, loaded]);

  /** Enregistrement automatique du brouillon (la page publique ne change qu'à la publication). */
  const save = useCallback(
    (next: CenterDraft, nextSlug = slug) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(nextSlug)) return;
        const { error: e } = await supabase.rpc('save_center_draft', {
          p_ws: ws,
          p_slug: nextSlug,
          p_draft: next as unknown as Json,
        });
        if (e) {
          if (/SLUG_TAKEN/.test(e.message)) setSlugState('taken');
          return;
        }
        setRow((r) => (r ? { ...r, slug: nextSlug, draft: next } : r));
        if (!row) await load();
      }, 500);
    },
    [slug, ws, row, load],
  );
  const update = (patch: Partial<CenterDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    save(next);
  };

  const visible = useMemo(
    () =>
      (draft.paths ?? [])
        .map((x) => ({ ...x, info: paths.find((p) => p.id === x.id) }))
        .filter((x) => x.info),
    [draft.paths, paths],
  );
  const canPublish = publishable(draft, paths);
  const pending = row?.published ? pendingChanges(row.draft, row.published) : null;
  const url = centerUrl(PLAYER_URL, row?.slug ?? slug);

  // Couleur principale du centre (la couleur d'accent a été retirée : la clé stockée est ignorée)
  const brandOk = /^#[0-9a-fA-F]{6}$/.test(brandInput);
  const brandRatio = brandOk ? contrastRatio(brandInput, '#FFFFFF') : 0;
  function setBrandColor(value: string) {
    setBrandInput(value);
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return setColorErr(t('center.colorFormat'));
    const r = contrastRatio(value, '#FFFFFF');
    if (r < 4.5) return setColorErr(t('center.brandTooLight', { ratio: ratio(r) }));
    setColorErr(undefined);
    update({ brand: value.toUpperCase() });
  }

  async function uploadLogo(file: File) {
    await run(async () => {
      const ext =
        file.type === 'image/png'
          ? 'png'
          : file.type === 'image/webp'
            ? 'webp'
            : file.type === 'image/svg+xml'
              ? 'svg'
              : null;
      if (!ext) throw new Error(t('center.logoType'));
      if (file.size > MAX_LOGO) throw new Error(t('center.logoSize'));
      let body: Blob = file;
      if (ext === 'svg') {
        const clean = sanitizeSvg(await file.text());
        if (!clean) throw new Error(t('center.logoSvg'));
        body = new Blob([clean], { type: 'image/svg+xml' });
      }
      const path = `${ws}/center-logo-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      check(
        await supabase.storage
          .from('branding')
          .upload(path, body, { contentType: body.type || file.type, upsert: true }),
      );
      const old = draft.logoPath;
      update({ logoPath: path });
      if (old && old !== path) await supabase.storage.from('branding').remove([old]);
      toast(t('center.logoSaved'));
    });
  }

  function move(i: number, d: -1 | 1) {
    const list = [...(draft.paths ?? [])];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    update({ paths: list });
  }
  const dragFrom = useRef<number | null>(null);

  if (!allowed)
    return (
      <div className="mk cfg14-page">
        <h1>{t('center.title')}</h1>
        <Alert kind="warning">{t('center.forbidden')}</Alert>
      </div>
    );

  const logoUrl = draft.logoPath
    ? supabase.storage.from('branding').getPublicUrl(draft.logoPath).data.publicUrl
    : null;
  const brand = colorErr ? (draft.brand ?? '#A3195B') : brandInput;

  return (
    <div className="mk cfg14-page">
      <div className="page-head page-head--refonte">
        <div className="page-head__titles">
          <h1>{t('center.title')}</h1>
          <p className="page-head__sub">
            {row?.published ? (
              <>
                {t('center.statusPublished')} ·{' '}
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {url.replace(/^https?:\/\//, '')}
                </a>
                {pending ? ` · ${t('center.pending', { count: pending })}` : ''}
              </>
            ) : (
              t('center.statusDraft')
            )}
          </p>
        </div>
        <div className="page-head__actions">
          <NotificationBell />
          <a
            className={`fd-btn${row?.published ? '' : ' is-disabled'}`}
            href={row?.published ? url : undefined}
            aria-disabled={!row?.published}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="fd-btn__icon" aria-hidden="true">
              <ExternalLink />
            </span>
            {t('center.open')}
          </a>
          <Button
            variant="primary"
            disabled={!canPublish || busy || slugState !== 'ok' || (!!row?.published && !pending)}
            aria-describedby={!canPublish ? 'cfg-why' : undefined}
            onClick={() =>
              void run(async () => {
                clearTimeout(saveTimer.current);
                check(
                  await supabase.rpc('save_center_draft', {
                    p_ws: ws,
                    p_slug: slug,
                    p_draft: draft as unknown as Json,
                  }),
                );
                check(await supabase.rpc('publish_center', { p_ws: ws }));
                await load();
                toast(t('center.published'));
              })
            }
          >
            {row?.published ? t('center.publishChanges') : t('center.publish')}
          </Button>
        </div>
      </div>
      {error && <Alert kind="error">{error}</Alert>}

      <div className="cfg14">
        <div className="col">
          {!canPublish && loaded && (
            <div className="warn14" id="cfg-why">
              <TriangleAlert aria-hidden="true" />
              <span>{t('center.noVisible')}</span>
            </div>
          )}

          <DemoCenterCard draft={draft} update={update} />

          <section className="fd-card" aria-labelledby="c-url">
            <div className="fd-card__head">
              <span className="fd-icon-chip">
                <Globe {...ICON} />
              </span>
              <h2 className="fd-card__title" id="c-url">
                {t('center.address')}
              </h2>
            </div>
            <div className="fd-field">
              <label className="fd-label" htmlFor="c-slug">
                {t('center.addressLabel')}
              </label>
              <div className="url-row">
                <div className="url-f">
                  <span>{centerUrl(PLAYER_URL, '').replace(/^https?:\/\//, '')}</span>
                  <input
                    id="c-slug"
                    type="text"
                    value={slug}
                    spellCheck={false}
                    aria-describedby="c-slug-h"
                    aria-invalid={slugState === 'taken' || slugState === 'invalid' || undefined}
                    onChange={(e) => {
                      const v = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, '-')
                        .slice(0, 48);
                      setSlug(v);
                      if (/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(v)) save(draft, v);
                    }}
                  />
                </div>
                <Button
                  icon={<Copy />}
                  aria-label={t('center.copy')}
                  onClick={() =>
                    void navigator.clipboard
                      ?.writeText(centerUrl(PLAYER_URL, slug))
                      .then(() => toast(t('center.copied')))
                  }
                />
              </div>
              <span className={slugState === 'ok' ? 'ok-line' : 'err-line'} id="c-slug-h" role="status">
                {slugState === 'ok' ? (
                  <CircleCheck aria-hidden="true" />
                ) : slugState === 'checking' ? null : (
                  <CircleAlert aria-hidden="true" />
                )}
                {t(`center.slug_${slugState}`)}
              </span>
            </div>
            <label className="fd-switch">
              <span>
                {t('center.indexable')}
                <span className="fd-help cfg-help">{t('center.indexableHelp')}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={!!draft.indexable}
                onChange={(e) => update({ indexable: e.target.checked })}
              />
              <span className="fd-switch__track" aria-hidden="true" />
            </label>
          </section>

          <section className="fd-card" aria-labelledby="c-id">
            <div className="fd-card__head">
              <span className="fd-icon-chip">
                <Palette {...ICON} />
              </span>
              <h2 className="fd-card__title" id="c-id">
                {t('center.identity')}
              </h2>
            </div>
            <div className="fd-field">
              <label className="fd-label" htmlFor="c-title">
                {t('center.pageTitle')}
              </label>
              <input
                id="c-title"
                className="fd-input"
                maxLength={120}
                value={draft.title ?? ''}
                onChange={(e) => update({ title: e.target.value })}
              />
            </div>
            <div className="fd-field">
              <label className="fd-label" htmlFor="c-intro">
                {t('center.intro')}
              </label>
              <textarea
                id="c-intro"
                className="fd-input"
                rows={2}
                maxLength={600}
                value={draft.intro ?? ''}
                onChange={(e) => update({ intro: e.target.value })}
              />
            </div>
            <div className="fd-field">
              <span className="fd-label" id="c-logo-l">
                {t('center.logo')}
              </span>
              <div className="logo-f" role="group" aria-labelledby="c-logo-l">
                {logoUrl ? (
                  <img className="ctr-logo" src={logoUrl} alt="" />
                ) : (
                  <span className="ctr-logo" aria-hidden="true" style={{ background: brand }}>
                    {initials(current?.name ?? '')}
                  </span>
                )}
                <span className="tx">
                  <b>{draft.logoPath ? draft.logoPath.split('/').pop() : t('center.logoNone')}</b>
                  {t('center.logoHelp')}
                </span>
                <label className="fd-btn fd-btn--sm">
                  <span className="fd-btn__icon" aria-hidden="true">
                    <Upload />
                  </span>
                  {draft.logoPath ? t('center.logoReplace') : t('center.logoAdd')}
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/png,image/svg+xml,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void uploadLogo(f);
                    }}
                  />
                </label>
                {draft.logoPath && (
                  <Button size="sm" variant="ghost" onClick={() => update({ logoPath: null })}>
                    {t('center.logoRemove')}
                  </Button>
                )}
              </div>
            </div>
            <div className="two">
              <div className="fd-field">
                <label className="fd-label" htmlFor="c-brand">
                  {t('center.brand')}
                </label>
                <div className="col-f">
                  <input
                    type="color"
                    className="sw"
                    aria-label={t('center.brandPicker')}
                    value={brandOk ? brandInput : '#000000'}
                    onChange={(e) => setBrandColor(e.target.value.toUpperCase())}
                  />
                  <input
                    id="c-brand"
                    type="text"
                    value={brandInput}
                    maxLength={7}
                    spellCheck={false}
                    aria-describedby="c-brand-h"
                    aria-invalid={!!colorErr || undefined}
                    onChange={(e) => setBrandColor(e.target.value.trim())}
                  />
                </div>
                {colorErr ? (
                  <span className="err-line" id="c-brand-h" role="alert">
                    <CircleAlert aria-hidden="true" />
                    {colorErr}
                  </span>
                ) : (
                  <span className="ok-line" id="c-brand-h">
                    <CircleCheck aria-hidden="true" />
                    {t('center.brandOk', { ratio: ratio(brandRatio) })}
                  </span>
                )}
              </div>
            </div>
            <p className="fd-help cfg-help">{t('center.colorsHelp')}</p>
          </section>

          <section className="fd-card" aria-labelledby="c-style">
            <div className="fd-card__head">
              <span className="fd-icon-chip">
                <LayoutTemplate {...ICON} />
              </span>
              <h2 className="fd-card__title" id="c-style">
                {t('center.style')}
              </h2>
            </div>
            <div className="presets" role="radiogroup" aria-labelledby="c-style">
              {CENTER_STYLES.map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    name="c-style"
                    checked={(draft.style ?? 'workspace') === s}
                    onChange={() => update({ style: s as CenterStyle })}
                  />
                  <span className={`pv pv--${s}`} aria-hidden="true">
                    <i />
                    <b />
                    <u />
                  </span>
                  {t(`center.style_${s}`)}
                </label>
              ))}
            </div>
            <p className="fd-help cfg-help">{t('center.styleHelp')}</p>
          </section>

          {draft.kind !== 'demo' && (
            <section className="fd-card" aria-labelledby="c-vis">
              <div className="fd-card__head">
                <span className="fd-icon-chip">
                  <GraduationCap {...ICON} />
                </span>
                <h2 className="fd-card__title" id="c-vis">
                  {t('center.visible')}
                </h2>
                {visible.length > 0 && (
                  <Button size="sm" icon={<Settings2 />} onClick={() => setManaging(true)}>
                    {t('learners.paths.manage')}
                  </Button>
                )}
              </div>
              {visible.length === 0 ? (
                <div className="cfg-empty">
                  <span className="fd-icon-chip">
                    <GraduationCap {...ICON} />
                  </span>
                  <b>{t('center.visibleEmpty')}</b>
                  <p>{t('center.visibleEmptyHelp')}</p>
                  <Button variant="primary" icon={<Plus />} onClick={() => setManaging(true)}>
                    {t('learners.paths.create')}
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="vis" aria-label={t('center.visibleOrder')}>
                    {visible.map((x, i) => {
                      const p = x.info!;
                      const parts = [
                        t('learners.fo.modules', { count: p.published }),
                        p.ordered ? t('center.ordered') : null,
                        p.protectedCount ? t('center.protected', { count: p.protectedCount }) : null,
                        p.expiredCount ? t('center.expired', { count: p.expiredCount }) : null,
                        p.published === 0 ? t('center.noPublished') : null,
                        !x.visible ? t('center.hidden') : null,
                        p.tags.length ? p.tags.join(', ') : null,
                      ].filter(Boolean);
                      return (
                        <li
                          key={x.id}
                          className={x.visible ? undefined : 'off'}
                          draggable
                          onDragStart={() => (dragFrom.current = i)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            const from = dragFrom.current;
                            dragFrom.current = null;
                            if (from === null || from === i) return;
                            const list = [...(draft.paths ?? [])];
                            const [it] = list.splice(from, 1);
                            list.splice(i, 0, it!);
                            update({ paths: list });
                          }}
                        >
                          <span className="grip" title={t('center.dragHint')} aria-hidden="true">
                            <GripVertical />
                          </span>
                          <input
                            type="checkbox"
                            checked={x.visible}
                            aria-label={t('center.show', { title: p.title })}
                            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                            onChange={(e) =>
                              update({
                                paths: (draft.paths ?? []).map((y) =>
                                  y.id === x.id ? { ...y, visible: e.target.checked } : y,
                                ),
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                                e.preventDefault();
                                move(i, e.key === 'ArrowUp' ? -1 : 1);
                                const el = e.currentTarget;
                                requestAnimationFrame(() => el.focus());
                              }
                            }}
                          />
                          <span>
                            <b>{p.title || t('learners.untitled')}</b>
                            <small>{parts.join(' · ')}</small>
                          </span>
                          <span className="fd-help">
                            {t('learners.count', { count: counts.paths[p.id] ?? 0 })}
                          </span>
                          {/* L34 (WCAG 2.5.7) : réordonner sans glisser, d'un clic */}
                          <span className="vis-move">
                            <button
                              type="button"
                              className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                              aria-label={t('center.moveUp', { title: p.title || t('learners.untitled') })}
                              disabled={i === 0}
                              onClick={() => move(i, -1)}
                            >
                              <ArrowUp aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                              aria-label={t('center.moveDown', { title: p.title || t('learners.untitled') })}
                              disabled={i === (draft.paths ?? []).length - 1}
                              onClick={() => move(i, 1)}
                            >
                              <ArrowDown aria-hidden="true" />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="fd-help cfg-help">{t('center.visibleHelp')}</p>
                </>
              )}
            </section>
          )}

          <section className="fd-card" aria-labelledby="c-foot">
            <div className="fd-card__head">
              <span className="fd-icon-chip">
                <FileText {...ICON} />
              </span>
              <h2 className="fd-card__title" id="c-foot">
                {t('center.footer')}
              </h2>
            </div>
            <div className="two">
              <div className="fd-field">
                <label className="fd-label" htmlFor="c-a11y">
                  {t('center.a11y')}
                </label>
                <select
                  id="c-a11y"
                  className="fd-input"
                  aria-describedby="c-a11y-h"
                  value={draft.a11y ?? 'non_evalue'}
                  onChange={(e) => update({ a11y: e.target.value as CenterDraft['a11y'] })}
                >
                  {(['non_evalue', 'partiel', 'total'] as const).map((a) => (
                    <option key={a} value={a}>
                      {t(`center.a11y_${a}`)}
                    </option>
                  ))}
                </select>
                <span className="fd-help" id="c-a11y-h">
                  {t('center.a11yHelp')}
                </span>
              </div>
              <UrlField
                id="c-a11y-url"
                label={t('center.a11yUrl')}
                optional={t('center.optional')}
                placeholder="https://"
                value={draft.a11yUrl ?? ''}
                onSave={(v) => update({ a11yUrl: v })}
                invalid={t('center.urlInvalid')}
              />
            </div>
            <div className="two">
              <div className="fd-field">
                <label className="fd-label" htmlFor="c-help">
                  {t('center.help')}
                </label>
                <input
                  id="c-help"
                  className="fd-input"
                  maxLength={200}
                  placeholder={t('center.helpPlaceholder')}
                  defaultValue={draft.help ?? ''}
                  key={`help-${loaded}`}
                  aria-describedby="c-help-h"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v === '' || /^https:\/\/\S+$/.test(v) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v))
                      update({ help: v });
                    else toast(t('center.helpInvalid'));
                  }}
                />
                <span className="fd-help" id="c-help-h">
                  {t('center.helpHint')}
                </span>
              </div>
              <UrlField
                id="c-privacy"
                label={t('center.privacyUrl')}
                optional={t('center.optional')}
                placeholder="https://"
                value={draft.privacyUrl ?? ''}
                onSave={(v) => update({ privacyUrl: v })}
                invalid={t('center.urlInvalid')}
              />
            </div>
          </section>

          <section className="fd-card" aria-labelledby="c-acc">
            <div className="fd-card__head">
              <span className="fd-icon-chip">
                <ShieldCheck {...ICON} />
              </span>
              <h2 className="fd-card__title" id="c-acc">
                {t('center.access')}
              </h2>
            </div>
            <div className="acc" role="radiogroup" aria-labelledby="c-acc">
              <label>
                <input
                  type="radio"
                  name="c-acc"
                  checked={(row?.access_mode ?? 'link') === 'link'}
                  disabled={!row}
                  onChange={() =>
                    void run(async () => {
                      check(await supabase.rpc('set_center_access', { p_ws: ws, p_mode: 'link' }));
                      await load();
                      toast(t('center.accessSaved'));
                    })
                  }
                />
                <span>
                  <b>{t('center.accessLink')}</b>
                  <small>{t('center.accessLinkHint')}</small>
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="c-acc"
                  checked={row?.access_mode === 'password'}
                  disabled={!row || !row.password_changed_at}
                  onChange={() =>
                    void run(async () => {
                      check(await supabase.rpc('set_center_access', { p_ws: ws, p_mode: 'password' }));
                      await load();
                      toast(t('center.accessSaved'));
                    })
                  }
                />
                <span>
                  <b>{t('center.accessPassword')}</b>
                  <small>
                    {row?.password_changed_at
                      ? t('center.accessPasswordSet')
                      : t('center.accessPasswordHint')}
                  </small>
                </span>
              </label>
              {(['domain', 'invite'] as const).map((k) => (
                <label key={k} aria-disabled="true">
                  <input type="radio" name="c-acc" disabled />
                  <span>
                    <b>{t(`center.access_${k}`)}</b>
                    <span className="soon">{t('center.soon')}</span>
                    <small>{t('center.needsMail')}</small>
                  </span>
                </label>
              ))}
            </div>
            <form
              className="pw-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (password.length < 8) return;
                void run(async () => {
                  clearTimeout(saveTimer.current);
                  check(
                    await supabase.rpc('save_center_draft', {
                      p_ws: ws,
                      p_slug: slug,
                      p_draft: draft as unknown as Json,
                    }),
                  );
                  check(await supabase.rpc('set_center_password', { p_ws: ws, p_password: password }));
                  setPassword('');
                  await load();
                  toast(t('center.passwordSaved'));
                });
              }}
            >
              <label className="fd-field">
                <span className="fd-label">
                  {row?.password_changed_at ? t('center.passwordNew') : t('center.passwordLabel')}
                </span>
                <input
                  className="fd-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={200}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Button type="submit" disabled={password.length < 8 || slugState !== 'ok'}>
                {t('center.passwordSave')}
              </Button>
            </form>
            <p className="fd-help cfg-help">{t('center.accessHelp')}</p>
          </section>
        </div>

        <aside className="pvw" aria-hidden="true">
          <div className="cap">
            <span>{t('center.preview')}</span>
            <span>{t('center.previewLive')}</span>
          </div>
          <div className={`frame frame--${draft.style ?? 'workspace'}`}>
            <div className="m-top">
              {logoUrl ? (
                <img className="ctr-logo" src={logoUrl} alt="" />
              ) : (
                <span
                  className="ctr-logo"
                  style={{
                    background: draft.style === 'sober' || draft.style === 'contrast' ? '#12161B' : brand,
                  }}
                >
                  {initials(current?.name ?? '')}
                </span>
              )}
              <b>{current?.name}</b>
            </div>
            <div className="m-in">
              <div className="m-h">{draft.title || current?.name}</div>
              {draft.intro && <div className="m-p">{draft.intro}</div>}
              {canPublish ? (
                <>
                  <div className="m-s" />
                  <div className="m-g">
                    {visible
                      .filter((x) => x.visible && x.info!.published > 0)
                      .slice(0, 4)
                      .map((x) => (
                        <div className="m-c" key={x.id}>
                          <div className="cv" />
                          <div className="tt">{x.info!.title}</div>
                          <div className="ln" />
                          <div className="ln" />
                          <div
                            className="bt"
                            style={{
                              background:
                                draft.style === 'sober' || draft.style === 'contrast' ? '#12161B' : brand,
                            }}
                          />
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <div className="m-empty">{t('center.emptyPreview')}</div>
              )}
            </div>
          </div>
        </aside>
      </div>
      {managing && (
        <PathsDialog
          wsId={ws}
          counts={counts}
          onClose={() => {
            setManaging(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/** Lien https facultatif, enregistré en quittant le champ (vide accepté). */
function UrlField(props: {
  id: string;
  label: string;
  optional: string;
  placeholder: string;
  value: string;
  invalid: string;
  onSave: (v: string) => void;
}) {
  const [err, setErr] = useState(false);
  return (
    <div className="fd-field">
      <label className="fd-label" htmlFor={props.id}>
        {props.label} <span className="fd-help">{props.optional}</span>
      </label>
      <input
        id={props.id}
        className="fd-input"
        type="url"
        maxLength={300}
        placeholder={props.placeholder}
        defaultValue={props.value}
        aria-invalid={err || undefined}
        aria-describedby={err ? `${props.id}-e` : undefined}
        onBlur={(e) => {
          const v = e.target.value.trim();
          const ok = v === '' || /^https:\/\/\S+$/.test(v);
          setErr(!ok);
          if (ok && v !== props.value) props.onSave(v);
        }}
      />
      {err && (
        <span className="err-line" id={`${props.id}-e`} role="alert">
          {props.invalid}
        </span>
      )}
    </div>
  );
}
