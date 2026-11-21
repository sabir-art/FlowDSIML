/**
 * L16 : modale « Diffuser » (maquette reference/diffusion.html, spec l16-diffusion.md). Onglets SCORM,
 * Intranet, E-mail et « Où elle est diffusée ». Aucun envoi par TutoClick : paquet téléchargé, code à
 * coller, lien mailto. Réservée aux propriétaires, admins et éditeurs.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CircleCheck,
  Copy,
  Download,
  Globe,
  Info,
  Layers,
  Link2,
  Mail,
  Package,
  Pencil,
  RefreshCw,
  Send,
  Share2,
  X,
} from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { parseManifest, type Manifest } from '@flowdsiml/manifest';
import { supabase } from '../../lib/supabase';
import { check } from '../../lib/useAction';
import { addressUrl, publicDemoUrl } from '../../lib/embed';
import { TargetGuide, TargetPicker, useEmbedTarget } from './EmbedGuide';
import { addressOnly, popupAllowed } from './snippets';
import { PLAYER_URL, SUPABASE_URL } from '../../lib/env';
import { formatDate, formatNumber, formatRelativeShort } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';
import { asSettings } from '../editor/types';
import { useDemoEditor } from '../editor/useDemoEditor';
import { PublishButton } from '../editor/PublishButton';
import { download } from '../export/exportData';
import { useDemoAccess } from './AccessPanel';
import { canPublishWith, useShareRules } from '../../lib/shareRules';
import { highlightHtml } from './codeBlock';
import {
  embedUrl,
  embedViews,
  hostOf,
  iframeCode,
  listDiffusions,
  MAIL_MAX,
  mailtoHref,
  originAllowed,
  parseRecipients,
  popupCode,
  recordDiffusion,
  type Diffusion,
  type Tab,
} from './distribute';
import { clearScormJob, getScormJob, startScormJob, useScormJob } from './scormJobs';
import type { PassCriterion, ScormOptions, ScormVersion } from './scormPackage';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import './distribute.css';
import { Status } from '@flowdsiml/ui';

interface Info {
  demo: Tables<'demos'>;
  version: { id: string; number: number; published_at: string | null } | null;
  manifest: Manifest | null;
  allowed: string[];
}

interface ScormSettings {
  version: ScormVersion;
  criterion: 'steps' | 'quiz';
  min: number;
  stats: boolean;
}

const TABS: Array<{ id: Tab; icon: ReactNode }> = [
  { id: 'scorm', icon: <Package aria-hidden="true" /> },
  { id: 'intranet', icon: <Globe aria-hidden="true" /> },
  { id: 'mail', icon: <Mail aria-hidden="true" /> },
  { id: 'where', icon: <Share2 aria-hidden="true" /> },
];

const tabKey = (demoId: string) => `fd.l16.tab.${demoId}`;
function readTab(demoId: string): Tab {
  try {
    const v = localStorage.getItem(tabKey(demoId));
    return v === 'intranet' || v === 'mail' || v === 'where' ? v : 'scorm';
  } catch {
    return 'scorm';
  }
}

const formatSize = (n: number, lang: string) => {
  const mb = n / 1_000_000;
  const fmt = (x: number) =>
    new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 1 }).format(x);
  return mb >= 1 ? `${fmt(mb)} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`;
};

/** Choix exclusif (radiogroup), comme les sélecteurs de la maquette. */
function Segmented<T extends string>({
  labelledBy,
  value,
  options,
  onChange,
}: {
  labelledBy: string;
  value: T;
  options: Array<{ id: T; label: string; disabledBy?: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          aria-disabled={o.disabledBy ? true : undefined}
          aria-describedby={o.disabledBy}
          onClick={() => !o.disabledBy && onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DistributeDialog({
  demoId,
  onClose,
  initialTab,
}: {
  demoId: string;
  onClose: () => void;
  initialTab?: Tab;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { can, current } = useWorkspace();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  // L27-08 : règles de partage (diffusion réservée aux administrateurs, exports hors de l'app)
  const rules = useShareRules(current?.id);
  const pubBlocked = !canPublishWith(rules, current?.role);
  const editor = useDemoEditor(demoId);
  const access = useDemoAccess(demoId).access;
  const [info, setInfo] = useState<Info | null>(null);
  const [tab, setTabState] = useState<Tab>(() => initialTab ?? readTab(demoId));
  const [rows, setRows] = useState<WhereRow[] | null>(null);
  const job = useScormJob(demoId);
  const running = job?.state.status === 'running';
  const [scorm, setScorm] = useState<ScormSettings | null>(null);
  const [mail, setMail] = useState<MailState | null>(null);

  const setTab = (v: Tab) => {
    setTabState(v);
    try {
      localStorage.setItem(tabKey(demoId), v);
    } catch {
      /* stockage indisponible */
    }
  };

  const load = useCallback(async () => {
    const d = await supabase.from('demos').select('*').eq('id', demoId).maybeSingle();
    if (!d.data) return setInfo(null);
    let version: Info['version'] = null;
    let manifest: Manifest | null = null;
    if (d.data.status === 'published' && d.data.current_version_id) {
      const v = await supabase
        .from('demo_versions')
        .select('id, number, published_at, manifest')
        .eq('id', d.data.current_version_id)
        .maybeSingle();
      if (v.data) {
        version = { id: v.data.id, number: v.data.number ?? 1, published_at: v.data.published_at };
        try {
          manifest = parseManifest(v.data.manifest);
        } catch {
          manifest = null;
        }
      }
    }
    setInfo({
      demo: d.data,
      version,
      manifest,
      allowed: asSettings(d.data.settings).allowedEmbedOrigins ?? [],
    });
    const quiz = manifest?.quiz?.mode === 'quiz' ? manifest.quiz : null;
    // Réglages SCORM : ceux d'une génération en cours ou terminée, sinon valeurs par défaut
    setScorm((x) => x ?? scormDefaults(getScormJob(demoId)?.opts, null, quiz?.threshold ?? null));
    setMail(
      (x) =>
        x ?? {
          to: '',
          toError: null,
          subject: t('distribute.mail.subjectDefault', { title: d.data!.title }),
          body: t('distribute.mail.bodyDefault', { title: d.data!.title, url: publicDemoUrl(demoId) }),
        },
    );
  }, [demoId, t]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // Focus sur l'onglet actif (showModal le donnerait au premier élément : le bouton Fermer)
    d?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, []);

  const published = !!info?.version;
  const modified =
    !!info?.version?.published_at &&
    Date.parse(info.demo.updated_at) > Date.parse(info.version.published_at) + 2000;

  const loadRows = useCallback(async () => {
    if (!info) return;
    setRows(await whereRows(info, current?.public_links_enabled !== false, access.expires_at));
  }, [info, current?.public_links_enabled, access.expires_at]);
  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const record = (kind: Diffusion['kind'], label: string, settings: Record<string, unknown>) => {
    if (!can('demo.edit')) return;
    void recordDiffusion(demoId, kind, label, settings).then(() => void loadRows());
  };

  const quizThreshold = info?.manifest?.quiz?.mode === 'quiz' ? info.manifest.quiz.threshold : null;
  // Changer un réglage invalide le fichier prêt (ou l'erreur) : retour à « Générer le paquet »
  const changeScorm = (patch: Partial<ScormSettings>) => {
    if (job && job.state.status !== 'running') clearScormJob(demoId);
    setScorm((x) => (x ? { ...x, ...patch } : x));
  };
  const generate = () => {
    if (!scorm) return;
    const s = scorm;
    startScormJob(
      demoId,
      { version: s.version, pass: passOf(s), stats: s.stats },
      {
        onReady: (b) =>
          record('scorm', `SCORM ${s.version} · v${b.versionNumber}`, {
            version: s.version,
            pass: passOf(s),
            stats: s.stats,
            number: b.versionNumber,
          }),
        onReadyInBackground: (b) =>
          toast(t('distribute.scorm.readyToast'), {
            label: t('distribute.scorm.download'),
            onClick: () => download(b.bytes, b.name, 'application/zip'),
          }),
      },
    );
  };

  const close = () => ref.current?.close();
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!.id;
    document.getElementById(`${id}-tab-${n}`)?.focus();
    if (published || n === 'where') setTab(n);
  };

  const title = info?.demo.title ?? '';
  const publishBtn = (label?: string) =>
    editor.demo && can('demo.publish') ? (
      <PublishButton
        editor={editor}
        republishLabel={label}
        onPublished={(n) => {
          toast(t('distribute.published', { n }));
          setTab('scorm');
          void load();
        }}
      />
    ) : null;

  const disabledTab = (v: Tab) => !published && v !== 'where';
  let body: ReactNode = null;
  let foot: ReactNode = (
    <button type="button" className="btn btn-secondary" onClick={close}>
      {t('common.close')}
    </button>
  );
  if (info && !published && tab !== 'where') {
    body = (
      <div className="empty dif-empty" role="status">
        <span className="dif-file-ic" aria-hidden="true">
          <Send />
        </span>
        <h3>{t('distribute.np.title')}</h3>
        <p className="muted">{t('distribute.np.text')}</p>
        <div className="row dif-np-actions">
          <Link className="btn btn-secondary" to={`/demos/${demoId}/edit`} onClick={close}>
            <Pencil aria-hidden="true" />
            {t('distribute.np.open')}
          </Link>
          {publishBtn()}
        </div>
      </div>
    );
  } else if (info && tab === 'scorm' && scorm) {
    body = (
      <ScormPanel
        info={info}
        s={scorm}
        change={changeScorm}
        retry={generate}
        onOpenStep={(stepId) => {
          close();
          navigate(`/demos/${demoId}/edit?step=${encodeURIComponent(stepId)}`);
        }}
      />
    );
    foot = (
      <ScormFoot
        demoId={demoId}
        close={close}
        generate={generate}
        blocked={pubBlocked || !rules.exports_allowed ? `${id}-rule` : null}
      />
    );
  } else if (info && tab === 'intranet') {
    body = (
      <IntranetPanel
        info={info}
        editable={can('demo.edit')}
        onAllowed={() => void load()}
        record={(label, settings) => record('intranet', label, settings)}
        ruled={pubBlocked ? `${id}-rule` : null}
      />
    );
  } else if (info && tab === 'mail' && mail) {
    body = <MailPanel m={mail} set={(patch) => setMail((x) => (x ? { ...x, ...patch } : x))} />;
    foot = <MailFoot m={mail} />;
  } else if (info && tab === 'where') {
    body = (
      <WherePanel
        rows={rows}
        onRegenerate={(preset) => {
          clearScormJob(demoId);
          setScorm(scormDefaults(undefined, preset, quizThreshold));
          setTab('scorm');
        }}
      />
    );
  }

  return (
    <dialog
      ref={ref}
      className="mk dif-dialog"
      aria-labelledby={`${id}-t`}
      // Échap ferme ; une génération lancée continue hors de la modale (toast à la fin)
      onClose={onClose}
    >
      <div className="modal-head">
        <div>
          <h2 id={`${id}-t`}>{t('distribute.title', { title })}</h2>
          {info && (
            <p className="dif-sub">
              {published ? (
                <>
                  <Status size="sm" tone={modified ? 'warning' : 'success'}>
                    {t(modified ? 'distribute.modified' : 'distribute.published_badge')}
                  </Status>
                  {info.version?.published_at
                    ? t('distribute.versionOn', {
                        n: info.version.number,
                        date: formatDate(info.version.published_at),
                      })
                    : t('distribute.versionN', { n: info.version?.number })}
                </>
              ) : (
                <>
                  <Status size="sm">{t('distribute.draft')}</Status>
                  {t('distribute.neverPublished')}
                </>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={t('common.close')}
          onClick={close}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="modal-body">
        <div className="tabs" role="tablist" aria-label={t('distribute.channel')} data-scroll-x="">
          {TABS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              id={`${id}-tab-${x.id}`}
              aria-controls={`${id}-panel`}
              aria-selected={tab === x.id}
              aria-disabled={disabledTab(x.id) || undefined}
              tabIndex={tab === x.id ? 0 : -1}
              onClick={() => !disabledTab(x.id) && setTab(x.id)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {x.icon}
              {t(`distribute.tab.${x.id}`)}
              {x.id === 'where' && published && rows !== null && (
                <span className="tab-count" aria-label={t('distribute.where.count', { count: rows.length })}>
                  {rows.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <section role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
          {modified && tab !== 'where' && (
            <div className="alert alert-info dif-modified" role="note">
              <Info aria-hidden="true" />
              <span>
                {t('distribute.modifiedNote', { n: info?.version?.number })}{' '}
                {publishBtn(t('distribute.publish'))}
              </span>
            </div>
          )}
          {(pubBlocked || (tab === 'scorm' && !rules.exports_allowed)) && tab !== 'where' && (
            <div className="alert alert-info dif-modified" role="note" id={`${id}-rule`}>
              <Info aria-hidden="true" />
              <span>{pubBlocked ? t('rules.errPublish') : t('rules.errExports')}</span>
            </div>
          )}
          {info ? body : <p className="muted">{t('common.loading')}</p>}
        </section>
      </div>
      {foot && <div className="modal-foot">{foot}</div>}
      {running && <span className="sr-only">{t('distribute.scorm.running')}</span>}
    </dialog>
  );
}

// ===== SCORM (L16-01 à 04) =====

const passOf = (s: ScormSettings): PassCriterion =>
  s.criterion === 'quiz' ? { kind: 'quiz', min: s.min } : { kind: 'steps' };

/** Réglages initiaux : génération en cours, sinon « Générer la version n » (mêmes réglages), sinon défauts. */
function scormDefaults(
  fromJob: ScormOptions | undefined,
  preset: Partial<ScormSettings> | null,
  quizThreshold: number | null,
): ScormSettings {
  const criterion = (fromJob?.pass.kind ?? preset?.criterion ?? 'steps') === 'quiz' && quizThreshold !== null;
  return {
    version: fromJob?.version ?? preset?.version ?? '1.2',
    criterion: criterion ? 'quiz' : 'steps',
    min: (fromJob?.pass.kind === 'quiz' ? fromJob.pass.min : undefined) ?? preset?.min ?? quizThreshold ?? 70,
    stats: fromJob?.stats ?? preset?.stats ?? false,
  };
}

function ScormPanel({
  info,
  s,
  change,
  retry,
  onOpenStep,
}: {
  info: Info;
  s: ScormSettings;
  change: (patch: Partial<ScormSettings>) => void;
  retry: () => void;
  onOpenStep: (stepId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const job = useScormJob(info.demo.id);
  const quiz = info.manifest?.quiz?.mode === 'quiz' ? info.manifest.quiz : null;
  const state = job?.state;
  const trackHost = useMemo(() => {
    try {
      return new URL(SUPABASE_URL).host;
    } catch {
      return SUPABASE_URL;
    }
  }, []);
  const rows: Array<[string, string]> = [
    [
      t('distribute.scorm.row.status'),
      s.criterion === 'quiz'
        ? t('distribute.scorm.desc.statusQuiz', { min: s.min })
        : t('distribute.scorm.desc.statusSteps'),
    ],
    ...(s.criterion === 'quiz'
      ? ([[t('distribute.scorm.row.score'), t('distribute.scorm.desc.score')]] as Array<[string, string]>)
      : []),
    [t('distribute.scorm.row.resume'), t('distribute.scorm.desc.resume')],
    [t('distribute.scorm.row.time'), t('distribute.scorm.desc.time')],
  ];
  const pct = state?.status === 'running' && state.total ? Math.round((100 * state.done) / state.total) : 0;

  return (
    <>
      {state?.status === 'running' && (
        <div className="dif-block" role="status">
          <div className="row between dif-run">
            <span className="row dif-run-l">
              <span className="spinner" aria-hidden="true" />
              <b>{t('distribute.scorm.generating')}</b>
            </span>
            {state.total > 0 && (
              <span className="t-caption muted num">
                {t('distribute.scorm.progress', { done: state.done, total: state.total })}
              </span>
            )}
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-label={t('distribute.scorm.progressLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="t-caption muted dif-run-note">{t('distribute.scorm.canClose')}</p>
        </div>
      )}
      {state?.status === 'ready' && job && (
        <div className="dif-block">
          <div className="alert alert-success" role="status">
            <CircleCheck aria-hidden="true" />
            <span>
              <b>{t('distribute.scorm.readyTitle')}</b> {t('distribute.scorm.readyText')}
            </span>
          </div>
          <div className="dif-file">
            <span className="dif-file-ic" aria-hidden="true">
              <Package />
            </span>
            <span className="grow">
              <b>{state.build.name}</b>
              <span className="t-caption muted">
                {t('distribute.scorm.fileMeta', {
                  size: formatSize(state.build.bytes.length, i18n.language),
                  version: job.opts.version,
                  n: state.build.versionNumber,
                  pass:
                    job.opts.pass.kind === 'quiz'
                      ? t('distribute.scorm.passQuiz', { min: job.opts.pass.min })
                      : t('distribute.scorm.passSteps'),
                })}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => download(state.build.bytes, state.build.name, 'application/zip')}
            >
              <Download aria-hidden="true" />
              {t('distribute.scorm.download')}
            </button>
          </div>
        </div>
      )}
      {state?.status === 'error' && (
        <div className="alert alert-danger dif-block" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>
            <b>{t('distribute.scorm.errTitle')}</b>{' '}
            {state.error.code === 'IMAGE' && state.error.step
              ? t('distribute.scorm.errImage', { n: state.error.step.n })
              : state.error.code === 'TOO_BIG'
                ? t('distribute.scorm.errSize')
                : t('distribute.scorm.errServer')}
            <span className="row dif-err-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>
                <RefreshCw aria-hidden="true" />
                {t('distribute.scorm.retry')}
              </button>
              {state.error.code === 'IMAGE' && state.error.step && (
                // L16-04 : action d'aspect lien (couleur, soulignement, crayon)
                <button
                  type="button"
                  className="mk-link-inline dif-link-btn"
                  onClick={() => onOpenStep(state.error.step!.id)}
                >
                  <Pencil aria-hidden="true" />
                  {t('distribute.scorm.openStep', { n: state.error.step.n })}
                </button>
              )}
            </span>
          </span>
        </div>
      )}
      <p className="muted dif-intro">{t('distribute.scorm.intro')}</p>
      <fieldset className="dif-fs" disabled={state?.status === 'running'}>
        <div className="dif-two">
          <div>
            <span className="t-label dif-lbl" id={`${id}-ver`}>
              {t('distribute.scorm.version')}
            </span>
            <Segmented
              labelledBy={`${id}-ver`}
              value={s.version}
              onChange={(v) => change({ version: v })}
              options={[
                { id: '1.2', label: 'SCORM 1.2' },
                { id: '2004', label: 'SCORM 2004' },
              ]}
            />
            <p className="help">{t('distribute.scorm.versionHelp')}</p>
          </div>
          <fieldset className="dif-fs dif-crit">
            <legend className="t-label dif-lbl">{t('distribute.scorm.criterion')}</legend>
            <div className="dif-radios">
              <label>
                <input
                  type="radio"
                  name={`${id}-crit`}
                  checked={s.criterion === 'steps'}
                  onChange={() => change({ criterion: 'steps' })}
                />
                <span>
                  {t('distribute.scorm.steps')}
                  <small>{t('distribute.scorm.stepsHelp')}</small>
                </span>
              </label>
              <label className={quiz ? undefined : 'is-off'}>
                <input
                  type="radio"
                  name={`${id}-crit`}
                  checked={s.criterion === 'quiz'}
                  disabled={!quiz}
                  aria-describedby={`${id}-qh`}
                  onChange={() => change({ criterion: 'quiz' })}
                />
                <span>
                  {t('distribute.scorm.quizBefore')}
                  <input
                    className="input input-sm dif-min num"
                    type="number"
                    min={1}
                    max={100}
                    value={s.min}
                    disabled={s.criterion !== 'quiz'}
                    aria-label={t('distribute.scorm.minLabel')}
                    onChange={(e) =>
                      change({ min: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 1))) })
                    }
                  />
                  %
                  <small id={`${id}-qh`}>
                    {quiz ? t('distribute.scorm.quizHelp') : t('distribute.scorm.noQuiz')}
                  </small>
                  {quiz && <small>{t('distribute.scorm.answersNote')}</small>}
                </span>
              </label>
            </div>
          </fieldset>
        </div>
        <div>
          <span className="t-label dif-lbl">{t('distribute.scorm.receives')}</span>
          <div className="table-wrap">
            <table className="table dif-map">
              <caption className="sr-only">{t('distribute.scorm.receivesCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('distribute.scorm.data')}</th>
                  <th scope="col">{t('distribute.scorm.value')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <label className="setting dif-stats">
          <span>
            <span className="t-label">{t('distribute.scorm.stats')}</span>
            <span className="help dif-help-block">
              {t('distribute.scorm.statsHelp', { host: trackHost })}
            </span>
            <span className="help dif-help-block">{t('distribute.scorm.statsPseudo')}</span>
          </span>
          <span className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={s.stats}
              onChange={(e) => change({ stats: e.target.checked })}
            />
            <span />
          </span>
        </label>
      </fieldset>
    </>
  );
}

function ScormFoot({
  demoId,
  close,
  generate,
  blocked,
}: {
  demoId: string;
  close: () => void;
  generate: () => void;
  /** L27 : id de l'explication quand les règles de l'espace bloquent la génération */
  blocked: string | null;
}) {
  const { t } = useTranslation();
  const st = useScormJob(demoId)?.state.status;
  if (st === 'running')
    return (
      <>
        <button type="button" className="btn btn-secondary" onClick={() => clearScormJob(demoId)}>
          {t('distribute.scorm.cancel')}
        </button>
        <button type="button" className="btn btn-primary" aria-disabled="true">
          <span className="spinner" aria-hidden="true" />
          {t('distribute.scorm.generatingBtn')}
        </button>
      </>
    );
  if (st === 'ready')
    return (
      <>
        <button type="button" className="btn btn-secondary" onClick={() => clearScormJob(demoId)}>
          {t('distribute.scorm.edit')}
        </button>
        <button type="button" className="btn btn-primary" onClick={close}>
          {t('distribute.scorm.done')}
        </button>
      </>
    );
  if (st === 'error')
    return (
      <>
        <button type="button" className="btn btn-secondary" onClick={close}>
          {t('common.close')}
        </button>
        <button type="button" className="btn btn-primary" onClick={generate}>
          <RefreshCw aria-hidden="true" />
          {t('distribute.scorm.retry')}
        </button>
      </>
    );
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={close}>
        {t('common.cancel')}
      </button>
      <button
        type="button"
        className="btn btn-primary"
        aria-disabled={blocked ? true : undefined}
        aria-describedby={blocked ?? undefined}
        onClick={() => !blocked && generate()}
      >
        <Package aria-hidden="true" />
        {t('distribute.scorm.generate')}
      </button>
    </>
  );
}

// ===== Intranet (L16-05, 06) =====

function IntranetPanel({
  info,
  editable,
  onAllowed,
  record,
  ruled,
}: {
  info: Info;
  editable: boolean;
  onAllowed: () => void;
  record: (label: string, settings: Record<string, unknown>) => void;
  /** L27 : id de l'explication quand les règles de l'espace bloquent la diffusion */
  ruled: string | null;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [chosen, setFormat] = useState<'iframe' | 'popup'>('iframe');
  // L29-01 / L29-02 : outil cible ; pop-up indisponible pour SharePoint et Notion (adresse seule)
  const [target, setTarget] = useEmbedTarget();
  const limitId = useId();
  const popupOff = !popupAllowed(target);
  const format = popupOff ? 'iframe' : chosen;
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    void supabase
      .from('demo_addresses')
      .select('address')
      .eq('demo_id', info.demo.id)
      .is('retired_at', null)
      .maybeSingle()
      .then((r) => setAddress(r.data?.address ?? null));
  }, [info.demo.id]);
  const [domain, setDomain] = useState('');
  const [clickToStart, setClickToStart] = useState(true);
  const [size, setSize] = useState<'fluid' | 'fixed'>('fluid');
  const [w, setW] = useState(960);
  const [h, setH] = useState(600);
  const [label, setLabel] = useState(() => t('distribute.intranet.labelDefault'));
  const [position, setPosition] = useState<'inline' | 'float'>('inline');
  const [lang, setLang] = useState<'demo' | 'fr' | 'en'>('demo');
  const host = hostOf(domain);
  const blocked = host !== null && !originAllowed(host, info.allowed);
  const url = address ? addressUrl(address) : publicDemoUrl(info.demo.id);
  const o = { clickToStart, lang: lang === 'demo' ? null : lang };
  const code = addressOnly(target)
    ? url
    : format === 'iframe'
      ? iframeCode(
          embedUrl(url, o),
          t('distribute.intranet.iframeTitle', { title: info.demo.title }),
          size === 'fluid' ? { kind: 'fluid' } : { kind: 'fixed', width: w, height: h },
        )
      : popupCode(PLAYER_URL, info.demo.id, {
          ...o,
          label: label || t('distribute.intranet.labelDefault'),
          float: position === 'float',
        });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast(t('distribute.intranet.copied'));
      if (host)
        record(host, {
          format,
          clickToStart,
          lang,
          ...(format === 'iframe' ? { size, w, h } : { position }),
        });
    } catch {
      toast(t('distribute.copyFailed'));
    }
  };
  return (
    <>
      <TargetPicker value={target} onChange={setTarget} />
      <div className="dif-two">
        <div className="dif-col">
          <div>
            <span className="t-label dif-lbl" id={`${id}-fmt`}>
              {t('distribute.intranet.format')}
            </span>
            <Segmented
              labelledBy={`${id}-fmt`}
              value={format}
              onChange={setFormat}
              options={[
                { id: 'iframe', label: t('distribute.intranet.iframe') },
                {
                  id: 'popup',
                  label: t('distribute.intranet.popup'),
                  disabledBy: popupOff ? limitId : undefined,
                },
              ]}
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-dom`}>
              {t('distribute.intranet.domain')} <span className="opt">{t('distribute.optional')}</span>
            </label>
            <input
              id={`${id}-dom`}
              className="input t-mono"
              value={domain}
              placeholder="intranet.acme.example"
              aria-describedby={`${id}-dom-h`}
              onChange={(e) => setDomain(e.target.value)}
            />
            <span className="help" id={`${id}-dom-h`}>
              {t('distribute.intranet.domainHelp')}
            </span>
          </div>
          {format === 'iframe' ? (
            <>
              <label className="setting">
                <span className="t-label">
                  {t('distribute.intranet.clickToStart')}
                  <span className="help dif-help-block">{t('distribute.intranet.clickToStartHelp')}</span>
                </span>
                <span className="switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={clickToStart}
                    onChange={(e) => setClickToStart(e.target.checked)}
                  />
                  <span />
                </span>
              </label>
              <div className="setting">
                <label className="t-label" htmlFor={`${id}-size`}>
                  {t('distribute.intranet.size')}
                </label>
                <select
                  id={`${id}-size`}
                  className="select input-sm dif-auto"
                  value={size}
                  onChange={(e) => setSize(e.target.value as 'fluid' | 'fixed')}
                >
                  <option value="fluid">{t('distribute.intranet.fluid')}</option>
                  <option value="fixed">{t('distribute.intranet.fixed')}</option>
                </select>
              </div>
              {size === 'fixed' && (
                <div className="dif-wh">
                  <div className="field">
                    <label htmlFor={`${id}-w`}>{t('distribute.intranet.width')}</label>
                    <input
                      id={`${id}-w`}
                      className="input input-sm num"
                      type="number"
                      min={320}
                      max={1920}
                      value={w}
                      onChange={(e) => setW(Math.min(1920, Math.max(320, Number(e.target.value) || 320)))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`${id}-h`}>{t('distribute.intranet.height')}</label>
                    <input
                      id={`${id}-h`}
                      className="input input-sm num"
                      type="number"
                      min={240}
                      max={1200}
                      value={h}
                      onChange={(e) => setH(Math.min(1200, Math.max(240, Number(e.target.value) || 240)))}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor={`${id}-lbl`}>{t('distribute.intranet.label')}</label>
                <input
                  id={`${id}-lbl`}
                  className="input"
                  value={label}
                  maxLength={40}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="setting">
                <label className="t-label" htmlFor={`${id}-pos`}>
                  {t('distribute.intranet.position')}
                </label>
                <select
                  id={`${id}-pos`}
                  className="select input-sm dif-auto"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as 'inline' | 'float')}
                >
                  <option value="inline">{t('distribute.intranet.inline')}</option>
                  <option value="float">{t('distribute.intranet.float')}</option>
                </select>
              </div>
            </>
          )}
          <div className="setting">
            <label className="t-label" htmlFor={`${id}-lang`}>
              {t('distribute.intranet.lang')}
            </label>
            <select
              id={`${id}-lang`}
              className="select input-sm dif-auto"
              value={lang}
              onChange={(e) => setLang(e.target.value as 'demo' | 'fr' | 'en')}
            >
              <option value="demo">{t('distribute.intranet.langDemo')}</option>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div>
          <span className="t-label dif-lbl">{t('distribute.intranet.preview')}</span>
          <div className="dif-prev" role="img" aria-label={t('distribute.intranet.previewLabel')}>
            <div className="bar" /* §18.6 : points de fenêtre de l’aperçu, décor */ data-gap-exempt="">
              <i />
              <i />
              <i />
              <span>{host ?? 'intranet.example'}/outils</span>
            </div>
            <div className="pg">
              <b>{t('distribute.intranet.previewPage')}</b>
              <span className="ln" style={{ width: '90%' }} />
              <span className="ln" style={{ width: '70%' }} />
              {format === 'iframe' ? (
                <div
                  className={`emb${size === 'fixed' ? ' is-fixed' : ''}`}
                  style={size === 'fixed' ? { aspectRatio: `${w} / ${h}` } : undefined}
                >
                  {clickToStart ? <span>{t('distribute.intranet.launch')}</span> : <i className="emb-step" />}
                </div>
              ) : (
                <>
                  {position === 'inline' && <span className="cta">{label}</span>}
                  <span className="ln" style={{ width: '80%' }} />
                  <span className="ln" style={{ width: '60%' }} />
                  {position === 'float' && <span className="cta is-float">{label}</span>}
                </>
              )}
            </div>
            {format === 'popup' && (
              // L16-06 : étape d'exemple (capture, hotspot, bulle) et bouton de fermeture
              <div className="pop">
                <div className="pop-card">
                  <span className="pop-x">
                    <X size={10} aria-hidden="true" />
                  </span>
                  <span className="pop-hs" />
                  <span className="pop-tip">
                    {t('distribute.intranet.previewStep')}
                    <i>{t('distribute.intranet.previewNext')}</i>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {blocked && (
        <div className="alert alert-warning dif-alert" role="status">
          <AlertTriangle aria-hidden="true" />
          <span>
            <b className="t-mono">{host}</b> {t('distribute.intranet.notAllowed')}{' '}
            {editable && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    check(
                      await supabase
                        .from('demos')
                        .update({
                          settings: {
                            ...asSettings(info.demo.settings),
                            allowedEmbedOrigins: [...info.allowed, host!].slice(0, 20),
                          },
                        })
                        .eq('id', info.demo.id),
                    );
                    toast(t('distribute.intranet.added', { host }));
                    onAllowed();
                  } catch {
                    toast(t('distribute.intranet.addFailed'));
                  }
                }}
              >
                {t('distribute.intranet.add')}
              </button>
            )}
          </span>
        </div>
      )}
      <div className="row between dif-code-head">
        <span className="t-label">{t('distribute.intranet.code')}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-label={t('distribute.intranet.copyLabel')}
          aria-disabled={ruled ? true : undefined}
          aria-describedby={ruled ?? undefined}
          onClick={() => !ruled && void copy()}
        >
          <Copy aria-hidden="true" />
          <span>{t('common.copy')}</span>
        </button>
      </div>
      <pre className="code dif-code" tabIndex={0} aria-label={t('distribute.intranet.codeLabel')}>
        {highlightHtml(code)}
      </pre>
      <p className="help">{t('distribute.intranet.help')}</p>
      <TargetGuide
        target={target}
        code={code}
        address={url}
        published
        codeless
        limitId={limitId}
        playerHost={new URL(PLAYER_URL).host}
      />
    </>
  );
}

// ===== E-mail (L16-07) =====

interface MailState {
  to: string;
  toError: string | null;
  subject: string;
  body: string;
}

function MailPanel({ m, set }: { m: MailState; set: (patch: Partial<MailState>) => void }) {
  const { t } = useTranslation();
  const id = 'dif-mail';
  const tooLong = m.body.length > MAIL_MAX;
  return (
    <>
      <p className="muted dif-intro">{t('distribute.mail.intro')}</p>
      <div className="dif-col">
        <div className="field">
          <label htmlFor={`${id}-to`}>
            {t('distribute.mail.to')} <span className="opt">{t('distribute.optional')}</span>
          </label>
          <input
            id={`${id}-to`}
            className="input"
            value={m.to}
            placeholder="prenom.nom@acme.example, …"
            aria-invalid={m.toError ? true : undefined}
            aria-describedby={`${id}-to-h${m.toError ? ` ${id}-to-e` : ''}`}
            onChange={(e) =>
              set({
                to: e.target.value,
                toError: m.toError && parseRecipients(e.target.value).invalid.length ? m.toError : null,
              })
            }
            onBlur={() => {
              const bad = parseRecipients(m.to).invalid[0];
              set({ toError: bad ? t('distribute.mail.invalid', { value: bad }) : null });
            }}
          />
          <span className="help" id={`${id}-to-h`}>
            {t('distribute.mail.toHelp')}
          </span>
          {m.toError && (
            <span className="help is-error" id={`${id}-to-e`}>
              {m.toError}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${id}-sub`}>{t('distribute.mail.subject')}</label>
          <input
            id={`${id}-sub`}
            className="input"
            value={m.subject}
            onChange={(e) => set({ subject: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-body`}>{t('distribute.mail.body')}</label>
          <textarea
            id={`${id}-body`}
            className="textarea"
            rows={8}
            value={m.body}
            aria-describedby={`${id}-n${tooLong ? ` ${id}-long` : ''}`}
            aria-invalid={tooLong || undefined}
            onChange={(e) => set({ body: e.target.value })}
          />
          <span className={`dif-count num${tooLong ? ' is-error' : ''}`} id={`${id}-n`}>
            {t('distribute.mail.count', { n: formatNumber(m.body.length), max: formatNumber(MAIL_MAX) })}
          </span>
          {tooLong && (
            <span className="help is-error" id={`${id}-long`}>
              {t('distribute.mail.tooLong')}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/** Pied de l'e-mail : « Copier le texte » et un vrai lien mailto (désactivé si trop long ou adresse invalide). */
function MailFoot({ m }: { m: MailState }) {
  const { t } = useTranslation();
  const toast = useToast();
  const rec = parseRecipients(m.to);
  const blocked = m.body.length > MAIL_MAX || rec.invalid.length > 0;
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() =>
          void navigator.clipboard.writeText(`${m.subject}\n\n${m.body}`).then(
            () => toast(t('distribute.mail.copied')),
            () => toast(t('distribute.copyFailed')),
          )
        }
      >
        <Copy aria-hidden="true" />
        <span>{t('distribute.mail.copy')}</span>
      </button>
      {blocked ? (
        <a className="btn btn-primary" role="link" aria-disabled="true">
          <Mail aria-hidden="true" />
          {t('distribute.mail.open')}
        </a>
      ) : (
        <a className="btn btn-primary" href={mailtoHref(rec.valid, m.subject, m.body)}>
          <Mail aria-hidden="true" />
          {t('distribute.mail.open')}
        </a>
      )}
    </>
  );
}

// ===== Où elle est diffusée (L16-08) =====

type WhereRow = { key: string } & (
  | { kind: 'direct'; url: string; views: number; active: boolean }
  | { kind: 'center'; title: string; active: boolean }
  | { kind: 'intranet'; host: string; views: number; last: string }
  | { kind: 'declared'; host: string; date: string }
  | {
      kind: 'scorm';
      version: ScormVersion;
      date: string;
      author: string | null;
      n: number | null;
      old: boolean;
      regenerate: { n: number; settings: Partial<ScormSettings> } | null;
    }
);

async function whereRows(info: Info, publicLinks: boolean, expiresAt: string | null): Promise<WhereRow[]> {
  const { demo, version } = info;
  const [diff, views, paths, center, direct] = await Promise.all([
    listDiffusions(demo.id),
    embedViews(demo.id),
    supabase.from('path_modules').select('path_id, paths(title)').eq('demo_id', demo.id).limit(20),
    supabase
      .from('training_centers')
      .select('published_at')
      .eq('workspace_id', demo.workspace_id)
      .maybeSingle(),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('demo_id', demo.id)
      .eq('type', 'demo_view')
      .is('embed_origin', null),
  ]);
  const authors = new Map<string, string>();
  const ids = [...new Set(diff.map((d) => d.created_by).filter((x): x is string => !!x))];
  if (ids.length) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    for (const p of data ?? []) if (p.full_name) authors.set(p.id, p.full_name);
  }
  const out: WhereRow[] = [];
  if (version) {
    const expired = expiresAt ? Date.parse(expiresAt) <= Date.now() : false;
    out.push({
      key: 'direct',
      kind: 'direct',
      url: publicDemoUrl(demo.id).replace(/^https?:\/\//, ''),
      views: direct.count ?? 0,
      active: publicLinks && !expired,
    });
  }
  for (const p of (paths.data ?? []) as Array<{ path_id: string; paths?: { title?: string } | null }>) {
    if (!p.paths?.title) continue;
    out.push({
      key: `path-${p.path_id}`,
      kind: 'center',
      title: p.paths.title,
      active: !!center.data?.published_at,
    });
  }
  const seen = new Set<string>();
  for (const v of views) {
    if (v.origin.startsWith('scorm:')) continue;
    let host = v.origin;
    try {
      host = new URL(v.origin).host || v.origin;
    } catch {
      /* origine brute */
    }
    seen.add(host);
    out.push({ key: `view-${host}`, kind: 'intranet', host, views: v.views, last: v.last_at });
  }
  for (const d of diff.filter((x) => x.kind === 'intranet' && !seen.has(x.label)))
    out.push({ key: d.id, kind: 'declared', host: d.label, date: d.last_at });
  for (const d of diff.filter((x) => x.kind === 'scorm').slice(0, 5)) {
    const st = d.settings as {
      version?: ScormVersion;
      pass?: PassCriterion;
      stats?: boolean;
      number?: number;
    };
    const old = !!version && d.version_id !== version.id;
    out.push({
      key: d.id,
      kind: 'scorm',
      version: st.version ?? '1.2',
      date: d.last_at,
      author: (d.created_by && authors.get(d.created_by)) || null,
      n: st.number ?? null,
      old,
      regenerate:
        old && version
          ? {
              n: version.number,
              settings: {
                version: st.version ?? '1.2',
                criterion: st.pass?.kind === 'quiz' ? 'quiz' : 'steps',
                min: st.pass?.kind === 'quiz' ? st.pass.min : undefined,
                stats: !!st.stats,
              },
            }
          : null,
    });
  }
  return out;
}

function WherePanel({
  rows,
  onRegenerate,
}: {
  rows: WhereRow[] | null;
  onRegenerate: (s: Partial<ScormSettings>) => void;
}) {
  const { t } = useTranslation();
  if (rows === null) return <p className="muted">{t('common.loading')}</p>;
  const badge = (text: string, tone: 'success' | 'warning' | 'neutral') => (
    <Status size="sm" tone={tone}>
      {text}
    </Status>
  );
  const line = (
    r: WhereRow,
  ): { icon: ReactNode; title: string; mono?: string; detail?: string; act: ReactNode } => {
    switch (r.kind) {
      case 'direct':
        return {
          icon: <Link2 />,
          title: t('distribute.where.direct'),
          mono: r.url,
          detail: r.views
            ? t('distribute.where.views', { count: r.views, n: formatNumber(r.views) })
            : undefined,
          act: badge(
            t(r.active ? 'distribute.where.active' : 'distribute.where.disabled'),
            r.active ? 'success' : 'neutral',
          ),
        };
      case 'center':
        return {
          icon: <Layers />,
          title: t('distribute.where.center'),
          detail: t('distribute.where.path', { title: r.title }),
          act: r.active ? badge(t('distribute.where.active'), 'success') : null,
        };
      case 'intranet':
        return {
          icon: <Globe />,
          title: t('distribute.where.intranet'),
          mono: r.host,
          detail: t('distribute.where.seen', {
            count: r.views,
            n: formatNumber(r.views),
            when: formatRelativeShort(r.last),
          }),
          act: badge(t('distribute.where.active'), 'success'),
        };
      case 'declared':
        return {
          icon: <Globe />,
          title: t('distribute.where.intranet'),
          mono: r.host,
          detail: t('distribute.where.declared', { date: formatDate(r.date) }),
          act: null,
        };
      case 'scorm':
        return {
          icon: <Package />,
          title: t('distribute.where.lms', { version: r.version }),
          detail: t(r.author ? 'distribute.where.scormBy' : 'distribute.where.scorm', {
            date: formatDate(r.date),
            author: r.author ?? '',
            n: r.n ?? '—',
          }),
          act: (
            <>
              {badge(
                t(r.old ? 'distribute.where.old' : 'distribute.where.upToDate'),
                r.old ? 'warning' : 'neutral',
              )}
              {r.regenerate && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onRegenerate(r.regenerate!.settings)}
                >
                  {t('distribute.where.regenerate', { n: r.regenerate.n })}
                </button>
              )}
            </>
          ),
        };
    }
  };
  return (
    <>
      {rows.length === 0 ? (
        <div className="empty dif-empty" role="status">
          <p className="muted">{t('distribute.where.empty')}</p>
        </div>
      ) : (
        <ul className="dif-list">
          {rows.map((r) => {
            const l = line(r);
            return (
              <li key={r.key}>
                <span className="ic" aria-hidden="true">
                  {l.icon}
                </span>
                <span>
                  <b>{l.title}</b>
                  {l.mono && <small className="t-mono">{l.mono}</small>}
                  {l.detail && (
                    <small>
                      {l.mono ? ' · ' : ''}
                      {l.detail}
                    </small>
                  )}
                </span>
                <span className="act">{l.act}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="alert dif-alert">
        <Info aria-hidden="true" />
        <span className="t-caption">{t('distribute.where.note')}</span>
      </div>
    </>
  );
}
