import {
  AtSign,
  Blocks,
  Braces,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  Code,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  GraduationCap,
  ImagePlay,
  Info,
  KeyRound,
  Link2,
  Lock,
  Mail,
  MessageSquareText,
  Plus,
  Power,
  QrCode,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Tables } from '@flowdsiml/supabase-types';
import { extractVariableKeys } from '@flowdsiml/core';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { addressUrl, embedSnippet, personalPageUrl, publicDemoUrl, shareLinkUrl } from '../../lib/embed';
import { formatDate, formatDateTime, formatNumber, formatRelativeShort } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { Menu, type MenuItem } from '../../components/Menu';
import { asSettings } from '../editor/types';
import { AccessPanel, useDemoAccess } from './AccessPanel';
import { useShareRules } from '../../lib/shareRules';
import { downloadQrPng } from '../../lib/qrPng';
import { PublicPagePanel } from './PublicPagePanel';
import {
  PersonalPageFields,
  emptyPersonalPage,
  personalPageErrors,
  type PersonalPageDraft,
} from './PersonalPageFields';
import { AddressField } from './AddressField';
import { TargetGuide, TargetPicker, useEmbedTarget } from './EmbedGuide';
import { addressOnly, popupAllowed } from './snippets';
import { highlightHtml } from './codeBlock';
import { popupCode } from './distribute';
import { PLAYER_URL } from '../../lib/env';
import { centerLinkUrl, centerModuleOf, type CenterModule } from './centerModule';
import { ImportLinksDialog } from './ImportLinksDialog';
import { COHORT_MAX, cohorts, exportLinks, linkFromRow } from './linksCsv';
import { downloadText } from '../../lib/download';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import { Status, Select } from '@flowdsiml/ui';
import { CopyField } from '../../components/CopyField';
import { Fold } from './Fold';
import { CopyAction } from './CopyAction';
import { RadioCards } from './RadioCards';
import { useCopied } from '../../components/useCopied';
import { useEmbedSize } from './embedSize';

type Tab = 'link' | 'embed' | 'perso' | 'access' | 'export' | 'page';
/** Modes de la fenêtre Partager, tels qu'ils figurent dans l'adresse (?share=…). */
export const SHARE_MODES = ['lien', 'integrer', 'perso', 'page', 'acces', 'exporter'] as const;
export type ShareMode = (typeof SHARE_MODES)[number];
/** `menu` : à 390 px, la liste des modes seule (premier écran de la feuille). */
export type ShareView = ShareMode | 'menu';
const TAB_OF: Record<ShareMode, Tab> = {
  lien: 'link',
  integrer: 'embed',
  perso: 'perso',
  acces: 'access',
  exporter: 'export',
  page: 'page',
};
const MODE_ICON: Record<ShareMode, typeof Link2> = {
  lien: Link2,
  integrer: Code,
  perso: Users,
  acces: Lock,
  exporter: Download,
  page: Globe,
};
type LinkStats = Record<string, { views: number; last: string | null }>;

/**
 * Partager une démo (SHARE-02, retours du 24/11 2e série §1) : contenu de la fenêtre à deux volets. À
 * gauche, la liste des modes ; à droite, le mode choisi, avec en tête la pastille d'accès (l'accès est un
 * réglage unique de la démo, qui vaut pour tous les moyens de partage). Les contenus des modes sont ceux
 * de l'ancienne page Partager (PRT-01).
 */
export function SharePanel({
  demoId,
  view,
  onView,
  onClose,
  onPublish,
  onExport,
  justPublished = false,
}: {
  demoId: string;
  view: ShareView;
  onView: (v: ShareView) => void;
  onClose: () => void;
  /** « Exporter » : la fenêtre d'export remplace la fenêtre Partager, sur le fichier choisi. */
  onExport: (fmt: 'pdf' | 'gif' | 'mp4') => void;
  /** « Publier » du bandeau d'une démo non publiée (la publication vit dans l'éditeur). */
  onPublish: () => void;
  /** La démo vient d'être publiée : message de confirmation en tête. */
  justPublished?: boolean;
}) {
  const { t } = useTranslation();
  const { can, current } = useWorkspace();
  const rules = useShareRules(current?.id);
  const access = useDemoAccess(demoId);
  const mode: ShareMode = view === 'menu' ? 'lien' : view;
  const [demo, setDemo] = useState<Tables<'demos'> | null>(null);
  const [links, setLinks] = useState<Tables<'share_links'>[]>([]);
  const [linkStats, setLinkStats] = useState<LinkStats>({});
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  /** L17-01 : confirmation RGPD enregistrée avec la version en ligne (auteur et date). */
  const [ack, setAck] = useState<{ name: string; at: string } | null>(null);
  const [variables, setVariables] = useState<Tables<'variables'>[]>([]);
  /** REV-10 : variables réellement présentes dans les textes de la démo, dans l'ordre d'apparition. */
  const [usedKeys, setUsedKeys] = useState<string[]>([]);
  /** L28-01 : adresse personnalisée courante (null : aucune, le lien utilise l'identifiant). */
  const [address, setAddress] = useState<string | null>(null);
  // L25-13 : page publique (activée, bouton), membres (signature), lignes du jeu de données
  const [pubPage, setPubPage] = useState<{ enabled: boolean; cta: { label: string; url: string } | null }>({
    enabled: false,
    cta: null,
  });
  const [signers, setSigners] = useState<Array<{ id: string; name: string }>>([]);
  const [dsRows, setDsRows] = useState<string[] | null>(null);
  const [origins, setOrigins] = useState('');
  /** L38-1 : module d'une formation publiée dans le centre (le lien du centre passe alors en premier). */
  const [centerModule, setCenterModule] = useState<CenterModule | null>(null);
  /** L38-3 : groupes déjà utilisés dans l'espace (suggestions) ; L38-2 : import d'une liste. */
  const [cohortList, setCohortList] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  /** L38-7 : formations de l'espace et leurs modules (bloc « Formation »). */
  const tab: Tab = TAB_OF[mode];
  const [msgCopied, copyMsg] = useCopied();
  // Adresse d'une page personnalisée copiée depuis le menu ⋯ : confirmée sous la liste, sans toast
  const [pageCopied, copyPage] = useCopied();
  const [persoQ, setPersoQ] = useState('');
  const needle = persoQ.trim().toLocaleLowerCase();
  const shownLinks = needle
    ? links.filter((l) =>
        [l.name, l.cohort, ...Object.values((l.variables as Record<string, string>) ?? {})]
          .filter(Boolean)
          .some((v) => String(v).toLocaleLowerCase().includes(needle)),
      )
    : links;
  const [creating, setCreating] = useState(false);
  const [exportFmt, setExportFmt] = useState<'pdf' | 'gif' | 'mp4'>('pdf');
  const { error, run } = useAction();
  const editable = can('demo.edit');

  /** L38-2 : liens exportés en CSV (lien du centre pour un module de formation). */
  const exportCsv = (rows: Pick<Tables<'share_links'>, 'name' | 'variables' | 'cohort' | 'token'>[]) =>
    downloadText(
      t('share.import.exportFile'),
      exportLinks(
        rows.map((l) => ({
          name: l.name,
          email: ((l.variables as Record<string, string>) ?? {}).email ?? '',
          cohort: l.cohort,
          center: centerModule ? centerLinkUrl(PLAYER_URL, centerModule.slug, l.token) : null,
          demo: shareLinkUrl(l.token),
        })),
        {
          name: t('share.linkNameShort'),
          email: t('share.import.col.email'),
          cohort: t('share.cohort'),
          center: t('share.centerLink'),
          demo: t('share.import.demoLink'),
        },
      ),
    );

  const load = useCallback(async () => {
    const d = await supabase.from('demos').select('*').eq('id', demoId).maybeSingle();
    setDemo(d.data);
    if (!d.data) return;
    setOrigins((asSettings(d.data.settings).allowedEmbedOrigins ?? []).join('\n'));
    const [l, v, vars] = await Promise.all([
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
    ]);
    const list = l.data ?? [];
    setLinks(list);
    const [center, paths, mods, groups] = await Promise.all([
      supabase
        .from('training_centers')
        .select('slug, published')
        .eq('workspace_id', d.data.workspace_id)
        .maybeSingle(),
      supabase.from('paths').select('id, title').eq('workspace_id', d.data.workspace_id),
      supabase
        .from('path_modules')
        .select('path_id, demo_id, position')
        .eq('workspace_id', d.data.workspace_id),
      supabase.from('share_links').select('cohort').eq('workspace_id', d.data.workspace_id).neq('cohort', ''),
    ]);
    setCenterModule(centerModuleOf(center.data, paths.data ?? [], mods.data ?? [], demoId));
    setCohortList(cohorts((groups.data ?? []).map((g) => g.cohort)));
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
    const ad = await supabase
      .from('demo_addresses')
      .select('address')
      .eq('demo_id', demoId)
      .is('retired_at', null)
      .maybeSingle();
    setAddress(ad.data?.address ?? null);
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

  // Pendant le chargement, la fenêtre garde un nom (aria-labelledby="shd-title" de ShareDialog)
  if (!demo)
    return (
      <>
        <h2 id="shd-title" className="sr-only">
          {t('share.title')}
        </h2>
        <Loading />
      </>
    );
  const published = demo.status === 'published';
  const url = publicDemoUrl(demo.id);
  // L28-01 : le lien public et ses partages prennent l'adresse personnalisée ; intégrations, liens
  // personnalisés et paquets gardent l'identifiant
  const publicUrl = address ? addressUrl(address) : url;
  const publicLinksOff = current?.public_links_enabled === false;
  const paramExample = usedKeys
    .slice(0, 2)
    .map((k, i) => [i ? '&' : '?', `${k}=`, variables.find((v) => v.key === k)?.default_value || k] as const);

  // Planche 2 : envoi impossible (démo non publiée, ou accès « Sur invitation ») : boutons grisés, raison
  // dans l'infobulle
  const canSend = published && access.access.mode !== 'invite';
  const sendOff = !published ? t('share.publishToSend') : t('share.inviteNoSend');
  /** « Envoyer par message » : partage du système s'il existe, sinon message prêt à envoyer copié. */
  const sendMessage = async () => {
    const text = t('share.messageText', { title: demo.title, url: publicUrl });
    if (typeof navigator.share === 'function') {
      try {
        return await navigator.share({ title: demo.title, text });
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    await copyMsg(text);
  };
  const AccessIcon =
    access.access.mode === 'password'
      ? KeyRound
      : access.access.mode === 'invite'
        ? Mail
        : access.access.mode === 'domain'
          ? AtSign
          : Globe;
  // « Page de la démo » : la page propre à la démo (à ne pas confondre avec le catalogue public de
  // l'espace) ; « Fichiers » : l'export produit un fichier, hors de l'accès
  const groups: Array<{ label?: string; modes: ShareMode[] }> = [
    { modes: ['lien', 'integrer', 'perso', 'page', 'acces'] },
    { label: t('share.group.files'), modes: ['exporter'] },
  ];

  return (
    <div className={`mk sh shd${view === 'menu' ? ' is-menu' : ''}`}>
      <aside className="shd-side">
        <div className="shd-head">
          <span className="shd-tile" aria-hidden="true">
            <Share2 />
          </span>
          <div className="shd-head__txt">
            <h2 id="shd-title" title={t('share.windowTitle', { title: demo.title })}>
              {t('share.windowTitle', { title: demo.title })}
            </h2>
            <p>
              {published && publishedAt
                ? t('share.publishedShort', {
                    // Sans l'année pour l'année en cours (« Publiée le 24 nov. »), comme la barre de démo
                    date: formatDate(publishedAt, {
                      day: 'numeric',
                      month: 'short',
                      ...(new Date(publishedAt).getFullYear() === new Date().getFullYear()
                        ? {}
                        : { year: 'numeric' }),
                    }),
                  })
                : t('share.notYetPublished')}
            </p>
          </div>
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon shd-close shd-close--side"
            aria-label={t('common.close')}
            title={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <nav className="shd-nav" aria-label={t('share.mode')}>
          {groups.map((g) => (
            <div key={g.label ?? 'main'} className="shd-nav__group" role="group" aria-label={g.label}>
              {g.label && (
                <span className="shd-nav__label" aria-hidden="true">
                  {g.label}
                </span>
              )}
              {g.modes.map((m) => {
                const Icon = MODE_ICON[m];
                return (
                  <button
                    key={m}
                    type="button"
                    className="shd-nav__item"
                    aria-current={view === m ? 'page' : undefined}
                    onClick={() => onView(m)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{t(`share.modeName.${m}`)}</span>
                    <ChevronRight className="shd-nav__go" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <div className="shd-main">
        <header className="shd-top">
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon shd-back"
            aria-label={t('share.backToModes')}
            title={t('share.backToModes')}
            onClick={() => onView('menu')}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <h3 id="shd-mode" tabIndex={-1}>
            {t(`share.modeName.${mode}`)}
          </h3>
          {/* L'accès vaut pour tous les moyens de partage : il est rappelé en tête de chaque mode */}
          {mode !== 'acces' && mode !== 'lien' && (
            <span className="shd-access">
              <AccessIcon aria-hidden="true" />
              <span className="shd-access__txt">{t(`access.mode.${access.access.mode}`)}</span>
              {editable && (
                <button type="button" className="fd-btn fd-btn--sm" onClick={() => onView('acces')}>
                  {t('share.editAccess')}
                </button>
              )}
            </span>
          )}
          <button
            type="button"
            className="fd-btn fd-btn--ghost fd-btn--icon shd-close"
            aria-label={t('common.close')}
            title={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="shd-body" aria-labelledby="shd-mode" role="region">
          {!published && (
            <div className="shd-banner" role="status">
              <Info aria-hidden="true" />
              <span>{t('share.publishToEnable')}</span>
              {editable && (
                <button type="button" className="fd-btn fd-btn--primary fd-btn--sm" onClick={onPublish}>
                  {t('publish.publish')}
                </button>
              )}
            </div>
          )}
          {published && ack && (
            <p className="muted sh-sub sh-ack">
              <ShieldCheck size={14} aria-hidden="true" />
              {t('share.ackLine', { name: ack.name, date: formatDateTime(ack.at) })}
            </p>
          )}
          {justPublished && (
            <div className="alert alert-success sh-alert" role="status">
              {t('share.justPublished')}
            </div>
          )}
          {error && (
            <div className="alert alert-danger sh-alert" role="alert">
              {error}
            </div>
          )}
          <div className="shd-panel">
            {tab === 'link' && (
              <section id="sh-panel-link" aria-labelledby="shd-mode">
                {publicLinksOff && (
                  <div className="alert sh-note">
                    <Info aria-hidden="true" />
                    <span>{t('share.publicLinksOff')}</span>
                  </div>
                )}
                {/*
                  Retours client, planche 2 : bandeau d'accès, Lien de la démo, envoi en trois boutons icône
                  (infobulles), Adresse personnalisée, Paramètres d'URL. Libellé → contrôle → aide à 8 px,
                  24 px entre les sections.
                */}
                <div className="shl-secs">
                  <div className="shl-access">
                    <span className="shl-access__tile">
                      <AccessIcon aria-hidden="true" />
                    </span>
                    <span className="shl-access__tx">
                      <b>{t(`access.mode.${access.access.mode}`)}</b>
                      <small>{t(`access.modeHelp.${access.access.mode}`)}</small>
                      {editable && (
                        <button
                          type="button"
                          className="link-button shl-access__link"
                          onClick={() => onView('acces')}
                        >
                          {t('share.changeAccess')}
                        </button>
                      )}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        className="fd-btn fd-btn--sm shl-access__btn"
                        onClick={() => onView('acces')}
                      >
                        {t('share.changeAccess')}
                      </button>
                    )}
                  </div>
                  <div className="shl-sec">
                    <span className="shl-label" aria-hidden="true">
                      {t('share.demoLink')}
                    </span>
                    <div className="shl-link">
                      <CopyField
                        id="sh-pub"
                        label={t('share.demoLink')}
                        value={publicUrl}
                        copyLabel={t('share.copyLink')}
                        copiedText={t('common.copied')}
                        disabled={!published}
                      />
                      {published ? (
                        <a
                          className="fd-btn fd-btn--icon"
                          href={publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t('share.openLink')}
                        >
                          <ExternalLink size={16} aria-hidden="true" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="fd-btn fd-btn--icon"
                          aria-disabled="true"
                          aria-label={t('share.openLink')}
                          data-tip={t('share.publishToSend')}
                        >
                          <ExternalLink size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="shl-acts" role="group" aria-label={t('share.elsewhere')}>
                      {canSend ? (
                        <a
                          className="fd-btn fd-btn--icon"
                          href={`mailto:?subject=${encodeURIComponent(demo.title)}&body=${encodeURIComponent(publicUrl)}`}
                          aria-label={t('share.byEmail')}
                        >
                          <Mail size={16} aria-hidden="true" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="fd-btn fd-btn--icon"
                          aria-disabled="true"
                          aria-label={t('share.byEmail')}
                          data-tip={sendOff}
                        >
                          <Mail size={16} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="fd-btn fd-btn--icon"
                        aria-label={t('share.byMessage')}
                        data-tip={canSend ? undefined : sendOff}
                        aria-disabled={canSend ? undefined : 'true'}
                        onClick={() => canSend && void sendMessage()}
                      >
                        {msgCopied ? (
                          <Check size={16} aria-hidden="true" />
                        ) : (
                          <MessageSquareText size={16} aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="fd-btn fd-btn--icon"
                        aria-label={t('share.qrDownload')}
                        data-tip={canSend ? undefined : sendOff}
                        aria-disabled={canSend ? undefined : 'true'}
                        onClick={() => canSend && void downloadQrPng(publicUrl, `${t('share.qrFile')}.png`)}
                      >
                        <QrCode size={16} aria-hidden="true" />
                      </button>
                      {/* Confirmation sur place (pas de toast) : toujours présente, annoncée poliment */}
                      <span className="shl-ok" role="status">
                        {msgCopied ? t('common.copied') : ''}
                      </span>
                    </div>
                  </div>
                  {/* L28-01 : adresse personnalisée (#/l/<partie lisible>-<suffixe>) */}
                  <div className="shl-sec">
                    <AddressField
                      demoId={demo.id}
                      editable={editable}
                      address={address}
                      onSaved={setAddress}
                    />
                  </div>
                  <div className="shd-folds">
                    <Fold icon={<Braces aria-hidden="true" />} title={t('share.urlParamsShort')}>
                      <h4 className="sr-only" id="sh-params-h">
                        {t('share.urlParams')}
                      </h4>
                      {/* §18.7 : l'adresse revient à la ligne (pas de zone défilante) */}
                      <div className="code" role="region" aria-labelledby="sh-params-h">
                        {publicUrl}
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
                    </Fold>
                  </div>
                </div>
              </section>
            )}

            {tab === 'embed' && (
              <section id="sh-panel-embed" aria-labelledby="shd-mode">
                <EmbedPanel
                  url={publicUrl}
                  demoId={demo.id}
                  title={demo.title}
                  published={published}
                  editable={editable}
                  origins={origins}
                  setOrigins={setOrigins}
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
              <section id="sh-panel-perso" aria-labelledby="shd-mode">
                {/* §1.3 : mode sobre. Recherche, liste (destinataire, date, vues) ; « Créer un lien » et
                    « Importer (CSV) » sous la liste. */}
                {links.length > 0 && (
                  <div className="shp-top">
                    <div className="shp-search">
                      <Search aria-hidden="true" />
                      <input
                        id="sh-perso-q"
                        type="search"
                        className="input"
                        aria-label={t('share.persoSearch')}
                        placeholder={t('share.persoSearch')}
                        value={persoQ}
                        onChange={(e) => setPersoQ(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="fd-btn fd-btn--icon"
                      aria-label={t('share.import.exportAll')}
                      title={t('share.import.exportAll')}
                      onClick={() => exportCsv(links)}
                    >
                      <Download size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {centerModule && (
                  <p className="sh-center-note" role="note">
                    <GraduationCap aria-hidden="true" />
                    <span>
                      {t('share.centerNotice', {
                        position: centerModule.position,
                        path: centerModule.pathTitle,
                      })}
                    </span>
                  </p>
                )}
                {links.length === 0 ? (
                  <p className="muted sh-empty">{t('share.noLinks')}</p>
                ) : shownLinks.length === 0 ? null : (
                  <div className="table-wrap">
                    <table className={`table sh-links${centerModule ? ' has-center' : ''}`}>
                      <caption className="sr-only">{t('share.tab.perso')}</caption>
                      <thead>
                        <tr>
                          <th>{t('share.persoRecipient')}</th>
                          <th className="shp-date">{t('share.persoCreated')}</th>
                          <th className="r">{t('analytics.views')}</th>
                          <th>
                            <span className="sr-only">{t('members.actions')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownLinks.map((l) => {
                          const vars = Object.values((l.variables as Record<string, string>) ?? {}).filter(
                            Boolean,
                          );
                          const expired = l.expires_at && Date.parse(l.expires_at) < Date.now();
                          const st = linkStats[l.id];
                          const hasPage = !!(l.page_enabled && l.page_code);
                          const meta = [
                            l.cohort,
                            ...vars,
                            hasPage ? t('share.pp.badgeOn') : null,
                            l.expires_at && !expired
                              ? t('share.expiresOn', {
                                  date: formatDate(l.expires_at, { day: 'numeric', month: 'short' }),
                                })
                              : null,
                          ].filter((x): x is string => !!x);
                          return (
                            <tr key={l.id} className={l.is_active && !expired ? undefined : 'sh-off'}>
                              <th scope="row" className="sh-row-h">
                                {/* Ligne 1 : le nom et sa pastille d'état ; ligne 2, atténuée, sur une seule ligne :
                                    groupe · variables · page personnalisée · expiration */}
                                <span className="shp-name">
                                  <span className="shp-name__t" title={l.name || undefined}>
                                    {l.name || '—'}
                                  </span>
                                  {(!l.is_active || expired) && (
                                    <Status size="sm" className="sh-state">
                                      {!l.is_active ? t('share.disabled') : t('share.expired')}
                                    </Status>
                                  )}
                                </span>
                                {meta.length > 0 && (
                                  <span className="shp-meta" title={meta.join(' · ')}>
                                    {l.cohort && <span className="sh-cohort-cell">{l.cohort}</span>}
                                    {meta.slice(l.cohort ? 1 : 0).map((m) => (
                                      <span key={m}>{m}</span>
                                    ))}
                                  </span>
                                )}
                              </th>
                              <td className="shp-date">
                                {formatDate(l.created_at, { day: 'numeric', month: 'short' })}
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
                                  {centerModule && (
                                    <CopyAction
                                      className="btn btn-secondary btn-sm"
                                      label={t('share.centerLinkOf', { name: l.name || '—' })}
                                      title={t('share.centerLinkOf', { name: l.name || '—' })}
                                      text={centerLinkUrl(PLAYER_URL, centerModule.slug, l.token)}
                                      icon={<GraduationCap aria-hidden="true" />}
                                    >
                                      {t('share.centerLink')}
                                    </CopyAction>
                                  )}
                                  <CopyAction
                                    className="btn btn-ghost btn-sm btn-icon"
                                    label={
                                      centerModule
                                        ? t('share.demoLinkOf', { name: l.name || '—' })
                                        : t('share.copyLinkOf', { name: l.name || '—' })
                                    }
                                    title={
                                      centerModule
                                        ? t('share.demoLinkOf', { name: l.name || '—' })
                                        : undefined
                                    }
                                    text={shareLinkUrl(l.token)}
                                  />
                                  {(editable || hasPage) && (
                                    <Menu
                                      label={t('members.actionsFor', { name: l.name || '—' })}
                                      items={[
                                        // L25-13 : adresse de la page personnalisée (/p/<démo>/<code>)
                                        ...(hasPage
                                          ? [
                                              {
                                                label: t('share.pp.copyPageShort'),
                                                icon: <Copy />,
                                                onSelect: () =>
                                                  void copyPage(personalPageUrl(demoId, l.page_code!)),
                                              },
                                            ]
                                          : []),
                                        ...(editable
                                          ? ([
                                              ...(hasPage ? (['separator'] as const) : []),
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
                                                      await supabase
                                                        .from('share_links')
                                                        .delete()
                                                        .eq('id', l.id),
                                                    );
                                                    await load();
                                                  }),
                                              },
                                            ] as Array<MenuItem | 'separator'>)
                                          : []),
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
                <p className="shl-ok shp-copied" role="status">
                  {pageCopied ? t('share.pp.pageCopied') : ''}
                </p>
                {links.length > 0 && shownLinks.length === 0 && (
                  <p className="muted sh-empty" role="status">
                    {t('share.persoNoMatch')}
                  </p>
                )}
                {editable && (
                  <div className="shp-foot">
                    <button
                      type="button"
                      className="fd-btn fd-btn--primary"
                      onClick={() => setCreating(true)}
                    >
                      <Plus aria-hidden="true" />
                      {t('share.newLink')}
                    </button>
                    <button type="button" className="fd-btn" onClick={() => setImporting(true)}>
                      <Upload aria-hidden="true" />
                      {t('share.import.open')}
                    </button>
                  </div>
                )}
              </section>
            )}

            {tab === 'access' && (
              <>
                <p className="help shd-scope">{t('share.accessScope')}</p>
                <AccessPanel demoId={demo.id} state={access} editable={can('demo.edit')} />
              </>
            )}
            {tab === 'page' && (
              <section id="sh-panel-page" aria-labelledby="shd-mode">
                <PublicPagePanel
                  demoId={demo.id}
                  demoTitle={demo.title}
                  published={published}
                  protectedAccess={access.access.mode !== 'link'}
                  editable={editable}
                />
              </section>
            )}
            {tab === 'export' && (
              <section id="sh-panel-export" aria-labelledby="shd-mode">
                {/* §1.3 : trois fichiers en cartes radio ; un seul « Exporter », avec la mise en garde à sa
                    gauche. Les réglages du fichier (langue, format, résolution, délai), l'aperçu et
                    l'avancement sont dans la fenêtre d'export. */}
                <RadioCards
                  className="shx-formats"
                  label={t('share.exportFormat')}
                  value={exportFmt}
                  onChange={setExportFmt}
                  options={[
                    {
                      value: 'pdf',
                      label: t('share.exportPdf'),
                      art: <FileText className="shx-art" />,
                    },
                    {
                      value: 'gif',
                      label: t('share.exportGif'),
                      art: <ImagePlay className="shx-art" />,
                    },
                    {
                      value: 'mp4',
                      label: t('share.exportMp4'),
                      art: <Clapperboard className="shx-art" />,
                    },
                  ]}
                />
                <p className="help shx-what">{t(`share.exportWhat_${exportFmt}`)}</p>
                <div className="shx-foot">
                  <p className="help">{t('share.exportHelp')}</p>
                  {/* L27 : exports hors de l'app interdits par les règles de l'espace */}
                  <button
                    type="button"
                    className="fd-btn fd-btn--primary"
                    aria-disabled={rules.exports_allowed ? undefined : true}
                    title={rules.exports_allowed ? undefined : t('rules.errExports')}
                    onClick={() => rules.exports_allowed && onExport(exportFmt)}
                  >
                    <Download aria-hidden="true" />
                    {t('share.exportGo')}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
      {creating && (
        <NewLinkDialog
          variables={variables}
          publicPage={pubPage}
          members={signers}
          datasetRows={dsRows}
          demoTitle={demo.title}
          cohortList={cohortList}
          onEnablePublicPage={() => {
            setCreating(false);
            onView('page');
          }}
          onClose={() => setCreating(false)}
          onCreate={async (name, vars, days, pp, cohort) => {
            await run(
              async () => {
                const created = check(
                  await supabase
                    .from('share_links')
                    .insert({
                      demo_id: demoId,
                      workspace_id: demo.workspace_id,
                      name,
                      variables: vars,
                      cohort,
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
                // P10 : le lien créé est copié automatiquement : L38-1 celui du centre pour un module de
                // formation, sinon l'adresse de la page s'il y en a une, sinon le lien de la démo
                await navigator.clipboard
                  ?.writeText(
                    centerModule
                      ? centerLinkUrl(PLAYER_URL, centerModule.slug, created.token)
                      : created.page_code
                        ? personalPageUrl(demoId, created.page_code)
                        : shareLinkUrl(created.token),
                  )
                  .catch(() => undefined);
                setCreating(false);
                await load();
              },
              t(centerModule ? 'share.centerLinkCreated' : 'share.linkCreatedCopied'),
            );
          }}
        />
      )}
      {importing && (
        <ImportLinksDialog
          existing={
            new Set(
              links
                .map((l) => (((l.variables as Record<string, string>) ?? {}).email ?? '').toLowerCase())
                .filter(Boolean),
            )
          }
          cohortList={cohortList}
          onClose={() => setImporting(false)}
          onExport={(tokens) => exportCsv(links.filter((l) => tokens.includes(l.token)))}
          onImport={async (rows) => {
            let tokens: string[] = [];
            await run(async () => {
              const made = check(
                await supabase
                  .from('share_links')
                  .insert(
                    rows.map((r) => ({
                      demo_id: demoId,
                      workspace_id: demo.workspace_id,
                      ...linkFromRow(r),
                    })),
                  )
                  .select('token'),
              );
              tokens = made.map((m) => m.token);
              await load();
            });
            return tokens;
          }}
        />
      )}
    </div>
  );
}

function EmbedPanel({
  url,
  demoId,
  title,
  published,
  editable,
  origins,
  setOrigins,
  onSaveOrigins,
}: {
  url: string;
  demoId: string;
  title: string;
  published: boolean;
  editable: boolean;
  origins: string;
  setOrigins: (v: string) => void;
  onSaveOrigins: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [format, setFormat] = useState<'responsive' | 'popup' | 'full'>('responsive');
  // Encadré : taille automatique (suit la largeur de la page) ou fixe, en pixels ; gardée par démo
  const [size, setSize] = useEmbedSize(demoId);
  const [copied, copyValue] = useCopied();
  // L29-01 : outil cible ; l'adresse personnalisée (L28-01) est reprise si elle existe
  const [target, setTarget] = useEmbedTarget();
  const limitId = useId();
  const popupOff = !popupAllowed(target);
  const mode = popupOff && format === 'popup' ? 'responsive' : format;
  const safe = title.replace(/[<>"&]/g, '');
  const code =
    mode === 'popup'
      ? popupCode(PLAYER_URL, demoId, {
          clickToStart: false,
          lang: null,
          label: t('share.popupLabel'),
          float: false,
        })
      : mode === 'full'
        ? `<iframe src="${url}" title="${safe}" loading="lazy" allow="fullscreen; clipboard-write" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`
        : size.fixed
          ? `<iframe src="${url}" title="${safe}" width="${size.width}" height="${size.height}" loading="lazy" allow="fullscreen; clipboard-write" style="border:0;border-radius:12px"></iframe>`
          : embedSnippet(url, title);
  // L29-01 : certains outils ne prennent qu'une adresse
  const onlyAddress = addressOnly(target);
  const value = onlyAddress ? url : code;
  const host = new URL(url).host;
  return (
    <>
      {/* §1.3 : mode Intégrer sobre. Trois formats en cartes radio, le code, sa copie, un aperçu ; l'outil
          cible et les sites autorisés sont des réglages rares, repliés. */}
      <RadioCards
        className="she-formats"
        label={t('share.embedFormat')}
        value={mode}
        onChange={setFormat}
        options={[
          {
            value: 'responsive',
            label: t('share.embedFrame'),
            art: <span className="she-art she-art--frame" />,
          },
          {
            value: 'popup',
            label: t('share.embedButton'),
            art: <span className="she-art she-art--button" />,
            // L29-02 : jamais masqué ; désactivé pour un outil sans script, la limite sert d'aide
            disabled: popupOff,
            describedBy: limitId,
            hint: popupOff ? t(`snippets.limit_${target}`, { host }) : undefined,
          },
          { value: 'full', label: t('share.embedFull'), art: <span className="she-art she-art--full" /> },
        ]}
      />
      {mode === 'responsive' && (
        <div className="she-size">
          <div className="she-size__row">
            <span className="t-label" id="she-size-l">
              {t('share.embedSize')}
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="she-size-l">
              <button
                type="button"
                role="radio"
                aria-checked={!size.fixed}
                onClick={() => setSize({ ...size, fixed: false })}
              >
                {t('share.embedSizeAuto')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={size.fixed}
                onClick={() => setSize({ ...size, fixed: true })}
              >
                {t('share.embedSizeFixed')}
              </button>
            </div>
            {size.fixed && (
              <div className="she-size__px">
                {(['width', 'height'] as const).map((k) => (
                  <label key={k} className="she-size__f">
                    <span>{t(`share.embedSize_${k}`)}</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      value={String(size[k])}
                      aria-describedby="she-size-u"
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(/\D/g, '').slice(0, 4));
                        setSize({ ...size, [k]: n });
                      }}
                      onBlur={() => setSize({ ...size, [k]: Math.min(4000, Math.max(200, size[k])) })}
                    />
                  </label>
                ))}
                <span className="help" id="she-size-u">
                  {t('share.embedSizeUnit')}
                </span>
              </div>
            )}
          </div>
          {/* « Bientôt » : en gris, jamais caché */}
          <p className="she-soon" aria-disabled="true">
            <span title={t('share.clickToStartHint')}>{t('share.clickToStart')}</span>
            <span className="fd-badge">{t('shell.soon')}</span>
          </p>
        </div>
      )}
      <pre
        className="code sh-code she-code"
        aria-label={onlyAddress ? t('snippets.addressLabel') : t('snippets.codeLabel')}
        tabIndex={0}
      >
        {onlyAddress ? value : highlightHtml(value)}
      </pre>
      <div className="row sh-embed-actions">
        <button
          type="button"
          className="fd-btn fd-btn--primary"
          aria-disabled={!published || undefined}
          title={published ? undefined : t('share.publishFirst')}
          onClick={() => published && void copyValue(value)}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t('common.copied') : onlyAddress ? t('snippets.copyAddress') : t('snippets.copyCode')}
        </button>
        <span className="sr-only" role="status">
          {copied ? t('common.copied') : ''}
        </span>
      </div>
      <div className={`she-prev she-prev--${mode}`} role="img" aria-label={t(`share.embedPreview_${mode}`)}>
        <span className="she-prev__page">
          <span className="she-prev__demo" />
        </span>
      </div>
      <div className="shd-folds">
        <Fold
          icon={<Blocks aria-hidden="true" />}
          title={t('share.embedTool')}
          defaultOpen={target !== 'html'}
        >
          <div className="fd-stack fd-stack--group">
            <TargetPicker value={target} onChange={setTarget} />
            <TargetGuide
              codeless
              target={target}
              code={code}
              address={url}
              published={published}
              limitId={limitId}
              playerHost={host}
              onScorm={() => navigate(`/demos/${demoId}/distribute`)}
            />
          </div>
        </Fold>
        <Fold icon={<ShieldCheck aria-hidden="true" />} title={t('share.embedSites')}>
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
            {/* L45 (E14) : aide → « Enregistrer » à 12 px */}
            <div className="fd-stack fd-stack--action">
              <span className="help">
                {t('share.allowedOriginsHint')} {t('share.cspNote', { host })}
              </span>
              {editable && (
                <button type="button" className="fd-btn fd-btn--sm sh-save" onClick={onSaveOrigins}>
                  {t('common.save')}
                </button>
              )}
            </div>
          </div>
        </Fold>
      </div>
    </>
  );
}

/** Modale « Nouveau lien personnalisé » (PRT-05). */
function NewLinkDialog({
  variables,
  publicPage,
  members,
  datasetRows,
  demoTitle,
  cohortList,
  onEnablePublicPage,
  onClose,
  onCreate,
}: {
  variables: Tables<'variables'>[];
  cohortList: string[];
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
    cohort: string,
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [cohort, setCohort] = useState('');
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
    await onCreate(name.trim(), vars, expires ? days : null, pp, cohort.trim().replace(/\s+/g, ' '));
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
                <CircleAlert aria-hidden="true" />
                {err.name}
              </span>
            )}
            <span className="help" id="sh-ln-h">
              {t('share.linkNameHelp')}
            </span>
          </div>
          {/* L38-3 : groupe (session de formation), avec les groupes existants en suggestion */}
          <div className="field">
            <label htmlFor="sh-cohort">
              {t('share.cohort')} <span className="opt">{t('plans.optional')}</span>
            </label>
            <input
              id="sh-cohort"
              className="input"
              list="sh-cohort-l"
              maxLength={COHORT_MAX}
              placeholder={t('share.cohortPlaceholder')}
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
            />
            <datalist id="sh-cohort-l">
              {cohortList.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
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
                  {err[v.key] && (
                    <span className="error-msg">
                      <CircleAlert aria-hidden="true" />
                      {err[v.key]}
                    </span>
                  )}
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
              <Select id="sh-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[7, 30, 90].map((d) => (
                  <option key={d} value={d}>
                    {t('share.expiresIn', {
                      count: d,
                      date: formatDate(new Date(Date.now() + d * 86400_000).toISOString()),
                    })}
                  </option>
                ))}
              </Select>
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
