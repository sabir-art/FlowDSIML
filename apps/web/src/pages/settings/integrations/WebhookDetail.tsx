/**
 * L23-05 à 07 : détail d'un webhook. En-tête, événements, secret masqué (renouvellement seulement),
 * journal des envois sur 7 jours, panneau de l'envoi sélectionné avec « Rejouer maintenant », bandeau
 * d'échec du test, bandeau de mise en pause automatique.
 */
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CircleAlert, Pause, RefreshCw, Send } from 'lucide-react';
import { SettingsShell } from '../SettingsShell';
import { supabase } from '../../../lib/supabase';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Menu } from '../../../components/Menu';
import { formatDateTime, formatRelativeShort } from '../../../lib/format';
import { errorMessage } from '../../../lib/errors';
import {
  deleteWebhook,
  hostOf,
  listDeliveries,
  maskedSecret,
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
import { SecretDialog, StateBadge, resultText } from './IntegrationsPage';
import './integrations.css';

export function WebhookDetail() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
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

  if (!can('integrations.manage') || hook === null)
    return (
      <SettingsShell>
        <div className="empty" role="status">
          <h2 className="t-h3">{t(hook === null ? 'integrations.notFound' : 'integrations.noAccess')}</h2>
          <Link className="btn btn-secondary btn-sm" to="/settings/integrations">
            {t('integrations.title')}
          </Link>
        </div>
      </SettingsShell>
    );
  if (!hook) return <SettingsShell>{null}</SettingsShell>;

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

  const duration = (d: Delivery) => {
    if (d.status === 'success' || (d.event_type === 'ping' && d.status === 'failed'))
      return `${d.duration_ms ?? 0} ms`;
    if (d.status === 'pending' && d.response_status !== null) {
      const min = Math.max(1, Math.round((Date.parse(d.next_attempt_at) - Date.now()) / 60_000));
      return t('integrations.retryIn', { count: min });
    }
    if (d.status === 'pending' || d.status === 'sending') return '…';
    return t('integrations.attempt', { n: d.attempt });
  };

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, d: Delivery) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(d.id);
    }
  };

  return (
    <SettingsShell>
      <section className="l23" aria-labelledby="wh-t">
        <Link to="/settings/integrations" className="btn btn-ghost btn-sm l23-back">
          <ArrowLeft aria-hidden="true" />
          {t('integrations.title')}
        </Link>
        <div className="row between wrap l23-head">
          <div>
            <h2 className="t-h2 wh-url wh-url--title" id="wh-t">
              {hook.url}
            </h2>
            <p className="muted">
              <StateBadge h={hook} /> ·{' '}
              {author
                ? t('integrations.createdBy', { date: formatDateTime(hook.created_at), name: author })
                : t('integrations.created', { date: formatDateTime(hook.created_at) })}
            </p>
          </div>
          <div className="row l23-actions">
            {paused ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void setState(hook.id, 'active').then(load)}
              >
                <RefreshCw aria-hidden="true" />
                {t('integrations.enable')}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void test()}>
                  <Send aria-hidden="true" />
                  {t('integrations.sendTest')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void setState(hook.id, 'paused').then(load)}
                >
                  <Pause aria-hidden="true" />
                  {t('integrations.disable')}
                </button>
              </>
            )}
            <Menu
              label={t('integrations.moreActions')}
              items={[
                {
                  label: t('integrations.edit'),
                  onSelect: () => navigate('/settings/integrations', { state: { edit: hook.id } }),
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
                      navigate('/settings/integrations');
                    }
                  },
                },
              ]}
            />
          </div>
        </div>

        {testFailure && !paused && (
          <div className="alert alert-danger l23-banner" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>
              <b>
                {t('integrations.testFailed', {
                  status: testFailure.status || '—',
                  ms: testFailure.duration_ms,
                })}
              </b>{' '}
              {t(`integrations.advice_${testAdvice(testFailure.status, testFailure.error)}`)}
            </span>
          </div>
        )}
        {hook.state === 'paused_auto' && (
          <div className="alert alert-warning l23-banner" role="status">
            <Pause aria-hidden="true" />
            <span>
              <b>{t('integrations.pausedBanner', { date: formatDateTime(hook.updated_at) })}</b>{' '}
              {t('integrations.pausedAdvice')}
            </span>
          </div>
        )}

        <div className="card">
          <div className="form-sec l23-sec">
            <div className="intro">
              <h3 className="t-h3">{t('integrations.colEvents')}</h3>
            </div>
            <div className="wh-ev">
              {hook.events.map((e) => (
                <span key={e} className="badge">
                  {e}
                </span>
              ))}
            </div>
          </div>
          <div className="form-sec l23-sec">
            <div className="intro">
              <h3 className="t-h3">{t('integrations.secretTitle')}</h3>
            </div>
            <div>
              <div className="secret">
                <code aria-label={t('integrations.secretMasked', { hint: hook.secret_hint })}>
                  {maskedSecret(hook.secret_hint)}
                </code>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
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
                  }}
                >
                  <RefreshCw aria-hidden="true" />
                  {t('integrations.rotate')}
                </button>
              </div>
              <p className="help">{t('integrations.secretHelp')}</p>
            </div>
          </div>
        </div>

        <div className="wh-detail">
          <div className="card l23-log">
            <div className="row between l23-log-head">
              <h3 className="t-h3">{t('integrations.logTitle')}</h3>
              <select
                className="select input-sm"
                aria-label={t('integrations.logFilter')}
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'failed')}
              >
                <option value="all">{t('integrations.logAll')}</option>
                <option value="failed">{t('integrations.logFailed')}</option>
              </select>
            </div>
            {shown.length === 0 ? (
              <p className="muted l23-log-empty">{t('integrations.logEmpty')}</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">{t('integrations.logCaption')}</caption>
                  <thead>
                    <tr>
                      <th>{t('integrations.colStatus')}</th>
                      <th>{t('integrations.colEvent')}</th>
                      <th>{t('integrations.colDate')}</th>
                      <th>{t('integrations.colDuration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((d) => (
                      <tr
                        key={d.id}
                        className={sel?.id === d.id ? 'tr-sel' : undefined}
                        aria-selected={sel?.id === d.id}
                        tabIndex={0}
                        onClick={() => setSelected(d.id)}
                        onKeyDown={(e) => onRowKey(e, d)}
                      >
                        <td>
                          <span className={`st ${statusKind(d)}`}>{statusText(d)}</span>
                        </td>
                        <td className="t-mono">
                          {d.event_type}
                          {d.event_type === 'ping' && (
                            <span className="badge l23-test">{t('integrations.test')}</span>
                          )}
                        </td>
                        <td>{formatRelativeShort(d.created_at)}</td>
                        <td>{duration(d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {sel && (
            <aside className="card card-pad" aria-label={t('integrations.selected')}>
              <div className="row l23-sel-head">
                <span className={`st ${statusKind(sel)}`}>{statusText(sel)}</span>
                <b className="t-mono">{sel.event_type}</b>
                <span className="t-caption muted">· {t('integrations.attempt', { n: sel.attempt })}</span>
              </div>
              <p className="t-caption muted">{t('integrations.schedule')}</p>
              <h4 className="t-label">{t('integrations.body')}</h4>
              <pre className="pre">{JSON.stringify(sel.payload, null, 2)}</pre>
              <h4 className="t-label">{t('integrations.response')}</h4>
              <pre className="pre">
                {sel.response_status !== null
                  ? `HTTP ${sel.response_status || '—'}${sel.error && sel.error !== `HTTP ${sel.response_status}` ? ` · ${sel.error}` : ''}${
                      sel.response_body ? `\n${sel.response_body.slice(0, 1024)}` : ''
                    }`
                  : t('integrations.noResponse')}
              </pre>
              <button
                type="button"
                className="btn btn-primary btn-sm l23-gap"
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
                <RefreshCw aria-hidden="true" />
                {t('integrations.replay')}
              </button>
            </aside>
          )}
        </div>
      </section>
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
