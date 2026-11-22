/**
 * L23-01 à 04, L48-F §2 : Paramètres > Intégrations > Webhooks (/settings/integrations/webhooks).
 * Liste des webhooks, création ou modification, secret affiché une seule fois.
 * Réservé aux propriétaires et admins (RLS côté base ; message d'accès refusé ici).
 */
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Copy, KeyRound, Plus, Send, TriangleAlert, Webhook as WebhookIcon } from 'lucide-react';
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
import { Button, Modal } from '@flowdsiml/ui';

export function WebhooksPage() {
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

  const sub = { title: t('integrations.webhooks') };
  if (!allowed)
    return (
      <SettingsShell sub={sub} legacy={false}>
        <div className="stg-empty" role="status">
          <span className="stg-empty__tile" aria-hidden="true">
            <WebhookIcon size={20} />
          </span>
          <h2>{t('integrations.noAccess')}</h2>
          <div className="stg-empty__acts">
            <Link className="fd-btn" to="/settings/workspace">
              {t('integrations.backGeneral')}
            </Link>
          </div>
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
  const addButton = (
    <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
      {t('integrations.add')}
    </Button>
  );

  return (
    <SettingsShell sub={sub} legacy={false} actions={addButton}>
      <section className="stg-sec l23" aria-labelledby="wh-title">
        <div className="stg-sec__head">
          <div>
            <h2 id="wh-title">{t('integrations.webhooks')}</h2>
            <p>{t('integrations.webhooksSub')}</p>
          </div>
        </div>
        {hooks === null ? null : hooks.length === 0 ? (
          <div className="stg-empty">
            <span className="stg-empty__tile" aria-hidden="true">
              <WebhookIcon size={20} />
            </span>
            <h3>{t('integrations.emptyTitle')}</h3>
            <p>{t('integrations.emptyBody')}</p>
            <div className="stg-empty__acts">{addButton}</div>
          </div>
        ) : (
          <div className="wh-table">
            {/* Nom accessible par aria-label : une caption sr-only élargissait la zone défilante à 390 px */}
            <table className="stg-table" aria-label={t('integrations.tableCaption')}>
              <thead>
                <tr>
                  <th scope="col">{t('integrations.colUrl')}</th>
                  <th scope="col" className="stg-table__m-hide">
                    {t('integrations.colEvents')}
                  </th>
                  <th scope="col">{t('integrations.colState')}</th>
                  <th scope="col" className="stg-table__m-hide">
                    {t('integrations.colLast')}
                  </th>
                  <th scope="col" className="stg-table__act">
                    <span className="sr-only">{t('integrations.colActions')}</span>
                  </th>
                </tr>
              </thead>
              {/* §18.6 : lignes à filets de 56 px, l'écart est porté par la hauteur des lignes */}
              <tbody data-gap-exempt="">
                {hooks.map((h) => {
                  const d = last[h.id];
                  return (
                    <tr key={h.id}>
                      <td>
                        <Link className="wh-url" to={`/settings/integrations/${h.id}`} title={h.url}>
                          {h.url}
                        </Link>
                        {h.name && <div className="stg-table__sub">{h.name}</div>}
                      </td>
                      <td className="stg-table__m-hide">
                        <EventBadges events={h.events} />
                      </td>
                      <td>
                        <StateBadge h={h} />
                      </td>
                      <td className="stg-table__m-hide">
                        {d ? (
                          <>
                            <span className={`st ${statusKind(d)}`}>{statusText(d)}</span>{' '}
                            <span className="stg-muted wh-when">{formatRelativeShort(d.created_at)}</span>
                          </>
                        ) : (
                          <span className="stg-muted wh-when">{t('integrations.never')}</span>
                        )}
                      </td>
                      <td className="stg-table__act">
                        <Menu
                          label={t('integrations.actionsFor', { host: hostOf(h.url) })}
                          items={[
                            {
                              label: t('integrations.sendTest'),
                              icon: <Send />,
                              onSelect: () => void test(h),
                            },
                            {
                              label: t(h.state === 'active' ? 'integrations.disable' : 'integrations.enable'),
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
        <span key={e} className="wh-evp">
          {e}
        </span>
      ))}
      {events.length > max && <span className="wh-evp">+{events.length - max}</span>}
    </div>
  );
}

/** L48-F §2 (T4) : état en texte avec un point (Actif, En pause, Désactivé), sans badge.
 * `inline` : sans le nombre d'échecs (en-tête du détail, où le bandeau le donne déjà). */
export function StateBadge({ h, inline = false }: { h: Webhook; inline?: boolean }) {
  const { t } = useTranslation();
  if (h.state === 'active') return <span className="wh-state wh-state--ok">{t('integrations.active')}</span>;
  if (h.state === 'paused_auto')
    return (
      <>
        <span className="wh-state wh-state--warn">{t('integrations.pausedAuto')}</span>
        {!inline && <div className="wh-fail">{t('integrations.failures', { count: h.failures })}</div>}
      </>
    );
  return <span className="wh-state">{t('integrations.disabled')}</span>;
}

/** L23-03 : créer ou modifier (même modale, sans le secret en modification). */
export function WebhookForm({
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
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<WebhookIcon />}
      title={t(hook ? 'integrations.editTitle' : 'integrations.addTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            type="submit"
            form={`${id}-f`}
            aria-disabled={!events.length || busy || undefined}
            onClick={(e) => {
              if (!events.length) {
                e.preventDefault();
                setEvErr(true);
              }
            }}
          >
            {t(hook ? 'integrations.save' : 'integrations.create')}
          </Button>
        </>
      }
    >
      <form id={`${id}-f`} className="st-invite__form wh-form" onSubmit={submit} noValidate>
        <div className="fd-modal__field">
          <label htmlFor={`${id}-u`}>{t('integrations.url')}</label>
          <input
            ref={urlRef}
            id={`${id}-u`}
            className="fd-input"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://…"
            value={url}
            aria-invalid={urlErr || undefined}
            aria-describedby={`${id}-ue`}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => url && setUrlErr(!urlOk(url))}
          />
          <span className={urlErr ? 'stg-error' : 'stg-help'} id={`${id}-ue`}>
            {urlErr && <CircleAlert size={16} aria-hidden="true" />}
            {t('integrations.urlError')}
          </span>
        </div>
        <div className="fd-modal__field">
          <label htmlFor={`${id}-n`}>
            {t('integrations.name')} <span className="stg-soon">{t('integrations.optional')}</span>
          </label>
          <input
            id={`${id}-n`}
            className="fd-input"
            autoComplete="off"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <fieldset className="stg-fieldset wh-events" aria-describedby={evErr ? `${id}-ee` : undefined}>
          <legend className="fd-modal__label">{t('integrations.events')}</legend>
          {/* §18.6 : cases d'un même groupe à 8 px (COMP-01) */}
          <div className="ev-list" data-gap-exempt="">
            {WEBHOOK_EVENTS.map((ev) => (
              <label key={ev} className="stg-opt">
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
          </div>
          {evErr && (
            <p className="stg-error" id={`${id}-ee`} role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              {t('integrations.eventsRequired')}
            </p>
          )}
        </fieldset>
        {events.includes('lead.created') && (
          <p className="wh-warn" role="status">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>{t('integrations.gdpr')}</span>
          </p>
        )}
        <p className="stg-help wh-format">{t('integrations.formatHelp')}</p>
        {err && (
          <p className="stg-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {err}
          </p>
        )}
      </form>
    </Modal>
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
  const boxRef = useRef<HTMLDivElement>(null);
  // Après l'ouverture de la modale : le focus va à « Copier »
  useEffect(() => boxRef.current?.querySelector('button')?.focus(), []);
  return (
    <Modal
      open
      onClose={() => undefined}
      size="md"
      role="alertdialog"
      dismissible={false}
      describedBy={`${id}-d`}
      icon={<KeyRound />}
      title={title}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button
            icon={<Send size={16} />}
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
            {t('integrations.sendTest')}
          </Button>
          <Button
            variant="primary"
            aria-disabled={!copied || undefined}
            onClick={() => copied && onDone(failure)}
          >
            {t('integrations.done')}
          </Button>
        </>
      }
    >
      <div className="wh-secret">
        <p id={`${id}-d`}>
          {t('integrations.secretBody')} <b>{t('integrations.secretOnce')}</b> {t('integrations.secretLost')}
        </p>
        <div className="secret" ref={boxRef}>
          <code>{secret}</code>
          <Button
            icon={<Copy size={16} />}
            onClick={() => {
              void navigator.clipboard?.writeText(secret).catch(() => undefined);
              toast(t('integrations.copied'));
            }}
          >
            {t('integrations.copy')}
          </Button>
        </div>
        <label className="stg-opt">
          <input type="checkbox" checked={copied} onChange={(e) => setCopied(e.target.checked)} />
          <span>{t('integrations.copiedCheck')}</span>
        </label>
      </div>
    </Modal>
  );
}
