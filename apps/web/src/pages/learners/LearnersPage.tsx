import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  Award,
  BellRing,
  ChevronDown,
  CircleHelp,
  Clock,
  Download,
  Eye,
  GraduationCap,
  Layers,
  Link2Off,
  Mail,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toCsv } from '@flowdsiml/core';
import { Alert, Button } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { downloadText } from '../../lib/download';
import { formatDate, formatDateTime, formatRelativeShort } from '../../lib/format';
import { check, useAction } from '../../lib/useAction';
import { initials } from '../../lib/initials';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';
import { Menu, type MenuItem } from '../../components/Menu';
import { ScrollX } from '../../components/ScrollX';
import { PathsDialog } from './PathsDialog';
import {
  applyFilters,
  buildRows,
  canRemind,
  csvTable,
  kpis,
  pathStats,
  sortRows,
  splitPercents,
  type ExportColumn,
  type Filters,
  type LearnerRow,
  type LearnerStatus,
  type ProgressData,
  type SortKey,
} from './progress';
import './learners.css';

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const;
const PAGE = 50;
const NNBSP = String.fromCharCode(0x202f);
const pct = (r: number) => `${Math.round(r * 100)}${NNBSP}%`;

const STATUS_ICON: Record<LearnerStatus, ReactNode> = {
  done: <Award {...ICON} />,
  active: <Clock {...ICON} />,
  stale: <BellRing {...ICON} />,
};
const STATUS_CLASS: Record<LearnerStatus, string> = { done: 'done', active: 'prog', stale: 'relance' };

export function StatusBadge({ status, children }: { status: LearnerStatus; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <span className={`st-badge ${STATUS_CLASS[status]}`}>
      {STATUS_ICON[status]}
      {children ?? t(`learners.status.${status}`)}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const { t } = useTranslation();
  return (
    <span className="lp">
      <span
        className="fd-bar fd-bar--h"
        role="img"
        aria-label={t('learners.progressAria', { pct: pct(value) })}
      >
        <span className="fd-bar__fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span>{pct(value)}</span>
    </span>
  );
}

type Overlay =
  | { kind: 'fiche'; id: string }
  | { kind: 'export'; preset?: { path?: string; learner?: string } }
  | { kind: 'erase'; id: string }
  | { kind: 'paths' }
  | null;

/** L13 : suivi des apprenants (liste, fiche, vue par formation, export CSV, suppression RGPD). */
export function LearnersPage() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { error, run } = useAction();
  const now = useMemo(() => Date.now(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const allowed = can('leads.view');

  const load = useCallback(async () => {
    if (!current) return;
    const { data: d, error: e } = await supabase.rpc('learners_progress', { p_workspace: current.id });
    if (e) return setLoadError(t('learners.loadError'));
    setLoadError(null);
    setData(d as unknown as ProgressData);
  }, [current, t]);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const tab = params.get('tab') === 'formation' ? 'formation' : 'liste';
  const filters: Filters = {
    path: params.get('formation') ?? '',
    status: (['done', 'active', 'stale'].includes(params.get('statut') ?? '') ? params.get('statut') : '') as
      LearnerStatus | '',
    structure: params.get('structure') ?? '',
    q: params.get('q') ?? '',
    module: params.get('module') ?? '',
  };
  const setParam = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        for (const [k, v] of Object.entries(patch)) {
          if (v) n.set(k, v);
          else n.delete(k);
        }
        n.delete('page');
        return n;
      },
      { replace: true },
    );

  const rows = useMemo(() => (data ? buildRows(data, now) : []), [data, now]);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, JSON.stringify(filters)]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remind(ids: string[]) {
    const list = rows.filter((r) => ids.includes(r.raw.id) && canRemind(r.raw, now));
    if (!list.length) return toast(t('learners.remind.none'));
    await run(async () => {
      const kept =
        check(await supabase.rpc('record_reminders', { p_learners: list.map((r) => r.raw.id) })) ?? [];
      const emails = list.filter((r) => kept.includes(r.raw.id)).map((r) => r.raw.email!);
      if (emails.length) {
        const subject = encodeURIComponent(t('learners.remind.subject'));
        const body = encodeURIComponent(t('learners.remind.body'));
        window.location.href = `mailto:?bcc=${emails.map(encodeURIComponent).join(',')}&subject=${subject}&body=${body}`;
      }
      const skipped = ids.length - emails.length;
      toast(
        skipped > 0
          ? t('learners.remind.doneSkipped', { count: emails.length, skipped })
          : t('learners.remind.done', { count: emails.length }),
      );
      await load();
    });
  }

  async function grant(r: LearnerRow) {
    const m =
      r.raw.modules.find((x) => x.hasQuiz && x.status === 'failed') ??
      r.raw.modules.find((x) => x.hasQuiz && x.status !== 'not_started' && x.status !== 'validated');
    if (!m) return toast(t('learners.grant.none'));
    await run(async () => {
      check(await supabase.rpc('grant_quiz_attempt', { p_learner: r.raw.id, p_demo: m.demoId }));
      toast(t('learners.grant.done', { name: r.label }));
      await load();
    });
  }

  async function revoke(r: LearnerRow) {
    if (!r.raw.id) return;
    await run(async () => {
      const { data: l } = await supabase
        .from('learners')
        .select('share_link_id')
        .eq('id', r.raw.id)
        .maybeSingle();
      if (!l?.share_link_id) return;
      check(await supabase.from('share_links').update({ is_active: false }).eq('id', l.share_link_id));
      toast(t('learners.revoke.done', { name: r.label }));
    });
  }

  const actionItems = (r: LearnerRow): MenuItem[] => [
    {
      label: t('learners.actions.view'),
      icon: <Eye />,
      onSelect: () => setOverlay({ kind: 'fiche', id: r.raw.id }),
    },
    {
      label: t('learners.actions.remind'),
      icon: <BellRing />,
      disabled: !canRemind(r.raw, now),
      onSelect: () => void remind([r.raw.id]),
    },
    {
      label: t('learners.actions.grant'),
      icon: <RefreshCw />,
      disabled: !r.raw.modules.some(
        (m) => m.hasQuiz && m.status !== 'not_started' && m.status !== 'validated',
      ),
      onSelect: () => void grant(r),
    },
    {
      label: t('learners.actions.revoke'),
      icon: <Link2Off />,
      disabled: r.raw.source !== 'link',
      onSelect: () => void revoke(r),
    },
  ];

  if (!allowed)
    return (
      <div className="mk l13" id="main-learners">
        <Head data={null} />
        <Alert kind="warning">{t('learners.forbidden')}</Alert>
      </div>
    );

  const fiche =
    overlay?.kind === 'fiche' || overlay?.kind === 'erase' ? rows.find((r) => r.raw.id === overlay.id) : null;

  return (
    <div className="mk l13">
      <Head
        data={data}
        onExport={() => setOverlay({ kind: 'export' })}
        onPaths={() => setOverlay({ kind: 'paths' })}
      />
      {(loadError || error) && <Alert kind="error">{loadError ?? error}</Alert>}
      <div className="fd-tabs l13-tabs" role="tablist" aria-label={t('learners.tabs.label')}>
        {(['liste', 'formation'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`l13-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`l13-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setParam({ tab: id === 'liste' ? null : id })}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const n = id === 'liste' ? 'formation' : 'liste';
                setParam({ tab: n === 'liste' ? null : n });
                document.getElementById(`l13-tab-${n}`)?.focus();
              }
            }}
          >
            {t(`learners.tabs.${id}`)}
          </button>
        ))}
      </div>

      {!data ? (
        !loadError && <p className="fd-muted">{t('common.loading')}</p>
      ) : data.paths.length === 0 ? (
        <div className="fd-card empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            <GraduationCap size={24} />
          </span>
          <p className="empty-state__title">{t('learners.empty.noPath')}</p>
          <p className="fd-muted">{t('learners.empty.noPathHint')}</p>
          <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setOverlay({ kind: 'paths' })}>
            {t('learners.paths.create')}
          </Button>
        </div>
      ) : tab === 'liste' ? (
        <ListView
          data={data}
          rows={rows}
          filtered={filtered}
          filters={filters}
          setParam={setParam}
          page={Number(params.get('page') ?? '1') || 1}
          setPage={(p) => setParams((x) => (x.set('page', String(p)), x), { replace: true })}
          sort={(params.get('tri') as SortKey) || 'last'}
          asc={params.get('ordre') !== 'desc'}
          setSort={(k, asc) => setParam({ tri: k === 'last' ? null : k, ordre: asc ? null : 'desc' })}
          selected={selected}
          setSelected={setSelected}
          onOpen={(id) => setOverlay({ kind: 'fiche', id })}
          onRemind={(ids) => void remind(ids)}
          onExport={() => setOverlay({ kind: 'export' })}
          actions={actionItems}
        />
      ) : (
        <FormationView
          data={data}
          rows={rows}
          selectedPath={filters.path || data.paths[0]!.id}
          onPick={(id) => setParam({ formation: id })}
          onList={(patch) => setParam({ tab: null, ...patch })}
          onExport={(path) => setOverlay({ kind: 'export', preset: { path } })}
        />
      )}

      {fiche && (
        <LearnerDrawer
          row={fiche}
          data={data!}
          now={now}
          canErase={can('members.manage')}
          inert={overlay?.kind === 'erase'}
          onClose={() => setOverlay(null)}
          onRemind={() => void remind([fiche.raw.id])}
          onGrant={() => void grant(fiche)}
          onExport={() => setOverlay({ kind: 'export', preset: { learner: fiche.raw.id } })}
          onErase={() => setOverlay({ kind: 'erase', id: fiche.raw.id })}
          onChanged={load}
        />
      )}
      {overlay?.kind === 'erase' && fiche && (
        <EraseDialog
          row={fiche}
          onCancel={() => setOverlay({ kind: 'fiche', id: fiche.raw.id })}
          onErased={async () => {
            setOverlay(null);
            toast(t('learners.erase.done'));
            setSelected(new Set());
            await load();
          }}
        />
      )}
      {overlay?.kind === 'export' && data && current && (
        <ExportDialog
          data={data}
          wsId={current.id}
          rows={rows}
          filtered={filtered}
          filterLabel={filterSummary(t, data, filters)}
          selected={rows.filter((r) => selected.has(r.raw.id))}
          preset={overlay.preset}
          onClose={() => setOverlay(null)}
          onDone={(n) => {
            setOverlay(null);
            toast(t('learners.export.done', { count: n }));
          }}
        />
      )}
      {overlay?.kind === 'paths' && current && (
        <PathsDialog
          wsId={current.id}
          onClose={() => {
            setOverlay(null);
            void load();
          }}
        />
      )}
    </div>
  );

  function Head({
    data: d,
    onExport,
    onPaths,
  }: {
    data: ProgressData | null;
    onExport?: () => void;
    onPaths?: () => void;
  }) {
    const nav = useNavigate();
    const firstModules = (d?.paths ?? []).filter((p) => p.modules.length);
    return (
      <div className="page-head page-head--refonte">
        <div className="page-head__titles">
          <h1>{t('learners.title')}</h1>
          {d && (
            <p className="page-head__sub">
              {t('learners.sub', {
                learners: t('learners.count', { count: d.learners.length }),
                paths: t('learners.pathCount', { count: d.paths.length }),
              })}
            </p>
          )}
        </div>
        {d && (
          <div className="page-head__actions">
            {can('demo.edit') && (
              <Button icon={<Settings2 />} onClick={onPaths}>
                {t('learners.paths.manage')}
              </Button>
            )}
            <Button icon={<Download />} onClick={onExport} disabled={!d.learners.length}>
              {t('learners.exportCsv')}
            </Button>
            {firstModules.length > 0 && (
              <Menu
                label={t('learners.invite')}
                custom={{
                  className: 'fd-btn fd-btn--primary',
                  content: (
                    <>
                      <span className="fd-btn__icon" aria-hidden="true">
                        <Mail />
                      </span>
                      {t('learners.invite')}
                    </>
                  ),
                }}
                items={firstModules.map((p) => ({
                  label: p.title || t('learners.untitled'),
                  icon: <GraduationCap />,
                  onSelect: () => nav(`/demos/${p.modules[0]!.demoId}/share?tab=perso`),
                }))}
              />
            )}
          </div>
        )}
      </div>
    );
  }
}

type TFn = ReturnType<typeof useTranslation>['t'];

function filterSummary(t: TFn, d: ProgressData, f: Filters): string {
  const parts: string[] = [];
  if (f.path) parts.push(d.paths.find((p) => p.id === f.path)?.title ?? '');
  if (f.status) parts.push(t(`learners.status.${f.status}`));
  if (f.structure)
    parts.push(
      f.structure === 'none'
        ? t('learners.noStructure')
        : (d.structures.find((s) => s.id === f.structure)?.name ?? ''),
    );
  if (f.module) parts.push(d.paths.flatMap((p) => p.modules).find((m) => m.demoId === f.module)?.title ?? '');
  if (f.q.trim()) parts.push(`« ${f.q.trim()} »`);
  return parts.filter(Boolean).join(', ');
}

// ---------------------------------------------------------------------------
// L13-01 : liste
// ---------------------------------------------------------------------------
function FilterChip({
  label,
  value,
  active,
  items,
  onClear,
}: {
  label: string;
  value: string;
  active: boolean;
  items: MenuItem[];
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <span className="fchip">
      {label}
      {NNBSP}: <b>{value}</b>
      {active ? (
        <button type="button" aria-label={t('learners.filters.clear', { label })} onClick={onClear}>
          <X {...ICON} />
        </button>
      ) : (
        <Menu
          label={t('learners.filters.change', { label })}
          align="start"
          custom={{
            className: 'fchip__btn',
            content: (
              <>
                <ChevronDown {...ICON} />
                <span className="sr-only">{t('learners.filters.change', { label })}</span>
              </>
            ),
          }}
          items={items}
        />
      )}
    </span>
  );
}

function ListView(props: {
  data: ProgressData;
  rows: LearnerRow[];
  filtered: LearnerRow[];
  filters: Filters;
  setParam: (p: Record<string, string | null>) => void;
  page: number;
  setPage: (p: number) => void;
  sort: SortKey;
  asc: boolean;
  setSort: (k: SortKey, asc: boolean) => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onOpen: (id: string) => void;
  onRemind: (ids: string[]) => void;
  onExport: () => void;
  actions: (r: LearnerRow) => MenuItem[];
}) {
  const { t } = useTranslation();
  const { data, rows, filtered, filters: f, setParam, selected, setSelected } = props;
  const [q, setQ] = useState(f.q);
  useEffect(() => {
    const id = setTimeout(() => q !== f.q && setParam({ q: q.trim() ? q : null }), 250);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = kpis(rows, data.paths);
  const sorted = sortRows(filtered, props.sort, props.asc);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const page = Math.min(props.page, pages);
  const shown = sorted.slice((page - 1) * PAGE, page * PAGE);
  const stale = filtered.filter(
    (r) => r.status === 'stale' || (f.path && r.paths.find((s) => s.path.id === f.path)?.status === 'stale'),
  );
  const pathTitle = (id: string) => data.paths.find((p) => p.id === id)?.title || t('learners.untitled');
  const moduleTitle = data.paths.flatMap((p) => p.modules).find((m) => m.demoId === f.module)?.title;
  const allShown = shown.length > 0 && shown.every((r) => selected.has(r.raw.id));
  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };
  const th = (key: SortKey, label: string) => {
    const on = props.sort === key;
    return (
      <th scope="col" aria-sort={on ? (props.asc ? 'ascending' : 'descending') : undefined}>
        <button
          type="button"
          onClick={() => props.setSort(key, on ? !props.asc : key !== 'progress' && key !== 'score')}
        >
          {label}
          {on && (props.asc ? <ArrowUp {...ICON} /> : <ArrowDown {...ICON} />)}
        </button>
      </th>
    );
  };

  return (
    <section className="l13-pane" id="l13-panel-liste" role="tabpanel" aria-labelledby="l13-tab-liste">
      <div className="filterbar" aria-label={t('learners.filters.label')} role="group">
        <FilterChip
          label={t('learners.filters.path')}
          value={f.path ? pathTitle(f.path) : t('learners.filters.all')}
          active={!!f.path}
          onClear={() => setParam({ formation: null, module: null })}
          items={data.paths.map((p) => ({
            label: p.title || t('learners.untitled'),
            onSelect: () => setParam({ formation: p.id }),
          }))}
        />
        {f.module && (
          <FilterChip
            label={t('learners.filters.module')}
            value={t('learners.filters.moduleValue', { title: moduleTitle ?? '' })}
            active
            onClear={() => setParam({ module: null })}
            items={[]}
          />
        )}
        <FilterChip
          label={t('learners.filters.status')}
          value={f.status ? t(`learners.status.${f.status}`) : t('learners.filters.all')}
          active={!!f.status}
          onClear={() => setParam({ statut: null })}
          items={(['done', 'active', 'stale'] as const).map((s) => ({
            label: t(`learners.status.${s}`),
            icon: STATUS_ICON[s],
            onSelect: () => setParam({ statut: s }),
          }))}
        />
        <FilterChip
          label={t('learners.filters.structure')}
          value={
            !f.structure
              ? t('learners.filters.allF')
              : f.structure === 'none'
                ? t('learners.noStructure')
                : (data.structures.find((s) => s.id === f.structure)?.name ?? '')
          }
          active={!!f.structure}
          onClear={() => setParam({ structure: null })}
          items={[
            ...data.structures.map((s) => ({ label: s.name, onSelect: () => setParam({ structure: s.id }) })),
            { label: t('learners.noStructure'), onSelect: () => setParam({ structure: 'none' }) },
          ]}
        />
        <label className="fd-field l13-search">
          <span className="sr-only">{t('learners.searchLabel')}</span>
          <input
            className="fd-input"
            type="search"
            placeholder={t('learners.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      <div className="kpis">
        <article className="fd-card fd-card--hero fd-kpi">
          <div className="fd-card__head">
            <span className="fd-icon-chip">
              <Award {...ICON} />
            </span>
            <span className="fd-kpi__label">{t('learners.status.done')}</span>
          </div>
          <span className="fd-kpi__value">{k.done}</span>
          <span className="fd-kpi__foot">
            {t('learners.kpi.doneFoot', { pct: k.total ? pct(k.done / k.total) : pct(0) })}
          </span>
        </article>
        <article className="fd-card fd-kpi">
          <div className="fd-card__head">
            <span className="fd-icon-chip">
              <Clock {...ICON} />
            </span>
            <span className="fd-kpi__label">{t('learners.status.active')}</span>
          </div>
          <span className="fd-kpi__value">{k.active}</span>
          <span className="fd-kpi__foot">{t('learners.kpi.activeFoot')}</span>
        </article>
        <article className="fd-card fd-kpi">
          <div className="fd-card__head">
            <span className="fd-icon-chip">
              <BellRing {...ICON} />
            </span>
            <span className="fd-kpi__label">{t('learners.status.stale')}</span>
          </div>
          <span className="fd-kpi__value">{k.stale}</span>
          <span className="fd-kpi__foot">{t('learners.kpi.staleFoot')}</span>
        </article>
        <article className="fd-card fd-kpi">
          <div className="fd-card__head">
            <span className="fd-icon-chip">
              <CircleHelp {...ICON} />
            </span>
            <span className="fd-kpi__label">{t('learners.kpi.score')}</span>
          </div>
          <span className="fd-kpi__value">{k.avgScore === null ? '—' : `${k.avgScore}${NNBSP}%`}</span>
          <span className="fd-kpi__foot">
            {k.avgScore === null
              ? t('learners.kpi.scoreNone')
              : k.threshold !== null
                ? t('learners.kpi.scoreFoot', { pct: `${k.threshold}${NNBSP}%` })
                : t('learners.kpi.scoreFootMixed')}
          </span>
        </article>
      </div>

      <article className="fd-card">
        <div className="fd-card__head">
          <span className="fd-icon-chip">
            <GraduationCap {...ICON} />
          </span>
          <h2 className="fd-card__title">
            {f.status === 'stale'
              ? t('learners.toRemind', { count: filtered.length })
              : t('learners.count', { count: filtered.length })}
          </h2>
          {f.status === 'stale' && stale.length > 0 && (
            <Button size="sm" icon={<BellRing />} onClick={() => props.onRemind(stale.map((r) => r.raw.id))}>
              {t('learners.remindAll', { count: stale.length })}
            </Button>
          )}
        </div>
        {selected.size > 0 && (
          <div className="l13-sel" role="status">
            <span className="grow">{t('learners.selected', { count: selected.size })}</span>
            <Button size="sm" icon={<BellRing />} onClick={() => props.onRemind([...selected])}>
              {t('learners.actions.remindShort')}
            </Button>
            <Button size="sm" icon={<Download />} onClick={props.onExport}>
              {t('learners.actions.export')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t('learners.actions.unselect')}
            </Button>
          </div>
        )}
        {rows.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__icon" aria-hidden="true">
              <Users size={24} />
            </span>
            <p className="empty-state__title">{t('learners.empty.none')}</p>
            <p className="fd-muted">{t('learners.empty.noneHint')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="fd-muted">{t('learners.empty.noMatch')}</p>
        ) : (
          <ScrollX label={t('learners.title')}>
            <table className="fd-table l13-table">
              <caption className="sr-only">{t('learners.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      aria-label={t('learners.selectAll')}
                      checked={allShown}
                      onChange={() => {
                        const n = new Set(selected);
                        for (const r of shown) {
                          if (allShown) n.delete(r.raw.id);
                          else n.add(r.raw.id);
                        }
                        setSelected(n);
                      }}
                    />
                  </th>
                  {th('name', t('learners.col.learner'))}
                  <th scope="col">{t('learners.col.paths')}</th>
                  {th('progress', t('learners.col.progress'))}
                  {th('score', t('learners.col.score'))}
                  {th('last', t('learners.col.last'))}
                  <th scope="col">{t('learners.col.status')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('learners.col.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const scope = f.path ? r.paths.find((s) => s.path.id === f.path) : null;
                  return (
                    <tr key={r.raw.id} aria-selected={selected.has(r.raw.id)} data-learner={r.raw.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={t('learners.select', { name: r.label })}
                          checked={selected.has(r.raw.id)}
                          onChange={() => toggle(r.raw.id)}
                        />
                      </td>
                      <td>
                        <button type="button" className="l13-name" onClick={() => props.onOpen(r.raw.id)}>
                          <b>{r.raw.name.trim() || r.raw.email || t('learners.anonymousLink')}</b>
                        </button>
                        {r.raw.email && r.raw.name.trim() && (
                          <>
                            <br />
                            <span className="fd-help">{r.raw.email}</span>
                          </>
                        )}
                      </td>
                      <td>
                        <span className="fm-list">
                          {r.paths.slice(0, 2).map((s) => (
                            <span className="fm" key={s.path.id}>
                              {s.path.title || t('learners.untitled')}
                            </span>
                          ))}
                          {r.paths.length > 2 && (
                            <span
                              className="fm fm--more"
                              title={r.paths
                                .slice(2)
                                .map((s) => s.path.title)
                                .join(', ')}
                            >
                              +{r.paths.length - 2}
                            </span>
                          )}
                          {r.paths.length === 0 && (
                            <span className="fd-muted">{t('learners.notStarted')}</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <ProgressBar value={scope ? scope.pct : r.pct} />
                      </td>
                      <td className="num">{r.best === null ? '—' : `${r.best}${NNBSP}%`}</td>
                      <td>
                        <span title={formatDateTime(r.lastActivity)}>
                          {r.inactiveDays >= 2
                            ? t('learners.daysAgo', { count: r.inactiveDays })
                            : formatRelativeShort(r.lastActivity)}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={scope ? scope.status : r.status} />
                      </td>
                      <td>
                        <Menu
                          label={t('learners.actions.menu', { name: r.label })}
                          items={props.actions(r)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollX>
        )}
        {filtered.length > 0 && (
          <div className="l13-pager">
            <span>
              {t('learners.pager', {
                from: (page - 1) * PAGE + 1,
                to: Math.min(page * PAGE, sorted.length),
                total: sorted.length,
              })}
            </span>
            <span className="row">
              <Button size="sm" disabled={page <= 1} onClick={() => props.setPage(page - 1)}>
                {t('learners.prev')}
              </Button>
              <Button size="sm" disabled={page >= pages} onClick={() => props.setPage(page + 1)}>
                {t('learners.next')}
              </Button>
            </span>
          </div>
        )}
        <p className="fd-help">{t('learners.legend')}</p>
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// L13-03 : vue par formation
// ---------------------------------------------------------------------------
function FormationView({
  data,
  rows,
  selectedPath,
  onPick,
  onList,
  onExport,
}: {
  data: ProgressData;
  rows: LearnerRow[];
  selectedPath: string;
  onPick: (id: string) => void;
  onList: (patch: Record<string, string | null>) => void;
  onExport: (path: string) => void;
}) {
  const { t } = useTranslation();
  const path = data.paths.find((p) => p.id === selectedPath) ?? data.paths[0]!;
  const s = pathStats(rows, path);
  const quizLabel = (p: (typeof data.paths)[number]) => {
    const q = p.modules.filter((m) => m.hasQuiz).length;
    return q === 0 ? t('learners.fo.noQuiz') : t('learners.fo.quiz', { count: q });
  };
  return (
    <section
      className="l13-pane"
      id="l13-panel-formation"
      role="tabpanel"
      aria-labelledby="l13-tab-formation"
    >
      <div className="fo-grid" role="list" aria-label={t('learners.fo.list')}>
        {data.paths.map((p) => {
          const ps = pathStats(rows, p);
          const [d, a, st] = splitPercents([ps.done, ps.active, ps.stale]);
          const on = p.id === path.id;
          return (
            <article
              key={p.id}
              className="fd-card fo-card"
              role="listitem"
              aria-current={on ? 'true' : undefined}
              tabIndex={0}
              onClick={() => onPick(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(p.id);
                }
              }}
            >
              <h3>{p.title || t('learners.untitled')}</h3>
              <span className="fo-meta">
                {t('learners.fo.meta', {
                  modules: t('learners.fo.modules', { count: p.modules.length }),
                  quiz: quizLabel(p),
                  learners: t('learners.count', { count: ps.learners }),
                })}
              </span>
              <div
                className="fo-split"
                role="img"
                aria-label={t('learners.fo.splitAria', { done: d, active: a, stale: st })}
              >
                {ps.learners > 0 && (
                  <>
                    <span style={{ width: `${d}%` }} />
                    <span style={{ width: `${a}%` }} />
                    <span style={{ width: `${st}%` }} />
                  </>
                )}
              </div>
              <div className="fo-legend">
                <span>
                  <i className="lg-done" />
                  {t('learners.status.done')} {d}
                  {NNBSP}%
                </span>
                <span>
                  <i className="lg-active" />
                  {t('learners.status.active')} {a}
                  {NNBSP}%
                </span>
                <span>
                  <i className="lg-stale" />
                  {t('learners.status.stale')} {st}
                  {NNBSP}%
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="kpis">
        <article className="fd-card fd-card--hero fd-kpi">
          <div className="fd-card__head">
            <span className="fd-icon-chip">
              <Award {...ICON} />
            </span>
            <span className="fd-kpi__label">
              {t('learners.status.done')} · {path.title || t('learners.untitled')}
            </span>
          </div>
          <span className="fd-kpi__value">{s.learners ? pct(s.done / s.learners) : '—'}</span>
          <span className="fd-kpi__foot">
            {t('learners.fo.ofLearners', { n: s.done, total: s.learners })}
          </span>
        </article>
        <article className="fd-card fd-kpi">
          <div className="fd-card__head">
            <span className="fd-icon-chip">
              <Clock {...ICON} />
            </span>
            <span className="fd-kpi__label">{t('learners.status.active')}</span>
          </div>
          <span className="fd-kpi__value">{s.active}</span>
          <span className="fd-kpi__foot">{t('learners.kpi.activeFoot')}</span>
        </article>
        <article className="fd-card fd-kpi">
          <div className="fd-card__head">
            <span className="fd-icon-chip">
              <CircleHelp {...ICON} />
            </span>
            <span className="fd-kpi__label">{t('learners.fo.quizSuccess')}</span>
          </div>
          <span className="fd-kpi__value">{s.quizTried ? pct(s.quizPassed / s.quizTried) : '—'}</span>
          <span className="fd-kpi__foot">
            {!s.hasQuiz
              ? t('learners.fo.noQuiz')
              : s.quizTried
                ? t('learners.fo.firstTry', { pct: pct(s.quizFirst / s.quizTried) })
                : t('learners.kpi.scoreNone')}
          </span>
        </article>
        <article className="fd-card fd-kpi">
          <div className="fd-card__head">
            <span className="fd-icon-chip">
              <BellRing {...ICON} />
            </span>
            <span className="fd-kpi__label">{t('learners.status.stale')}</span>
          </div>
          <span className="fd-kpi__value">{s.stale}</span>
          <span className="fd-kpi__foot">
            <button
              type="button"
              className="l13-link"
              onClick={() => onList({ formation: path.id, statut: 'stale' })}
            >
              {t('learners.fo.seeList')}
            </button>
          </span>
        </article>
      </div>

      <article className="fd-card">
        <div className="fd-card__head">
          <span className="fd-icon-chip">
            <Layers {...ICON} />
          </span>
          <h2 className="fd-card__title">
            {t('learners.fo.byModule', { title: path.title || t('learners.untitled') })}
          </h2>
          <Button size="sm" icon={<Download />} onClick={() => onExport(path.id)} disabled={!s.learners}>
            {t('learners.fo.export')}
          </Button>
        </div>
        {s.learners === 0 ? (
          <p className="fd-muted">{t('learners.fo.empty')}</p>
        ) : (
          <>
            <ul className="funnel" aria-label={t('learners.fo.funnelAria')}>
              {s.modules.map((m, i) => (
                <li className="row" key={m.demoId}>
                  <button
                    type="button"
                    className="funnel__label"
                    onClick={() => onList({ formation: path.id, module: m.demoId, statut: null })}
                    aria-label={t('learners.fo.moduleOpen', { title: m.title })}
                  >
                    {i + 1} · {m.title}
                  </button>
                  <span className="bar" aria-hidden="true">
                    <span className={`c${i % 4}`} style={{ width: `${(m.ok / s.learners) * 100}%` }} />
                  </span>
                  <span className="num">
                    <b>{pct(m.ok / s.learners)}</b> · {t('learners.fo.outOf', { n: m.ok, total: s.learners })}
                  </span>
                </li>
              ))}
            </ul>
            <p className="fd-help">
              {s.drop
                ? t('learners.fo.drop', { from: s.drop.from, to: s.drop.to, points: s.drop.points })
                : t('learners.fo.noDrop')}{' '}
              {t('learners.fo.clickHint')}
            </p>
          </>
        )}
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Fenêtres : focus initial, Échap, retour du focus
// ---------------------------------------------------------------------------
function useOverlayFocus(onEscape: () => void, active = true) {
  const ref = useRef<HTMLElement>(null);
  const back = useRef<Element | null>(null);
  const esc = useRef(onEscape);
  esc.current = onEscape;
  useEffect(() => {
    back.current = document.activeElement;
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      const el = back.current as HTMLElement | null;
      if (el?.isConnected) el.focus();
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        esc.current();
      }
      if (e.key === 'Tab' && ref.current) {
        const f = [
          ...ref.current.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex="0"]',
          ),
        ].filter((x) => !x.hasAttribute('disabled'));
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
  return ref;
}

// ---------------------------------------------------------------------------
// L13-02 : fiche d'un apprenant
// ---------------------------------------------------------------------------
interface Detail {
  events: Array<{ type: string; demoId: string; stepIndex: number | null; at: string }>;
  attempts: Array<{
    demoId: string;
    score: number;
    passed: boolean;
    correct: number;
    total: number;
    at: string;
  }>;
  reminders: string[];
}

function LearnerDrawer({
  row,
  data,
  now,
  canErase,
  inert,
  onClose,
  onRemind,
  onGrant,
  onExport,
  onErase,
  onChanged,
}: {
  row: LearnerRow;
  data: ProgressData;
  now: number;
  canErase: boolean;
  inert: boolean;
  onClose: () => void;
  onRemind: () => void;
  onGrant: () => void;
  onExport: () => void;
  onErase: () => void;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const ref = useOverlayFocus(onClose, !inert);
  const [detail, setDetail] = useState<Detail | null>(null);
  const l = row.raw;
  useEffect(() => {
    let alive = true;
    void supabase
      .rpc('learner_detail', { p_learner: l.id })
      .then(({ data: d }) => alive && setDetail(d as unknown as Detail));
    return () => {
      alive = false;
    };
  }, [l.id, row]);
  const title = (demoId: string) =>
    data.paths.flatMap((p) => p.modules).find((m) => m.demoId === demoId)?.title ?? '';
  const structure = data.structures.find((s) => s.id === l.structureId)?.name;
  const display = l.name.trim() || l.email || t('learners.anonymousLink');
  const timeline = [
    ...(detail?.events ?? []).map((e) => ({
      at: e.at,
      text: t(`learners.fiche.ev.${e.type}`, { title: title(e.demoId) }),
    })),
    ...(detail?.reminders ?? []).map((at) => ({ at, text: t('learners.fiche.ev.reminder') })),
    ...(detail?.attempts ?? []).map((a) => ({
      at: a.at,
      text: t(a.passed ? 'learners.fiche.ev.quizPassed' : 'learners.fiche.ev.quizFailed', {
        title: title(a.demoId),
        score: `${a.score}${NNBSP}%`,
      }),
    })),
    { at: l.createdAt, text: t(`learners.fiche.ev.identified_${l.source}`) },
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 30);
  const quizMods = row.paths.flatMap((s) =>
    s.path.modules
      .filter((m) => m.hasQuiz)
      .map((m) => ({ s, m, x: l.modules.find((mm) => mm.demoId === m.demoId) })),
  );

  return createPortal(
    <div className="mk l13-layer">
      <div className="l13-scrim" aria-hidden="true" onClick={onClose} />
      <aside
        className="l13-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="l13-dr-t"
        ref={ref as React.RefObject<HTMLElement>}
        inert={inert}
      >
        <header>
          <span className="avatar" aria-hidden="true">
            {initials(display)}
          </span>
          <div className="grow">
            <h2 id="l13-dr-t" tabIndex={-1} data-autofocus>
              {display}
            </h2>
            <p>
              {[
                l.email && l.name.trim() ? l.email : null,
                structure,
                t(`learners.fiche.since_${l.source}`, { date: formatDate(l.createdAt) }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <StatusBadge status={row.status}>
              {row.status === 'stale'
                ? t('learners.fiche.inactive', { count: row.inactiveDays })
                : t(`learners.status.${row.status}`)}
            </StatusBadge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={<X />}
            aria-label={t('learners.fiche.close')}
            onClick={onClose}
          />
        </header>
        <div className="body">
          <label className="fd-field l13-structure">
            <span className="fd-label">{t('learners.filters.structure')}</span>
            <select
              className="fd-select fd-select--sm"
              value={l.structureId ?? ''}
              onChange={async (e) => {
                await supabase
                  .from('learners')
                  .update({ structure_id: e.target.value || null })
                  .eq('id', l.id);
                await onChanged();
              }}
            >
              <option value="">{t('learners.noStructure')}</option>
              {data.structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <section>
            <h3>{t('learners.fiche.paths')}</h3>
            {row.paths.length === 0 ? (
              <p className="fd-muted">{t('learners.notStarted')}</p>
            ) : (
              <ul className="l13-mods">
                {row.paths.map((s) => (
                  <li key={s.path.id}>
                    <span>
                      <b>{s.path.title || t('learners.untitled')}</b>
                      <small>
                        {s.done
                          ? t('learners.fiche.pathDone', {
                              count: s.path.modules.length,
                              date: formatDate(s.doneAt),
                            })
                          : t('learners.fiche.pathAt', {
                              n: s.current!.index + 1,
                              total: s.path.modules.length,
                              title: s.current!.title,
                            })}
                      </small>
                    </span>
                    <ProgressBar value={s.pct} />
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {quizMods.length > 0 && (
            <section>
              <h3>{t('learners.fiche.quiz')}</h3>
              <ul className="l13-quiz">
                {quizMods.map(({ s, m, x }) => {
                  const tries = (detail?.attempts ?? []).filter((a) => a.demoId === m.demoId);
                  const left = x?.max != null ? Math.max(0, x.max - x.used) : null;
                  return (
                    <li key={s.path.id + m.demoId}>
                      <span>
                        {s.path.title} · {m.title}
                        {NNBSP}:{' '}
                        {!x || x.used === 0 ? (
                          <b>
                            {t('learners.fiche.quizNotTried', {
                              count: left ?? 0,
                              context: left === null ? 'unlimited' : undefined,
                            })}
                          </b>
                        ) : (
                          <b>
                            {t('learners.fiche.quizBest', {
                              score: `${x.best ?? 0}${NNBSP}%`,
                              used: x.used,
                              max: x.max ?? '∞',
                            })}
                          </b>
                        )}
                      </span>
                      {tries.length > 0 && (
                        <details>
                          <summary>{t('learners.fiche.attempts', { count: tries.length })}</summary>
                          <ol>
                            {tries.map((a) => (
                              <li key={a.at}>
                                {t('learners.fiche.attempt', {
                                  score: `${a.score}${NNBSP}%`,
                                  correct: a.correct,
                                  total: a.total,
                                  date: formatDateTime(a.at),
                                })}{' '}
                                {a.passed ? t('learners.fiche.passed') : t('learners.fiche.failed')}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section>
            <h3>{t('learners.fiche.activity')}</h3>
            {!detail ? (
              <p className="fd-muted">{t('common.loading')}</p>
            ) : (
              <ol className="l13-timeline">
                {timeline.map((e, i) => (
                  <li key={i}>
                    {e.text}
                    <small>{formatDateTime(e.at)}</small>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <p className="fd-help">{t('learners.fiche.privacy')}</p>
        </div>
        <footer>
          <Button
            variant="primary"
            size="sm"
            icon={<BellRing />}
            onClick={onRemind}
            disabled={!canRemind(l, now)}
          >
            {t('learners.actions.remind')}
          </Button>
          <Button
            size="sm"
            icon={<RefreshCw />}
            onClick={onGrant}
            disabled={
              !l.modules.some((m) => m.hasQuiz && m.status !== 'not_started' && m.status !== 'validated')
            }
          >
            {t('learners.actions.grant')}
          </Button>
          <Button size="sm" icon={<Download />} onClick={onExport}>
            {t('learners.fiche.exportOne')}
          </Button>
          {canErase && (
            <Button
              size="sm"
              variant="ghost"
              className="btn-danger-ghost push"
              icon={<Trash2 />}
              onClick={onErase}
            >
              {t('learners.fiche.erase')}
            </Button>
          )}
        </footer>
        {!canRemind(l, now) && l.email && (
          <p className="fd-help l13-foot-hint">
            {t('learners.fiche.remindedRecently', { date: formatDateTime(l.lastReminder) })}
          </p>
        )}
      </aside>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// L13-05 : suppression RGPD
// ---------------------------------------------------------------------------
function EraseDialog({
  row,
  onCancel,
  onErased,
}: {
  row: LearnerRow;
  onCancel: () => void;
  onErased: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const ref = useOverlayFocus(onCancel);
  const [text, setText] = useState('');
  const { error, run, busy } = useAction();
  const expected = (row.raw.email ?? row.raw.name).trim();
  const ok = text.trim().toLowerCase() === expected.toLowerCase() && expected !== '';
  const display = row.raw.name.trim() || row.raw.email || t('learners.anonymousLink');
  return createPortal(
    <div className="mk l13-layer l13-layer--top">
      <div className="l13-scrim" aria-hidden="true" />
      <div
        className="l13-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="l13-rg-t"
        aria-describedby="l13-rg-d"
        ref={ref as React.RefObject<HTMLDivElement>}
      >
        <header>
          <h2 id="l13-rg-t">{t('learners.erase.title', { name: display })}</h2>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            void run(async () => {
              check(await supabase.rpc('erase_learner', { p_learner: row.raw.id, p_confirm: text.trim() }));
              await onErased();
            });
          }}
        >
          <div className="body">
            <p id="l13-rg-d">{t('learners.erase.intro')}</p>
            <ul className="l13-danger-list">
              <li>{t('learners.erase.item1', { count: row.paths.length })}</li>
              <li>{t('learners.erase.item2')}</li>
              <li>{t('learners.erase.item3')}</li>
            </ul>
            <p>{t('learners.erase.kept')}</p>
            {error && <Alert kind="error">{error}</Alert>}
            <label className="fd-field">
              <span className="fd-label">
                {t(row.raw.email ? 'learners.erase.typeEmail' : 'learners.erase.typeName')} <b>{expected}</b>
              </span>
              <input
                className="fd-input"
                type="text"
                autoComplete="off"
                value={text}
                data-autofocus
                onChange={(e) => setText(e.target.value)}
              />
            </label>
          </div>
          <footer>
            <Button onClick={onCancel}>{t('common.cancel')}</Button>
            <Button type="submit" variant="danger" disabled={!ok || busy}>
              {t('learners.erase.confirm')}
            </Button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// L13-04 : export CSV
// ---------------------------------------------------------------------------
type Scope = 'filtered' | 'selection' | 'all' | 'path' | 'learner';

function ExportDialog({
  data,
  wsId,
  rows,
  filtered,
  filterLabel,
  selected,
  preset,
  onClose,
  onDone,
}: {
  data: ProgressData;
  wsId: string;
  rows: LearnerRow[];
  filtered: LearnerRow[];
  filterLabel: string;
  selected: LearnerRow[];
  preset?: { path?: string; learner?: string };
  onClose: () => void;
  onDone: (n: number) => void;
}) {
  const { t } = useTranslation();
  const ref = useOverlayFocus(onClose);
  const pathRows = preset?.path ? rows.filter((r) => r.paths.some((s) => s.path.id === preset.path)) : [];
  const one = preset?.learner ? rows.filter((r) => r.raw.id === preset.learner) : [];
  const options: Array<{ id: Scope; title: string; hint: string; rows: LearnerRow[] }> = [
    ...(preset?.learner
      ? [{ id: 'learner' as const, title: t('learners.export.one'), hint: one[0]?.label ?? '', rows: one }]
      : []),
    ...(preset?.path
      ? [
          {
            id: 'path' as const,
            title: t('learners.export.path'),
            hint:
              t('learners.export.lines', { count: pathRows.length }) +
              ` · ${data.paths.find((p) => p.id === preset.path)?.title ?? ''}`,
            rows: pathRows,
          },
        ]
      : []),
    {
      id: 'filtered',
      title: t('learners.export.filtered'),
      hint:
        t('learners.export.lines', { count: filtered.length }) +
        (filterLabel ? ` · ${t('learners.export.filter', { f: filterLabel })}` : ''),
      rows: filtered,
    },
    ...(selected.length
      ? [
          {
            id: 'selection' as const,
            title: t('learners.export.selection'),
            hint: t('learners.count', { count: selected.length }),
            rows: selected,
          },
        ]
      : []),
    {
      id: 'all',
      title: t('learners.export.all'),
      hint: t('learners.export.lines', { count: rows.length }),
      rows,
    },
  ];
  const [scope, setScope] = useState<Scope>(options[0]!.id);
  const [cols, setCols] = useState<ExportColumn[]>(['identity', 'progress', 'quiz']);
  const { error, run, busy } = useAction();
  const chosen = options.find((o) => o.id === scope)!.rows;
  const colIds: ExportColumn[] = ['identity', 'progress', 'quiz', 'modules'];

  function exportNow() {
    void run(async () => {
      check(
        await supabase.rpc('log_learners_export', {
          p_workspace: wsId,
          p_rows: chosen.length,
          p_columns: cols,
        }),
      );
      const table = csvTable(chosen, data, cols, {
        name: t('learners.csv.name'),
        email: t('learners.csv.email'),
        structure: t('learners.csv.structure'),
        source: t('learners.csv.source'),
        sourceValue: (s) => t(`learners.csv.source_${s}`),
        paths: t('learners.csv.paths'),
        progress: t('learners.csv.progress'),
        status: t('learners.csv.status'),
        statusValue: (s) => t(`learners.status.${s}`),
        lastActivity: t('learners.csv.last'),
        best: t('learners.csv.best'),
        attempts: t('learners.csv.attempts'),
        moduleValue: (s) => t(`learners.moduleStatus.${s}`),
      });
      downloadText(
        `apprenants-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(table.headers, table.data, ';'),
      );
      onDone(chosen.length);
    });
  }

  return createPortal(
    <div className="mk l13-layer l13-layer--top">
      <div className="l13-scrim" aria-hidden="true" onClick={onClose} />
      <div
        className="l13-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="l13-ex-t"
        ref={ref as React.RefObject<HTMLDivElement>}
      >
        <header>
          <h2 id="l13-ex-t" tabIndex={-1} data-autofocus>
            {t('learners.export.title')}
          </h2>
          <Button size="sm" variant="ghost" icon={<X />} aria-label={t('common.close')} onClick={onClose} />
        </header>
        <div className="body">
          <div className="l13-radio" role="radiogroup" aria-label={t('learners.export.rows')}>
            {options.map((o) => (
              <label key={o.id}>
                <input type="radio" name="l13-ex" checked={scope === o.id} onChange={() => setScope(o.id)} />
                <span>
                  <b>{o.title}</b>
                  <small>{o.hint}</small>
                </span>
              </label>
            ))}
          </div>
          <fieldset className="l13-checks">
            <legend className="fd-label">{t('learners.export.columns')}</legend>
            {colIds.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={cols.includes(c)}
                  onChange={() =>
                    setCols((x) =>
                      x.includes(c)
                        ? x.filter((y) => y !== c)
                        : colIds.filter((y) => y === c || x.includes(y)),
                    )
                  }
                />
                {t(`learners.export.col.${c}`)}
              </label>
            ))}
          </fieldset>
          <p className="fd-help">{t('learners.export.help')}</p>
          {error && <Alert kind="error">{error}</Alert>}
        </div>
        <footer>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            icon={<Download />}
            disabled={!chosen.length || !cols.length || busy}
            onClick={exportNow}
          >
            {t('learners.export.submit', { count: chosen.length })}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
