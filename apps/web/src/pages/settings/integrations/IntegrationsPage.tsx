/**
 * L23-01 à 04 : Paramètres > Intégrations (maquette reference/parametres-integrations.html, spec L23).
 * Liste des webhooks, cartes « Bientôt », création ou modification, secret affiché une seule fois.
 * Réservé aux propriétaires et admins (RLS côté base ; message d'accès refusé ici).
 */
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  ChartColumn,
  Copy,
  Hash,
  MessageSquare,
  Plus,
  Send,
  Webhook as WebhookIcon,
  X,
  Zap,
} from 'lucide-react';
import { SettingsShell } from '../SettingsShell';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Menu } from '../../../components/Menu';
import { formatRelativeShort } from '../../../lib/format';
import { errorMessage } from '../../../lib/errors';
import {
  WEBHOOK_EVENTS,
  createWebhook,
  deleteWebhook,
  hostOf,
  lastDeliveries,
  listWebhooks,
  sendTest,
  setState,
  statusKind,
  statusText,
  updateWebhook,
  urlOk,
  type Delivery,
  type SendResult,
  type Webhook,
} from './webhooks';
import './integrations.css';

export function IntegrationsPage() {
  const { t } = useTranslation();
  const { current, can } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const [hooks, setHooks] = useState<Webhook[] | null>(null);
  const [last, setLast] = useState<Record<string, Delivery>>({});
  const [editing, setEditing] = useState<Webhook | 'new' | null>(null);
  const [secret, setSecret] = useState<{ id: string; secret: string; title: string } | null>(null);
  const ws = current?.id;
  const allowed = can('integrations.manage');
  const location = useLocation();
  const editId = (location.state as { edit?: string } | null)?.edit;

  const load = useCallback(async () => {
    if (!ws) return;
    const list = await listWebhooks(ws);
    setHooks(list);
    setLast(await lastDeliveries(list.map((h) => h.id)));
  }, [ws]);
  useEffect(() => {
    if (allowed) void load();
  }, [load, allowed]);
  // « Modifier » depuis le détail : rouvre la même modale ici
  useEffect(() => {
    const h = editId && hooks?.find((x) => x.id === editId);
    if (h) {
      setEditing(h);
      navigate('.', { replace: true, state: null });
    }
  }, [editId, hooks, navigate]);

  if (!allowed)
    return (
      <SettingsShell>
        <div className="empty" role="status">
          <h2 className="t-h3">{t('integrations.noAccess')}</h2>
          <Link className="btn btn-secondary btn-sm" to="/settings/workspace">
            {t('integrations.backGeneral')}
          </Link>
        </div>
      </SettingsShell>
    );

  const test = async (h: Webhook) => {
    try {
      toast(resultText(t, await sendTest(h.id)));
    } catch (e) {
      toast(errorMessage(t, e));
    }
    void load();
  };

  return (
    <SettingsShell>
      <section className="l23" aria-labelledby="int-t">
        <div className="row between wrap l23-head">
          <div>
            <h2 className="t-h2" id="int-t">
              {t('integrations.title')}
            </h2>
            <p className="muted">{t('integrations.sub')}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h3 className="t-h3">{t('integrations.webhooks')}</h3>
              <p className="t-caption muted">{t('integrations.webhooksSub')}</p>
            </div>
            {hooks && hooks.length > 0 && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                {t('integrations.add')}
              </button>
            )}
          </div>
          {hooks === null ? null : hooks.length === 0 ? (
            <div className="empty" role="status">
              <span className="int-lg int-lg--big" aria-hidden="true">
                <WebhookIcon />
              </span>
              <h3 className="t-h3">{t('integrations.emptyTitle')}</h3>
              <p className="muted">{t('integrations.emptyBody')}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" />
                {t('integrations.add')}
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">{t('integrations.tableCaption')}</caption>
                <thead>
                  <tr>
                    <th>{t('integrations.colUrl')}</th>
                    <th>{t('integrations.colEvents')}</th>
                    <th>{t('integrations.colState')}</th>
                    <th>{t('integrations.colLast')}</th>
                    <th>
                      <span className="sr-only">{t('integrations.colActions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hooks.map((h) => {
                    const d = last[h.id];
                    return (
                      <tr key={h.id}>
                        <td>
                          <Link className="wh-url" to={`/settings/integrations/${h.id}`} title={h.url}>
                            {h.url}
                          </Link>
                          {h.name && <div className="t-caption subtle">{h.name}</div>}
                        </td>
                        <td>
                          <EventBadges events={h.events} />
                        </td>
                        <td>
                          <StateBadge h={h} />
                        </td>
                        <td>
                          {d ? (
                            <>
                              <span className={`st ${statusKind(d)}`}>{statusText(d)}</span>{' '}
                              <span className="t-caption muted">{formatRelativeShort(d.created_at)}</span>
                            </>
                          ) : (
                            <span className="t-caption muted">{t('integrations.never')}</span>
                          )}
                        </td>
                        <td className="r">
                          <Menu
                            label={t('integrations.actionsFor', { host: hostOf(h.url) })}
                            items={[
                              {
                                label: t('integrations.sendTest'),
                                icon: <Send />,
                                onSelect: () => void test(h),
                              },
                              {
                                label: t(
                                  h.state === 'active' ? 'integrations.disable' : 'integrations.enable',
                                ),
                                onSelect: () =>
                                  void setState(h.id, h.state === 'active' ? 'paused' : 'active').then(load),
                              },
                              { label: t('integrations.edit'), onSelect: () => setEditing(h) },
                              {
                                label: t('integrations.delete'),
                                danger: true,
                                onSelect: async () => {
                                  if (
                                    await ask({
                                      title: t('integrations.deleteTitle', { host: hostOf(h.url) }),
                                      body: t('integrations.deleteBody'),
                                      confirmLabel: t('integrations.delete'),
                                      danger: true,
                                    })
                                  ) {
                                    await deleteWebhook(h.id);
                                    void load();
                                  }
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <SoonCards />
      </section>
      {editing && ws && (
        <WebhookForm
          ws={ws}
          hook={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(id, s) => {
            setEditing(null);
            setSecret({ id, secret: s, title: t('integrations.secretCreated') });
            void load();
          }}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {secret && (
        <SecretDialog
          title={secret.title}
          secret={secret.secret}
          onTest={() => sendTest(secret.id)}
          onDone={(failed) => {
            const id = secret.id;
            setSecret(null);
            if (failed) navigate(`/settings/integrations/${id}`, { state: { testFailure: failed } });
          }}
        />
      )}
      {dialog}
    </SettingsShell>
  );
}

export function resultText(t: (k: string, o?: Record<string, unknown>) => string, r: SendResult) {
  return r.status >= 200 && r.status < 300
    ? t('integrations.testOk', { status: r.status, ms: r.duration_ms })
    : t('integrations.testKo', { status: r.status || '—', ms: r.duration_ms });
}

export function EventBadges({ events, max = 2 }: { events: string[]; max?: number }) {
  return (
    <div className="wh-ev">
      {events.slice(0, max).map((e) => (
        <span key={e} className="badge">
          {e}
        </span>
      ))}
      {events.length > max && <span className="badge">+{events.length - max}</span>}
    </div>
  );
}

/** `inline` : badge seul (en-tête du détail, où le bandeau donne déjà le nombre d'échecs). */
export function StateBadge({ h, inline = false }: { h: Webhook; inline?: boolean }) {
  const { t } = useTranslation();
  if (h.state === 'active') return <span className="badge badge-success">{t('integrations.active')}</span>;
  if (h.state === 'paused_auto')
    return (
      <>
        <span className="badge badge-warning">{t('integrations.pausedAuto')}</span>
        {!inline && (
          <div className="t-caption subtle">{t('integrations.failures', { count: h.failures })}</div>
        )}
      </>
    );
  return <span className="badge">{t('integrations.disabled')}</span>;
}

function SoonCards() {
  const { t } = useTranslation();
  const cards = [
    { k: 'slack', icon: <Hash /> },
    { k: 'zapier', icon: <Zap /> },
    { k: 'ga', icon: <ChartColumn /> },
    { k: 'matomo', icon: <ChartColumn /> },
    { k: 'teams', icon: <MessageSquare /> },
    { k: 'crm', icon: <Building2 /> },
  ];
  return (
    <div className="card card-pad l23-soon">
      <h3 className="t-h3">{t('integrations.otherTitle')}</h3>
      <p className="t-caption muted">{t('integrations.otherSub')}</p>
      <ul className="int-grid">
        {cards.map((c) => (
          <li key={c.k} className="int-card" aria-disabled="true">
            <div className="hd">
              <span className="int-lg" aria-hidden="true">
                {c.icon}
              </span>
              <b>{t(`integrations.soon_${c.k}`)}</b>
              <span className="badge">{t('shell.soon')}</span>
            </div>
            <p>{t(`integrations.soon_${c.k}_body`)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** L23-03 : créer ou modifier (même modale, sans le secret en modification). */
function WebhookForm({
  ws,
  hook,
  onClose,
  onCreated,
  onSaved,
}: {
  ws: string;
  hook: Webhook | null;
  onClose: () => void;
  onCreated: (id: string, secret: string) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [url, setUrl] = useState(hook?.url ?? '');
  const [name, setName] = useState(hook?.name ?? '');
  const [events, setEvents] = useState<string[]>(hook?.events ?? []);
  const [urlErr, setUrlErr] = useState(false);
  const [evErr, setEvErr] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  useEffect(() => urlRef.current?.focus(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const bad = !urlOk(url);
    setUrlErr(bad);
    setEvErr(!events.length);
    if (bad) return urlRef.current?.focus();
    if (!events.length) return;
    setBusy(true);
    setErr(null);
    try {
      if (hook) {
        await updateWebhook(hook.id, { url: url.trim(), events, name: name.trim() });
        onSaved();
      } else {
        const r = await createWebhook(ws, url, events, name);
        onCreated(r.id, r.secret);
      }
    } catch (x) {
      const m = (x as { message?: string })?.message ?? '';
      setErr(
        m.includes('PLAN_LIMIT')
          ? t('integrations.planLimit')
          : m.includes('INVALID_URL') || m.includes('webhooks_url_ok')
            ? t('integrations.urlError')
            : errorMessage(t, x),
      );
    } finally {
      setBusy(false);
    }
  }

  const toggle = (ev: string, on: boolean) => {
    setEvents((list) => (on ? [...list, ev] : list.filter((x) => x !== ev)));
    if (on) setEvErr(false);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal l23-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        onSubmit={submit}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        noValidate
      >
        <div className="modal-head">
          <h2 id={`${id}-t`}>{t(hook ? 'integrations.editTitle' : 'integrations.addTitle')}</h2>
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
            <label htmlFor={`${id}-u`}>{t('integrations.url')}</label>
            <input
              ref={urlRef}
              id={`${id}-u`}
              className="input t-mono"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              aria-invalid={urlErr || undefined}
              aria-describedby={`${id}-ue`}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => url && setUrlErr(!urlOk(url))}
            />
            <span className={`help${urlErr ? ' is-error' : ''}`} id={`${id}-ue`}>
              {t('integrations.urlError')}
            </span>
          </div>
          <div className="field l23-gap">
            <label htmlFor={`${id}-n`}>
              {t('integrations.name')} <span className="opt">{t('integrations.optional')}</span>
            </label>
            <input
              id={`${id}-n`}
              className="input"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <fieldset className="l23-fs" aria-describedby={evErr ? `${id}-ee` : undefined}>
            <legend className="t-label">{t('integrations.events')}</legend>
            <div className="ev-list">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev}>
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={(e) => toggle(ev, e.target.checked)}
                  />
                  <span>
                    {t(`integrations.ev_${ev.replace('.', '_')}`)}
                    <small>
                      <code>{ev}</code>
                      {ev === 'lead.created' && ` · ${t('integrations.evLeadHint')}`}
                    </small>
                  </span>
                </label>
              ))}
              <label className="is-soon">
                <input type="checkbox" disabled />
                <span>
                  {t('integrations.ev_alert')} <span className="badge">{t('shell.soon')}</span>
                  <small>
                    <code>alert.triggered</code>
                  </small>
                </span>
              </label>
            </div>
            {evErr && (
              <p className="help is-error" id={`${id}-ee`} role="alert">
                {t('integrations.eventsRequired')}
              </p>
            )}
          </fieldset>
          {events.includes('lead.created') && (
            <div className="alert alert-warning l23-gap" role="status">
              <span>{t('integrations.gdpr')}</span>
            </div>
          )}
          <p className="help l23-gap">{t('integrations.formatHelp')}</p>
          {err && (
            <div className="alert alert-danger l23-gap" role="alert">
              <span>{err}</span>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            aria-disabled={!events.length || busy || undefined}
            onClick={(e) => {
              if (!events.length) {
                e.preventDefault();
                setEvErr(true);
              }
            }}
          >
            {t(hook ? 'integrations.save' : 'integrations.create')}
          </button>
        </div>
      </form>
    </div>
  );
}

/** L23-04 : secret affiché une seule fois (création ou renouvellement). */
export function SecretDialog({
  title,
  secret,
  onTest,
  onDone,
}: {
  title: string;
  secret: string;
  onTest: () => Promise<SendResult>;
  onDone: (testFailure: SendResult | null) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [failure, setFailure] = useState<SendResult | null>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  useEffect(() => copyRef.current?.focus(), []);
  return (
    <div className="modal-backdrop">
      <div
        className="modal l23-modal-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
      >
        <div className="modal-head">
          <h2 id={`${id}-t`}>{title}</h2>
        </div>
        <div className="modal-body">
          <p className="muted" id={`${id}-d`}>
            {t('integrations.secretBody')} <b>{t('integrations.secretOnce')}</b>{' '}
            {t('integrations.secretLost')}
          </p>
          <div className="secret l23-gap">
            <code>{secret}</code>
            <button
              ref={copyRef}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(secret).catch(() => undefined);
                toast(t('integrations.copied'));
              }}
            >
              <Copy aria-hidden="true" />
              {t('integrations.copy')}
            </button>
          </div>
          <label className="check l23-gap">
            <input type="checkbox" checked={copied} onChange={(e) => setCopied(e.target.checked)} />
            {t('integrations.copiedCheck')}
          </label>
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                const r = await onTest();
                toast(resultText(t, r));
                setFailure(r.status >= 200 && r.status < 300 ? null : r);
              } catch (e) {
                toast(errorMessage(t, e));
              }
            }}
          >
            <Send aria-hidden="true" />
            {t('integrations.sendTest')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={!copied || undefined}
            onClick={() => copied && onDone(failure)}
          >
            {t('integrations.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
