import { Copy, Download, Eye, Info, Mail, Play, Plus, Power, ShieldCheck, Trash2, X } from 'lucide-react';
import { useConfirm } from '../../components/ConfirmDialog';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Tables } from '@flowdsiml/supabase-types';
import { extractVariableKeys } from '@flowdsiml/core';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { embedSnippet, personalPageUrl, publicDemoUrl, shareLinkUrl } from '../../lib/embed';
import { unpublishDemo } from '../../lib/publish';
import { formatDate, formatDateTime, formatNumber, formatRelativeShort } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { Menu } from '../../components/Menu';
import { asSettings } from '../editor/types';
import { useDemoEditor } from '../editor/useDemoEditor';
import { PublishButton } from '../editor/PublishButton';
import { usePlan } from '../../lib/plan';
import { PlanFormsWarning } from '../../components/PlanFormsWarning';
import { AccessPanel, AccessSummary, useDemoAccess } from './AccessPanel';
import { useShareRules } from '../../lib/shareRules';
import { CopyButton, highlightHtml } from './codeBlock';
import { PublicPagePanel } from './PublicPagePanel';
import {
  PersonalPageFields,
  emptyPersonalPage,
  personalPageErrors,
  type PersonalPageDraft,
} from './PersonalPageFields';
import { ExportDialog } from '../export/ExportDialog';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import { NotificationBell } from '../../components/notifications/NotificationBell';

type Tab = 'link' | 'embed' | 'perso' | 'access' | 'page';
type LinkStats = Record<string, { views: number; last: string | null }>;

/** Partager une démo (PRT-01), à l'identique de la maquette partage.html, sur les données réelles. */
export function SharePage() {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const { demoId = '' } = useParams();
  const [params] = useSearchParams();
  const { can, current } = useWorkspace();
  const rules = useShareRules(current?.id);
  const editor = useDemoEditor(demoId);
  const access = useDemoAccess(demoId);
  const [demo, setDemo] = useState<Tables<'demos'> | null>(null);
  const [links, setLinks] = useState<Tables<'share_links'>[]>([]);
  const [linkStats, setLinkStats] = useState<LinkStats>({});
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  /** L17-01 : confirmation RGPD enregistrée avec la version en ligne (auteur et date). */
  const [ack, setAck] = useState<{ name: string; at: string } | null>(null);
  const [variables, setVariables] = useState<Tables<'variables'>[]>([]);
  /** REV-10 : variables réellement présentes dans les textes de la démo, dans l'ordre d'apparition. */
  const [usedKeys, setUsedKeys] = useState<string[]>([]);
  // L25-13 : page publique (activée, bouton), membres (signature), lignes du jeu de données
  const [pubPage, setPubPage] = useState<{ enabled: boolean; cta: { label: string; url: string } | null }>({
    enabled: false,
    cta: null,
  });
  const [signers, setSigners] = useState<Array<{ id: string; name: string }>>([]);
  const [dsRows, setDsRows] = useState<string[] | null>(null);
  const [origins, setOrigins] = useState('');
  // RP-2 : la modale RGPD ouvre directement l'onglet Accès (?tab=access)
  const [tab, setTab] = useState<Tab>(() => {
    const q = params.get('tab');
    return q === 'embed' || q === 'perso' || q === 'access' || q === 'page' ? q : 'link';
  });
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState<boolean | 'gif'>(false);
  const [week, setWeek] = useState<{ views: number; leads: number } | null>(null);
  const [gatedSteps, setGatedSteps] = useState(0);
  const { error, success, run } = useAction();
  const editable = can('demo.edit');
  const plan = usePlan();

  const load = useCallback(async () => {
    const d = await supabase.from('demos').select('*').eq('id', demoId).maybeSingle();
    setDemo(d.data);
    if (!d.data) return;
    setOrigins((asSettings(d.data.settings).allowedEmbedOrigins ?? []).join('\n'));
    const [l, v, vars, gated, a] = await Promise.all([
      supabase
        .from('share_links')
        .select('*')
        .eq('demo_id', demoId)
        .order('created_at', { ascending: false }),
      d.data.current_version_id
        ? supabase
            .from('demo_versions')
            .select('published_at, public_ack')
            .eq('id', d.data.current_version_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('variables').select('*').eq('workspace_id', d.data.workspace_id).order('key'),
      supabase
        .from('steps')
        .select('id', { count: 'exact', head: true })
        .eq('demo_id', demoId)
        .not('gate_form_id', 'is', null),
      supabase.rpc('demo_analytics', {
        p_demo: demoId,
        p_from: new Date(Date.now() - 7 * 86400_000).toISOString(),
        p_to: new Date().toISOString(),
      }),
    ]);
    const list = l.data ?? [];
    setLinks(list);
    const ver = v.data as { published_at: string; public_ack: { by?: string; at?: string } | null } | null;
    setPublishedAt(ver?.published_at ?? null);
    const pa = ver?.public_ack;
    if (pa?.by && pa.at) {
      const m = await supabase.rpc('list_members', { p_workspace: d.data.workspace_id });
      const who = (m.data ?? []).find((x) => x.user_id === pa.by);
      setAck({ name: who?.full_name || who?.email || t('share.ackUnknown'), at: pa.at });
    } else setAck(null);
    setVariables(vars.data ?? []);
    const [st, hs] = await Promise.all([
      supabase.from('steps').select('title, body, position').eq('demo_id', demoId).order('position'),
      supabase.from('hotspots').select('title, body').eq('demo_id', demoId),
    ]);
    const texts = [...(st.data ?? []), ...(hs.data ?? [])].flatMap((x) => [x.title ?? '', x.body ?? '']);
    setUsedKeys([...new Set(texts.flatMap((x) => extractVariableKeys(x)))]);
    const [pg, mem, ds] = await Promise.all([
      supabase.from('demo_pages').select('enabled, cta_label, cta_url').eq('demo_id', demoId).maybeSingle(),
      supabase.rpc('list_members', { p_workspace: d.data.workspace_id }),
      supabase.from('demo_datasets').select('columns, rows, link_column').eq('demo_id', demoId).maybeSingle(),
    ]);
    setPubPage({
      enabled: !!pg.data?.enabled,
      cta: pg.data?.cta_url ? { label: pg.data.cta_label ?? '', url: pg.data.cta_url } : null,
    });
    // Signature : nom seulement (jamais l'e-mail)
    setSigners(
      (mem.data ?? [])
        .filter((m) => (m.full_name ?? '').trim())
        .map((m) => ({ id: m.user_id, name: (m.full_name ?? '').trim() })),
    );
    const dsd = ds.data as { columns: string[]; rows: string[][]; link_column: string | null } | null;
    if (dsd) {
      const c = Math.max(0, dsd.link_column ? dsd.columns.indexOf(dsd.link_column) : 0);
      setDsRows(dsd.rows.map((r) => r[c] ?? ''));
    } else setDsRows(null);
    setGatedSteps(gated.count ?? 0);
    const w = a.data as unknown as { views: number; leads: number } | null;
    setWeek(w ? { views: Number(w.views), leads: Number(w.leads) } : null);
    // Vues et dernière vue de chaque lien personnalisé (événements demo_view portant le lien)
    const stats: LinkStats = {};
    await Promise.all(
      list.map(async (x) => {
        const [c, last] = await Promise.all([
          supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('demo_id', demoId)
            .eq('link_id', x.id)
            .eq('type', 'demo_view'),
          supabase
            .from('events')
            .select('occurred_at')
            .eq('demo_id', demoId)
            .eq('link_id', x.id)
            .eq('type', 'demo_view')
            .order('occurred_at', { ascending: false })
            .limit(1),
        ]);
        stats[x.id] = { views: c.count ?? 0, last: last.data?.[0]?.occurred_at ?? null };
      }),
    );
    setLinkStats(stats);
  }, [demoId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!demo) return <Loading />;
  const published = demo.status === 'published';
  const url = publicDemoUrl(demo.id);
  const publicLinksOff = current?.public_links_enabled === false;
  // Modifications non publiées : démo modifiée après la publication de la version en ligne
  const pending =
    published && publishedAt ? Date.parse(demo.updated_at) > Date.parse(publishedAt) + 2000 : false;
  const paramExample = usedKeys
    .slice(0, 2)
    .map((k, i) => [i ? '&' : '?', `${k}=`, variables.find((v) => v.key === k)?.default_value || k] as const);

  // Onglets texte seul, comme le rendu de la maquette
  const tabs: Array<{ id: Tab }> = [
    { id: 'link' },
    { id: 'embed' },
    { id: 'perso' },
    { id: 'access' },
    { id: 'page' },
  ];

  return (
    <div className="mk sh">
      {dialog}
      {exporting && (
        <ExportDialog
          demoId={demoId}
          initialFormat={exporting === 'gif' ? 'gif' : undefined}
          onClose={() => setExporting(false)}
        />
      )}
      <div className="page-head">
        <div>
          <h1>{t('share.pageTitle')}</h1>
          <p className="muted sh-sub">
            {published && publishedAt ? (
              <>
                {t('share.publishedOn', { date: formatDateTime(publishedAt) })}
                {pending && (
                  <>
                    {' · '}
                    <Link to={`/demos/${demoId}/edit`}>{t('share.pendingChanges')}</Link>
                  </>
                )}
              </>
            ) : (
              t('share.neverPublished', { title: demo.title })
            )}
          </p>
          {published && ack && (
            <p className="muted sh-sub sh-ack">
              <ShieldCheck size={14} aria-hidden="true" />
              {t('share.ackLine', { name: ack.name, date: formatDateTime(ack.at) })}
            </p>
          )}
        </div>
        <div className="row">
          <a className="btn btn-secondary" href={`${url}?preview=1`} target="_blank" rel="noreferrer">
            <Eye aria-hidden="true" />
            {t('share.preview')}
          </a>
          {/* L27 : exports hors de l'app interdits par les règles de l'espace */}
          <button
            type="button"
            className="btn btn-secondary"
            aria-disabled={rules.exports_allowed ? undefined : true}
            title={rules.exports_allowed ? undefined : t('rules.errExports')}
            onClick={() => rules.exports_allowed && setExporting(true)}
          >
            <Download aria-hidden="true" />
            {t('export.menu')}
          </button>
          {editable && editor.demo && (!published || pending) && (
            <span className="sh-publish tc-cta-grad">
              <PublishButton editor={editor} republishLabel={t('share.publishChanges')} />
            </span>
          )}
        </div>
        <div className="page-head__actions">
          <NotificationBell />
        </div>
      </div>
      {params.get('published') && (
        <div className="alert alert-success sh-alert" role="status">
          {t('share.justPublished')}
        </div>
      )}
      {published && !plan.leadForms && gatedSteps > 0 && <PlanFormsWarning variant="share" />}
      {error && (
        <div className="alert alert-danger sh-alert" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success sh-alert" role="status">
          {success}
        </div>
      )}

      <div className="share-layout">
        <div className="card">
          <div className="sh-tabs-wrap">
            <div className="tabs" role="tablist" aria-label={t('share.mode')}>
              {tabs.map(({ id }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`sh-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={tab === id ? `sh-panel-${id}` : undefined}
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => setTab(id)}
                  onKeyDown={(e) => {
                    const i = tabs.findIndex((x) => x.id === id);
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]!.id;
                      setTab(n);
                      document.getElementById(`sh-tab-${n}`)?.focus();
                    }
                  }}
                >
                  {t(`share.tab.${id}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="card-pad">
            {tab === 'link' && (
              <section role="tabpanel" id="sh-panel-link" aria-labelledby="sh-tab-link">
                <div className="setting sh-first">
                  <div>
                    <b>{t('share.publicAccess')}</b>
                    <p className="t-caption muted">{t('share.publicAccessHelp')}</p>
                  </div>
                  <span className="switch">
                    <input
                      type="checkbox"
                      aria-label={t('share.publicAccess')}
                      checked={published}
                      disabled={!editable || !published}
                      onChange={() =>
                        void ask({
                          title: t('share.unpublish'),
                          body: t('share.confirmUnpublish'),
                          confirmLabel: t('share.unpublish'),
                          danger: true,
                        }).then(
                          (yes) =>
                            yes &&
                            void run(async () => {
                              await unpublishDemo(demoId);
                              await load();
                            }, t('share.unpublished')),
                        )
                      }
                    />
                    <span />
                  </span>
                </div>
                {!published && (
                  <div className="alert alert-warning sh-note">
                    <Info aria-hidden="true" />
                    <span>{t('share.notPublishedNote')}</span>
                  </div>
                )}
                {publicLinksOff && (
                  <div className="alert sh-note">
                    <Info aria-hidden="true" />
                    <span>{t('share.publicLinksOff')}</span>
                  </div>
                )}
                <div className="field sh-field">
                  <label htmlFor="sh-pub">{t('share.publicLink')}</label>
                  <div className="input-group">
                    <input id="sh-pub" className="input t-mono" readOnly value={url} disabled={!published} />
                    <CopyButton value={url} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="sh-slug">
                    {t('share.customAddress')} <span className="badge">{t('shell.soon')}</span>
                  </label>
                  {/* REV-10 : « Bientôt » : lisible et atteignable, mais non modifiable */}
                  <div className="input-group">
                    <span className="input t-mono muted sh-prefix">{url.replace(/[^/]+$/, '')}</span>
                    <input
                      id="sh-slug"
                      className="input t-mono sh-slug"
                      readOnly
                      aria-disabled="true"
                      value={demo.id.slice(0, 8)}
                    />
                  </div>
                  <span className="help">{t('share.customAddressHelp')}</span>
                </div>
                <hr className="divider sh-hr" />
                <h2 className="t-label sh-h3" id="sh-params-h">
                  {t('share.urlParams')}
                </h2>
                {/* Zone défilante atteignable au clavier (RGAA 7.3) */}
                <div className="code" tabIndex={0} role="region" aria-labelledby="sh-params-h">
                  {url}
                  {paramExample.map(([sep, k, v]) => (
                    <span key={k}>
                      <span className="k">
                        {sep}
                        {k}
                      </span>
                      <span className="s">{encodeURIComponent(v)}</span>
                    </span>
                  ))}
                </div>
                <p className="help sh-help">
                  {paramExample.length ? t('share.urlParamsHelp') : t('share.urlParamsNone')}
                </p>
                <hr className="divider sh-hr" />
                <h2 className="t-label sh-h3">{t('share.elsewhere')}</h2>
                <div className="row wrap">
                  <a
                    className="btn btn-secondary btn-sm"
                    href={`mailto:?subject=${encodeURIComponent(demo.title)}&body=${encodeURIComponent(url)}`}
                    aria-disabled={published ? undefined : 'true'}
                  >
                    <Mail aria-hidden="true" />
                    {t('share.email')}
                  </a>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-disabled={published ? undefined : 'true'}
                  >
                    LinkedIn
                  </a>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={`https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(demo.title)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-disabled={published ? undefined : 'true'}
                  >
                    X
                  </a>
                  {/* REV-10 : l'export GIF et vidéo existe (L15, L25) : on l'ouvre sur le GIF */}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!published}
                    aria-disabled={rules.exports_allowed ? undefined : true}
                    title={rules.exports_allowed ? undefined : t('rules.errExports')}
                    onClick={() => rules.exports_allowed && setExporting('gif')}
                  >
                    <Download aria-hidden="true" />
                    {t('share.gif')}
                  </button>
                </div>
              </section>
            )}

            {tab === 'embed' && (
              <section role="tabpanel" id="sh-panel-embed" aria-labelledby="sh-tab-embed">
                <EmbedPanel
                  url={url}
                  title={demo.title}
                  published={published}
                  editable={editable}
                  origins={origins}
                  setOrigins={setOrigins}
                  removeBranding={plan.removeBranding}
                  onSaveOrigins={() =>
                    void run(async () => {
                      const list = origins
                        .split(/\s+/)
                        .map((o) => o.trim())
                        .filter(Boolean)
                        .slice(0, 20);
                      check(
                        await supabase
                          .from('demos')
                          .update({ settings: { ...asSettings(demo.settings), allowedEmbedOrigins: list } })
                          .eq('id', demoId),
                      );
                      await load();
                    }, t('share.originsSaved'))
                  }
                />
              </section>
            )}

            {tab === 'perso' && (
              <section role="tabpanel" id="sh-panel-perso" aria-labelledby="sh-tab-perso">
                <div className="row between sh-perso-head">
                  <p className="muted">{t('share.persoHelp')}</p>
                  {editable && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setCreating(true)}
                    >
                      <Plus aria-hidden="true" />
                      {t('share.newLink')}
                    </button>
                  )}
                </div>
                {links.length === 0 ? (
                  <p className="muted sh-empty">{t('share.noLinks')}</p>
                ) : (
                  <div className="table-wrap">
                    <table className="table sh-links">
                      <caption className="sr-only">{t('share.tab.perso')}</caption>
                      <thead>
                        <tr>
                          <th>{t('share.linkNameShort')}</th>
                          <th>{t('editor.variables')}</th>
                          <th>{t('share.pp.column')}</th>
                          {/* L25-13 : vues et dernière vue dans une colonne (table plus étroite) */}
                          <th className="r">{t('analytics.views')}</th>
                          <th>
                            <span className="sr-only">{t('members.actions')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {links.map((l) => {
                          const vars = Object.values((l.variables as Record<string, string>) ?? {}).filter(
                            Boolean,
                          );
                          const expired = l.expires_at && Date.parse(l.expires_at) < Date.now();
                          const st = linkStats[l.id];
                          return (
                            <tr key={l.id} className={l.is_active && !expired ? undefined : 'sh-off'}>
                              <th scope="row" className="sh-row-h">
                                {l.name || '—'}
                                {!l.is_active && (
                                  <span className="badge sh-state">{t('share.disabled')}</span>
                                )}
                              </th>
                              <td>
                                {vars.map((v) => (
                                  <span key={v} className="badge sh-var" title={v}>
                                    {v}
                                  </span>
                                ))}
                                {l.expires_at && (
                                  <span className={`badge ${expired ? '' : 'badge-warning'}`}>
                                    {expired
                                      ? t('share.expired')
                                      : t('share.expiresOn', {
                                          date: formatDate(l.expires_at, { day: 'numeric', month: 'short' }),
                                        })}
                                  </span>
                                )}
                                {!vars.length && !l.expires_at && <span className="muted">—</span>}
                              </td>
                              <td>
                                {l.page_enabled && l.page_code ? (
                                  <div className="sh-pp-cell">
                                    <span className="badge badge-success">{t('share.pp.badgeOn')}</span>
                                    {/* L25-13 : adresse de la page (/p/<démo>/<code>), copiable */}
                                    <span className="sh-pp-url">
                                      <span className="t-mono" title={personalPageUrl(demoId, l.page_code)}>
                                        {`…/${l.page_code}`}
                                      </span>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm btn-icon"
                                        aria-label={t('share.pp.copyPage', { name: l.name || '—' })}
                                        title={t('share.pp.copyPage', { name: l.name || '—' })}
                                        onClick={() =>
                                          void navigator.clipboard
                                            ?.writeText(personalPageUrl(demoId, l.page_code!))
                                            .then(() => run(async () => undefined, t('members.linkCopied')))
                                        }
                                      >
                                        <Copy aria-hidden="true" />
                                      </button>
                                    </span>
                                  </div>
                                ) : (
                                  <span className="badge">{t('share.pp.badgeOff')}</span>
                                )}
                              </td>
                              <td className="r sh-views">
                                {formatNumber(st?.views ?? 0)}
                                {st?.last && (
                                  <span className="t-caption muted">
                                    <span className="sr-only">{t('share.lastView')} : </span>
                                    {formatRelativeShort(st.last)}
                                  </span>
                                )}
                              </td>
                              <td className="r">
                                <div className="row sh-actions">
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm btn-icon"
                                    aria-label={t('share.copyLinkOf', { name: l.name || '—' })}
                                    onClick={() =>
                                      void navigator.clipboard
                                        ?.writeText(shareLinkUrl(l.token))
                                        .then(() => run(async () => undefined, t('members.linkCopied')))
                                    }
                                  >
                                    <Copy aria-hidden="true" />
                                  </button>
                                  {editable && (
                                    <Menu
                                      label={t('members.actionsFor', { name: l.name || '—' })}
                                      items={[
                                        {
                                          label: l.is_active ? t('share.disable') : t('share.enable'),
                                          icon: <Power />,
                                          onSelect: () =>
                                            void run(async () => {
                                              check(
                                                await supabase
                                                  .from('share_links')
                                                  .update({ is_active: !l.is_active })
                                                  .eq('id', l.id),
                                              );
                                              await load();
                                            }),
                                        },
                                        'separator',
                                        {
                                          label: t('common.delete'),
                                          icon: <Trash2 />,
                                          danger: true,
                                          onSelect: () =>
                                            void run(async () => {
                                              check(
                                                await supabase.from('share_links').delete().eq('id', l.id),
                                              );
                                              await load();
                                            }),
                                        },
                                      ]}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {tab === 'access' && <AccessPanel demoId={demo.id} state={access} editable={can('demo.edit')} />}
            {tab === 'page' && (
              <section role="tabpanel" id="sh-panel-page" aria-labelledby="sh-tab-page">
                <PublicPagePanel
                  demoId={demo.id}
                  demoTitle={demo.title}
                  published={published}
                  protectedAccess={access.access.mode !== 'link'}
                  editable={editable}
                />
              </section>
            )}
          </div>
        </div>

        <aside className="col sh-aside" aria-label={t('share.preview')}>
          {/* L11 : carte « Accès à la démo » en tête de la colonne */}
          <AccessSummary state={access} url={url} />
          <MiniPreview demoId={demo.id} previewUrl={`${url}?preview=1`} />
          <div className="card card-pad">
            <h2 className="t-label">{t('share.socialPreview')}</h2>
            <div className="sh-og">
              <div className="sh-og-img">
                <b>{demo.title}</b>
              </div>
              <div className="sh-og-txt">
                <span className="t-caption subtle">{new URL(url).host}</span>
                <p className="t-label">
                  {demo.title} · {t('share.interactiveDemo')}
                </p>
              </div>
            </div>
            <p className="help sh-help">
              {t('share.ogHelp')} <span className="badge">{t('shell.soon')}</span>
            </p>
          </div>
          <div className="card card-pad">
            <div className="row between">
              <h2 className="t-label">{t('share.thisWeek')}</h2>
              <Link to={`/demos/${demoId}/analytics`} className="t-caption">
                {t('share.seeAnalytics')}
              </Link>
            </div>
            <div className="grid sh-week">
              <div>
                <span className="t-caption muted">{t('analytics.views')}</span>
                <div className="num sh-num">{formatNumber(week?.views ?? 0)}</div>
              </div>
              <div>
                <span className="t-caption muted">{t('analytics.leads')}</span>
                <div className="num sh-num">{formatNumber(week?.leads ?? 0)}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {creating && (
        <NewLinkDialog
          variables={variables}
          publicPage={pubPage}
          members={signers}
          datasetRows={dsRows}
          demoTitle={demo.title}
          onEnablePublicPage={() => {
            setCreating(false);
            setTab('page');
          }}
          onClose={() => setCreating(false)}
          onCreate={async (name, vars, days, pp) => {
            await run(async () => {
              const created = check(
                await supabase
                  .from('share_links')
                  .insert({
                    demo_id: demoId,
                    workspace_id: demo.workspace_id,
                    name,
                    variables: vars,
                    expires_at: days ? new Date(Date.now() + days * 86400_000).toISOString() : null,
                    // L25-13 : page personnalisée (le code est tiré par la base)
                    ...(pp.enabled && pubPage.enabled
                      ? {
                          page_enabled: true,
                          page_title: pp.title.trim().slice(0, 90),
                          page_message: pp.message.trim().slice(0, 400),
                          signed_by: pp.signedBy || null,
                          dataset_row: pp.datasetRow === '' ? null : Number(pp.datasetRow),
                          cta_label: pp.ctaLabel.trim() || null,
                          cta_url: pp.ctaUrl.trim() || null,
                        }
                      : {}),
                  })
                  .select('token, page_code')
                  .single(),
              );
              // P10 : le lien créé est copié automatiquement (l'adresse de la page s'il y en a une)
              await navigator.clipboard
                ?.writeText(
                  created.page_code
                    ? personalPageUrl(demoId, created.page_code)
                    : shareLinkUrl(created.token),
                )
                .catch(() => undefined);
              setCreating(false);
              await load();
            }, t('share.linkCreatedCopied'));
          }}
        />
      )}
    </div>
  );
}

function EmbedPanel({
  url,
  title,
  published,
  editable,
  origins,
  setOrigins,
  removeBranding,
  onSaveOrigins,
}: {
  url: string;
  title: string;
  published: boolean;
  editable: boolean;
  origins: string;
  setOrigins: (v: string) => void;
  removeBranding: boolean;
  onSaveOrigins: () => void;
}) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<'responsive' | 'fixed'>('responsive');
  const safe = title.replace(/[<>"&]/g, '');
  const code =
    format === 'responsive'
      ? embedSnippet(url, title)
      : `<iframe src="${url}" title="${safe}" width="960" height="644" loading="lazy" allow="fullscreen; clipboard-write" style="border:0;border-radius:12px"></iframe>`;
  return (
    <>
      <div className="segmented" role="radiogroup" aria-label={t('share.embedFormat')}>
        <button
          type="button"
          role="radio"
          aria-checked={format === 'responsive'}
          onClick={() => setFormat('responsive')}
        >
          {t('share.responsive')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={format === 'fixed'}
          onClick={() => setFormat('fixed')}
        >
          {t('share.fixed')}
        </button>
        <button type="button" role="radio" aria-checked="false" aria-disabled="true">
          {t('share.popup')} <span className="badge sh-badge-xs">{t('shell.soon')}</span>
        </button>
      </div>
      <pre className="code sh-code">{highlightHtml(code)}</pre>
      <div className="row sh-embed-actions">
        {published ? (
          <CopyButton value={code} label={t('share.copyCode')} primary />
        ) : (
          <span className="btn btn-primary" aria-disabled="true">
            <Copy aria-hidden="true" />
            {t('share.copyCode')}
          </span>
        )}
        <span className="t-label sh-guides" aria-disabled="true">
          {t('share.guides')} <span className="badge sh-badge-xs">{t('shell.soon')}</span>
        </span>
      </div>
      <hr className="divider sh-hr" />
      <div className="setting">
        <span className="t-label">{t('share.hideBranding')}</span>
        {removeBranding ? (
          <span className="badge badge-success">{t('share.included')}</span>
        ) : (
          <Link to="/settings/plans" className="badge badge-accent">
            {t('share.upgradePlan')}
          </Link>
        )}
      </div>
      <div className="setting">
        <span className="t-label">
          {t('share.clickToStart')} <span className="badge">{t('shell.soon')}</span>
        </span>
        <span className="switch">
          <input type="checkbox" disabled aria-label={t('share.clickToStart')} />
          <span />
        </span>
      </div>
      <div className="field sh-field">
        <label htmlFor="sh-origins">{t('share.allowedOrigins')}</label>
        <textarea
          id="sh-origins"
          className="textarea"
          rows={3}
          disabled={!editable}
          placeholder={'www.exemple.org\n*.exemple.org'}
          value={origins}
          onChange={(e) => setOrigins(e.target.value)}
        />
        <span className="help">{t('share.allowedOriginsHint')}</span>
        {editable && (
          <div>
            <button type="button" className="btn btn-secondary btn-sm sh-save" onClick={onSaveOrigins}>
              {t('common.save')}
            </button>
          </div>
        )}
      </div>
      <div className="alert sh-note">
        <Info aria-hidden="true" />
        <span className="t-caption">{t('share.cspNote', { host: new URL(url).host })}</span>
      </div>
    </>
  );
}

/** Aperçu de la maquette : mini-lecteur (capture de l'étape 1) et bouton « Lancer la démo ». */
function MiniPreview({ demoId, previewUrl }: { demoId: string; previewUrl: string }) {
  const { t } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from('steps')
        .select('image_path')
        .eq('demo_id', demoId)
        .not('image_path', 'is', null)
        .order('position')
        .limit(1);
      const path = data?.[0]?.image_path;
      if (!path) return;
      const s = await supabase.storage.from('captures').createSignedUrl(path, 3600);
      if (alive) setImage(s.data?.signedUrl ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [demoId]);
  return (
    // L19b : seul le lecteur garde le thème de la démo ; le cadre suit le thème de l'app
    <div className="preview-box">
      <div className="mini-player fd-player-scope">
        <div className="bar">
          <i />
          <i />
          <i />
        </div>
        <div className="sh-screen">
          {image ? <img src={image} alt="" /> : <div className="sh-blank" />}
          <div className="sh-overlay">
            <a className="btn btn-primary sh-launch" href={previewUrl} target="_blank" rel="noreferrer">
              <Play aria-hidden="true" />
              {t('share.launch')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modale « Nouveau lien personnalisé » (PRT-05). */
function NewLinkDialog({
  variables,
  publicPage,
  members,
  datasetRows,
  demoTitle,
  onEnablePublicPage,
  onClose,
  onCreate,
}: {
  variables: Tables<'variables'>[];
  publicPage: { enabled: boolean; cta: { label: string; url: string } | null };
  members: Array<{ id: string; name: string }>;
  datasetRows: string[] | null;
  demoTitle: string;
  onEnablePublicPage: () => void;
  onClose: () => void;
  onCreate: (
    name: string,
    vars: Record<string, string>,
    days: number | null,
    pp: PersonalPageDraft,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [expires, setExpires] = useState(false);
  const [days, setDays] = useState(30);
  const [err, setErr] = useState<Record<string, string>>({});
  // L25-13 : activée par défaut si la page publique l'est
  const [pp, setPp] = useState<PersonalPageDraft>(() => emptyPersonalPage(publicPage.enabled));
  const ppErr = personalPageErrors(pp);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t('validation.required');
    for (const v of variables) {
      const val = (values[v.key] ?? '').trim();
      if (v.key.includes('email') && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val))
        errs[v.key] = t('share.invalidEmail');
    }
    setErr(errs);
    if (Object.keys(errs).length || Object.keys(ppErr).length) return;
    const vars = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
    await onCreate(name.trim(), vars, expires ? days : null, pp);
  }
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sh-link-t"
        onSubmit={submit}
        noValidate
      >
        <div className="modal-head">
          <h2 id="sh-link-t">{t('share.newLinkTitle')}</h2>
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
          <div className="field">
            <label htmlFor="sh-ln">{t('share.linkName')}</label>
            <input
              id="sh-ln"
              className="input"
              autoFocus
              maxLength={120}
              placeholder={t('share.linkNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={err.name ? true : undefined}
              aria-describedby={err.name ? 'sh-ln-e sh-ln-h' : 'sh-ln-h'}
            />
            {err.name && (
              <span className="error-msg" id="sh-ln-e">
                {err.name}
              </span>
            )}
            <span className="help" id="sh-ln-h">
              {t('share.linkNameHelp')}
            </span>
          </div>
          {variables.length > 0 && (
            <div className="grid sh-vars">
              {variables.map((v) => (
                <div key={v.id} className="field">
                  <label htmlFor={`sh-v-${v.key}`}>
                    <span className="t-mono">{`{{${v.key}}}`}</span>{' '}
                    <span className="opt">{t('plans.optional')}</span>
                  </label>
                  <input
                    id={`sh-v-${v.key}`}
                    className="input"
                    maxLength={200}
                    placeholder={v.default_value}
                    value={values[v.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                    aria-invalid={err[v.key] ? true : undefined}
                  />
                  {err[v.key] && <span className="error-msg">{err[v.key]}</span>}
                  {v.key === 'email' && <span className="help">{t('share.pp.emailHelp')}</span>}
                </div>
              ))}
            </div>
          )}
          <PersonalPageFields
            draft={pp}
            onChange={setPp}
            publicPage={publicPage}
            members={members}
            datasetRows={datasetRows}
            values={values}
            demoTitle={demoTitle}
            onEnablePublicPage={onEnablePublicPage}
            errors={ppErr}
          />
          <div className="setting sh-exp">
            <span className="t-label">{t('share.expiration')}</span>
            <span className="switch">
              <input
                type="checkbox"
                aria-label={t('share.expiration')}
                checked={expires}
                onChange={(e) => setExpires(e.target.checked)}
              />
              <span />
            </span>
          </div>
          {expires && (
            <div className="field">
              <label htmlFor="sh-days">{t('share.expiresAfter')}</label>
              <select
                id="sh-days"
                className="select"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {[7, 30, 90].map((d) => (
                  <option key={d} value={d}>
                    {t('share.expiresIn', {
                      count: d,
                      date: formatDate(new Date(Date.now() + d * 86400_000).toISOString()),
                    })}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t('share.createAndCopy')}
          </button>
        </div>
      </form>
    </div>
  );
}
