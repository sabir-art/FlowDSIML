/**
 * L23-05 à 07 : détail d'un webhook. En-tête, événements, secret masqué (renouvellement seulement),
 * journal des envois sur 7 jours, panneau de l'envoi sélectionné avec « Rejouer maintenant », bandeau
 * d'échec du test, bandeau de mise en pause automatique.
 */
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Copy,
  CirclePause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Webhook as WebhookIcon,
} from 'lucide-react';
import { SettingsShell } from '../SettingsShell';
import { supabase } from '../../../lib/supabase';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Menu } from '../../../components/Menu';
import { errorMessage } from '../../../lib/errors';
import { formatNumber } from '../../../lib/format';
import {
  deleteWebhook,
  hostOf,
  listDeliveries,
  replay,
  rotateSecret,
  sendTest,
  setState,
  statusKind,
  statusText,
  testAdvice,
  type Delivery,
  type SendResult,
  type Webhook,
} from './webhooks';
import { SecretDialog, resultText } from './WebhooksPage';
import './integrations.css';
import { Button } from '@flowdsiml/ui';

export function WebhookDetail() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { current, can } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const [hook, setHook] = useState<Webhook | null | undefined>(undefined);
  const [log, setLog] = useState<Delivery[]>([]);
  const [filter, setFilter] = useState<'all' | 'failed'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [author, setAuthor] = useState('');
  const [testFailure, setTestFailure] = useState<SendResult | null>(
    (location.state as { testFailure?: SendResult } | null)?.testFailure ?? null,
  );
  const [secret, setSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('webhooks').select('*').eq('id', id).maybeSingle();
    setHook((data as Webhook | null) ?? null);
    setLog(await listDeliveries(id));
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!hook?.created_by || !current) return;
    void supabase.rpc('list_members', { p_workspace: current.id }).then(({ data }) => {
      const m = (data ?? []).find((x) => x.user_id === hook.created_by);
      setAuthor(m ? m.full_name || m.email : '');
    });
  }, [hook?.created_by, current]);

  // L48-F §2 : fil « Connexions › Intégrations › Webhooks »
  const crumb = { title: t('integrations.webhooks') };
  if (!can('integrations.manage') || hook === null)
    return (
      <SettingsShell sub={crumb} legacy={false}>
        <div className="stg-empty" role="status">
          <span className="stg-empty__tile" aria-hidden="true">
            <WebhookIcon size={20} />
          </span>
          <h2>{t(hook === null ? 'integrations.notFound' : 'integrations.noAccess')}</h2>
          <div className="stg-empty__acts">
            <Link className="fd-btn" to="/settings/integrations/webhooks">
              {t('integrations.webhooks')}
            </Link>
          </div>
        </div>
      </SettingsShell>
    );
  if (!hook)
    return (
      <SettingsShell sub={crumb} legacy={false}>
        {null}
      </SettingsShell>
    );

  const shown = log.filter(
    (d) =>
      filter === 'all' ||
      d.status === 'failed' ||
      d.status === 'dead' ||
      (d.status === 'pending' && d.response_status),
  );
  const sel = log.find((d) => d.id === selected) ?? shown[0] ?? null;
  const paused = hook.state !== 'active';

  const test = async () => {
    try {
      const r = await sendTest(hook.id);
      const ok = r.status >= 200 && r.status < 300;
      setTestFailure(ok ? null : r);
      if (ok) toast(resultText(t, r));
    } catch (e) {
      toast(errorMessage(t, e));
    }
    void load();
  };

  /** NUM-01 : milliers et unité séparés par une espace insécable (« 2 010 ms »). */
  const ms = (n: number) => `${formatNumber(n)}\u00a0ms`;
  const duration = (d: Delivery) => {
    if (d.status === 'success' || (d.event_type === 'ping' && d.status === 'failed'))
      return ms(d.duration_ms ?? 0);
    if (d.status === 'pending' && d.response_status !== null) {
      const min = Math.max(1, Math.round((Date.parse(d.next_attempt_at) - Date.now()) / 60_000));
      return t('integrations.retryIn', { count: min });
    }
    if (d.status === 'pending' || d.status === 'sending') return '…';
    // Échec : la durée de la réponse (l'essai est dit dans le statut)
    return d.duration_ms != null ? ms(d.duration_ms) : '–';
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, d: Delivery) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(d.id);
    }
  };

  const short = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  const day = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(new Date(iso));
  const eventLabel = (type: string) =>
    type === 'ping' ? t('integrations.test') : t(`integrations.ev_${type.replace('.', '_')}`, type);
  const httpText = (d: Delivery) => {
    const code = statusText(d);
    return d.response_status
      ? `HTTP ${d.response_status}`
      : /^\d+$/.test(code)
        ? `HTTP ${code}`
        : t('integrations.pendingStatus');
  };
  const hasTry = (d: Delivery) => statusKind(d) !== 'ok' && d.event_type !== 'ping';
  /** Statut d'un envoi (SPLIT-01) : icône (jamais la couleur seule) et « HTTP 503 », l'essai sur une 2e ligne. */
  const status = (d: Delivery) => {
    const kind = statusKind(d);
    const Icon = kind === 'ok' ? CircleCheck : kind === 'ko' ? CircleAlert : Clock;
    return (
      <span className="wh-st2">
        <span className={`wh-st wh-st--${kind}`}>
          <Icon size={16} aria-hidden="true" />
          {httpText(d)}
        </span>
        {hasTry(d) && <span className="wh-try">{t('integrations.attemptLine', { n: d.attempt })}</span>}
      </span>
    );
  };
  const rotate = async () => {
    if (
      await ask({
        title: t('integrations.rotateTitle'),
        body: t('integrations.rotateBody'),
        confirmLabel: t('integrations.rotate'),
      })
    ) {
      try {
        setSecret(await rotateSecret(hook.id));
        void load();
      } catch (e) {
        toast(errorMessage(t, e));
      }
    }
  };

  return (
    <SettingsShell
      legacy={false}
      sub={{
        title: hostOf(hook.url),
        trail: [{ label: t('integrations.webhooks'), to: '/settings/integrations/webhooks' }],
      }}
      actions={
        <>
          {!paused && (
            <Button icon={<Send size={16} />} onClick={() => void test()}>
              {t('integrations.sendTest')}
            </Button>
          )}
          <Menu
            label={t('integrations.moreActions')}
            items={[
              {
                label: t('integrations.edit'),
                onSelect: () => navigate('/settings/integrations/webhooks', { state: { edit: hook.id } }),
              },
              {
                label: t('integrations.delete'),
                danger: true,
                onSelect: async () => {
                  if (
                    await ask({
                      title: t('integrations.deleteTitle', { host: hostOf(hook.url) }),
                      body: t('integrations.deleteBody'),
                      confirmLabel: t('integrations.delete'),
                      danger: true,
                    })
                  ) {
                    await deleteWebhook(hook.id);
                    navigate('/settings/integrations/webhooks');
                  }
                },
              },
            ]}
          />
        </>
      }
    >
      <div className="l23 wh-page">
        {testFailure && !paused && (
          <div className="wh-banner wh-banner--danger" role="alert" data-gap-exempt="">
            <CircleAlert size={18} aria-hidden="true" />
            <div>
              <b>
                {t('integrations.testFailed', {
                  status: testFailure.status || '—',
                  ms: testFailure.duration_ms,
                })}
              </b>
              <span>{t(`integrations.advice_${testAdvice(testFailure.status, testFailure.error)}`)}</span>
            </div>
          </div>
        )}
        {hook.state === 'paused_auto' && (
          <div className="wh-banner wh-banner--pause" role="status" data-gap-exempt="">
            <CirclePause size={20} aria-hidden="true" />
            <div>
              <b>{t('integrations.pausedBanner', { date: day(hook.updated_at) })}</b>
              <span>{t('integrations.pausedAdvice')}</span>
            </div>
            <Button
              variant="primary"
              icon={<Play size={16} />}
              onClick={() => void setState(hook.id, 'active').then(load)}
            >
              {t('integrations.enable')}
            </Button>
          </div>
        )}

        <section className="stg-sec" aria-labelledby="wh-t">
          <div className="stg-sec__head">
            <div>
              <h2 id="wh-t">{t('integrations.webhook')}</h2>
              <p>
                {author
                  ? t('integrations.createdBy', { date: day(hook.created_at), name: author })
                  : t('integrations.created', { date: day(hook.created_at) })}
              </p>
            </div>
          </div>
          <div className="stg-row">
            <div className="stg-text">
              <label className="stg-lab" htmlFor="wh-url">
                {t('integrations.colUrl')}
              </label>
            </div>
            <div className="stg-ctl stg-ctl--wide">
              <div className="wh-copy">
                <input id="wh-url" className="fd-input" readOnly value={hook.url} />
                <button
                  type="button"
                  className="wh-copy__btn"
                  aria-label={t('integrations.copyUrl')}
                  onClick={() => {
                    void navigator.clipboard?.writeText(hook.url).catch(() => undefined);
                    toast(t('integrations.copied'));
                  }}
                >
                  <Copy size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          <div className="stg-row">
            <div className="stg-text">
              <div className="stg-lab" id="wh-ev">
                {t('integrations.colEvents')}
              </div>
            </div>
            <div className="stg-ctl">
              <ul className="hc-chips wh-chips" aria-labelledby="wh-ev">
                {hook.events.map((e) => (
                  <li key={e} className="hc-chip" title={e}>
                    {eventLabel(e)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="stg-row stg-row--inline">
            <div className="stg-text" data-gap-exempt="">
              <div className="stg-lab">{t('integrations.colState')}</div>
              <div className="stg-help">
                {hook.state === 'active'
                  ? t('integrations.stateActiveHelp')
                  : t('integrations.statePausedHelp', { date: day(hook.updated_at) })}
              </div>
            </div>
            <div className="stg-ctl wh-state-ctl">
              <span className={`wh-st wh-st--${hook.state === 'active' ? 'ok' : 'pause'}`}>
                {hook.state === 'active' ? (
                  <CircleCheck size={16} aria-hidden="true" />
                ) : (
                  <CirclePause size={16} aria-hidden="true" />
                )}
                {t(
                  hook.state === 'active'
                    ? 'integrations.active'
                    : hook.state === 'paused_auto'
                      ? 'integrations.pausedAuto'
                      : 'integrations.disabled',
                )}
              </span>
              {hook.state === 'active' ? (
                <Button onClick={() => void setState(hook.id, 'paused').then(load)}>
                  {t('integrations.disable')}
                </Button>
              ) : (
                hook.state !== 'paused_auto' && (
                  <Button onClick={() => void setState(hook.id, 'active').then(load)}>
                    {t('integrations.enable')}
                  </Button>
                )
              )}
            </div>
          </div>
        </section>

        <section className="stg-sec" aria-labelledby="wh-sec-t">
          <div className="stg-sec__head">
            <div>
              <h2 id="wh-sec-t">{t('integrations.secretTitle')}</h2>
              <p>{t('integrations.secretHelp')}</p>
            </div>
          </div>
          <div className="stg-row">
            <div className="stg-text">
              <div className="stg-lab">{t('integrations.secretRow')}</div>
            </div>
            <div className="stg-ctl stg-ctl--wide">
              <div className="wh-secret-row">
                <span className="wh-mono stg-muted wh-secret-text">
                  {t('integrations.secretMasked', { hint: hook.secret_hint })}
                </span>
                <Button icon={<RefreshCw size={16} />} onClick={() => void rotate()}>
                  {t('integrations.rotate')}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="stg-sec" aria-labelledby="wh-log-t">
          <div className="stg-sec__head">
            <div>
              <h2 id="wh-log-t">{t('integrations.logTitle')}</h2>
              <p>{t('integrations.schedule')}</p>
            </div>
            <div className="stg-sec__acts">
              <div className="segmented stg-seg" role="radiogroup" aria-label={t('integrations.logFilter')}>
                {(['all', 'failed'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={filter === f}
                    onClick={() => setFilter(f)}
                  >
                    {t(f === 'all' ? 'integrations.logAll' : 'integrations.logFailed')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="stg-table__empty wh-log-empty">{t('integrations.logEmpty')}</p>
          ) : (
            <div className="wh-log">
              {/* SPLIT-01 : le tableau défile dans son conteneur, il ne passe jamais sous le panneau */}
              <div className="wh-log__table">
                <table className="stg-table l23-log">
                  <caption className="sr-only">{t('integrations.logCaption')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('integrations.colDate')}</th>
                      <th scope="col" className="stg-table__m-hide">
                        {t('integrations.colEvent')}
                      </th>
                      <th scope="col">{t('integrations.colStatus')}</th>
                      <th scope="col" className="wh-num stg-table__m-hide">
                        {t('integrations.colDuration')}
                      </th>
                    </tr>
                  </thead>
                  {/* §18.6 : lignes à filets de 48 px, l'écart est porté par la hauteur des lignes */}
                  <tbody data-gap-exempt="">
                    {shown.map((d) => (
                      <tr
                        key={d.id}
                        className={sel?.id === d.id ? 'tr-sel' : undefined}
                        aria-selected={sel?.id === d.id}
                        tabIndex={0}
                        onClick={() => setSelected(d.id)}
                        onKeyDown={(e) => onRowKey(e, d)}
                      >
                        <td>{short(d.created_at)}</td>
                        <td className="stg-table__m-hide" title={d.event_type}>
                          {eventLabel(d.event_type)}
                        </td>
                        <td>{status(d)}</td>
                        <td className="wh-num stg-table__m-hide">{duration(d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sel && (
                <aside className="wh-det" aria-label={t('integrations.selected')}>
                  <div className="wh-det__head">
                    <b className="wh-det__title">{t('integrations.selected')}</b>
                    <Button
                      size="sm"
                      icon={<RotateCcw size={16} />}
                      onClick={async () => {
                        try {
                          const r = await replay(sel.id);
                          toast(t('integrations.replayed', { status: r.status || '—', ms: r.duration_ms }));
                        } catch (e) {
                          toast(errorMessage(t, e));
                        }
                        void load();
                      }}
                    >
                      {t('integrations.replay')}
                    </Button>
                  </div>
                  <dl
                    className="wh-meta"
                    /* §18.6 : étiquette et valeur, 2 px (typographie) */ data-gap-exempt=""
                  >
                    <div>
                      <dt>{t('integrations.colStatus')}</dt>
                      <dd>{httpText(sel)}</dd>
                    </div>
                    <div>
                      <dt>{t('integrations.colDuration')}</dt>
                      <dd>{sel.duration_ms != null ? ms(sel.duration_ms) : '–'}</dd>
                    </div>
                    {sel.event_type !== 'ping' && (
                      <div>
                        <dt>{t('integrations.attemptLabel')}</dt>
                        <dd>{t('integrations.attemptOf', { n: sel.attempt })}</dd>
                      </div>
                    )}
                  </dl>
                  <h3>{t('integrations.body')}</h3>
                  <pre className="wh-code" tabIndex={0}>
                    {JSON.stringify(sel.payload, null, 2)}
                  </pre>
                  <h3>{t('integrations.response')}</h3>
                  <pre className="wh-code" tabIndex={0}>
                    {sel.response_status !== null
                      ? `HTTP ${sel.response_status || '—'}${sel.error && sel.error !== `HTTP ${sel.response_status}` ? ` · ${sel.error}` : ''}${
                          sel.response_body ? `\n${sel.response_body.slice(0, 1024)}` : ''
                        }`
                      : t('integrations.noResponse')}
                  </pre>
                </aside>
              )}
            </div>
          )}
        </section>
      </div>
      {secret && (
        <SecretDialog
          title={t('integrations.secretRotated')}
          secret={secret}
          onTest={() => sendTest(hook.id)}
          onDone={(failed) => {
            setSecret(null);
            setTestFailure(failed);
          }}
        />
      )}
      {dialog}
    </SettingsShell>
  );
}
