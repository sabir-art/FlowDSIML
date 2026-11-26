/**
 * ALERT-01 §7-8 et retours client, planche 4 : fenêtre Slack (gabarit MODAL-01). Webhook entrant de
 * l'espace pour les alertes analytics. L'adresse est un secret : elle n'est jamais relue, seulement sa
 * forme masquée (« hooks.slack.com/services/T000…/•••• »). « Connecter » vérifie l'adresse en envoyant
 * un message de test ; un échec s'affiche sous le champ et rien n'est gardé.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, CircleAlert, ExternalLink, Lock, MessageSquare, Send, UserPlus } from 'lucide-react';
import { Button, Modal } from '@flowdsiml/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';

/** Même contrôle que la base : https et hôte hooks.slack.com. */
export const slackUrlOk = (u: string) =>
  /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]{8,200}$/.test(u);

/** Page d'aide de Slack : créer un webhook entrant. */
const SLACK_HELP = 'https://api.slack.com/messaging/webhooks';

export async function slackConnected(ws: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('slack_webhook_connected', { p_ws: ws });
  return !error && data === true;
}

type Info = { connected: boolean; masked?: string; alerts?: boolean };

/** Envoie le message de test de l'adresse enregistrée. Rend la clé du message d'erreur, ou null. */
async function sendTest(ws: string): Promise<string | null> {
  const queued = await supabase.rpc('slack_webhook_test', { p_ws: ws });
  if (queued.error || typeof queued.data !== 'number')
    return queued.error?.message.includes('SLACK_RATE')
      ? 'integrations.slack.testRate'
      : 'integrations.slack.testKo';
  const sent = await supabase.functions.invoke<{ ok: boolean }>('webhooks-dispatch', {
    body: { slack_test: queued.data },
  });
  return !sent.error && sent.data?.ok ? null : 'integrations.slack.testKo';
}

export function SlackDialog({
  ws,
  connected,
  logo,
  onClose,
  onChanged,
}: {
  ws: string;
  connected: boolean;
  logo: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [confirm, ask] = useConfirm();
  const [url, setUrl] = useState('');
  /** Erreur sous le champ : clé du message. */
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<Info>({ connected });
  /** Interrupteur « Alertes analytics » : valeur affichée (enregistrée par Connecter ou Enregistrer). */
  const [alerts, setAlerts] = useState(true);
  const field = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase.rpc('slack_webhook_info', { p_ws: ws });
    if (error || !data) return;
    const i = data as Info;
    setInfo(i);
    if (i.connected) setAlerts(i.alerts !== false);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, connected]);
  useEffect(() => {
    if (!info.connected) field.current?.focus();
  }, [info.connected]);

  const run = (f: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };
  /** Connecter : l'adresse est vérifiée par un message de test ; un échec ne garde rien. */
  const connect = run(async () => {
    const v = url.trim();
    if (!slackUrlOk(v)) {
      setErr('integrations.slack.urlError');
      field.current?.focus();
      return;
    }
    const { error } = await supabase.rpc('slack_webhook_set', { p_ws: ws, p_url: v });
    if (error) {
      setErr('integrations.slack.urlError');
      return;
    }
    if (!alerts) await supabase.rpc('slack_webhook_alerts', { p_ws: ws, p_on: false });
    const ko = await sendTest(ws);
    if (ko) {
      await supabase.rpc('slack_webhook_remove', { p_ws: ws });
      setErr(ko === 'integrations.slack.testRate' ? ko : 'integrations.slack.connectKo');
      field.current?.focus();
      return;
    }
    setUrl('');
    await onChanged();
    await load();
    toast(t('integrations.slack.saved'));
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void connect();
  };
  const dirty = info.connected && alerts !== (info.alerts !== false);

  const events: Array<{ key: string; icon: React.ReactNode; soon: boolean }> = [
    { key: 'Alerts', icon: <BarChart3 aria-hidden="true" />, soon: false },
    { key: 'Leads', icon: <UserPlus aria-hidden="true" />, soon: true },
    { key: 'Comments', icon: <MessageSquare aria-hidden="true" />, soon: true },
  ];

  return (
    <>
      {/* La confirmation est une fenêtre à part, jamais imbriquée dans celle de Slack */}
      {confirm}
      <Modal
        open
        onClose={onClose}
        size="md"
        icon={<img src={logo} alt="" width={20} height={20} />}
        title={t('integrations.soon_slack')}
        subtitle={t('integrations.slack.subtitle')}
        titleEnd={
          info.connected ? (
            <span className="fd-badge int-slack__on">{t('integrations.slack.connected')}</span>
          ) : null
        }
        closeLabel={t('common.close')}
        className="int-slack-dlg"
        footer={
          info.connected ? (
            <div className="int-slack__foot">
              <button
                type="button"
                className="link-button int-slack__remove"
                aria-disabled={busy || undefined}
                onClick={run(async () => {
                  const yes = await ask({
                    title: t('integrations.slack.removeTitle'),
                    body: t('integrations.slack.removeBody'),
                    confirmLabel: t('integrations.slack.remove'),
                    danger: true,
                  });
                  if (!yes) return;
                  await supabase.rpc('slack_webhook_remove', { p_ws: ws });
                  await onChanged();
                  setInfo({ connected: false });
                  setAlerts(true);
                  toast(t('integrations.slack.removed'));
                })}
              >
                {t('integrations.slack.remove')}
              </button>
              <span className="int-slack__acts">
                <Button
                  icon={<Send size={16} />}
                  aria-disabled={busy || undefined}
                  onClick={run(async () => {
                    const ko = await sendTest(ws);
                    toast(t(ko ?? 'integrations.slack.testOk'));
                  })}
                >
                  {t('integrations.sendTest')}
                </Button>
                <Button
                  variant="primary"
                  disabled={!dirty || busy}
                  onClick={run(async () => {
                    await supabase.rpc('slack_webhook_alerts', { p_ws: ws, p_on: alerts });
                    await load();
                    toast(t('common.saved'));
                  })}
                >
                  {t('common.save')}
                </Button>
              </span>
            </div>
          ) : (
            <>
              <Button onClick={onClose}>{t('common.cancel')}</Button>
              <Button variant="primary" type="submit" form={`${id}-f`} aria-disabled={busy || undefined}>
                {t('integrations.slack.connectBtn')}
              </Button>
            </>
          )
        }
      >
        <div className="int-slack">
          <section>
            <h3 className="int-slack__t" id={`${id}-s`}>
              {t('integrations.slack.scopeTitle')}
            </h3>
            <ul className="int-slack__ev" aria-labelledby={`${id}-s`}>
              {events.map((e) => (
                <li key={e.key} aria-disabled={e.soon || undefined}>
                  <span className="int-slack__tile">{e.icon}</span>
                  <span className="int-slack__tx">
                    <b id={`${id}-${e.key}`}>{t(`integrations.slack.scope${e.key}`)}</b>
                    <small>{t(`integrations.slack.scope${e.key}Help`)}</small>
                  </span>
                  <span className="int-slack__state">
                    {e.soon ? (
                      <span className="int-slack__soon">{t('shell.soon')}</span>
                    ) : (
                      <label className="fd-switch">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={alerts}
                          aria-labelledby={`${id}-${e.key}`}
                          onChange={(ev) => setAlerts(ev.target.checked)}
                        />
                        <span className="fd-switch__track" aria-hidden="true" />
                      </label>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {info.connected ? (
            <div className="int-slack__field">
              <span className="int-slack__lbl" id={`${id}-m`}>
                {t('integrations.slack.urlConnected')}
              </span>
              <p className="int-slack__ro" aria-labelledby={`${id}-m`} aria-describedby={`${id}-mh`}>
                <Lock size={16} aria-hidden="true" />
                <span>{info.masked}</span>
              </p>
              <span className="stg-help" id={`${id}-mh`}>
                {t('integrations.slack.changeHelp')}
              </span>
            </div>
          ) : (
            <form id={`${id}-f`} className="int-slack__field" onSubmit={onSubmit} noValidate>
              <div className="int-slack__lblrow">
                <label htmlFor={`${id}-u`} className="int-slack__lbl">
                  {t('integrations.slack.url')}
                </label>
                <a className="int-slack__how" href={SLACK_HELP} target="_blank" rel="noreferrer">
                  {t('integrations.slack.how')}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
              <input
                ref={field}
                id={`${id}-u`}
                className="fd-input int-slack__input"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://hooks.slack.com/services/…"
                value={url}
                aria-invalid={err ? true : undefined}
                aria-describedby={`${id}-ue`}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setErr(null);
                }}
              />
              <span
                className={err ? 'stg-error' : 'stg-help'}
                id={`${id}-ue`}
                role={err ? 'alert' : undefined}
              >
                {err && <CircleAlert size={16} aria-hidden="true" />}
                {t(err ?? 'integrations.slack.urlHelp')}
              </span>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}
